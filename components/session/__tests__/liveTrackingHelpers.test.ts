// components/session/__tests__/liveTrackingHelpers.test.ts
import {
  DEVIATION_REASON_LABELS,
  DEVIATION_REASON_ORDER,
  buildReplacementChain,
  deriveActualFieldsConfig,
  deriveMatchContext,
  hasExplicitItemStatus,
} from "../liveTrackingHelpers";
import type { ItemExecution, ReplacementRequest } from "../../../domain/tracking/types";

describe("deriveActualFieldsConfig", () => {
  it("propose charge + repetitions quand les notes contiennent une charge en kg", () => {
    const fields = deriveActualFieldsConfig({ notes: "Charge recommandee : 40kg", name: "Squat" });
    expect(fields).toEqual({ loadKg: true, reps: true, distanceM: false, durationS: false });
  });

  it("propose charge + repetitions quand le nom contient 'charge'", () => {
    const fields = deriveActualFieldsConfig({ name: "Presse a charge progressive" });
    expect(fields).toEqual({ loadKg: true, reps: true, distanceM: false, durationS: false });
  });

  it("propose repetitions + distance pour une modalite course", () => {
    const fields = deriveActualFieldsConfig({ name: "Sprint 20m", modality: "run" });
    expect(fields).toEqual({ loadKg: false, reps: true, distanceM: true, durationS: false });
  });

  it("propose repetitions + distance quand le nom mentionne un sprint hors modalite run", () => {
    const fields = deriveActualFieldsConfig({ name: "Sprint navette", modality: "cod" });
    expect(fields).toEqual({ loadKg: false, reps: true, distanceM: true, durationS: false });
  });

  it("propose une duree quand workS est connu et qu'aucune repetition n'est prescrite", () => {
    const fields = deriveActualFieldsConfig({ name: "Gainage planche", modality: "core", workS: 30, reps: null });
    expect(fields).toEqual({ loadKg: false, reps: false, distanceM: false, durationS: true });
  });

  it("propose une duree quand durationMin est connu sans repetitions", () => {
    const fields = deriveActualFieldsConfig({ name: "Footing", modality: "circuit", durationMin: 20, reps: undefined });
    expect(fields).toEqual({ loadKg: false, reps: false, distanceM: false, durationS: true });
  });

  it("retombe sur repetitions par defaut", () => {
    const fields = deriveActualFieldsConfig({ name: "Fentes marchees" });
    expect(fields).toEqual({ loadKg: false, reps: true, distanceM: false, durationS: false });
  });

  it("prefere charge+reps meme si une duree de travail est presente (kg detecte en premier)", () => {
    const fields = deriveActualFieldsConfig({ name: "Souleve charge lourde", workS: 20 });
    expect(fields).toEqual({ loadKg: true, reps: true, distanceM: false, durationS: false });
  });
});

describe("deriveMatchContext", () => {
  // 2026-07-25 est un samedi (sat).
  const SATURDAY_ISO = "2026-07-25T10:00:00.000Z";

  it("retourne none si aucun jour de match", () => {
    expect(deriveMatchContext([], SATURDAY_ISO)).toBe("none");
    expect(deriveMatchContext(null, SATURDAY_ISO)).toBe("none");
  });

  it("detecte match_today", () => {
    expect(deriveMatchContext(["sat"], SATURDAY_ISO)).toBe("match_today");
  });

  it("detecte match_tomorrow", () => {
    expect(deriveMatchContext(["sun"], SATURDAY_ISO)).toBe("match_tomorrow");
  });

  it("detecte match_in_two_days", () => {
    expect(deriveMatchContext(["mon"], SATURDAY_ISO)).toBe("match_in_two_days");
  });

  it("detecte match_yesterday", () => {
    expect(deriveMatchContext(["fri"], SATURDAY_ISO)).toBe("match_yesterday");
  });

  it("priorise match_today si plusieurs jours matchent (aujourd'hui ET dans 2 jours)", () => {
    expect(deriveMatchContext(["sat", "mon"], SATURDAY_ISO)).toBe("match_today");
  });

  it("retourne none si les matchs sont hors fenetre J-1..J+2", () => {
    expect(deriveMatchContext(["wed"], SATURDAY_ISO)).toBe("none");
  });

  it("retourne unknown si la date de lancement est invalide", () => {
    expect(deriveMatchContext(["sat"], "")).toBe("unknown");
  });
});

