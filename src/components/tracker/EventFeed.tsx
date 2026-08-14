"use client";

import { Goal, CreditCard, Repeat } from "lucide-react";
import { cn } from "@/lib/client/cn";
import type { FixtureRow } from "@/lib/client/api";

const ICONS = {
  goal: Goal,
  card: CreditCard,
  sub: Repeat,
};

export function EventFeed({ events }: { events: FixtureRow["events"] }) {
  const sorted = [...events].sort((a, b) => b.minute - a.minute);
  return (
    <ol className="max-h-[360px] space-y-1 overflow-y-auto rounded-xl bg-surface p-2">
      {sorted.map((ev, i) => {
        const Icon = ICONS[ev.type];
        return (
          <li key={i} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
            <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-text-tertiary">
              {ev.minute}&apos;
            </span>
            <Icon
              size={13}
              className={cn(
                "shrink-0",
                ev.type === "goal" && "text-win",
                ev.type === "card" && "text-yellow-500",
                ev.type === "sub" && "text-text-secondary",
              )}
            />
            <span className="truncate text-xs">
              {ev.player}
              <span className="ml-1.5 text-[10px] text-text-tertiary">
                {ev.team === "home" ? "(H)" : "(A)"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
