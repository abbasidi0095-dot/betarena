/**
 * Prisma Decimal serializes to JSON as strings — normalize odds rows so
 * client components always receive plain numbers.
 */
export function serializeFixtures(fixtures: any[]): any[] {
  return fixtures.map((f) => ({
    ...f,
    markets: f.markets.map((m: any) => ({
      ...m,
      odds: m.odds.map((o: any) => ({
        ...o,
        value: o.value?.toNumber?.() ?? Number(o.value),
        previousValue:
          o.previousValue == null ? null : (o.previousValue.toNumber?.() ?? Number(o.previousValue)),
      })),
    })),
  }));
}
