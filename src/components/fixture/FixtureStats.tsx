"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

interface StatsPayload {
  homeForm: { result: "W" | "D" | "L"; opponent: string; score: string; date: string }[];
  awayForm: { result: "W" | "D" | "L"; opponent: string; score: string; date: string }[];
  h2h: { homeTeam: string; awayTeam: string; score: string; date: string }[];
  statsSummary: { homeWinPct: number; drawPct: number; awayWinPct: number };
  source: "api" | "db";
}

function FormRow({ entries }: { entries: StatsPayload["homeForm"] }) {
  return (
    <div className="flex gap-1">
      {entries.length === 0 && <span className="text-[11px] text-text-tertiary">No recent matches</span>}
      {entries.map((e, i) => (
        <span
          key={i}
          title={`${e.result} vs ${e.opponent} (${e.score})`}
          className={
            e.result === "W"
              ? "flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-[10px] font-bold text-emerald-400"
              : e.result === "L"
                ? "flex h-5 w-5 items-center justify-center rounded bg-red-500/20 text-[10px] font-bold text-red-400"
                : "flex h-5 w-5 items-center justify-center rounded bg-surface-3 text-[10px] font-bold text-text-secondary"
          }
        >
          {e.result}
        </span>
      ))}
    </div>
  );
}

export function FixtureStats({ fixtureId, homeTeam, awayTeam }: { fixtureId: string; homeTeam: string; awayTeam: string }) {
  const [data, setData] = useState<StatsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<StatsPayload>(`/api/fixtures/${fixtureId}/stats`).then((res) => {
      if (!cancelled && res.ok) setData(res.data!);
    });
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  if (!data) {
    return (
      <div className="animate-pulse rounded-xl border border-card-border bg-card-dark p-4 text-sm text-text-tertiary">
        Chargement des statistiques…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Form guide */}
      <div className="rounded-xl border border-card-border bg-card-dark p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand">
          Forme des équipes
        </h3>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold">{homeTeam}</span>
            <FormRow entries={data.homeForm} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold">{awayTeam}</span>
            <FormRow entries={data.awayForm} />
          </div>
        </div>
      </div>

      {/* H2H */}
      <div className="rounded-xl border border-card-border bg-card-dark p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand">
          Face à face
        </h3>
        {data.h2h.length === 0 ? (
          <p className="text-[11px] text-text-tertiary">No head-to-head data</p>
        ) : (
          <ul className="space-y-2">
            {data.h2h.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{m.homeTeam}</span>
                <span className="shrink-0 rounded-lg bg-bg px-2.5 py-1 font-bold tabular-nums text-brand">
                  {m.score}
                </span>
                <span className="min-w-0 flex-1 truncate text-right">{m.awayTeam}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-card-border bg-card-dark p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-brand">
          Répartition des résultats
        </h3>
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="bg-brand" style={{ width: `${data.statsSummary.homeWinPct}%` }} />
          <div className="bg-surface-3" style={{ width: `${data.statsSummary.drawPct}%` }} />
          <div className="bg-lose" style={{ width: `${data.statsSummary.awayWinPct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-semibold text-text-tertiary">
          <span className="text-brand">{data.statsSummary.homeWinPct}% domicile</span>
          <span>{data.statsSummary.drawPct}% nul</span>
          <span className="text-lose">{data.statsSummary.awayWinPct}% extérieur</span>
        </div>
      </div>
    </div>
  );
}
