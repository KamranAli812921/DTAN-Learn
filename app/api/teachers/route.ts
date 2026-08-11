import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User, Teacher } from "@/models";
import { createTeacherSchema } from "@/lib/validators/user";
import { requireRole, ApiError, withErrorHandling } from "@/lib/api-helpers";

export const GET = withErrorHandling(async () => {
  await requireRole("admin");
  await connectDB();
  const teachers = await Teacher.find().populate("user", "username email status").sort({ createdAt: -1 });
  return NextResponse.json(teachers);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireRole("admin");
  await connectDB();
  const body = await req.json();
  const data = createTeacherSchema.parse(body);

  const existing = await User.findOne({ $or: [{ username: data.username.toLowerCase() }, { email: data.email.toLowerCase() }] });
  if (existing) throw new ApiError(409, "Username or email already in use.");

  const existingTeacherId = await Teacher.findOne({ teacherId: data.teacherId });
  if (existingTeacherId) throw new ApiError(409, "Teacher ID already in use.");

  // Not wrapped in a Mongo transaction: multi-document transactions require
  // a replica set, which MongoDB Atlas always provides but a plain local
  // `mongod` does not — using one here would break local/standalone dev
  // setups. Instead, roll back the User manually if the Teacher insert fails.
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await User.create({
    username: data.username.toLowerCase(),
    email: data.email.toLowerCase(),
    passwordHash,
    role: "teacher",
    status: "active",
  });

  try {
    const teacher = await Teacher.create({ user: user._id, teacherId: data.teacherId, fullName: data.fullName, phone: data.phone });
    return NextResponse.json(teacher, { status: 201 });
  } catch (err) {
    await User.findByIdAndDelete(user._id);
    throw err;
  }
});
