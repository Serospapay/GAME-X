import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  Archive,
  ArrowUpDown,
  MonitorCog,
  MonitorOff,
  MonitorPlay,
  Search,
  Shield,
  Siren,
  TriangleAlert,
} from "lucide-react";
import { authOptions } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { getLatestActiveBookingsByComputer } from "@/lib/computer-bookings";
import { connectDB } from "@/lib/mongodb";
import { Computer } from "@/models/Computer";
import { AuditLog } from "@/models/AuditLog";
import { AuditLogArchive } from "@/models/AuditLogArchive";
import AdminPCAction from "@/components/AdminPCAction";

export const dynamic = "force-dynamic";

interface BookingDoc {
  _id: string;
  clientName: string;
  startTime: Date;
  endTime: Date;
  totalAmount: number;
}

interface ComputerWithBooking {
  _id: string;
  name: string;
  type: string;
  status: string;
  pricePerHour: number;
  booking: BookingDoc | null;
}

interface AuditItem {
  _id: string;
  action: string;
  actorRole: "system" | "admin" | "user";
  actorEmail?: string;
  createdAt?: Date;
}

interface AdminPageProps {
  searchParams?: Promise<{
    auditSource?: string;
    auditLimit?: string;
    q?: string;
    type?: string;
    ending?: string;
    sort?: string;
  }>;
}

function normalizeAuditSource(value: string | undefined): "main" | "archive" {
  return value === "archive" ? "archive" : "main";
}

function normalizeAuditLimit(value: string | undefined): number {
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(50, Math.max(5, parsed));
}

type PcTypeFilter = "all" | "VIP" | "Standard" | "PS5";
type EndingFilter = "all" | "critical" | "soon" | "overdue";
type OccupiedSort = "end-asc" | "end-desc" | "amount-desc";

function normalizePcTypeFilter(value: string | undefined): PcTypeFilter {
  if (value === "VIP" || value === "Standard" || value === "PS5") return value;
  return "all";
}

function normalizeEndingFilter(value: string | undefined): EndingFilter {
  if (value === "critical" || value === "soon" || value === "overdue") return value;
  return "all";
}

function normalizeOccupiedSort(value: string | undefined): OccupiedSort {
  if (value === "end-desc" || value === "amount-desc") return value;
  return "end-asc";
}

function getRiskMeta(diffMinutes: number): {
  label: string;
  className: string;
} {
  if (diffMinutes < 0) {
    return {
      label: "Прострочено",
      className: "border border-rose-500/30 bg-rose-500/15 text-rose-200",
    };
  }
  if (diffMinutes <= 15) {
    return {
      label: "Критично",
      className: "border border-amber-500/30 bg-amber-500/15 text-amber-200",
    };
  }
  if (diffMinutes <= 60) {
    return {
      label: "Скоро",
      className: "border border-yellow-500/30 bg-yellow-500/15 text-yellow-200",
    };
  }
  return {
    label: "Норма",
    className: "border border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
  };
}

function formatRemaining(diffMinutes: number): string {
  if (diffMinutes < 0) return `${Math.abs(diffMinutes)} хв прострочено`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours <= 0) return `${minutes} хв`;
  return `${hours} год ${minutes} хв`;
}

