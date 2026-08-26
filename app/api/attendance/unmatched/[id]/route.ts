import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { UnmatchedZoomParticipant, Student } from "@/models";
import { resolveUnmatchedParticipantSchema } from "@/lib/validators/attendance";
import { requireRole, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, assertTeacherOwnsBatch, isValidObjectId } from "@/lib/permissions";
import { mergeAttendanceSegment } from "@/lib/attendance-sync";

/**
 * Resolve an unmatched Zoom participant: either assign it to a student
 * (merging the stored join/leave segment into that student's Attendance the
 * same way an auto-matched participant would have) or ignore it (e.g. a
 * guest/observer who was never going to be a student). Optionally remembers
 * the Zoom email on the student so future syncs match automatically without
 * needing this manual step again.
 */
export const PATCH = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid id.");

  const entry = await UnmatchedZoomParticipant.findById(params.id);
  if (!entry) throw new ApiError(404, "Unmatched participant entry not found.");
  if (entry.status !== "pending") throw new ApiError(409, "This entry has already been resolved.");

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, entry.batch.toString());
  }

  const body = await req.json();
  const data = resolveUnmatchedParticipantSchema.parse(body);

  if (data.action === "ignore") {
    entry.status = "ignored";
    entry.resolvedBy = session.user.id as unknown as typeof entry.resolvedBy;
    entry.resolvedAt = new Date();
    await entry.save();
    return NextResponse.json(entry);
  }

  const student = await Student.findOne({ _id: data.student, batch: entry.batch });
  if (!student) throw new ApiError(400, "Student not found in this batch.");

  await mergeAttendanceSegment({
    liveClassId: entry.liveClass.toString(),
    studentId: student._id.toString(),
    batchId: entry.batch.toString(),
    joinTime: entry.joinTime,
    leaveTime: entry.leaveTime ?? null,
    zoomParticipantId: entry.zoomParticipantId,
    zoomMeetingId: entry.zoomMeetingId,
  });

  if (data.rememberEmail && entry.zoomEmail) {
    student.zoomEmail = entry.zoomEmail;
    await student.save();
  }

  entry.status = "resolved";
  entry.resolvedStudent = student._id;
  entry.resolvedBy = session.user.id as unknown as typeof entry.resolvedBy;
  entry.resolvedAt = new Date();
  await entry.save();

  return NextResponse.json(entry);
});
