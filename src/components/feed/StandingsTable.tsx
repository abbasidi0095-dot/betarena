"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { api, type LeagueRow } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";

export interface StandingRow {
  rank: number;
  team: string;
  logo: string | null;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: string;
}

function formColor(ch: string): string {
  if (ch === "W") return "bg-win/20 text-win";
  if (ch === "D") return "bg-surface-3 text-text-secondary";
  return "bg-lose/20 text-lose";
}

export function StandingsTable({ leagueId }: { leagueId: string }) {
  const [rows, setRows] = useState<StandingRow[] | null>(null);

  useEffect(() => {
    void api
      .get<{ league: LeagueRow & { standings: StandingRow[] } }>(`/api/leagues/${leagueId}`)
      .then((res) => {
        if (res.ok && Array.isArray(res.data!.league.standings)) {
          setRows(res.data!.league.standings);
        } else {
          setRows([]);
        }
      });
  }, [leagueId]);

  if (rows === null) {
    return <div className="h-40 animate-pulse rounded-xl bg-surface" />;
  }
  if (rows.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mb-5 overflow-hidden rounded-xl bg-surface"
    >
      <div className="flex items-center gap-1.5 border-b border-surface-2 px-3.5 py-2.5">
        <Trophy size={13} className="text-brand" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
          Standings
        </span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-surface-2 text-[9px] uppercase tracking-wider text-text-tertiary">
            <th className="px-2 py-1.5 text-left font-medium">#</th>
            <th className="px-1 py-1.5 text-left font-medium">Team</th>
            <th className="px-1 py-1.5 text-right font-medium">P</th>
            <th className="hidden px-1 py-1.5 text-right font-medium sm:table-cell">W</th>
            <th className="hidden px-1 py-1.5 text-right font-medium sm:table-cell">D</th>
            <th className="hidden px-1 py-1.5 text-right font-medium sm:table-cell">L</th>
            <th className="hidden px-1 py-1.5 text-right font-medium md:table-cell">GD</th>
            <th className="px-2 py-1.5 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.rank}
              className={cn(
                "border-b border-surface-2/50 transition-colors last:border-0 hover:bg-surface-2/40",
                i < 4 && "bg-brand/[0.04]",
              )}
            >
              <td className="px-2 py-2 text-left font-semibold tabular-nums text-text-secondary">
                {r.rank}
              </td>
              <td className="px-1 py-2">
                <span className="flex items-center gap-2">
                  {r.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.logo} alt="" className="h-4 w-4 object-contain" loading="lazy" />
                  ) : null}
                  <span className="truncate font-medium">{r.team}</span>
                </span>
              </td>
              <td className="px-1 py-2 text-right tabular-nums text-text-secondary">{r.played}</td>
              <td className="hidden px-1 py-2 text-right tabular-nums sm:table-cell">{r.win}</td>
              <td className="hidden px-1 py-2 text-right tabular-nums sm:table-cell">{r.draw}</td>
              <td className="hidden px-1 py-2 text-right tabular-nums sm:table-cell">{r.lose}</td>
              <td className="hidden px-1 py-2 text-right tabular-nums md:table-cell">
                {r.goalsFor - r.goalsAgainst > 0 ? "+" : ""}
                {r.goalsFor - r.goalsAgainst}
              </td>
              <td className="px-2 py-2 text-right font-bold tabular-nums">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 0 && (
        <div className="flex gap-1.5 border-t border-surface-2 px-3.5 py-2">
          {rows[0].form
            .split("")
            .slice(0, 6)
            .map((ch, i) => (
              <span
                key={i}
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
                  formColor(ch),
                )}
              >
                {ch}
              </span>
            ))}
        </div>
      )}
    </motion.div>
  );
}
