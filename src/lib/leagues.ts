/**
 * League providerIds that rank above the long tail in the feed.
 * Covers both providers that create leagues:
 *   - API-Football: numeric league ids ("39" = EPL)
 *   - football-data: "fd:<competition id>" ("fd:2021" = EPL)
 * 2 = top tier (top-6 + UCL), 1 = second tier, 0 = everything else.
 * The feed sorts by priority DESC, so higher ranks first.
 */
const PRIORITY: Record<string, number> = {
  // API-Football ids
  "39": 2, // EPL
  "140": 2, // La Liga
  "135": 2, // Serie A
  "78": 2, // Bundesliga
  "61": 2, // Ligue 1
  "2": 2, // Champions League
  "3": 1, // Europa League
  "88": 1, // Eredivisie
  "94": 1, // Primeira Liga
  "203": 1, // Süper Lig
  "144": 1, // Belgian First Division A
  // football-data ids
  "fd:2021": 2, // EPL
  "fd:2014": 2, // La Liga
  "fd:2019": 2, // Serie A
  "fd:2002": 2, // Bundesliga
  "fd:2015": 2, // Ligue 1
  "fd:2001": 2, // Champions League
  "fd:2146": 1, // Europa League
  "fd:2003": 1, // Eredivisie
  "fd:2017": 1, // Primeira Liga
  "fd:2073": 1, // Süper Lig
  "fd:2033": 1, // Belgian First Division A
};

export function leaguePriority(providerId: string): number {
  return PRIORITY[providerId] ?? 0;
}

/**
 * Name patterns that mark a competition as non-professional: youth age
 * bands, reserves, academies, amateurs, friendlies, and known semi-pro
 * brands. These never belong on a betting feed — their data is sparse and
 * their scores are unreliable.
 */
const NON_PROFESSIONAL_PATTERNS: RegExp[] = [
  /\bu\d{1,2}\b/i, // U18, U19, U20, U21, U23
  /\byouth\b/i,
  /\bjuniou?r\w*/i, // junior, juniors, juniores, júnior, Junioren
  /\breserves?\b/i,
  /\bacademy\b/i,
  /\bdevelopment\b/i,
  /\bamateur\b/i,
  /\bsemi-?pro\b/i,
  /\bfriendl(y|ies)\b/i,
  /\bpremier league 2\b/i, // English U21 reserve league
  /\bpremier league cup\b/i, // English U21 cup
  /\bnational premier leagues?\b/i, // Australian semi-pro NPL
  /\bnpl\b/i,
  /\bliga 3\b/i, // Portuguese semi-pro third tier
  /\bligue 3\b/i, // French semi-pro third tier
  /\bliga classic\b/i, // Czech semi-pro third tier
  /\b(ii|iii)\b/i, // reserve sides (III Liga, NB III, II Liga)
  /\b(ii|iii)\s*$/i,
  // Czech "3. liga - X" / Slovak "4. liga - Divizie X" (semi-pro); the bare
  // German "3. Liga" is professional and has no suffix, so it stays.
  /^\s*\d+\.\s*liga\b\s*-/i,
  /\bderde divisie\b/i, // Dutch amateur 4th tier
  /\btweede divisie\b/i, // Dutch semi-pro 3rd tier
  /\boberliga\b/i, // German amateur 5th tier
  /\bregionalliga\b/i, // German semi-pro 4th tier
  /\bnon league\b/i, // English amateur 7th tier
  /\bisthmian\b/i,
  /\bhighland league\b/i, // Scottish semi-pro 5th tier
  /\blowland league\b/i,
  /\bstate league\b/i, // Australian state amateur tiers
  /\bqueensland premier league\b/i,
  /\bnnsw\b/i,
  /\btasmania (northern|southern) championship\b/i,
  /\bdivision 2\b/i, // Swedish amateur 4th tier
  /\bettan\b/i, // Swedish semi-pro 3rd tier
  /\bsecond league\b/i, // Russian/Ukrainian semi-pro 3rd tier
  /\bsecond league a\b/i, // Kazakh semi-pro 3rd tier
  /\bthird league\b/i, // Bulgarian semi-pro 3rd tier
  /\bdruha liga\b/i, // Ukrainian semi-pro 3rd tier
  /\besiliiga\b/i, // Estonian semi-pro 2nd/3rd tier
  /\bdeild\b/i, // Faroese semi-pro tiers
  /\b[23]\.\s*snl\b/i, // Slovenian semi-pro 2nd/3rd tier
  /\b1 lyga\b/i, // Lithuanian semi-pro 2nd tier
  /\bcampeonato de portugal\b/i, // Portuguese semi-pro 3rd tier
  /\bserie c\b/i, // Italian semi-pro 3rd tier
  /\bserie d\b/i, // Italian amateur 4th tier
  /\bcoppa italia serie c\b/i,
  /\btorneo federal\b/i, // Argentine semi-pro 3rd tier
  /\bprimera c\b/i, // Argentine amateur 4th tier
  /\bprimera b metropolitana\b/i, // Argentine semi-pro 3rd tier
  /\bdivision intermedia\b/i, // Paraguayan semi-pro 2nd tier
  /\bmls next pro\b/i, // US semi-pro 3rd tier
  /\bfaw championship\b/i, // Welsh semi-pro 2nd tier
  /\bchatham cup\b/i, // NZ amateur cup
  /\bcalcutta\b/i, // Indian regional amateur tier
  /\bgoiano - 2\b/i, // Brazilian state lower divisions
  /\bmineiro - 2\b/i,
  /\bparanaense - 3\b/i,
  /\bpaulista s[ée]rie b\b/i,
  /\bcapixaba\b/i,
];

export function isProfessionalLeague(name: string): boolean {
  return !NON_PROFESSIONAL_PATTERNS.some((p) => p.test(name));
}
