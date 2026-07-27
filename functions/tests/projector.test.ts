// functions/tests/projector.test.ts
// Tests UNITAIRES du projecteur pur (aucun Firestore). Couvre §8 PR-2 + hardening P0.

import { ACTIVITY_MAX_DATES, projectPlayerSummary, type ProjectorInput } from "../src/projector";
import { assertCoachSafe, FORBIDDEN_KEYS } from "../src/dto";

const NOW = new Date("2026-06-30T12:00:00.000Z");

const baseInput = (over: Partial<ProjectorInput> = {}): ProjectorInput => ({
  playerUid: "playerA1",
  clubId: "clubA",
  membership: { uid: "playerA1", role: "player" },
  profile: {
    uid: "playerA1",
    clubId: "clubA",
    role: "player",
    firstName: "Anna",
    position: "Milieu", // valeur réelle front (ProfileSetupScreen.tsx:50)
    level: "Regional", // valeur réelle front (ProfileSetupScreen.tsx:51)
    ageCategory: "U15",
    profileCompleted: true,
  },
  sessions: [],
  plannedSessions: [],
  now: NOW,
  ...over,
});

// Séance FAITE brute avec TOUT le sensible (pain/comment/fatigue/rpe/metrics/aiV2).
const completedRaw = (over: Record<string, unknown> = {}) => ({
  __id: "s1",
  date: "2026-06-28",
  dateISO: "2026-06-28",
  title: "Renfo bas du corps", // texte libre — NE DOIT PAS traverser
  intensity: "moderate",
  focus: "strength",
  rpe: 8,
  feedback: { pain: 3, comment: "mal au genou", fatigue: 4, sleep: 2, rpe: 8, durationMin: 40 },
  metrics: { atl: 55.1, ctl: 40.9, tsb: -14.2 },
  aiV2: { title: "Renfo bas du corps", focusPrimary: "strength", intensity: "moderate", blocks: [{}, {}, {}, {}], guardrailsApplied: ["team:female_neuromuscular_focus"] },
  ...over,
});

const plannedRaw = (over: Record<string, unknown> = {}) => ({
  __id: "p1",
  date: "2026-07-02",
  title: "Explosivite",
  focus: "speed",
  intensity: "hard",
  durationMin: 35,
  ai: { title: "Explosivite", blocks: [{}, {}, {}], selection_debug: { seed: 42 }, guardrailsApplied: ["age:U15_duration_cap"] },
  clientGuardrailsApplied: ["client:club_proximity_reduction"],
  ...over,
});

describe("projectPlayerSummary — nominal", () => {
  it("titre dérivé du FOCUS (allowlist), jamais du titre libre", () => {
    const out = projectPlayerSummary(baseInput({ sessions: [completedRaw()] }));
    expect(out).not.toBeNull();
    expect(out!.playerUid).toBe("playerA1");
    expect(out!.firstName).toBe("Anna");
    expect(out!.ageCategory).toBe("U15");
    expect(out!.position).toBe("Milieu");
    expect(out!.level).toBe("Regional");
    expect(out!.profileComplete).toBe(true);
    expect(out!.latestSession).toMatchObject({
      dateKey: "2026-06-28",
      title: "Séance renfo / force", // dérivé de focus="strength", PAS "Renfo bas du corps"
      focusLabel: "Renfo / Force",
      intensityLabel: "Modérée",
      durationMin: 40,
      blockCount: 4,
      status: "done",
    });
    expect(out!.latestSession).not.toHaveProperty("id"); // id non exposé
    expect(out!.lastActivity).toEqual({ dateKey: "2026-06-28", durationMin: 40 });
    expect(JSON.stringify(out)).not.toContain("Renfo bas du corps");
  });
});

