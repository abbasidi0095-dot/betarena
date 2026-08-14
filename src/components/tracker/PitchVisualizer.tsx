"use client";

import type { FixtureRow } from "@/lib/client/api";

/**
 * Simple SVG pitch visualizer: goal events land in zones driven by the
 * attacking half, cards near the middle, subs on the touchline.
 */
export function PitchVisualizer({ events }: { events: FixtureRow["events"] }) {
  const W = 300;
  const H = 190;

  const dots = events
    .filter((e) => e.type !== "sub")
    .map((e, i) => {
      const zone = e.zone % 12;
      const row = Math.floor(zone / 4); // 0..2 vertical band
      const col = zone % 4;
      const x = e.team === "home" ? 40 + col * 30 : W - 40 - col * 30;
      const y = 30 + row * 55 + ((i % 3) * 8 - 8);
      return { ...e, x, y };
    });

  return (
    <div className="rounded-xl bg-surface p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <rect x="4" y="4" width={W - 8} height={H - 8} rx="6" fill="#14311f" />
        <g stroke="#2e5c40" strokeWidth="1.2" fill="none">
          <line x1={W / 2} y1="4" x2={W / 2} y2={H - 4} />
          <circle cx={W / 2} cy={H / 2} r="28" />
          <rect x="4" y={H / 2 - 38} width="34" height="76" />
          <rect x={W - 38} y={H / 2 - 38} width="34" height="76" />
          <rect x="4" y={H / 2 - 18} width="12" height="36" />
          <rect x={W - 16} y={H / 2 - 18} width="12" height="36" />
        </g>
        <text x="16" y="20" fill="#4d8a63" fontSize="9">
          HOME →
        </text>
        <text x={W - 60} y="20" fill="#4d8a63" fontSize="9">
          ← AWAY
        </text>
        {dots.map((d, i) => (
          <g key={i}>
            <circle
              cx={d.x}
              cy={d.y}
              r="5.5"
              fill={d.type === "goal" ? "#B9F135" : "#ffd12e"}
              opacity="0.9"
            />
            {d.type === "goal" && (
              <text x={d.x} y={d.y + 2} textAnchor="middle" fontSize="6.5" fill="#121212" fontWeight="700">
                ⚽
              </text>
            )}
          </g>
        ))}
        {dots.length === 0 && (
          <text x={W / 2} y={H / 2 + 4} textAnchor="middle" fill="#4d8a63" fontSize="10">
            No pitch events yet
          </text>
        )}
      </svg>
    </div>
  );
}
