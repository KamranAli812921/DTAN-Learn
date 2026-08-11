import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Teacher, User } from "@/models";
import { updateTeacherSchema } from "@/lib/validators/user";
import { requireRole, requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId } from "@/lib/permissions";

export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireSession();
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid teacher id.");

  const teacher = await Teacher.findById(params.id).populate("user", "username email status");
  if (!teacher) throw new ApiError(404, "Teacher not found.");

  if (session.user.role === "teacher" && teacher.user._id.toString() !== session.user.id) {
    throw new ApiError(403, "You may only view your own profile.");
  }
  if (session.user.role === "student") {
    // students may view basic teacher info (name) for their batch's teacher — allowed read-only.
  }

  return NextResponse.json(teacher);
});

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireSession();
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid teacher id.");

  const teacher = await Teacher.findById(params.id);
  if (!teacher) throw new ApiError(404, "Teacher not found.");

  const isSelf = session.user.role === "teacher" && teacher.user.toString() === session.user.id;
  if (session.user.role !== "admin" && !isSelf) {
    throw new ApiError(403, "You do not have permission to edit this teacher.");
  }

  const body = await req.json();
  const data = updateTeacherSchema.parse(body);

  if (data.status && session.user.role !== "admin") {
    throw new ApiError(403, "Only an admin may change account status.");
  }

  if (data.fullName !== undefined) teacher.fullName = data.fullName;
  if (data.phone !== undefined) teacher.phone = data.phone;
  await teacher.save();

  if (data.status) {
    await User.findByIdAndUpdate(teacher.user, { status: data.status });
  }

  return NextResponse.json(teacher);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  await requireRole("admin");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid teacher id.");

  const teacher = await Teacher.findById(params.id);
  if (!teacher) throw new ApiError(404, "Teacher not found.");

  // Soft-delete: deactivate the linked User account rather than hard-deleting.
  await User.findByIdAndUpdate(teacher.user, { status: "inactive" });
  return NextResponse.json({ message: "Teacher account deactivated." });
});
