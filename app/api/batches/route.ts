import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Batch, Student } from "@/models";
import { batchSchema } from "@/lib/validators/academic";
import { requireRole, requireSession, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, getStudentProfileId } from "@/lib/permissions";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireSession();
  await connectDB();

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");

  const filter: Record<string, unknown> = {};
  if (courseId) filter.course = courseId;

  if (session.user.role === "teacher") {
    filter.teacher = await getTeacherProfileId(session);
  } else if (session.user.role === "student") {
    const studentId = await getStudentProfileId(session);
    const student = await Student.findById(studentId);
    filter._id = student?.batch;
  }

  const batches = await Batch.find(filter).populate("course", "courseCode courseName").populate("teacher", "fullName teacherId").sort({ createdAt: -1 });
  return NextResponse.json(batches);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireRole("admin");
  await connectDB();
  const body = await req.json();
  const data = batchSchema.parse(body);
  const batch = await Batch.create(data);
  return NextResponse.json(batch, { status: 201 });
});
