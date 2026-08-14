"use client";

import { motion } from "framer-motion";
import { useRealtime, type OddsUpdate } from "@/hooks/useSocket";
import { useSlip, isSelected, type Selection } from "@/stores/slip";
import { oddsToString, SELECTION_SHORT } from "@/lib/client/format";
import { playSelectSound } from "@/lib/client/sound";
import { cn } from "@/lib/client/cn";

interface OddsButtonProps {
  fixtureId: string;
  fixtureLabel: string;
  marketKey: "h2h" | "totals" | "btts";
  selectionKey: string;
  selectionName: string;
  value: number;
  disabled?: boolean;
  compact?: boolean;
}

export function OddsButton({
  fixtureId,
  fixtureLabel,
  marketKey,
  selectionKey,
  selectionName,
  value,
  disabled,
  compact,
}: OddsButtonProps) {
  const selections = useSlip((s) => s.selections);
  const toggle = useSlip((s) => s.toggle);
  const flash = useRealtime(
    (s) => s.oddsFlash[`${fixtureId}:${marketKey}:${selectionKey}`],
  );

  const active = isSelected(selections, fixtureId, marketKey, selectionKey);
  const displayValue = flash?.value ?? value;
  const fresh = flash && Date.now() - flash.at < 2000;

  const handle = () => {
    const sel: Selection = {
      fixtureId,
      marketKey,
      selectionKey,
      selectionName,
      fixtureLabel,
      odds: displayValue,
    };
    toggle(sel);
    playSelectSound(active);
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={handle}
      disabled={disabled}
      className={cn(
        "relative flex min-w-[56px] flex-col items-center justify-center rounded-lg px-2 py-1.5 transition-colors",
        compact ? "text-[11px]" : "text-xs",
        active
          ? "bg-betclic-red text-white shadow-[0_0_0_1px_#ff6b70]"
          : "bg-surface-2 text-text-primary hover:bg-surface-3",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span className="text-[9px] uppercase tracking-wide text-text-secondary">
        {SELECTION_SHORT[selectionKey] ?? ""}
      </span>
      <motion.span
        key={`${displayValue}-${fresh ? flash!.at : "stable"}`}
        initial={fresh ? { opacity: 0.4 } : false}
        animate={{ opacity: 1 }}
        className={cn(
          "font-semibold tabular-nums",
          fresh && flash!.direction === "up" && "odds-flash-up rounded",
          fresh && flash!.direction === "down" && "odds-flash-down rounded",
        )}
      >
        {oddsToString(displayValue)}
      </motion.span>
    </motion.button>
  );
}

export type { OddsUpdate };
