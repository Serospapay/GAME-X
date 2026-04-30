import Image from "next/image";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { buildBookingOwnerQuery } from "@/lib/booking-owner";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";

interface ProfilePageProps {
  searchParams?: Promise<{
    q?: string;
    period?: string;
    sort?: string;
  }>;
}

type PeriodFilter = "all" | "7" | "30" | "90";
type HistorySort = "end-desc" | "end-asc" | "amount-desc" | "amount-asc";

function normalizePeriod(value: string | undefined): PeriodFilter {
  if (value === "7" || value === "30" || value === "90") return value;
  return "all";
}

function normalizeSort(value: string | undefined): HistorySort {
  if (value === "end-asc" || value === "amount-desc" || value === "amount-asc") return value;
  return "end-desc";
}

function buildProfileHref(params: {
  q?: string;
  period?: PeriodFilter;
  sort?: HistorySort;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.period && params.period !== "all") search.set("period", params.period);
  if (params.sort && params.sort !== "end-desc") search.set("sort", params.sort);
  const query = search.toString();
  return query ? `/profile?${query}` : "/profile";
}

function formatRemaining(diffMinutes: number): string {
  if (diffMinutes < 0) {
    const abs = Math.abs(diffMinutes);
    return `прострочено на ${abs} хв`;
  }
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours === 0) return `${minutes} хв`;
  return `${hours} год ${minutes} хв`;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  await connectDB();

  const bookingOwnerQuery = buildBookingOwnerQuery({
    userId: session.user.id,
    email: session.user.email,
  });

  const [activeBookings, completedBookings] = await Promise.all([
    Booking.find({ ...bookingOwnerQuery, isCompleted: { $ne: true } })
      .sort({ startTime: -1 })
      .limit(10)
      .populate("computer", "name type pricePerHour")
      .lean(),
    Booking.find({ ...bookingOwnerQuery, isCompleted: true })
      .sort({ endTime: -1 })
      .limit(80)
      .populate("computer", "name type")
      .lean(),
  ]);
  const activeCount = activeBookings.length;
  const completedCount = completedBookings.length;
  const totalSpent = completedBookings.reduce((sum, b) => sum + b.totalAmount, 0);
  const nearestActiveEnd =
    activeBookings.length > 0
      ? activeBookings.reduce((nearest, current) =>
          new Date(current.endTime).getTime() < new Date(nearest.endTime).getTime()
            ? current
            : nearest
        )
      : null;
  const sp = (await searchParams) ?? {};
  const query = sp.q?.trim() ?? "";
  const queryLower = query.toLowerCase();
  const period = normalizePeriod(sp.period);
  const historySort = normalizeSort(sp.sort);
  const nowTs = Date.now();
  const periodMinTs =
    period === "all" ? null : nowTs - Number.parseInt(period, 10) * 24 * 60 * 60 * 1000;

  const completedView = completedBookings
    .filter((b) => {
      if (periodMinTs !== null) {
        const endTs = new Date(b.endTime).getTime();
        if (endTs < periodMinTs) return false;
      }
      if (!queryLower) return true;
      const pc = b.computer as { name?: string; type?: string } | null;
      const text = `${pc?.name ?? ""} ${pc?.type ?? ""}`.toLowerCase();
      return text.includes(queryLower);
    })
    .sort((a, b) => {
      if (historySort === "end-asc") {
        return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
      }
      if (historySort === "amount-desc") {
        return b.totalAmount - a.totalAmount;
      }
      if (historySort === "amount-asc") {
        return a.totalAmount - b.totalAmount;
      }
      return new Date(b.endTime).getTime() - new Date(a.endTime).getTime();
    });
  const completedViewTotal = completedView.reduce((sum, b) => sum + b.totalAmount, 0);
  const completedViewAvg =
    completedView.length > 0 ? Math.round(completedViewTotal / completedView.length) : 0;
  const activeRiskCounts = activeBookings.reduce(
    (acc, b) => {
      const diff = Math.floor((new Date(b.endTime).getTime() - nowTs) / 60000);
      if (diff < 0) acc.overdue += 1;
      else if (diff <= 15) acc.critical += 1;
      else if (diff <= 60) acc.soon += 1;
      else acc.normal += 1;
      return acc;
    },
    { overdue: 0, critical: 0, soon: 0, normal: 0 }
  );

  const formatDate = (d: Date) =>
    new Date(d).toLocaleString("uk-UA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-white">Особистий кабінет</h1>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Активні</p>
          <p className="mt-1 text-2xl font-semibold text-cyan-300">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Завершені</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {completedView.length} / {completedCount}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Витрачено (загалом)</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-300">{totalSpent} грн</p>
        </div>
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Найближчий кінець</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {nearestActiveEnd ? formatDate(nearestActiveEnd.endTime) : "Немає активної сесії"}
          </p>
        </div>
      </section>

      <section className="mb-8 flex flex-wrap gap-3">
        <Link
          href="/#live-map"
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
        >
          До живої карти
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-neutral-700"
        >
          На головну
        </Link>
        {session.user.isAdmin && (
          <Link
            href="/admin"
            className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-semibold text-purple-200 transition hover:bg-purple-500/20"
          >
            До панелі керування
          </Link>
        )}
      </section>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-4">
          <p className="text-xs uppercase tracking-wide text-rose-300">Прострочені активні</p>
          <p className="mt-1 text-2xl font-semibold text-rose-200">{activeRiskCounts.overdue}</p>
        </div>
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-300">До 15 хв</p>
          <p className="mt-1 text-2xl font-semibold text-amber-200">{activeRiskCounts.critical}</p>
        </div>
        <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/5 p-4">
          <p className="text-xs uppercase tracking-wide text-yellow-300">15-60 хв</p>
          <p className="mt-1 text-2xl font-semibold text-yellow-200">{activeRiskCounts.soon}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-300">Історія: середній чек</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-200">{completedViewAvg} грн</p>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-neutral-700 bg-neutral-900/60 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Профіль</h2>
        <div className="flex items-center gap-4">
          {session.user.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name ? `Аватар ${session.user.name}` : "Аватар користувача"}
              className="h-16 w-16 rounded-full"
              width={64}
              height={64}
              unoptimized
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-700 text-2xl font-medium text-white">
              {session.user.name?.[0] ?? "?"}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-white">{session.user.name}</p>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  session.user.isAdmin
                    ? "border-purple-500/50 bg-purple-500/10 text-purple-200"
                    : "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                }`}
              >
                {session.user.isAdmin ? "Адміністратор" : "Користувач"}
              </span>
            </div>
            <p className="text-sm text-neutral-400">{session.user.email}</p>
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Активні сесії
        </h2>
        {activeBookings.length === 0 ? (
          <p className="text-neutral-400">Зараз немає активних сесій</p>
        ) : (
          <ul className="space-y-3">
            {activeBookings.map((b) => {
              const pc = b.computer as { name?: string; type?: string; pricePerHour?: number } | null;
              const diffMinutes = Math.floor(
                (new Date(b.endTime).getTime() - nowTs) / 60000
              );
              return (
                <li
                  key={b._id.toString()}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-500/20 bg-neutral-800/50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-white">
                      {pc?.name ?? "ПК"} ({pc?.type ?? "—"})
                    </p>
                    <p className="text-sm text-neutral-400">
                      {formatDate(b.startTime)} — до {formatDate(b.endTime)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-cyan-400">{b.totalAmount} грн</p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        diffMinutes < 0
                          ? "bg-rose-500/20 text-rose-200"
                          : diffMinutes <= 15
                            ? "bg-amber-500/20 text-amber-200"
                            : diffMinutes <= 60
                              ? "bg-yellow-500/20 text-yellow-200"
                              : "bg-emerald-500/20 text-emerald-200"
                      }`}
                    >
                      {formatRemaining(diffMinutes)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            Історія бронювань ({completedView.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(["all", "7", "30", "90"] as const).map((periodValue) => (
              <Link
                key={periodValue}
                href={buildProfileHref({ q: query, period: periodValue, sort: historySort })}
                className={`rounded-md px-3 py-1.5 font-semibold ${
                  period === periodValue
                    ? "bg-cyan-600 text-white"
                    : "bg-neutral-800 text-neutral-300 ring-1 ring-neutral-700"
                }`}
              >
                {periodValue === "all" ? "Весь час" : `${periodValue} днів`}
              </Link>
            ))}
          </div>
        </div>
        <div className="mb-4 grid gap-2 lg:grid-cols-2">
          <form className="lg:col-span-1" action="/profile" method="get">
            {period !== "all" && <input type="hidden" name="period" value={period} />}
            {historySort !== "end-desc" && <input type="hidden" name="sort" value={historySort} />}
            <div className="flex gap-2">
              <input
                name="q"
                defaultValue={query}
                placeholder="Пошук в історії: ПК або тип"
                className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-cyan-500"
              />
              <button
                type="submit"
                className="rounded-md bg-neutral-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-neutral-600"
              >
                Пошук
              </button>
            </div>
          </form>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {([
              { id: "end-desc", label: "Новіші" },
              { id: "end-asc", label: "Старіші" },
              { id: "amount-desc", label: "Сума: більша" },
              { id: "amount-asc", label: "Сума: менша" },
            ] as const).map((sortOption) => (
              <Link
                key={sortOption.id}
                href={buildProfileHref({
                  q: query,
                  period,
                  sort: sortOption.id,
                })}
                className={`rounded-md px-3 py-1.5 font-semibold ${
                  historySort === sortOption.id
                    ? "bg-cyan-600 text-white"
                    : "bg-neutral-800 text-neutral-300 ring-1 ring-neutral-700"
                }`}
              >
                {sortOption.label}
              </Link>
            ))}
          </div>
        </div>
        {completedView.length === 0 ? (
          <p className="text-neutral-500">Поки що немає завершених сесій</p>
        ) : (
          <ul className="space-y-3">
            {completedView.map((b) => {
              const pc = b.computer as { name?: string; type?: string } | null;
              return (
              <li
                key={b._id.toString()}
                className="flex justify-between rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-white">
                    {pc?.name ?? "ПК"} ({pc?.type ?? "—"})
                  </p>
                  <p className="text-sm text-neutral-400">
                    {formatDate(b.startTime)} — {formatDate(b.endTime)}
                  </p>
                </div>
                <p className="font-medium text-white">{b.totalAmount} грн</p>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
