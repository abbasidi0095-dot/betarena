"use client";

import Link from "next/link";
import { Gift, Coins } from "lucide-react";
import { useUser } from "@/stores/user";

export function PromotionBanner() {
  const user = useUser((s) => s.user);

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-hover p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-black/60">
          Free-to-play
        </p>
        <p className="mt-1 text-sm font-bold text-black">
          €1,000 on the house. No real money — ever.
        </p>
      </div>
      {user ? (
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-2xl border border-surface-2 bg-surface p-4 transition-colors hover:bg-surface-2/60"
        >
          {(user.canClaimDailyBonus || user.canRescue) ? (
            <Gift size={22} className="shrink-0 text-win" />
          ) : (
            <Coins size={22} className="shrink-0 text-text-secondary" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {(user.canClaimDailyBonus || user.canRescue) ? "Bonus available" : "Daily bonus"}
            </p>
            <p className="text-[11px] text-text-secondary">
              {(user.canClaimDailyBonus || user.canRescue)
                ? "Claim +€100 (or a rescue top-up) in your profile"
                : "Come back tomorrow for +€100 more"}
            </p>
          </div>
        </Link>
      ) : (
        <Link
          href="/auth"
          className="flex items-center gap-3 rounded-2xl border border-surface-2 bg-surface p-4 transition-colors hover:bg-surface-2/60"
        >
          <Coins size={22} className="shrink-0 text-win" />
          <div>
            <p className="text-sm font-semibold">Join Abbet</p>
            <p className="text-[11px] text-text-secondary">
              Register and get €1,000 instantly
            </p>
          </div>
        </Link>
      )}
    </div>
  );
}
