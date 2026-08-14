"use client";

import { useRouter } from "next/navigation";
import { Gift, LifeBuoy } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useUser } from "@/stores/user";
import { api } from "@/lib/client/api";
import { formatPoints } from "@/lib/client/format";
import { cn } from "@/lib/client/cn";

export default function ProfilePage() {
  const router = useRouter();
  const { user, fetchMe, loading } = useUser();

  const claimDaily = async () => {
    const res = await api.post<{ pointBalance: number }>("/api/me/daily-bonus");
    if (res.ok) {
      await fetchMe();
    }
  };

  const claimRescue = async () => {
    const res = await api.post<{ pointBalance: number }>("/api/me/rescue");
    if (res.ok) {
      await fetchMe();
    }
  };

  if (loading) {
    return (
      <AppShell>
        <p className="py-20 text-center text-sm text-text-tertiary">Loading…</p>
      </AppShell>
    );
  }

  if (!user) {
    router.replace("/auth");
    return (
      <AppShell>
        <p className="py-20 text-center text-sm text-text-tertiary">Redirecting…</p>
      </AppShell>
    );
  }

  const decided = user.stats.betsWon + user.stats.betsLost;
  const winPct = decided > 0 ? Math.round((user.stats.betsWon / decided) * 100) : 0;
  const roi =
    user.stats.totalStaked > 0
      ? Math.round(
          ((user.stats.totalWon - user.stats.totalStaked) / user.stats.totalStaked) * 100,
        )
      : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface p-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-betclic-red text-lg font-black uppercase">
            {user.username.slice(0, 2)}
          </span>
          <div className="flex-1">
            <p className="font-bold">{user.username}</p>
            <p className="text-xs text-text-secondary">
              Balance{" "}
              <span className="font-bold tabular-nums text-win">
                {formatPoints(user.pointBalance)} pts
              </span>
            </p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat label="Won" value={`${winPct}%`} />
          <Stat label="ROI" value={`${roi > 0 ? "+" : ""}${roi}%`} positive={roi > 0} />
          <Stat label="Bets" value={String(decided)} />
        </div>

        <div className="space-y-3">
          <button
            onClick={claimDaily}
            disabled={!user.canClaimDailyBonus}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors",
              user.canClaimDailyBonus
                ? "border-win/40 bg-win/10 hover:bg-win/15"
                : "border-surface-2 bg-surface opacity-60",
            )}
          >
            <Gift size={22} className={user.canClaimDailyBonus ? "text-win" : "text-text-tertiary"} />
            <div>
              <p className="text-sm font-bold">Daily bonus</p>
              <p className="text-[11px] text-text-secondary">
                {user.canClaimDailyBonus ? "Claim your +100 points now" : "Already claimed — back in 24h"}
              </p>
            </div>
          </button>

          <button
            onClick={claimRescue}
            disabled={!user.canRescue}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors",
              user.canRescue
                ? "border-betclic-red/50 bg-betclic-red/10 hover:bg-betclic-red/15"
                : "border-surface-2 bg-surface opacity-60",
            )}
          >
            <LifeBuoy
              size={22}
              className={user.canRescue ? "text-betclic-red" : "text-text-tertiary"}
            />
            <div>
              <p className="text-sm font-bold">Rescue top-up</p>
              <p className="text-[11px] text-text-secondary">
                {user.canRescue
                  ? "Balance at zero? Claim +500 points"
                  : "Available when your balance hits zero"}
              </p>
            </div>
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-xl bg-surface p-3 text-center">
      <p
        className={cn(
          "text-lg font-bold tabular-nums",
          positive === true && "text-win",
          positive === false && "text-lose",
        )}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-text-tertiary">{label}</p>
    </div>
  );
}
