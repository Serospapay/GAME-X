import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { getLatestActiveBookingsByComputer } from "@/lib/computer-bookings";
import { connectDB } from "@/lib/mongodb";
import { buildSeedComputers } from "@/lib/seed-computers";
import { Computer } from "@/models/Computer";

export async function GET() {
  try {
    await connectDB();
    let computers = await Computer.find({}).lean();

    // In development, auto-bootstrap data to avoid an empty UI on first run.
    if (computers.length === 0 && process.env.NODE_ENV !== "production") {
      await Computer.insertMany(buildSeedComputers());
      computers = await Computer.find({}).lean();
    }
    const occupiedIds = computers.filter((c) => c.status === "зайнятий").map((c) => c._id);
    const activeBookingsByComputer = await getLatestActiveBookingsByComputer(occupiedIds);

    const serialized = computers.map((c) => {
      const base = {
        _id: c._id.toString(),
        name: c.name,
        type: c.type,
        status: c.status,
        pricePerHour: c.pricePerHour,
      };
      const endTime = activeBookingsByComputer.get(c._id.toString())?.endTime.toISOString();
      return endTime ? { ...base, endTime } : base;
    });

    return ok(serialized);
  } catch (error) {
    console.error("GET /api/computers:", error);
    return fail("Не вдалося завантажити список комп'ютерів", 500, "COMPUTERS_FETCH_FAILED");
  }
}
