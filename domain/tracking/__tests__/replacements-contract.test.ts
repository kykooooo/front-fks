// domain/tracking/__tests__/replacements-contract.test.ts
import { EXERCISE_BY_ID } from "../../../engine/exerciseBank";
import {
  checkEquipmentConeNote,
  checkHeavyToLightDifficulty,
  validateFallbackPoolsIntegrity,
  validateProposalAgainstRequest,
  validateRegistryIntegrity,
} from "../replacements/contract";
import { FALLBACK_POOLS, FAMILY_BY_ID, IMPORTANT_EXERCISE_IDS, REPLACEMENT_REGISTRY, buildCoverageReport } from "../replacements/registry";
import { selectReplacement } from "../replacements/select";
import type { ReplacementEntry, ReplacementProposal, ReplacementRequest } from "../types";

describe("validateRegistryIntegrity", () => {
  it("retourne 0 erreur sur le registre livre", () => {
    const errors = validateRegistryIntegrity();
    expect(errors).toEqual([]);
  });

  it("toutes les cles et alternatives du registre existent bien dans EXERCISE_BY_ID", () => {
    for (const [key, entries] of Object.entries(REPLACEMENT_REGISTRY)) {
      expect(EXERCISE_BY_ID[key]).toBeDefined();
      for (const entry of entries) {
        expect(EXERCISE_BY_ID[entry.altExerciseId]).toBeDefined();
        expect(entry.altExerciseId).not.toBe(key);
      }
    }
  });

  it("aucun exercice medball (zero ballon) n'apparait dans le registre, ni comme original ni comme alternative", () => {
    for (const [key, entries] of Object.entries(REPLACEMENT_REGISTRY)) {
      expect(key.startsWith("mb_")).toBe(false);
      for (const entry of entries) {
        expect(entry.altExerciseId.startsWith("mb_")).toBe(false);
      }
    }
  });
});

describe("buildCoverageReport", () => {
  it("importantCount = coveredCount + uncoveredIds.length (egalite exacte)", () => {
    const report = buildCoverageReport();
    expect(report.importantCount).toBe(IMPORTANT_EXERCISE_IDS.length);
    expect(report.coveredCount + report.uncoveredIds.length).toBe(report.importantCount);
  });

  it("chaque id non couvert porte une raison honnete non vide", () => {
    const report = buildCoverageReport();
    expect(report.uncoveredIds.length).toBeGreaterThan(0); // au moins un ecart assume et documente
    for (const id of report.uncoveredIds) {
      expect(report.reasons[id]).toBeTruthy();
      expect(report.reasons[id].length).toBeGreaterThan(10);
    }
  });

  it("un id couvert n'apparait jamais dans uncoveredIds ni dans reasons", () => {
    const report = buildCoverageReport();
    const coveredIds = IMPORTANT_EXERCISE_IDS.filter((id) => !report.uncoveredIds.includes(id));
    for (const id of coveredIds) {
      expect(report.reasons[id]).toBeUndefined();
    }
  });
});

