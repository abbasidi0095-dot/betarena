"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/client/cn";

export function LivePill({ minute }: { minute: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-live/15 px-2 py-0.5 text-[11px] font-semibold text-live">
      <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live" />
      LIVE{minute !== null && minute !== undefined ? ` ${minute}'` : ""}
    </span>
  );
}

export function ScoreBadge({
  home,
  away,
  className,
}: {
  home: number;
  away: number;
  className?: string;
}) {
  // spring pop whenever the score changes
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-sm font-bold tabular-nums",
        className,
      )}
    >
      <motion.span
        key={home}
        initial={{ scale: 1.45 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 16 }}
        className="inline-block"
      >
        {home}
      </motion.span>
      <span className="text-text-tertiary">:</span>
      <motion.span
        key={away}
        initial={{ scale: 1.45 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 16 }}
        className="inline-block"
      >
        {away}
      </motion.span>
    </span>
  );
}
