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
        email: `${name.toLowerCase()}@bots.abbet.local`,
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


async function main() {
  await seedBots();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
