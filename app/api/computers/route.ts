import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { connectDB } from "@/lib/mongodb";
import { buildSeedComputers } from "@/lib/seed-computers";
import { Computer } from "@/models/Computer";
import { Booking } from "@/models/Booking";

export async function GET() {
  try {
    await connectDB();
    let computers = await Computer.find({}).lean();

    // In development, auto-bootstrap data to avoid an empty UI on first run.
    if (computers.length === 0 && process.env.NODE_ENV !== "production") {
      await Computer.insertMany(buildSeedComputers());
      computers = await Computer.find({}).lean();
    }
    const occupiedIds = computers
      .filter((c) => c.status === "зайнятий")
      .map((c) => c._id);

    const activeBookings = await Booking.find({
      computer: { $in: occupiedIds },
      isCompleted: { $ne: true },
    })
      .sort({ startTime: -1 })
      .lean();

    const endTimeByComputer = new Map<string, string>();
    for (const b of activeBookings) {
      const cid = b.computer.toString();
      if (!endTimeByComputer.has(cid)) {
        endTimeByComputer.set(cid, b.endTime.toISOString());
      }
    }

    const serialized = computers.map((c) => {
      const base = {
        _id: c._id.toString(),
        name: c.name,
        type: c.type,
        status: c.status,
        pricePerHour: c.pricePerHour,
      };
      const endTime = endTimeByComputer.get(c._id.toString());
      return endTime ? { ...base, endTime } : base;
    });

    return ok(serialized);
  } catch (error) {
    console.error("GET /api/computers:", error);
    return fail("Не вдалося завантажити список комп'ютерів", 500, "COMPUTERS_FETCH_FAILED");
  }
}
