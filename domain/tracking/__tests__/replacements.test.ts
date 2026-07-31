// domain/tracking/__tests__/replacements.test.ts
import { EXERCISE_BY_ID } from "../../../engine/exerciseBank";
import { MAX_PROPOSALS_PER_ITEM, selectReplacement } from "../replacements/select";
import type { ReplacementRequest } from "../types";

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

describe("selectReplacement -- materiel manquant", () => {
  it("propose une alternative poids du corps avec prescription adaptee", () => {
    const proposal = selectReplacement(req("str_back_squat", "equipment", { equipmentAvailable: [] }));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("str_air_squat");
    expect(proposal!.source).toBe("registry");
    // baseline strength = 3 sets / 10 reps, repsFactor 1.4 -> 14
    expect(proposal!.prescription.reps).toBe(14);
    expect(proposal!.prescription.sets).toBe(3);
  });

  it("ignore une entree de registre dont le materiel requis est absent, et retombe sur le fallback bodyweight", () => {
    // str_goblet_squat (reason too_difficult) exige water_bottles : absent du
    // contexte, l'entree est ecartee. str_air_squat n'autorise pas
    // too_difficult dans son reasonsAllowed -- le registre ne fournit donc
    // rien pour ce couple (exerciseId, reason), et le fallback bodyweight
    // prend le relais (source="rule").
    const proposal = selectReplacement(req("str_back_squat", "too_difficult", { equipmentAvailable: [] }));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).not.toBe("str_goblet_squat");
    expect(proposal!.source).toBe("rule");
  });
});

describe("selectReplacement -- manque de place", () => {
  it("propose une alternative compactSpaceOk pour reason=space", () => {
    const proposal = selectReplacement(req("sprint_accel_20m", "space", { equipmentAvailable: [] }));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("sprint_accel_10m");
    expect(EXERCISE_BY_ID[proposal!.exerciseId].modality).toBe("run");
  });
});

describe("selectReplacement -- mode solo", () => {
  it("propose une alternative soloOk quand context.solo=true (no_partner)", () => {
    const proposal = selectReplacement(
      req("str_nordic", "no_partner", { equipmentAvailable: ["home_small"], solo: true })
    );
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("str_nordic_assisted_band");
  });
});

describe("selectReplacement -- too_difficult", () => {
  it("propose une regression relativeDifficulty=easier", () => {
    const proposal = selectReplacement(req("str_back_squat", "too_difficult", { equipmentAvailable: ["water_bottles"] }));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("str_goblet_squat");
    // easier => equivalent=false (adaptation, pas equivalence sportive complete)
    expect(proposal!.equivalent).toBe(false);
  });
});

describe("selectReplacement -- douleur declaree", () => {
  it("ne propose que painSafe=true sur reason=pain", () => {
    const proposal = selectReplacement(req("run_easy_20", "pain", { equipmentAvailable: ["gym_full"] }));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("bike_easy_25_35");
  });

  it("ne resollicite jamais la zone douloureuse (genou -> alternative sans knee_stress/quad_load)", () => {
    // str_leg_press -> str_bulgarian_split porte knee_stress/heavy_lower : la
    // zone genou doit bloquer cette proposition et retomber sur reverse_lunge
    // ... mais reverse_lunge porte aussi knee_stress => rien de sur -> null.
    const proposal = selectReplacement(
      req("str_leg_press", "equipment", { equipmentAvailable: ["chair"], activePains: ["knee_pain"] })
    );
    expect(proposal).toBeNull();
  });

  it("retourne null si aucune entree du registre n'est painSafe pour reason=pain (pas de fallback sur douleur)", () => {
    const proposal = selectReplacement(req("str_back_squat", "pain", { equipmentAvailable: ["water_bottles"] }));
    expect(proposal).toBeNull();
  });
});

describe("selectReplacement -- aucune alternative", () => {
  it("retourne null pour un id inconnu (aucune donnee exploitable)", () => {
    const proposal = selectReplacement(req("id_totalement_inconnu_xyz", "equipment"));
    expect(proposal).toBeNull();
  });

  it("retourne null pour un exercice important volontairement non couvert (plyo_depth_jumps) sans candidat fallback compatible espace", () => {
    // plyo_depth_jumps n'est pas dans le registre ; le fallback pourrait
    // trouver un candidat plyo generique, mais si on exclut tous les
    // candidats plausibles via excludeIds, la reponse doit rester honnete.
    const allPlyoAllowlist = [
      "plyo_low_skips",
      "plyo_pogo_hops",
      "plyo_ankle_bounces",
      "plyo_line_hops_lateral",
      "plyo_line_hops_fwd_back",
      "plyo_cmj_stick",
      "plyo_squat_jump_stick",
      "plyo_single_leg_hop_in_place_stick",
    ];
    const proposal = selectReplacement(
      req("plyo_depth_jumps", "too_difficult", { equipmentAvailable: [], excludeIds: allPlyoAllowlist })
    );
    expect(proposal).toBeNull();
  });
});

