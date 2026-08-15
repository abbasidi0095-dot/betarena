"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSlip } from "@/stores/slip";
import { cn } from "@/lib/client/cn";

/**
 * Betclic-style floating bet slip button (desktop + mobile).
 * Pops with a spring when a selection is added/removed — never auto-opens.
 */
export function SlipFAB() {
  const count = useSlip((s) => s.selections.length);
  const lastAdded = useSlip((s) => s.lastAdded);
  const open = useSlip((s) => s.open);

  return (
    <motion.button
      onClick={open}
      whileTap={{ scale: 0.94 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className={cn(
        "fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full py-3 pl-3 pr-4 shadow-xl lg:bottom-8 lg:right-8",
        count > 0
          ? "bg-brand text-black shadow-brand/40"
          : "bg-surface-3 text-text-secondary",
      )}
      aria-label="Open bet slip"
    >
      <motion.span
        key={lastAdded}
        initial={count > 0 ? { scale: 1.7, rotate: -8 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 14 }}
        className={cn(
          "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-black tabular-nums",
          count > 0 ? "bg-white text-black" : "bg-surface-2 text-text-secondary",
        )}
      >
        {count}
      </motion.span>
      <span className="text-xs font-bold uppercase tracking-wide">
        Bet slip
      </span>
    </motion.button>
  );
}

/** Mini toast confirming the added selection (auto-dismisses). */
export function SlipToast() {
  const lastAdded = useSlip((s) => s.lastAdded);
  const name = useSlip((s) => s.lastAddedName);

  useEffect(() => {
    if (!name) return;
    const t = setTimeout(() => useSlip.setState({ lastAddedName: null }), 1600);
    return () => clearTimeout(t);
  }, [name, lastAdded]);

  return (
    <AnimatePresence>
      {name && (
        <motion.div
          key={lastAdded}
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="pointer-events-none fixed bottom-[104px] left-1/2 z-40 -translate-x-1/2 rounded-full border border-brand/40 bg-surface px-4 py-2 shadow-xl lg:bottom-20"
        >
          <p className="max-w-[260px] truncate text-xs text-text-secondary">
            Added to slip:{" "}
            <span className="font-semibold text-white">{name}</span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
