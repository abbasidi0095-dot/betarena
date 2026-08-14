"use client";

import { useEffect, useState } from "react";
import { api, type FixturesResponse, type FixtureRow } from "@/lib/client/api";
import { useRealtime } from "@/hooks/useSocket";

export function useFixtures(
  scope: "top" | "live" | "upcoming",
  leagueId?: string,
) {
  const [fixtures, setFixtures] = useState<FixtureRow[] | null>(null);
  const [dataStale, setDataStale] = useState(false);
  const liveScores = useRealtime((s) => s.liveScores);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const qs = leagueId ? `?scope=league&leagueId=${leagueId}` : `?scope=${scope}`;
      const res = await api.get<FixturesResponse>(`/api/fixtures${qs}`);
      if (!cancelled) {
        if (res.ok) {
          setFixtures(res.data!.fixtures);
          setDataStale(res.data!.dataStale);
        } else {
          setFixtures([]);
        }
      }
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [scope, leagueId]);

  // Merge live score updates into displayed fixtures
  const merged = fixtures?.map((f) => {
    const upd = liveScores[f.id];
    if (!upd) return f;
    return {
      ...f,
      homeScore: upd.homeScore,
      awayScore: upd.awayScore,
      minute: upd.minute,
      events: upd.events,
      status: "LIVE" as const,
    };
  });

  return { fixtures: merged ?? null, dataStale };
}
