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
