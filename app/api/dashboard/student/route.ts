import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Student, Attendance, Assignment, Submission, Mark, Announcement } from "@/models";
import { requireRole, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { getStudentProfileId } from "@/lib/permissions";

export const GET = withErrorHandling(async () => {
  const session = await requireRole("student");
  await connectDB();

  const studentId = await getStudentProfileId(session);
  const student = await Student.findById(studentId).populate("course", "courseName courseCode").populate("batch", "batchName");
  if (!student) throw new ApiError(404, "Student profile not found.");

  const [attendanceRecords, assignments, submissions, marks, recentAnnouncements] = await Promise.all([
    Attendance.find({ student: studentId }),
    Assignment.find({ batch: student.batch, status: "published" }),
    Submission.find({ student: studentId }),
    Mark.find({ student: studentId }).populate("assignment", "title totalMarks"),
    Announcement.find({
      status: "published",
      $or: [{ targetType: "all" }, { targetType: "course", course: student.course }, { targetType: "batch", batch: student.batch }],
    })
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  const presentCount = attendanceRecords.filter((a) => a.status === "present").length;
  const attendancePercentage = attendanceRecords.length ? Math.round((presentCount / attendanceRecords.length) * 1000) / 10 : 0;

  const submittedAssignmentIds = new Set(submissions.map((s) => s.assignment.toString()));
  const submittedCount = submissions.length;
  const pendingCount = assignments.filter((a) => !submittedAssignmentIds.has(a._id.toString())).length;

  const avgMarks = marks.length
    ? Math.round((marks.reduce((sum, m) => sum + (m.marksObtained / (m.assignment as any).totalMarks) * 100, 0) / marks.length) * 10) / 10
    : null;

  return NextResponse.json({
    student,
    attendancePercentage,
    totalClasses: attendanceRecords.length,
    totalAssignments: assignments.length,
    submittedCount,
    pendingCount,
    averageMarksPercentage: avgMarks,
    recentAnnouncements,
  });
});
