"use client";

import { use } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Feed } from "@/components/feed/Feed";
import { StandingsTable } from "@/components/feed/StandingsTable";

export default function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell>
      <StandingsTable leagueId={id} />
      <Feed scope="league" leagueId={id} title="League" />
    </AppShell>
  );
}
