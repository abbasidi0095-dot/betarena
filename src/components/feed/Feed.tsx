"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
  const { fixtures, hasMore, loadMore, loadingMore } = useFixtures(tab, leagueId);
  const liveCount = fixtures?.filter((f) => f.status === "LIVE").length ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      {title && <h1 className="mb-3 text-lg font-bold">{title}</h1>}
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = t.key === "live" ? liveCount : null;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative rounded-lg py-2.5 text-xs font-bold uppercase tracking-wide transition-colors",
                active ? "text-white" : "text-text-secondary hover:text-white",
              )}
            >
              {active && (
                <motion.span
                  layoutId="feed-tab"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  className="absolute inset-0 rounded-lg bg-brand shadow-[0_2px_10px_rgba(255,199,0,0.4)]"
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                {t.label}
                {count !== null && count > 0 && (
                  <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fixtures === null
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : fixtures.map((f, i) => <MatchCard key={f.id} fixture={f} index={i} />)}
      </div>

      {fixtures !== null && fixtures.length === 0 && (
        <p className="py-16 text-center text-sm text-text-tertiary">
          No matches here right now — check the other tabs.
        </p>
      )}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-full bg-surface-2 px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-text-secondary transition-colors hover:bg-surface-3 hover:text-white disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : `Load more matches`}
          </button>
        </div>
      )}
    </div>
  );
}
