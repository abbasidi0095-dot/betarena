export type SystemType = "TRIXIE" | "PATENT" | "YANKEE" | "LUCKY15";

const SIZES: Record<SystemType, number[]> = {
  TRIXIE: [2, 3],
  PATENT: [1, 2, 3],
  YANKEE: [2, 3, 4],
  LUCKY15: [1, 2, 3, 4],
};

export function comboSizes(t: SystemType): number[] {
  return SIZES[t];
}

export function comboCount(t: SystemType): number {
  return SIZES[t].length === 2 && !SIZES[t].includes(1)
    ? 4
    : { TRIXIE: 4, PATENT: 7, YANKEE: 11, LUCKY15: 15 }[t];
}

function kCombinations(legs: string[], k: number): string[][] {
  if (k === 1) return legs.map((l) => [l]);
  if (k === legs.length) return [[...legs]];
  const out: string[][] = [];
  for (let i = 0; i <= legs.length - k; i++) {
    const head = legs[i];
    for (const tail of kCombinations(legs.slice(i + 1), k - 1)) {
      out.push([head, ...tail]);
    }
  }
  return out;
}

export function generateCombinations(t: SystemType, legIds: string[]): string[][] {
  const out: string[][] = [];
  for (const size of SIZES[t]) {
    out.push(...kCombinations(legIds, size));
  }
  return out;
}

export function splitStake(total: number, count: number): {
  stake: number;
  remainder: number;
} {
  if (count <= 0) return { stake: 0, remainder: total };
  const stake = Math.floor(total / count);
  return { stake, remainder: total - stake * count };
}
