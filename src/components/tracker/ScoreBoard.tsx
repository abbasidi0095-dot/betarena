"use client";

import { LivePill, ScoreBadge } from "@/components/feed/LivePill";
import { TeamCrest } from "@/components/feed/TeamCrest";
import { formatKickoff } from "@/lib/client/format";
import type { FixtureRow } from "@/lib/client/api";

export function ScoreBoard({ fixture }: { fixture: FixtureRow }) {
  const live = fixture.status === "LIVE";
  const finished = fixture.status === "FINISHED";

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card-dark">
      <div className="flex items-center justify-between border-b border-card-border px-4 py-2 text-[11px] font-semibold text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          {fixture.league.country} · {fixture.league.name}
        </span>
        {live ? (
          <LivePill minute={fixture.minute} />
        ) : finished ? (
          <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold uppercase text-text-secondary">
            Terminé
          </span>
        ) : (
          <span className="tabular-nums text-brand">{formatKickoff(fixture.kickoff)}</span>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-5">
        <div className="flex flex-1 flex-col items-center gap-2">
          <TeamCrest name={fixture.homeTeam} logo={fixture.homeLogo} size={40} />
          <p className="truncate text-right text-sm font-semibold sm:text-base">
            {fixture.homeTeam}
          </p>
        </div>
        {live || finished ? (
          <ScoreBadge
            home={fixture.homeScore}
            away={fixture.awayScore}
            className="rounded-xl border border-card-border bg-bg px-3 py-1.5 text-2xl font-bold"
          />
        ) : (
          <span className="rounded-xl border border-brand/40 bg-bg px-3 py-1.5 text-sm font-bold text-brand">
            vs
          </span>
        )}
        <div className="flex flex-1 flex-col items-center gap-2">
          <TeamCrest name={fixture.awayTeam} logo={fixture.awayLogo} size={40} />
          <p className="truncate text-left text-sm font-semibold sm:text-base">
            {fixture.awayTeam}
          </p>
        </div>
      </div>
    </div>
  );
}
