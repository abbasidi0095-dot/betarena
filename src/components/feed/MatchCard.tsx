"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { FixtureRow } from "@/lib/client/api";
import { OddsButton } from "./OddsButton";
import { LivePill, ScoreBadge } from "./LivePill";
import { TeamCrest } from "./TeamCrest";
import { formatKickoff } from "@/lib/client/format";

export function MatchCard({ fixture, index = 0 }: { fixture: FixtureRow; index?: number }) {
  const live = fixture.status === "LIVE";
  const finished = fixture.status === "FINISHED";
  const label = `${fixture.homeTeam} vs ${fixture.awayTeam}`;

  const h2h = fixture.markets.find((m) => m.key === "h2h");
  const findOdds = (market: typeof h2h, key: string) =>
    market?.odds.find((o) => o.selectionKey === key)?.value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4), ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className="group overflow-hidden rounded-xl border border-card-border bg-card-dark transition-colors hover:border-betclic-gold/40"
    >
      {/* league strip */}
      <div className="flex items-center justify-between gap-2 border-b border-card-border px-3 py-1.5">
        <Link
          href={`/league/${fixture.league.id}`}
          className="flex min-w-0 items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-wider text-text-secondary transition-colors hover:text-betclic-gold"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-betclic-gold" />
          <span className="truncate">
            {fixture.league.country} · {fixture.league.name}
          </span>
        </Link>
        {live ? (
          <LivePill minute={fixture.minute} />
        ) : (
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-betclic-gold">
            {formatKickoff(fixture.kickoff)}
          </span>
        )}
      </div>

      {/* teams */}
      <Link href={`/fixture/${fixture.id}`} className="block px-3 pb-3 pt-3">
        <div className="flex items-center justify-center gap-3">
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <p className="truncate text-sm font-semibold">{fixture.homeTeam}</p>
            <TeamCrest name={fixture.homeTeam} logo={fixture.homeLogo} />
          </div>
          {live || finished ? (
            <ScoreBadge
              home={fixture.homeScore}
              away={fixture.awayScore}
              className="rounded-lg border border-card-border bg-bg px-2 py-1"
            />
          ) : (
            <span className="rounded-lg border border-card-border bg-bg px-2 py-1 text-[11px] font-bold tabular-nums text-betclic-gold">
              vs
            </span>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <TeamCrest name={fixture.awayTeam} logo={fixture.awayLogo} />
            <p className="truncate text-sm font-semibold">{fixture.awayTeam}</p>
          </div>
        </div>
      </Link>

      {/* 1X2 only — Betclic gold style */}
      {h2h && (
        <div className="flex gap-1.5 px-3 pb-3">
          {(["home", "draw", "away"] as const).map((key) => {
            const value = findOdds(h2h, key);
            if (!value) return <div key={key} className="min-h-[42px] flex-1 rounded-xl bg-surface-2/50" />;
            return (
              <div key={key} className="min-w-0 flex-1">
                <div className="mb-1 text-center text-[9px] font-bold uppercase tracking-wider text-text-tertiary">
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
                  disabled={finished}
                  compact
                  probBar
                />
              </div>
            );
          })}
        </div>
      )}
      {!h2h && (
        <p className="px-3 pb-3 text-center text-[11px] text-text-tertiary">Odds coming soon</p>
      )}
    </motion.div>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-card-border bg-card-dark p-3">
      <div className="mb-3 h-3 w-1/3 rounded bg-surface-2" />
      <div className="mb-3 flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-surface-2" />
        <div className="h-4 flex-1 rounded bg-surface-2" />
      </div>
      <div className="flex gap-2">
        <div className="h-10 flex-1 rounded-lg bg-surface-2" />
        <div className="h-10 flex-1 rounded-lg bg-surface-2" />
        <div className="h-10 flex-1 rounded-lg bg-surface-2" />
      </div>
    </div>
  );
}
