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
  /** Show a thin implied-probability bar along the bottom edge. */
  probBar?: boolean;
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
  probBar,
}: OddsButtonProps) {
  const selections = useSlip((s) => s.selections);
  const toggle = useSlip((s) => s.toggle);
  const flash = useRealtime(
    (s) => s.oddsFlash[`${fixtureId}:${marketKey}:${selectionKey}`],
  );

  const active = isSelected(selections, fixtureId, marketKey, selectionKey);
  const displayValue = flash?.value ?? value;
  const fresh = flash && Date.now() - flash.at < 2000;
  const prob = Math.min(1, Math.max(0.02, 1 / displayValue));

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
        "relative flex min-w-0 w-full flex-col items-center justify-center overflow-hidden rounded-xl py-2 transition-colors duration-150",
        compact ? "text-[12px]" : "text-sm",
        active
          ? "bg-card-dark text-betclic-gold ring-2 ring-betclic-gold"
          : "bg-betclic-gold text-black hover:bg-betclic-gold-hover active:bg-betclic-gold-hover",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {!compact && (
        <span className="mb-0.5 max-w-full truncate text-[9px] font-semibold uppercase tracking-wide text-black/60">
          {SELECTION_SHORT[selectionKey] ?? selectionName}
        </span>
      )}
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
      {probBar && (
        <span
          className={cn(
            "absolute bottom-0 left-0 h-[3px] rounded-full transition-all duration-300",
            active ? "bg-betclic-gold" : "bg-black/50",
          )}
          style={{ width: `${prob * 100}%` }}
        />
      )}
    </motion.button>
  );
}
