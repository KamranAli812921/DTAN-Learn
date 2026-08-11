import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Attendance, AttendanceAuditLog } from "@/models";
import { attendanceOverrideSchema } from "@/lib/validators/attendance";
import { requireRole, requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId, getTeacherProfileId, assertTeacherOwnsBatch, getStudentProfileId } from "@/lib/permissions";

export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireSession();
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid attendance id.");

  const attendance = await Attendance.findById(params.id).populate("student", "fullName studentId").populate("batch", "batchName");
  if (!attendance) throw new ApiError(404, "Attendance record not found.");

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, attendance.batch._id.toString());
  } else if (session.user.role === "student") {
    const studentId = await getStudentProfileId(session);
    if (attendance.student._id.toString() !== studentId) throw new ApiError(403, "You may only view your own attendance.");
  }

  return NextResponse.json(attendance);
});

// Manual override — always writes an AttendanceAuditLog entry (spec 6.6, non-negotiable).
export const PATCH = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid attendance id.");

  const attendance = await Attendance.findById(params.id);
  if (!attendance) throw new ApiError(404, "Attendance record not found.");

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, attendance.batch.toString());
  }

  const body = await req.json();
  const { status, reason } = attendanceOverrideSchema.parse(body);

  const previousStatus = attendance.status;

  attendance.status = status;
  attendance.remarks = reason;
  attendance.markedBy = session.user.id as unknown as typeof attendance.markedBy;
  await attendance.save();

  await AttendanceAuditLog.create({
    attendance: attendance._id,
    student: attendance.student,
    previousStatus,
    newStatus: status,
    changedBy: session.user.id,
    reason,
  });

  return NextResponse.json(attendance);
});
