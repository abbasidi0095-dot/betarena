import { describe, it, expect } from "vitest";
import { buildForm, buildH2H, computeSummary } from "@/lib/stats/fixture-stats";

function row(partial: {
  id: number;
  kickoff: string;
  competition?: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
}) {
  return {
    providerId: String(partial.id),
    kickoff: new Date(partial.kickoff),
    status: "FINISHED" as const,
    homeTeam: partial.homeTeam,
    awayTeam: partial.awayTeam,
    homeTeamId: partial.homeTeamId,
    awayTeamId: partial.awayTeamId,
    homeScore: partial.homeScore,
    awayScore: partial.awayScore,
    competition: partial.competition,
  };
}

const ARS = 57;
const MUN = 66;

function arsenalRows() {
  return [
    row({ id: 1, kickoff: "2026-05-25", homeTeam: "Arsenal FC", awayTeam: "Everton FC", homeTeamId: ARS, awayTeamId: 62, homeScore: 3, awayScore: 0 }),
    row({ id: 2, kickoff: "2026-05-18", homeTeam: "Manchester United FC", awayTeam: "Arsenal FC", homeTeamId: MUN, awayTeamId: ARS, homeScore: 0, awayScore: 2 }),
    row({ id: 3, kickoff: "2026-05-11", homeTeam: "Arsenal FC", awayTeam: "Fulham FC", homeTeamId: ARS, awayTeamId: 63, homeScore: 1, awayScore: 1 }),
    row({ id: 4, kickoff: "2026-05-04", homeTeam: "Arsenal FC", awayTeam: "Manchester United FC", homeTeamId: ARS, awayTeamId: MUN, homeScore: 2, awayScore: 2, competition: "Premier League" }),
    row({ id: 5, kickoff: "2026-04-27", homeTeam: "Chelsea FC", awayTeam: "Arsenal FC", homeTeamId: 61, awayTeamId: ARS, homeScore: 1, awayScore: 0 }),
  ];
}

function unitedRows() {
  return [
    row({ id: 2, kickoff: "2026-05-18", homeTeam: "Manchester United FC", awayTeam: "Arsenal FC", homeTeamId: MUN, awayTeamId: ARS, homeScore: 0, awayScore: 2 }),
    row({ id: 4, kickoff: "2026-05-04", homeTeam: "Arsenal FC", awayTeam: "Manchester United FC", homeTeamId: ARS, awayTeamId: MUN, homeScore: 2, awayScore: 2, competition: "Premier League" }),
    row({ id: 6, kickoff: "2026-05-01", homeTeam: "Manchester United FC", awayTeam: "Liverpool FC", homeTeamId: MUN, awayTeamId: 64, homeScore: 1, awayScore: 1 }),
    row({ id: 7, kickoff: "2026-04-20", homeTeam: "Manchester United FC", awayTeam: "West Ham United FC", homeTeamId: MUN, awayTeamId: 563, homeScore: 3, awayScore: 0 }),
  ];
}

describe("buildForm with football-data team ids", () => {
  it("matches by team id even when names differ from the stored fixture", () => {
    const form = buildForm(arsenalRows(), "Totally Different Name", ARS);
    expect(form).toHaveLength(5);
    expect(form[0]).toEqual({ result: "W", opponent: "Everton FC", score: "3 - 0", date: expect.any(String) });
    expect(form.map((f) => f.result)).toEqual(["W", "W", "D", "D", "L"]);
  });

  it("caps at 5 entries most recent first", () => {
    const form = buildForm(unitedRows(), "", MUN);
    expect(form).toHaveLength(4);
    expect(form.map((f) => f.result)).toEqual(["L", "D", "D", "W"]);
  });
});

describe("buildH2H", () => {
  it("extracts only the shared fixtures between the two teams", () => {
    const h2h = buildH2H(arsenalRows(), unitedRows(), ARS, MUN);
    expect(h2h).toHaveLength(2);
    expect(h2h[0].score).toBe("0 - 2");
    expect(h2h[1].score).toBe("2 - 2");
    expect(h2h[1].competition).toBe("Premier League");
  });

  it("returns [] when the teams never met", () => {
    const homeNoMun = arsenalRows().filter((r) => r.homeTeamId !== MUN && r.awayTeamId !== MUN);
    const h2h = buildH2H(homeNoMun, unitedRows(), ARS, MUN);
    expect(h2h).toEqual([]);
  });
});

describe("computeSummary", () => {
  it("splits W/D/L from both forms", () => {
    const homeForm = buildForm(arsenalRows(), "", ARS);
    const awayForm = buildForm(unitedRows(), "", MUN);
    const summary = computeSummary(homeForm, awayForm, []);
    // home W,W,D,D,L + away L,D,D,W => wins 3, draws 4, losses 2 of 9
    expect(summary.homeWinPct).toBe(33);
    expect(summary.drawPct).toBe(44);
    expect(summary.awayWinPct).toBe(22);
  });
});
