"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { useSlip, type Selection } from "@/stores/slip";

export interface CopyableLeg {
  fixtureId: string;
  marketKey: string;
  selectionKey: string;
  selectionName: string;
  odds: number;
  label: string;
}

export function CopyBetButton({ legs }: { legs: CopyableLeg[] }) {
  const [copied, setCopied] = useState(false);
  const add = useSlip((s) => s.add);
  const open = useSlip((s) => s.open);

  const handle = () => {
    legs.forEach((leg) => {
      const sel: Selection = {
        fixtureId: leg.fixtureId,
        marketKey: leg.marketKey,
        selectionKey: leg.selectionKey,
        selectionName: leg.selectionName,
        fixtureLabel: leg.label,
        odds: leg.odds,
      };
      add(sel);
    });
    open();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handle}
      className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[11px] font-bold text-black transition-colors hover:bg-brand-hover"
    >
      <Copy size={12} />
      {copied ? "Copié !" : "Copier le pari"}
    </button>
  );
}
