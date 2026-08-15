"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { api, type MeResponse } from "@/lib/client/api";
import { useUser } from "@/stores/user";
import { cn } from "@/lib/client/cn";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"register" | "login" | "verify">("register");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      mode === "login"
        ? { email: form.email, password: form.password }
        : form;
    const res = await api.post<{ user: MeResponse["user"]; verificationPending?: boolean }>(path, payload);
    setBusy(false);
    if (res.ok) {
      if (res.data?.verificationPending) {
        setMode("verify");
      } else {
        useUser.getState().setUser(res.data!.user);
        router.push("/");
        router.refresh();
      }
    } else if (res.error?.code === "EMAIL_UNVERIFIED") {
      setMode("verify");
    } else {
      setError(res.error?.message ?? "Something went wrong");
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api.post<{ user: MeResponse["user"] }>("/api/auth/verify-otp", {
      email: form.email,
      code,
    });
    setBusy(false);
    if (res.ok) {
      useUser.getState().setUser(res.data!.user);
      router.push("/");
      router.refresh();
    } else {
      setError(res.error?.message ?? "Something went wrong");
    }
  };

  const resend = async () => {
    if (resendIn > 0 || busy) return;
    setBusy(true);
    setError(null);
    const res = await api.post("/api/auth/resend-otp", { email: form.email });
    setBusy(false);
    if (res.ok) {
      setResendIn(60);
      const t = window.setInterval(() => {
        setResendIn((n) => {
          if (n <= 1) window.clearInterval(t);
          return n - 1;
        });
      }, 1000);
    } else {
      setError(res.error?.message ?? "Something went wrong");
    }
  };

  const backToLogin = () => {
    setMode("login");
    setCode("");
    setError(null);
  };

  const header = (
    <div className="mb-4 text-center">
      <span className="rounded-lg bg-brand px-3 py-1 text-2xl font-black italic text-black">
        ab
      </span>
      <span className="text-2xl font-black italic">bet</span>
      <p className="mt-2 text-xs text-text-secondary">
        {mode === "verify"
          ? "Check your inbox — we emailed you a code."
          : "€1,000 in free play money when you register. No real money, ever."}
      </p>
    </div>
  );

  return (
    <AppShell>
      <div className="mx-auto mt-8 max-w-sm">
        {header}

        <div className="rounded-2xl bg-surface p-5">
          {mode === "verify" ? (
            <form onSubmit={verify} className="space-y-3">
              <div className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs text-text-secondary">
                <span className="font-semibold text-white">{form.email}</span> — enter the
                6-digit code sent by email to verify your account.
              </div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                inputMode="numeric"
                autoFocus
                className="w-full rounded-xl bg-surface-2 px-3.5 py-2.5 text-center text-lg font-bold tracking-[0.5em] outline-none placeholder:text-text-tertiary focus:ring-1 focus:ring-brand"
              />
              {error && (
                <p className="rounded-lg bg-lose/10 px-3 py-2 text-xs text-lose">{error}</p>
              )}
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-black hover:bg-brand-hover disabled:opacity-60"
              >
                {busy ? "Verifying…" : "Verify email"}
              </button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={backToLogin}
                  className="text-text-tertiary hover:text-white"
                >
                  Back to login
                </button>
                <button
                  type="button"
                  onClick={resend}
                  disabled={resendIn > 0 || busy}
                  className="font-semibold text-brand disabled:text-text-tertiary"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                </button>
              </div>
            </form>
          ) : (
            <>
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
            </>
          )}
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
