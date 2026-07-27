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
  deviationReasonToCoachLabel,
  toCoachDeviationLabels,
} from "../src/coachLabels";

describe("guardrailToCoachLabel (allowlist)", () => {
  it("masque douleur / TSB / debug / inconnu", () => {
    expect(guardrailToCoachLabel("injury:knee_left")).toBe("Adaptation sécurité appliquée");
    expect(guardrailToCoachLabel("tsb:-14.2")).toBe("Joueur chargé : séance allégée");
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

  it("reformulations P1 (wording renfo & appuis / incompatibles)", () => {
    expect(guardrailToCoachLabel("age:U15_youth_prevention_substitute")).toBe("Séance jeune adaptée (renfo & appuis)");
    expect(guardrailToCoachLabel("age:U15_youth_prevention_speed_substitute")).toBe("Séance jeune adaptée (renfo & appuis)");
    expect(guardrailToCoachLabel("age:U15_forbidden_family_filtered")).toBe("Exercices incompatibles retirés (catégorie d'âge)");
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

describe("NON INVERSIBILITÉ — santé indéductible par élimination", () => {
  // Cœur de la règle : si `pain` avait un libellé distinct, il fuiterait ; s'il
  // était simplement supprimé, le coach le déduirait du trou. Il doit donc être
  // STRICTEMENT indiscernable de raisons banales.
  it("pain, fatigue, other et un token inconnu donnent EXACTEMENT le même libellé", () => {
    const pain = deviationReasonToCoachLabel("pain");
    const fatigue = deviationReasonToCoachLabel("fatigue");
    const other = deviationReasonToCoachLabel("other");
    const unknown = deviationReasonToCoachLabel("token_jamais_vu_v42");

    expect(pain).toBe(COACH_DEVIATION_OTHER_LABEL);
    expect(fatigue).toBe(pain);
    expect(other).toBe(pain);
    expect(unknown).toBe(pain);
    expect(new Set([pain, fatigue, other, unknown]).size).toBe(1);
  });

  it("les valeurs non-chaînes retombent sur le même libellé (jamais de crash, jamais de fuite)", () => {
    expect(deviationReasonToCoachLabel(null)).toBe(COACH_DEVIATION_OTHER_LABEL);
    expect(deviationReasonToCoachLabel(42)).toBe(COACH_DEVIATION_OTHER_LABEL);
    expect(deviationReasonToCoachLabel({ pain: 3 })).toBe(COACH_DEVIATION_OTHER_LABEL);
  });

  it("aucun libellé ne contient de vocabulaire médical", () => {
    const all = ["time", "equipment", "too_difficult", "technical", "space", "no_partner", "pain", "fatigue", "other"]
      .map(deviationReasonToCoachLabel)
      .join(" | ")
      .toLowerCase();
    for (const mot of ["douleur", "pain", "blessure", "fatigue", "mal ", "genou"]) {
      expect(all).not.toContain(mot);
    }
  });

  it("une liste de 4 douleurs ne se distingue pas d'une liste de 4 'autre'", () => {
    expect(toCoachDeviationLabels(["pain", "pain", "pain", "pain"])).toEqual(
      toCoachDeviationLabels(["other", "other", "other", "other"]),
    );
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
    expect(toCoachDeviationLabels(["time", "time", "pain", "fatigue"])).toEqual([
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
