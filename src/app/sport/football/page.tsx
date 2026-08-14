"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Feed } from "@/components/feed/Feed";

export default function FootballPage() {
  return (
    <AppShell>
      <Feed scope="top" title="Football" />
    </AppShell>
  );
}
