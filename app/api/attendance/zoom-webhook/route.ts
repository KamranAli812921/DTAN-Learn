import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import { LiveClass } from "@/models";
import { verifyZoomSignature } from "@/lib/zoom";
import { mergeAttendanceSegment, findStudentByEmail } from "@/lib/attendance-sync";

/**
 * Zoom webhook receiver for meeting.participant_joined / participant_left.
 * Verifies x-zm-signature before trusting any payload (spec 6.3). Also
 * handles Zoom's one-time endpoint.url_validation handshake, which is
 * required before Zoom will start delivering real events.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-zm-request-timestamp") || "";
  const signature = req.headers.get("x-zm-signature") || "";

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  // URL validation handshake (no signature to verify on this event type).
  if (payload.event === "endpoint.url_validation") {
    const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || "";
    const plainToken = payload.payload?.plainToken;
    const encryptedToken = crypto.createHmac("sha256", secret).update(plainToken).digest("hex");
    return NextResponse.json({ plainToken, encryptedToken });
  }

  if (!verifyZoomSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  await connectDB();

  const eventType = payload.event as string;
  const meetingId = String(payload.payload?.object?.id ?? "");
  const participant = payload.payload?.object?.participant;

  if (!meetingId || !participant) {
    return NextResponse.json({ received: true });
  }

  const liveClass = await LiveClass.findOne({ zoomMeetingId: meetingId });
  if (!liveClass) {
    // Meeting isn't tracked in our system — acknowledge and ignore.
    return NextResponse.json({ received: true });
  }

  const student = await findStudentByEmail(participant.email || participant.user_email);
  if (!student) {
    return NextResponse.json({ received: true, note: "No matching student for participant email." });
  }

  if (eventType === "meeting.participant_joined") {
    await mergeAttendanceSegment({
      liveClassId: liveClass._id.toString(),
      studentId: student._id.toString(),
      batchId: liveClass.batch.toString(),
      joinTime: new Date(participant.join_time),
      leaveTime: null,
      zoomParticipantId: participant.id,
      zoomMeetingId: meetingId,
    });
  } else if (eventType === "meeting.participant_left") {
    await mergeAttendanceSegment({
      liveClassId: liveClass._id.toString(),
      studentId: student._id.toString(),
      batchId: liveClass.batch.toString(),
      joinTime: new Date(participant.join_time),
      leaveTime: new Date(participant.leave_time),
      zoomParticipantId: participant.id,
      zoomMeetingId: meetingId,
    });
  }

  return NextResponse.json({ received: true });
}