describe("projectPlayerSummary — sélection séance", () => {
  it("aucun historique → latestSession/lastActivity null, adaptation vide", () => {
    const out = projectPlayerSummary(baseInput());
    expect(out!.latestSession).toBeNull();
    expect(out!.lastActivity).toBeNull();
    expect(out!.adaptation).toEqual({ adapted: false, labels: [] });
  });

  it("planned seulement → latestSession planned, lastActivity null", () => {
    const out = projectPlayerSummary(baseInput({ plannedSessions: [plannedRaw()] }));
    expect(out!.latestSession!.status).toBe("planned");
    expect(out!.latestSession!.title).toBe("Séance vitesse"); // focus=speed
    expect(out!.lastActivity).toBeNull();
  });

  it("completed seulement → latestSession done", () => {
    const out = projectPlayerSummary(baseInput({ sessions: [completedRaw()] }));
    expect(out!.latestSession!.status).toBe("done");
  });

  it("même jour planned+completed → completed prioritaire", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [completedRaw({ date: "2026-06-28", dateISO: "2026-06-28" })],
        plannedSessions: [plannedRaw({ date: "2026-06-28" })],
      }),
    );
    expect(out!.latestSession!.status).toBe("done");
  });

  it("future planned réellement plus récente → planned", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [completedRaw({ date: "2026-06-20", dateISO: "2026-06-20" })],
        plannedSessions: [plannedRaw({ date: "2026-07-02" })],
      }),
    );
    expect(out!.latestSession!.status).toBe("planned");
  });

  it("dates absentes → completed prioritaire (vérité terrain)", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [completedRaw({ date: undefined, dateISO: undefined })],
        plannedSessions: [plannedRaw({ date: undefined })],
      }),
    );
    expect(out!.latestSession!.status).toBe("done");
  });
});

describe("projectPlayerSummary — robustesse valeurs + bornes", () => {
  it("champs invalides / hors allowlist → null, jamais de crash", () => {
    const out = projectPlayerSummary(
      baseInput({
        profile: {
          uid: "playerA1",
          clubId: "clubA",
          role: "player",
          firstName: 123,
          position: {},
          level: [],
          ageCategory: "INVALID",
          profileCompleted: "yes",
        },
        sessions: [completedRaw({ intensity: 999, focus: null, aiV2: { blocks: "nope" } })],
      }),
    );
    expect(out).not.toBeNull();
    expect(out!.firstName).toBeNull();
    expect(out!.position).toBeNull();
    expect(out!.level).toBeNull();
    expect(out!.ageCategory).toBeNull();
    expect(out!.profileComplete).toBe(false);
    expect(out!.latestSession!.blockCount).toBeNull();
    expect(out!.latestSession!.intensityLabel).toBeNull();
    expect(out!.latestSession!.focusLabel).toBeNull();
    expect(out!.latestSession!.title).toBeNull();
  });

  it("position/level hors allowlist (ex fixtures 'MIL'/'R1') → null", () => {
    const out = projectPlayerSummary(
      baseInput({ profile: { ...baseInput().profile, position: "MIL", level: "R1" } }),
    );
    expect(out!.position).toBeNull();
    expect(out!.level).toBeNull();
  });

  it("durationMin/blockCount hors plage réaliste → null", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [completedRaw({ feedback: { durationMin: 99999 }, aiV2: { blocks: new Array(500).fill({}) } })],
      }),
    );
    expect(out!.latestSession!.durationMin).toBeNull();
    expect(out!.latestSession!.blockCount).toBeNull();
  });

  it("firstName trimé, sans caractères de contrôle, borné", () => {
    const dirty = "  Anna	" + "x".repeat(80);
    const out = projectPlayerSummary(baseInput({ profile: { ...baseInput().profile, firstName: dirty } }));
    const name = out!.firstName!;
    const hasControl = Array.from(name).some((ch) => {
      const c = ch.codePointAt(0)!;
      return c <= 0x1f || (c >= 0x7f && c <= 0x9f);
    });
    expect(hasControl).toBe(false);
    expect(name.length).toBeLessThanOrEqual(40);
    expect(name.startsWith("Anna")).toBe(true);
  });
});

