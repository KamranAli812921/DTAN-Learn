import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User } from "@/models";
import { createAdminSchema } from "@/lib/validators/user";
import { requireRole, ApiError, withErrorHandling } from "@/lib/api-helpers";

export const GET = withErrorHandling(async () => {
  await requireRole("admin");
  await connectDB();
  const admins = await User.find({ role: "admin" }).select("username email status createdAt").sort({ createdAt: -1 });
  return NextResponse.json(admins);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireRole("admin");
  await connectDB();
  const body = await req.json();
  const data = createAdminSchema.parse(body);

  const existing = await User.findOne({ $or: [{ username: data.username.toLowerCase() }, { email: data.email.toLowerCase() }] });
  if (existing) throw new ApiError(409, "Username or email already in use.");

  const passwordHash = await bcrypt.hash(data.password, 10);
  const admin = await User.create({
    username: data.username.toLowerCase(),
    email: data.email.toLowerCase(),
    passwordHash,
    role: "admin",
    status: "active",
  });

  return NextResponse.json(
    { _id: admin._id, username: admin.username, email: admin.email, status: admin.status, createdAt: admin.createdAt },
    { status: 201 }
  );
});