function buildAdminHref(params: {
  auditSource?: "main" | "archive";
  auditLimit?: number;
  q?: string;
  type?: PcTypeFilter;
  ending?: EndingFilter;
  sort?: OccupiedSort;
}): string {
  const search = new URLSearchParams();
  if (params.auditSource) search.set("auditSource", params.auditSource);
  if (params.auditLimit) search.set("auditLimit", String(params.auditLimit));
  if (params.q) search.set("q", params.q);
  if (params.type && params.type !== "all") search.set("type", params.type);
  if (params.ending && params.ending !== "all") search.set("ending", params.ending);
  if (params.sort && params.sort !== "end-asc") search.set("sort", params.sort);
  const query = search.toString();
  return query ? `/admin?${query}` : "/admin";
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin");
  }
  if (!isAdmin(session.user.email)) {
    redirect("/");
  }

  await connectDB();

  const [computers, totalItems, freeCount, occupiedCount, repairItemsCount] =
    await Promise.all([
      Computer.find({}, "name type status pricePerHour").sort({ name: 1 }).lean(),
      Computer.countDocuments({}),
      Computer.countDocuments({ status: "вільний" }),
      Computer.countDocuments({ status: "зайнятий" }),
      Computer.countDocuments({ status: "ремонт" }),
    ]);
  const occupiedIds = computers.filter((c) => c.status === "зайнятий").map((c) => c._id);
  const activeBookingsByComputer = await getLatestActiveBookingsByComputer(occupiedIds);

  const items: ComputerWithBooking[] = computers.map((c) => ({
    _id: c._id.toString(),
    name: c.name,
    type: c.type,
    status: c.status,
    pricePerHour: c.pricePerHour,
    booking: activeBookingsByComputer.get(c._id.toString()) ?? null,
  }));

  const occupiedItems = items.filter((i) => i.status === "зайнятий");
  const freeItems = items.filter((i) => i.status !== "зайнятий");
  const occupancyPercent =
    totalItems > 0 ? Math.round((occupiedCount / totalItems) * 100) : 0;
  const sp = (await searchParams) ?? {};
  const query = sp.q?.trim() ?? "";
  const queryLower = query.toLowerCase();
  const typeFilter = normalizePcTypeFilter(sp.type);
  const endingFilter = normalizeEndingFilter(sp.ending);
  const occupiedSort = normalizeOccupiedSort(sp.sort);
  const auditSource = normalizeAuditSource(sp.auditSource);
  const auditLimit = normalizeAuditLimit(sp.auditLimit);
  const nowTs = Date.now();
  const occupiedViewRows = occupiedItems
    .filter((row) => {
      if (typeFilter !== "all" && row.type !== typeFilter) return false;
      if (!queryLower) return true;
      const pcName = row.name.toLowerCase();
      const clientName = row.booking?.clientName?.toLowerCase() ?? "";
      return pcName.includes(queryLower) || clientName.includes(queryLower);
    })
    .map((row) => {
      const endTs = row.booking ? new Date(row.booking.endTime).getTime() : nowTs;
      const diffMinutes = Math.floor((endTs - nowTs) / 60000);
      return {
        ...row,
        diffMinutes,
      };
    })
    .filter((row) => {
      if (endingFilter === "overdue") return row.diffMinutes < 0;
      if (endingFilter === "critical") return row.diffMinutes >= 0 && row.diffMinutes <= 15;
      if (endingFilter === "soon") return row.diffMinutes > 15 && row.diffMinutes <= 60;
      return true;
    })
    .sort((a, b) => {
      if (occupiedSort === "end-desc") return b.diffMinutes - a.diffMinutes;
      if (occupiedSort === "amount-desc") {
        const amountA = a.booking?.totalAmount ?? 0;
        const amountB = b.booking?.totalAmount ?? 0;
        return amountB - amountA;
      }
      return a.diffMinutes - b.diffMinutes;
    });

  const commonParams = {
    auditSource,
    auditLimit,
    q: query,
    type: typeFilter,
    ending: endingFilter,
    sort: occupiedSort,
  } as const;

  const overdueCount = occupiedItems.filter((row) => {
    if (!row.booking) return false;
    return new Date(row.booking.endTime).getTime() < nowTs;
  }).length;
  const criticalCount = occupiedItems.filter((row) => {
    if (!row.booking) return false;
    const diff = Math.floor((new Date(row.booking.endTime).getTime() - nowTs) / 60000);
    return diff >= 0 && diff <= 15;
  }).length;
  const auditLogsRaw = await (auditSource === "archive"
    ? AuditLogArchive.find({}).sort({ createdAt: -1 }).limit(auditLimit).lean()
    : AuditLog.find({}).sort({ createdAt: -1 }).limit(auditLimit).lean());
  const auditItems: AuditItem[] = auditLogsRaw.map((a) => ({
    _id: a._id.toString(),
    action: a.action,
    actorRole: a.actorRole,
    actorEmail: a.actorEmail,
    createdAt:
      "sourceCreatedAt" in a && a.sourceCreatedAt
        ? a.sourceCreatedAt
        : a.createdAt,
  }));

  const formatTime = (d: Date) =>
    new Date(d).toLocaleTimeString("uk-UA", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const formatDate = (d: Date) =>
    new Date(d).toLocaleDateString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const occupancyLabel =
    occupancyPercent >= 90
      ? "Критичне завантаження"
      : occupancyPercent >= 75
        ? "Високе завантаження"
        : occupancyPercent >= 50
          ? "Робочий режим"
          : "Помірне завантаження";

  const typeFilters: Array<{ id: PcTypeFilter; label: string }> = [
    { id: "all", label: "Всі типи" },
    { id: "VIP", label: "VIP" },
    { id: "Standard", label: "Standard" },
    { id: "PS5", label: "PS5" },
  ];

  const urgencyFilters: Array<{ id: EndingFilter; label: string }> = [
    { id: "all", label: "Всі" },
    { id: "critical", label: "До 15 хв" },
    { id: "soon", label: "15-60 хв" },
    { id: "overdue", label: "Прострочені" },
  ];

  const sortOptions: Array<{ id: OccupiedSort; label: string }> = [
    { id: "end-asc", label: "Кінець: ближче" },
    { id: "end-desc", label: "Кінець: далі" },
    { id: "amount-desc", label: "Сума: більша" },
  ];

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <header className="mb-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                ADMIN CONTROL
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight md:text-3xl">
                Панель керування залом
              </h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                Керуйте активними сесіями, контролюйте ризики та відстежуйте аудит подій.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wide text-[var(--accent-text)]">Стан залу</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{occupancyLabel}</p>
              <p className="text-xs text-[var(--text-muted)]">Завантаження: {occupancyPercent}%</p>
            </div>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Всього ПК</p>
              <MonitorCog className="h-4 w-4 text-cyan-300" />
            </div>
            <p className="mt-2 text-3xl font-black">{totalItems}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-emerald-200">Вільні</p>
              <MonitorPlay className="h-4 w-4 text-emerald-300" />
            </div>
            <p className="mt-2 text-3xl font-black text-emerald-100">{freeCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-amber-200">Зайняті</p>
              <Activity className="h-4 w-4 text-amber-300" />
            </div>
            <p className="mt-2 text-3xl font-black text-amber-100">{occupiedCount}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-rose-200">У ремонті</p>
              <MonitorOff className="h-4 w-4 text-rose-300" />
            </div>
            <p className="mt-2 text-3xl font-black text-rose-100">{repairItemsCount}</p>
          </div>
        </section>

        <section className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-rose-200">Прострочені сесії</p>
              <Siren className="h-4 w-4 text-rose-300" />
            </div>
            <p className="mt-2 text-2xl font-black text-rose-100">{overdueCount}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-amber-200">До завершення 15 хв</p>
              <TriangleAlert className="h-4 w-4 text-amber-300" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-100">{criticalCount}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-muted)]">Поточний фільтр</p>
              <Shield className="h-4 w-4 text-[var(--accent-text)]" />
            </div>
            <p className="mt-2 text-2xl font-black">{occupiedViewRows.length}</p>
            <p className="text-xs text-[var(--text-muted)]">з {occupiedItems.length} зайнятих місць</p>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="xl:col-span-2">
            <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-4 backdrop-blur-xl md:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Активні сесії</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Керування зайнятими місцями в реальному часі
                  </p>
                </div>
                <span className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-text)]">
                  {occupiedViewRows.length} / {occupiedItems.length}
                </span>
              </div>

              <div className="mb-4 space-y-3">
                <form action="/admin" method="get" className="flex flex-col gap-2 md:flex-row">
                  <input type="hidden" name="auditSource" value={auditSource} />
                  <input type="hidden" name="auditLimit" value={auditLimit} />
                  {typeFilter !== "all" && <input type="hidden" name="type" value={typeFilter} />}
                  {endingFilter !== "all" && <input type="hidden" name="ending" value={endingFilter} />}
                  {occupiedSort !== "end-asc" && <input type="hidden" name="sort" value={occupiedSort} />}
                  <label className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      name="q"
                      defaultValue={query}
                      placeholder="Пошук: назва ПК або клієнт"
                      className="w-full rounded-xl border border-[var(--border-soft)] bg-black/20 py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-border)]"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-text)] transition hover:brightness-110"
                  >
                    Застосувати
                  </button>
                </form>

                <div className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-black/15 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                      <MonitorCog className="h-3.5 w-3.5" />
                      Тип
                    </span>
                    {typeFilters.map((filter) => (
                      <Link
                        key={filter.id}
                        href={buildAdminHref({ ...commonParams, type: filter.id })}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          typeFilter === filter.id
                            ? "border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                            : "border border-[var(--border-soft)] bg-transparent text-[var(--text-muted)] hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {filter.label}
                      </Link>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                      <TriangleAlert className="h-3.5 w-3.5" />
                      Терміновість
                    </span>
                    {urgencyFilters.map((filter) => (
                      <Link
                        key={filter.id}
                        href={buildAdminHref({ ...commonParams, ending: filter.id })}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          endingFilter === filter.id
                            ? "border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                            : "border border-[var(--border-soft)] bg-transparent text-[var(--text-muted)] hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {filter.label}
                      </Link>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      Сортування
                    </span>
                    {sortOptions.map((option) => (
                      <Link
                        key={option.id}
                        href={buildAdminHref({ ...commonParams, sort: option.id })}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          occupiedSort === option.id
                            ? "border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                            : "border border-[var(--border-soft)] bg-transparent text-[var(--text-muted)] hover:border-[var(--accent-border)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {option.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-black/25 text-xs uppercase tracking-wide text-[var(--text-muted)]">
                    <tr>
                      <th className="px-4 py-3">ПК</th>
                      <th className="px-4 py-3">Клієнт</th>
                      <th className="px-4 py-3">Проміжок</th>
                      <th className="px-4 py-3">Сума</th>
                      <th className="px-4 py-3">Ризик</th>
                      <th className="px-4 py-3">Залишок</th>
                      <th className="px-4 py-3 text-right">Дія</th>
                    </tr>
                  </thead>
                  <tbody>
                    {occupiedViewRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                          За поточними фільтрами немає активних сесій
                        </td>
                      </tr>
                    ) : (
                      occupiedViewRows.map((row) => {
                        const risk = getRiskMeta(row.diffMinutes);
                        return (
                          <tr key={row._id} className="border-t border-[var(--border-soft)]/70">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-[var(--text-primary)]">{row.name}</p>
                              <p className="text-xs text-[var(--text-muted)]">{row.type}</p>
                            </td>
                            <td className="px-4 py-3 text-[var(--text-primary)]">
                              {row.booking?.clientName ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                              {row.booking
                                ? `${formatDate(row.booking.startTime)} ${formatTime(row.booking.startTime)} - ${formatDate(row.booking.endTime)} ${formatTime(row.booking.endTime)}`
                                : "—"}
                            </td>
                            <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                              {row.booking ? `${row.booking.totalAmount} грн` : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${risk.className}`}>
                                {risk.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs font-medium text-[var(--text-primary)]">
                              {formatRemaining(row.diffMinutes)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <AdminPCAction computerId={row._id} computerName={row.name} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-4 backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Вільні та сервісні місця
                </h2>
                <span className="rounded-full border border-[var(--border-soft)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                  {freeItems.length}
                </span>
              </div>
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {freeItems.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">Немає вільних або сервісних місць</p>
                ) : (
                  freeItems.map((row) => (
                    <div
                      key={row._id}
                      className="rounded-xl border border-[var(--border-soft)] bg-black/20 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{row.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {row.type} · {row.pricePerHour} грн/год
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            row.status === "вільний"
                              ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
                              : "border border-rose-500/30 bg-rose-500/15 text-rose-200"
                          }`}
                        >
                          {row.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-4 backdrop-blur-xl">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  <Archive className="h-4 w-4" />
                  Audit Log
                </h2>
                <div className="flex items-center gap-2">
                  <Link
                    href={buildAdminHref({ ...commonParams, auditSource: "main" })}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      auditSource === "main"
                        ? "border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                        : "border border-[var(--border-soft)] text-[var(--text-muted)]"
                    }`}
                  >
                    Main
                  </Link>
                  <Link
                    href={buildAdminHref({ ...commonParams, auditSource: "archive" })}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      auditSource === "archive"
                        ? "border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                        : "border border-[var(--border-soft)] text-[var(--text-muted)]"
                    }`}
                  >
                    Archive
                  </Link>
                </div>
              </div>

              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Ліміт
                </span>
                {[10, 25, 50].map((limit) => (
                  <Link
                    key={limit}
                    href={buildAdminHref({ ...commonParams, auditLimit: limit })}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      auditLimit === limit
                        ? "border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                        : "border border-[var(--border-soft)] text-[var(--text-muted)]"
                    }`}
                  >
                    {limit}
                  </Link>
                ))}
              </div>

              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {auditItems.length === 0 ? (
                  <p className="rounded-xl border border-[var(--border-soft)] bg-black/20 px-3 py-4 text-sm text-[var(--text-muted)]">
                    Подій поки немає
                  </p>
                ) : (
                  auditItems.map((row) => (
                    <div
                      key={row._id}
                      className="rounded-xl border border-[var(--border-soft)] bg-black/20 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{row.action}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            row.actorRole === "admin"
                              ? "border border-violet-500/30 bg-violet-500/15 text-violet-200"
                              : row.actorRole === "system"
                                ? "border border-slate-500/30 bg-slate-500/15 text-slate-200"
                                : "border border-cyan-500/30 bg-cyan-500/15 text-cyan-200"
                          }`}
                        >
                          {row.actorRole}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {row.actorEmail ?? "—"} ·{" "}
                        {row.createdAt ? `${formatDate(row.createdAt)} ${formatTime(row.createdAt)}` : "—"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
