"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X, Trophy } from "lucide-react";
import { api, type LeagueRow } from "@/lib/client/api";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);

  useEffect(() => {
    void api.get<{ leagues: LeagueRow[] }>("/api/leagues").then((res) => {
      if (res.ok) setLeagues(res.data!.leagues);
    });
  }, []);

  const content = (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
        Competitions
      </p>
      {leagues.length === 0 && (
        <div className="px-2 py-1 text-xs text-text-tertiary">Loading leagues…</div>
      )}
      {leagues.map((l) => (
        <Link
          key={l.id}
          href={`/league/${l.id}`}
          onClick={onClose}
          className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-white"
        >
          <span className="truncate">{l.name}</span>
          <span className="ml-2 shrink-0 rounded-full bg-surface-2 px-1.5 text-[10px] tabular-nums text-text-tertiary">
            {l.fixtureCount}
          </span>
        </Link>
      ))}
      <Link
        href="/leaderboard"
        onClick={onClose}
        className="mt-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-win hover:bg-surface-2"
      >
        <Trophy size={14} /> Leaderboard
      </Link>
    </nav>
  );

  return (
    <>
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 border-r border-surface-2 lg:block">
        {content}
      </aside>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-surface-2 bg-bg lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-surface-2 px-4 py-3">
                <span className="font-bold">Competitions</span>
                <button onClick={onClose} aria-label="Close">
                  <X size={18} />
                </button>
              </div>
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