describe("selectReplacement -- exercice principal : qualite centrale conservee", () => {
  it("un run_*/sprint_* remplace reste dans la famille course (jamais du gainage)", () => {
    const proposal = selectReplacement(req("sprint_accel_20m", "space"));
    expect(proposal).not.toBeNull();
    expect(EXERCISE_BY_ID[proposal!.exerciseId].modality).toBe("run");
  });

  it("un str_* principal remplace reste de la force (jamais de la mobilite seule)", () => {
    const proposal = selectReplacement(req("str_back_squat", "equipment"));
    expect(proposal).not.toBeNull();
    expect(EXERCISE_BY_ID[proposal!.exerciseId].modality).toBe("strength");
  });
});

describe("selectReplacement -- adaptation sets/reps arrondie", () => {
  it("applique repsFactor et arrondit sainement", () => {
    const proposal = selectReplacement(req("str_back_squat", "too_difficult", { equipmentAvailable: ["water_bottles"] }));
    expect(proposal).not.toBeNull();
    // baseline strength reps=10, repsFactor 1.2 -> 12 (arrondi)
    expect(proposal!.prescription.reps).toBe(12);
    expect(Number.isInteger(proposal!.prescription.reps as number)).toBe(true);
  });

  it("applique setsDelta et arrondit, jamais sous 1", () => {
    const proposal = selectReplacement(req("sprint_accel_20m", "space"));
    expect(proposal).not.toBeNull();
    // baseline run sets=null -> setsDelta ne s'applique pas sur null (reste null)
    expect(proposal!.prescription.sets).toBeNull();
  });
});

describe("selectReplacement -- anti-boucle (excludeIds) et MAX_PROPOSALS_PER_ITEM", () => {
  it("MAX_PROPOSALS_PER_ITEM vaut 2", () => {
    expect(MAX_PROPOSALS_PER_ITEM).toBe(2);
  });

  it("saute une entree deja proposee via excludeIds et retombe sur la suivante", () => {
    const first = selectReplacement(req("str_back_squat", "equipment", { equipmentAvailable: ["water_bottles"] }));
    expect(first!.exerciseId).toBe("str_air_squat");

    const second = selectReplacement(
      req("str_back_squat", "equipment", { equipmentAvailable: ["water_bottles"], excludeIds: [first!.exerciseId] })
    );
    expect(second).not.toBeNull();
    expect(second!.exerciseId).toBe("str_goblet_squat");
    expect(second!.exerciseId).not.toBe(first!.exerciseId);
  });

  it("retourne null si toutes les alternatives connues (registre + fallback) sont deja exclues (boucle fermee proprement)", () => {
    // str_back_squat : le registre propose str_air_squat (reason=equipment)
    // et str_goblet_squat (reason=equipment aussi, mais exige water_bottles,
    // absent ici) ; le fallback (famille strength_lower_squat) propose
    // str_air_squat/str_air_squat_pause_2s/str_air_squat_tempo_3s. En
    // excluant les 3 candidats bodyweight, il ne reste plus rien de valable
    // (str_goblet_squat filtre de toute facon par materiel manquant) :
    // reponse honnete.
    const proposal = selectReplacement(
      req("str_back_squat", "equipment", {
        equipmentAvailable: [],
        excludeIds: ["str_air_squat", "str_air_squat_pause_2s", "str_air_squat_tempo_3s"],
      })
    );
    expect(proposal).toBeNull();
  });
});

describe("selectReplacement -- determinisme", () => {
  it("deux appels identiques retournent le meme resultat (deep equal)", () => {
    const a = selectReplacement(req("str_back_squat", "equipment", { equipmentAvailable: [] }));
    const b = selectReplacement(req("str_back_squat", "equipment", { equipmentAvailable: [] }));
    expect(a).toEqual(b);
  });

  it("determinisme aussi pour le chemin fallback (rule)", () => {
    // str_bench_press + fatigue : aucune entree de registre n'autorise
    // "fatigue" (reasonsAllowed=["equipment","no_partner"] et
    // ["too_difficult"]) -- le fallback (famille strength_upper_push) prend
    // le relais de facon deterministe.
    const context = { equipmentAvailable: [], excludeIds: [] as string[] };
    const a = selectReplacement(req("str_bench_press", "fatigue", context));
    const b = selectReplacement(req("str_bench_press", "fatigue", context));
    expect(a).toEqual(b);
    expect(a).not.toBeNull();
    expect(a!.source).toBe("rule");
    expect(a!.equivalent).toBe(false);
  });
});

