"use client";

import { useEffect, useState } from "react";
import { Clock, Zap, Monitor } from "lucide-react";

export default function HeroWidget() {
  const [time, setTime] = useState("");
  const [freeCount, setFreeCount] = useState<number | null>(null);

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Date().toLocaleTimeString("uk-UA", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const t = setInterval(updateTime, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/api/computers")
      .then((res) => res.json())
      .then((data: Array<{ status: string }>) => {
        if (Array.isArray(data)) {
          setFreeCount(data.filter((c) => c.status === "вільний").length);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-full flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          Game-X
        </h1>
        <p className="mt-1 text-sm text-neutral-500">Кіберспорт-центр</p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5">
          <Clock className="h-4 w-4 text-neutral-400" />
          <span className="font-mono text-sm text-white">{time || "--:--:--"}</span>
        </div>

        {freeCount !== null && (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-300">
              {freeCount} вільних ПК прямо зараз
            </span>
          </div>
        )}

        {freeCount === null && (
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5">
            <Monitor className="h-4 w-4 text-neutral-500 animate-pulse" />
            <span className="text-sm text-neutral-500">Завантаження...</span>
          </div>
        )}
      </div>
    </div>
  );
}
