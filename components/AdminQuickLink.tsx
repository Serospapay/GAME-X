"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function AdminQuickLink() {
  const { data: session } = useSession();

  if (!session?.user?.isAdmin) {
    return null;
  }

  return (
    <Link
      href="/admin"
      className="hidden rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2 text-sm font-medium text-[var(--accent-text)] transition hover:brightness-110 md:inline-flex"
    >
      Адмін-панель
    </Link>
  );
}
