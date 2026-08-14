"use client";

import { useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { BetSlip } from "@/components/slip/BetSlip";
import { WinToast } from "@/components/fx/WinToast";
import { useSocket } from "@/hooks/useSocket";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useSocket(); // boot the single socket connection

  return (
    <div className="flex min-h-screen flex-col">
      <Header onOpenSidebar={() => setSidebarOpen(true)} />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 px-3 pb-24 pt-4 lg:px-6 lg:pb-10">{children}</main>
      </div>
      <MobileNav />
      <BetSlip />
      <WinToast />
    </div>
  );
}
