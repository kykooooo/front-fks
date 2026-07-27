// functions/tests/sensitiveIsolation.test.ts
//
// SONDE HOSTILE — « la donnée sensible n'existe pas pour le coach ».
//
// Ce fichier ne vérifie PAS l'absence de quelques clés : il prouve une ÉGALITÉ
// STRICTE. On projette deux fois le MÊME joueur :
//
//   A) documents source CHARGÉS en données sensibles — niveau de douleur, zones
//      douloureuses, fatigue, récupération, sommeil, commentaire libre, RPE,
//      métriques ATL/CTL/TSB, raisons d'écart sensibles, snapshot complet de
//      prescription, données brutes d'exécution, et les garde-fous dont la
//      chaîne de production passe par une de ces données ;
//   B) les mêmes documents, ces éléments RETIRÉS.
//
// Si la projection A est identique, octet pour octet, à la projection B, alors
// aucun bit de la donnée sensible n'a traversé : ni valeur, ni présence, ni
// libellé, ni décalage d'ordre ou de troncature. C'est la seule formulation qui
// attrape aussi les fuites par PRÉSENCE (« un libellé neutre apparaît, donc il
// s'est passé quelque chose de médical »).
//
// Le pendant indispensable est en fin de fichier : la preuve qu'on n'a pas tout
// stérilisé — un garde-fou AUTORISÉ produit toujours son libellé.

import { projectPlayerSummary, type ProjectorInput } from "../src/projector";
import { assertCoachSafe } from "../src/dto";

const NOW = new Date("2026-06-30T12:00:00.000Z");

const PROFILE = {
  uid: "playerA1",
  clubId: "clubA",
  role: "player",
  firstName: "Anna",
  position: "Milieu",
  level: "Regional",
  ageCategory: "U15",
  profileCompleted: true,
};

/** Garde-fous dont la chaîne de production NE passe PAS par le joueur. */
const GUARDRAILS_AUTORISES = [
  "club:heavy_week_adjustment",
  "age:U15_forbidden_family_filtered",
  "intent:j_minus_1_duration_capped_25",
];

/**
 * Garde-fous d'origine SENSIBLE (classification : cf. coachLabels.ts).
 * Blessure, feedback post-séance, RPE, TSB/ATL/CTL, paliers de fatigue,
 * caps « loisir » émis seulement hors blessure, substitutions de sécurité.
 */
const GUARDRAILS_SENSIBLES = [
  "injury:severity_3_force_easy",
  "gate:pain_knee_ankle_no_plyo_speed_cod",
  "gate:force_no_hard_with_pain",
  "equipment_or_pain_violation_replaced",
  "feedback:rpe_high_reduce",
  "feedback:pain_high_reduce",
  "feedback:cap_override:easy",
  "fatigue_trend:rising",
  "tsb:-21.5",
  "metrics:clamped:tsb:-31.4->-25",
  "tier:easy_plus",
  "tier:volume_scale:0.75",
  "gate:cap_easy",
  "intent:cap_easy_intensity_downgraded",
  "intensity_cap:easy",
  "level:loisir_s1_s2_cap_easy_plus",
  "easy_alternation:force_lower>recovery_mobility",
  "intent:safety_recovery_only:injury_severe+tsb_critical",
  "client:load_high_forced_easy",
  "client:load_negative_intensity_reduced",
  "hybrid:injury_adapted",
  "TSB -21 : séance allégée",
];

// ─── Documents source ───────────────────────────────────────────────────────
//
// La version « propre » n'est pas une version appauvrie : elle garde TOUT ce
// que le coach a le droit de voir (date, focus, intensité, durée, blocs,
// compteurs d'exécution, raisons non sensibles). Seul le sensible est retiré.

const completedPropre = () => ({
  __id: "s1",
  date: "2026-06-28",
  dateISO: "2026-06-28",
  intensity: "moderate",
  focus: "strength",
  feedback: { durationMin: 40 }, // durée = seul champ autorisé de `feedback`
  aiV2: {
    focusPrimary: "strength",
    intensity: "moderate",
    blocks: [{}, {}, {}, {}],
    guardrailsApplied: [...GUARDRAILS_AUTORISES],
  },
  execution: {
    version: 1,
    sessionId: "s1",
    // ⚠️ MÊME NOMBRE D'EXERCICES que la version sensible : le contrefactuel
    // honnête n'est pas « une séance plus courte », c'est LA MÊME séance dont
    // les écarts n'ont pas de raison enregistrée. `items.length` est le
    // dénominateur du pourcentage : le faire varier comparerait deux séances
    // différentes et masquerait le vrai test.
    items: [
      { key: "0-0", status: "done" },
      { key: "0-1", status: "adapted", reason: "time" },
      { key: "0-2", status: "skipped", reason: "equipment" },
      { key: "0-3", status: "skipped", reason: null },
      { key: "0-4", status: "skipped", reason: null },
    ],
    completion: {
      pct: 72,
      done: 7,
      adapted: 1,
      skipped: 1,
      replacedEquivalent: 1,
      replacedPartial: 1,
      status: "partial",
      mainReasons: ["time", "equipment"],
    },
  },
});

