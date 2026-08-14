"use client";

import { useState } from "react";
import { useFixtures } from "@/hooks/useFixtures";
import { MatchCard, SkeletonCard } from "@/components/feed/MatchCard";
import { cn } from "@/lib/client/cn";

const TABS = [
  { key: "top", label: "Top Bets" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
] as const;

export function Feed({
  scope,
  leagueId,
  title,
}: {
  scope: "top" | "live" | "upcoming" | "league";
  leagueId?: string;
  title?: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>(scope === "league" ? "top" : scope);
  const { fixtures } = useFixtures(tab, leagueId);

  return (
    <div>
      {title && <h1 className="mb-3 text-lg font-bold">{title}</h1>}
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              tab === t.key
                ? "bg-betclic-red text-white"
                : "bg-surface-2 text-text-secondary hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fixtures === null
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : fixtures.map((f) => <MatchCard key={f.id} fixture={f} />)}
      </div>

      {fixtures !== null && fixtures.length === 0 && (
        <p className="py-16 text-center text-sm text-text-tertiary">
          No matches here right now — check the other tabs.
        </p>
      )}
    </div>
  );
}
