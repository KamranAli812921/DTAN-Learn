import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { LiveClass, Announcement } from "@/models";
import { liveClassSchema } from "@/lib/validators/attendance";
import { requireRole, requireSession, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, getTeacherBatchIds, assertTeacherOwnsBatch, getStudentProfileId } from "@/lib/permissions";
import { createZoomMeeting } from "@/lib/zoom";
import { Student } from "@/models";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireSession();
  await connectDB();

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");

  const filter: Record<string, unknown> = {};
  if (batchId) filter.batch = batchId;

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    const batchIds = await getTeacherBatchIds(teacherId);
    filter.batch = batchId ? batchId : { $in: batchIds };
  } else if (session.user.role === "student") {
    const studentId = await getStudentProfileId(session);
    const student = await Student.findById(studentId);
    filter.batch = student?.batch;
  }

  const liveClasses = await LiveClass.find(filter).populate("batch", "batchName").populate("course", "courseName").sort({ startTime: -1 });
  return NextResponse.json(liveClasses);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  const body = await req.json();
  const data = liveClassSchema.parse(body);

  let teacherId: string;
  if (session.user.role === "teacher") {
    teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, data.batch);
  } else {
    // Admin scheduling on behalf of the batch's assigned teacher.
    const { Batch } = await import("@/models");
    const batch = await Batch.findById(data.batch);
    if (!batch) throw new (await import("@/lib/api-helpers")).ApiError(404, "Batch not found.");
    teacherId = batch.teacher.toString();
  }

  const meeting = await createZoomMeeting({
    topic: data.topic,
    startTime: data.startTime,
    durationMinutes: data.durationMinutes,
  });

  const liveClass = await LiveClass.create({
    course: data.course,
    batch: data.batch,
    teacher: teacherId,
    topic: data.topic,
    zoomMeetingId: meeting.id,
    zoomJoinUrl: meeting.join_url,
    startTime: data.startTime,
    durationMinutes: data.durationMinutes,
    joinWindowMinutes: data.joinWindowMinutes ?? 10,
    createdBy: session.user.id,
  });

  // Best-effort: notify the batch. A failure here shouldn't fail the
  // (already-created) live class — students can still see it via the
  // dashboard's "Join a live class" widget even without the announcement.
  try {
    // Format in the scheduling teacher's browser timezone (if provided) so the
    // announcement text matches what they picked, rather than the server's
    // own timezone (which can differ and silently shift the displayed time).
    let when: string;
    try {
      when = data.startTime.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: data.timeZone,
      });
    } catch {
      when = data.startTime.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    }
    await Announcement.create({
      createdBy: session.user.id,
      title: `Live class scheduled: ${data.topic}`,
      message: `A live class "${data.topic}" has been scheduled for ${when} (${data.durationMinutes} minutes).\n\nJoin link: ${meeting.join_url}\n\nYou can also join directly from your dashboard once the class is live.`,
      targetType: "batch",
      course: data.course,
      batch: data.batch,
      status: "published",
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to auto-create live class announcement:", err);
  }

  return NextResponse.json(liveClass, { status: 201 });
});
