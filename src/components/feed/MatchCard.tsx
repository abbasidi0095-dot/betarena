"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { FixtureRow } from "@/lib/client/api";
import { OddsButton } from "./OddsButton";
import { LivePill, ScoreBadge } from "./LivePill";
import { formatKickoff } from "@/lib/client/format";

export function MatchCard({ fixture }: { fixture: FixtureRow }) {
  const live = fixture.status === "LIVE";
  const finished = fixture.status === "FINISHED";
  const label = `${fixture.homeTeam} vs ${fixture.awayTeam}`;

  const h2h = fixture.markets.find((m) => m.key === "h2h");
  const totals = fixture.markets.find((m) => m.key === "totals");
  const btts = fixture.markets.find((m) => m.key === "btts");

  const findOdds = (market: typeof h2h, key: string) =>
    market?.odds.find((o) => o.selectionKey === key)?.value;

  const bettingDisabled = finished;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-surface p-3 transition-colors hover:bg-surface-2/60"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <Link
          href={`/league/${fixture.league.id}`}
          className="truncate text-[11px] text-text-secondary hover:text-white"
        >
          {fixture.league.country ? `${fixture.league.country} · ` : ""}
          {fixture.league.name}
        </Link>
        {live ? (
          <LivePill minute={fixture.minute} />
        ) : (
          <span className="shrink-0 text-[11px] tabular-nums text-text-secondary">
            {formatKickoff(fixture.kickoff)}
          </span>
        )}
      </div>

      <Link href={`/fixture/${fixture.id}`} className="mb-3 block">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-medium">{fixture.homeTeam}</p>
            <p className="truncate text-sm font-medium">{fixture.awayTeam}</p>
          </div>
          {(live || finished) && (
            <ScoreBadge home={fixture.homeScore} away={fixture.awayScore} />
          )}
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-1.5">
        {h2h && (
          <div className="flex min-w-[190px] flex-1 gap-1.5">
            {(["home", "draw", "away"] as const).map((key) => {
              const value = findOdds(h2h, key);
              if (!value) return <div key={key} className="min-w-[56px] flex-1" />;
              return (
                <div key={key} className="min-w-0 flex-1">
                  <div className="mb-1 truncate text-center text-[9px] uppercase text-text-tertiary">
                    {key === "home" ? "1" : key === "draw" ? "X" : "2"}
                  </div>
                  <OddsButton
                    fixtureId={fixture.id}
                    fixtureLabel={label}
                    marketKey="h2h"
                    selectionKey={key}
                    selectionName={
                      key === "home"
                        ? `${fixture.homeTeam} to win`
                        : key === "draw"
                          ? "Draw"
                          : `${fixture.awayTeam} to win`
                    }
                    value={value}
                    disabled={bettingDisabled}
                    compact
                  />
                </div>
              );
            })}
          </div>
        )}
        {totals && (
          <div className="flex gap-1.5">
            {(["over_2.5", "under_2.5"] as const).map((key) => {
              const value = findOdds(totals, key);
              if (!value) return null;
              return (
                <OddsButton
                  key={key}
                  fixtureId={fixture.id}
                  fixtureLabel={label}
                  marketKey="totals"
                  selectionKey={key}
                  selectionName={key === "over_2.5" ? "Over 2.5 goals" : "Under 2.5 goals"}
                  value={value}
                  disabled={bettingDisabled}
                  compact
                />
              );
            })}
          </div>
        )}
        {btts && (
          <div className="flex gap-1.5">
            {(["btts_yes", "btts_no"] as const).map((key) => {
              const value = findOdds(btts, key);
              if (!value) return null;
              return (
                <OddsButton
                  key={key}
                  fixtureId={fixture.id}
                  fixtureLabel={label}
                  marketKey="btts"
                  selectionKey={key}
                  selectionName={
                    key === "btts_yes" ? "BTTS — Yes" : "BTTS — No"
                  }
                  value={value}
                  disabled={bettingDisabled}
                  compact
                />
              );
            })}
          </div>
        )}
        {!h2h && !totals && !btts && (
          <p className="py-2 text-[11px] text-text-tertiary">Odds coming soon</p>
        )}
      </div>
    </motion.div>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl bg-surface p-3">
      <div className="mb-3 h-3 w-1/3 rounded bg-surface-2" />
      <div className="mb-2 h-4 w-2/3 rounded bg-surface-2" />
      <div className="mb-3 h-4 w-1/2 rounded bg-surface-2" />
      <div className="flex gap-2">
        <div className="h-10 flex-1 rounded-lg bg-surface-2" />
        <div className="h-10 flex-1 rounded-lg bg-surface-2" />
        <div className="h-10 flex-1 rounded-lg bg-surface-2" />
      </div>
    </div>
  );
}
