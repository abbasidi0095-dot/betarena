"use client";

import { cn } from "@/lib/client/cn";

/** Known club colors (Betclic-style colored crests) + hash fallback. */
const TEAM_COLORS: Record<string, string> = {
  Arsenal: "#EF0107",
  Chelsea: "#034694",
  Liverpool: "#C8102E",
  "Manchester City": "#6CABDD",
  "Man City": "#6CABDD",
  Tottenham: "#132257",
  Newcastle: "#241F20",
  "Aston Villa": "#670E36",
  Brighton: "#0057B8",
  "West Ham": "#7A263A",
  Everton: "#003399",
  "Real Madrid": "#FEBE10",
  Barcelona: "#A50044",
  "Atlético Madrid": "#CB3524",
  Sevilla: "#D40000",
  Inter: "#0068A8",
  Juventus: "#000000",
  Milan: "#FB090B",
  Napoli: "#12A0D7",
  "Bayern München": "#DC052D",
  "Bayern Munich": "#DC052D",
  "Borussia Dortmund": "#FDE100",
  "RB Leipzig": "#DD0741",
  Leverkusen: "#E32221",
  PSG: "#004170",
  Marseille: "#2FAEE0",
  Monaco: "#E63312",
  Lyon: "#1F4E9C",
  Ajax: "#D2122E",
  PSV: "#ED1C24",
  Benfica: "#E8252D",
  Porto: "#0D5CAD",
  "Sporting CP": "#008057",
  Braga: "#D1002D",
  Galatasaray: "#A32638",
  "Fenerbahçe": "#293B8C",
  Celtic: "#018749",
  Rangers: "#1B458F",
};

const FALLBACK = [
  "#E50813", "#1E88E5", "#43A047", "#F4511E", "#8E24AA",
  "#00897B", "#C0CA33", "#6D4C41", "#546E7A", "#D81B60",
];

function hashInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function teamColor(name: string): string {
  return TEAM_COLORS[name] ?? FALLBACK[hashInt(name) % FALLBACK.length];
}

function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

export function TeamCrest({
  name,
  size = 34,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const color = teamColor(name);
  const light = isLight(color);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-black uppercase",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        color: light ? "#121212" : "#ffffff",
        fontSize: size * 0.32,
        boxShadow: `0 0 0 2px rgba(255,255,255,0.08)`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