/**
 * Même document, saturé de données sensibles — à tous les endroits où elles
 * existent réellement en base : le doc, `feedback`, `metrics`, `aiV2`, et le
 * bloc `execution` de la boucle de suivi (snapshot, commentaires, raisons).
 */
const completedSensible = () => {
  const base = completedPropre();
  return {
    ...base,
    // 1) Racine du document de séance
    rpe: 9,
    painLevel: 4,
    painZones: ["knee_left", "hamstring_right"],
    injuries: [{ zone: "SENTINEL_ZONE_GENOU", severity: 3, note: "SENTINEL_NOTE_BLESSURE" }],
    // 2) Feedback post-séance (la durée reste, tout le reste est sensible)
    feedback: {
      durationMin: 40,
      rpe: 9,
      pain: 4,
      painZones: ["SENTINEL_ZONE_GENOU"],
      fatigue: 5,
      sleep: 2,
      recovery: 1,
      recoveryPerceived: 1,
      comment: "SENTINEL_COMMENT_jai_mal_au_genou_gauche",
      mood: "SENTINEL_MOOD",
    },
    // 3) Charge interne (dérivée du RPE déclaré)
    metrics: { atl: 78.4, ctl: 46.9, tsb: -31.5, note: "SENTINEL_METRICS" },
    // 4) Garde-fous d'origine sensible AJOUTÉS aux garde-fous autorisés
    aiV2: {
      ...base.aiV2,
      guardrailsApplied: [...GUARDRAILS_AUTORISES, ...GUARDRAILS_SENSIBLES],
      painAdaptation: "SENTINEL_AIV2_PAIN",
    },
    // 5) Exécution réelle : snapshot complet, commentaires libres, raisons sensibles
    execution: {
      ...base.execution,
      fingerprint: "SENTINEL_FINGERPRINT",
      snapshot: {
        sessionId: "s1",
        plannedDurationMin: 45,
        items: [{ key: "0-0", exerciseId: "SENTINEL_EXO", name: "SENTINEL_EXO_NOM", notes: "SENTINEL_NOTE_EXO" }],
      },
      startedAtISO: "2026-06-28T17:00:00.000Z",
      finishedAtISO: "2026-06-28T17:44:00.000Z",
      actualDurationMin: 44,
      items: [
        { key: "0-0", status: "done", reason: null, comment: "SENTINEL_COMMENT_ITEM_0" },
        { key: "0-1", status: "adapted", reason: "time", comment: "SENTINEL_COMMENT_ITEM_1" },
        { key: "0-2", status: "skipped", reason: "equipment", comment: "SENTINEL_COMMENT_ITEM_2" },
        // MÊMES exercices que la version propre (0-3 / 0-4 y sont sautés sans
        // raison enregistrée), mais ici la raison est déclarée et sensible : ils
        // ne doivent produire ni libellé propre, ni libellé fourre-tout, ni
        // décalage de rang.
        { key: "0-3", status: "skipped", reason: "pain", comment: "SENTINEL_COMMENT_DOULEUR" },
        { key: "0-4", status: "skipped", reason: "fatigue", comment: "SENTINEL_COMMENT_FATIGUE" },
      ],
      completion: {
        ...base.execution.completion,
        // La boucle range les raisons dominantes par poids : la douleur arrive
        // AVANT une raison banale, ce qui teste aussi l'ordre et le plafond.
        mainReasons: ["pain", "time", "fatigue", "equipment"],
      },
    },
  };
};

const plannedPropre = () => ({
  __id: "p1",
  date: "2026-07-02",
  focus: "speed",
  intensity: "hard",
  durationMin: 35,
  ai: { blocks: [{}, {}, {}], guardrailsApplied: [...GUARDRAILS_AUTORISES] },
  clientGuardrailsApplied: ["client:club_proximity_reduction"],
});

const plannedSensible = () => {
  const base = plannedPropre();
  return {
    ...base,
    painZones: ["SENTINEL_ZONE_PLANNED"],
    ai: {
      ...base.ai,
      guardrailsApplied: [...GUARDRAILS_AUTORISES, ...GUARDRAILS_SENSIBLES],
    },
    clientGuardrailsApplied: [
      "client:club_proximity_reduction",
      "client:load_high_forced_easy",
      "client:load_negative_intensity_reduced",
    ],
  };
};

const input = (sensible: boolean): ProjectorInput => ({
  playerUid: "playerA1",
  clubId: "clubA",
  membership: { uid: "playerA1", role: "player" },
  profile: sensible
    ? { ...PROFILE, pains: [{ zone: "SENTINEL_ZONE_PROFIL", level: 4 }], injuryNote: "SENTINEL_NOTE_PROFIL" }
    : { ...PROFILE },
  sessions: [sensible ? completedSensible() : completedPropre()],
  plannedSessions: [sensible ? plannedSensible() : plannedPropre()],
  now: NOW,
});

