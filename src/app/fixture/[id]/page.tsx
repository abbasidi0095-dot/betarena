"use client";

import { use, useEffect, useState } from "react";
import { api, type FixtureRow } from "@/lib/client/api";import { OddsButton } from "@/components/feed/OddsButton";
import { ScoreBoard } from "@/components/tracker/ScoreBoard";
import { EventFeed } from "@/components/tracker/EventFeed";
import { PitchVisualizer } from "@/components/tracker/PitchVisualizer";
import { MARKET_LABELS } from "@/lib/client/format";

export default function FixturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [fixture, setFixture] = useState<FixtureRow | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await api.get<{ fixture: FixtureRow }>(`/api/fixtures/${id}`);
      if (cancelled) return;
      if (res.ok) setFixture(res.data!.fixture);
      else setNotFound(true);
    };
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id]);

  if (notFound) {
    return <p className="py-20 text-center text-sm text-text-tertiary">Match not found</p>;
  }
  if (!fixture) {
    return <p className="py-20 text-center text-sm text-text-tertiary">Loading match…</p>;
  }

  const label = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
  const hasEvents = fixture.events.length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-2 text-xs text-text-secondary">
        {fixture.league.country} · {fixture.league.name}
      </p>
      <ScoreBoard fixture={fixture} />

      <div className="mt-5 space-y-4">
        {(["h2h", "totals", "btts"] as const).map((marketKey) => {
          const market = fixture.markets.find((m) => m.key === marketKey);
          if (!market || market.odds.length === 0) return null;
          const order =
            marketKey === "h2h"
              ? ["home", "draw", "away"]
              : marketKey === "totals"
                ? ["over_2.5", "under_2.5"]
                : ["btts_yes", "btts_no"];
          return (
            <div key={marketKey} className="rounded-xl bg-surface p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                {MARKET_LABELS[marketKey]}
              </p>
              <div className="flex gap-2">
                {order.map((selectionKey) => {
                  const odds = market.odds.find((o) => o.selectionKey === selectionKey);
                  if (!odds) return null;
                  return (
                    <div key={selectionKey} className="flex-1">
                      <OddsButton
                        fixtureId={fixture.id}
                        fixtureLabel={label}
                        marketKey={marketKey}
                        selectionKey={selectionKey}
                        selectionName={
                          selectionKey === "home"
                            ? `${fixture.homeTeam} to win`
                            : selectionKey === "away"
                              ? `${fixture.awayTeam} to win`
                              : selectionKey === "draw"
                                ? "Draw"
                                : selectionKey === "over_2.5"
                                  ? "Over 2.5 goals"
                                  : selectionKey === "under_2.5"
                                    ? "Under 2.5 goals"
                                    : selectionKey === "btts_yes"
                                      ? "BTTS — Yes"
                                      : "BTTS — No"
                        }
                        value={odds.value}
                        disabled={fixture.status === "FINISHED" || market.status !== "OPEN"}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {fixture.status !== "SCHEDULED" && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-bold">Match Events</h2>
            {hasEvents ? (
              <EventFeed events={fixture.events} />
            ) : (
              <p className="rounded-xl bg-surface p-4 text-xs text-text-tertiary">
                No events yet
              </p>
            )}
          </div>
          <div>
            <h2 className="mb-2 text-sm font-bold">Pitch</h2>
            <PitchVisualizer events={fixture.events} />
          </div>
        </div>
      )}
    </div>
  );
}
