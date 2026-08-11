import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/db";
import { User, Student } from "@/models";
import { createStudentSchema } from "@/lib/validators/user";
import { requireRole, requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, getTeacherBatchIds, getStudentProfileId, assertTeacherOwnsBatch } from "@/lib/permissions";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireSession();
  await connectDB();

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const courseId = searchParams.get("courseId");

  const filter: Record<string, unknown> = {};
  if (courseId) filter.course = courseId;
  if (batchId) filter.batch = batchId;

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    const batchIds = await getTeacherBatchIds(teacherId);
    if (batchId && !batchIds.includes(batchId)) throw new ApiError(403, "You are not assigned to this batch.");
    filter.batch = batchId ? batchId : { $in: batchIds };
  } else if (session.user.role === "student") {
    const studentId = await getStudentProfileId(session);
    filter._id = studentId;
  }

  const students = await Student.find(filter)
    .populate("user", "username email status")
    .populate("course", "courseCode courseName description duration")
    .populate("batch", "batchName")
    .sort({ createdAt: -1 });

  return NextResponse.json(students);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  const body = await req.json();
  const data = createStudentSchema.parse(body);

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, data.batch);
  }

  const existingUser = await User.findOne({ $or: [{ username: data.username.toLowerCase() }, { email: data.email.toLowerCase() }] });
  if (existingUser) throw new ApiError(409, "Username or email already in use.");

  const existingStudentId = await Student.findOne({ studentId: data.studentId });
  if (existingStudentId) throw new ApiError(409, "Student ID already in use.");

  // Not wrapped in a Mongo transaction: multi-document transactions require
  // a replica set, which MongoDB Atlas always provides but a plain local
  // `mongod` does not — using one here would break local/standalone dev
  // setups. Instead, roll back the User manually if the Student insert fails.
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await User.create({
    username: data.username.toLowerCase(),
    email: data.email.toLowerCase(),
    passwordHash,
    role: "student",
    status: "active",
  });

  try {
    const student = await Student.create({
      user: user._id,
      studentId: data.studentId,
      fullName: data.fullName,
      phone: data.phone,
      course: data.course,
      batch: data.batch,
      enrollmentDate: data.enrollmentDate ?? new Date(),
    });
    return NextResponse.json(student, { status: 201 });
  } catch (err) {
    await User.findByIdAndDelete(user._id);
    throw err;
  }
});
