import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface IMark extends Document {
  submission: Types.ObjectId;
  student: Types.ObjectId;
  assignment: Types.ObjectId;
  marksObtained: number;
  feedback?: string;
  gradedBy: Types.ObjectId;
  gradedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MarkSchema = new Schema<IMark>(
  {
    submission: { type: Schema.Types.ObjectId, ref: "Submission", required: true, unique: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
    marksObtained: { type: Number, required: true, min: 0 },
    feedback: { type: String, trim: true },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    gradedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

MarkSchema.index({ student: 1 });
MarkSchema.index({ assignment: 1 });

const Mark: Model<IMark> = models.Mark || model<IMark>("Mark", MarkSchema);
export default Mark;
