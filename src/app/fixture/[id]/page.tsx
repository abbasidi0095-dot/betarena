"use client";

import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Target, SplitSquareHorizontal, Dice5, Users, Goal } from "lucide-react";
import { api, type FixtureRow } from "@/lib/client/api";
import { OddsButton } from "@/components/feed/OddsButton";
import { ScoreBoard } from "@/components/tracker/ScoreBoard";
import { EventFeed } from "@/components/tracker/EventFeed";
import { PitchVisualizer } from "@/components/tracker/PitchVisualizer";
import { TeamCrest } from "@/components/feed/TeamCrest";
// MARKET_LABELS unused here
import type { DerivedMarkets, DerivedSelection } from "@/lib/betting/derived-markets";

interface FixtureDetail {
  fixture: FixtureRow;
  derivedMarkets: DerivedMarkets;
}

export default function FixturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<FixtureDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [openPanel, setOpenPanel] = useState<string | null>("h2h");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await api.get<FixtureDetail>(`/api/fixtures/${id}`);
      if (cancelled) return;
      if (res.ok) setData(res.data!);
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
  if (!data) {
    return <p className="py-20 text-center text-sm text-text-tertiary">Loading match…</p>;
  }

  const { fixture, derivedMarkets } = data;
  const label = `${fixture.homeTeam} vs ${fixture.awayTeam}`;
  const bettingDisabled = fixture.status === "FINISHED";

  const markets: {
    key: string;
    title: string;
    icon: React.ReactNode;
    selections: DerivedSelection[];
  }[] = [
    {
      key: "h2h",
      title: "Match Result",
      icon: <Goal size={14} />,
      selections: fixture.markets
        .find((m) => m.key === "h2h")
        ?.odds.map((o) => ({
          selectionKey: o.selectionKey,
          name:
            o.selectionKey === "home"
              ? `${fixture.homeTeam} to win`
              : o.selectionKey === "away"
                ? `${fixture.awayTeam} to win`
                : "Draw",
          odds: o.value,
        })) ?? [],
    },
    {
      key: "totals",
      title: "Over / Under 2.5 Goals",
      icon: <Dice5 size={14} />,
      selections: fixture.markets
        .find((m) => m.key === "totals")
        ?.odds.map((o) => ({
          selectionKey: o.selectionKey,
          name: o.selectionKey === "over_2.5" ? "Over 2.5 goals" : "Under 2.5 goals",
          odds: o.value,
        })) ?? [],
    },
    {
      key: "btts",
      title: "Both Teams to Score",
      icon: <SplitSquareHorizontal size={14} />,
      selections: fixture.markets
        .find((m) => m.key === "btts")
        ?.odds.map((o) => ({
          selectionKey: o.selectionKey,
          name: o.selectionKey === "btts_yes" ? "BTTS — Yes" : "BTTS — No",
          odds: o.value,
        })) ?? [],
    },
    {
      key: "dc",
      title: "Double Chance",
      icon: <SplitSquareHorizontal size={14} />,
      selections: derivedMarkets.dc,
    },
    {
      key: "handicap",
      title: "Handicap",
      icon: <Target size={14} />,
      selections: derivedMarkets.handicap,
    },
    {
      key: "exact",
      title: "Exact Goals",
      icon: <Dice5 size={14} />,
      selections: derivedMarkets.exact,
    },
    {
      key: "scorer",
      title: "Anytime Scorer",
      icon: <Users size={14} />,
      selections: derivedMarkets.scorers,
    },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-text-secondary">
          {fixture.league.country} · {fixture.league.name}
        </p>
        <button
          onClick={() => setOpenPanel(openPanel === "all" ? null : "all")}
          className="text-[11px] font-semibold text-betclic-red"
        >
          {openPanel === "all" ? "Collapse all" : "Show all markets"}
        </button>
      </div>

      <ScoreBoard fixture={fixture} />

      {/* team headers with crests */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3">
        <div className="flex items-center gap-2.5">
          <TeamCrest name={fixture.homeTeam} size={30} />
          <span className="text-sm font-semibold">{fixture.homeTeam}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold">{fixture.awayTeam}</span>
          <TeamCrest name={fixture.awayTeam} size={30} />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {markets.map((m) => (
          <MarketPanel
            key={m.key}
            market={m}
            open={openPanel === m.key || openPanel === "all"}
            onToggle={() => setOpenPanel(openPanel === m.key ? null : m.key)}
            fixture={fixture}
            label={label}
            disabled={bettingDisabled}
          />
        ))}
      </div>

      {fixture.status !== "SCHEDULED" && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-bold">Match Events</h2>
            {fixture.events.length > 0 ? (
              <EventFeed events={fixture.events} />
            ) : (
              <p className="rounded-xl bg-surface p-4 text-xs text-text-tertiary">No events yet</p>
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

function MarketPanel({
  market,
  open,
  onToggle,
  fixture,
  label,
  disabled,
}: {
  market: { key: string; title: string; icon: React.ReactNode; selections: DerivedSelection[] };
  open: boolean;
  onToggle: () => void;
  fixture: FixtureRow;
  label: string;
  disabled: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3.5 py-3 text-left"
      >
        <span className="text-text-tertiary">{market.icon}</span>
        <span className="flex-1 text-xs font-bold uppercase tracking-wider">
          {market.title}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} className="text-text-tertiary" />
        </motion.span>
      </button>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="grid grid-cols-3 gap-1.5 px-3.5 pb-3.5">
            {market.selections.map((sel) => (
              <OddsButton
                key={sel.selectionKey}
                fixtureId={fixture.id}
                fixtureLabel={label}
                marketKey={market.key}
                selectionKey={sel.selectionKey}
                selectionName={sel.name}
                value={sel.odds}
                disabled={disabled}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
