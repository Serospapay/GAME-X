"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import BookingModal, { type BookingComputer } from "./BookingModal";
import CountdownTimer from "./CountdownTimer";

type ComputerType = "VIP" | "Standard" | "PS5";
type ComputerStatus = "вільний" | "зайнятий" | "ремонт";

interface Computer {
  _id: string;
  name: string;
  type: ComputerType;
  status: ComputerStatus;
  pricePerHour: number;
  endTime?: string;
}

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function CardSkeleton() {
  return (
    <div
      className="h-28 rounded-xl border border-white/5 bg-white/5 animate-pulse"
      aria-hidden
    />
  );
}

function PcCard({
  computer,
  onSelect,
}: {
  computer: Computer;
  onSelect: (computer: Computer) => void;
}) {
  const isFree = computer.status === "вільний";
  const isBusy = computer.status === "зайнятий";
  const isRepair = computer.status === "ремонт";
  const isVip = computer.type === "VIP";

  const borderColor = isFree
    ? "border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
    : isBusy
      ? "border-red-500/40 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
      : isRepair
        ? "border-amber-500/40 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
        : "border-white/10 bg-white/5";

  return (
    <motion.article
      variants={item}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(computer)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(computer);
        }
      }}
      className={`
        relative cursor-pointer rounded-xl border-2 p-5 transition-all duration-300
        ${borderColor}
        ${isVip ? "ring-1 ring-amber-400/50" : ""}
        ${isFree ? "hover:border-emerald-400/70 hover:shadow-[0_0_25px_rgba(16,185,129,0.2)]" : ""}
      `}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {isVip && (
        <span
          className="absolute right-3 top-3 text-amber-400"
          title="VIP"
          aria-hidden
        >
          <CrownIcon />
        </span>
      )}
      <p className="font-semibold text-white">{computer.name}</p>
      <p className="mt-1.5 text-sm text-neutral-400">
        {computer.pricePerHour} грн/год
      </p>
      <p
        className={`mt-1.5 text-xs font-medium ${
          isFree
            ? "text-emerald-400"
            : isBusy
              ? "text-red-400"
              : "text-amber-400"
        }`}
      >
        {computer.status}
      </p>
      {isBusy && computer.endTime && (
        <p className="mt-3 text-xs">
          <CountdownTimer endTime={computer.endTime} />
        </p>
      )}
    </motion.article>
  );
}

function CrownIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" />
    </svg>
  );
}

export default function LiveMap() {
  const [computers, setComputers] = useState<Computer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedComputer, setSelectedComputer] = useState<Computer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [occupiedMessage, setOccupiedMessage] = useState(false);

  const loadComputers = useCallback(async () => {
    try {
      const res = await fetch("/api/computers");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ?? "Помилка завантаження"
        );
      }
      setError(null);
      setComputers(data as Computer[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Невідома помилка";
      setError(msg);
      toast.error(`Помилка: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadComputers().then(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadComputers]);

  const handleCardSelect = useCallback((computer: Computer) => {
    if (computer.status === "вільний") {
      setSelectedComputer(computer);
      setModalOpen(true);
    } else if (computer.status === "зайнятий") {
      setOccupiedMessage(true);
      toast.error("Місце зайняте");
      setTimeout(() => setOccupiedMessage(false), 2500);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedComputer(null);
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-6 py-5 backdrop-blur-sm">
        <p className="text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setLoading(true);
            loadComputers();
          }}
          className="mt-4 rounded-lg border border-red-500/50 bg-red-500/20 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/30"
        >
          Спробувати знову
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (computers.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-6 py-6 text-center">
        <p className="text-sm text-neutral-300">
          У залі поки немає налаштованих ПК.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Оновіть сторінку або ініціалізуйте тестові дані для dev-режиму.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadComputers();
            }}
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/20"
          >
            Оновити карту
          </button>
          {process.env.NODE_ENV !== "production" && (
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                await fetch("/api/seed").catch(() => null);
                await loadComputers();
              }}
              className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-300 transition hover:bg-purple-500/20"
            >
              Заповнити тестовими даними
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {occupiedMessage && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200 backdrop-blur-sm"
          >
            Місце зайняте
          </motion.p>
        )}
      </AnimatePresence>
      <motion.section
        variants={container}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Жива карта залу"
      >
        {computers.map((computer) => (
          <PcCard
            key={computer._id}
            computer={computer}
            onSelect={handleCardSelect}
          />
        ))}
      </motion.section>
      <BookingModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        computer={selectedComputer as BookingComputer | null}
        onSuccess={loadComputers}
      />
    </>
  );
}
