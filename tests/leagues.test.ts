import { describe, it, expect } from "vitest";
import { isProfessionalLeague } from "@/lib/leagues";

describe("isProfessionalLeague", () => {
  it("accepts genuine professional competitions", () => {
    const pro = [
      "Premier League",
      "La Liga",
      "Serie A",
      "Serie B",
      "Bundesliga",
      "Ligue 1",
      "Ligue 2",
      "Champions League",
      "Europa League",
      "J1 League",
      "J2 League",
      "J3 League",
      "Eredivisie",
      "Primeira Liga",
      "Süper Lig",
      "Belgian First Division A",
      "Persha Liga",
      "League One",
      "Liga MX",
      "Copa Libertadores",
      "UEFA Europa Conference League",
      "3. Liga", // German third tier is professional
      "Championship", // English second tier
      "Segunda División", // Spanish second tier
      "Primera Nacional", // Argentine second tier
      "FNL", // Russian second tier
      "Serie B", // Italian second tier
      "Eerste Divisie", // Dutch second tier
      "Superettan", // Swedish second tier
      "Primera B", // Chilean second tier
      "1. SNL", // Slovenian top tier
    ];
    for (const name of pro) {
      expect(isProfessionalLeague(name), name).toBe(true);
    }
  });

  it("rejects youth, reserve, amateur and friendly competitions", () => {
    const amateur = [
      "U18 Premier League - South",
      "U18 Premier League - North",
      "1. Liga U19",
      "UEFA Youth League",
      "Club Friendlies",
      "Friendlies Clubs",
      "International Friendlies",
      "National Premier Leagues NSW",
      "South Australia NPL",
      "Reserve League",
      "Benfica Reserves",
      "Liga 3",
      "Premier League 2",
      "Amateur Cup",
      "Junioren Bundesliga",
      "Academy League",
      "UEFA U19 Championship",
      "Derde Divisie",
      "Tweede Divisie",
      "Oberliga - Bayern Nord",
      "Regionalliga - West",
      "Non League Premier - Isthmian",
      "Highland League",
      "Lowland League",
      "South Australia State League 1",
      "NNSW League 1",
      "Queensland Premier League",
      "Tasmania Northern Championship",
      "Division 2 - Norra Götaland",
      "Ettan - Norra",
      "Second League - Group 3",
      "Second League A - Division A Gold",
      "Third League - Southeast",
      "Druha Liga",
      "Esiliiga A",
      "2. Deild",
      "3. SNL - East",
      "1 Lyga",
      "Campeonato de Portugal Prio - Group A",
      "Serie C",
      "Serie D",
      "Coppa Italia Serie C",
      "Torneo Federal A",
      "Primera C",
      "Primera B Metropolitana",
      "Division Intermedia",
      "MLS Next Pro",
      "FAW Championship",
      "Chatham Cup",
      "Calcutta Premier Division",
      "Goiano - 2",
      "Mineiro - 2",
      "Paranaense - 3",
      "Paulista Série B",
      "Capixaba B",
      "3. liga - CFL B",
      "4. liga - Divizie A",
      "1. Liga Classic - Group 1",
      "III Liga - Group 1",
      "II Liga - East",
      "NB III - Northeast",
      "Premier League Cup",
      "Ligue 3",
    ];
    for (const name of amateur) {
      expect(isProfessionalLeague(name), name).toBe(false);
    }
  });
});
