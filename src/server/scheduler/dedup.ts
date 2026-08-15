import { prisma } from "@/lib/db";

const STOP_WORDS = new Set([
  "fc", "cf", "sc", "afc", "fk", "bk", "ac", "as", "ss", "cd", "club", "de", "the",
]);

/** Lowercase, accent-stripped, stop-word-free tokens ("Deportivo Alavés" → ["deportivo", "alaves"]). */
export function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w));
}

/**
 * Cross-provider duplicate detection + cleanup.
 *
 * The same real-world match can exist twice: API-Football owns today's
 * fixtures (numeric providerId, live events + lineups + real odds) while
 * football-data owns the full week (providerId "fd:<id>"). Team spellings
 * differ between providers ("Alaves" vs "Deportivo Alavés", "Sevilla" vs
 * "Sevilla FC"), so exact-name dedup misses them.
 *
 * Two fixtures are the same match when kickoffs are within 20 minutes AND
 * both team names match under a token-subset comparison (every significant
 * word of the shorter name appears in the longer one).
 */

/** Token-subset team comparison: "alaves" ⊆ "deportivo alaves" => true. */
export function sameTeam(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return false;
  const [small, large] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return small.every((t) => large.includes(t));
}

/** True when two fixtures are the same real-world match. */
export function isDuplicate(
  a: { homeTeam: string; awayTeam: string; kickoff: Date },
  b: { homeTeam: string; awayTeam: string; kickoff: Date },
): boolean {
  if (Math.abs(a.kickoff.getTime() - b.kickoff.getTime()) > 20 * 60 * 1000) return false;
  return (
    sameTeam(a.homeTeam, b.homeTeam) && sameTeam(a.awayTeam, b.awayTeam)
  );
}

interface FixtureLike {
  id: string;
  providerId: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: Date;
}

/**
 * Delete football-data fixtures that duplicate an API-Football fixture
 * (same kickoff window + matching team names). Any bet legs on the removed
 * fixture are migrated to its surviving twin first (same real-world match,
 * locked odds are unchanged), so bets are never broken.
 * Returns the number of fixtures deleted.
 */
export async function cleanupDuplicateFixtures(): Promise<number> {
  const fixtures = await prisma.fixture.findMany({
    select: { id: true, providerId: true, homeTeam: true, awayTeam: true, kickoff: true },
  });

  // Group by kickoff hour so comparisons stay ~O(n) per bucket.
  const byHour = new Map<number, FixtureLike[]>();
  for (const f of fixtures) {
    const bucket = Math.floor(f.kickoff.getTime() / 3600_000);
    const list = byHour.get(bucket) ?? [];
    list.push(f);
    byHour.set(bucket, list);
  }

  const legs = await prisma.betLeg.findMany({
    where: { fixture: { providerId: { startsWith: "fd:" } } },
    select: { fixtureId: true },
  });
  const legsByFixture = new Map<string, number>();
  for (const l of legs) legsByFixture.set(l.fixtureId, (legsByFixture.get(l.fixtureId) ?? 0) + 1);

  let deleted = 0;
  for (const f of fixtures) {
    if (!f.providerId.startsWith("fd:")) continue;

    const bucket = Math.floor(f.kickoff.getTime() / 3600_000);
    const peers = byHour.get(bucket) ?? [];
    const twin = peers.find(
      (p) =>
        p.id !== f.id &&
        !p.providerId.startsWith("fd:") &&
        isDuplicate(p, f),
    );
    if (!twin) continue;

    // Migrate any bet legs to the surviving fixture, then drop the duplicate.
    const legCount = legsByFixture.get(f.id) ?? 0;
    if (legCount > 0) {
      await prisma.betLeg.updateMany({
        where: { fixtureId: f.id },
        data: { fixtureId: twin.id },
      });
    }

    await prisma.fixture.delete({ where: { id: f.id } });
    deleted++;
  }
  if (deleted > 0) console.log(`[dedup] removed ${deleted} football-data duplicates`);
  return deleted;
}
