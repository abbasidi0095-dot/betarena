"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Radio, Trophy, LayoutGrid, User } from "lucide-react";
import { useSlip } from "@/stores/slip";
import { cn } from "@/lib/client/cn";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/my-bets", label: "Bets", icon: LayoutGrid },
  { href: "/leaderboard", label: "Board", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  const slipCount = useSlip((s) => s.selections.length);
  const openSlip = useSlip((s) => s.open);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-2 bg-bg/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg items-end justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ href, label, icon: Icon }, i) => {
          const active = pathname === href;
          return (
            <div key={href} className={cn("flex-1", i === 2 ? "relative" : "")}>
              {i === 2 && slipCount > 0 ? (
                <button
                  onClick={openSlip}
                  className="mx-auto -mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-betclic-red text-white shadow-lg shadow-betclic-red/30"
                  aria-label="Open bet slip"
                >
                  <span className="text-sm font-bold tabular-nums">{slipCount}</span>
                </button>
              ) : (
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[10px]",
                    active ? "text-betclic-red" : "text-text-secondary",
                  )}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
