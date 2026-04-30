import mongoose, { Model, Schema, Types } from "mongoose";

export interface IRateLimitWindow {
  _id: Types.ObjectId;
  key: string;
  count: number;
  resetAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const RateLimitWindowSchema = new Schema<IRateLimitWindow>(
  {
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, required: true, min: 0, default: 0 },
    resetAt: { type: Date, required: true },
  },
  { timestamps: true }
);

RateLimitWindowSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitWindow: Model<IRateLimitWindow> =
  (mongoose.models.RateLimitWindow as Model<IRateLimitWindow>) ??
  mongoose.model<IRateLimitWindow>("RateLimitWindow", RateLimitWindowSchema);