describe("projectPlayerSummary — adaptation", () => {
  it("token connu traduit en label coach", () => {
    const out = projectPlayerSummary({ ...baseInput({ sessions: [completedRaw()] }) });
    expect(out!.adaptation.adapted).toBe(true);
    expect(out!.adaptation.labels).toContain("Contrôle appuis et alignement");
  });

  it("token inconnu supprimé (jamais recopié)", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [completedRaw({ aiV2: { blocks: [{}], guardrailsApplied: ["totally_unknown_token", "internal:seed:42"] } })],
      }),
    );
    expect(out!.adaptation.adapted).toBe(false);
    expect(out!.adaptation.labels).toEqual([]);
  });

  it("détail médical (pain token) → label neutre, jamais le détail", () => {
    const out = projectPlayerSummary(
      baseInput({ plannedSessions: [plannedRaw({ ai: { blocks: [{}], guardrailsApplied: ["injury:knee_left_severe"] }, clientGuardrailsApplied: [] })] }),
    );
    expect(out!.adaptation.labels).toEqual(["Adaptation sécurité appliquée"]);
    expect(JSON.stringify(out)).not.toContain("knee");
  });
});

describe("projectPlayerSummary — anti-fuite (adversarial)", () => {
  const SENTINELS = {
    title: "SENTINEL_TITLE_LEAK",
    aiTitle: "SENTINEL_AITITLE_LEAK",
    focus: "SENTINEL_FOCUS_LEAK",
    position: "SENTINEL_POSITION_LEAK",
    level: "SENTINEL_LEVEL_LEAK",
    comment: "SENTINEL_COMMENT_je_ai_mal",
    pain: "SENTINEL_PAIN_LEAK",
    aiV2: "SENTINEL_AIV2_LEAK",
    metrics: "SENTINEL_METRICS_LEAK",
    docId: "SENTINEL_DOCID_LEAK", // un doc ID Firestore est du texte client arbitraire
  };

  it("aucune sentinelle sensible ne traverse (sauf firstName contrôlé)", () => {
    const out = projectPlayerSummary(
      baseInput({
        profile: {
          ...baseInput().profile,
          firstName: "Anna", // seul champ identité contrôlé, autorisé
          position: SENTINELS.position,
          level: SENTINELS.level,
        },
        sessions: [
          completedRaw({
            __id: SENTINELS.docId, // doc ID sentinelle — ne doit PAS traverser
            id: SENTINELS.docId,
            title: SENTINELS.title,
            focus: SENTINELS.focus,
            feedback: { comment: SENTINELS.comment, pain: SENTINELS.pain, durationMin: 40 },
            metrics: { note: SENTINELS.metrics, tsb: -14 },
            aiV2: { title: SENTINELS.aiTitle, note: SENTINELS.aiV2, focusPrimary: SENTINELS.focus, blocks: [{}, {}] },
          }),
        ],
        plannedSessions: [
          plannedRaw({ title: SENTINELS.title, focus: SENTINELS.focus, ai: { title: SENTINELS.aiTitle, blocks: [{}] } }),
        ],
      }),
    );
    const blob = JSON.stringify(out);
    for (const s of Object.values(SENTINELS)) {
      expect(blob).not.toContain(s);
    }
    expect(() => assertCoachSafe(out)).not.toThrow();
    expect(out!.firstName).toBe("Anna"); // contrôlé, présent
  });

  it("RPE jamais présent (ni latestSession ni lastActivity)", () => {
    const out = projectPlayerSummary(baseInput({ sessions: [completedRaw()] }));
    expect(JSON.stringify(out)).not.toMatch(/rpe/i);
    expect(Object.keys(out!.lastActivity!)).toEqual(["dateKey", "durationMin"]);
  });

  it("le DTO n'expose QUE les clés de premier niveau attendues", () => {
    const out = projectPlayerSummary(baseInput({ sessions: [completedRaw()] }));
    expect(Object.keys(out!).sort()).toEqual(
      [
        "adaptation",
        "ageCategory",
        "firstName",
        "lastActivity",
        "latestSession",
        "level",
        "playerUid",
        "position",
        "profileComplete",
        // Extension v2 (prévu vs fait + activité + exécution réelle)
        "activity",
        "execution",
        "lastDone",
        "lastPlanned",
      ].sort(),
    );
    for (const k of FORBIDDEN_KEYS) expect(Object.keys(out!)).not.toContain(k);
  });
});