// ════════════════════════════════════════════════════════════════════════════

describe("SONDE HOSTILE — égalité stricte avec / sans données sensibles", () => {
  it("la projection est IDENTIQUE (deep equal) dans les deux mondes", () => {
    const avec = projectPlayerSummary(input(true));
    const sans = projectPlayerSummary(input(false));
    expect(avec).not.toBeNull();
    expect(avec).toEqual(sans);
  });

  it("…et identique jusque dans sa sérialisation (ordre des clés compris)", () => {
    // `toEqual` ignore l'ordre des clés d'objet ; la sérialisation, non. Un
    // champ conditionnel ajouté « seulement quand il y a de la douleur » se
    // verrait ici, même à valeur égale.
    expect(JSON.stringify(projectPlayerSummary(input(true)))).toBe(
      JSON.stringify(projectPlayerSummary(input(false))),
    );
  });

  it("aucune sentinelle sensible n'apparaît dans la projection", () => {
    const blob = JSON.stringify(projectPlayerSummary(input(true)));
    expect(blob).not.toContain("SENTINEL");
    for (const mot of ["pain", "douleur", "blessure", "injury", "fatigue", "rpe", "tsb", "atl", "ctl", "sleep", "comment", "snapshot", "fingerprint"]) {
      expect(blob.toLowerCase()).not.toContain(mot);
    }
  });

  it("le DTO reste coach-safe au sens de assertCoachSafe", () => {
    expect(() => assertCoachSafe(projectPlayerSummary(input(true)))).not.toThrow();
  });

  it("chaque catégorie sensible, prise SEULE, ne bouge rien", () => {
    // Preuve par isolat : si l'égalité globale masquait une compensation entre
    // deux fuites, ces cas la feraient apparaître.
    const sans = projectPlayerSummary(input(false));
    const cas: Record<string, Record<string, unknown>> = {
      "niveau + zones de douleur": { painLevel: 4, painZones: ["knee_left"] },
      "feedback complet": {
        feedback: { durationMin: 40, rpe: 9, pain: 4, fatigue: 5, sleep: 2, recovery: 1, comment: "SENTINEL_C" },
      },
      "métriques de charge": { metrics: { atl: 78.4, ctl: 46.9, tsb: -31.5 } },
      "garde-fous sensibles": {
        aiV2: { focusPrimary: "strength", intensity: "moderate", blocks: [{}, {}, {}, {}], guardrailsApplied: [...GUARDRAILS_AUTORISES, ...GUARDRAILS_SENSIBLES] },
      },
      "raisons d'écart sensibles": {
        execution: {
          ...completedPropre().execution,
          completion: { ...completedPropre().execution.completion, mainReasons: ["pain", "time", "fatigue", "equipment"] },
        },
      },
    };

    for (const [nom, surcharge] of Object.entries(cas)) {
      const out = projectPlayerSummary({
        ...input(false),
        sessions: [{ ...completedPropre(), ...surcharge }],
      });
      expect(`${nom}: ${JSON.stringify(out)}`).toBe(`${nom}: ${JSON.stringify(sans)}`);
    }
  });
});

describe("SONDE HOSTILE — contre-preuve : rien n'a été stérilisé par accident", () => {
  it("les garde-fous AUTORISÉS produisent toujours leurs libellés", () => {
    const out = projectPlayerSummary(input(true));
    expect(out!.adaptation.adapted).toBe(true);
    expect(out!.adaptation.labels).toEqual([
      "Semaine club intense : charge FKS réduite", // contexte club saisi par le coach
      "Exercices incompatibles retirés (catégorie d'âge)", // catégorie d'âge
      "Veille de match : activation uniquement", // calendrier de match
      "Entraînement club proche : charge réduite", // agenda club (token client)
    ]);
  });

  it("les compteurs d'exécution et les raisons NON sensibles restent lisibles", () => {
    const out = projectPlayerSummary(input(true));
    expect(out!.execution).toEqual({
      completionPct: 72,
      completionStatus: "partial",
      itemsDone: 7,
      itemsAdapted: 1,
      itemsSkipped: 1,
      itemsReplaced: 2,
      itemsReplacedEquivalent: 1,
      itemsReplacedPartial: 1,
      itemsTotal: 5,
      // "pain" et "fatigue" retirés AVANT le plafond de 3 : ni trace, ni rang volé.
      deviationLabels: ["Manque de temps", "Matériel indisponible"],
    });
  });

  it("la séance elle-même reste décrite (le coach n'a pas perdu son écran)", () => {
    const out = projectPlayerSummary(input(true));
    expect(out!.lastDone).toEqual({
      dateKey: "2026-06-28",
      title: "Séance renfo / force",
      focusLabel: "Renfo / Force",
      intensityLabel: "Modérée",
      durationMin: 40,
      blockCount: 4,
    });
    expect(out!.lastPlanned!.dateKey).toBe("2026-07-02");
    expect(out!.activity!.doneDateKeys).toEqual(["2026-06-28"]);
  });
});
