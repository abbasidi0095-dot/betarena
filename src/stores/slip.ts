"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Selection {
  fixtureId: string;
  marketKey: string;
  selectionKey: string;
  selectionName: string;
  fixtureLabel: string;
  odds: number;
}

interface SlipState {
  selections: Selection[];
  isOpen: boolean;
  toggle: (sel: Selection) => void;
  add: (sel: Selection) => void;
  remove: (fixtureId: string, marketKey: string, selectionKey: string) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  updateOdds: (
    fixtureId: string,
    marketKey: string,
    selectionKey: string,
    odds: number,
  ) => void;
}

/** Same fixture + same market = replace; same exact selection = remove (toggle). */
export const useSlip = create<SlipState>()(
  persist(
    (set, get) => ({
      selections: [],
      isOpen: false,
      toggle: (sel) => {
        const { selections } = get();
        const exact = selections.find(
          (s) =>
            s.fixtureId === sel.fixtureId &&
            s.marketKey === sel.marketKey &&
            s.selectionKey === sel.selectionKey,
        );
        if (exact) {
          set({ selections: selections.filter((s) => s !== exact) });
          return;
        }
        const sameMarket = selections.filter(
          (s) => !(s.fixtureId === sel.fixtureId && s.marketKey === sel.marketKey),
        );
        set({ selections: [...sameMarket, sel], isOpen: true });
      },
      add: (sel) => {
        const { selections } = get();
        const sameMarket = selections.filter(
          (s) => !(s.fixtureId === sel.fixtureId && s.marketKey === sel.marketKey),
        );
        set({ selections: [...sameMarket, sel] });
      },
      remove: (fixtureId, marketKey, selectionKey) =>
        set({
          selections: get().selections.filter(
            (s) =>
              !(
                s.fixtureId === fixtureId &&
                s.marketKey === marketKey &&
                s.selectionKey === selectionKey
              ),
          ),
        }),
      clear: () => set({ selections: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      updateOdds: (fixtureId, marketKey, selectionKey, odds) =>
        set({
          selections: get().selections.map((s) =>
            s.fixtureId === fixtureId &&
            s.marketKey === marketKey &&
            s.selectionKey === selectionKey
              ? { ...s, odds }
              : s,
          ),
        }),
    }),
    {
      name: "betarena-slip",
      partialize: (state) => ({ selections: state.selections }),
    },
  ),
);

export function isSelected(
  selections: Selection[],
  fixtureId: string,
  marketKey: string,
  selectionKey: string,
): boolean {
  return selections.some(
    (s) =>
      s.fixtureId === fixtureId &&
      s.marketKey === marketKey &&
      s.selectionKey === selectionKey,
  );
}

export function totalOdds(selections: Selection[]): number {
  return selections.reduce((acc, s) => acc * s.odds, 1);
}
