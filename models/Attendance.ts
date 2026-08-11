import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";
export type AttendanceSource = "zoom" | "manual";

export interface IAttendanceSession {
  joinTime: Date;
  leaveTime?: Date;
  durationMinutes: number;
  /** Zoom's per-segment participant id, used to dedupe when the webhook and
   *  the polling fallback both report the same join/leave segment. */
  zoomParticipantId?: string;
}

export interface IAttendance extends Document {
  student: Types.ObjectId;
  batch: Types.ObjectId;
  liveClass?: Types.ObjectId;
  date: Date;
  status: AttendanceStatus;
  markedBy?: Types.ObjectId;
  source: AttendanceSource;
  zoomMeetingId?: string;
  sessions: IAttendanceSession[];
  totalDurationMinutes: number;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    joinTime: { type: Date, required: true },
    leaveTime: { type: Date },
    durationMinutes: { type: Number, required: true, default: 0, min: 0 },
    zoomParticipantId: { type: String },
  },
  { _id: false }
);

const AttendanceSchema = new Schema<IAttendance>(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    batch: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    liveClass: { type: Schema.Types.ObjectId, ref: "LiveClass" },
    date: { type: Date, required: true },
    status: { type: String, enum: ["present", "absent", "late", "excused"], default: "absent" },
    markedBy: { type: Schema.Types.ObjectId, ref: "User" },
    source: { type: String, enum: ["zoom", "manual"], default: "manual" },
    zoomMeetingId: { type: String },
    sessions: { type: [AttendanceSessionSchema], default: [] },
    totalDurationMinutes: { type: Number, default: 0, min: 0 },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

// Prevent duplicate attendance records for the same student/batch/date.
AttendanceSchema.index({ student: 1, batch: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ zoomMeetingId: 1 });

const Attendance: Model<IAttendance> = models.Attendance || model<IAttendance>("Attendance", AttendanceSchema);
export default Attendance;
