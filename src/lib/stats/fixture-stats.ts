export type FormResult = "W" | "D" | "L";

export interface FormEntry {
  result: FormResult;
  opponent: string;
  score: string;
  date: string;
}

export interface StatsSummary {
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
}

interface FormRow {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  kickoff: Date;
}

function outcome(row: FormRow, teamName: string): FormResult | null {
  const isHome = row.homeTeam === teamName;
  const isAway = row.awayTeam === teamName;
  if (!isHome && !isAway) return null;
  const gd = isHome ? row.homeScore - row.awayScore : row.awayScore - row.homeScore;
  if (gd > 0) return "W";
  if (gd < 0) return "L";
  return "D";
}

/** Last-5 form guide entries for one team, most recent first. */
export function buildForm(rows: FormRow[], teamName: string): FormEntry[] {
  return rows
    .map((r) => ({
      r,
      result: outcome(r, teamName),
    }))
    .filter((x): x is { r: FormRow; result: FormResult } => x.result !== null)
    .sort((a, b) => b.r.kickoff.getTime() - a.r.kickoff.getTime())
    .slice(0, 5)
    .map((x) => ({
      result: x.result,
      opponent: x.r.homeTeam === teamName ? x.r.awayTeam : x.r.homeTeam,
      score: `${x.r.homeScore} - ${x.r.awayScore}`,
      date: x.r.kickoff.toISOString(),
    }));
}

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

/** Win/draw/loss split from the home team's perspective, using both forms. */
export function computeSummary(
  homeForm: { result: FormResult }[],
  awayForm: { result: FormResult }[],
  _h2h: unknown[],
): StatsSummary {
  const homeWins = homeForm.filter((f) => f.result === "W").length + awayForm.filter((f) => f.result === "L").length;
  const draws = homeForm.filter((f) => f.result === "D").length + awayForm.filter((f) => f.result === "D").length;
  const awayWins = homeForm.filter((f) => f.result === "L").length + awayForm.filter((f) => f.result === "W").length;
  const total = homeForm.length + awayForm.length;
  return { homeWinPct: pct(homeWins, total), drawPct: pct(draws, total), awayWinPct: pct(awayWins, total) };
}
