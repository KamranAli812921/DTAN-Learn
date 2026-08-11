import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface ITeacher extends Document {
  user: Types.ObjectId;
  teacherId: string;
  fullName: string;
  phone?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TeacherSchema = new Schema<ITeacher>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    teacherId: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    avatarUrl: { type: String },
  },
  { timestamps: true }
);

const Teacher: Model<ITeacher> = models.Teacher || model<ITeacher>("Teacher", TeacherSchema);
export default Teacher;
