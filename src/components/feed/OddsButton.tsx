"use client";

import { motion } from "framer-motion";
import { useRealtime } from "@/hooks/useSocket";
import { useSlip, isSelected, type Selection } from "@/stores/slip";
import { oddsToString, SELECTION_SHORT } from "@/lib/client/format";
import { playSelectSound } from "@/lib/client/sound";
import { cn } from "@/lib/client/cn";

interface OddsButtonProps {
  fixtureId: string;
  fixtureLabel: string;
  marketKey: string;
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
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 24 }}
      onClick={handle}
      disabled={disabled}
      className={cn(
        "relative flex min-w-0 w-full flex-col items-center justify-center rounded-lg py-2 transition-colors duration-150",
        compact ? "text-[12px]" : "text-sm",
        active
          ? "bg-betclic-red text-white shadow-[0_0_12px_rgba(229,8,19,0.45)]"
          : "bg-surface-2 text-text-primary hover:bg-surface-3 active:bg-surface-3",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <motion.span
        key={`${displayValue}-${fresh ? flash!.at : "stable"}`}
        initial={fresh ? { opacity: 0.3, scale: 0.92 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className={cn(
          "font-bold tabular-nums",
          fresh && flash!.direction === "up" && "odds-flash-up rounded px-1",
          fresh && flash!.direction === "down" && "odds-flash-down rounded px-1",
        )}
      >
        {oddsToString(displayValue)}
      </motion.span>
      {!compact && (
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-text-secondary">
          {SELECTION_SHORT[selectionKey] ?? selectionName}
        </span>
      )}
    </motion.button>
  );
}
