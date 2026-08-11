import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface IPasswordResetToken extends Document {
  user: Types.ObjectId;
  codeHash: string;
  expiresAt: Date;
  used: boolean;
  verified: boolean;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PasswordResetTokenSchema.index({ user: 1, createdAt: -1 });
// TTL cleanup: purge documents ~1 day after they expire.
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

const PasswordResetToken: Model<IPasswordResetToken> =
  models.PasswordResetToken || model<IPasswordResetToken>("PasswordResetToken", PasswordResetTokenSchema);
export default PasswordResetToken;
