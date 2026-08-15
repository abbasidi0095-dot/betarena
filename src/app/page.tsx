"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Feed } from "@/components/feed/Feed";
import { PromotionBanner } from "@/components/feed/PromotionBanner";
import { TopBetsMarquee } from "@/components/feed/TopBetsMarquee";

export default function HomePage() {
  return (
    <AppShell>
      <PromotionBanner />
      <TopBetsMarquee />
      <Feed scope="top" />
    </AppShell>
  );
}
