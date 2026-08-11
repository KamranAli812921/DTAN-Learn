import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Announcement, Student, Batch } from "@/models";
import { announcementSchema } from "@/lib/validators/coursework";
import { requireRole, requireSession, ApiError, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, getTeacherBatchIds, getStudentProfileId } from "@/lib/permissions";

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  await connectDB();

  let filter: Record<string, unknown> = { status: "published" };

  if (session.user.role === "student") {
    const studentId = await getStudentProfileId(session);
    const student = await Student.findById(studentId);
    filter = {
      status: "published",
      $or: [{ targetType: "all" }, { targetType: "course", course: student?.course }, { targetType: "batch", batch: student?.batch }],
    };
  } else if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    const batchIds = await getTeacherBatchIds(teacherId);
    const batches = await Batch.find({ _id: { $in: batchIds } }).select("course");
    const courseIds = batches.map((b) => b.course);
    filter = {
      $or: [
        { targetType: "all" },
        { targetType: "course", course: { $in: courseIds } },
        { targetType: "batch", batch: { $in: batchIds } },
      ],
    };
  }
  // admin sees everything, including archived — no extra filter beyond default query below.

  const announcements = await Announcement.find(session.user.role === "admin" ? {} : filter)
    .populate("createdBy", "username")
    .populate("course", "courseName")
    .populate("batch", "batchName")
    .sort({ createdAt: -1 });

  return NextResponse.json(announcements);
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();
  const body = await req.json();
  const data = announcementSchema.parse(body);

  if (session.user.role === "teacher") {
    if (data.targetType === "all") {
      throw new ApiError(403, "Teachers may only target their own course or batch.");
    }
    const teacherId = await getTeacherProfileId(session);
    const batchIds = await getTeacherBatchIds(teacherId);

    if (data.targetType === "batch" && (!data.batch || !batchIds.includes(data.batch))) {
      throw new ApiError(403, "You are not assigned to this batch.");
    }
    if (data.targetType === "course") {
      const batches = await Batch.find({ _id: { $in: batchIds }, course: data.course });
      if (!batches.length) throw new ApiError(403, "You do not teach this course.");
    }
  }

  const announcement = await Announcement.create({ ...data, createdBy: session.user.id });
  return NextResponse.json(announcement, { status: 201 });
});
