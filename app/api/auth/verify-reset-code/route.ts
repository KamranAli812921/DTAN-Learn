import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User, PasswordResetToken } from "@/models";
import { verifyResetCodeSchema } from "@/lib/validators/auth";
import { ApiError, errorResponse } from "@/lib/api-helpers";

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { email, code } = verifyResetCodeSchema.parse(body);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Generic message — don't reveal whether the email exists.
      throw new ApiError(400, "Invalid or expired code.");
    }

    const token = await PasswordResetToken.findOne({
      user: user._id,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!token) {
      throw new ApiError(400, "Invalid or expired code. Please request a new one.");
    }

    if (token.attempts >= MAX_ATTEMPTS) {
      token.used = true; // lock this token out
      await token.save();
      throw new ApiError(429, "Too many failed attempts. Please request a new code.");
    }

    const valid = await bcrypt.compare(code, token.codeHash);
    if (!valid) {
      token.attempts += 1;
      if (token.attempts >= MAX_ATTEMPTS) {
        token.used = true;
      }
      await token.save();
      throw new ApiError(400, "Incorrect code.");
    }

    token.verified = true;
    await token.save();

    return NextResponse.json({ message: "Code verified." }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
