"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useRealtime } from "@/hooks/useSocket";
import { useUser } from "@/stores/user";
import { formatPoints } from "@/lib/client/format";
import { playWinSound } from "@/lib/client/sound";

const STATUS_TEXT: Record<string, string> = {
  WON: "won",
  PARTIAL: "partially won",
  VOID: "voided",
  LOST: "lost",
};

export function WinToast() {
  const lastSettled = useRealtime((s) => s.lastSettled);
  const markSeen = useRealtime((s) => s.markSettledSeen);
  const setBalance = useUser((s) => s.setBalance);

  useEffect(() => {
    if (!lastSettled) return;
    setBalance(lastSettled.pointBalance);

    const isWin = lastSettled.payout > 0;
    if (isWin) {
      playWinSound();
      confetti({
        particleCount: 120,
        spread: 75,
        origin: { y: 0.6 },
        colors: ["#E50813", "#B9F135", "#ffffff", "#ffd700"],
      });
    }

    const t = setTimeout(markSeen, 4500);
    return () => clearTimeout(t);
  }, [lastSettled, markSeen, setBalance]);

  const isWin = !!lastSettled && lastSettled.payout > 0;

  return (
    <AnimatePresence>
      {lastSettled && (
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.95 }}
          className={`fixed left-1/2 top-16 z-[60] -translate-x-1/2 rounded-xl border px-4 py-3 shadow-2xl ${
            isWin
              ? "border-win/40 bg-[#1a230b]"
              : "border-surface-3 bg-surface"
          }`}
        >
          <p className="text-sm font-semibold">
            {isWin ? (
              <>
                You {STATUS_TEXT[lastSettled.status] ?? "won"}{" "}
                <span className="text-win">{formatPoints(lastSettled.payout)} pts!</span>
              </>
            ) : (
              <span className="text-text-secondary">
                Bet {STATUS_TEXT[lastSettled.status] ?? "settled"} — better luck next time
              </span>
            )}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
