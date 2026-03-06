"use client";

import { motion } from "framer-motion";
import LiveStatsBar from "./LiveStatsBar";

export default function Hero() {
  const scrollTo = (id: string) => () => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden border-b border-white/5">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-violet-500/5"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 py-12 md:py-16">
        <div className="flex flex-col items-center gap-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
              <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Game-X
              </span>
              <span className="block mt-1 text-white">Кіберспорт-центр</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-neutral-400 md:text-base">
              RTX 4090, VIP-зали, турніри. Обери місце та грай.
            </p>
          </motion.div>

          <LiveStatsBar />

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <button
              type="button"
              onClick={scrollTo("booking-map")}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-cyan-500/30 hover:scale-105 active:scale-95"
            >
              Забронювати ПК
            </button>
            <button
              type="button"
              onClick={scrollTo("tariffs")}
              className="rounded-xl border-2 border-white/20 bg-white/5 px-6 py-3 font-medium text-white transition-all hover:border-cyan-500/50 hover:bg-cyan-500/10"
            >
              Тарифи
            </button>
            <a
              href="/profile"
              className="rounded-xl border border-white/10 px-6 py-3 font-medium text-neutral-400 transition hover:text-white hover:border-white/20"
            >
              Профіль
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
