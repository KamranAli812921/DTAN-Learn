import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Student, Teacher, Course, Batch, Assignment, Submission, Announcement, Attendance } from "@/models";
import { requireRole, withErrorHandling } from "@/lib/api-helpers";

export const GET = withErrorHandling(async () => {
  await requireRole("admin");
  await connectDB();

  const [
    totalStudents,
    totalTeachers,
    activeCourses,
    activeBatches,
    totalAssignments,
    pendingSubmissions,
    studentsByCourse,
    recentAnnouncements,
    attendanceOverview,
  ] = await Promise.all([
    Student.countDocuments(),
    Teacher.countDocuments(),
    Course.countDocuments({ status: "active" }),
    Batch.countDocuments({ status: "active" }),
    Assignment.countDocuments(),
    Submission.countDocuments({ status: { $in: ["submitted", "late"] } }),
    Student.aggregate([
      { $group: { _id: "$course", count: { $sum: 1 } } },
      { $lookup: { from: "courses", localField: "_id", foreignField: "_id", as: "course" } },
      { $unwind: "$course" },
      { $project: { _id: 0, name: "$course.courseName", count: 1 } },
    ]),
    Announcement.find({ status: "published" }).sort({ createdAt: -1 }).limit(5).populate("createdBy", "username"),
    Attendance.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $project: { _id: 0, status: "$_id", count: 1 } },
    ]),
  ]);

  return NextResponse.json({
    totalStudents,
    totalTeachers,
    activeCourses,
    activeBatches,
    totalAssignments,
    pendingSubmissions,
    studentsByCourse,
    recentAnnouncements,
    attendanceOverview,
  });
});