describe("validateProposalAgainstRequest", () => {
  function req(exerciseId: string, reason: ReplacementRequest["reason"], contextOverrides: Partial<ReplacementRequest["context"]> = {}): ReplacementRequest {
    return {
      exerciseId,
      reason,
      context: {
        equipmentAvailable: [],
        ageCategory: "Senior",
        activePains: [],
        matchSoon: false,
        highFatigue: false,
        solo: false,
        excludeIds: [],
        ...contextOverrides,
      },
    };
  }

  it("une proposition reelle issue de selectReplacement ne souleve aucune erreur", () => {
    const request = req("str_back_squat", "equipment", { equipmentAvailable: ["water_bottles"] });
    const proposal = selectReplacement(request);
    expect(proposal).not.toBeNull();
    expect(validateProposalAgainstRequest(proposal as ReplacementProposal, request)).toEqual([]);
  });

  it("detecte une auto-reference (proposal.exerciseId === request.exerciseId)", () => {
    const request = req("str_back_squat", "equipment");
    const badProposal: ReplacementProposal = {
      exerciseId: "str_back_squat",
      name: "Back squat lourd",
      shortWhy: "invalide",
      prescription: { sets: null, reps: null, durationS: null, restS: null, note: null },
      equivalent: false,
      source: "rule",
    };
    const errors = validateProposalAgainstRequest(badProposal, request);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("auto-reference"))).toBe(true);
  });

  it("detecte un materiel absent (proposition registre exigeant un materiel non disponible)", () => {
    const request = req("str_back_squat", "too_difficult", { equipmentAvailable: [] });
    // str_goblet_squat exige water_bottles -- on force artificiellement une
    // proposition "registry" pour ce couple malgre un contexte sans materiel.
    const badProposal: ReplacementProposal = {
      exerciseId: "str_goblet_squat",
      name: "Goblet squat",
      shortWhy: "invalide",
      prescription: { sets: 3, reps: 12, durationS: null, restS: 60, note: null },
      equivalent: false,
      source: "registry",
    };
    const errors = validateProposalAgainstRequest(badProposal, request);
    expect(errors.some((e) => e.includes("materiel"))).toBe(true);
  });

  it("detecte le non-respect d'excludeIds", () => {
    const request = req("str_back_squat", "equipment", { equipmentAvailable: [], excludeIds: ["str_air_squat"] });
    const badProposal: ReplacementProposal = {
      exerciseId: "str_air_squat",
      name: "Air squat",
      shortWhy: "invalide",
      prescription: { sets: 3, reps: 14, durationS: null, restS: 60, note: null },
      equivalent: false,
      source: "registry",
    };
    const errors = validateProposalAgainstRequest(badProposal, request);
    expect(errors.some((e) => e.includes("excludeIds"))).toBe(true);
  });

  it("detecte une alternative incompatible avec une douleur active (tag de zone porte)", () => {
    const request = req("str_leg_press", "equipment", { equipmentAvailable: ["chair"], activePains: ["knee_pain"] });
    const badProposal: ReplacementProposal = {
      exerciseId: "str_bulgarian_split", // porte knee_stress
      name: "Bulgarian split squat",
      shortWhy: "invalide",
      prescription: { sets: 3, reps: 8, durationS: null, restS: 60, note: null },
      equivalent: false,
      source: "registry",
    };
    const errors = validateProposalAgainstRequest(badProposal, request);
    expect(errors.some((e) => e.includes("risque"))).toBe(true);
  });
});

function fakeEntry(overrides: Partial<ReplacementEntry> = {}): ReplacementEntry {
  return {
    altExerciseId: "str_air_squat",
    reasonsAllowed: ["equipment"],
    preservedQuality: "test_quality",
    equipmentRequired: [],
    relativeDifficulty: "easier",
    prescriptionAdapter: {},
    minAge: null,
    painSafe: false,
    soloOk: true,
    compactSpaceOk: true,
    ...overrides,
  };
}

describe("checkHeavyToLightDifficulty (P1 -- degradation heavy -> leger jamais 'similar')", () => {
  it("CONFIRME : original charge (heavy_lower) + alternative poids du corps + 'similar' -> erreur", () => {
    const error = checkHeavyToLightDifficulty("str_back_squat", fakeEntry({ equipmentRequired: [], relativeDifficulty: "similar" }));
    expect(error).not.toBeNull();
    expect(error).toContain("str_back_squat");
    expect(error).toContain("easier");
  });

  it("CONFIRME : original charge (heavy_upper) + alternative charge legere (water_bottles) + 'similar' -> erreur", () => {
    const error = checkHeavyToLightDifficulty("str_bench_press", fakeEntry({ equipmentRequired: ["water_bottles"], relativeDifficulty: "similar" }));
    expect(error).not.toBeNull();
  });

  it("ne signale rien quand relativeDifficulty est deja 'easier'", () => {
    const error = checkHeavyToLightDifficulty("str_back_squat", fakeEntry({ equipmentRequired: [], relativeDifficulty: "easier" }));
    expect(error).toBeNull();
  });

  it("ne signale rien quand l'original n'est pas charge (pas de tag heavy_lower/heavy_upper)", () => {
    const error = checkHeavyToLightDifficulty("core_plank", fakeEntry({ equipmentRequired: [], relativeDifficulty: "similar" }));
    expect(error).toBeNull();
  });

  it("ne signale rien quand l'equipement de l'alternative n'est pas dans la liste 'leger' (ex. chair)", () => {
    // Le controle est volontairement restreint a []/water_bottles/backpack --
    // "chair" (point d'appui, pas une charge) n'entre pas dans le perimetre.
    const error = checkHeavyToLightDifficulty("str_leg_press", fakeEntry({ equipmentRequired: ["chair"], relativeDifficulty: "similar" }));
    expect(error).toBeNull();
  });

  it("le registre livre ne contient plus aucune violation (str_trapbar_deadlift -> str_kb_deadlift corrige)", () => {
    const entry = REPLACEMENT_REGISTRY.str_trapbar_deadlift.find((e) => e.altExerciseId === "str_kb_deadlift");
    expect(entry).toBeDefined();
    expect(entry!.relativeDifficulty).toBe("easier");
    expect(checkHeavyToLightDifficulty("str_trapbar_deadlift", entry!)).toBeNull();
  });
});

