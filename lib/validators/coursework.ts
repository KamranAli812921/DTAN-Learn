import { z } from "zod";
import { objectId } from "@/lib/validators/academic";

export const assignmentSchema = z.object({
  course: objectId,
  batch: objectId,
  title: z.string().min(2).max(150),
  description: z.string().max(4000).optional(),
  dueDate: z.coerce.date(),
  totalMarks: z.number().min(0).max(1000),
  attachmentUrl: z.string().url().optional().or(z.literal("")),
  submissionType: z.enum(["file", "github", "both"]).optional(),
  status: z.enum(["draft", "published"]).optional(),
});

export const submissionSchema = z
  .object({
    fileUrl: z.string().url().optional().or(z.literal("")),
    githubUrl: z.string().url().optional().or(z.literal("")),
    comments: z.string().max(2000).optional(),
  })
  .refine((data) => data.fileUrl || data.githubUrl, {
    message: "Provide a file upload or a GitHub URL.",
  });

export const markSchema = z.object({
  marksObtained: z.number().min(0),
  feedback: z.string().max(2000).optional(),
});

export const materialSchema = z.object({
  course: objectId,
  batch: objectId,
  title: z.string().min(2).max(150),
  description: z.string().max(2000).optional(),
  fileUrl: z.string().url(),
});

export const announcementSchema = z
  .object({
    title: z.string().min(2).max(150),
    message: z.string().min(2).max(4000),
    targetType: z.enum(["all", "course", "batch"]),
    course: objectId.optional(),
    batch: objectId.optional(),
    status: z.enum(["published", "archived"]).optional(),
  })
  .refine((d) => d.targetType !== "course" || !!d.course, { message: "Course is required for course-targeted announcements.", path: ["course"] })
  .refine((d) => d.targetType !== "batch" || !!d.batch, { message: "Batch is required for batch-targeted announcements.", path: ["batch"] });
