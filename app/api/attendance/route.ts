import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Attendance, AttendanceAuditLog, LiveClass } from "@/models";
import { manualAttendanceSchema } from "@/lib/validators/attendance";
import { requireRole, requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, getTeacherBatchIds, getStudentProfileId, assertTeacherOwnsBatch, isValidObjectId } from "@/lib/permissions";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireSession();
  await connectDB();

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const studentId = searchParams.get("studentId");
  const liveClassId = searchParams.get("liveClassId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const filter: Record<string, unknown> = {};
  if (studentId) filter.student = studentId;

  // A "session" is one live class occurrence — its attendance is every
  // Attendance record for that batch on that class's (UTC) day. Mirrors the
  // day-boundary lookup mergeAttendanceSegment/markAbsentees use to
  // create/find those same records, so this always matches what synced.
  let sessionFilter: { batch: string; date: { $gte: Date; $lt: Date } } | null = null;
  if (liveClassId) {
    if (!isValidObjectId(liveClassId)) throw new ApiError(400, "Invalid live class id.");
    const liveClass = await LiveClass.findById(liveClassId).select("batch startTime");
    if (!liveClass) throw new ApiError(404, "Live class not found.");
    const day = new Date(liveClass.startTime);
    day.setUTCHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    sessionFilter = { batch: liveClass.batch.toString(), date: { $gte: day, $lt: nextDay } };
  } else if (from || to) {
    filter.date = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  }

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    if (sessionFilter) {
      await assertTeacherOwnsBatch(teacherId, sessionFilter.batch);
      filter.batch = sessionFilter.batch;
      filter.date = sessionFilter.date;
    } else {
      const batchIds = await getTeacherBatchIds(teacherId);
      filter.batch = batchId ? batchId : { $in: batchIds };
    }
  } else if (session.user.role === "student") {
    filter.student = await getStudentProfileId(session);
    if (sessionFilter) filter.date = sessionFilter.date;
  } else if (sessionFilter) {
    filter.batch = sessionFilter.batch;
    filter.date = sessionFilter.date;
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
