"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  endTime: string | Date;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function CountdownTimer({ endTime }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const end = typeof endTime === "string" ? new Date(endTime) : endTime;

    const tick = () => {
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      setRemaining(diff <= 0 ? 0 : diff);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  if (remaining === null) return null;

  if (remaining <= 0) {
    return (
      <span className="animate-pulse text-red-500">Час вийшов</span>
    );
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return <span className="tabular-nums text-red-300">{formatted}</span>;
}
