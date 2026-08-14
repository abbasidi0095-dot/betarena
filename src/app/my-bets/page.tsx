"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { api, type BetRow } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { BetCard } from "@/components/bets/BetCard";

export default function MyBetsPage() {
  const [tab, setTab] = useState<"open" | "settled">("open");
  const [bets, setBets] = useState<BetRow[] | null>(null);

  useEffect(() => {
    setBets(null);
    void api.get<{ bets: BetRow[] }>(`/api/bets?status=${tab}`).then((res) => {
      setBets(res.ok ? res.data!.bets : []);
    });
  }, [tab]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-3 text-lg font-bold">My Bets</h1>
        <div className="mb-4 flex gap-2">
          {(["open", "settled"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize",
                tab === t
                  ? "bg-betclic-red text-white"
                  : "bg-surface-2 text-text-secondary hover:text-white",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {bets === null && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        )}

        {bets !== null && bets.length === 0 && (
          <p className="py-16 text-center text-sm text-text-tertiary">
            {tab === "open" ? "No open bets yet — pick some odds!" : "No settled bets yet."}
          </p>
        )}

        {bets?.map((bet) => (
          <BetCard key={bet.id} bet={bet} />
        ))}
      </div>
    </AppShell>
  );
}
