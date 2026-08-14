"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Feed } from "@/components/feed/Feed";

export default function LivePage() {
  return (
    <AppShell>
      <Feed scope="live" title="Live Now" />
    </AppShell>
  );
}
