"use client";

import { useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { BetSlip } from "@/components/slip/BetSlip";
import { SlipFAB, SlipToast } from "@/components/slip/SlipFAB";
import { WinToast } from "@/components/fx/WinToast";
import { useSocket } from "@/hooks/useSocket";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useSocket(); // boot the single socket connection

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header onOpenSidebar={() => setSidebarOpen(true)} />
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-24 pt-4 lg:px-6 lg:pb-10">
          {children}
        </main>
      </div>
      <MobileNav />
      <BetSlip />
      <SlipFAB />
      <SlipToast />
      <WinToast />
    </div>
  );
}
