import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type AnnouncementTarget = "all" | "course" | "batch";
export type AnnouncementStatus = "published" | "archived";

export interface IAnnouncement extends Document {
  createdBy: Types.ObjectId;
  title: string;
  message: string;
  targetType: AnnouncementTarget;
  course?: Types.ObjectId;
  batch?: Types.ObjectId;
  status: AnnouncementStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    targetType: { type: String, enum: ["all", "course", "batch"], default: "all" },
    course: { type: Schema.Types.ObjectId, ref: "Course" },
    batch: { type: Schema.Types.ObjectId, ref: "Batch" },
    status: { type: String, enum: ["published", "archived"], default: "published" },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ batch: 1 });
AnnouncementSchema.index({ course: 1 });

const Announcement: Model<IAnnouncement> = models.Announcement || model<IAnnouncement>("Announcement", AnnouncementSchema);
export default Announcement;
