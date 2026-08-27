import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Material, Student, Batch } from "@/models";
import { materialSchema } from "@/lib/validators/coursework";
import { requireRole, requireSession, withErrorHandling } from "@/lib/api-helpers";
import {
  getTeacherProfileId,
  getTeacherBatchIds,
  assertTeacherOwnsBatch,
  assertTeacherOwnsCourse,
  getStudentProfileId,
} from "@/lib/permissions";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireSession();
  await connectDB();

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");

  const filter: Record<string, unknown> = {};
  if (batchId) filter.batch = batchId;

  // Materials are either batch-scoped (targetType "batch", `batch` set) or
  // course-scoped (targetType "course", visible to every batch of that course).
  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    const batchIds = await getTeacherBatchIds(teacherId);
    const teacherBatches = await Batch.find({ _id: { $in: batchIds } }).select("course");
    const courseIds = teacherBatches.map((b) => b.course);
    delete filter.batch;
    filter.$or = [
      { targetType: "batch", batch: batchId ? batchId : { $in: batchIds } },
      { targetType: "course", course: { $in: courseIds } },
    ];
  } else if (session.user.role === "student") {
    const studentId = await getStudentProfileId(session);
    const student = await Student.findById(studentId);
    delete filter.batch;
    filter.$or = [
      { targetType: "batch", batch: student?.batch },
      { targetType: "course", course: student?.course },
    ];
  }

  const materials = await Material.find(filter)
    .populate("course", "courseCode courseName")
    .populate("batch", "batchName")
    .populate("uploadedBy", "username")
    .sort({ createdAt: -1 });

  return NextResponse.json(materials);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  const body = await req.json();
  const data = materialSchema.parse(body);
  const batch = data.targetType === "batch" ? data.batch : undefined;

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    if (data.targetType === "batch") {
      await assertTeacherOwnsBatch(teacherId, batch!);
    } else {
      await assertTeacherOwnsCourse(teacherId, data.course);
    }
  }

  const material = await Material.create({
    course: data.course,
    targetType: data.targetType,
    batch,
    title: data.title,
    description: data.description,
    fileUrl: data.fileUrl,
    uploadedBy: session.user.id,
  });
  return NextResponse.json(material, { status: 201 });
});
