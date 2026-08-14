/**
 * Seed script: bot users for the leaderboard + demo fixtures/markets/odds
 * when no real API keys are configured (clearly-labeled demo league).
 * Run: npm run seed:bots
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BOT_NAMES = [
  "OddOwl", "LuckyLion", "PunterPanda", "AceShark", "GoalGuru", "BetHawk",
  "OddsOtter", "StakeStag", "TipsterFox", "WagerWolf", "AccaAce", "HedgeHog",
  "ParlayPike", "BankrollBear", "ValueViper", "EdgeEagle", "OddsOrca",
  "PuntPuma", "SlipSloth", "BookieBat", "ChalkChimp", "DimeDog", "JuiceJaguar",
  "LineLynx", "MarketMole", "NoVigNewt", "OverlayOx", "PickPenguin",
  "ROI_Rabbit", "SpreadSwan",
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

async function seedBots() {
  const rand = seededRandom(42);
  const existing = await prisma.user.count({ where: { isBot: true } });
  if (existing >= BOT_NAMES.length) {
    console.log(`[seed] ${existing} bots already exist — skipping`);
    return;
  }

  const passwordHash = await bcrypt.hash("bots-dont-login-" + Math.random(), 10);
  for (const name of BOT_NAMES) {
    const staked = Math.floor(rand() * 9000) + 1000;
    const won = Math.floor(staked * (0.5 + rand() * 0.7));
    await prisma.user.upsert({
      where: { username: name },
      create: {
        username: name,
        email: `${name.toLowerCase()}@bots.betarena.local`,
        passwordHash,
        isBot: true,
        pointBalance: Math.floor(rand() * 4000) + 200,
        totalStaked: staked,
        totalWon: won,
        betsWon: Math.floor(rand() * 80) + 5,
        betsLost: Math.floor(rand() * 80) + 5,
      },
      update: {},
    });
  }
  console.log(`[seed] ${BOT_NAMES.length} bot users ready`);
}

/* ---- Demo fixtures ---- */

const TEAMS: [string, string][] = [
  ["Arsenal", "Chelsea"], ["Liverpool", "Manchester City"], ["Tottenham", "Newcastle"],
  ["Aston Villa", "Brighton"], ["West Ham", "Everton"], ["Real Madrid", "Barcelona"],
  ["Atlético Madrid", "Sevilla"], ["Inter", "Juventus"], ["Milan", "Napoli"],
  ["Bayern München", "Borussia Dortmund"], ["RB Leipzig", "Leverkusen"],
  ["PSG", "Marseille"], ["Monaco", "Lyon"], ["Ajax", "PSV"], ["Benfica", "Porto"],
  ["Sporting CP", "Braga"], ["Galatasaray", "Fenerbahçe"], ["Celtic", "Rangers"],
];

function oddsFor(rand: () => number) {
  const home = Math.round((1.3 + rand() * 3) * 100) / 100;
  const draw = Math.round((2.8 + rand() * 1.5) * 100) / 100;
  const away = Math.round((1.3 + rand() * 4.5) * 100) / 100;
  const over = Math.round((1.5 + rand() * 1.1) * 100) / 100;
  const under = Math.round((1.5 + rand() * 1.1) * 100) / 100;
  const yes = Math.round((1.5 + rand() * 1) * 100) / 100;
  const no = Math.round((1.6 + rand() * 1.1) * 100) / 100;
  return { home, draw, away, over, under, yes, no };
}

async function seedDemoFixtures() {
  const fixtureCount = await prisma.fixture.count();
  if (fixtureCount > 0) {
    console.log(`[seed] ${fixtureCount} fixtures already exist — skipping demo data`);
    return;
  }

  const rand = seededRandom(7);
  const league = await prisma.league.create({
    data: {
      providerId: "demo-league-1",
      name: "BetArena Demo League",
      country: "Demo",
      season: 2026,
    },
  });

  const now = Date.now();
  let created = 0;
  for (let i = 0; i < TEAMS.length; i++) {
    const [home, away] = TEAMS[i];
    // Mix of states: 4 live, some finished today, mostly upcoming
    const mode = i < 4 ? "live" : i < 7 ? "finished" : "upcoming";
    const kickoff =
      mode === "live"
        ? new Date(now - (30 + i * 12) * 60 * 1000)
        : mode === "finished"
          ? new Date(now - 4 * 3600 * 1000)
          : new Date(now + (i - 6) * 3.5 * 3600 * 1000);

    const homeScore = mode === "upcoming" ? 0 : Math.floor(rand() * 3);
    const awayScore = mode === "upcoming" ? 0 : Math.floor(rand() * 3);

    const events =
      mode === "upcoming"
        ? []
        : [
            { type: "goal" as const, minute: 12, team: "home" as const, player: `${home} No.9`, zone: 2 },
            ...(awayScore > 0
              ? [{ type: "goal" as const, minute: 34, team: "away" as const, player: `${away} No.10`, zone: 8 }]
              : []),
            { type: "card" as const, minute: 55, team: "away" as const, player: `${away} No.6`, zone: 5 },
          ];

    const fixture = await prisma.fixture.create({
      data: {
        providerId: `demo-${i + 1}`,
        leagueId: league.id,
        kickoff,
        status: mode === "live" ? "LIVE" : mode === "finished" ? "FINISHED" : "SCHEDULED",
        homeTeam: home,
        awayTeam: away,
        homeScore,
        awayScore,
        minute: mode === "live" ? 30 + i * 12 : mode === "finished" ? 90 : null,
        events: events as any,
      },
    });

    const o = oddsFor(rand);
    for (const [key, selections] of [
      ["h2h", { home: o.home, draw: o.draw, away: o.away }],
      ["totals", { "over_2.5": o.over, "under_2.5": o.under }],
      ["btts", { btts_yes: o.yes, btts_no: o.no }],
    ] as const) {
      const market = await prisma.market.create({
        data: {
          fixtureId: fixture.id,
          key,
          status: mode === "finished" ? "CLOSED" : "OPEN",
        },
      });
      for (const [selectionKey, value] of Object.entries(selections)) {
        await prisma.odds.create({
          data: { marketId: market.id, selectionKey, value },
        });
      }
    }
    created++;
  }
  console.log(`[seed] created ${created} demo fixtures with markets + odds`);
}

async function main() {
  await seedBots();
  await seedDemoFixtures();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
