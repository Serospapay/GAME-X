"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ShieldCheck, UserCircle2 } from "lucide-react";
import { fetchJsonWithRetry } from "@/lib/fetch-json";

interface UserSummary {
  role: "user";
  name: string;
  activeBookings: number;
  completedBookings: number;
  totalSpent: number;
  preferredType: string | null;
  lastBookedComputer: string | null;
}

interface AdminSummary {
  role: "admin";
  name: string;
  totalComputers: number;
  freeComputers: number;
  busyComputers: number;
  repairComputers: number;
  activeSessions: number;
  occupancyRate: number;
  alerts: string[];
}

type PersonalizationData = UserSummary | AdminSummary;

export default function PersonalizedHomePanel() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<PersonalizationData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    fetchJsonWithRetry<PersonalizationData>(
      "/api/personalization",
      {
        signal: controller.signal,
        headers: { accept: "application/json" },
      },
      1
    )
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [status]);

  if (status !== "authenticated") {
    return null;
  }

  if (loading || !data) {
    return (
      <div className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-5 backdrop-blur-xl">
        <div className="h-5 w-52 animate-pulse rounded bg-white/10" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded bg-white/10" />
      </div>
    );
  }

  const isAdmin = data.role === "admin";

  return (
    <div className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isAdmin ? (
            <ShieldCheck className="h-5 w-5 text-[var(--accent-text)]" />
          ) : (
            <UserCircle2 className="h-5 w-5 text-[var(--accent-text)]" />
          )}
          <p className="font-semibold text-[var(--text-primary)]">
            Вітаємо, {data.name}
          </p>
          <span
            className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent-text)]"
          >
            {isAdmin ? "Адміністратор" : "Користувач"}
          </span>
        </div>

        <div className="flex gap-2">
          {isAdmin ? (
            <>
              <Link
                href="/admin"
                className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] transition hover:brightness-110"
              >
                Відкрити адмінку
              </Link>
              <Link
                href="/#live-map"
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-border)]"
              >
                До карти
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/profile"
                className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-text)] transition hover:brightness-110"
              >
                Мій профіль
              </Link>
              <Link
                href="/#live-map"
                className="rounded-lg border border-[var(--border-soft)] bg-[var(--panel-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--accent-border)]"
              >
                Забронювати
              </Link>
            </>
          )}
        </div>
      </div>

      {isAdmin ? (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
          <Stat label="Усього ПК" value={data.totalComputers} />
          <Stat label="Вільні" value={data.freeComputers} />
          <Stat label="Зайняті" value={data.busyComputers} />
          <Stat label="Ремонт" value={data.repairComputers} />
          <Stat label="Активні сесії" value={data.activeSessions} />
          <Stat label="Завантаження залу" value={`${data.occupancyRate}%`} />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Stat label="Активні сесії" value={data.activeBookings} />
          <Stat label="Завершені сесії" value={data.completedBookings} />
          <Stat label="Витрачено" value={`${data.totalSpent} грн`} />
        </div>
      )}

      {isAdmin ? (
        data.alerts.length > 0 ? (
          <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]">
              Операційні алерти
            </p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
              {data.alerts.map((alert) => (
                <li key={alert}>- {alert}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3">
            <p className="text-sm text-[var(--accent-text)]">
              Стан залу стабільний, критичних алертів немає.
            </p>
          </div>
        )
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-3">
            <p className="text-xs text-[var(--text-muted)]">Рекомендований формат</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              {data.preferredType ? `${data.preferredType} — на основі вашої історії` : "Поки немає історії, спробуйте Standard"}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] p-3">
            <p className="text-xs text-[var(--accent-text)]">Останній вибір</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              {data.lastBookedComputer ?? "Ще не було бронювань"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel-bg)] px-3 py-2.5">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
