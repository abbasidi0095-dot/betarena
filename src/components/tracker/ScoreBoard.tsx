"use client";

import { LivePill, ScoreBadge } from "@/components/feed/LivePill";
import { formatKickoff } from "@/lib/client/format";
import type { FixtureRow } from "@/lib/client/api";

export function ScoreBoard({ fixture }: { fixture: FixtureRow }) {
  const live = fixture.status === "LIVE";
  const finished = fixture.status === "FINISHED";

  return (
    <div className="rounded-2xl bg-gradient-to-b from-surface-2 to-surface p-5">
      <div className="mb-4 flex items-center justify-between text-[11px] text-text-secondary">
        <span>{formatKickoff(fixture.kickoff)}</span>
        {live && <LivePill minute={fixture.minute} />}
        {finished && (
          <span className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold uppercase">
            Finished
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-4">
        <p className="flex-1 truncate text-right text-base font-semibold sm:text-lg">
          {fixture.homeTeam}
        </p>
        {(live || finished) && (
          <ScoreBadge home={fixture.homeScore} away={fixture.awayScore} className="text-xl" />
        )}
        {!live && !finished && <span className="text-sm text-text-tertiary">vs</span>}
        <p className="flex-1 truncate text-left text-base font-semibold sm:text-lg">
          {fixture.awayTeam}
        </p>
      </div>
    </div>
  );
}
