/**
 * Realistic bookmaker-style odds model.
 *
 * Team strengths are derived deterministically from team names (hash) so the
 * demo feed looks like a pro book: strong favorite ~1.15, even match ~2.0/3.4,
 * overround 3–9%. A small Poisson score model drives 1X2, O/U 2.5, BTTS,
 * exact-goals, double chance and handicap markets consistently.
 */

export interface TeamStrength {
  strength: number; // 0.85 (weak) – 1.95 (strong), correlated attack/defense
}

export interface ScorerSelection {
  id: string; // "scorer:<player>"
  name: string;
  position: string;
  odds: number;
}

export interface HandicapSelection {
  id: string; // "home_-1"
  name: string;
  line: number;
  odds: number;
}

export interface RealisticOdds {
  home: number;
  draw: number;
  away: number;
  over_2_5: number;
  under_2_5: number;
  btts_yes: number;
  btts_no: number;
  dc: { home_or_draw: number; home_or_away: number; away_or_draw: number };
  exact_0: number;
  exact_1: number;
  exact_2: number;
  exact_3: number;
  exact_4: number;
  handicap: { home_1: HandicapSelection; home_2: HandicapSelection; away_1: HandicapSelection; away_2: HandicapSelection };
  scorers: ScorerSelection[];
}

const MARGIN = 1.06; // bookmaker overround

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function teamsFromHash(teamName: string): TeamStrength {
  const known = KNOWN_TEAM_STRENGTH[teamName];
  if (known) return { strength: known };
  const h = hashString(teamName);
  return { strength: 0.85 + ((h % 100) / 100) * 1.1 }; // 0.85–1.95
}

/** Real-world relative strengths so the demo feed looks like a pro book. */
const KNOWN_TEAM_STRENGTH: Record<string, number> = {
  "Real Madrid": 1.9, "Man City": 1.88, "Manchester City": 1.88, "Bayern München": 1.85,
  "Bayern Munich": 1.85, "PSG": 1.8, "Liverpool": 1.78, "Arsenal": 1.75, "Barcelona": 1.74,
  "Inter": 1.7, "Chelsea": 1.62, "Leverkusen": 1.6, "Dortmund": 1.6, "Borussia Dortmund": 1.6,
  "Tottenham": 1.55, "Newcastle": 1.45, "Atlético Madrid": 1.5, "Napoli": 1.5, "Milan": 1.48,
  "RB Leipzig": 1.45, "Juventus": 1.42, "Aston Villa": 1.35, "Benfica": 1.35, "Brighton": 1.4,
  "Marseille": 1.4, "Monaco": 1.3, "Lyon": 1.3, "Porto": 1.25, "West Ham": 1.25,
  "Ajax": 1.2, "Sporting CP": 1.2, "Galatasaray": 1.15, "Sevilla": 1.1, "PSV": 1.1,
  "Celtic": 1.1, "Everton": 1.0, "Fenerbahçe": 1.05, "Braga": 0.95, "Mainz": 0.9,
  "Brentford": 0.85, "Getafe": 0.75, "Luton": 0.55, "Team A": 1.25, "Team B": 1.2,
};

export function inverseProb(odds: number): number {
  return 1 / odds;
}

/** Odds with margin applied: implied prob = prob × margin (overround > 1). */
function withMargin(prob: number, margin = MARGIN): number {
  return Math.max(1.01, Math.round((1 / (prob * margin)) * 100) / 100);
}

function poissonProb(lambda: number, k: number): number {
  let acc = Math.exp(-lambda) * lambda ** k;
  for (let i = 2; i <= k; i++) acc *= 1 / i;
  return acc;
}

interface ScoreProbs {
  p: (homeGoals: number, awayGoals: number) => number;
  upTo: number;
}

