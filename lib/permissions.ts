import type { Session } from "next-auth";
import { Types } from "mongoose";
import { ApiError } from "@/lib/api-helpers";
import { Batch, Student, Teacher } from "@/models";

/**
 * Ownership-check helpers. Every API route that touches a teacher- or
 * student-scoped resource must call one of these server-side — role alone
 * (from the session) is never sufficient, the record's batch/student must
 * also be verified to belong to the caller.
 */

export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

/** Resolve the Teacher profile document id for a teacher-role session. */
export async function getTeacherProfileId(session: Session): Promise<string> {
  if (session.user.role !== "teacher") {
    throw new ApiError(403, "Not a teacher account.");
  }
  if (session.user.profileId) return session.user.profileId;
  const teacher = await Teacher.findOne({ user: session.user.id });
  if (!teacher) throw new ApiError(403, "Teacher profile not found.");
  return teacher._id.toString();
}

/** Resolve the Student profile document id for a student-role session. */
export async function getStudentProfileId(session: Session): Promise<string> {
  if (session.user.role !== "student") {
    throw new ApiError(403, "Not a student account.");
  }
  if (session.user.profileId) return session.user.profileId;
  const student = await Student.findOne({ user: session.user.id });
  if (!student) throw new ApiError(403, "Student profile not found.");
  return student._id.toString();
}

/**
 * Assert that a batch belongs to the given teacher. Throws 403 if not found
 * or owned by someone else. Admins bypass this check entirely (call site
 * should branch on role before calling).
 */
export async function assertTeacherOwnsBatch(teacherProfileId: string, batchId: string): Promise<void> {
  if (!isValidObjectId(batchId)) throw new ApiError(400, "Invalid batch id.");
  const batch = await Batch.findOne({ _id: batchId, teacher: teacherProfileId });
  if (!batch) {
    throw new ApiError(403, "You are not assigned to this batch.");
  }
}

/** Return the list of batch ids a teacher is assigned to. */
export async function getTeacherBatchIds(teacherProfileId: string): Promise<string[]> {
  const batches = await Batch.find({ teacher: teacherProfileId }).select("_id");
  return batches.map((b) => b._id.toString());
}

/** Assert a student record belongs to this student session (self-access only). */
export async function assertOwnStudentRecord(session: Session, studentId: string): Promise<void> {
  const ownId = await getStudentProfileId(session);
  if (ownId !== studentId) {
    throw new ApiError(403, "You may only access your own records.");
  }
}
