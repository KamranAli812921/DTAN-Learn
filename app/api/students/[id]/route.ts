import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Student, User } from "@/models";
import { updateStudentSchema } from "@/lib/validators/user";
import { requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId, getTeacherProfileId, assertTeacherOwnsBatch, assertOwnStudentRecord } from "@/lib/permissions";

async function loadAndAuthorize(session: Awaited<ReturnType<typeof requireSession>>, id: string, forWrite: boolean) {
  if (!isValidObjectId(id)) throw new ApiError(400, "Invalid student id.");
  const student = await Student.findById(id);
  if (!student) throw new ApiError(404, "Student not found.");

  if (session.user.role === "admin") return student;

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, student.batch.toString());
    return student;
  }

  if (session.user.role === "student") {
    await assertOwnStudentRecord(session, id);
    if (forWrite) throw new ApiError(403, "Students cannot edit their own record.");
    return student;
  }

  throw new ApiError(403, "Not authorized.");
}

export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireSession();
  await connectDB();
  const student = await loadAndAuthorize(session, params.id, false);
  await student.populate([
    { path: "user", select: "username email status" },
    { path: "course", select: "courseCode courseName description duration" },
    { path: "batch", select: "batchName" },
  ]);
  return NextResponse.json(student);
});

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireSession();
  await connectDB();
  const student = await loadAndAuthorize(session, params.id, true);

  const body = await req.json();
  const data = updateStudentSchema.parse(body);

  if (data.status && session.user.role !== "admin") {
    throw new ApiError(403, "Only an admin may change account status.");
  }

  if (data.batch && session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, data.batch);
  }

  if (data.fullName !== undefined) student.fullName = data.fullName;
  if (data.phone !== undefined) student.phone = data.phone;
  if (data.course !== undefined) student.course = data.course as unknown as typeof student.course;
  if (data.batch !== undefined) student.batch = data.batch as unknown as typeof student.batch;
  await student.save();

  if (data.status) {
    await User.findByIdAndUpdate(student.user, { status: data.status });
  }

  return NextResponse.json(student);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireSession();
  await connectDB();
  const student = await loadAndAuthorize(session, params.id, true);

  if (session.user.role !== "admin") {
    throw new ApiError(403, "Only an admin may deactivate student accounts.");
  }

  // Soft-delete per spec 8.
  await User.findByIdAndUpdate(student.user, { status: "inactive" });
  return NextResponse.json({ message: "Student account deactivated." });
});