describe("projectPlayerSummary — membership / profil (P0.3)", () => {
  it("membership non-player → null", () => {
    expect(projectPlayerSummary(baseInput({ membership: { uid: "playerA1", role: "coach" } }))).toBeNull();
  });

  it("membership absent → null", () => {
    expect(projectPlayerSummary(baseInput({ membership: null }))).toBeNull();
  });

  it("profil absent → null (P0.3 : profil requis)", () => {
    expect(projectPlayerSummary(baseInput({ profile: null }))).toBeNull();
  });

  it("clubId absent dans le profil → null", () => {
    const { clubId: _omit, ...noClub } = baseInput().profile as Record<string, unknown>;
    void _omit;
    expect(projectPlayerSummary(baseInput({ profile: noClub }))).toBeNull();
  });

  it("mauvais clubId (changement de club) → null pour l'ancien club", () => {
    expect(
      projectPlayerSummary(baseInput({ clubId: "clubA", profile: { ...baseInput().profile, clubId: "clubB" } })),
    ).toBeNull();
  });

  it("profil marqué coach → null", () => {
    expect(projectPlayerSummary(baseInput({ profile: { ...baseInput().profile, role: "coach" } }))).toBeNull();
  });

  it("membership player + profil cohérent → projection créée", () => {
    const out = projectPlayerSummary(baseInput({ sessions: [completedRaw()] }));
    expect(out).not.toBeNull();
    expect(out!.latestSession!.status).toBe("done");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Extension v2 : activité (faits datés), prévu vs fait, exécution réelle.
// ════════════════════════════════════════════════════════════════════════════

describe("projectPlayerSummary — activity (faits bruts, SANS horloge)", () => {
  it("aucune séance faite → doneDateKeys vide (jamais null, jamais inventé)", () => {
    const out = projectPlayerSummary(baseInput({ plannedSessions: [plannedRaw()] }));
    expect(out!.activity).toEqual({ doneDateKeys: [] });
  });

  it("dates triées décroissantes et dédupliquées (2 séances le même jour = 1 date)", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [
          completedRaw({ __id: "a", date: "2026-06-20", dateISO: "2026-06-20" }),
          completedRaw({ __id: "b", date: "2026-06-28", dateISO: "2026-06-28" }),
          completedRaw({ __id: "c", date: "2026-06-28", dateISO: "2026-06-28" }),
          completedRaw({ __id: "d", date: "2026-06-24", dateISO: "2026-06-24" }),
        ],
      }),
    );
    expect(out!.activity!.doneDateKeys).toEqual(["2026-06-28", "2026-06-24", "2026-06-20"]);
  });

  it("séance sans date exploitable → ignorée (pas de date inventée)", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [
          completedRaw({ __id: "a", date: undefined, dateISO: undefined }),
          completedRaw({ __id: "b", date: "pas une date", dateISO: undefined }),
          completedRaw({ __id: "c", date: "2026-06-28", dateISO: "2026-06-28" }),
        ],
      }),
    );
    expect(out!.activity!.doneDateKeys).toEqual(["2026-06-28"]);
  });

  it("date ISO complète normalisée en dateKey", () => {
    const out = projectPlayerSummary(
      baseInput({ sessions: [completedRaw({ date: "2026-06-28T21:15:00.000Z", dateISO: undefined })] }),
    );
    expect(out!.activity!.doneDateKeys).toEqual(["2026-06-28"]);
  });

  it("borné à ACTIVITY_MAX_DATES (14) même avec plus de séances", () => {
    const sessions = Array.from({ length: 25 }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return completedRaw({ __id: `s${i}`, date: `2026-06-${day}`, dateISO: `2026-06-${day}` });
    });
    const out = projectPlayerSummary(baseInput({ sessions }));
    expect(ACTIVITY_MAX_DATES).toBe(14);
    expect(out!.activity!.doneDateKeys).toHaveLength(14);
    // Les 14 PLUS RÉCENTES (25 juin → 12 juin), pas les 14 premières lues.
    expect(out!.activity!.doneDateKeys[0]).toBe("2026-06-25");
    expect(out!.activity!.doneDateKeys[13]).toBe("2026-06-12");
  });

  it("aucun champ relatif au temps présent n'est projeté (invariant SANS horloge)", () => {
    const out = projectPlayerSummary(baseInput({ sessions: [completedRaw()] }));
    const blob = JSON.stringify(out);
    for (const interdit of ["daysSince", "isLate", "recent", "next", "missed", "streak"]) {
      expect(blob).not.toContain(interdit);
    }
  });

  it("le résultat ne dépend PAS de `now` (pureté)", () => {
    const input = baseInput({ sessions: [completedRaw()], plannedSessions: [plannedRaw()] });
    const a = projectPlayerSummary({ ...input, now: new Date("2026-01-01T00:00:00.000Z") });
    const b = projectPlayerSummary({ ...input, now: new Date("2027-12-31T23:59:59.000Z") });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("projectPlayerSummary — lastPlanned / lastDone coexistent", () => {
  it("les deux existent en même temps (le coach peut comparer prévu vs fait)", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [completedRaw({ date: "2026-06-28", dateISO: "2026-06-28" })],
        plannedSessions: [plannedRaw({ date: "2026-07-02" })],
      }),
    );
    expect(out!.lastDone).toEqual({
      dateKey: "2026-06-28",
      title: "Séance renfo / force",
      focusLabel: "Renfo / Force",
      intensityLabel: "Modérée",
      durationMin: 40,
      blockCount: 4,
    });
    expect(out!.lastPlanned).toEqual({
      dateKey: "2026-07-02",
      title: "Séance vitesse",
      focusLabel: "Vitesse",
      intensityLabel: "Intense",
      durationMin: 35,
      blockCount: 3,
    });
    // …alors que l'ancien champ n'en montre qu'UNE (le défaut historique).
    expect(out!.latestSession!.status).toBe("planned");
  });

  it("aucun `status` dans les références (le nom du champ le porte)", () => {
    const out = projectPlayerSummary(baseInput({ sessions: [completedRaw()], plannedSessions: [plannedRaw()] }));
    expect(out!.lastDone).not.toHaveProperty("status");
    expect(out!.lastPlanned).not.toHaveProperty("status");
  });

  it("source absente → null (jamais un objet vide)", () => {
    const out = projectPlayerSummary(baseInput({ sessions: [completedRaw()] }));
    expect(out!.lastPlanned).toBeNull();
    expect(out!.lastDone).not.toBeNull();

    const out2 = projectPlayerSummary(baseInput({ plannedSessions: [plannedRaw()] }));
    expect(out2!.lastDone).toBeNull();
    expect(out2!.lastPlanned).not.toBeNull();
  });

  it("titre TOUJOURS dérivé du focus allowlisté, jamais du titre libre", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [completedRaw({ title: "Renfo bas du corps" })],
        plannedSessions: [plannedRaw({ title: "Explosivite" })],
      }),
    );
    const blob = JSON.stringify({ p: out!.lastPlanned, d: out!.lastDone });
    expect(blob).not.toContain("Renfo bas du corps");
    expect(blob).not.toContain("Explosivite");
  });

  it("`latestSession` conserve EXACTEMENT sa sémantique (rétrocompat)", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [completedRaw({ date: "2026-06-28", dateISO: "2026-06-28" })],
        plannedSessions: [plannedRaw({ date: "2026-06-28" })],
      }),
    );
    // Même jour → la séance FAITE gagne, comme avant l'extension v2.
    expect(out!.latestSession).toEqual({ ...out!.lastDone, status: "done" });
  });
});

