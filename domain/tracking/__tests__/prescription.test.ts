// domain/tracking/__tests__/prescription.test.ts
import { buildPrescribedSnapshot, fingerprintPrescription } from "../prescription";
import type { FKS_NextSessionV2 } from "../../../screens/newSession/types";

function buildRealisticV2(): FKS_NextSessionV2 {
  return {
    version: "fks.next_session.v2",
    title: "Seance Force bas du corps",
    intensity: "moderate",
    focusPrimary: "strength",
    durationMin: 55,
    rpeTarget: 6,
    archetypeId: "force_lower_main",
    blocks: [
      {
        id: "warmup",
        type: "warmup",
        goal: "activation",
        intensity: "easy",
        durationMin: 8,
        items: [
          { exerciseId: "wu_hip_circle", name: "Cercles de hanche", sets: 2, reps: 10 },
        ],
      },
      {
        id: "strength_main",
        type: "strength",
        goal: "force jambes",
        intensity: "hard",
        durationMin: 25,
        items: [
          {
            exerciseId: "str_squat_bodyweight",
            name: "Squat poids du corps",
            sets: 4,
            reps: 8,
            restS: 90,
            notes: "Charge : monte tant que la technique reste propre.",
          },
          {
            exerciseId: "str_lunge_bodyweight",
            name: "Fentes",
            sets: 3,
            reps: 10,
            restS: 60,
          },
        ],
      },
    ],
  };
}

function buildMinimalV2(): FKS_NextSessionV2 {
  // Volontairement troue : pas de blocks, pas d'items, champs optionnels absents.
  return {
    version: "fks.next_session.v2",
    title: "Seance",
    intensity: "easy",
    focusPrimary: "run",
    durationMin: 20,
    rpeTarget: 4,
    blocks: [],
  };
}

describe("fingerprintPrescription", () => {
  it("est stable pour deux appels sur le meme v2", () => {
    const v2 = buildRealisticV2();
    expect(fingerprintPrescription(v2)).toBe(fingerprintPrescription(v2));
  });

  it("est stable independamment de l'ordre de declaration des cles de l'objet source", () => {
    const v2A = buildRealisticV2();
    // Meme contenu, ordre de declaration des cles inverse au niveau racine.
    const v2B: FKS_NextSessionV2 = {
      blocks: v2A.blocks,
      rpeTarget: v2A.rpeTarget,
      archetypeId: v2A.archetypeId,
      durationMin: v2A.durationMin,
      focusPrimary: v2A.focusPrimary,
      intensity: v2A.intensity,
      title: v2A.title,
      version: v2A.version,
    };
    expect(fingerprintPrescription(v2B)).toBe(fingerprintPrescription(v2A));
  });

  it("change si un champ prescriptif change (reps d'un item)", () => {
    const v2A = buildRealisticV2();
    const v2B = buildRealisticV2();
    v2B.blocks[1].items![0].reps = 12;
    expect(fingerprintPrescription(v2B)).not.toBe(fingerprintPrescription(v2A));
  });

  it("change si le titre change", () => {
    const v2A = buildRealisticV2();
    const v2B = buildRealisticV2();
    v2B.title = "Autre titre";
    expect(fingerprintPrescription(v2B)).not.toBe(fingerprintPrescription(v2A));
  });

  it("ne plante pas sur un v2 minimal troue (blocks vides)", () => {
    expect(() => fingerprintPrescription(buildMinimalV2())).not.toThrow();
  });
});

describe("buildPrescribedSnapshot", () => {
  it("extrait les items dans l'ordre des blocs/items du v2, avec la bonne cle", () => {
    const v2 = buildRealisticV2();
    const snapshot = buildPrescribedSnapshot(v2, {
      sessionId: "sess-1",
      launchedAtISO: "2026-07-25T10:00:00.000Z",
    });

    expect(snapshot.sessionId).toBe("sess-1");
    expect(snapshot.launchedAtISO).toBe("2026-07-25T10:00:00.000Z");
    expect(snapshot.generatedAtISO).toBeNull();
    expect(snapshot.cycleGoal).toBeNull();
    expect(snapshot.sessionIndex).toBeNull();
    expect(snapshot.phase).toBeNull();
    expect(snapshot.matchContext).toBe("unknown");
    expect(snapshot.plannedDurationMin).toBe(55);
    expect(snapshot.rpeTarget).toBe(6);
    expect(snapshot.intensity).toBe("moderate");
    expect(snapshot.focusPrimary).toBe("strength");

    expect(snapshot.items).toHaveLength(3);
    expect(snapshot.items.map((i) => i.key)).toEqual(["0-0", "1-0", "1-1"]);
    expect(snapshot.items.map((i) => i.exerciseId)).toEqual([
      "wu_hip_circle",
      "str_squat_bodyweight",
      "str_lunge_bodyweight",
    ]);

    const mainItem = snapshot.items[1];
    expect(mainItem.blockId).toBe("strength_main");
    expect(mainItem.blockIndex).toBe(1);
    expect(mainItem.itemIndex).toBe(0);
    expect(mainItem.blockType).toBe("strength");
    expect(mainItem.sets).toBe(4);
    expect(mainItem.reps).toBe(8);
    expect(mainItem.restS).toBe(90);
    expect(mainItem.notes).toBe("Charge : monte tant que la technique reste propre.");
    expect(mainItem.role).toBeNull();
  });

  it("reprend toutes les metadonnees fournies", () => {
    const v2 = buildRealisticV2();
    const snapshot = buildPrescribedSnapshot(v2, {
      sessionId: "sess-2",
      launchedAtISO: "2026-07-25T10:00:00.000Z",
      generatedAtISO: "2026-07-25T09:55:00.000Z",
      cycleGoal: "force",
      sessionIndex: 4,
      phase: "Progression",
      matchContext: "match_in_two_days",
    });

    expect(snapshot.generatedAtISO).toBe("2026-07-25T09:55:00.000Z");
    expect(snapshot.cycleGoal).toBe("force");
    expect(snapshot.sessionIndex).toBe(4);
    expect(snapshot.phase).toBe("Progression");
    expect(snapshot.matchContext).toBe("match_in_two_days");
  });

  it("reste tolerant sur un v2 minimal troue : items vides, champs null", () => {
    const v2 = buildMinimalV2();
    const snapshot = buildPrescribedSnapshot(v2, {
      sessionId: "sess-3",
      launchedAtISO: "2026-07-25T10:00:00.000Z",
    });

    expect(snapshot.items).toEqual([]);
    expect(snapshot.plannedDurationMin).toBe(20);
    expect(snapshot.rpeTarget).toBe(4);
  });

  it("fabrique un exerciseId stable quand exerciseId/id sont absents (aligne transform.ts)", () => {
    const v2: FKS_NextSessionV2 = {
      version: "fks.next_session.v2",
      title: "Seance",
      intensity: "easy",
      focusPrimary: "core",
      durationMin: 15,
      rpeTarget: 3,
      blocks: [
        {
          id: "core_block",
          type: "core",
          goal: "gainage",
          intensity: "easy",
          durationMin: 10,
          items: [{ name: "Gainage ventral", sets: 3, reps: 30 }],
        },
      ],
    };

    const snapshot = buildPrescribedSnapshot(v2, {
      sessionId: "sess-4",
      launchedAtISO: "2026-07-25T10:00:00.000Z",
    });

    expect(snapshot.items[0].exerciseId).toBe("core_block_0_0");
  });
});
