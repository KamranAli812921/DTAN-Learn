import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { UnmatchedZoomParticipant, LiveClass } from "@/models";
import { requireRole, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, assertTeacherOwnsBatch, isValidObjectId } from "@/lib/permissions";

/**
 * List Zoom participants from a session that couldn't be matched to any
 * student by email, so a teacher/admin can assign them manually (see PATCH
 * /api/attendance/unmatched/[id]). Only pending entries are returned —
 * resolved/ignored ones are done and shouldn't keep showing up.
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();

  const { searchParams } = new URL(req.url);
  const liveClassId = searchParams.get("liveClassId");
  if (!liveClassId || !isValidObjectId(liveClassId)) throw new ApiError(400, "liveClassId is required.");

  const liveClass = await LiveClass.findById(liveClassId).select("batch");
  if (!liveClass) throw new ApiError(404, "Live class not found.");

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, liveClass.batch.toString());
  }

  const entries = await UnmatchedZoomParticipant.find({ liveClass: liveClassId, status: "pending" }).sort({ joinTime: 1 });
  return NextResponse.json(entries);
});
