"use client";

import { use } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Feed } from "@/components/feed/Feed";

export default function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AppShell>
      <Feed scope="league" leagueId={id} title="League" />
    </AppShell>
  );
}
