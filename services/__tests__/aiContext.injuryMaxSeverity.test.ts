// services/__tests__/aiContext.injuryMaxSeverity.test.ts
//
// Tests dédiés à `computeInjuryMaxSeverityFromAllSources` (fix P1 pré-Jour 4).
// Vérifie que l'unification des 2 sources (profile.activeInjuries +
// dayStates.injury des 7 derniers jours) retourne bien le max des sévérités.
//
// Import direct depuis `injuryContext.ts` (helpers purs, sans dépendance
// firebase). Voir aussi les commentaires dans ce fichier source.

import { computeInjuryMaxSeverityFromAllSources } from "../injuryContext";
import type { ActiveInjuryParsed } from "../../schemas/firestoreSchemas";
import type { InjuryRecord } from "../../domain/types";

const TODAY = "2026-04-24";

// Helper : produit un dayStates map avec N jours d'historique avant TODAY.
function buildDayStates(entries: Array<{ daysBack: number; injury: InjuryRecord | null }>) {
  const out: Record<string, { feedback?: { injury?: InjuryRecord | null } }> = {};
  const today = new Date(TODAY + "T12:00:00Z");
  for (const { daysBack, injury } of entries) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - daysBack);
    const key = d.toISOString().slice(0, 10);
    out[key] = { feedback: { injury } };
  }
  return out;
}

const baseInjury = (severity: number, area = "genou"): InjuryRecord => ({
  area: area as InjuryRecord["area"],
  severity: severity as InjuryRecord["severity"],
  type: "aigu",
  restrictions: {},
  startDate: TODAY,
  lastConfirm: TODAY,
});

const baseActiveInjury = (severity: number, area = "genou"): ActiveInjuryParsed => ({
  area,
  severity,
  type: "aigu",
  restrictions: {},
  startDate: TODAY,
  lastConfirm: TODAY,
  note: null,
});

describe("computeInjuryMaxSeverityFromAllSources", () => {
  it("retourne 0 quand les 2 sources sont vides", () => {
    expect(computeInjuryMaxSeverityFromAllSources([], {}, TODAY)).toBe(0);
  });

  it("retourne 0 quand les 2 sources sont undefined", () => {
    expect(computeInjuryMaxSeverityFromAllSources(undefined, undefined, TODAY)).toBe(0);
  });

  it("source dayStates seule (PainInjuryRow) : sévérité 2 → retourne 2", () => {
    // Reproduit le cas bug détecté dans l'audit : joueur déclare via
    // PainInjuryRow post-séance, profile.activeInjuries reste vide, mais
    // dayStates[today].feedback.injury contient l'injury.
    const dayStates = buildDayStates([
      { daysBack: 0, injury: baseInjury(2) },
    ]);
    expect(computeInjuryMaxSeverityFromAllSources([], dayStates, TODAY)).toBe(2);
  });

  it("source profile seule : sévérité 3 → retourne 3", () => {
    const activeInjuries = [baseActiveInjury(3)];
    expect(computeInjuryMaxSeverityFromAllSources(activeInjuries, {}, TODAY)).toBe(3);
  });

  it("les 2 sources ont des sévérités différentes → retourne le max", () => {
    // Profile = 1 (gêne légère), dayStates = 3 (gêne forte) → max = 3.
    const activeInjuries = [baseActiveInjury(1)];
    const dayStates = buildDayStates([
      { daysBack: 2, injury: baseInjury(3) },
    ]);
    expect(computeInjuryMaxSeverityFromAllSources(activeInjuries, dayStates, TODAY)).toBe(3);
  });

  it("inverse : profile plus haut que dayStates → retourne profile", () => {
    const activeInjuries = [baseActiveInjury(3)];
    const dayStates = buildDayStates([
      { daysBack: 0, injury: baseInjury(1) },
    ]);
    expect(computeInjuryMaxSeverityFromAllSources(activeInjuries, dayStates, TODAY)).toBe(3);
  });

  it("ignore les injuries dayStates hors fenêtre 7 jours", () => {
    // dayStates a une injury severity 3 il y a 10 jours → hors window 7j.
    const dayStates = buildDayStates([
      { daysBack: 10, injury: baseInjury(3) },
    ]);
    expect(computeInjuryMaxSeverityFromAllSources([], dayStates, TODAY, 7)).toBe(0);
  });

  it("plusieurs injuries profile : prend le max", () => {
    const activeInjuries = [
      baseActiveInjury(1, "cheville"),
      baseActiveInjury(2, "genou"),
      baseActiveInjury(1, "poignet"),
    ];
    expect(computeInjuryMaxSeverityFromAllSources(activeInjuries, {}, TODAY)).toBe(2);
  });

  it("plusieurs dayStates avec injuries : prend le max dans la fenêtre", () => {
    const dayStates = buildDayStates([
      { daysBack: 1, injury: baseInjury(1) },
      { daysBack: 3, injury: baseInjury(2) },
      { daysBack: 5, injury: baseInjury(3) },
    ]);
    expect(computeInjuryMaxSeverityFromAllSources([], dayStates, TODAY)).toBe(3);
  });

  it("borné à [0, 3] même si valeurs aberrantes (défense Firestore)", () => {
    const activeInjuries = [
      { ...baseActiveInjury(2), severity: 99 as unknown as ActiveInjuryParsed["severity"] },
    ];
    expect(computeInjuryMaxSeverityFromAllSources(activeInjuries, {}, TODAY)).toBe(3);
  });

  it("injury null ou undefined dans dayStates : skip sans crash", () => {
    const dayStates: Record<string, { feedback?: { injury?: InjuryRecord | null } }> = {
      [TODAY]: { feedback: { injury: null } },
    };
    expect(computeInjuryMaxSeverityFromAllSources([], dayStates, TODAY)).toBe(0);
  });
});
