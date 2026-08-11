import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { LiveClass, Student } from "@/models";
import { requireSession, requireRole, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId, getTeacherProfileId, getStudentProfileId } from "@/lib/permissions";

export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireSession();
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid live class id.");

  const liveClass = await LiveClass.findById(params.id).populate("batch", "batchName").populate("course", "courseName");
  if (!liveClass) throw new ApiError(404, "Live class not found.");

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    if (liveClass.teacher.toString() !== teacherId) throw new ApiError(403, "You are not assigned to this class.");
  } else if (session.user.role === "student") {
    const studentId = await getStudentProfileId(session);
    const student = await Student.findById(studentId);
    if (student?.batch?.toString() !== liveClass.batch._id.toString()) throw new ApiError(403, "Not your batch.");
  }

  return NextResponse.json(liveClass);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid live class id.");

  const liveClass = await LiveClass.findById(params.id);
  if (!liveClass) throw new ApiError(404, "Live class not found.");

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    if (liveClass.teacher.toString() !== teacherId) throw new ApiError(403, "You are not assigned to this class.");
  }

  liveClass.status = "cancelled";
  await liveClass.save();
  return NextResponse.json(liveClass);
});
