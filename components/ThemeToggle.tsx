"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { toggleTheme } from "@/components/ThemeProvider";

type ThemeName = "stealth" | "arena";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeName>("stealth");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "arena" ? "arena" : "stealth");
  }, []);

  return (
    <button
      type="button"
      onClick={() => setTheme(toggleTheme())}
      className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--panel-bg)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-border)]"
      title="Перемкнути тему інтерфейсу"
    >
      <Palette className="h-3.5 w-3.5 text-[var(--accent)]" />
      {theme === "arena" ? "Arena" : "Stealth"}
    </button>
  );
}
