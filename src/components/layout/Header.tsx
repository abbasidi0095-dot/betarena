"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Volume2,
  VolumeX,
  Trophy,
  Gift,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useUser } from "@/stores/user";
import { useSlip } from "@/stores/slip";
import { api, type FixtureRow } from "@/lib/client/api";
import { formatPoints } from "@/lib/client/format";
import { SearchOverlay } from "@/components/search/SearchOverlay";

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const router = useRouter();
  const { user, fetchMe, soundEnabled, toggleSound, initSound } = useUser();
  const slipCount = useSlip((s) => s.selections.length);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchMe();
    initSound();
  }, [fetchMe, initSound]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const logout = async () => {
    await api.post("/api/auth/logout");
    useUser.getState().setUser(null);
    router.push("/auth");
    router.refresh();
  };

  return (
    <header className="z-40 border-b border-black/30 bg-betclic-red">
      <div className="mx-auto flex h-13 max-w-[1400px] items-center gap-3 px-3 py-2 lg:px-6">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-white/85 hover:bg-black/15 lg:hidden"
          aria-label="Open leagues"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>

        <Link href="/" className="flex items-center gap-1.5">
          <span className="rounded-md bg-white px-2 py-0.5 text-lg font-black italic tracking-tight text-betclic-red">
            Bet
          </span>
          <span className="hidden text-lg font-black italic tracking-tight text-white sm:inline">
            Arena
          </span>
        </Link>

        <button
          onClick={() => setSearchOpen(true)}
          className="ml-1 flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-left text-xs text-white/80 backdrop-blur transition-colors hover:bg-white/25 lg:ml-4 lg:max-w-md"
        >
          <Search size={14} className="shrink-0" />
          <span className="truncate">Search matches, leagues…</span>
        </button>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={toggleSound}
            className="hidden rounded-lg p-2 text-white/85 hover:bg-black/15 sm:block"
            aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {user ? (
            <>
              <Link
                href="/my-bets"
                className="relative hidden rounded-lg p-2 text-white/85 hover:bg-black/15 sm:block"
                aria-label="My bets"
              >
                <Trophy size={16} />
                {slipCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-bg text-[10px] font-bold text-betclic-red">
                    {slipCount}
                  </span>
                )}
              </Link>

              <div className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-1.5 backdrop-blur sm:gap-1.5 sm:px-3">
                <span className="text-xs font-bold tabular-nums text-white">
                  {formatPoints(user.pointBalance)}
                </span>
                <span className="hidden text-[10px] font-medium text-white/70 sm:inline">PTS</span>
                {(user.canClaimDailyBonus || user.canRescue) && (
                  <Link href="/profile" aria-label="Claim bonus" className="hidden sm:block">
                    <Gift size={14} className="text-win" />
                  </Link>
                )}
              </div>

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold uppercase text-betclic-red"
                  aria-label="Profile menu"
                >
                  {user.username.slice(0, 2)}
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-surface-2 bg-surface py-1 shadow-xl"
                    >
                      <Link
                        href="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-2"
                      >
                        <UserIcon size={14} /> {user.username}
                      </Link>
                      <Link
                        href="/friends"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-2"
                      >
                        <Trophy size={14} /> Friends
                      </Link>
                      <button
                        onClick={logout}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-2"
                      >
                        <LogOut size={14} /> Log out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <Link
              href="/auth"
              className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-betclic-red hover:bg-white/90"
            >
              Log in
            </Link>
          )}
        </div>
      </div>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}

export type { FixtureRow };
