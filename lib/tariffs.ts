import { connectDB } from "@/lib/mongodb";
import { Computer } from "@/models/Computer";

export interface TariffItem {
  type: string;
  pricePerHour: number;
}

export async function fetchTariffs(): Promise<TariffItem[]> {
  await connectDB();
  const rows = await Computer.aggregate<{ _id: string; pricePerHour: number }>([
    { $group: { _id: "$type", pricePerHour: { $first: "$pricePerHour" } } },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((row) => ({
    type: row._id,
    pricePerHour: row.pricePerHour,
  }));
}
