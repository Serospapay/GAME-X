import Link from "next/link";
import AuthButton from "@/components/AuthButton";
import AdminQuickLink from "@/components/AdminQuickLink";
import ThemeToggle from "@/components/ThemeToggle";

const navItems = [
  { href: "/", label: "Головна" },
  { href: "/#live-map", label: "Карта залу" },
  { href: "/#tariffs", label: "Тарифи" },
  { href: "/profile", label: "Профіль" },
];

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-soft)] bg-[var(--panel-bg-strong)]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
        <Link
          href="/"
          className="inline-flex items-center rounded-lg px-1 py-1 text-lg font-black tracking-wide text-[var(--text-primary)] transition hover:text-[var(--accent-text)]"
        >
          Game-X
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-white/5 hover:text-[var(--text-primary)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AdminQuickLink />
          <Link
            href="/#live-map"
            className="hidden rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent-text)] transition hover:shadow-[0_0_18px_rgba(56,189,248,0.24)] sm:inline-flex"
          >
            Обрати ПК
          </Link>
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
