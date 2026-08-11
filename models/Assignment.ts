import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type SubmissionType = "file" | "github" | "both";
export type AssignmentStatus = "draft" | "published";

export interface IAssignment extends Document {
  course: Types.ObjectId;
  batch: Types.ObjectId;
  createdBy: Types.ObjectId;
  title: string;
  description?: string;
  dueDate: Date;
  totalMarks: number;
  attachmentUrl?: string;
  submissionType: SubmissionType;
  status: AssignmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    batch: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    dueDate: { type: Date, required: true },
    totalMarks: { type: Number, required: true, min: 0 },
    attachmentUrl: { type: String },
    submissionType: { type: String, enum: ["file", "github", "both"], default: "both" },
    status: { type: String, enum: ["draft", "published"], default: "published" },
  },
  { timestamps: true }
);

AssignmentSchema.index({ batch: 1 });

const Assignment: Model<IAssignment> = models.Assignment || model<IAssignment>("Assignment", AssignmentSchema);
export default Assignment;
