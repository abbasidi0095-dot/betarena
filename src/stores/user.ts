"use client";

import { create } from "zustand";
import { api, type MeResponse } from "@/lib/client/api";

interface UserState {
  user: MeResponse["user"] | null;
  loading: boolean;
  soundEnabled: boolean;
  fetchMe: () => Promise<void>;
  setBalance: (balance: number) => void;
  setUser: (user: MeResponse["user"] | null) => void;
  toggleSound: () => void;
  initSound: () => void;
}

export const useUser = create<UserState>()((set, get) => ({
  user: null,
  loading: true,
  soundEnabled: false,
  fetchMe: async () => {
    const res = await api.get<MeResponse>("/api/me");
    set({ user: res.ok ? res.data!.user : null, loading: false });
  },
  setBalance: (balance) => {
    const u = get().user;
    if (u) set({ user: { ...u, pointBalance: balance } });
  },
  setUser: (user) => set({ user, loading: false }),
  toggleSound: () => {
    const next = !get().soundEnabled;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("betarena-sound", next ? "1" : "0");
    }
    set({ soundEnabled: next });
  },
  initSound: () => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("betarena-sound");
      set({ soundEnabled: stored === "1" });
    }
  },
}));
