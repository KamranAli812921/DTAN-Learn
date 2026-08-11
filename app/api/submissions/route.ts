import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Submission, Assignment, Student } from "@/models";
import { submissionSchema } from "@/lib/validators/coursework";
import { requireRole, requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, getTeacherBatchIds, getStudentProfileId, isValidObjectId } from "@/lib/permissions";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await requireSession();
  await connectDB();

  const { searchParams } = new URL(req.url);
  const assignmentId = searchParams.get("assignmentId");

  const filter: Record<string, unknown> = {};
  if (assignmentId) filter.assignment = assignmentId;

  if (session.user.role === "student") {
    filter.student = await getStudentProfileId(session);
  } else if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    const batchIds = await getTeacherBatchIds(teacherId);
    const assignments = await Assignment.find({ batch: { $in: batchIds } }).select("_id");
    const assignmentIds = assignments.map((a) => a._id);
    filter.assignment = assignmentId ? assignmentId : { $in: assignmentIds };
  }

  const submissions = await Submission.find(filter)
    .populate("assignment", "title dueDate totalMarks batch course")
    .populate("student", "fullName studentId")
    .sort({ submittedAt: -1 });

  return NextResponse.json(submissions);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireRole("student");
  await connectDB();

  const body = await req.json();
  const assignmentId = body.assignmentId as string;
  if (!isValidObjectId(assignmentId)) throw new ApiError(400, "Invalid assignment id.");
  const data = submissionSchema.parse(body);

  const assignment = await Assignment.findById(assignmentId);
  if (!assignment || assignment.status !== "published") throw new ApiError(404, "Assignment not found.");

  const studentId = await getStudentProfileId(session);
  const student = await Student.findById(studentId);
  if (student?.batch.toString() !== assignment.batch.toString()) {
    throw new ApiError(403, "You may only submit assignments for your own batch.");
  }

  if (assignment.submissionType === "file" && !data.fileUrl) throw new ApiError(400, "A file upload is required.");
  if (assignment.submissionType === "github" && !data.githubUrl) throw new ApiError(400, "A GitHub URL is required.");

  const now = new Date();
  const status = now > assignment.dueDate ? "late" : "submitted";

  const existing = await Submission.findOne({ assignment: assignmentId, student: studentId });
  if (existing && existing.status === "reviewed") {
    throw new ApiError(409, "This submission has already been graded and can no longer be edited.");
  }

  const submission = await Submission.findOneAndUpdate(
    { assignment: assignmentId, student: studentId },
    {
      assignment: assignmentId,
      student: studentId,
      fileUrl: data.fileUrl || undefined,
      githubUrl: data.githubUrl || undefined,
      comments: data.comments,
      submittedAt: now,
      status,
    },
    { upsert: true, new: true, runValidators: true }
  );

  return NextResponse.json(submission, { status: 201 });
});
