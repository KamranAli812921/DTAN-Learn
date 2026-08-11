import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Mark, Submission, Assignment } from "@/models";
import { markSchema } from "@/lib/validators/coursework";
import { requireRole, requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, getTeacherBatchIds, getStudentProfileId, assertTeacherOwnsBatch, isValidObjectId } from "@/lib/permissions";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireSession();
  await connectDB();

  const { searchParams } = new URL(req.url);
  const assignmentId = searchParams.get("assignmentId");
  const studentId = searchParams.get("studentId");

  const filter: Record<string, unknown> = {};
  if (assignmentId) filter.assignment = assignmentId;

  if (session.user.role === "student") {
    filter.student = await getStudentProfileId(session);
  } else if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    const batchIds = await getTeacherBatchIds(teacherId);
    const assignments = await Assignment.find({ batch: { $in: batchIds } }).select("_id");
    filter.assignment = assignmentId ? assignmentId : { $in: assignments.map((a) => a._id) };
    if (studentId) filter.student = studentId;
  } else if (studentId) {
    filter.student = studentId;
  }

  const marks = await Mark.find(filter)
    .populate("student", "fullName studentId")
    .populate("assignment", "title totalMarks dueDate")
    .populate("gradedBy", "username")
    .sort({ gradedAt: -1 });

  return NextResponse.json(marks);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();

  const body = await req.json();
  const submissionId = body.submissionId as string;
  if (!isValidObjectId(submissionId)) throw new ApiError(400, "Invalid submission id.");
  const data = markSchema.parse(body);

  const submission = await Submission.findById(submissionId);
  if (!submission) throw new ApiError(404, "Submission not found.");

  const assignment = await Assignment.findById(submission.assignment);
  if (!assignment) throw new ApiError(404, "Assignment not found.");

  if (data.marksObtained > assignment.totalMarks) {
    throw new ApiError(400, `Marks obtained cannot exceed the total (${assignment.totalMarks}).`);
  }

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, assignment.batch.toString());
  }

  const mark = await Mark.findOneAndUpdate(
    { submission: submissionId },
    {
      submission: submissionId,
      student: submission.student,
      assignment: assignment._id,
      marksObtained: data.marksObtained,
      feedback: data.feedback,
      gradedBy: session.user.id,
      gradedAt: new Date(),
    },
    { upsert: true, new: true, runValidators: true }
  );

  submission.status = "reviewed";
  await submission.save();

  return NextResponse.json(mark, { status: 201 });
});
