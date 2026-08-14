"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { api, type FixtureRow, type LeagueRow } from "@/lib/client/api";
import { formatKickoff } from "@/lib/client/format";

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setFixtures([]);
      setLeagues([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await api.get<{ fixtures: FixtureRow[]; leagues: LeagueRow[] }>(
        `/api/search?q=${encodeURIComponent(q.trim())}`,
      );
      if (res.ok) {
        setFixtures(res.data!.fixtures);
        setLeagues(res.data!.leagues);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/70 p-4 pt-[10vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: -12, opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-surface-2 bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-surface-2 px-4 py-3">
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search teams or leagues…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-tertiary"
              />
              <button onClick={onClose} aria-label="Close search">
                <X size={18} className="text-text-secondary" />
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {leagues.map((l) => (
                <Link
                  key={l.id}
                  href={`/league/${l.id}`}
                  onClick={onClose}
                  className="block rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-white"
                >
                  {l.country} · {l.name}
                </Link>
              ))}
              {fixtures.map((f) => (
                <Link
                  key={f.id}
                  href={`/fixture/${f.id}`}
                  onClick={onClose}
                  className="block rounded-lg px-3 py-2 hover:bg-surface-2"
                >
                  <p className="text-sm">
                    {f.homeTeam} <span className="text-text-tertiary">vs</span> {f.awayTeam}
                  </p>
                  <p className="text-[11px] text-text-tertiary">
                    {f.league.name} · {formatKickoff(f.kickoff)}
                  </p>
                </Link>
              ))}
              {q.trim().length >= 2 && fixtures.length === 0 && leagues.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-text-tertiary">
                  No matches found
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
