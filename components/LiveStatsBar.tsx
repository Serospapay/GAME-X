"use client";

import { useEffect, useState } from "react";
import { Monitor, Users } from "lucide-react";
import { motion } from "framer-motion";

export default function LiveStatsBar() {
  const [stats, setStats] = useState<{ free: number; busy: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = () => {
    fetch("/api/computers")
      .then((res) => res.json())
      .then((data: Array<{ status: string }>) => {
        if (Array.isArray(data)) {
          const free = data.filter((c) => c.status === "вільний").length;
          const busy = data.filter((c) => c.status === "зайнятий").length;
          setStats({ free, busy, total: data.length });
        }
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const scrollToMap = () => {
    document.getElementById("booking-map")?.scrollIntoView({ behavior: "smooth" });
  };

  if (loading || !stats) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-4">
        <div className="h-12 w-32 animate-pulse rounded-lg bg-white/10" />
        <div className="h-12 w-32 animate-pulse rounded-lg bg-white/10" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center justify-center gap-4"
    >
      <button
        type="button"
        onClick={scrollToMap}
        className="group flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3 transition-all hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]"
      >
        <Monitor className="h-5 w-5 text-emerald-400" />
        <div className="text-left">
          <p className="text-2xl font-bold text-emerald-400">{stats.free}</p>
          <p className="text-xs text-neutral-400">вільних</p>
        </div>
      </button>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-3">
        <Users className="h-5 w-5 text-neutral-400" />
        <div className="text-left">
          <p className="text-2xl font-bold text-white">{stats.busy}</p>
          <p className="text-xs text-neutral-400">зайнято</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-5 py-3">
        <p className="text-sm text-neutral-500">
          всього <span className="font-semibold text-white">{stats.total}</span> ПК
        </p>
      </div>
    </motion.div>
  );
}
