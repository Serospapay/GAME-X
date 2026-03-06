import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { connectDB } from "@/lib/mongodb";
import { Computer } from "@/models/Computer";
import { Booking } from "@/models/Booking";
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

  const computers = await Computer.find({}).lean();
  const occupiedIds = computers
    .filter((c) => c.status === "зайнятий")
    .map((c) => c._id);

  const activeBookings = await Booking.find({
    computer: { $in: occupiedIds },
    isCompleted: { $ne: true },
  })
    .sort({ startTime: -1 })
    .lean();

  const bookingByComputer = new Map<string, BookingDoc>();
  for (const b of activeBookings) {
    const cid = b.computer.toString();
    if (!bookingByComputer.has(cid)) {
      bookingByComputer.set(cid, {
        _id: b._id.toString(),
        clientName: b.clientName,
        startTime: b.startTime,
        endTime: b.endTime,
        totalAmount: b.totalAmount,
      });
    }
  }

  const items: ComputerWithBooking[] = computers.map((c) => ({
    _id: c._id.toString(),
    name: c.name,
    type: c.type,
    status: c.status,
    pricePerHour: c.pricePerHour,
    booking: bookingByComputer.get(c._id.toString()) ?? null,
  }));

  const occupiedItems = items.filter((i) => i.status === "зайнятий");
  const freeItems = items.filter((i) => i.status !== "зайнятий");
  const repairItemsCount = items.filter((i) => i.status === "ремонт").length;
  const totalItems = items.length;
  const occupancyPercent =
    totalItems > 0 ? Math.round((occupiedItems.length / totalItems) * 100) : 0;
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

  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="border-b border-neutral-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-neutral-800">
          Панель керування
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Зайняті місця та активні сесії
        </p>
      </div>

      <div className="p-6">
        <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Всього ПК</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{totalItems}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Вільні</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-900">{freeItems.length}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-amber-700">Зайняті</p>
            <p className="mt-1 text-2xl font-semibold text-amber-900">{occupiedItems.length}</p>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-violet-700">
              Завантаження / Ремонт
            </p>
            <p className="mt-1 text-2xl font-semibold text-violet-900">
              {occupancyPercent}% / {repairItemsCount}
            </p>
          </div>
        </section>

        <section className="mb-8 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-rose-700">Прострочені сесії</p>
            <p className="mt-1 text-2xl font-semibold text-rose-900">{overdueCount}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-amber-700">
              Завершуються до 15 хв
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-900">{criticalCount}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Відфільтровано зайнятих
            </p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">
              {occupiedViewRows.length}
            </p>
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
              Зайняті ({occupiedViewRows.length} / {occupiedItems.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link
                href={buildAdminHref({
                  auditSource,
                  auditLimit,
                  q: query,
                  type: "all",
                  ending: endingFilter,
                  sort: occupiedSort,
                })}
                className={`rounded-md px-3 py-1.5 font-semibold ${
                  typeFilter === "all"
                    ? "bg-neutral-800 text-white"
                    : "bg-white text-neutral-700 ring-1 ring-neutral-200"
                }`}
              >
                Всі типи
              </Link>
              <Link
                href={buildAdminHref({
                  auditSource,
                  auditLimit,
                  q: query,
                  type: "VIP",
                  ending: endingFilter,
                  sort: occupiedSort,
                })}
                className={`rounded-md px-3 py-1.5 font-semibold ${
                  typeFilter === "VIP"
                    ? "bg-neutral-800 text-white"
                    : "bg-white text-neutral-700 ring-1 ring-neutral-200"
                }`}
              >
                VIP
              </Link>
              <Link
                href={buildAdminHref({
                  auditSource,
                  auditLimit,
                  q: query,
                  type: "Standard",
                  ending: endingFilter,
                  sort: occupiedSort,
                })}
                className={`rounded-md px-3 py-1.5 font-semibold ${
                  typeFilter === "Standard"
                    ? "bg-neutral-800 text-white"
                    : "bg-white text-neutral-700 ring-1 ring-neutral-200"
                }`}
              >
                Standard
              </Link>
              <Link
                href={buildAdminHref({
                  auditSource,
                  auditLimit,
                  q: query,
                  type: "PS5",
                  ending: endingFilter,
                  sort: occupiedSort,
                })}
                className={`rounded-md px-3 py-1.5 font-semibold ${
                  typeFilter === "PS5"
                    ? "bg-neutral-800 text-white"
                    : "bg-white text-neutral-700 ring-1 ring-neutral-200"
                }`}
              >
                PS5
              </Link>
            </div>
          </div>

          <div className="mb-3 grid gap-2 lg:grid-cols-3">
            <form className="lg:col-span-1" action="/admin" method="get">
              <input type="hidden" name="auditSource" value={auditSource} />
              <input type="hidden" name="auditLimit" value={auditLimit} />
              {typeFilter !== "all" && <input type="hidden" name="type" value={typeFilter} />}
              {endingFilter !== "all" && <input type="hidden" name="ending" value={endingFilter} />}
              {occupiedSort !== "end-asc" && <input type="hidden" name="sort" value={occupiedSort} />}
              <div className="flex gap-2">
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Пошук: ПК або клієнт"
                  className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-neutral-500"
                />
                <button
                  type="submit"
                  className="rounded-md bg-neutral-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
                >
                  Знайти
                </button>
              </div>
            </form>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-neutral-500">Терміновість:</span>
              {(["all", "critical", "soon", "overdue"] as const).map((value) => (
                <Link
                  key={value}
                  href={buildAdminHref({
                    auditSource,
                    auditLimit,
                    q: query,
                    type: typeFilter,
                    ending: value,
                    sort: occupiedSort,
                  })}
                  className={`rounded-md px-3 py-1.5 font-semibold ${
                    endingFilter === value
                      ? "bg-neutral-800 text-white"
                      : "bg-white text-neutral-700 ring-1 ring-neutral-200"
                  }`}
                >
                  {value === "all"
                    ? "Всі"
                    : value === "critical"
                      ? "До 15 хв"
                      : value === "soon"
                        ? "15-60 хв"
                        : "Прострочено"}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-neutral-500">Сортування:</span>
              {([
                { id: "end-asc", label: "Кінець: ближче" },
                { id: "end-desc", label: "Кінець: далі" },
                { id: "amount-desc", label: "Сума: більша" },
              ] as const).map((sortOption) => (
                <Link
                  key={sortOption.id}
                  href={buildAdminHref({
                    auditSource,
                    auditLimit,
                    q: query,
                    type: typeFilter,
                    ending: endingFilter,
                    sort: sortOption.id,
                  })}
                  className={`rounded-md px-3 py-1.5 font-semibold ${
                    occupiedSort === sortOption.id
                      ? "bg-neutral-800 text-white"
                      : "bg-white text-neutral-700 ring-1 ring-neutral-200"
                  }`}
                >
                  {sortOption.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 font-medium text-neutral-700">
                    ПК
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-700">
                    Тип
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-700">
                    Клієнт
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-700">
                    Початок
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-700">
                    Кінець
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-700">
                    Сума
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-700">
                    Ризик
                  </th>
                  <th className="px-4 py-3 font-medium text-neutral-700">
                    Дія
                  </th>
                </tr>
              </thead>
              <tbody>
                {occupiedViewRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-neutral-500"
                    >
                      Немає зайнятих місць за поточним фільтром
                    </td>
                  </tr>
                ) : (
                  occupiedViewRows.map((row) => (
                    <tr
                      key={row._id}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-neutral-800">
                        {row.name}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{row.type}</td>
                      <td className="px-4 py-3 text-neutral-600">
                        {row.booking?.clientName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {row.booking
                          ? `${formatDate(row.booking.startTime)} ${formatTime(row.booking.startTime)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {row.booking
                          ? `${formatDate(row.booking.endTime)} ${formatTime(row.booking.endTime)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {row.booking
                          ? `${row.booking.totalAmount} грн`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.diffMinutes < 0 ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                            Прострочено
                          </span>
                        ) : row.diffMinutes <= 15 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            Критично
                          </span>
                        ) : row.diffMinutes <= 60 ? (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                            Скоро
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            Норма
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AdminPCAction
                          computerId={row._id}
                          computerName={row.name}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
            Вільні та інші ({freeItems.length})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {freeItems.map((row) => (
              <div
                key={row._id}
                className="rounded-lg border border-neutral-200 bg-white px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-neutral-800">{row.name}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      row.status === "вільний"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {row.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-neutral-500">
                  {row.type} · {row.pricePerHour} грн/год
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
              Audit Log ({auditSource === "archive" ? "архів" : "основний"}, останні{" "}
              {auditItems.length})
            </h2>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin?auditSource=main&auditLimit=${auditLimit}`}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  auditSource === "main"
                    ? "bg-neutral-800 text-white"
                    : "bg-white text-neutral-700 ring-1 ring-neutral-200"
                }`}
              >
                Main
              </Link>
              <Link
                href={`/admin?auditSource=archive&auditLimit=${auditLimit}`}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  auditSource === "archive"
                    ? "bg-neutral-800 text-white"
                    : "bg-white text-neutral-700 ring-1 ring-neutral-200"
                }`}
              >
                Archive
              </Link>
              <Link
                href={`/admin?auditSource=${auditSource}&auditLimit=25`}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200"
              >
                25
              </Link>
              <Link
                href={`/admin?auditSource=${auditSource}&auditLimit=50`}
                className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200"
              >
                50
              </Link>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-4 py-3 font-medium text-neutral-700">Подія</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">Роль</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">Email</th>
                  <th className="px-4 py-3 font-medium text-neutral-700">Час</th>
                </tr>
              </thead>
              <tbody>
                {auditItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                      Подій поки немає
                    </td>
                  </tr>
                ) : (
                  auditItems.map((row) => (
                    <tr key={row._id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-3 text-neutral-700">{row.action}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            row.actorRole === "admin"
                              ? "bg-violet-100 text-violet-700"
                              : row.actorRole === "system"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-cyan-100 text-cyan-700"
                          }`}
                        >
                          {row.actorRole}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {row.actorEmail ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {row.createdAt
                          ? `${formatDate(row.createdAt)} ${formatTime(row.createdAt)}`
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
