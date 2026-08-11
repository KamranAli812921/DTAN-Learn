import { NextResponse } from "next/server";
import { Types } from "mongoose";
import connectDB from "@/lib/db";
import { Batch, Student, Assignment, Submission, Announcement } from "@/models";
import { requireRole, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, getTeacherBatchIds } from "@/lib/permissions";

export const GET = withErrorHandling(async () => {
  const session = await requireRole("teacher");
  await connectDB();

  const teacherId = await getTeacherProfileId(session);
  const batchIds = await getTeacherBatchIds(teacherId);
  const batchObjectIds = batchIds.map((id) => new Types.ObjectId(id));

  const [myBatches, totalStudents, assignments, pendingReviews, recentAnnouncements] = await Promise.all([
    Batch.find({ teacher: teacherId }).populate("course", "courseName").sort({ startDate: -1 }),
    Student.countDocuments({ batch: { $in: batchIds } }),
    Assignment.find({ batch: { $in: batchIds } }).sort({ dueDate: -1 }).limit(5).populate("batch", "batchName"),
    Submission.aggregate([
      { $lookup: { from: "assignments", localField: "assignment", foreignField: "_id", as: "assignment" } },
      { $unwind: "$assignment" },
      { $match: { "assignment.batch": { $in: batchObjectIds }, status: { $in: ["submitted", "late"] } } },
      { $count: "count" },
    ]),
    Announcement.find({
      status: "published",
      $or: [{ targetType: "all" }, { targetType: "batch", batch: { $in: batchIds } }],
    })
      .sort({ createdAt: -1 })
      .limit(5),
  ]);

  return NextResponse.json({
    totalBatches: myBatches.length,
    myBatches,
    totalStudents,
    recentAssignments: assignments,
    pendingReviews: pendingReviews[0]?.count ?? 0,
    recentAnnouncements,
  });
});
