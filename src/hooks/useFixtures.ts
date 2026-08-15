"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, type FixturesResponse, type FixtureRow } from "@/lib/client/api";
import { useRealtime } from "@/hooks/useSocket";

export function useFixtures(
  scope: "top" | "live" | "upcoming",
  leagueId?: string,
) {
  const [fixtures, setFixtures] = useState<FixtureRow[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dataStale, setDataStale] = useState(false);
  const liveScores = useRealtime((s) => s.liveScores);
  const requestId = useRef(0);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      const qs = leagueId
        ? `?scope=league&leagueId=${leagueId}&offset=${offset}`
        : `?scope=${scope}&offset=${offset}`;
      const res = await api.get<FixturesResponse>(`/api/fixtures${qs}`);
      if (!res.ok) return;
      const page = res.data!.fixtures;
      setFixtures((prev) =>
        append ? [...(prev ?? []), ...page] : page,
      );
      setHasMore(res.data!.hasMore);
      setNextOffset(res.data!.offset);
      setDataStale(res.data!.dataStale);
    },
    [scope, leagueId],
  );

  useEffect(() => {
    const id = ++requestId.current;
    setFixtures(null);
    void loadPage(0, false);
    const t = setInterval(() => {
      if (id === requestId.current) void loadPage(0, false);
    }, 60_000);
    return () => {
      clearInterval(t);
      requestId.current++;
    };
  }, [loadPage]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await loadPage(nextOffset, true);
    setLoadingMore(false);
  };

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
      status: (upd.status ?? "LIVE") as FixtureRow["status"],
    };
  });

  return { fixtures: merged ?? null, dataStale, hasMore, loadMore, loadingMore };
}