describe("checkEquipmentConeNote (P1 -- note d'improvisation obligatoire pour un drill a plots)", () => {
  it("CONFIRME : reason=equipment vers un drill a plots sans note -> erreur", () => {
    const error = checkEquipmentConeNote(
      "cod_t_drill",
      fakeEntry({ altExerciseId: "cod_cone_drills_low", reasonsAllowed: ["equipment"], prescriptionAdapter: {} })
    );
    expect(error).not.toBeNull();
    expect(error).toContain("improvisation");
  });

  it("ne signale rien quand la note mentionne l'improvisation", () => {
    const error = checkEquipmentConeNote(
      "cod_t_drill",
      fakeEntry({
        altExerciseId: "cod_cone_drills_low",
        reasonsAllowed: ["equipment"],
        prescriptionAdapter: { note: "Remplace les plots par des repères improvisés." },
      })
    );
    expect(error).toBeNull();
  });

  it("ne signale rien si reason=equipment n'est pas dans reasonsAllowed", () => {
    const error = checkEquipmentConeNote(
      "cod_t_drill",
      fakeEntry({ altExerciseId: "cod_cone_drills_low", reasonsAllowed: ["too_difficult"], prescriptionAdapter: {} })
    );
    expect(error).toBeNull();
  });

  it("ne signale rien si l'alternative n'est pas un drill a plots", () => {
    const error = checkEquipmentConeNote(
      "str_bench_press",
      fakeEntry({ altExerciseId: "str_pushup", reasonsAllowed: ["equipment"], prescriptionAdapter: {} })
    );
    expect(error).toBeNull();
  });

  it("le registre livre porte bien la note sur cod_t_drill et cod_zigzag_cones", () => {
    for (const key of ["cod_t_drill", "cod_zigzag_cones"] as const) {
      const entry = REPLACEMENT_REGISTRY[key].find((e) => e.altExerciseId === "cod_cone_drills_low" && e.reasonsAllowed.includes("equipment"));
      expect(entry).toBeDefined();
      expect(checkEquipmentConeNote(key, entry!)).toBeNull();
    }
  });
});

describe("validateFallbackPoolsIntegrity (P0 -- FAMILY_BY_ID / FALLBACK_POOLS)", () => {
  it("retourne 0 erreur sur les maps livrees", () => {
    expect(validateFallbackPoolsIntegrity()).toEqual([]);
  });

  it("toutes les familles referencees par FAMILY_BY_ID ont un pool non vide", () => {
    const families = new Set(Object.values(FAMILY_BY_ID));
    for (const family of families) {
      expect(FALLBACK_POOLS[family]?.length).toBeGreaterThan(0);
    }
  });

  it("tous les ids de FALLBACK_POOLS existent dans EXERCISE_BY_ID", () => {
    for (const ids of Object.values(FALLBACK_POOLS)) {
      for (const id of ids) {
        expect(EXERCISE_BY_ID[id]).toBeDefined();
      }
    }
  });
});
