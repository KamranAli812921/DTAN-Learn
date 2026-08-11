import { Schema, model, models, type Document, type Model, type Types } from "mongoose";
import type { AttendanceStatus } from "./Attendance";

export interface IAttendanceAuditLog extends Document {
  attendance: Types.ObjectId;
  student: Types.ObjectId;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  changedBy: Types.ObjectId;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceAuditLogSchema = new Schema<IAttendanceAuditLog>(
  {
    attendance: { type: Schema.Types.ObjectId, ref: "Attendance", required: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    previousStatus: { type: String, enum: ["present", "absent", "late", "excused"], required: true },
    newStatus: { type: String, enum: ["present", "absent", "late", "excused"], required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

AttendanceAuditLogSchema.index({ student: 1 });
AttendanceAuditLogSchema.index({ attendance: 1 });

const AttendanceAuditLog: Model<IAttendanceAuditLog> =
  models.AttendanceAuditLog || model<IAttendanceAuditLog>("AttendanceAuditLog", AttendanceAuditLogSchema);
export default AttendanceAuditLog;
