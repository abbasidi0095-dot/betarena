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
  /** Increments on every add/remove — drives pop animations on slip UI. */
  lastAdded: number;
  /** Name of the most recently added selection (toast). */
  lastAddedName: string | null;
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
      lastAdded: 0,
      lastAddedName: null,
      toggle: (sel) => {
        const { selections, lastAdded } = get();
        const exact = selections.find(
          (s) =>
            s.fixtureId === sel.fixtureId &&
            s.marketKey === sel.marketKey &&
            s.selectionKey === sel.selectionKey,
        );
        if (exact) {
          set({
            selections: selections.filter((s) => s !== exact),
            lastAdded: lastAdded + 1,
            lastAddedName: null,
          });
          return;
        }
        const sameMarket = selections.filter(
          (s) => !(s.fixtureId === sel.fixtureId && s.marketKey === sel.marketKey),
        );
        // Betclic behavior: never auto-open the slip — show the FAB pop instead
        set({
          selections: [...sameMarket, sel],
          lastAdded: lastAdded + 1,
          lastAddedName: sel.selectionName,
        });
      },
      add: (sel) => {
        const { selections, lastAdded } = get();
        const sameMarket = selections.filter(
          (s) => !(s.fixtureId === sel.fixtureId && s.marketKey === sel.marketKey),
        );
        set({
          selections: [...sameMarket, sel],
          lastAdded: lastAdded + 1,
          lastAddedName: sel.selectionName,
        });
      },
      remove: (fixtureId, marketKey, selectionKey) =>
        set((s) => ({
          selections: s.selections.filter(
            (sel) =>
              !(
                sel.fixtureId === fixtureId &&
                sel.marketKey === marketKey &&
                sel.selectionKey === selectionKey
              ),
          ),
          lastAdded: s.lastAdded + 1,
          lastAddedName: null,
        })),
      clear: () => set({ selections: [], lastAddedName: null }),
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
