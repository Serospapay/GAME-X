"use client";

import { useEffect, useState } from "react";
import { Monitor, Crown, Gamepad2 } from "lucide-react";
import { motion } from "framer-motion";

interface TariffItem {
  type: string;
  pricePerHour: number;
}

const DEFAULT_TARIFFS: TariffItem[] = [
  { type: "Standard", pricePerHour: 50 },
  { type: "VIP", pricePerHour: 100 },
  { type: "PS5", pricePerHour: 80 },
];

const TARIFF_CONFIG: Record<
  string,
  { icon: typeof Monitor; glow: string }
> = {
  Standard: {
    icon: Monitor,
    glow: "rgba(6,182,212,0.5)",
  },
  VIP: {
    icon: Crown,
    glow: "rgba(245,158,11,0.5)",
  },
  PS5: {
    icon: Gamepad2,
    glow: "rgba(139,92,246,0.5)",
  },
};

export default function TariffsBento() {
  const [tariffs, setTariffs] = useState<TariffItem[]>(DEFAULT_TARIFFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tariffs")
      .then((res) => res.ok ? res.json() : [])
      .then((data: TariffItem[]) => {
        if (data.length > 0) {
          const merged = DEFAULT_TARIFFS.map((d) => {
            const fromApi = data.find(
              (t) => t.type.toLowerCase() === d.type.toLowerCase()
            );
            return fromApi ?? d;
          });
          setTariffs(merged);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 flex-1 animate-pulse rounded-xl border border-white/10 bg-white/5"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4">
      {tariffs.map((t, i) => {
        const config = TARIFF_CONFIG[t.type] ?? {
          icon: Monitor,
          glow: "rgba(100,100,100,0.3)",
        };
        const Icon = config.icon;
        return (
          <motion.div
            key={t.type}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{
              y: -4,
              boxShadow: `0 0 20px ${config.glow}`,
              borderColor: "rgba(255,255,255,0.2)",
            }}
            className="flex flex-1 min-w-[140px] items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-colors"
          >
            <div className="rounded-lg border border-white/10 bg-white/5 p-2">
              <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-semibold text-white">{t.type}</p>
              <p className="text-lg font-bold text-white">
                {t.pricePerHour} <span className="text-xs font-normal text-neutral-400">грн/год</span>
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
