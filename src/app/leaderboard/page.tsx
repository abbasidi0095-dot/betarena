"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { api, type LeaderboardRow } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { formatPoints } from "@/lib/client/format";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [scope, setScope] = useState<"global" | "friends">("global");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    setRows(null);
    void api.get<{ leaderboard: LeaderboardRow[] }>(`/api/leaderboard?scope=${scope}`).then((res) => {
      if (res.ok) setRows(res.data!.leaderboard);
      else {
        setRows([]);
        setNeedsAuth(res.error?.code === "UNAUTHORIZED");
      }
    });
  }, [scope]);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-3 text-lg font-bold">Leaderboard</h1>
        <div className="mb-4 flex gap-2">
          {(["global", "friends"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize",
                scope === s
                  ? "bg-betclic-red text-white"
                  : "bg-surface-2 text-text-secondary hover:text-white",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {needsAuth && (
          <p className="py-12 text-center text-sm text-text-tertiary">
            Log in to see your friends leaderboard
          </p>
        )}

        {rows === null && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        )}

        {rows !== null && rows.length === 0 && !needsAuth && (
          <p className="py-12 text-center text-sm text-text-tertiary">Nobody here yet</p>
        )}

        <ol className="space-y-2">
          {rows?.map((row, i) => (
            <li
              key={row.id}
              className={cn(
                "flex items-center gap-3 rounded-xl p-3",
                i < 3 ? "bg-surface-2" : "bg-surface",
              )}
            >
              <span className="w-8 text-center text-sm font-bold tabular-nums">
                {i < 3 ? MEDALS[i] : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {row.username}
                  {row.isBot && (
                    <span className="ml-1.5 rounded bg-surface-3 px-1 text-[9px] uppercase text-text-tertiary">
                      bot
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-text-tertiary">
                  Win {row.winPct}% · ROI {row.roi > 0 ? "+" : ""}
                  {row.roi}%
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-win">
                  {formatPoints(row.totalWon)}
                </p>
                <p className="text-[10px] text-text-tertiary">pts won</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </AppShell>
  );
}
