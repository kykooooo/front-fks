// functions/tests/projector.test.ts
// Tests UNITAIRES du projecteur pur (aucun Firestore). Couvre §8 PR-2 + hardening P0.

import { projectPlayerSummary, type ProjectorInput } from "../src/projector";
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
