"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

interface ProvidersResponse {
  [key: string]: {
    id: string;
    name: string;
    type: string;
  };
}

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProvidersResponse | null>(null);

  const isDev = process.env.NODE_ENV !== "production";
  const adminEmail = process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL ?? "admin@game-x.local";
  const adminPassword = process.env.NEXT_PUBLIC_DEV_ADMIN_PASSWORD ?? "admin12345";
  const userEmail = process.env.NEXT_PUBLIC_DEV_USER_EMAIL ?? "user@game-x.local";
  const userPassword = process.env.NEXT_PUBLIC_DEV_USER_PASSWORD ?? "user12345";

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl: "/",
    });

    if (result?.error) {
      setError("Невірний email або пароль");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  const fillAdmin = () => {
    setEmail(adminEmail);
    setPassword(adminPassword);
  };

  const fillUser = () => {
    setEmail(userEmail);
    setPassword(userPassword);
  };

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/providers", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: ProvidersResponse) => setProviders(data))
      .catch(() => setProviders({}));
    return () => {
      controller.abort();
    };
  }, []);

  const hasCredentials = Boolean(providers?.credentials);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950">
      <div className="w-full max-w-sm rounded-xl border border-neutral-700 bg-neutral-900/80 p-8">
        <h1 className="mb-6 text-center text-xl font-semibold text-white">
          Увійти в Game-X
        </h1>
        {isDev && hasCredentials && (
          <form onSubmit={handleLocalLogin} className="mb-5 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2.5 text-white placeholder-neutral-500"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              className="w-full rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2.5 text-white placeholder-neutral-500"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-medium text-neutral-900 transition hover:bg-cyan-400 disabled:opacity-50"
            >
              {loading ? "Вхід..." : "Локальний вхід (dev)"}
            </button>
            {(userEmail || adminEmail) && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {userEmail && (
                  <button
                    type="button"
                    onClick={fillUser}
                    className="rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-200 transition hover:bg-neutral-700"
                  >
                    Demo User
                  </button>
                )}
                {adminEmail && (
                  <button
                    type="button"
                    onClick={fillAdmin}
                    className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-200 transition hover:bg-purple-500/20"
                  >
                    Demo Admin
                  </button>
                )}
              </div>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </form>
        )}
        {providers?.google && (
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="mb-3 w-full rounded-lg bg-white px-4 py-3 font-medium text-neutral-900 transition hover:bg-neutral-100"
          >
            Увійти через Google
          </button>
        )}
        {providers?.discord && (
          <button
            type="button"
            onClick={() => signIn("discord", { callbackUrl: "/" })}
            className="w-full rounded-lg bg-[#5865F2] px-4 py-3 font-medium text-white transition hover:bg-[#4752C4]"
          >
            Увійти через Discord
          </button>
        )}
        {providers && !providers.google && !providers.discord && !hasCredentials && (
          <p className="text-center text-xs text-neutral-400">
            Провайдери входу не налаштовані.
          </p>
        )}
      </div>
    </div>
  );
}
