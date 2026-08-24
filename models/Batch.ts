import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type BatchStatus = "upcoming" | "active" | "completed";

export interface IBatch extends Document {
  course: Types.ObjectId;
  teacher: Types.ObjectId;
  batchName: string;
  startDate: Date;
  endDate?: Date;
  status: BatchStatus;
  /** Planned number of live classes for this batch's run of the course.
   *  0 means uncapped (not yet set) — live-class scheduling and the
   *  remaining-classes UI treat 0 as "no limit" for backward compatibility
   *  with batches created before this field existed. */
  totalClasses: number;
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<IBatch>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    teacher: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    batchName: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    status: { type: String, enum: ["upcoming", "active", "completed"], default: "upcoming" },
    totalClasses: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

BatchSchema.index({ teacher: 1 });
BatchSchema.index({ course: 1 });

const Batch: Model<IBatch> = models.Batch || model<IBatch>("Batch", BatchSchema);
export default Batch;
