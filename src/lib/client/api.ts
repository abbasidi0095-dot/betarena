export interface ApiError {
  code: string;
  message: string;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; data?: T; error?: ApiError }> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      credentials: "include",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        error: json?.error ?? { code: "UNKNOWN", message: "Something went wrong" },
      };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "Network error" } };
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
};

/* ---- Shared wire types ---- */

export interface MeResponse {
  user: {
    id: string;
    username: string;
    pointBalance: number;
    canClaimDailyBonus: boolean;
    canRescue: boolean;
    stats: { totalWon: number; totalStaked: number; betsWon: number; betsLost: number };
  };
}

export interface OddsRow {
  id: string;
  selectionKey: string;
  value: number;
  previousValue: number | null;
}

export interface MarketRow {
  id: string;
  key: string;
  status: string;
  odds: OddsRow[];
}

export interface FixtureRow {
  id: string;
  kickoff: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  homeScore: number;
  awayScore: number;
  minute: number | null;
  events: {
    type: "goal" | "card" | "sub";
    minute: number;
    team: "home" | "away";
    player: string;
    zone: number;
  }[];
  lineups?: {
    team: "home" | "away";
    teamName: string;
    formation?: string;
    players: { id: string; name: string; photo?: string; pos: string }[];
  }[];
  league: { id: string; name: string; country: string; logo?: string | null };
  markets: MarketRow[];
}

export interface FixturesResponse {
  fixtures: FixtureRow[];
  dataStale: boolean;
  hasMore: boolean;
  offset: number;
}

export interface LeagueRow {
  id: string;
  name: string;
  country: string;
  logo?: string | null;
  fixtureCount: number;
}

export interface BetLegRow {
  id: string;
  fixtureId: string;
  marketKey: string;
  selectionKey: string;
  selectionName: string;
  oddsLocked: number;
  status: string;
  fixture?: { homeTeam: string; awayTeam: string; league?: { name: string } };
}

export interface BetCombinationRow {
  id: string;
  legIds: string[];
  stake: number;
  oddsProduct: number;
  status: string;
  payout: number;
}

export interface BetRow {
  id: string;
  type: string;
  systemType: string | null;
  stakeTotal: number;
  potentialReturn: number;
  payout: number;
  status: string;
  placedAt: string;
  settledAt: string | null;
  legs: BetLegRow[];
  combinations: BetCombinationRow[];
}

export interface LeaderboardRow {
  id: string;
  username: string;
  pointBalance: number;
  totalWon: number;
  totalStaked: number;
  betsWon: number;
  betsLost: number;
  winPct: number;
  roi: number;
  isBot: boolean;
}

export interface FriendsResponse {
  friends: { friendshipKey: string; id: string; username: string; pointBalance: number; totalWon: number }[];
  incoming: { friendshipKey: string; id: string; username: string }[];
  outgoing: { friendshipKey: string; id: string; username: string }[];
}
