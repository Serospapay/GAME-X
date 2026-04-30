import mongoose from "mongoose";
import { Booking } from "@/models/Booking";

export interface ActiveBookingSnapshot {
  _id: string;
  computer: string;
  clientName: string;
  startTime: Date;
  endTime: Date;
  totalAmount: number;
}

export async function getLatestActiveBookingsByComputer(
  computerIds: Array<mongoose.Types.ObjectId>
): Promise<Map<string, ActiveBookingSnapshot>> {
  if (computerIds.length === 0) {
    return new Map<string, ActiveBookingSnapshot>();
  }

  const bookings = await Booking.find(
    {
      computer: { $in: computerIds },
      isCompleted: { $ne: true },
    },
    "computer clientName startTime endTime totalAmount"
  )
    .sort({ startTime: -1 })
    .lean();

  const byComputer = new Map<string, ActiveBookingSnapshot>();
  for (const booking of bookings) {
    const computerId = booking.computer.toString();
    if (byComputer.has(computerId)) continue;
    byComputer.set(computerId, {
      _id: booking._id.toString(),
      computer: computerId,
      clientName: booking.clientName,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalAmount: booking.totalAmount,
    });
  }

  return byComputer;
}