describe("selectReplacement -- P0 fallback par famille fine (jamais de fallback par modalite large)", () => {
  it("sprint_accel_20m + too_difficult ne retombe JAMAIS sur du footing (easy_jog_20_30) -- reste dans la famille acceleration", () => {
    const proposal = selectReplacement(req("sprint_accel_20m", "too_difficult"));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).not.toBe("easy_jog_20_30");
    expect(proposal!.exerciseId).toBe("run_build_up_20_30m");
    expect(proposal!.source).toBe("rule");
    expect(EXERCISE_BY_ID[proposal!.exerciseId].tags).toContain("sprint");
  });

  it("sprint_accel_20m + fatigue ne retombe JAMAIS sur du footing (easy_jog_20_30) -- meme garde-fou que too_difficult", () => {
    const proposal = selectReplacement(req("sprint_accel_20m", "fatigue"));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).not.toBe("easy_jog_20_30");
    expect(proposal!.exerciseId).toBe("run_build_up_20_30m");
  });

  it("str_bench_press + fatigue ne retourne JAMAIS un exercice bas du corps (ex-bug : convergeait vers str_air_squat)", () => {
    const proposal = selectReplacement(req("str_bench_press", "fatigue"));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).not.toBe("str_air_squat");
    expect(proposal!.exerciseId).toBe("str_incline_pushup");
    expect(EXERCISE_BY_ID[proposal!.exerciseId].modality).toBe("strength");
    expect(EXERCISE_BY_ID[proposal!.exerciseId].tags).not.toContain("heavy_lower");
  });

  it("str_pullup + fatigue reste un tirage (str_inverted_row), jamais str_air_squat", () => {
    const proposal = selectReplacement(req("str_pullup", "fatigue"));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).not.toBe("str_air_squat");
    expect(proposal!.exerciseId).toBe("str_inverted_row");
  });

  it("str_rdl + fatigue reste une charniere de hanche (str_single_leg_rdl), jamais str_air_squat", () => {
    const proposal = selectReplacement(req("str_rdl", "fatigue"));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).not.toBe("str_air_squat");
    expect(proposal!.exerciseId).toBe("str_single_leg_rdl");
  });

  it("str_nordic + fatigue retourne null (honnete) : aucun pool bodyweight ne preserve l'excentrique ischios sans ancrage", () => {
    // reasonsAllowed du registre pour str_nordic ne couvre pas "fatigue", et
    // str_nordic n'a volontairement AUCUNE famille de fallback (voir
    // registry.ts) : jamais de regression vers un squat generique.
    const proposal = selectReplacement(req("str_nordic", "fatigue", { equipmentAvailable: ["home_small"] }));
    expect(proposal).toBeNull();
  });
});

describe("selectReplacement -- match proche / fatigue haute : jamais d'augmentation", () => {
  it("refuse l'entree de registre similar+intensity-high sous matchSoon et retombe sur le fallback (easier)", () => {
    // sprint_falling_start_10m -> sprint_accel_10m est enregistree "similar"
    // et sprint_accel_10m est intensity "high" : sous matchSoon, le garde-fou
    // doit la refuser. Le fallback (toujours "easier") prend le relais.
    const withoutMatchSoon = selectReplacement(req("sprint_falling_start_10m", "too_difficult"));
    expect(withoutMatchSoon).not.toBeNull();
    expect(withoutMatchSoon!.exerciseId).toBe("sprint_accel_10m");
    expect(withoutMatchSoon!.equivalent).toBe(true);

    const underMatchSoon = selectReplacement(req("sprint_falling_start_10m", "too_difficult", { matchSoon: true }));
    expect(underMatchSoon).not.toBeNull();
    expect(underMatchSoon!.exerciseId).not.toBe("sprint_accel_10m");
    expect(underMatchSoon!.source).toBe("rule");
    expect(underMatchSoon!.equivalent).toBe(false);
  });

  it("meme garde-fou sous highFatigue", () => {
    const proposal = selectReplacement(req("sprint_falling_start_10m", "too_difficult", { highFatigue: true }));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).not.toBe("sprint_accel_10m");
    expect(EXERCISE_BY_ID[proposal!.exerciseId].intensity).not.toBe("high");
  });
});

