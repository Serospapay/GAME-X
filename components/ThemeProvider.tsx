"use client";

import { useEffect } from "react";

const THEME_KEY = "gamex-theme";
type ThemeName = "stealth" | "arena";

function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as ThemeName | null;
    const theme: ThemeName = saved === "arena" ? "arena" : "stealth";
    applyTheme(theme);
  }, []);

  return <>{children}</>;
}

export function toggleTheme(): ThemeName {
  const current = document.documentElement.getAttribute("data-theme");
  const next: ThemeName = current === "arena" ? "stealth" : "arena";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
  return next;
}
