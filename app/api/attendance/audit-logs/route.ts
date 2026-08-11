import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { AttendanceAuditLog } from "@/models";
import { requireRole, withErrorHandling } from "@/lib/api-helpers";

// Admin/teacher only — audit trail of manual attendance overrides.
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireRole("admin", "teacher");
  await connectDB();

  const { searchParams } = new URL(req.url);
  const attendanceId = searchParams.get("attendanceId");
  const studentId = searchParams.get("studentId");

  const filter: Record<string, unknown> = {};
  if (attendanceId) filter.attendance = attendanceId;
  if (studentId) filter.student = studentId;

  const logs = await AttendanceAuditLog.find(filter)
    .populate("changedBy", "username")
    .populate("student", "fullName studentId")
    .sort({ createdAt: -1 });

  return NextResponse.json(logs);
});
