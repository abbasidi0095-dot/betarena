/**
 * League providerIds that rank above the long tail in the feed.
 * Covers both providers that create leagues:
 *   - API-Football: numeric league ids ("39" = EPL)
 *   - football-data: "fd:<competition id>" ("fd:2021" = EPL)
 * 1 = top tier (top-6 + UCL), 2 = second tier, 0 = everything else.
 */
const PRIORITY: Record<string, number> = {
  // API-Football ids
  "39": 1, // EPL
  "140": 1, // La Liga
  "135": 1, // Serie A
  "78": 1, // Bundesliga
  "61": 1, // Ligue 1
  "2": 1, // Champions League
  "3": 2, // Europa League
  "88": 2, // Eredivisie
  "94": 2, // Primeira Liga
  "203": 2, // Süper Lig
  "144": 2, // Belgian First Division A
  // football-data ids
  "fd:2021": 1, // EPL
  "fd:2014": 1, // La Liga
  "fd:2019": 1, // Serie A
  "fd:2002": 1, // Bundesliga
  "fd:2015": 1, // Ligue 1
  "fd:2001": 1, // Champions League
  "fd:2146": 2, // Europa League
  "fd:2003": 2, // Eredivisie
  "fd:2017": 2, // Primeira Liga
  "fd:2073": 2, // Süper Lig
  "fd:2033": 2, // Belgian First Division A
};

export function leaguePriority(providerId: string): number {
  return PRIORITY[providerId] ?? 0;
}
