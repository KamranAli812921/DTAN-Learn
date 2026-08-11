import { z } from "zod";
import { isValidObjectId } from "@/lib/permissions";

const objectId = z.string().refine(isValidObjectId, "Invalid id.");

export const createStudentSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/, "Alphanumeric, dot, dash, underscore only."),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  studentId: z.string().min(1),
  course: objectId,
  batch: objectId,
  enrollmentDate: z.coerce.date().optional(),
});

export const updateStudentSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  course: objectId.optional(),
  batch: objectId.optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const createTeacherSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  teacherId: z.string().min(1),
});

export const updateTeacherSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const changeAccountStatusSchema = z.object({
  status: z.enum(["active", "inactive"]),
});

export const createAdminSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9._-]+$/),
  email: z.string().email(),
  password: z.string().min(8),
});