function scoreModel(home: TeamStrength, away: TeamStrength): ScoreProbs {
  const ratio = home.strength / away.strength;
  const lambdaHome = Math.pow(ratio, 1.5) * 1.1 + 0.15;
  const lambdaAway = Math.pow(1 / ratio, 1.5) * 1.0 + 0.15;
  const UP = 7;
  const ph = Array.from({ length: UP + 1 }, (_, k) => poissonProb(lambdaHome, k));
  const pa = Array.from({ length: UP + 1 }, (_, k) => poissonProb(lambdaAway, k));
  const sumH = ph.reduce((a, b) => a + b, 0);
  const sumA = pa.reduce((a, b) => a + b, 0);
  const nh = ph.map((x) => x / sumH);
  const na = pa.map((x) => x / sumA);
  return {
    upTo: UP,
    p: (hg, ag) => (hg <= UP && ag <= UP ? nh[hg] * na[ag] : 0),
  };
}

export function generateRealisticOdds(home: TeamStrength, away: TeamStrength): RealisticOdds {
  const sm = scoreModel(home, away);

  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let pOver = 0;
  let pBtts = 0;
  let exact: number[] = [0, 0, 0, 0, 0]; // 0..3, 4+
  const dc = { hd: 0, ha: 0, ad: 0 };

  for (let hg = 0; hg <= sm.upTo; hg++) {
    for (let ag = 0; ag <= sm.upTo; ag++) {
      const p = sm.p(hg, ag);
      if (hg > ag) pHome += p;
      else if (hg === ag) pDraw += p;
      else pAway += p;
      if (hg + ag >= 3) pOver += p;
      if (hg > 0 && ag > 0) pBtts += p;
      const g = hg + ag;
      if (g <= 3) exact[g] += p;
      else exact[4] += p;
      if (hg > 0 || ag > 0) dc.hd += p;
      if (hg > 0 || ag === 0) dc.ha += p; // home win or draw handled below
      if (ag > 0) dc.ad += p;
    }
  }
  dc.ha = pHome + pDraw; // home or draw
  dc.hd = pHome + pDraw;
  dc.ad = pAway + pDraw;

  const o: RealisticOdds = {
    home: withMargin(pHome),
    draw: withMargin(pDraw),
    away: withMargin(pAway),
    over_2_5: withMargin(pOver),
    under_2_5: withMargin(1 - pOver),
    btts_yes: withMargin(pBtts),
    btts_no: withMargin(1 - pBtts),
    dc: {
      home_or_draw: withMargin(dc.hd),
      home_or_away: withMargin(1 - pDraw),
      away_or_draw: withMargin(dc.ad),
    },
    exact_0: withMargin(exact[0]),
    exact_1: withMargin(exact[1]),
    exact_2: withMargin(exact[2]),
    exact_3: withMargin(exact[3]),
    exact_4: withMargin(exact[4]),
    handicap: {
      home_1: { id: "home_-1", name: "Home -1", line: -1, odds: withMargin(homeWinBy(2, sm)) },
      home_2: { id: "home_-2", name: "Home -2", line: -2, odds: withMargin(homeWinBy(3, sm)) },
      away_1: { id: "away_+1", name: "Away +1", line: 1, odds: withMargin(awayWithLine(1, sm)) },
      away_2: { id: "away_+2", name: "Away +2", line: 2, odds: withMargin(awayWithLine(2, sm)) },
    },
    scorers: [],
  };

  // Anytime scorers: strongest attackers get the best odds
  const homeStrength = home.strength;
  const awayStrength = away.strength;
  const homeScorerProb = (pHome + pDraw * 0.5 + 0.08) * 0.5 * (0.4 + homeStrength);
  const awayScorerProb = (pAway + pDraw * 0.5 + 0.08) * 0.5 * (0.4 + awayStrength);

  // star players are attached later by name; here we just expose the strength
  o.scorers = [
    mkScorer("scorer_h1", homeStrength, homeScorerProb),
    mkScorer("scorer_h2", homeStrength * 0.72, homeScorerProb * 0.72),
    mkScorer("scorer_a1", awayStrength, awayScorerProb),
    mkScorer("scorer_a2", awayStrength * 0.72, awayScorerProb * 0.72),
    mkScorer("scorer_h3", homeStrength * 0.5, homeScorerProb * 0.5),
    mkScorer("scorer_a3", awayStrength * 0.5, awayScorerProb * 0.5),
  ];
  return o;
}

