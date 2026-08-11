import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

/**
 * A scheduled Zoom live class for a batch. Not explicitly listed in the spec's
 * data model section, but required to hold meeting-level metadata (join URL,
 * scheduled start, expected duration, allowed join window) that the
 * Attendance auto-calculation logic (status derived from totalDurationMinutes,
 * late-arrival window) needs to reference alongside each per-student
 * Attendance document for the same zoomMeetingId.
 */
export interface ILiveClass extends Document {
  course: Types.ObjectId;
  batch: Types.ObjectId;
  teacher: Types.ObjectId;
  topic: string;
  zoomMeetingId: string;
  zoomJoinUrl: string;
  startTime: Date;
  durationMinutes: number;
  joinWindowMinutes: number; // grace period after startTime before a join counts as "late"
  status: "scheduled" | "completed" | "cancelled";
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LiveClassSchema = new Schema<ILiveClass>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    batch: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    teacher: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    topic: { type: String, required: true, trim: true },
    zoomMeetingId: { type: String, required: true, unique: true },
    zoomJoinUrl: { type: String, required: true },
    startTime: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    joinWindowMinutes: { type: Number, default: 10, min: 0 },
    status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

LiveClassSchema.index({ batch: 1 });

const LiveClass: Model<ILiveClass> = models.LiveClass || model<ILiveClass>("LiveClass", LiveClassSchema);
export default LiveClass;
