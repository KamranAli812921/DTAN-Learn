import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User, PasswordResetToken } from "@/models";
import { forgotPasswordSchema } from "@/lib/validators/auth";
import { errorResponse } from "@/lib/api-helpers";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { sendPasswordResetCodeEmail } from "@/lib/resend";

const GENERIC_MESSAGE = "If an account exists for that email, a reset code has been sent.";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { email } = forgotPasswordSchema.parse(body);

    const ip = clientIp(req);
    const [ipOk, emailOk] = await Promise.all([
      checkRateLimit(`forgot-password:ip:${ip}`, 3, 15 * 60 * 1000),
      checkRateLimit(`forgot-password:email:${email.toLowerCase()}`, 3, 15 * 60 * 1000),
    ]);

    if (!ipOk || !emailOk) {
      // Still return the generic message to avoid leaking rate-limit state,
      // but don't actually send another code.
      return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (user && user.status === "active") {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = await bcrypt.hash(code, 10);

      await PasswordResetToken.create({
        user: user._id,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        used: false,
        verified: false,
        attempts: 0,
      });

      try {
        await sendPasswordResetCodeEmail(user.email, code);
      } catch (emailErr) {
        // eslint-disable-next-line no-console
        console.error("Failed to send password reset email:", emailErr);
      }
    }

    // Always the same response, whether or not the email exists.
    return NextResponse.json({ message: GENERIC_MESSAGE }, { status: 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
