import { z } from "zod";
import { isValidObjectId } from "@/lib/permissions";

const objectId = z.string().refine(isValidObjectId, "Invalid id.");

export const courseSchema = z.object({
  courseCode: z.string().min(2).max(20),
  courseName: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  duration: z.string().max(60).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const batchSchema = z.object({
  course: objectId,
  teacher: objectId,
  batchName: z.string().min(2).max(120),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  status: z.enum(["upcoming", "active", "completed"]).optional(),
  // 0/omitted = uncapped. See models/Batch.ts.
  totalClasses: z.number().int().min(0).max(500).optional(),
});

// Teachers may only ever adjust the planned class count on their own batch,
// never reassign the course/teacher/schedule — see PATCH /api/batches/[id].
export const batchTotalClassesSchema = z.object({
  totalClasses: z.number().int().min(0).max(500),
});

export const enrollmentSchema = z.object({
  student: objectId,
  course: objectId,
  batch: objectId,
  enrollmentDate: z.coerce.date().optional(),
  status: z.enum(["active", "completed", "dropped"]).optional(),
});

export { objectId };
