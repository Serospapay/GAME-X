"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function AuthButton() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") {
    return (
      <div className="h-9 w-24 animate-pulse rounded-lg bg-neutral-700" />
    );
  }

  if (!session?.user) {
    return (
      <Link
        href="/auth/signin"
        className="inline-flex rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
      >
        Увійти
      </Link>
    );
  }

  const user = session.user;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-neutral-600 bg-neutral-800 p-1 pr-2 transition hover:bg-neutral-700"
        aria-haspopup="true"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name ? `Аватар ${user.name}` : "Аватар"}
            className="h-7 w-7 rounded-full"
            width={28}
            height={28}
            unoptimized
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-600 text-xs font-medium text-white">
            {user.name?.[0] ?? "?"}
          </span>
        )}
        <span className="text-sm text-white">{user.name ?? "Користувач"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-neutral-600 bg-neutral-900 py-1 shadow-xl">
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800"
          >
            Профіль
          </Link>
          {user.isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-neutral-200 transition hover:bg-neutral-800"
            >
              Панель керування
            </Link>
          )}
          <button
            onClick={async () => {
              setOpen(false);
              try {
                const result = await signOut({
                  callbackUrl: "/",
                  redirect: false,
                });
                router.push(result?.url ?? "/");
                router.refresh();
              } catch {
                window.location.href = "/";
              }
            }}
            className="block w-full px-4 py-2 text-left text-sm text-neutral-200 transition hover:bg-neutral-800"
          >
            Вийти
          </button>
        </div>
      )}
    </div>
  );
}
