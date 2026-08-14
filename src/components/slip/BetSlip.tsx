"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, X, ChevronDown, AlertCircle, Check } from "lucide-react";
import { useSlip, totalOdds, type Selection } from "@/stores/slip";
import { useUser } from "@/stores/user";
import { api } from "@/lib/client/api";
import { oddsToString, formatPoints } from "@/lib/client/format";
import { comboCount, type SystemType } from "@/lib/betting/combos";
import { playSelectSound } from "@/lib/client/sound";
import { cn } from "@/lib/client/cn";

type BetMode = "SINGLE" | "ACCA" | "SYSTEM";
const SYSTEM_TYPES: { key: SystemType; legs: number; label: string }[] = [
  { key: "TRIXIE", legs: 3, label: "Trixie" },
  { key: "PATENT", legs: 3, label: "Patent" },
  { key: "YANKEE", legs: 4, label: "Yankee" },
  { key: "LUCKY15", legs: 4, label: "Lucky 15" },
];

const QUICK_STAKES = [10, 50, 100];

export function BetSlip() {
  const { selections, isOpen, close, clear, remove } = useSlip();
  const user = useUser((s) => s.user);
  const [mode, setMode] = useState<BetMode>("ACCA");
  const [systemType, setSystemType] = useState<SystemType>("PATENT");
  const [stake, setStake] = useState(50);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const n = selections.length;
  const availableModes: BetMode[] = n >= 2 ? ["SINGLE", "ACCA", "SYSTEM"] : ["SINGLE"];
  const effectiveMode = availableModes.includes(mode) ? mode : "SINGLE";

  const systemChoice = SYSTEM_TYPES.find((s) => s.key === systemType)!;
  const systemValid = n === systemChoice.legs;
  const combos = systemValid ? comboCount(systemType) : 0;
  const perCombo = combos > 0 ? Math.floor(stake / combos) : 0;

  const product = useMemo(() => totalOdds(selections), [selections]);

  const totalCost = effectiveMode === "SINGLE" ? stake * n : stake;
  const potential =
    effectiveMode === "SINGLE"
      ? selections.reduce((acc, s) => acc + Math.floor(stake * s.odds), 0)
      : effectiveMode === "ACCA"
        ? Math.floor(stake * product)
        : Math.floor(perCombo * product) * combos; // approximate max for display

  const insufficient = !!user && user.pointBalance < totalCost;
  const canPlace =
    n > 0 &&
    !insufficient &&
    stake >= 1 &&
    (effectiveMode !== "SYSTEM" || systemValid) &&
    (effectiveMode !== "ACCA" || n >= 2) &&
    !!user;

  const place = async () => {
    if (!canPlace || placing) return;
    setPlacing(true);
    setError(null);
    setSuccess(null);
    const res = await api.post<{ bets: { betId: string }[]; pointBalance: number }>(
      "/api/bets",
      {
        selections: selections.map((s) => ({
          fixtureId: s.fixtureId,
          marketKey: s.marketKey,
          selectionKey: s.selectionKey,
        })),
        stake,
        type: effectiveMode,
        systemType: effectiveMode === "SYSTEM" ? systemType : null,
      },
    );
    setPlacing(false);
    if (res.ok) {
      useUser.getState().setBalance(res.data!.pointBalance);
      setSuccess(
        `${res.data!.bets.length} bet${res.data!.bets.length > 1 ? "s" : ""} placed — good luck!`,
      );
      clear();
      playSelectSound(false);
      setTimeout(() => setSuccess(null), 3500);
    } else {
      setError(res.error?.message ?? "Could not place bet");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-40 bg-black/60 lg:bg-black/40"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-2xl border border-surface-2 bg-surface",
              "lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[380px] lg:rounded-none lg:rounded-l-2xl",
            )}
          >
            <div className="flex items-center justify-between border-b border-surface-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-betclic-red text-xs font-bold">
                  {n}
                </span>
                <h2 className="font-bold">Bet Slip</h2>
              </div>
              <div className="flex items-center gap-2">
                {n > 0 && (
                  <button
                    onClick={clear}
                    className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-white"
                  >
                    <Trash2 size={12} /> Clear
                  </button>
                )}
                <button onClick={close} aria-label="Close slip">
                  <ChevronDown className="lg:hidden" size={20} />
                  <X className="hidden lg:block" size={20} />
                </button>
              </div>
            </div>

            <div className="flex border-b border-surface-2">
              {(["SINGLE", "ACCA", "SYSTEM"] as BetMode[]).map((m) => {
                const enabled = availableModes.includes(m);
                return (
                  <button
                    key={m}
                    disabled={!enabled}
                    onClick={() => setMode(m)}
                    className={cn(
                      "flex-1 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                      effectiveMode === m
                        ? "border-b-2 border-betclic-red text-white"
                        : "text-text-secondary hover:text-white",
                      !enabled && "cursor-not-allowed opacity-35",
                    )}
                  >
                    {m === "ACCA" ? "Acca" : m.charAt(0) + m.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>

            {effectiveMode === "SYSTEM" && (
              <div className="flex gap-1.5 overflow-x-auto border-b border-surface-2 p-2 no-scrollbar">
                {SYSTEM_TYPES.map((s) => {
                  const ok = n === s.legs;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setSystemType(s.key)}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold",
                        systemType === s.key
                          ? "bg-betclic-red text-white"
                          : ok
                            ? "bg-surface-2 hover:bg-surface-3"
                            : "bg-surface-2 opacity-40",
                      )}
                    >
                      {s.label} · {s.legs} legs
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3">
              {n === 0 ? (
                <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm text-text-secondary">Your slip is empty</p>
                  <p className="text-xs text-text-tertiary">
                    Tap any odds button to add a selection
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {selections.map((sel) => (
                    <SlipRow key={`${sel.fixtureId}:${sel.marketKey}:${sel.selectionKey}`} sel={sel} onRemove={remove} />
                  ))}
                </AnimatePresence>
              )}

              {!user && n > 0 && (
                <Link
                  href="/auth"
                  className="mt-3 block rounded-lg bg-surface-2 p-3 text-center text-xs font-semibold text-betclic-red"
                >
                  Log in to place bets
                </Link>
              )}
            </div>

            {n > 0 && user && (
              <div className="border-t border-surface-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex flex-1 items-center rounded-lg bg-surface-2 px-3">
                    <input
                      type="number"
                      min={1}
                      value={stake}
                      onChange={(e) => setStake(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-transparent py-2 text-sm font-semibold tabular-nums outline-none"
                    />
                    <span className="text-[10px] font-bold text-text-secondary">PTS</span>
                  </div>
                  {QUICK_STAKES.map((q) => (
                    <button
                      key={q}
                      onClick={() => setStake(q)}
                      className="rounded-lg bg-surface-2 px-2.5 py-2 text-[11px] font-semibold hover:bg-surface-3"
                    >
                      +{q}
                    </button>
                  ))}
                </div>

                <dl className="mb-3 space-y-1 text-xs">
                  {effectiveMode === "SINGLE" ? (
                    <Row label={`${n} single bet${n > 1 ? "s" : ""} × ${stake} pts`} value={`${formatPoints(totalCost)} pts`} />
                  ) : effectiveMode === "ACCA" ? (
                    <Row label="Total odds" value={oddsToString(product)} />
                  ) : (
                    <>
                      <Row label="Combinations" value={String(combos)} />
                      <Row label="Stake per combo" value={`${perCombo} pts`} />
                      <Row label="Total stake" value={`${formatPoints(totalCost)} pts`} />
                    </>
                  )}
                  {effectiveMode !== "SYSTEM" && (
                    <Row label="Total stake" value={`${formatPoints(totalCost)} pts`} />
                  )}
                  <Row
                    label="Potential return"
                    value={`${formatPoints(potential)} pts`}
                    highlight
                  />
                </dl>

                {insufficient && (
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] text-lose">
                    <AlertCircle size={12} /> Insufficient balance — claim your daily bonus in Profile
                  </p>
                )}
                {error && (
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] text-lose">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}
                {success && (
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] text-win">
                    <Check size={12} /> {success}
                  </p>
                )}

                <button
                  onClick={place}
                  disabled={!canPlace || placing}
                  className={cn(
                    "w-full rounded-xl py-3 text-sm font-bold transition-all active:scale-[0.99]",
                    canPlace && !placing
                      ? "bg-betclic-red text-white hover:bg-betclic-red-dark"
                      : "cursor-not-allowed bg-surface-2 text-text-tertiary",
                  )}
                >
                  {placing ? "Placing…" : `Place ${effectiveMode === "SINGLE" ? `${n} bet${n > 1 ? "s" : ""}` : "bet"} · ${formatPoints(totalCost)} pts`}
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-secondary">{label}</dt>
      <dd className={cn("font-semibold tabular-nums", highlight && "text-win")}>{value}</dd>
    </div>
  );
}

function SlipRow({
  sel,
  onRemove,
}: {
  sel: Selection;
  onRemove: (fixtureId: string, marketKey: string, selectionKey: string) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="mb-2 overflow-hidden rounded-lg bg-surface-2 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-text-tertiary">{sel.fixtureLabel}</p>
          <p className="truncate text-sm font-medium">{sel.selectionName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded bg-surface-3 px-1.5 py-0.5 text-xs font-bold tabular-nums">
            {oddsToString(sel.odds)}
          </span>
          <button
            onClick={() => onRemove(sel.fixtureId, sel.marketKey, sel.selectionKey)}
            aria-label="Remove selection"
            className="text-text-tertiary hover:text-lose"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
