"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { api, type MeResponse } from "@/lib/client/api";
import { useUser } from "@/stores/user";
import { cn } from "@/lib/client/cn";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      mode === "login"
        ? { email: form.email, password: form.password }
        : form;
    const res = await api.post<{ user: MeResponse["user"] }>(path, payload);
    setBusy(false);
    if (res.ok) {
      useUser.getState().setUser(res.data!.user);
      router.push("/");
      router.refresh();
    } else {
      setError(res.error?.message ?? "Something went wrong");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto mt-8 max-w-sm">
        <div className="mb-6 text-center">
          <span className="rounded-lg bg-brand px-3 py-1 text-2xl font-black italic text-black">
            ab
          </span>
          <span className="text-2xl font-black italic">bet</span>
          <p className="mt-2 text-xs text-text-secondary">
            €1,000 in free play money when you register. No real money, ever.
          </p>
        </div>

        <div className="rounded-2xl bg-surface p-5">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
            {(["register", "login"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-lg py-2 text-xs font-bold capitalize",
                  mode === m ? "bg-brand text-black" : "text-text-secondary",
                )}
              >
                {m === "register" ? "Sign up" : "Log in"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Username"
                autoComplete="username"
                className="w-full rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-text-tertiary focus:ring-1 focus:ring-brand"
              />
            )}
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              type="email"
              autoComplete="email"
              className="w-full rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-text-tertiary focus:ring-1 focus:ring-brand"
            />
            <input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
              type="password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              className="w-full rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm outline-none placeholder:text-text-tertiary focus:ring-1 focus:ring-brand"
            />

            {error && (
              <p className="rounded-lg bg-lose/10 px-3 py-2 text-xs text-lose">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-black hover:bg-brand-hover disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "register" ? "Create account & claim €1,000" : "Log in"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-text-tertiary">
          Abbet is a free-to-play game with virtual currency only.
          <br />
          It involves no real money, deposits, or withdrawals.
        </p>
      </div>
    </AppShell>
  );
}
