import mongoose, { Schema, Model, Types } from "mongoose";

export interface IBooking {
  _id: Types.ObjectId;
  computer: Types.ObjectId;
  clientName: string;
  clientId?: Types.ObjectId;
  clientEmail?: string;
  startTime: Date;
  endTime: Date;
  totalAmount: number;
  idempotencyKey?: string;
  isCompleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    computer: {
      type: Schema.Types.ObjectId,
      ref: "Computer",
      required: true,
    },
    clientName: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "User", required: false },
    clientEmail: { type: String, required: false, index: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    idempotencyKey: { type: String, required: false, unique: true, sparse: true },
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

BookingSchema.index({ computer: 1, isCompleted: 1, endTime: 1 });
BookingSchema.index({ clientEmail: 1, createdAt: -1 });
BookingSchema.index({ clientId: 1, createdAt: -1 });

export const Booking: Model<IBooking> =
  (mongoose.models.Booking as Model<IBooking>) ??
  mongoose.model<IBooking>("Booking", BookingSchema);
