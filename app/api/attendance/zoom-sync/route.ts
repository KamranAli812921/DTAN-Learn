import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { LiveClass } from "@/models";
import { requireRole, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId } from "@/lib/permissions";
import { getMeetingParticipants } from "@/lib/zoom";
import { mergeAttendanceSegment, findStudentByEmail, markAbsentees, recordUnmatchedParticipant } from "@/lib/attendance-sync";

/**
 * Polling fallback (spec 6.3): after a class ends, backfill anything the
 * webhook missed by pulling Zoom's full participants report. Safe to call
 * repeatedly — mergeAttendanceSegment dedupes by zoomParticipantId.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();

  const body = await req.json();
  const liveClassId = body.liveClassId as string;
  if (!liveClassId) throw new ApiError(400, "liveClassId is required.");

  const liveClass = await LiveClass.findById(liveClassId);
  if (!liveClass) throw new ApiError(404, "Live class not found.");

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    if (liveClass.teacher.toString() !== teacherId) throw new ApiError(403, "You are not assigned to this class.");
  }

  const participants = await getMeetingParticipants(liveClass.zoomMeetingId);

  let matched = 0;
  let unmatched = 0;

  for (const p of participants) {
    const student = await findStudentByEmail(p.user_email);
    if (!student) {
      await recordUnmatchedParticipant({
        liveClassId: liveClass._id.toString(),
        batchId: liveClass.batch.toString(),
        zoomMeetingId: liveClass.zoomMeetingId,
        zoomEmail: p.user_email,
        zoomName: p.name,
        joinTime: new Date(p.join_time),
        leaveTime: new Date(p.leave_time),
        zoomParticipantId: p.id,
      });
      unmatched += 1;
      continue;
    }
    await mergeAttendanceSegment({
      liveClassId: liveClass._id.toString(),
      studentId: student._id.toString(),
      batchId: liveClass.batch.toString(),
      joinTime: new Date(p.join_time),
      leaveTime: new Date(p.leave_time),
      zoomParticipantId: p.id,
      zoomMeetingId: liveClass.zoomMeetingId,
    });
    matched += 1;
  }

  liveClass.status = "completed";
  await liveClass.save();

  // Anyone still without a record at this point never joined at all —
  // including the degenerate case where no one joined the meeting.
  const absentMarked = await markAbsentees(liveClass._id.toString());

  return NextResponse.json({ matched, unmatched, totalSegments: participants.length, absentMarked });
});
