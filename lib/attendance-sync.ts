import { Attendance, LiveClass, Student } from "@/models";
import type { IAttendanceSession, AttendanceStatus } from "@/models/Attendance";

// Use UTC day boundaries, not the server's local timezone: dates are stored
// and queried as UTC instants (ISO date-only strings like "2026-07-01" parse
// as UTC midnight), so normalizing with the local-time setHours() would
// silently shift the stored date onto the wrong UTC day on any server not
// running in UTC (e.g. it broke exact-date attendance lookups on a UTC+5 box).
function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

/**
 * Recompute status from sessions + the live class definition:
 *  - absent  : no sessions logged at all
 *  - late    : the first (earliest) session started after the allowed
 *              joining window (startTime + joinWindowMinutes)
 *  - present : total duration across all sessions >= 70% of class duration
 *  - late    : attended within the window but total duration fell short of
 *              70% (spec doesn't define a distinct "partial" status; this is
 *              the closest fit, and can always be manually overridden)
 */
export function computeAttendanceStatus(
  sessions: IAttendanceSession[],
  liveClass: { startTime: Date; durationMinutes: number; joinWindowMinutes: number }
): AttendanceStatus {
  if (!sessions.length) return "absent";

  const sorted = [...sessions].sort((a, b) => a.joinTime.getTime() - b.joinTime.getTime());
  const firstJoin = sorted[0].joinTime;
  const windowEnd = new Date(liveClass.startTime.getTime() + liveClass.joinWindowMinutes * 60_000);

  if (firstJoin.getTime() > windowEnd.getTime()) return "late";

  const totalDurationMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const threshold = 0.7 * liveClass.durationMinutes;

  return totalDurationMinutes >= threshold ? "present" : "late";
}

/**
 * Merge one join/leave segment for a student into that day's Attendance
 * record for the batch, appending to sessions[] (never overwriting a prior
 * segment) and recomputing totalDurationMinutes as the sum of every
 * segment. Idempotent on zoomParticipantId so the webhook firing twice, or
 * the polling fallback re-reporting a segment the webhook already recorded,
 * never double-counts duration.
 */
export async function mergeAttendanceSegment(params: {
  liveClassId: string;
  studentId: string;
  batchId: string;
  joinTime: Date;
  leaveTime: Date | null;
  zoomParticipantId?: string;
  zoomMeetingId: string;
}): Promise<void> {
  const liveClass = await LiveClass.findById(params.liveClassId);
  if (!liveClass) return;

  const date = startOfDay(liveClass.startTime);
  const durationMinutes = params.leaveTime
    ? Math.max(0, Math.round((params.leaveTime.getTime() - params.joinTime.getTime()) / 60000))
    : 0;

  let attendance = await Attendance.findOne({
    student: params.studentId,
    batch: params.batchId,
    date,
  });

  if (!attendance) {
    attendance = new Attendance({
      student: params.studentId,
      batch: params.batchId,
      liveClass: liveClass._id,
      date,
      status: "absent",
      source: "zoom",
      zoomMeetingId: params.zoomMeetingId,
      sessions: [],
      totalDurationMinutes: 0,
    });
  }

  // Dedupe: if this exact segment (by zoomParticipantId) is already present,
  // update its leaveTime/duration in place instead of appending a duplicate
  // (covers a `participant_left` webhook arriving after we already saw the
  // `participant_joined` event for the same segment).
  const existingIdx = params.zoomParticipantId
    ? attendance.sessions.findIndex((s) => s.zoomParticipantId === params.zoomParticipantId)
    : -1;

  if (existingIdx >= 0) {
    attendance.sessions[existingIdx].leaveTime = params.leaveTime ?? attendance.sessions[existingIdx].leaveTime;
    attendance.sessions[existingIdx].durationMinutes = params.leaveTime
      ? durationMinutes
      : attendance.sessions[existingIdx].durationMinutes;
  } else {
    attendance.sessions.push({
      joinTime: params.joinTime,
      leaveTime: params.leaveTime ?? undefined,
      durationMinutes,
      zoomParticipantId: params.zoomParticipantId,
    });
  }

  attendance.totalDurationMinutes = attendance.sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  attendance.status = computeAttendanceStatus(attendance.sessions, liveClass);
  attendance.liveClass = liveClass._id;
  attendance.zoomMeetingId = params.zoomMeetingId;
  attendance.source = "zoom";

  await attendance.save();
}

/**
 * Mark every student in the live class's batch who still has no Attendance
 * record for that session's date as "absent" — covers students who never
 * joined the Zoom meeting at all (including the degenerate case where no one
 * joined). Called once the class is finalized (see POST
 * /api/attendance/zoom-sync), after every actual participant segment has
 * already been merged in, so anyone still missing a record genuinely didn't
 * attend. Idempotent: only creates records where none exist yet.
 */
export async function markAbsentees(liveClassId: string): Promise<number> {
  const liveClass = await LiveClass.findById(liveClassId);
  if (!liveClass) return 0;

  const date = startOfDay(liveClass.startTime);
  const students = await Student.find({ batch: liveClass.batch }).select("_id");

  let count = 0;
  for (const student of students) {
    const existing = await Attendance.findOne({ student: student._id, batch: liveClass.batch, date });
    if (existing) continue;

    await Attendance.create({
      student: student._id,
      batch: liveClass.batch,
      liveClass: liveClass._id,
      date,
      status: "absent",
      source: "zoom",
      zoomMeetingId: liveClass.zoomMeetingId,
      sessions: [],
      totalDurationMinutes: 0,
    });
    count += 1;
  }

  return count;
}

/** Resolve a Zoom participant's student by email (case-insensitive). */
export async function findStudentByEmail(email: string | undefined) {
  if (!email) return null;
  const { User } = await import("@/models");
  const user = await User.findOne({ email: email.toLowerCase(), role: "student" });
  if (!user) return null;
  return Student.findOne({ user: user._id });
}
