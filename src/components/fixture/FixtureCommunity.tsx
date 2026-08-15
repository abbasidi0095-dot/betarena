"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { BetFeedCard, type CommunityBet } from "@/components/community/BetFeedCard";

export function FixtureCommunity({ fixtureId }: { fixtureId: string }) {
  const [bets, setBets] = useState<CommunityBet[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<{ bets: CommunityBet[] }>(`/api/community?tab=feed&fixtureId=${fixtureId}`).then((res) => {
      if (!cancelled && res.ok) setBets(res.data!.bets);
    });
    return () => {
      cancelled = true;
    };
  }, [fixtureId]);

  if (bets === null) {
    return <p className="py-6 text-center text-sm text-text-tertiary">Loading…</p>;
  }
  if (bets.length === 0) {
    return (
      <div className="rounded-xl border border-card-border bg-card-dark p-6 text-center">
        <p className="text-sm text-text-tertiary">No public bets on this match yet.</p>
      </div>
    );
  }
  return <div className="space-y-2">{bets.map((b) => <BetFeedCard key={b.id} bet={b} />)}</div>;
}
