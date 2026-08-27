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

  // A "session" is one live class occurrence. Attendance is now keyed by the
  // live class it belongs to (a batch can run several classes on the same
  // day), so scope straight to that class rather than to its calendar day.
  let sessionBatch: string | null = null;
  if (liveClassId) {
    if (!isValidObjectId(liveClassId)) throw new ApiError(400, "Invalid live class id.");
    const liveClass = await LiveClass.findById(liveClassId).select("batch");
    if (!liveClass) throw new ApiError(404, "Live class not found.");
    sessionBatch = liveClass.batch.toString();
    filter.liveClass = liveClassId;
  } else if (from || to) {
    filter.date = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  }

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    if (sessionBatch) {
      await assertTeacherOwnsBatch(teacherId, sessionBatch);
    } else {
      const batchIds = await getTeacherBatchIds(teacherId);
      filter.batch = batchId ? batchId : { $in: batchIds };
    }
  } else if (session.user.role === "student") {
    filter.student = await getStudentProfileId(session);
  } else if (!sessionBatch && batchId) {
    filter.batch = batchId;
  }

  const records = await Attendance.find(filter)
    .populate("student", "fullName studentId")
    .populate("batch", "batchName")
    .populate("liveClass", "topic startTime durationMinutes")
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

  // When a specific live class is targeted (the attendance manager always has
  // one selected), the record is keyed to that class. Its date comes from the
  // class so it lines up with any Zoom-synced record for the same class.
  let liveClassId: string | undefined;
  let date = new Date(data.date);
  if (data.liveClass) {
    const liveClass = await LiveClass.findById(data.liveClass).select("batch startTime");
    if (!liveClass) throw new ApiError(404, "Live class not found.");
    if (liveClass.batch.toString() !== data.batch) throw new ApiError(400, "That live class is not in this batch.");
    liveClassId = data.liveClass;
    date = new Date(liveClass.startTime);
  }
  // UTC day boundary — dates are parsed/queried as UTC elsewhere (see GET
  // above and lib/attendance-sync.ts), so normalize with setUTCHours, not
  // the server's local timezone (setHours), or this silently lands on the
  // wrong day on any non-UTC server.
  date.setUTCHours(0, 0, 0, 0);

  const existing = await Attendance.findOne({
    student: data.student,
    date,
    ...(liveClassId ? { liveClass: liveClassId } : { liveClass: null }),
  });
  if (existing) throw new ApiError(409, "This student already has an attendance record for this session — edit that one instead.");

  const attendance = await Attendance.create({
    student: data.student,
    batch: data.batch,
    liveClass: liveClassId,
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
