"use client";

import { formatEuro } from "@/lib/client/format";
import { CopyBetButton, type CopyableLeg } from "./CopyBetButton";

export interface CommunityBet {
  id: string;
  type: string;
  stakeTotal: number;
  potentialReturn: number;
  payout: number;
  status: string;
  placedAt: string;
  username: string;
  isBot: boolean;
  legs: CopyableLeg[];
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-surface-3 text-text-secondary",
  WON: "bg-emerald-500/20 text-emerald-400",
  LOST: "bg-red-500/20 text-red-400",
  VOID: "bg-surface-3 text-text-secondary",
};

export function BetFeedCard({ bet }: { bet: CommunityBet }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-dark p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-bold text-text-secondary">
            {bet.username.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">
              {bet.username}
              {bet.isBot && (
                <span className="ml-1.5 rounded bg-surface-3 px-1 py-0.5 text-[8px] font-bold uppercase text-text-tertiary">
                  Bot
                </span>
              )}
            </p>
            <p className="text-[10px] text-text-tertiary">
              {new Date(bet.placedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[bet.status] ?? "bg-surface-3"}`}>
          {bet.status}
        </span>
      </div>

      <ul className="space-y-1">
        {bet.legs.map((leg, i) => (
          <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-2.5 py-1.5 text-[11px]">
            <span className="min-w-0 flex-1 truncate text-text-secondary">{leg.label}</span>
            <span className="shrink-0 truncate font-semibold">{leg.selectionName}</span>
            <span className="shrink-0 font-bold tabular-nums text-brand">{leg.odds.toFixed(2)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-text-tertiary">
          Mise <span className="font-bold text-text-primary">{formatEuro(bet.stakeTotal)}</span>
          {bet.potentialReturn > 0 && (
            <>
              {" · "}Gain potentiel <span className="font-bold text-brand">{formatEuro(bet.potentialReturn)}</span>
            </>
          )}
        </p>
        {bet.status === "OPEN" && <CopyBetButton legs={bet.legs} />}
      </div>
    </div>
  );
}
