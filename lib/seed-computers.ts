import type { ComputerStatus, ComputerType } from "@/models/Computer";

const STATUSES: ComputerStatus[] = ["вільний", "зайнятий", "ремонт"];

export interface SeedComputer {
  name: string;
  type: ComputerType;
  status: ComputerStatus;
  pricePerHour: number;
}

function randomStatus(): ComputerStatus {
  const r = Math.random();
  if (r < 0.7) return "вільний";
  if (r < 0.9) return "зайнятий";
  return "ремонт";
}

export function buildSeedComputers(): SeedComputer[] {
  const items: SeedComputer[] = [];

  for (let i = 1; i <= 10; i += 1) {
    items.push({
      name: `PC-${String(i).padStart(2, "0")}`,
      type: "Standard",
      status: randomStatus(),
      pricePerHour: 50,
    });
  }

  for (let i = 1; i <= 5; i += 1) {
    items.push({
      name: `VIP-${String(i).padStart(2, "0")}`,
      type: "VIP",
      status: randomStatus(),
      pricePerHour: 100,
    });
  }

  for (let i = 1; i <= 4; i += 1) {
    items.push({
      name: `PS5-${String(i).padStart(2, "0")}`,
      type: "PS5",
      status: randomStatus(),
      pricePerHour: 80,
    });
  }

  return items;
}
