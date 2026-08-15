"use client";

import { cn } from "@/lib/client/cn";
import type { BetRow } from "@/lib/client/api";
import { formatEuro, oddsToString } from "@/lib/client/format";

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-surface-3 text-white",
  WON: "bg-win/15 text-win border border-win/30",
  LOST: "bg-lose/10 text-lose border border-lose/30",
  PARTIAL: "bg-win/10 text-win border border-win/20",
  VOID: "bg-surface-2 text-void border border-void/30",
};

export function BetCard({ bet }: { bet: BetRow }) {
  const settled = bet.status !== "OPEN";
  const typeLabel =
    bet.type === "SINGLE" ? "Single" : bet.type === "ACCA" ? "Acca" : bet.systemType;

  return (
    <div className="mb-3 rounded-xl bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
          {typeLabel}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
            STATUS_STYLES[bet.status] ?? STATUS_STYLES.OPEN,
          )}
        >
          {bet.status}
        </span>
      </div>

      <ul className="mb-3 space-y-2">
        {bet.legs.map((leg) => (
          <li key={leg.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="truncate">{leg.selectionName}</p>
              <p className="truncate text-[11px] text-text-tertiary">
                {leg.fixture?.homeTeam} vs {leg.fixture?.awayTeam}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs tabular-nums text-text-secondary">
                {oddsToString(Number(leg.oddsLocked))}
              </span>
              {settled && (
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    leg.status === "WON" && "bg-win/20 text-win",
                    leg.status === "LOST" && "bg-lose/20 text-lose",
                    leg.status === "VOID" && "bg-surface-2 text-void",
                    leg.status === "OPEN" && "bg-surface-2 text-text-secondary",
                  )}
                >
                  {leg.status === "WON" ? "✓" : leg.status === "LOST" ? "✕" : "–"}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {bet.type === "SYSTEM" && settled && (
        <p className="mb-3 text-[11px] text-text-secondary">
          {bet.combinations.filter((c) => c.status === "WON").length}/
          {bet.combinations.length} combinations won
        </p>
      )}

      <div className="flex items-center justify-between border-t border-surface-2 pt-3 text-xs">
        <span className="text-text-secondary">
          Stake <span className="font-semibold text-white">{formatEuro(bet.stakeTotal)}</span>
        </span>
        {settled ? (
          <span className="text-text-secondary">
            Returned{" "}
            <span
              className={cn(
                "font-bold tabular-nums",
                bet.payout > 0 ? "text-win" : "text-lose",
              )}
            >
              {formatEuro(bet.payout)}
            </span>
          </span>
        ) : (
          <span className="text-text-secondary">
            Potential{" "}
            <span className="font-bold tabular-nums text-win">
              {formatEuro(Number(bet.potentialReturn))}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
