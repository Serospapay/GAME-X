"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

type ComputerType = "VIP" | "Standard" | "PS5";
type ComputerStatus = "вільний" | "зайнятий" | "ремонт";

export interface BookingComputer {
  _id: string;
  name: string;
  type: ComputerType;
  status: ComputerStatus;
  pricePerHour: number;
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  computer: BookingComputer | null;
  onSuccess?: () => void;
}

const MIN_HOURS = 1;
const MAX_HOURS = 12;

function SpinnerIcon() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default function BookingModal({
  isOpen,
  onClose,
  computer,
  onSuccess,
}: BookingModalProps) {
  const { data: session } = useSession();
  const [hours, setHours] = useState<number>(MIN_HOURS);
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isGuest = !session?.user;

  const totalAmount = computer ? hours * computer.pricePerHour : 0;

  const resetForm = useCallback(() => {
    setHours(MIN_HOURS);
    setClientName("");
    setSubmitError(null);
  }, []);

  useEffect(() => {
    if (!isOpen) resetForm();
  }, [isOpen, resetForm]);

  const handleClose = useCallback(() => {
    if (!loading) {
      resetForm();
      onClose();
    }
  }, [loading, onClose, resetForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!computer || loading) return;
    if (hours < MIN_HOURS || hours > MAX_HOURS) return;
    if (isGuest && !clientName.trim()) {
      setSubmitError("Введіть ваше ім'я для бронювання");
      return;
    }

    setLoading(true);
    setSubmitError(null);

    const nameToSend = isGuest ? (clientName.trim() || "Гість") : undefined;

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          computerId: computer._id,
          hours,
          ...(nameToSend !== undefined && { clientName: nameToSend }),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.error ?? "Помилка бронювання";
        setSubmitError(msg);
        toast.error(`Помилка: ${msg}`);
        return;
      }

      toast.success("ПК успішно заброньовано!");
      handleClose();
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Помилка з'єднання";
      setSubmitError(msg);
      toast.error(`Помилка: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  if (!computer) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-neutral-900/95 shadow-2xl shadow-cyan-500/10"
          >
            <div className="p-6">
              <h2
                id="booking-modal-title"
                className="text-xl font-bold text-white"
              >
                Бронювання: {computer.name}
              </h2>
              <p className="mt-1 text-sm text-neutral-400">
                {computer.pricePerHour} грн/год
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                {isGuest && (
                  <div>
                    <label
                      htmlFor="booking-client-name"
                      className="block text-sm font-medium text-neutral-300"
                    >
                      Ваше ім'я
                    </label>
                    <input
                      id="booking-client-name"
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Введіть ім'я"
                      maxLength={100}
                      className="mt-2 w-full rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-2.5 text-white placeholder-neutral-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      disabled={loading}
                    />
                  </div>
                )}
                <div>
                  <label
                    htmlFor="booking-hours"
                    className="block text-sm font-medium text-neutral-300"
                  >
                    Кількість годин
                  </label>
                  <input
                    id="booking-hours"
                    type="number"
                    min={MIN_HOURS}
                    max={MAX_HOURS}
                    value={hours}
                    onChange={(e) =>
                      setHours(
                        Math.min(
                          MAX_HOURS,
                          Math.max(MIN_HOURS, parseInt(e.target.value, 10) || MIN_HOURS)
                        )
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-2.5 text-white placeholder-neutral-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-neutral-500">
                    Від {MIN_HOURS} до {MAX_HOURS} годин
                  </p>
                </div>

                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
                  <p className="text-sm text-neutral-400">Загальна вартість</p>
                  <p className="text-2xl font-bold text-cyan-400">
                    {totalAmount} грн
                  </p>
                </div>

                {submitError && (
                  <p className="text-sm text-red-400">{submitError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={loading}
                    className="flex-1 rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-2.5 font-medium text-neutral-300 transition hover:bg-neutral-700 disabled:opacity-50"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 font-medium text-neutral-900 transition hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading && <SpinnerIcon />}
                    {loading ? "Збереження…" : "Підтвердити бронювання"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
