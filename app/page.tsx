import LiveMap from "@/components/LiveMap";
import PersonalizedHomePanel from "@/components/PersonalizedHomePanel";
import {
  Clock3,
  Cpu,
  Crown,
  Gamepad2,
  MapPinned,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { fetchTariffs } from "@/lib/tariffs";

const tariffMeta: Record<string, { icon: LucideIcon; note: string; label: string }> = {
  Standard: {
    icon: Cpu,
    label: "Standard",
    note: "RTX 4060 · 240Hz · Механіка",
  },
  VIP: {
    icon: Crown,
    label: "VIP",
    note: "RTX 4090 · Преміум зона · Максимум комфорту",
  },
  PS5: {
    icon: Gamepad2,
    label: "PS5",
    note: "DualSense · 4K HDR · PS Plus",
  },
};
const defaultTariffs = [
  { type: "Standard", pricePerHour: 50 },
  { type: "VIP", pricePerHour: 100 },
  { type: "PS5", pricePerHour: 80 },
];

const quickCards = [
  {
    title: "Жива карта",
    subtitle: "Статуси ПК в реальному часі",
    icon: MapPinned,
    href: "#live-map",
    accent: "hover:border-[var(--accent-border)]",
  },
  {
    title: "Миттєве бронювання",
    subtitle: "Клік по вільному місцю і підтвердження",
    icon: Zap,
    href: "#live-map",
    accent: "hover:border-[var(--accent-border)]",
  },
  {
    title: "Профіль гравця",
    subtitle: "Історія та активні сесії",
    icon: ShieldCheck,
    href: "/profile",
    accent: "hover:border-[var(--accent-border)]",
  },
];

export default async function Home() {
  const tariffsData = await fetchTariffs().catch(() => []);
  const tariffs = (tariffsData.length > 0 ? tariffsData : defaultTariffs).map((tariff) => {
    const meta = tariffMeta[tariff.type] ?? {
      icon: Cpu,
      label: tariff.type,
      note: "Преміальна конфігурація",
    };
    return {
      name: meta.label,
      price: `${tariff.pricePerHour} грн/год`,
      icon: meta.icon,
      note: meta.note,
    };
  });

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--text-primary)]">
      <div
        className="bg-grid-overlay pointer-events-none fixed inset-0 opacity-[0.06]"
      />
      <div className="bg-hero-radial pointer-events-none fixed inset-0" />

      <section className="relative mx-auto max-w-7xl px-4 pb-8 pt-8 md:pb-12 md:pt-12">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-6 backdrop-blur-xl lg:col-span-7 lg:p-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-text)]">
              <Clock3 className="h-3.5 w-3.5" />
              Online режим 24/7
            </p>
            <h1 className="mt-4 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-4xl font-black tracking-tight text-transparent md:text-6xl">
              GAME-X: ТВОЯ АРЕНА
            </h1>
            <p className="mt-4 max-w-2xl text-sm text-[var(--text-muted)] md:text-base">
              Преміум залізо, атмосфера турніру і швидке бронювання без зайвих кроків.
              Це одночасно промо-сторінка та робочий інструмент для бронювання.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#live-map"
                className="rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-6 py-3 text-sm font-bold text-[var(--accent-text)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_26px_rgba(56,189,248,0.22)]"
              >
                Обрати ПК
              </a>
              <a
                href="#tariffs"
                className="rounded-full border border-[var(--border-soft)] bg-[var(--panel-bg)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] transition-all duration-300 hover:border-[var(--accent-border)]"
              >
                Переглянути тарифи
              </a>
            </div>

            <PersonalizedHomePanel />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:col-span-5">
            {quickCards.map((card) => {
              const Icon = card.icon;
              return (
                <a
                  key={card.title}
                  href={card.href}
                  className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 ${card.accent}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-2.5">
                      <Icon className="h-4 w-4 text-[var(--accent-text)]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{card.title}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{card.subtitle}</p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section id="live-map" className="relative mx-auto max-w-7xl px-4 pb-8 pt-2 md:pb-12">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)] md:text-3xl">
            ТАКТИЧНИЙ РАДАР ЗАЛУ
          </h2>
        </div>
        <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--panel-bg-strong)] p-1 shadow-2xl shadow-black/40 lg:p-4">
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-4 backdrop-blur-xl lg:p-6">
            <LiveMap />
          </div>
        </div>
      </section>

      <section id="tariffs" className="mx-auto max-w-7xl px-4 pb-16 pt-6 md:pt-8">
        <h2 className="mb-6 text-2xl font-black text-[var(--text-primary)] md:text-3xl">ПРЕМІУМ ТАРИФИ</h2>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {tariffs.map((tariff) => {
            const Icon = tariff.icon;
            return (
              <article
                key={tariff.name}
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:border-[var(--accent-border)] hover:shadow-[0_0_22px_rgba(56,189,248,0.14)]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-[var(--text-primary)]">{tariff.name}</h3>
                  <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--panel-bg)] p-2">
                    <Icon className="h-4 w-4 text-[var(--accent-text)]" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-black text-[var(--accent-text)]">{tariff.price}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{tariff.note}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
