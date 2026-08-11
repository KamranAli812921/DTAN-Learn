import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Material, Student } from "@/models";
import { materialSchema } from "@/lib/validators/coursework";
import { requireRole, requireSession, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, getTeacherBatchIds, assertTeacherOwnsBatch, getStudentProfileId } from "@/lib/permissions";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireSession();
  await connectDB();

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");

  const filter: Record<string, unknown> = {};
  if (batchId) filter.batch = batchId;

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    const batchIds = await getTeacherBatchIds(teacherId);
    filter.batch = batchId ? batchId : { $in: batchIds };
  } else if (session.user.role === "student") {
    const studentId = await getStudentProfileId(session);
    const student = await Student.findById(studentId);
    filter.batch = student?.batch;
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

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, data.batch);
  }

  const material = await Material.create({ ...data, uploadedBy: session.user.id });
  return NextResponse.json(material, { status: 201 });
});
