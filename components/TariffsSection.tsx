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
  { icon: typeof Monitor; borderClass: string; iconBg: string }
> = {
  Standard: {
    icon: Monitor,
    borderClass:
      "border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 to-transparent hover:shadow-[0_0_25px_rgba(6,182,212,0.2)]",
    iconBg: "bg-cyan-500/20",
  },
  VIP: {
    icon: Crown,
    borderClass:
      "border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-transparent hover:shadow-[0_0_25px_rgba(245,158,11,0.25)]",
    iconBg: "bg-amber-500/20",
  },
  PS5: {
    icon: Gamepad2,
    borderClass:
      "border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-transparent hover:shadow-[0_0_25px_rgba(139,92,246,0.2)]",
    iconBg: "bg-violet-500/20",
  },
};

export default function TariffsSection() {
  const [tariffs, setTariffs] = useState<TariffItem[]>(DEFAULT_TARIFFS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tariffs")
      .then((res) => {
        if (!res.ok) throw new Error("Помилка завантаження");
        return res.json();
      })
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
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/5"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-3">
      {tariffs.map((t, i) => {
        const config = TARIFF_CONFIG[t.type] ?? {
          icon: Monitor,
          borderClass: "border-neutral-500/40 bg-white/5",
          iconBg: "bg-neutral-500/20",
        };
        const Icon = config.icon;
        return (
          <motion.div
            key={t.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -8, transition: { duration: 0.3 } }}
            className={`
              relative overflow-hidden rounded-2xl border-2 p-8
              backdrop-blur-xl transition-shadow duration-300
              ${config.borderClass}
            `}
          >
            <div className="flex flex-col items-center text-center">
              <div
                className={`mb-4 rounded-xl border border-white/10 p-3 ${config.iconBg}`}
              >
                <Icon className="h-8 w-8 text-white" strokeWidth={1.5} />
              </div>
              <p className="text-lg font-semibold text-white">{t.type}</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {t.pricePerHour}{" "}
                <span className="text-base font-normal text-neutral-400">
                  грн/год
                </span>
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
