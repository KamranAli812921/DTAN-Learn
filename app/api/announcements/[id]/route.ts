import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Announcement } from "@/models";
import { requireRole, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/permissions";

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid announcement id.");

  const announcement = await Announcement.findById(params.id);
  if (!announcement) throw new ApiError(404, "Announcement not found.");

  if (session.user.role === "teacher" && announcement.createdBy.toString() !== session.user.id) {
    throw new ApiError(403, "You may only remove your own announcements.");
  }

  announcement.status = "archived";
  await announcement.save();
  return NextResponse.json(announcement);
});
