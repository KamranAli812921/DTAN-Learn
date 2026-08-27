import { z } from "zod";
import { objectId } from "@/lib/validators/academic";

export const manualAttendanceSchema = z.object({
  student: objectId,
  batch: objectId,
  liveClass: objectId.optional(),
  date: z.coerce.date(),
  status: z.enum(["present", "absent"]),
  remarks: z.string().max(500).optional(),
});

export const attendanceOverrideSchema = z.object({
  status: z.enum(["present", "absent"]),
  reason: z.string().min(3, "A reason is required for manual overrides.").max(500),
});

export const graceAttendanceSchema = z.object({
  batch: objectId,
  liveClass: objectId.optional(),
  date: z.coerce.date(),
  reason: z.string().min(3, "A reason is required for grace attendance.").max(500),
  students: z.array(objectId).min(1).optional(),
});

export const resolveUnmatchedParticipantSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("resolve"),
    student: objectId,
    rememberEmail: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("ignore"),
  }),
]);

export const liveClassSchema = z.object({
  course: objectId,
  batch: objectId,
  topic: z.string().min(2).max(150),
  startTime: z.coerce.date(),
  timeZone: z.string().max(100).optional(),
  durationMinutes: z.number().int().min(5).max(600),
  joinWindowMinutes: z.number().int().min(0).max(120).optional(),
});
