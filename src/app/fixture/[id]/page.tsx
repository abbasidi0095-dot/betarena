"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, ArrowLeft, Target, SplitSquareHorizontal, Dice5, Users, Goal } from "lucide-react";
import { api, type FixtureRow } from "@/lib/client/api";
import { AppShell } from "@/components/layout/AppShell";
import { OddsButton } from "@/components/feed/OddsButton";
import { ScoreBoard } from "@/components/tracker/ScoreBoard";
import { EventFeed } from "@/components/tracker/EventFeed";
import { PitchVisualizer } from "@/components/tracker/PitchVisualizer";
import { TeamCrest } from "@/components/feed/TeamCrest";
import type { DerivedMarkets, DerivedSelection } from "@/lib/betting/derived-markets";

interface FixtureDetail {
  fixture: FixtureRow;
  derivedMarkets: DerivedMarkets;
}

export default function FixturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
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

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  if (notFound) {
    return (
      <AppShell>
        <p className="py-20 text-center text-sm text-text-tertiary">Match not found</p>
      </AppShell>
    );
  }
  if (!data) {
    return (
      <AppShell>
        <p className="py-20 text-center text-sm text-text-tertiary">Loading match…</p>
      </AppShell>
    );
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
        })) ?? derivedMarkets.btts,
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
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="sticky top-0 z-20 -mx-3 mb-3 flex items-center gap-1 border-b border-surface-2/60 bg-bg/90 px-3 py-2 backdrop-blur lg:-mx-6 lg:px-6">
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-3 hover:text-white"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <p className="min-w-0 flex-1 truncate text-right text-[11px] text-text-tertiary">
            {fixture.league.country} · {fixture.league.name}
          </p>
          <button
            onClick={() => setOpenPanel(openPanel === "all" ? null : "all")}
            className="shrink-0 text-[11px] font-semibold text-betclic-red"
          >
            {openPanel === "all" ? "Collapse" : "All markets"}
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

      {fixture.lineups && fixture.lineups.length >= 2 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold">Lineups</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {fixture.lineups.map((team) => (
              <div key={team.team} className="rounded-xl bg-surface p-3">
                <div className="mb-2 flex items-center gap-2">
                  <TeamCrest
                    name={team.teamName}
                    logo={team.team === "home" ? fixture.homeLogo : fixture.awayLogo}
                    size={24}
                  />
                  <p className="truncate text-sm font-semibold">{team.teamName}</p>
                  {team.formation && (
                    <span className="ml-auto rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
                      {team.formation}
                    </span>
                  )}
                </div>
                <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {team.players.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px]"
                    >
                      {p.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.photo}
                          alt=""
                          className="h-4 w-4 rounded-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="h-4 w-4 rounded-full bg-surface-3" />
                      )}
                      <span className="truncate">{p.name}</span>
                      <span className="ml-auto shrink-0 text-[9px] uppercase text-text-tertiary">
                        {p.pos}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

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
    </AppShell>
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
  const twoCol = ["dc", "handicap", "exact"].includes(market.key);
  return (
    <div className="overflow-hidden rounded-xl border border-card-border bg-card-dark">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3.5 py-3 text-left"
      >
        <span className="text-betclic-gold">{market.icon}</span>
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
          <div className={twoCol ? "grid grid-cols-2 gap-1.5 px-3.5 pb-3.5" : "grid grid-cols-3 gap-1.5 px-3.5 pb-3.5"}>
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
                probBar
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
