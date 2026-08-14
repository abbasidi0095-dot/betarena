export function formatPoints(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n);
}

export function oddsToString(value: number): string {
  return value.toFixed(2);
}

export function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return time;
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${time}`;
}

export const MARKET_LABELS: Record<string, string> = {
  h2h: "Match Result",
  totals: "Goals O/U 2.5",
  btts: "Both Teams to Score",
};

export const SELECTION_SHORT: Record<string, string> = {
  home: "1",
  draw: "X",
  away: "2",
  "over_2.5": "O 2.5",
  "under_2.5": "U 2.5",
  btts_yes: "Yes",
  btts_no: "No",
};
