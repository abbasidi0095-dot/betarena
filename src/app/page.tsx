"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Feed } from "@/components/feed/Feed";
import { PromotionBanner } from "@/components/feed/PromotionBanner";

export default function HomePage() {
  return (
    <AppShell>
      <PromotionBanner />
      <Feed scope="top" />
    </AppShell>
  );
}
