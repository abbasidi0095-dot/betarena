"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { useFixtures } from "@/hooks/useFixtures";
import { TeamCrest } from "@/components/feed/TeamCrest";
import { oddsToString } from "@/lib/client/format";
import { cn } from "@/lib/client/cn";

/**
 * Betclic-style "popular bets" marquee (21st.dev marquee pattern):
 * a seamless looping strip of the hottest matches with live odds.
 */
export function TopBetsMarquee() {
  const { fixtures } = useFixtures("top");
  if (!fixtures || fixtures.length === 0) return null;

  const strip = fixtures.slice(0, 8);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-5 overflow-hidden rounded-xl border border-surface-2 bg-surface"
    >
      <div className="flex items-center gap-1.5 border-b border-surface-2 px-3.5 py-2">
        <Flame size={13} className="text-betclic-red" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
          Popular bets
        </span>
      </div>
      <div className="relative flex overflow-hidden">
        <div
          className="animate-marquee flex w-max items-center gap-3 py-2.5"
          style={{ "--marquee-duration": "48s" } as React.CSSProperties}
        >
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-3" aria-hidden={dup === 1}>
              {strip.map((f) => {
                const h2h = f.markets.find((m) => m.key === "h2h");
                const home = h2h?.odds.find((o) => o.selectionKey === "home")?.value;
                const away = h2h?.odds.find((o) => o.selectionKey === "away")?.value;
                return (
                  <Link
                    key={`${dup}-${f.id}`}
                    href={`/fixture/${f.id}`}
                    className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 transition-colors hover:bg-surface-3"
                  >
                    <TeamCrest name={f.homeTeam} size={18} />
                    <span className="max-w-[110px] truncate text-xs font-medium">
                      {f.homeTeam}
                    </span>
                    <span className="text-[10px] text-text-tertiary">vs</span>
                    <span className="max-w-[110px] truncate text-xs font-medium">
                      {f.awayTeam}
                    </span>
                    <TeamCrest name={f.awayTeam} size={18} />
                    <span className="ml-1 flex gap-1">
                      {[home, away].map((o, i) => (
                        <span
                          key={i}
                          className={cn(
                            "rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                            o !== undefined && o < 2 && "text-win",
                          )}
                        >
                          {o ? oddsToString(o) : "—"}
                        </span>
                      ))}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
