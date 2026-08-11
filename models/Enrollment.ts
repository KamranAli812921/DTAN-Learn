import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type EnrollmentStatus = "active" | "completed" | "dropped";

export interface IEnrollment extends Document {
  student: Types.ObjectId;
  course: Types.ObjectId;
  batch: Types.ObjectId;
  enrollmentDate: Date;
  status: EnrollmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const EnrollmentSchema = new Schema<IEnrollment>(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    batch: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    enrollmentDate: { type: Date, default: Date.now },
    status: { type: String, enum: ["active", "completed", "dropped"], default: "active" },
  },
  { timestamps: true }
);

EnrollmentSchema.index({ student: 1, batch: 1 }, { unique: true });

const Enrollment: Model<IEnrollment> = models.Enrollment || model<IEnrollment>("Enrollment", EnrollmentSchema);
export default Enrollment;
