"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import ConfirmModal from "./ConfirmModal";

interface AdminPCActionProps {
  computerId: string;
  computerName: string;
}

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

export default function AdminPCAction({
  computerId,
  computerName,
}: AdminPCActionProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  const handleEndSession = async () => {
    setShowConfirm(true);
  };

  const confirmEndSession = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/computers/${computerId}`, {
        method: "PATCH",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Помилка");
      }

      toast.success("ПК успішно звільнено!");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не вдалося завершити сесію";
      toast.error(`Помилка: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ConfirmModal
        isOpen={showConfirm}
        title="Завершити сесію"
        message={`Завершити сесію на ПК "${computerName}"? Статус буде змінено на "вільний".`}
        confirmLabel="Звільнити"
        cancelLabel="Скасувати"
        onConfirm={confirmEndSession}
        onCancel={() => setShowConfirm(false)}
        variant="danger"
      />
      <button
      type="button"
      onClick={handleEndSession}
      disabled={loading}
      className="flex items-center gap-2 rounded-md border border-neutral-600 bg-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 transition hover:bg-neutral-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading && <SpinnerIcon />}
      {loading ? "Звільнення…" : "Звільнити ПК"}
    </button>
    </>
  );
}
