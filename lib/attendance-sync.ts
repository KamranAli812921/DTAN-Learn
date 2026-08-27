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
 * Minutes of overlap between a join/leave segment and the class's own time
 * window [startTime, startTime + durationMinutes]. Time spent connected
 * before the class starts or after it ends doesn't count towards attendance,
 * and this also guarantees a single segment can never exceed the class
 * length. An open segment (no leaveTime yet) counts as 0 — its duration is
 * only known once the matching `participant_left` / polling report lands.
 */
export function classWindowMinutes(
  joinTime: Date,
  leaveTime: Date | null | undefined,
  liveClass: { startTime: Date; durationMinutes: number }
): number {
  if (!leaveTime) return 0;
  const classStart = liveClass.startTime.getTime();
  const classEnd = classStart + liveClass.durationMinutes * 60_000;
  const start = Math.max(joinTime.getTime(), classStart);
  const end = Math.min(leaveTime.getTime(), classEnd);
  return Math.max(0, Math.round((end - start) / 60_000));
}

/**
 * Total minutes of the class a student attended: the sum of every segment's
 * overlap with the class window, capped at the class length (overlapping
 * Zoom segments can otherwise push the sum slightly over).
 */
export function totalClassMinutes(
  sessions: IAttendanceSession[],
  liveClass: { startTime: Date; durationMinutes: number }
): number {
  const sum = sessions.reduce((acc, s) => acc + classWindowMinutes(s.joinTime, s.leaveTime, liveClass), 0);
  return Math.min(sum, liveClass.durationMinutes);
}

/**
 * Recompute status from sessions + the live class definition. Only two
 * statuses exist:
 *  - absent  : no sessions logged, or class time attended falls short of
 *              70% of the class duration
 *  - present : class time attended >= 70% of class duration
 * "Late" is not a status — see isLateArrival below, which surfaces it as a
 * note alongside whichever status this returns.
 */
export function computeAttendanceStatus(
  sessions: IAttendanceSession[],
  liveClass: { startTime: Date; durationMinutes: number }
): AttendanceStatus {
  if (!sessions.length) return "absent";

  const attended = totalClassMinutes(sessions, liveClass);
  const threshold = 0.7 * liveClass.durationMinutes;

  return attended >= threshold ? "present" : "absent";
}

/**
 * True when the student's first (earliest) session started after the
 * allowed joining window (startTime + joinWindowMinutes) — surfaced in the
 * UI as a small "Late" note, independent of the present/absent status
 * computed above.
 */
export function isLateArrival(
  sessions: IAttendanceSession[],
  liveClass: { startTime: Date; joinWindowMinutes: number }
): boolean {
  if (!sessions.length) return false;

  const firstJoin = sessions.reduce((earliest, s) => (s.joinTime < earliest ? s.joinTime : earliest), sessions[0].joinTime);
  const windowEnd = new Date(liveClass.startTime.getTime() + liveClass.joinWindowMinutes * 60_000);

  return firstJoin.getTime() > windowEnd.getTime();
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
  // Only the portion of this segment that falls inside the class window counts.
  const durationMinutes = params.leaveTime
    ? classWindowMinutes(params.joinTime, params.leaveTime, liveClass)
    : 0;

  // Keyed by the live class, not the calendar day: a batch can hold more than
  // one class per day and each gets its own record.
  let attendance = await Attendance.findOne({
    student: params.studentId,
    liveClass: liveClass._id,
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

  attendance.totalDurationMinutes = totalClassMinutes(attendance.sessions, liveClass);
  attendance.status = computeAttendanceStatus(attendance.sessions, liveClass);
  attendance.isLate = isLateArrival(attendance.sessions, liveClass);
  attendance.liveClass = liveClass._id;
  attendance.zoomMeetingId = params.zoomMeetingId;
  attendance.source = "zoom";

  await attendance.save();
}

/**
 * Mark every student in the live class's batch who still has no Attendance
 * record for this live class as "absent" — covers students who never
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
    const existing = await Attendance.findOne({ student: student._id, liveClass: liveClass._id });
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

/**
 * Resolve a Zoom participant's student by email (case-insensitive). Checks
 * Student.zoomEmail first — set when a teacher/admin manually resolves a
 * previously-unmatched participant (see recordUnmatchedParticipant below) —
 * before falling back to the account's login email.
 */
export async function findStudentByEmail(email: string | undefined) {
  if (!email) return null;
  const lower = email.toLowerCase();

  const byZoomEmail = await Student.findOne({ zoomEmail: lower });
  if (byZoomEmail) return byZoomEmail;

  const { User } = await import("@/models");
  const user = await User.findOne({ email: lower, role: "student" });
  if (!user) return null;
  return Student.findOne({ user: user._id });
}

/**
 * Record (or update) a Zoom participant segment that couldn't be matched to
 * any student by email, so it shows up in the "Unmatched participants"
 * review table instead of silently never being recorded. Dedupes by
 * zoomParticipantId the same way mergeAttendanceSegment does, so the webhook
 * firing twice or the polling fallback re-reporting the same segment updates
 * the existing pending entry rather than creating a duplicate. Once an entry
 * has been resolved or ignored by a teacher/admin, later events for that
 * same segment are left alone.
 */
export async function recordUnmatchedParticipant(params: {
  liveClassId: string;
  batchId: string;
  zoomMeetingId: string;
  zoomEmail?: string;
  zoomName?: string;
  joinTime: Date;
  leaveTime: Date | null;
  zoomParticipantId?: string;
}): Promise<void> {
  const { UnmatchedZoomParticipant } = await import("@/models");

  const existing = params.zoomParticipantId
    ? await UnmatchedZoomParticipant.findOne({
        liveClass: params.liveClassId,
        zoomParticipantId: params.zoomParticipantId,
      })
    : null;

  if (existing) {
    if (existing.status !== "pending") return;
    if (params.leaveTime) existing.leaveTime = params.leaveTime;
    await existing.save();
    return;
  }

  await UnmatchedZoomParticipant.create({
    liveClass: params.liveClassId,
    batch: params.batchId,
    zoomMeetingId: params.zoomMeetingId,
    zoomParticipantId: params.zoomParticipantId,
    zoomEmail: params.zoomEmail,
    zoomName: params.zoomName,
    joinTime: params.joinTime,
    leaveTime: params.leaveTime ?? undefined,
  });
}
