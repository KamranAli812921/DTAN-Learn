import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Attendance, AttendanceAuditLog, Student } from "@/models";
import { requireRole, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId, getTeacherProfileId, getTeacherBatchIds, assertTeacherOwnsBatch } from "@/lib/permissions";

// Admin/teacher — audit trail of manual attendance overrides. Teachers are
// scoped to their own batches, same as every other list/detail endpoint
// (see assertTeacherOwnsBatch / getTeacherBatchIds) — this route must never
// let a teacher read another teacher's batch history just by supplying an
// attendanceId/studentId they guessed or found elsewhere.
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();

  const { searchParams } = new URL(req.url);
  const attendanceId = searchParams.get("attendanceId");
  const studentId = searchParams.get("studentId");

  const filter: Record<string, unknown> = {};
  if (attendanceId) filter.attendance = attendanceId;
  if (studentId) filter.student = studentId;

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);

    if (attendanceId) {
      if (!isValidObjectId(attendanceId)) throw new ApiError(400, "Invalid attendance id.");
      const attendance = await Attendance.findById(attendanceId);
      if (!attendance) throw new ApiError(404, "Attendance record not found.");
      await assertTeacherOwnsBatch(teacherId, attendance.batch.toString());
    }

    if (studentId) {
      if (!isValidObjectId(studentId)) throw new ApiError(400, "Invalid student id.");
      const student = await Student.findById(studentId);
      if (!student) throw new ApiError(404, "Student not found.");
      await assertTeacherOwnsBatch(teacherId, student.batch.toString());
    }

    if (!attendanceId && !studentId) {
      const batchIds = await getTeacherBatchIds(teacherId);
      const scopedStudents = await Student.find({ batch: { $in: batchIds } }).select("_id");
      filter.student = { $in: scopedStudents.map((s) => s._id) };
    }
  }

  const logs = await AttendanceAuditLog.find(filter)
    .populate("changedBy", "username")
    .populate("student", "fullName studentId")
    .sort({ createdAt: -1 });

  return NextResponse.json(logs);
});