describe("projectPlayerSummary — execution (boucle de suivi)", () => {
  // Forme RÉELLE du champ posé par la boucle sur users/{uid}/sessions/{id}
  // (domain/tracking/types.SessionExecution). On y met VOLONTAIREMENT tout le
  // sensible : snapshot complet, commentaires libres, raisons "pain"/"fatigue".
  const executionRaw = (over: Record<string, unknown> = {}) => {
    const base = {
      version: 1,
      sessionId: "s1",
      fingerprint: "fp-1",
      snapshot: {
        sessionId: "s1",
        plannedDurationMin: 45,
        items: [{ key: "0-0", exerciseId: "SENTINEL_EXO", name: "SENTINEL_EXO_NAME", notes: "SENTINEL_NOTE" }],
      },
      items: [
        { key: "0-0", status: "done", reason: null, comment: null },
        { key: "0-1", status: "adapted", reason: "time", comment: "SENTINEL_COMMENT_LIBRE" },
        { key: "0-2", status: "skipped", reason: "pain", comment: "SENTINEL_COMMENT_GENOU" },
      ],
      startedAtISO: "2026-06-28T17:00:00.000Z",
      finishedAtISO: "2026-06-28T17:44:00.000Z",
      actualDurationMin: 44,
      allAsPlanned: false,
      completion: {
        pct: 78,
        done: 7,
        adapted: 1,
        skipped: 1,
        replacedEquivalent: 1,
        replacedPartial: 1,
        status: "partial",
        mainReasons: ["time", "pain"],
      },
    };
    // `completion` est FUSIONNÉ (et non remplacé) : les surcharges des tests ne
    // portent que sur les champs qu'elles citent.
    return {
      ...base,
      ...over,
      completion: { ...base.completion, ...((over.completion as Record<string, unknown> | undefined) ?? {}) },
    };
  };

  it("champ absent (boucle pas encore mergée) → null : c'est le cas NOMINAL", () => {
    const out = projectPlayerSummary(baseInput({ sessions: [completedRaw()] }));
    expect(out!.execution).toBeNull();
  });

  it("aucune séance faite → null", () => {
    const out = projectPlayerSummary(baseInput({ plannedSessions: [plannedRaw()] }));
    expect(out!.execution).toBeNull();
  });

  it("résume l'exécution de la DERNIÈRE séance faite", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [
          completedRaw({
            __id: "vieille",
            date: "2026-06-20",
            dateISO: "2026-06-20",
            execution: executionRaw({ completion: { pct: 10 } }),
          }),
          completedRaw({ __id: "s1", date: "2026-06-28", dateISO: "2026-06-28", execution: executionRaw() }),
        ],
      }),
    );
    expect(out!.execution).toEqual({
      completionPct: 78,
      completionStatus: "partial",
      itemsDone: 7,
      itemsAdapted: 1,
      itemsSkipped: 1,
      itemsReplaced: 2, // somme, pour un affichage compact
      // …mais la NUANCE est conservée : équivalent (poids 1) et partiel (poids
      // 0,5) ne pèsent pas pareil dans le pourcentage. Sans ces deux champs, le
      // coach ne peut pas refaire le calcul qu'on lui affiche.
      itemsReplacedEquivalent: 1,
      itemsReplacedPartial: 1,
      itemsTotal: 3, // = execution.items.length (dénominateur du pourcentage)
      deviationLabels: ["Manque de temps", "Autre raison"],
    });
  });

  // ── Preuve : le pourcentage annoncé est RECALCULABLE à partir du projeté ───
  //
  // La formule de la boucle de suivi (domain/tracking/execution.ts + config.ts) :
  //   pct = arrondi( (1×fait + 1×adapté + 1×remplacé_équivalent
  //                   + 0,5×remplacé_partiel + 0×sauté + 0×inconnu) / total × 100 )
  // Les catégories sont EXCLUSIVES (un switch sur item.status range chaque
  // exercice dans UNE seule) : "remplacé" n'est PAS un sous-ensemble d'"adapté".
  it("le pourcentage annoncé se retrouve à partir des seuls champs projetés", () => {
    // Cas réaliste : 12 exercices, dont un resté sans statut connu (pèse 0 mais
    // compte dans le total) → les compteurs ne somment pas au total, et c'est normal.
    const items = [
      ...Array.from({ length: 7 }, (_, i) => ({ key: `d${i}`, status: "done" })),
      { key: "a0", status: "adapted" },
      { key: "r0", status: "replaced_equivalent" },
      { key: "r1", status: "replaced_partial" },
      { key: "s0", status: "skipped" },
      { key: "u0", status: "unknown" },
    ];
    // (7 + 1 + 1 + 0,5) / 12 × 100 = 79,17 → 79
    const out = projectPlayerSummary(
      baseInput({
        sessions: [
          completedRaw({
            execution: executionRaw({
              items,
              completion: {
                pct: 79,
                done: 7,
                adapted: 1,
                skipped: 1,
                replacedEquivalent: 1,
                replacedPartial: 1,
                status: "partial",
                mainReasons: [],
              },
            }),
          }),
        ],
      }),
    );
    const e = out!.execution!;
    expect(e.itemsTotal).toBe(12);

    const pondere =
      (e.itemsDone ?? 0) +
      (e.itemsAdapted ?? 0) +
      (e.itemsReplacedEquivalent ?? 0) +
      0.5 * (e.itemsReplacedPartial ?? 0);
    expect(Math.round((pondere / (e.itemsTotal as number)) * 100)).toBe(e.completionPct);

    // …et la preuve que la NUANCE est indispensable : avec le seul compteur
    // agrégé, les deux hypothèses extrêmes donnent des résultats FAUX.
    const siTousEquivalents = (e.itemsDone ?? 0) + (e.itemsAdapted ?? 0) + (e.itemsReplaced ?? 0);
    const siTousPartiels = (e.itemsDone ?? 0) + (e.itemsAdapted ?? 0) + 0.5 * (e.itemsReplaced ?? 0);
    expect(Math.round((siTousEquivalents / 12) * 100)).not.toBe(e.completionPct);
    expect(Math.round((siTousPartiels / 12) * 100)).not.toBe(e.completionPct);
  });

  it("total : `completion.total` explicite prioritaire sur la longueur des items", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [
          completedRaw({
            execution: executionRaw({ completion: { total: 14, mainReasons: [] } }),
          }),
        ],
      }),
    );
    expect(out!.execution!.itemsTotal).toBe(14);
  });

  it("total inconnu → null, JAMAIS un 0 (un dénominateur nul serait un faux chiffre)", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [
          completedRaw({
            execution: { completion: { pct: 80, status: "partial", done: 8, mainReasons: [] } },
          }),
        ],
      }),
    );
    expect(out!.execution!.itemsTotal).toBeNull();
    expect(out!.execution!.completionPct).toBe(80);
  });

  it("ANTI-FUITE : snapshot, commentaires libres et raison 'pain' ne traversent jamais", () => {
    const out = projectPlayerSummary(baseInput({ sessions: [completedRaw({ execution: executionRaw() })] }));
    const blob = JSON.stringify(out);
    const sentinelles = [
      "SENTINEL_EXO",
      "SENTINEL_EXO_NAME",
      "SENTINEL_NOTE",
      "SENTINEL_COMMENT_LIBRE",
      "SENTINEL_COMMENT_GENOU",
    ];
    for (const s of sentinelles) expect(blob).not.toContain(s);
    expect(blob).not.toContain("pain");
    expect(blob).not.toContain("fingerprint");
    expect(() => assertCoachSafe(out)).not.toThrow();
  });

  it("NON INVERSIBILITÉ de bout en bout : douleur, fatigue et autre → MÊME projection", () => {
    const build = (reason: string) =>
      projectPlayerSummary(
        baseInput({ sessions: [completedRaw({ execution: executionRaw({ completion: { mainReasons: [reason] } }) })] }),
      );
    const withPain = build("pain");
    const withFatigue = build("fatigue");
    const withOther = build("other");
    expect(withPain!.execution).toEqual(withFatigue!.execution);
    expect(withPain!.execution).toEqual(withOther!.execution);
    expect(withPain!.execution!.deviationLabels).toEqual(["Autre raison"]);
  });

  it("sans mainReasons, retombe sur items[].reason — en ne lisant QUE `reason`", () => {
    const ex = executionRaw();
    delete (ex.completion as Record<string, unknown>).mainReasons;
    const out = projectPlayerSummary(baseInput({ sessions: [completedRaw({ execution: ex })] }));
    expect(out!.execution!.deviationLabels).toEqual(["Manque de temps", "Autre raison"]);
    expect(JSON.stringify(out)).not.toContain("SENTINEL_COMMENT_LIBRE");
  });

  it("mainReasons vide → même repli sur items[].reason (liste vide = non calculée)", () => {
    const out = projectPlayerSummary(
      baseInput({ sessions: [completedRaw({ execution: executionRaw({ completion: { mainReasons: [] } }) })] }),
    );
    expect(out!.execution!.deviationLabels).toEqual(["Manque de temps", "Autre raison"]);
  });

  it("aucun écart nulle part → deviationLabels vide", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [
          completedRaw({
            execution: executionRaw({
              items: [{ key: "0-0", status: "done", reason: null, comment: null }],
              completion: { mainReasons: [] },
            }),
          }),
        ],
      }),
    );
    expect(out!.execution!.deviationLabels).toEqual([]);
  });

  it("bornes : pct hors 0..100 et compteurs aberrants → null", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [
          completedRaw({
            execution: executionRaw({
              items: [], // on isole ici les BORNES numériques, pas les raisons
              completion: { pct: 420, done: -3, adapted: 2.5, skipped: 99999, status: "termine", mainReasons: [] },
            }),
          }),
        ],
      }),
    );
    expect(out!.execution).toEqual({
      completionPct: null,
      completionStatus: null,
      itemsDone: null,
      itemsAdapted: null,
      itemsSkipped: null,
      itemsReplaced: 2,
      itemsReplacedEquivalent: 1,
      itemsReplacedPartial: 1,
      itemsTotal: null, // liste d'items vide → total inconnu, pas 0
      deviationLabels: [],
    });
  });

  it("execution vide de tout signal exploitable → null (état franc, pas d'objet de null)", () => {
    const out = projectPlayerSummary(
      baseInput({ sessions: [completedRaw({ execution: { version: 1, items: [], completion: {} } })] }),
    );
    expect(out!.execution).toBeNull();
  });

  it("execution mal formée (chaîne, tableau, null, nombre) → null, jamais de crash", () => {
    for (const bad of ["oui", [1, 2], null, 42]) {
      const out = projectPlayerSummary(baseInput({ sessions: [completedRaw({ execution: bad })] }));
      expect(out!.execution).toBeNull();
    }
  });

  it("compteurs partiels : une absence ne devient pas un 0 affiché", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [
          completedRaw({ execution: { completion: { pct: 100, status: "full", done: 10, mainReasons: [] } } }),
        ],
      }),
    );
    expect(out!.execution).toEqual({
      completionPct: 100,
      completionStatus: "full",
      itemsDone: 10,
      itemsAdapted: null,
      itemsSkipped: null,
      itemsReplaced: null,
      itemsReplacedEquivalent: null,
      itemsReplacedPartial: null,
      itemsTotal: null,
      deviationLabels: [],
    });
  });

  it("compteur `replaced` à plat (variante) accepté, sans inventer la répartition", () => {
    const out = projectPlayerSummary(
      baseInput({
        sessions: [completedRaw({ execution: { completion: { pct: 90, status: "partial", replaced: 3 } } })],
      }),
    );
    expect(out!.execution!.itemsReplaced).toBe(3);
    // La nuance équivalent/partiel est RÉELLEMENT inconnue ici : on ne la devine pas.
    expect(out!.execution!.itemsReplacedEquivalent).toBeNull();
    expect(out!.execution!.itemsReplacedPartial).toBeNull();
  });
});
