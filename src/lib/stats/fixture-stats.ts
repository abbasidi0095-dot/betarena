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
  homeTeamId?: number;
  awayTeamId?: number;
  homeScore: number | null;
  awayScore: number | null;
  kickoff: Date;
  competition?: string;
}

function rowIsFor(row: FormRow, teamName: string, teamId?: number): boolean {
  if (teamId !== undefined) return row.homeTeamId === teamId || row.awayTeamId === teamId;
  return row.homeTeam === teamName || row.awayTeam === teamName;
}

function outcome(row: FormRow, teamName: string, teamId?: number): FormResult | null {
  const byId = teamId !== undefined;
  const isHome = byId ? row.homeTeamId === teamId : row.homeTeam === teamName;
  const isAway = byId ? row.awayTeamId === teamId : row.awayTeam === teamName;
  if (!isHome && !isAway) return null;
  if (row.homeScore === null || row.awayScore === null) return null;
  const gd = isHome ? row.homeScore - row.awayScore : row.awayScore - row.homeScore;
  if (gd > 0) return "W";
  if (gd < 0) return "L";
  return "D";
}

/** Last-5 form guide entries for one team, most recent first. */
export function buildForm(rows: FormRow[], teamName: string, teamId?: number): FormEntry[] {
  return rows
    .map((r) => ({
      r,
      result: outcome(r, teamName, teamId),
    }))
    .filter((x): x is { r: FormRow; result: FormResult } => x.result !== null)
    .sort((a, b) => b.r.kickoff.getTime() - a.r.kickoff.getTime())
    .slice(0, 5)
    .map((x) => ({
      result: x.result,
      opponent: x.r.homeTeam === teamName || x.r.homeTeamId === teamId ? x.r.awayTeam : x.r.homeTeam,
      score: `${x.r.homeScore} - ${x.r.awayScore}`,
      date: x.r.kickoff.toISOString(),
    }));
}

export interface H2HEntry {
  homeTeam: string;
  awayTeam: string;
  score: string;
  date: string;
  competition?: string;
}

/**
 * Head-to-head from both teams' match lists — the matches the two sides
 * played against each other, most recent first (max 5).
 */
export function buildH2H(
  homeRows: FormRow[],
  awayRows: FormRow[],
  homeTeamId: number,
  awayTeamId: number,
): H2HEntry[] {
  const awayIds = new Set(awayRows.map((r) => r.homeTeamId ?? r.awayTeamId));
  return homeRows
    .filter((r) => r.homeTeamId === awayTeamId || r.awayTeamId === awayTeamId)
    .filter((r) => r.homeScore !== null && r.awayScore !== null)
    .filter((r) => awayIds.has(r.homeTeamId ?? r.awayTeamId))
    .sort((a, b) => b.kickoff.getTime() - a.kickoff.getTime())
    .slice(0, 5)
    .map((r) => ({
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      score: `${r.homeScore} - ${r.awayScore}`,
      date: r.kickoff.toISOString(),
      competition: r.competition,
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
