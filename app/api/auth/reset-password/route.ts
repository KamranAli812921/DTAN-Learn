import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User, PasswordResetToken } from "@/models";
import { resetPasswordSchema } from "@/lib/validators/auth";
import { ApiError, errorResponse } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { email, code, newPassword } = resetPasswordSchema.parse(body);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new ApiError(400, "Invalid request.");
    }

    // Only reachable with a token that was verified in the previous step —
    // re-check the code against the same token rather than trusting a flag
    // alone, so this endpoint can't be replayed without the code.
    const token = await PasswordResetToken.findOne({
      user: user._id,
      used: false,
      verified: true,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!token) {
      throw new ApiError(400, "Your code has expired or was not verified. Please start over.");
    }

    const valid = await bcrypt.compare(code, token.codeHash);
    if (!valid) {
      throw new ApiError(400, "Invalid or expired code.");
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    token.used = true;
    await token.save();

    return NextResponse.json({ message: "Password reset successfully." }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