describe("selectReplacement -- P1 : drills a plots, note d'improvisation obligatoire", () => {
  it("cod_t_drill + equipment (manque de plots) porte une note d'improvisation explicite", () => {
    const proposal = selectReplacement(req("cod_t_drill", "equipment"));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("cod_cone_drills_low");
    expect(proposal!.prescription.note).toMatch(/improvis/i);
  });

  it("cod_zigzag_cones + equipment (manque de plots) porte une note d'improvisation explicite", () => {
    const proposal = selectReplacement(req("cod_zigzag_cones", "equipment"));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("cod_cone_drills_low");
    expect(proposal!.prescription.note).toMatch(/improvis/i);
  });
});

describe("selectReplacement -- P1 : degradation heavy -> leger jamais 'similar'", () => {
  it("str_trapbar_deadlift -> str_kb_deadlift (bouteilles) n'est jamais equivalent (relativeDifficulty=easier)", () => {
    const proposal = selectReplacement(
      req("str_trapbar_deadlift", "equipment", { equipmentAvailable: ["water_bottles"], excludeIds: ["str_db_rdl"] })
    );
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("str_kb_deadlift");
    expect(proposal!.equivalent).toBe(false);
  });

  it("str_step_up -> str_reverse_lunge (poids du corps) n'est jamais equivalent", () => {
    const proposal = selectReplacement(req("str_step_up", "equipment", { equipmentAvailable: [] }));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("str_reverse_lunge");
    expect(proposal!.equivalent).toBe(false);
  });

  it("str_row -> str_inverted_row (poids du corps) n'est jamais equivalent", () => {
    const proposal = selectReplacement(req("str_row", "equipment", { equipmentAvailable: [] }));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("str_inverted_row");
    expect(proposal!.equivalent).toBe(false);
  });
});

describe("selectReplacement -- P1 : prescription isometrique honnete (durationS, jamais reps)", () => {
  it("str_forward_lunge + too_difficult (-> str_split_squat_iso_hold) produit une duree, jamais des reps", () => {
    const proposal = selectReplacement(req("str_forward_lunge", "too_difficult"));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("str_split_squat_iso_hold");
    expect(proposal!.prescription.reps).toBeNull();
    expect(proposal!.prescription.durationS).toBe(30);
    expect(typeof proposal!.prescription.durationS).toBe("number");
  });

  it("core_hollow_rocks + too_difficult (-> core_hollow_hold) produit une duree, jamais des reps", () => {
    const proposal = selectReplacement(req("core_hollow_rocks", "too_difficult"));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("core_hollow_hold");
    expect(proposal!.prescription.reps).toBeNull();
    expect(typeof proposal!.prescription.durationS).toBe("number");
    expect(proposal!.prescription.durationS as number).toBeGreaterThan(0);
  });

  it("cas charge normal (non isometrique) : reps reste un nombre, jamais durationS", () => {
    const proposal = selectReplacement(req("str_back_squat", "too_difficult", { equipmentAvailable: ["water_bottles"] }));
    expect(proposal).not.toBeNull();
    expect(proposal!.exerciseId).toBe("str_goblet_squat");
    expect(typeof proposal!.prescription.reps).toBe("number");
    expect(proposal!.prescription.durationS).toBeNull();
  });

  it("request.prescribed (donnee reelle de l'item live) prime sur la baseline generique", () => {
    const withPrescribed = selectReplacement({
      exerciseId: "str_back_squat",
      reason: "equipment",
      context: {
        equipmentAvailable: [],
        ageCategory: "Senior",
        activePains: [],
        matchSoon: false,
        highFatigue: false,
        solo: false,
        excludeIds: [],
      },
      prescribed: { sets: 4, reps: 8, durationS: null, restS: 90 },
    });
    expect(withPrescribed).not.toBeNull();
    expect(withPrescribed!.exerciseId).toBe("str_air_squat");
    // baseline reelle sets=4/reps=8/restS=90 (au lieu de 3/10/60), repsFactor
    // 1.4 s'applique sur la VRAIE valeur transmise : round(8*1.4)=11.
    expect(withPrescribed!.prescription.sets).toBe(4);
    expect(withPrescribed!.prescription.reps).toBe(11);
    expect(withPrescribed!.prescription.restS).toBe(90);
  });
});
