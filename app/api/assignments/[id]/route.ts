import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Assignment, Student } from "@/models";
import { assignmentSchema } from "@/lib/validators/coursework";
import { requireRole, requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId, getTeacherProfileId, assertTeacherOwnsBatch, getStudentProfileId } from "@/lib/permissions";

export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireSession();
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid assignment id.");

  const assignment = await Assignment.findById(params.id).populate("course", "courseCode courseName").populate("batch", "batchName");
  if (!assignment) throw new ApiError(404, "Assignment not found.");

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, assignment.batch._id.toString());
  } else if (session.user.role === "student") {
    const studentId = await getStudentProfileId(session);
    const student = await Student.findById(studentId);
    if (student?.batch?.toString() !== assignment.batch._id.toString()) throw new ApiError(403, "Not your batch.");
    if (assignment.status !== "published") throw new ApiError(404, "Assignment not found.");
  }

  return NextResponse.json(assignment);
});

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid assignment id.");

  const assignment = await Assignment.findById(params.id);
  if (!assignment) throw new ApiError(404, "Assignment not found.");

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, assignment.batch.toString());
  }

  const body = await req.json();
  const data = assignmentSchema.partial().parse(body);
  Object.assign(assignment, data);
  await assignment.save();

  return NextResponse.json(assignment);
});

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid assignment id.");

  const assignment = await Assignment.findById(params.id);
  if (!assignment) throw new ApiError(404, "Assignment not found.");

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, assignment.batch.toString());
  }

  await assignment.deleteOne();
  return NextResponse.json({ message: "Assignment deleted." });
});
