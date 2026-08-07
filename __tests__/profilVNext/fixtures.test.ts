// __tests__/profilVNext/fixtures.test.ts
// =============================================================================
// Les fixtures doivent porter le FORMAT REEL persiste — le piege du 28/07 :
// une fixture arrangee fabrique une demo qui ment. Les allowlists ci-dessous
// sont recopiees des ECRIVAINS reels (ProfileSetupScreen, clubMembershipCopy),
// pas des maps d'affichage.
// =============================================================================

import { PROFIL_VNEXT_FIXTURES, FIXTURE_NOW_ISO } from "../../screens/profilVNext/fixtures";
import { isMicrocycleId } from "../../domain/microcycles";

// Les valeurs que ProfileSetupScreen.tsx:85-93 persiste — SANS accents, sauf
// le « i » circonflexe reel de « entraînements ».
const POSITIONS = ["Gardien", "Defenseur", "Milieu", "Attaquant"];
const LEVELS = ["Amateur", "Regional", "National", "Semi-pro", "Pro"];
const FEET = ["Pied droit", "Pied gauche", "Ambidextre"];
const OBJECTIVES = [
  "Etre en forme toute la saison",
  "Gagner en vitesse / explosivite",
  "Mieux encaisser les entraînements et les matchs",
  "Reprendre apres une blessure",
];
// Les 6 badges exacts de clubMembershipCopy (domain/clubRoles.ts:170,178,187).
const BADGES = [
  "Propriétaire-joueur",
  "Propriétaire",
  "Encadrant-joueur",
  "Encadrant",
  "Joueur",
  "Membre",
];

describe("fixtures au format reel", () => {
  it("chaque fixture est marquee fictive", () => {
    for (const f of PROFIL_VNEXT_FIXTURES) expect(f.__fictif).toBe(true);
  });

  it("l'instant de reference est fige et sans fuseau", () => {
    expect(FIXTURE_NOW_ISO).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    for (const f of PROFIL_VNEXT_FIXTURES) expect(f.input.nowISO).toBe(FIXTURE_NOW_ISO);
  });

  it("les valeurs d'identite sont EXACTEMENT celles que le setup persiste", () => {
    for (const f of PROFIL_VNEXT_FIXTURES) {
      const p = f.input.profil;
      if (p.position != null) expect(POSITIONS).toContain(p.position);
      if (p.level != null) expect(LEVELS).toContain(p.level);
      if (p.dominantFoot != null) expect(FEET).toContain(p.dominantFoot);
      if (p.mainObjective != null) expect(OBJECTIVES).toContain(p.mainObjective);
    }
  });

  it("aucune fixture ne porte un libelle ACCENTUE la ou le produit persiste sans accent", () => {
    for (const f of PROFIL_VNEXT_FIXTURES) {
      const p = f.input.profil;
      expect(p.position).not.toBe("Défenseur");
      expect(p.level).not.toBe("Régional");
      if (p.mainObjective != null) {
        expect(p.mainObjective.startsWith("Être")).toBe(false);
        expect(p.mainObjective.includes("explosivité")).toBe(false);
        expect(p.mainObjective.includes("après")).toBe(false);
      }
    }
  });

  it("les ids de cycle sont canoniques ou null (le store canonicalise a l'ecriture)", () => {
    for (const f of PROFIL_VNEXT_FIXTURES) {
      const goal = f.input.cycle.microcycleGoal;
      if (goal != null) expect(isMicrocycleId(goal)).toBe(true);
    }
  });

  it("coherence tests : count > 0 <=> lastTs present, en millisecondes", () => {
    for (const f of PROFIL_VNEXT_FIXTURES) {
      const t = f.input.tests;
      if (t.count > 0) {
        expect(typeof t.lastTs).toBe("number");
        expect(Number.isFinite(t.lastTs)).toBe(true);
        expect(t.lastTs as number).toBeGreaterThan(1_500_000_000_000); // ms, pas secondes
      } else {
        expect(t.lastTs).toBeNull();
      }
      expect(t.count).toBeLessThanOrEqual(30); // le stockage reel est cappe a 30
    }
  });

  it("coherence club : badge et nom n'existent qu'avec un clubId, badge dans la liste exacte", () => {
    for (const f of PROFIL_VNEXT_FIXTURES) {
      const c = f.input.club;
      if (c.clubId == null) {
        expect(c.nom).toBeNull();
        expect(c.badge).toBeNull();
      }
      if (c.badge != null) expect(BADGES).toContain(c.badge);
    }
  });

  it("les cibles de rythme restent dans les bornes du domaine (1..6) quand declarees", () => {
    for (const f of PROFIL_VNEXT_FIXTURES) {
      const v = f.input.profil.targetFksSessionsPerWeek;
      if (v != null) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
      }
    }
  });
});
