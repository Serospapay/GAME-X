import Link from "next/link";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#05050a]">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="text-xl font-black tracking-wide text-white">Game-X</p>
          <p className="mt-3 max-w-sm text-sm text-neutral-400">
            Кіберспортивна арена з живою картою місць, швидким бронюванням і
            прозорими тарифами.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
            Навігація
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link className="text-neutral-400 transition hover:text-white" href="/">
                Головна
              </Link>
            </li>
            <li>
              <Link
                className="text-neutral-400 transition hover:text-white"
                href="/#live-map"
              >
                Карта залу
              </Link>
            </li>
            <li>
              <Link
                className="text-neutral-400 transition hover:text-white"
                href="/#tariffs"
              >
                Тарифи
              </Link>
            </li>
            <li>
              <Link
                className="text-neutral-400 transition hover:text-white"
                href="/profile"
              >
                Профіль
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
            Інформація
          </p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-400">
            <li>Щодня: 10:00 - 02:00</li>
            <li>м. Київ, вул. Кіберспортна, 21</li>
            <li>+380 67 000 00 00</li>
            <li>support@game-x.club</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 text-xs text-neutral-500">
          © {year} Game-X. Усі права захищені.
        </div>
      </div>
    </footer>
  );
}
