import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type UnmatchedZoomStatus = "pending" | "resolved" | "ignored";

/**
 * A Zoom participant segment (from the webhook or the polling sync) whose
 * email didn't match any student, so it couldn't be merged into an
 * Attendance record automatically. Surfaced to admin/teacher as a review
 * table (see /api/attendance/unmatched) so they can ask the student which
 * email they joined with and assign the segment to that student instead of
 * it silently staying "absent" forever.
 */
export interface IUnmatchedZoomParticipant extends Document {
  liveClass: Types.ObjectId;
  batch: Types.ObjectId;
  zoomMeetingId: string;
  zoomParticipantId?: string;
  zoomEmail?: string;
  zoomName?: string;
  joinTime: Date;
  leaveTime?: Date;
  status: UnmatchedZoomStatus;
  resolvedStudent?: Types.ObjectId;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UnmatchedZoomParticipantSchema = new Schema<IUnmatchedZoomParticipant>(
  {
    liveClass: { type: Schema.Types.ObjectId, ref: "LiveClass", required: true },
    batch: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    zoomMeetingId: { type: String, required: true },
    zoomParticipantId: { type: String },
    zoomEmail: { type: String, trim: true, lowercase: true },
    zoomName: { type: String, trim: true },
    joinTime: { type: Date, required: true },
    leaveTime: { type: Date },
    status: { type: String, enum: ["pending", "resolved", "ignored"], default: "pending" },
    resolvedStudent: { type: Schema.Types.ObjectId, ref: "Student" },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

UnmatchedZoomParticipantSchema.index({ liveClass: 1, zoomParticipantId: 1 });
UnmatchedZoomParticipantSchema.index({ batch: 1, status: 1 });

const UnmatchedZoomParticipant: Model<IUnmatchedZoomParticipant> =
  models.UnmatchedZoomParticipant ||
  model<IUnmatchedZoomParticipant>("UnmatchedZoomParticipant", UnmatchedZoomParticipantSchema);

export default UnmatchedZoomParticipant;
