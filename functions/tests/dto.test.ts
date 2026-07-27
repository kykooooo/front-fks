// functions/tests/dto.test.ts
// Garde-fou anti-fuite `assertCoachSafe` (dernier rempart avant écriture).

import { assertCoachSafe, isForbiddenKey } from "../src/dto";

describe("assertCoachSafe", () => {
  it("accepte une projection propre", () => {
    expect(() =>
      assertCoachSafe({
        playerUid: "p",
        firstName: "Anna",
        adaptation: { adapted: true, labels: ["Contrôle appuis et alignement"] },
        latestSession: { id: "s1", status: "done", durationMin: 40 },
      }),
    ).not.toThrow();
  });

  it("rejette une clé interdite en top-level", () => {
    expect(() => assertCoachSafe({ playerUid: "p", rpe: 8 })).toThrow(/rpe/i);
  });

  it("rejette une clé interdite imbriquée (dans un objet)", () => {
    expect(() => assertCoachSafe({ latestSession: { metrics: { tsb: -14 } } })).toThrow(/metrics/i);
  });

  it("rejette une clé interdite imbriquée dans un tableau", () => {
    expect(() => assertCoachSafe({ items: [{ ok: 1 }, { feedback: { pain: 3 } }] })).toThrow(/feedback/i);
  });

  it("rejette 'ai' et 'aiV2' (blueprints)", () => {
    expect(() => assertCoachSafe({ ai: {} })).toThrow(/ai/i);
    expect(() => assertCoachSafe({ aiV2: {} })).toThrow(/ai/i);
  });
});

// Durcissement : avant, le garde-fou comparait la clé en ÉGALITÉ STRICTE, donc
// `painFlag`/`fatigueLevel`/`rpeAvg` passaient. Ces deux blocs verrouillent la
// détection par racine ET l'absence de faux positif sur le vocabulaire du DTO.
describe("isForbiddenKey — clés VOISINES d'une clé sensible", () => {
  const NEIGHBOURS = [
    "painFlag",
    "painZoneCode",
    "hasPain",
    "douleurGenou",
    "fatigueLevel",
    "avgFatigue",
    "sleepScore",
    "sommeilMoyen",
    "recoveryIndex",
    "recuperationScore",
    "injuryHistory",
    "blessureEnCours",
    "medicalNote",
    "healthStatus",
    "moodScore",
    "stressLevel",
    "playerComment",
    "feedbackCount",
    "rpeAvg",
    "avgRPE",
    "rpe_target",
    "rpe7",
    "tsbTrend",
    "atlValue",
    "ctl_7d",
  ];

  it.each(NEIGHBOURS)("rejette \"%s\"", (key) => {
    expect(isForbiddenKey(key)).toBe(true);
    expect(() => assertCoachSafe({ [key]: 1 })).toThrow();
  });

  it("rejette une clé voisine imbriquée profondément", () => {
    expect(() => assertCoachSafe({ execution: { items: [{ ok: 1 }, { painLevel: 3 }] } })).toThrow(/painLevel/);
  });
});

describe("isForbiddenKey — vocabulaire LÉGITIME du DTO (aucun faux positif)", () => {
  // Si l'un de ces noms venait à lever, la règle serait à corriger ICI et le
  // champ à renommer là-bas : on n'assouplit jamais le garde-fou.
  const LEGIT = [
    "playerUid",
    "firstName",
    "ageCategory",
    "position",
    "level",
    "profileComplete",
    "latestSession",
    "lastActivity",
    "adaptation",
    "adapted",
    "labels",
    "activity",
    "doneDateKeys",
    "lastPlanned",
    "lastDone",
    "execution",
    "completionPct",
    "completionStatus",
    "itemsDone",
    "itemsAdapted",
    "itemsSkipped",
    "itemsReplaced",
    // Détail du calcul du pourcentage : ce sont des COMPTAGES d'exercices, rien
    // de sensible — le garde-fou ne doit pas les refuser.
    "itemsReplacedEquivalent",
    "itemsReplacedPartial",
    "itemsTotal",
    "deviationLabels",
    "dateKey",
    "title",
    "focusLabel",
    "intensityLabel",
    "durationMin",
    "blockCount",
    "status",
    "sourceEventAt",
    "sourceEventTime",
    "sourceEventId",
    "updatedAt",
  ];

  it.each(LEGIT)("accepte \"%s\"", (key) => {
    expect(isForbiddenKey(key)).toBe(false);
  });

  it("accepte une projection v2 complète", () => {
    expect(() =>
      assertCoachSafe({
        playerUid: "p",
        activity: { doneDateKeys: ["2026-07-20"] },
        lastPlanned: { dateKey: "2026-07-22", durationMin: 40, blockCount: 4 },
        lastDone: { dateKey: "2026-07-20", durationMin: 38, blockCount: 4 },
        execution: {
          completionPct: 80,
          completionStatus: "partial",
          itemsDone: 8,
          itemsAdapted: 1,
          itemsSkipped: 1,
          itemsReplaced: 0,
          itemsReplacedEquivalent: 0,
          itemsReplacedPartial: 0,
          itemsTotal: 12,
          deviationLabels: ["Manque de temps", "Autre raison"],
        },
      }),
    ).not.toThrow();
  });
});