describe("hasExplicitItemStatus", () => {
  function makeItem(overrides: Partial<ItemExecution> = {}): ItemExecution {
    return {
      key: "0-0",
      status: "unknown",
      reason: null,
      comment: null,
      actual: null,
      replacement: null,
      setsChecked: 0,
      setsTotal: 3,
      ...overrides,
    };
  }

  it("false si tous les items sont unknown ou done", () => {
    expect(hasExplicitItemStatus([makeItem(), makeItem({ status: "done" })])).toBe(false);
  });

  it("true des qu'un item est adapted", () => {
    expect(hasExplicitItemStatus([makeItem(), makeItem({ status: "adapted", reason: "fatigue" })])).toBe(true);
  });

  it("true des qu'un item est skipped", () => {
    expect(hasExplicitItemStatus([makeItem({ status: "skipped", reason: "time" })])).toBe(true);
  });

  it("true des qu'un item est replaced", () => {
    expect(
      hasExplicitItemStatus([
        makeItem({
          status: "replaced",
          reason: "equipment",
          replacement: {
            originalExerciseId: "a",
            replacementExerciseId: "b",
            reason: "equipment",
            equivalent: true,
            prescription: { sets: null, reps: null, durationS: null, restS: null, note: null },
          },
        }),
      ])
    ).toBe(true);
  });

  it("false pour un tableau vide", () => {
    expect(hasExplicitItemStatus([])).toBe(false);
  });
});

describe("DEVIATION_REASON_LABELS / ORDER", () => {
  it("porte un libelle FR pour chaque raison de l'ordre d'affichage", () => {
    expect(DEVIATION_REASON_ORDER).toHaveLength(9);
    DEVIATION_REASON_ORDER.forEach((reason) => {
      expect(typeof DEVIATION_REASON_LABELS[reason]).toBe("string");
      expect(DEVIATION_REASON_LABELS[reason].length).toBeGreaterThan(0);
    });
  });
});

describe("buildReplacementChain", () => {
  function req(overrides: Partial<ReplacementRequest["context"]> = {}): ReplacementRequest {
    return {
      exerciseId: "str_back_squat",
      reason: "equipment",
      context: {
        equipmentAvailable: ["water_bottles"],
        ageCategory: "Senior",
        activePains: [],
        matchSoon: false,
        highFatigue: false,
        solo: true,
        excludeIds: [],
        ...overrides,
      },
    };
  }

  it("construit jusqu'a MAX_PROPOSALS_PER_ITEM propositions distinctes, la plus preferee en premier", () => {
    const chain = buildReplacementChain(req());
    expect(chain.length).toBe(2);
    expect(chain[0].exerciseId).toBe("str_air_squat");
    expect(chain[1].exerciseId).toBe("str_goblet_squat");
    // Jamais deux fois la meme proposition dans la chaine.
    expect(new Set(chain.map((p) => p.exerciseId)).size).toBe(chain.length);
  });

  it("respecte les excludeIds deja fournis par l'appelant (jamais la meme proposition deux fois)", () => {
    const chain = buildReplacementChain(req({ excludeIds: ["str_air_squat"] }));
    expect(chain[0].exerciseId).toBe("str_goblet_squat");
    expect(chain.every((p) => p.exerciseId !== "str_air_squat")).toBe(true);
  });

  it("s'arrete honnetement des qu'aucune alternative supplementaire n'existe (jamais null au milieu de la chaine)", () => {
    // Registre (str_air_squat, str_goblet_squat) ET pool de repli
    // (strength_lower_squat) entierement excluent -> plus rien a proposer.
    const chain = buildReplacementChain(
      req({ excludeIds: ["str_air_squat", "str_goblet_squat", "str_air_squat_pause_2s", "str_air_squat_tempo_3s"] })
    );
    expect(chain).toEqual([]);
  });

  it("ne depasse jamais maxProposals meme si on l'abaisse volontairement", () => {
    const chain = buildReplacementChain(req(), 1);
    expect(chain).toHaveLength(1);
    expect(chain[0].exerciseId).toBe("str_air_squat");
  });

  it("retourne une chaine vide honnete pour une raison douleur sans registre pain-safe", () => {
    // str_back_squat n'a aucune entree painSafe=true dans le registre, et le
    // fallback est desactive sur reason="pain" (voir select.ts).
    const chain = buildReplacementChain(req({ }));
    const painChain = buildReplacementChain({ ...req(), reason: "pain" });
    expect(painChain).toEqual([]);
    // sanity check that the non-pain chain above is unaffected by this call
    expect(chain.length).toBeGreaterThan(0);
  });
});
