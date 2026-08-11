import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Attendance, AttendanceAuditLog, Student } from "@/models";
import { graceAttendanceSchema } from "@/lib/validators/attendance";
import { requireRole, withErrorHandling } from "@/lib/api-helpers";
import { getTeacherProfileId, assertTeacherOwnsBatch } from "@/lib/permissions";

/**
 * Bulk-mark students in a batch as "present" for a given date — e.g. a
 * teacher rewarding the whole batch, or just the students who completed a
 * task/challenge, with grace attendance. When `students` is omitted every
 * student in the batch is targeted; when provided, only those students
 * (still scoped to the batch) are targeted. Reuses the same per-record
 * rules as manual marking/overriding: a fresh record is created for
 * students with none yet, an existing non-present record is overridden
 * (with an AttendanceAuditLog entry, same as any other manual override —
 * no exceptions), and students already marked present for that date are
 * left untouched.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireRole("admin", "teacher");
  await connectDB();

  const body = await req.json();
  const data = graceAttendanceSchema.parse(body);

  if (session.user.role === "teacher") {
    const teacherId = await getTeacherProfileId(session);
    await assertTeacherOwnsBatch(teacherId, data.batch);
  }

  // UTC day boundary — see the same normalization in app/api/attendance/route.ts.
  const date = new Date(data.date);
  date.setUTCHours(0, 0, 0, 0);

  const remarks = `Grace attendance: ${data.reason}`;

  const studentFilter: Record<string, unknown> = { batch: data.batch };
  if (data.students?.length) studentFilter._id = { $in: data.students };

  const students = await Student.find(studentFilter).select("_id");

  let created = 0;
  let updated = 0;
  let alreadyPresent = 0;

  for (const student of students) {
    const existing = await Attendance.findOne({ student: student._id, batch: data.batch, date });

    if (!existing) {
      const attendance = await Attendance.create({
        student: student._id,
        batch: data.batch,
        date,
        status: "present",
        markedBy: session.user.id,
        source: "manual",
        remarks,
      });
      await AttendanceAuditLog.create({
        attendance: attendance._id,
        student: student._id,
        previousStatus: "absent",
        newStatus: "present",
        changedBy: session.user.id,
        reason: remarks,
      });
      created += 1;
    } else if (existing.status !== "present") {
      const previousStatus = existing.status;
      existing.status = "present";
      existing.remarks = remarks;
      existing.markedBy = session.user.id as unknown as typeof existing.markedBy;
      await existing.save();
      await AttendanceAuditLog.create({
        attendance: existing._id,
        student: student._id,
        previousStatus,
        newStatus: "present",
        changedBy: session.user.id,
        reason: remarks,
      });
      updated += 1;
    } else {
      alreadyPresent += 1;
    }
  }

  return NextResponse.json({ totalStudents: students.length, created, updated, alreadyPresent });
});
