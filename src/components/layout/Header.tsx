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
import { cn } from "@/lib/client/cn";
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
    <header className="sticky top-0 z-40 border-b border-surface-2 bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-3 lg:px-6">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-2 hover:bg-surface-2 lg:hidden"
          aria-label="Open leagues"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>

        <Link href="/" className="flex items-center gap-2">
          <span className="rounded-md bg-betclic-red px-2 py-0.5 text-lg font-black italic tracking-tight text-white">
            Bet
          </span>
          <span className="hidden text-lg font-bold italic tracking-tight sm:inline">
            Arena
          </span>
        </Link>

        <button
          onClick={() => setSearchOpen(true)}
          className="ml-1 flex flex-1 items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-left text-xs text-text-secondary hover:bg-surface-3 lg:ml-4 lg:max-w-md"
        >
          <Search size={14} />
          <span className="truncate">Search matches, leagues…</span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="rounded-lg p-2 text-text-secondary hover:bg-surface-2 hover:text-white"
            aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {user ? (
            <>
              <Link
                href="/my-bets"
                className={cn(
                  "relative hidden rounded-lg p-2 text-text-secondary hover:bg-surface-2 hover:text-white sm:block",
                )}
                aria-label="My bets"
              >
                <Trophy size={16} />
                {slipCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-betclic-red text-[10px] font-bold text-white">
                    {slipCount}
                  </span>
                )}
              </Link>

              <div className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5">
                <span className="text-xs font-bold tabular-nums text-win">
                  {formatPoints(user.pointBalance)}
                </span>
                <span className="text-[10px] font-medium text-text-secondary">PTS</span>
                {(user.canClaimDailyBonus || user.canRescue) && (
                  <Link href="/profile" aria-label="Claim bonus">
                    <Gift size={14} className="text-win" />
                  </Link>
                )}
              </div>

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-betclic-red text-sm font-bold uppercase text-white"
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
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2"
                      >
                        <UserIcon size={14} /> {user.username}
                      </Link>
                      <Link
                        href="/friends"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2"
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
              className="rounded-full bg-betclic-red px-4 py-1.5 text-xs font-bold text-white hover:bg-betclic-red-dark"
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
