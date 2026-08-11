import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Attendance, AttendanceAuditLog } from "@/models";
import { manualAttendanceSchema } from "@/lib/validators/attendance";
import { requireRole, requireSession, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, getTeacherBatchIds, getStudentProfileId, assertTeacherOwnsBatch } from "@/lib/permissions";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireSession();
  await connectDB();

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const studentId = searchParams.get("studentId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const filter: Record<string, unknown> = {};
  if (studentId) filter.student = studentId;
  if (from || to) {
    filter.date = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  }

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    const batchIds = await getTeacherBatchIds(teacherId);
    filter.batch = batchId ? batchId : { $in: batchIds };
  } else if (session.user.role === "student") {
    filter.student = await getStudentProfileId(session);
  } else if (batchId) {
    filter.batch = batchId;
  }

  const records = await Attendance.find(filter)
    .populate("student", "fullName studentId")
    .populate("batch", "batchName")
    .populate("markedBy", "username")
    .sort({ date: -1 });

  return NextResponse.json(records);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  const body = await req.json();
  const data = manualAttendanceSchema.parse(body);

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, data.batch);
  }

  // UTC day boundary — dates are parsed/queried as UTC elsewhere (see GET
  // above and lib/attendance-sync.ts), so normalize with setUTCHours, not
  // the server's local timezone (setHours), or this silently lands on the
  // wrong day on any non-UTC server.
  const date = new Date(data.date);
  date.setUTCHours(0, 0, 0, 0);

  const attendance = await Attendance.create({
    student: data.student,
    batch: data.batch,
    date,
    status: data.status,
    markedBy: session.user.id,
    source: "manual",
    remarks: data.remarks,
  });

  // Every manual attendance mark is logged, including the initial mark
  // (baseline "absent"/unmarked -> chosen status), per spec 5/6: "write one
  // entry on every manual attendance change, no exceptions."
  await AttendanceAuditLog.create({
    attendance: attendance._id,
    student: data.student,
    previousStatus: "absent",
    newStatus: data.status,
    changedBy: session.user.id,
    reason: data.remarks || "Initial manual attendance mark.",
  });

  return NextResponse.json(attendance, { status: 201 });
});
