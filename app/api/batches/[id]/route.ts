import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Batch } from "@/models";
import { batchSchema, batchTotalClassesSchema } from "@/lib/validators/academic";
import { requireRole, requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId, getTeacherProfileId, getStudentProfileId, assertTeacherOwnsBatch } from "@/lib/permissions";
import { Student } from "@/models";

export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireSession();
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid batch id.");

  const batch = await Batch.findById(params.id).populate("course", "courseCode courseName").populate("teacher", "fullName teacherId");
  if (!batch) throw new ApiError(404, "Batch not found.");

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    if (batch.teacher?._id?.toString() !== teacherId) throw new ApiError(403, "You are not assigned to this batch.");
  } else if (session.user.role === "student") {
    const studentId = await getStudentProfileId(session);
    const student = await Student.findById(studentId);
    if (student?.batch?.toString() !== batch._id.toString()) throw new ApiError(403, "You are not enrolled in this batch.");
  }

  return NextResponse.json(batch);
});

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid batch id.");
  const body = await req.json();

  // Teachers may only adjust the planned total-classes count on their own
  // batch — everything else (course/teacher/schedule/status) is admin-only.
  let data: Record<string, unknown>;
  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, params.id);
    data = batchTotalClassesSchema.parse(body);
  } else {
    data = batchSchema.partial().parse(body);
  }

  const batch = await Batch.findByIdAndUpdate(params.id, data, { new: true, runValidators: true });
  if (!batch) throw new ApiError(404, "Batch not found.");
  return NextResponse.json(batch);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole("admin");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid batch id.");
  const batch = await Batch.findByIdAndUpdate(params.id, { status: "completed" }, { new: true });
  if (!batch) throw new ApiError(404, "Batch not found.");
  return NextResponse.json(batch);
});
