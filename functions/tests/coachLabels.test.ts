// functions/tests/coachLabels.test.ts
// Vérifie le port de l'allowlist + pickCoachSessionToDisplay (parité front).

import {
  boundBlockCount,
  boundDurationMin,
  focusTitle,
  guardrailToCoachLabel,
  normalizeLevel,
  normalizePosition,
  pickCoachSessionToDisplay,
  readableFocus,
  readableIntensity,
  sanitizeFirstName,
  toDateKey,
  toCoachAdaptationLabels,
  COACH_DEVIATION_LABELS_MAX,
  COACH_DEVIATION_OTHER_LABEL,
  COACH_YOUTH_SUBSTITUTE_LABEL,
  deviationReasonToCoachLabel,
  isSensitiveDeviationReason,
  isSensitiveSignalToken,
  toCoachDeviationLabels,
} from "../src/coachLabels";

describe("guardrailToCoachLabel (allowlist)", () => {
  it("supprime douleur / TSB / debug / inconnu — un token sensible vaut un token inconnu", () => {
    expect(guardrailToCoachLabel("injury:knee_left")).toBeNull();
    expect(guardrailToCoachLabel("tsb:-14.2")).toBeNull();
    expect(guardrailToCoachLabel("selection_debug:seed=42")).toBeNull();
    expect(guardrailToCoachLabel("nimportequoi")).toBeNull();
    expect(guardrailToCoachLabel(42)).toBeNull();
  });

  it("traduit les tokens club/team connus", () => {
    expect(guardrailToCoachLabel("team:female_neuromuscular_focus")).toBe("Contrôle appuis et alignement");
    expect(guardrailToCoachLabel("club:heavy_week_adjustment")).toBe("Semaine club intense : charge FKS réduite");
  });

  it("dédup + filtre via toCoachAdaptationLabels", () => {
    expect(toCoachAdaptationLabels(["unknown", "team:female_neuromuscular_focus", "team:female_neuromuscular_focus"])).toEqual([
      "Contrôle appuis et alignement",
    ]);
  });

  it("famille de substitution jeune : un SEUL libellé, variante non observable", () => {
    expect(guardrailToCoachLabel("age:U15_youth_prevention_substitute")).toBe(COACH_YOUTH_SUBSTITUTE_LABEL);
    expect(guardrailToCoachLabel("age:U15_youth_prevention_speed_substitute")).toBe(COACH_YOUTH_SUBSTITUTE_LABEL);
    expect(guardrailToCoachLabel("age:U15_forbidden_family_filtered")).toBe("Exercices incompatibles retirés (catégorie d'âge)");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SUJET 4 — aucun signal coach ne naît d'une donnée sensible
// ════════════════════════════════════════════════════════════════════════════
describe("guardrailToCoachLabel — classification par SOURCE de la donnée", () => {
  // Chaque token ci-dessous a été remonté jusqu'à son producteur dans le moteur
  // (cf. le commentaire de classification dans coachLabels.ts). Un token dont la
  // chaîne passe par une déclaration du joueur ou son ressenti doit renvoyer
  // `null` — exactement comme un token inconnu, donc indiscernable de lui.
  const SUPPRIMES = [
    // Blessure / douleur déclarées
    "injury:severity_3_force_easy",
    "injury:severity_2_cap_moderate_light",
    "gate:pain_knee_ankle_no_plyo_speed_cod",
    "gate:pain_hamstring_acute_no_speed_structured_run_plyo_cod",
    "gate:force_no_hard_with_pain",
    "equipment_or_pain_violation_replaced",
    "hybrid:injury_adapted",
    "saison:injury_adapted",
    // Feedback post-séance (RPE, douleur, durée ressentie)
    "feedback:rpe_high_reduce",
    "feedback:rpe_low_increase",
    "feedback:pain_high_reduce",
    "feedback:cap_override:easy",
    "feedback:duration_scaled",
    // Charge interne : TSB ← ATL/CTL ← RPE déclaré
    "tsb:-14.2",
    "metrics:clamped:tsb:-31.4->-25",
    "metrics:clamped:atl:120->90",
    "client:load_high_forced_easy",
    "client:load_negative_intensity_reduced",
    "intent:force_charged_substantial_not_recovery",
    // Paliers de fatigue (cap_level) et leurs dérivés
    "tier:easy_plus",
    "tier:moderate_light",
    "tier:volume_scale:0.75",
    "tier:relaxed_match_j2",
    "gate:cap_easy",
    "gate:cap_moderate",
    "intent:cap_easy_intensity_downgraded",
    "intensity_cap:easy",
    "fatigue_trend:rising",
    "easy_alternation:force_lower>recovery_mobility",
    "intent:easy_sub:recovery_mobility",
    // Émis seulement HORS blessure → leur absence trahirait la blessure
    "level:loisir_s1_s2_cap_easy_plus",
    "level:loisir_s3_s4_cap_moderate_light",
    "level:loisir_s1_s2_duration_capped_35",
    // Énumère ses propres causes, dont injury_severe / tsb_critical
    "intent:safety_recovery_only:club_today+deload",
    "intent:safety_recovery_only:injury_severe",
    // Override « reset » : choisi sous cap easy + sécurité, PAS sur l'index de
    // cycle — à ne pas confondre avec la décharge programmée, elle autorisée.
    "saison:deload_reset:club_today+deload",
    // Chaînes FR héritées
    "TSB -14 : séance allégée",
    "Douleur déclarée : adaptation",
  ];

  it.each(SUPPRIMES)("token sensible « %s » → null (jamais un libellé neutre)", (token) => {
    expect(guardrailToCoachLabel(token)).toBeNull();
  });

  it("un token sensible est INDISCERNABLE d'un token inconnu", () => {
    const inconnu = guardrailToCoachLabel("token_jamais_vu_v42");
    for (const token of SUPPRIMES) expect(guardrailToCoachLabel(token)).toBe(inconnu);
  });

  // ── Anti-stérilisation : les garde-fous AUTORISÉS parlent toujours ─────────
  const AUTORISES: [string, string][] = [
    ["club:heavy_week_adjustment", "Semaine club intense : charge FKS réduite"],
    ["club:very_heavy_week_adjustment", "Semaine club très intense : séance fortement allégée"],
    ["club:goal_speed", "Objectif coach renseigné : vitesse"],
    ["club:goal_prevention", "Objectif coach renseigné : appuis & freinage"],
    ["client:club_proximity_reduction", "Entraînement club proche : charge réduite"],
    ["team:female_neuromuscular_focus", "Contrôle appuis et alignement"],
    ["age:U13_duration_cap", "Catégorie U13 : durée plafonnée"],
    ["age:U15_intensity_cap", "Catégorie U15 : intensité plafonnée"],
    ["age:U15_forbidden_family_filtered", "Exercices incompatibles retirés (catégorie d'âge)"],
    ["age:young_safe_substitute", COACH_YOUTH_SUBSTITUTE_LABEL],
    ["intent:j_minus_1_intensity_forced_easy", "Veille de match : activation uniquement"],
    ["intent:j_minus_1_cap_level_easy", "Veille de match : activation uniquement"],
    ["intent:match_today_duration_capped_20", "Jour de match : séance très légère"],
    ["engine:j_plus_1_duration_capped_30", "Lendemain de match : récupération"],
    ["force:j_minus_2_duration_capped_40", "Avant-match : charge réduite"],
    ["gate:j_plus_2_match_load_high_avoid_lower_plyo_structured_run", "Après-match : charge contrôlée"],
    ["intent:club_today_duration_capped_30", "Entraînement club le même jour : séance adaptée"],
    ["intent:deload_duration_reduced", "Semaine de décharge programmée"],
    ["Réduction club appliquée", "Entraînement club proche : charge réduite"],
  ];

  it.each(AUTORISES)("garde-fou autorisé « %s » produit toujours son libellé", (token, libelle) => {
    expect(guardrailToCoachLabel(token)).toBe(libelle);
  });

  it("aucun libellé produit ne contient de vocabulaire de santé ou de charge interne", () => {
    const blob = AUTORISES.map(([, libelle]) => libelle).join(" | ").toLowerCase();
    for (const mot of ["douleur", "pain", "blessure", "fatigue", "tsb", "rpe", "chargé", "genou"]) {
      expect(blob).not.toContain(mot);
    }
  });
});

describe("isSensitiveSignalToken", () => {
  it("reconnaît les racines sensibles quel que soit l'espace de noms", () => {
    for (const t of ["x:pain_y", "AGENT:DOULEUR", "z_blessure", "a:injury_adapted", "fatigue_trend:x", "y:rpe_high", "tsb:0"]) {
      expect(isSensitiveSignalToken(t)).toBe(true);
    }
  });
  it("laisse passer le contexte club / âge / calendrier", () => {
    for (const t of ["club:goal_speed", "age:U15_duration_cap", "intent:j_minus_1_duration_capped_25", "team:female_neuromuscular_focus"]) {
      expect(isSensitiveSignalToken(t)).toBe(false);
    }
  });
  it("valeurs non-chaînes → false (jamais de crash)", () => {
    expect(isSensitiveSignalToken(null)).toBe(false);
    expect(isSensitiveSignalToken(42)).toBe(false);
    expect(isSensitiveSignalToken("")).toBe(false);
  });
});

describe("focus (allowlist stricte)", () => {
  it("readableFocus/focusTitle : inconnu → null (jamais valeur brute)", () => {
    expect(readableFocus("SENTINEL_FOCUS")).toBeNull();
    expect(focusTitle("SENTINEL_FOCUS")).toBeNull();
    expect(readableFocus("strength")).toBe("Renfo / Force");
    expect(focusTitle("strength")).toBe("Séance renfo / force");
    expect(focusTitle("speed")).toBe("Séance vitesse");
  });
});

describe("identité (allowlists + sanitisation)", () => {
  it("position : seulement les 4 postes front", () => {
    expect(normalizePosition("Milieu")).toBe("Milieu");
    expect(normalizePosition("MIL")).toBeNull();
    expect(normalizePosition("<script>")).toBeNull();
    expect(normalizePosition(42)).toBeNull();
  });
  it("level : seulement les 5 niveaux front", () => {
    expect(normalizeLevel("Regional")).toBe("Regional");
    expect(normalizeLevel("R1")).toBeNull();
    expect(normalizeLevel("")).toBeNull();
  });
  it("firstName : trim + retrait contrôle + longueur max", () => {
    expect(sanitizeFirstName("  Anna\x07\x00  ")).toBe("Anna");
    expect(sanitizeFirstName("x".repeat(100))!.length).toBe(40);
    expect(sanitizeFirstName(123)).toBeNull();
    expect(sanitizeFirstName("   ")).toBeNull();
  });
});

describe("bornes numériques", () => {
  it("durationMin 1..240", () => {
    expect(boundDurationMin(40)).toBe(40);
    expect(boundDurationMin(0)).toBeNull();
    expect(boundDurationMin(99999)).toBeNull();
    expect(boundDurationMin(null)).toBeNull();
    expect(boundDurationMin(40.6)).toBe(41);
  });
  it("blockCount 1..20 entier", () => {
    expect(boundBlockCount(4)).toBe(4);
    expect(boundBlockCount(0)).toBeNull();
    expect(boundBlockCount(500)).toBeNull();
    expect(boundBlockCount(4.5)).toBeNull();
  });
});

describe("readable* (null si inconnu)", () => {
  it("intensity", () => {
    expect(readableIntensity("moderate")).toBe("Modérée");
    expect(readableIntensity("weird")).toBeNull();
  });
  it("focus", () => {
    expect(readableFocus("strength")).toBe("Renfo / Force");
    expect(readableFocus("")).toBeNull();
  });
});

describe("toDateKey (UTC-stable)", () => {
  it("bare YYYY-MM-DD inchangé", () => {
    expect(toDateKey("2026-06-28")).toBe("2026-06-28");
  });
  it("ISO → jour UTC", () => {
    expect(toDateKey("2026-06-28T23:30:00.000Z")).toBe("2026-06-28");
  });
  it("vide/invalide → ''", () => {
    expect(toDateKey(null)).toBe("");
    expect(toDateKey("pas une date")).toBe("");
  });
});

describe("pickCoachSessionToDisplay", () => {
  type S = { id: string | null; dateKey: string | null };
  const P: S = { id: "p", dateKey: "2026-07-02" };
  const C: S = { id: "c", dateKey: "2026-06-28" };
  it("même jour → completed", () => {
    expect(pickCoachSessionToDisplay<S>({ id: "p", dateKey: "2026-06-28" }, C)).toBe(C);
  });
  it("planned future → planned", () => {
    expect(pickCoachSessionToDisplay<S>(P, C)).toBe(P);
  });
  it("date manquante → completed", () => {
    expect(pickCoachSessionToDisplay<S>({ id: "p", dateKey: null }, C)).toBe(C);
  });
  it("même id → completed", () => {
    expect(pickCoachSessionToDisplay({ id: "x", dateKey: "2026-07-02" }, { id: "x", dateKey: "2026-06-28" })).toEqual({
      id: "x",
      dateKey: "2026-06-28",
    });
  });
});

// ─── Raisons d'écart joueur (boucle de suivi) ───────────────────────────────
describe("deviationReasonToCoachLabel — allowlist fermée", () => {
  it("traduit les raisons NON sensibles", () => {
    expect(deviationReasonToCoachLabel("time")).toBe("Manque de temps");
    expect(deviationReasonToCoachLabel("equipment")).toBe("Matériel indisponible");
    expect(deviationReasonToCoachLabel("too_difficult")).toBe("Exercice trop difficile");
    expect(deviationReasonToCoachLabel("technical")).toBe("Difficulté technique");
    expect(deviationReasonToCoachLabel("space")).toBe("Espace insuffisant");
    expect(deviationReasonToCoachLabel("no_partner")).toBe("Pas de partenaire");
  });

  it("tolère casse et espaces (le token vient d'un client)", () => {
    expect(deviationReasonToCoachLabel("  TIME ")).toBe("Manque de temps");
  });
});

describe("RAISONS SENSIBLES — le signal ne traverse pas, et reste indéductible", () => {
  it("pain et fatigue sont SUPPRIMÉES (null), pas traduites en libellé neutre", () => {
    expect(deviationReasonToCoachLabel("pain")).toBeNull();
    expect(deviationReasonToCoachLabel("fatigue")).toBeNull();
    expect(deviationReasonToCoachLabel("  PAIN ")).toBeNull();
    expect(isSensitiveDeviationReason("pain")).toBe(true);
    expect(isSensitiveDeviationReason("time")).toBe(false);
  });

  it("other et les tokens inconnus RESTENT groupés : le vide n'est donc pas une preuve", () => {
    // Propriété 1 : « Autre raison » continue d'exister pour des raisons banales.
    // Une liste vide reste compatible avec « aucune raison saisie » et
    // « raisons non calculées » — elle ne désigne pas la douleur.
    expect(deviationReasonToCoachLabel("other")).toBe(COACH_DEVIATION_OTHER_LABEL);
    expect(deviationReasonToCoachLabel("token_jamais_vu_v42")).toBe(COACH_DEVIATION_OTHER_LABEL);
    expect(toCoachDeviationLabels([])).toEqual([]);
    expect(toCoachDeviationLabels(["pain"])).toEqual([]);
    expect(toCoachDeviationLabels([null, "", "   "])).toEqual([]);
  });

  it("une raison sensible ne laisse AUCUNE trace : ['time','pain'] === ['time']", () => {
    // Propriété 3 : filtrage avant déduplication et avant le plafond.
    expect(toCoachDeviationLabels(["time", "pain"])).toEqual(toCoachDeviationLabels(["time"]));
    expect(toCoachDeviationLabels(["pain", "time", "fatigue"])).toEqual(toCoachDeviationLabels(["time"]));
    expect(toCoachDeviationLabels(["pain", "pain", "pain", "pain"])).toEqual([]);
  });

  it("le plafond de 3 n'est pas consommé par les raisons sensibles", () => {
    // Sans filtrage AVANT le plafond, "pain" aurait mangé un rang et
    // "no_partner" serait tombé hors liste → sortie différente. Preuve que
    // l'ordre de traitement compte réellement.
    const avec = toCoachDeviationLabels(["pain", "time", "equipment", "no_partner"]);
    const sans = toCoachDeviationLabels(["time", "equipment", "no_partner"]);
    expect(avec).toEqual(sans);
    expect(avec).toEqual(["Manque de temps", "Matériel indisponible", "Pas de partenaire"]);
  });

  it("les valeurs non-chaînes retombent sur le libellé fourre-tout (jamais de crash, jamais de fuite)", () => {
    expect(deviationReasonToCoachLabel(null)).toBe(COACH_DEVIATION_OTHER_LABEL);
    expect(deviationReasonToCoachLabel(42)).toBe(COACH_DEVIATION_OTHER_LABEL);
    expect(deviationReasonToCoachLabel({ pain: 3 })).toBe(COACH_DEVIATION_OTHER_LABEL);
  });

  it("aucun libellé ne contient de vocabulaire médical", () => {
    const all = ["time", "equipment", "too_difficult", "technical", "space", "no_partner", "pain", "fatigue", "other"]
      .map(deviationReasonToCoachLabel)
      .filter((l): l is string => l !== null)
      .join(" | ")
      .toLowerCase();
    for (const mot of ["douleur", "pain", "blessure", "fatigue", "mal ", "genou"]) {
      expect(all).not.toContain(mot);
    }
  });
});

describe("toCoachDeviationLabels", () => {
  it("non-tableau → []", () => {
    expect(toCoachDeviationLabels(null)).toEqual([]);
    expect(toCoachDeviationLabels("time")).toEqual([]);
  });

  it("ignore les entrées vides / non-chaînes (absence de raison ≠ raison inconnue)", () => {
    expect(toCoachDeviationLabels([null, "", "   ", 7, "time"])).toEqual(["Manque de temps"]);
  });

  it("déduplique", () => {
    expect(toCoachDeviationLabels(["time", "time", "other", "other"])).toEqual([
      "Manque de temps",
      COACH_DEVIATION_OTHER_LABEL,
    ]);
  });

  it("borne la liste à COACH_DEVIATION_LABELS_MAX", () => {
    const out = toCoachDeviationLabels(["time", "equipment", "space", "technical", "no_partner"]);
    expect(out).toHaveLength(COACH_DEVIATION_LABELS_MAX);
    expect(COACH_DEVIATION_LABELS_MAX).toBe(3);
  });
});
