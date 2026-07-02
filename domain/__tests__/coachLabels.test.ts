// domain/__tests__/coachLabels.test.ts
// Depuis PR-3, coachLabels ne garde que des libellés purement front (semaine,
// groupe, garde-fous statiques). La traduction des guardrails est faite serveur ;
// la logique de statut/tri/résumé vit dans domain/coachSummary.ts (testée à part).
import { getTeamPlayerLabel, getCoachGuardrailNotes, formatCoachWeekLabel } from "../coachLabels";

describe("formatCoachWeekLabel — libellé semaine active", () => {
  test("semaine dans le même mois (lundi 8 → dimanche 14 juin 2026)", () => {
    expect(formatCoachWeekLabel("2026-06-08")).toBe("Semaine du 8 au 14 juin 2026");
  });
  test("semaine à cheval sur deux mois (lundi 29 juin → dimanche 5 juillet)", () => {
    expect(formatCoachWeekLabel("2026-06-29")).toBe("Semaine du 29 juin au 5 juillet 2026");
  });
  test("entrée invalide → fallback neutre", () => {
    expect(formatCoachWeekLabel(null)).toBe("Semaine en cours");
    expect(formatCoachWeekLabel("")).toBe("Semaine en cours");
    expect(formatCoachWeekLabel("pas-une-date")).toBe("Semaine en cours");
  });
});

describe("getTeamPlayerLabel — libellé groupe selon type d'équipe", () => {
  test("female → Joueuses", () => expect(getTeamPlayerLabel("female")).toBe("Joueuses"));
  test("male → Joueurs", () => expect(getTeamPlayerLabel("male")).toBe("Joueurs"));
  test("mixed → Effectif", () => expect(getTeamPlayerLabel("mixed")).toBe("Effectif"));
  test("absent / inconnu → Effectif", () => {
    expect(getTeamPlayerLabel(null)).toBe("Effectif");
    expect(getTeamPlayerLabel(undefined)).toBe("Effectif");
    expect(getTeamPlayerLabel("whatever")).toBe("Effectif");
  });
});

describe("getCoachGuardrailNotes — garde-fous FKS", () => {
  test("Senior → 3 notes + 'adaptées à la catégorie' (pas de note jeune)", () => {
    const notes = getCoachGuardrailNotes("Senior");
    expect(notes.length).toBe(3);
    expect(notes[0]).toMatch(/Lecture seule/);
    expect(notes.join(" ")).toContain("adaptées à la catégorie");
    expect(notes.join(" ")).not.toMatch(/jeunes/);
  });
  test("catégorie jeune (U15) → 'adaptées à la catégorie' + note jeune", () => {
    const notes = getCoachGuardrailNotes("U15");
    expect(notes.length).toBe(4);
    expect(notes.join(" ")).toContain("adaptées à la catégorie");
    expect(notes[3]).toMatch(/jeunes/);
  });
  test("toutes les catégories jeunes → +1 note appuis/renfo", () => {
    for (const cat of ["U13", "U15", "U17", "U18"]) {
      const notes = getCoachGuardrailNotes(cat);
      expect(notes.length).toBe(4);
      expect(notes[3]).toMatch(/jeunes/);
    }
  });
  test("absent / inconnu → 'cadrées par FKS', pas 'à la catégorie', pas de note jeune", () => {
    for (const v of [null, undefined, "", "U99", "brutal"]) {
      const notes = getCoachGuardrailNotes(v);
      expect(notes.length).toBe(3);
      expect(notes.join(" ")).toContain("cadrées par FKS");
      expect(notes.join(" ")).not.toContain("adaptées à la catégorie");
      expect(notes.join(" ")).not.toMatch(/jeunes/);
    }
  });
  test("aucune note ne contient de promesse / terme interdit", () => {
    const notes = getCoachGuardrailNotes("U15");
    const forbidden = /blessure|protège|réduit le risque|lca|entorse|claquage|menstru|fragile/i;
    notes.forEach((n) => expect(n).not.toMatch(forbidden));
  });
});
