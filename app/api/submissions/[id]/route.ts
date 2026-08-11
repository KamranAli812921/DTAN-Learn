import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Submission } from "@/models";
import { requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { isValidObjectId, getTeacherProfileId, assertTeacherOwnsBatch, getStudentProfileId } from "@/lib/permissions";

export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const session = await requireSession();
  await connectDB();
  if (!isValidObjectId(params.id)) throw new ApiError(400, "Invalid submission id.");

  const submission = await Submission.findById(params.id)
    .populate("student", "fullName studentId")
    .populate({ path: "assignment", select: "title dueDate totalMarks batch course", populate: { path: "batch", select: "batchName" } });
  if (!submission) throw new ApiError(404, "Submission not found.");

  const assignment = submission.assignment as unknown as { batch: { _id: { toString(): string } } | { toString(): string } };
  const batchId = (assignment.batch as any)._id ? (assignment.batch as any)._id.toString() : (assignment.batch as any).toString();

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, batchId);
  } else if (session.user.role === "student") {
    const studentId = await getStudentProfileId(session);
    if (submission.student._id.toString() !== studentId) throw new ApiError(403, "You may only view your own submissions.");
  }

  return NextResponse.json(submission);
});
