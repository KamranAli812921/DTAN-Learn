import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface IMaterial extends Document {
  course: Types.ObjectId;
  batch: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  title: string;
  description?: string;
  fileUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const MaterialSchema = new Schema<IMaterial>(
  {
    course: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    batch: { type: Schema.Types.ObjectId, ref: "Batch", required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    fileUrl: { type: String, required: true },
  },
  { timestamps: true }
);

MaterialSchema.index({ batch: 1 });

const Material: Model<IMaterial> = models.Material || model<IMaterial>("Material", MaterialSchema);
export default Material;
