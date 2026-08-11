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
});

export const enrollmentSchema = z.object({
  student: objectId,
  course: objectId,
  batch: objectId,
  enrollmentDate: z.coerce.date().optional(),
  status: z.enum(["active", "completed", "dropped"]).optional(),
});

export { objectId };
