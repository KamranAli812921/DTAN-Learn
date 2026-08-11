import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export type SubmissionStatus = "submitted" | "late" | "reviewed";

export interface ISubmission extends Document {
  assignment: Types.ObjectId;
  student: Types.ObjectId;
  fileUrl?: string;
  githubUrl?: string;
  comments?: string;
  submittedAt: Date;
  status: SubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    assignment: { type: Schema.Types.ObjectId, ref: "Assignment", required: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    fileUrl: { type: String },
    githubUrl: { type: String },
    comments: { type: String, trim: true },
    submittedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["submitted", "late", "reviewed"], default: "submitted" },
  },
  { timestamps: true }
);

// One submission per student per assignment (edited in place on resubmit).
SubmissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

const Submission: Model<ISubmission> = models.Submission || model<ISubmission>("Submission", SubmissionSchema);
export default Submission;
