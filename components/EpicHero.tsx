"use client";

export default function EpicHero() {
  const scrollToMap = () => {
    document.getElementById("booking-map")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
      <h1 className="text-6xl font-black tracking-tight md:text-7xl lg:text-8xl">
        <span className="bg-gradient-to-r from-cyan-400 via-purple-500 to-purple-600 bg-clip-text text-transparent">
          Game-X
        </span>
      </h1>
      <p className="mt-4 text-xl text-neutral-400 md:text-2xl">
        Твоя територія кіберспорту
      </p>
      <button
        type="button"
        onClick={scrollToMap}
        className="mt-12 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-500 px-12 py-5 text-lg font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] active:scale-95"
      >
        Забронювати ПК
      </button>
    </section>
  );
}
