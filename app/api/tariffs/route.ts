import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Computer } from "@/models/Computer";

export interface TariffItem {
  type: string;
  pricePerHour: number;
}

export async function GET() {
  try {
    await connectDB();
    const computers = await Computer.aggregate<{ _id: string; pricePerHour: number }>([
      { $group: { _id: "$type", pricePerHour: { $first: "$pricePerHour" } } },
      { $sort: { _id: 1 } },
    ]);

    const tariffs: TariffItem[] = computers.map((c) => ({
      type: c._id,
      pricePerHour: c.pricePerHour,
    }));

    return NextResponse.json(tariffs);
  } catch (error) {
    return NextResponse.json(
      { error: "Не вдалося завантажити тарифи" },
      { status: 500 }
    );
  }
}
