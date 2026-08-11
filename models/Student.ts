import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface IStudent extends Document {
  user: Types.ObjectId;
  studentId: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  course: Types.ObjectId;
  batch: Types.ObjectId;
  enrollmentDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    studentId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    avatarUrl: { type: String },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    batch: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    enrollmentDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

StudentSchema.index({ batch: 1 });
StudentSchema.index({ course: 1 });

const Student: Model<IStudent> = models.Student || model<IStudent>("Student", StudentSchema);
export default Student;
