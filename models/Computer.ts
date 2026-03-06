import mongoose, { Schema, Model, Types } from "mongoose";

export type ComputerType = "VIP" | "Standard" | "PS5";
export type ComputerStatus = "вільний" | "зайнятий" | "ремонт";

export interface IComputer {
  _id: Types.ObjectId;
  name: string;
  type: ComputerType;
  status: ComputerStatus;
  pricePerHour: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const ComputerSchema = new Schema<IComputer>(
  {
    name: { type: String, required: true, unique: true },
    type: { type: String, required: true, enum: ["VIP", "Standard", "PS5"] },
    status: {
      type: String,
      required: true,
      enum: ["вільний", "зайнятий", "ремонт"],
      default: "вільний",
    },
    pricePerHour: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

ComputerSchema.index({ status: 1, type: 1 });
ComputerSchema.index({ type: 1, status: 1, pricePerHour: 1 });

export const Computer: Model<IComputer> =
  (mongoose.models.Computer as Model<IComputer>) ??
  mongoose.model<IComputer>("Computer", ComputerSchema);