function mkScorer(id: string, strength: number, baseProb: number): ScorerSelection {
  const prob = Math.min(0.55, Math.max(0.07, baseProb * (0.7 + strength * 0.35)));
  return { id, name: id, position: "ST", odds: withMargin(prob, 1.1) };
}

function homeWinBy(minMargin: number, sm: ScoreProbs): number {
  let p = 0;
  for (let hg = 0; hg <= sm.upTo; hg++)
    for (let ag = 0; ag <= sm.upTo; ag++)
      if (hg - ag >= minMargin) p += sm.p(hg, ag);
  return p;
}

function awayWithLine(line: number, sm: ScoreProbs): number {
  let p = 0;
  for (let hg = 0; hg <= sm.upTo; hg++)
    for (let ag = 0; ag <= sm.upTo; ag++)
      if (ag + line > hg) p += sm.p(hg, ag);
  return p;
}

/* ---- Deterministic demo squads ---- */

const FIRST = [
  "Milan", "Lucas", "Sofiane", "Kylian", "Erling", "Lamine", "Jude", "Rodri",
  "Vinícius", "Mo", "Kevin", "Harry", "Victor", "Bukayo", "Florian", "Jamal",
  "Rafael", "Antoine", "Lautaro", "Son", "Dusan", "Xavi", "Pablo", "Matteo",
  "Andre", "Hakan", "Dušan", "Ousmane", "Cody", "Julian",
];
const LAST = [
  "Moreno", "Silva", "Diaz", "Mbappé", "Haaland", "Yamal", "Bellingham", "Hernandez",
  "Júnior", "Salah", "De Bruyne", "Kane", "Osimhen", "Saka", "Wirtz", "Musiala",
  "Leão", "Griezmann", "Martínez", "Heung-min", "Vlahović", "Simons", "Gavi", "Retegui",
  "Onana", "Çalhanoğlu", "Tadić", "Dembélé", "Gakpo", "Álvarez",
];
const POSITIONS = ["ST", "W", "AM", "ST", "W", "CM"];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Player {
  id: string;
  name: string;
  position: string;
}

export function starPlayersFor(teamName: string): Player[] {
  const rnd = mulberry32(hashString(teamName));
  const used = new Set<string>();
  const players: Player[] = [];
  while (players.length < 5) {
    const first = FIRST[Math.floor(rnd() * FIRST.length)];
    const last = LAST[Math.floor(rnd() * LAST.length)];
    const name = `${first} ${last}`;
    if (used.has(name)) continue;
    used.add(name);
    players.push({
      id: `scorer:${teamName}:${name}`,
      name,
      position: POSITIONS[Math.floor(rnd() * POSITIONS.length)],
    });
  }
  return players;
}

/** Map demo players onto the generic scorer slots with real names + tuned odds. */
export function buildScorerSelections(
  homeTeam: string,
  awayTeam: string,
  base: RealisticOdds,
): ScorerSelection[] {
  const home = starPlayersFor(homeTeam);
  const away = starPlayersFor(awayTeam);
  const homeOdds = base.scorers.slice(0, 3).map((s) => s.odds);
  const awayOdds = base.scorers.slice(3, 6).map((s) => s.odds);
  const out: ScorerSelection[] = [];
  home.forEach((p, i) =>
    out.push({ id: p.id, name: p.name, position: p.position, odds: homeOdds[i] ?? 3 }),
  );
  away.forEach((p, i) =>
    out.push({ id: p.id, name: p.name, position: p.position, odds: awayOdds[i] ?? 3 }),
  );
  return out;
}
