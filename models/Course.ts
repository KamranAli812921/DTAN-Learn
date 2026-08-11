import { Schema, model, models, type Document, type Model } from "mongoose";

export type CourseStatus = "active" | "inactive";

export interface ICourse extends Document {
  courseCode: string;
  courseName: string;
  description?: string;
  duration?: string;
  status: CourseStatus;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    courseCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    courseName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    duration: { type: String, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

const Course: Model<ICourse> = models.Course || model<ICourse>("Course", CourseSchema);
export default Course;
