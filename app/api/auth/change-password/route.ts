import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User } from "@/models";
import { changePasswordSchema } from "@/lib/validators/auth";
import { requireSession, ApiError, errorResponse, withErrorHandling } from "@/lib/api-helpers";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireSession();
  await connectDB();

  const body = await req.json();
  const { currentPassword, newPassword } = changePasswordSchema.parse(body);

  const user = await User.findById(session.user.id).select("+passwordHash");
  if (!user) throw new ApiError(404, "User not found.");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new ApiError(400, "Current password is incorrect.");

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  return NextResponse.json({ message: "Password updated." });
});
