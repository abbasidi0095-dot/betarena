export interface RankRow {
  userId: string;
  username: string;
  isBot: boolean;
  won: boolean;
}

export interface RankedBettor {
  username: string;
  isBot: boolean;
  settled: number;
  won: number;
  winRate: number;
}

/** Group by user, keep only those with >= minSettled settled bets, sort by win rate desc, take 10. */
export function rankBettors(rows: RankRow[], minSettled = 3): RankedBettor[] {
  const byUser = new Map<string, { username: string; isBot: boolean; settled: number; won: number }>();
  for (const r of rows) {
    const acc = byUser.get(r.userId) ?? { username: r.username, isBot: r.isBot, settled: 0, won: 0 };
    acc.settled += 1;
    if (r.won) acc.won += 1;
    byUser.set(r.userId, acc);
  }
  return [...byUser.values()]
    .filter((u) => u.settled >= minSettled)
    .map((u) => ({ ...u, winRate: Math.round((u.won / u.settled) * 100) }))
    .sort((a, b) => b.winRate - a.winRate || b.settled - a.settled)
    .slice(0, 10);
}
