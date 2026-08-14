"use client";

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
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-0.5 text-sm font-bold tabular-nums",
        className,
      )}
    >
      <span>{home}</span>
      <span className="text-text-tertiary">:</span>
      <span>{away}</span>
    </span>
  );
}
