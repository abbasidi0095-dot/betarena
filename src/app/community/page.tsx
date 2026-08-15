"use client";

import { useEffect, useState } from "react";
import { Trophy, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/client/api";
import { BetFeedCard, type CommunityBet } from "@/components/community/BetFeedCard";
import { cn } from "@/lib/client/cn";

interface TopBettor {
  username: string;
  isBot: boolean;
  settled: number;
  won: number;
  winRate: number;
}

export default function CommunityPage() {
  const [tab, setTab] = useState<"feed" | "top">("feed");
  const [period, setPeriod] = useState<"today" | "week">("week");
  const [bets, setBets] = useState<CommunityBet[] | null>(null);
  const [top, setTop] = useState<TopBettor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (tab === "feed") {
      api.get<{ bets: CommunityBet[] }>("/api/community?tab=feed").then((res) => {
        if (!cancelled && res.ok) setBets(res.data!.bets);
      });
    } else {
      api.get<{ top: TopBettor[] }>(`/api/community?tab=top&period=${period}`).then((res) => {
        if (!cancelled && res.ok) setTop(res.data!.top);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [tab, period]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="sticky top-0 z-20 -mx-3 mb-3 flex items-center gap-2 border-b border-card-border bg-bg/90 px-3 py-2 backdrop-blur lg:-mx-6 lg:px-6">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("feed")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                tab === "feed"
                  ? "bg-brand text-black"
                  : "border border-card-border bg-card-dark text-text-secondary hover:text-white",
              )}
            >
              <Users size={13} />
              Public
            </button>
            <button
              onClick={() => setTab("top")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                tab === "top"
                  ? "bg-brand text-black"
                  : "border border-card-border bg-card-dark text-text-secondary hover:text-white",
              )}
            >
              <Trophy size={13} />
              Top parieurs
            </button>
          </div>
          {tab === "top" && (
            <div className="ml-auto flex gap-1">
              {(["today", "week"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase transition-colors",
                    period === p ? "bg-brand text-black" : "text-text-tertiary hover:text-white",
                  )}
                >
                  {p === "today" ? "Aujourd'hui" : "Cette semaine"}
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === "feed" && (
          <div className="space-y-2">
            {bets === null && <p className="py-10 text-center text-sm text-text-tertiary">Loading…</p>}
            {bets?.length === 0 && <p className="py-10 text-center text-sm text-text-tertiary">No public bets yet</p>}
            {bets?.map((b) => <BetFeedCard key={b.id} bet={b} />)}
          </div>
        )}

        {tab === "top" && (
          <div className="space-y-2">
            {top === null && <p className="py-10 text-center text-sm text-text-tertiary">Loading…</p>}
            {top?.map((t, i) => (
              <div key={t.username} className="flex items-center justify-between gap-3 rounded-xl border border-card-border bg-card-dark px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black",
                    i === 0 ? "bg-brand text-black" : "bg-surface-3 text-text-secondary",
                  )}>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {t.username}
                      {t.isBot && (
                        <span className="ml-1.5 rounded bg-surface-3 px-1 py-0.5 text-[8px] font-bold uppercase text-text-tertiary">
                          Bot
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-text-tertiary">
                      {t.settled} paris · {t.won} gagnés
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-lg font-black tabular-nums text-brand">{t.winRate}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
