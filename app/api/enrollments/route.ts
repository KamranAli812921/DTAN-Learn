import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Enrollment } from "@/models";
import { enrollmentSchema } from "@/lib/validators/academic";
import { requireRole, requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, getTeacherBatchIds, getStudentProfileId } from "@/lib/permissions";

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
    filter.student = await getStudentProfileId(session);
  }

  const enrollments = await Enrollment.find(filter)
    .populate("student", "fullName studentId")
    .populate("course", "courseCode courseName")
    .populate("batch", "batchName")
    .sort({ createdAt: -1 });

  return NextResponse.json(enrollments);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireRole("admin");
  await connectDB();
  const body = await req.json();
  const data = enrollmentSchema.parse(body);

  const existing = await Enrollment.findOne({ student: data.student, batch: data.batch });
  if (existing) throw new ApiError(409, "This student is already enrolled in that batch.");

  const enrollment = await Enrollment.create(data);
  return NextResponse.json(enrollment, { status: 201 });
});
