"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import type { FixtureRow } from "@/lib/client/api";

export interface OddsUpdate {
  fixtureId: string;
  marketKey: string;
  selectionKey: string;
  value: number;
  previousValue: number | null;
}

export interface ScoreUpdate {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  minute: number | null;
  events: FixtureRow["events"];
}

export interface BetSettled {
  betId: string;
  status: string;
  payout: number;
  pointBalance: number;
}

interface RealtimeState {
  connected: boolean;
  oddsFlash: Record<string, { value: number; direction: "up" | "down"; at: number }>;
  liveScores: Record<string, ScoreUpdate>;
  lastSettled: BetSettled | null;
  markSettledSeen: () => void;
}

export const useRealtime = create<RealtimeState>()((set) => ({
  connected: false,
  oddsFlash: {},
  liveScores: {},
  lastSettled: null,
  markSettledSeen: () => set({ lastSettled: null }),
}));

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function useSocket() {
  const setConnected = (v: boolean) => useRealtime.setState({ connected: v });
  const bootRef = useRef(false);
  const [ready, setReady] = useState(!!socket);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;

    socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 8000,
    });

    socket.on("connect", () => {
      setConnected(true);
      setReady(true);
      socket!.emit("subscribe:live");
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("odds:update", (update: OddsUpdate) => {
      const key = `${update.fixtureId}:${update.marketKey}:${update.selectionKey}`;
      const direction =
        update.previousValue === null || update.value === update.previousValue
          ? "up"
          : update.value > update.previousValue
            ? "up"
            : "down";
      useRealtime.setState((s) => ({
        oddsFlash: { ...s.oddsFlash, [key]: { value: update.value, direction, at: Date.now() } },
      }));
    });

    socket.on("score:update", (update: ScoreUpdate) => {
      useRealtime.setState((s) => ({
        liveScores: { ...s.liveScores, [update.fixtureId]: update },
      }));
    });

    socket.on("bet:settled", (n: BetSettled) => {
      useRealtime.setState({ lastSettled: n });
    });

    return () => {
      bootRef.current = false;
    };
  }, []);

  return { socket, ready };
}
