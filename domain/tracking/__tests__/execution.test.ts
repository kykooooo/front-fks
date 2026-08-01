// domain/tracking/__tests__/execution.test.ts
import {
  applyReplacement,
  finalizeExecution,
  initExecution,
  markAllAsPlanned,
  setItemActual,
  setItemStatus,
  summarizeExecution,
  syncSetsFromLive,
} from "../execution";
import type { PrescribedItem, PrescribedSnapshot } from "../types";

function makeItem(index: number, overrides: Partial<PrescribedItem> = {}): PrescribedItem {
  return {
    key: `0-${index}`,
    exerciseId: `ex_${index}`,
    name: `Exercice ${index}`,
    blockId: "block",
    blockIndex: 0,
    itemIndex: index,
    blockType: "strength",
    role: null,
    sets: 3,
    reps: 8,
    workS: null,
    restS: 60,
    durationMin: null,
    notes: null,
    ...overrides,
  };
}

function makeSnapshot(
  count: number,
  overrides: (index: number) => Partial<PrescribedItem> = () => ({})
): PrescribedSnapshot {
  const items = Array.from({ length: count }, (_, i) => makeItem(i, overrides(i)));
  return {
    sessionId: "sess-test",
    fingerprint: "fp-test",
    generatedAtISO: null,
    launchedAtISO: "2026-07-25T10:00:00.000Z",
    cycleGoal: "force",
    sessionIndex: 3,
    phase: "Progression",
    matchContext: "none",
    plannedDurationMin: 55,
    rpeTarget: 6,
    intensity: "moderate",
    focusPrimary: "strength",
    items,
  };
}

describe("initExecution", () => {
  it("initialise tous les items en unknown, 0 serie cochee, setsTotal depuis sets (min 1)", () => {
    const snapshot = makeSnapshot(2, (i) => (i === 1 ? { sets: null } : { sets: 3 }));
    const exec = initExecution(snapshot, "2026-07-25T18:00:00.000Z");

    expect(exec.version).toBe(1);
    expect(exec.sessionId).toBe("sess-test");
    expect(exec.fingerprint).toBe("fp-test");
    expect(exec.startedAtISO).toBe("2026-07-25T18:00:00.000Z");
    expect(exec.finishedAtISO).toBeNull();
    expect(exec.allAsPlanned).toBe(false);
    expect(exec.items).toHaveLength(2);
    expect(exec.items[0]).toMatchObject({ key: "0-0", status: "unknown", setsChecked: 0, setsTotal: 3 });
    expect(exec.items[1]).toMatchObject({ key: "0-1", status: "unknown", setsChecked: 0, setsTotal: 1 });
  });
});

describe("setItemStatus / setItemActual / applyReplacement", () => {
  it("met a jour le statut d'un item existant de maniere immuable", () => {
    const exec = initExecution(makeSnapshot(2), "2026-07-25T18:00:00.000Z");
    const next = setItemStatus(exec, "0-0", "adapted", "time", "raccourci");

    expect(next).not.toBe(exec);
    expect(next.items[0]).toMatchObject({ status: "adapted", reason: "time", comment: "raccourci" });
    expect(exec.items[0].status).toBe("unknown"); // l'original reste inchange
  });

  it("ne fait rien sur une cle inconnue (no-op, meme reference retournee)", () => {
    const exec = initExecution(makeSnapshot(1), "2026-07-25T18:00:00.000Z");
    expect(setItemStatus(exec, "9-9", "done")).toBe(exec);
    expect(setItemActual(exec, "9-9", { reps: 10 })).toBe(exec);
  });

  it("renseigne actual sans toucher au statut", () => {
    const exec = initExecution(makeSnapshot(1), "2026-07-25T18:00:00.000Z");
    const next = setItemActual(exec, "0-0", { loadKg: 40, reps: 8 });
    expect(next.items[0].actual).toEqual({ loadKg: 40, reps: 8 });
    expect(next.items[0].status).toBe("unknown");
  });

  it("applyReplacement bascule le statut sur replaced avec le detail complet", () => {
    const exec = initExecution(makeSnapshot(1), "2026-07-25T18:00:00.000Z");
    const replacement = {
      originalExerciseId: "ex_0",
      replacementExerciseId: "ex_alt",
      reason: "equipment",
      equivalent: true,
      prescription: { sets: 3, reps: 8, durationS: null, restS: 60, note: null },
    } as const;

    const next = applyReplacement(exec, "0-0", replacement);
    expect(next.items[0].status).toBe("replaced");
    expect(next.items[0].reason).toBe("equipment");
    expect(next.items[0].replacement).toEqual(replacement);
  });

  it("applyReplacement ne fait rien sur une cle inconnue", () => {
    const exec = initExecution(makeSnapshot(1), "2026-07-25T18:00:00.000Z");
    const replacement = {
      originalExerciseId: "ex_0",
      replacementExerciseId: "ex_alt",
      reason: "equipment",
      equivalent: true,
      prescription: { sets: 3, reps: 8, durationS: null, restS: 60, note: null },
    } as const;
    expect(applyReplacement(exec, "9-9", replacement)).toBe(exec);
  });
});

describe("syncSetsFromLive", () => {
  it("bascule un item unknown en done quand toutes les series sont cochees", () => {
    const snapshot = makeSnapshot(1, () => ({ sets: 3 }));
    const exec = initExecution(snapshot, "2026-07-25T18:00:00.000Z");
    const next = syncSetsFromLive(exec, { "0-0": [true, true, true] });
    expect(next.items[0].setsChecked).toBe(3);
    expect(next.items[0].status).toBe("done");
  });

  it("laisse le statut unknown si toutes les series ne sont pas cochees", () => {
    const snapshot = makeSnapshot(1, () => ({ sets: 3 }));
    const exec = initExecution(snapshot, "2026-07-25T18:00:00.000Z");
    const next = syncSetsFromLive(exec, { "0-0": [true, false, true] });
    expect(next.items[0].setsChecked).toBe(2);
    expect(next.items[0].status).toBe("unknown");
  });

  it("ne touche pas un item deja adapte/saute/remplace meme si toutes les series sont cochees", () => {
    const snapshot = makeSnapshot(1, () => ({ sets: 2 }));
    let exec = initExecution(snapshot, "2026-07-25T18:00:00.000Z");
    exec = setItemStatus(exec, "0-0", "skipped", "time");
    const next = syncSetsFromLive(exec, { "0-0": [true, true] });
    expect(next.items[0].status).toBe("skipped");
  });

  it("ignore les entrees mal formees / objet vide sans planter (no-op)", () => {
    const exec = initExecution(makeSnapshot(1), "2026-07-25T18:00:00.000Z");
    expect(syncSetsFromLive(exec, {})).toBe(exec);

    const malformed = { "0-0": "not-an-array" } as unknown as Record<string, boolean[]>;
    expect(() => syncSetsFromLive(exec, malformed)).not.toThrow();
    expect(syncSetsFromLive(exec, malformed)).toBe(exec);

    const nullish = null as unknown as Record<string, boolean[]>;
    expect(() => syncSetsFromLive(exec, nullish)).not.toThrow();
    expect(syncSetsFromLive(exec, nullish)).toBe(exec);
  });
});

describe("markAllAsPlanned", () => {
  it("bascule uniquement les items unknown en done, garde les autres statuts, allAsPlanned=true", () => {
    const snapshot = makeSnapshot(3);
    let exec = initExecution(snapshot, "2026-07-25T18:00:00.000Z");
    exec = setItemStatus(exec, "0-1", "skipped", "time");

    const next = markAllAsPlanned(exec);
    expect(next.allAsPlanned).toBe(true);
    expect(next.items[0].status).toBe("done");
    expect(next.items[1].status).toBe("skipped"); // inchange
    expect(next.items[2].status).toBe("done");
  });
});

describe("finalizeExecution — completion", () => {
  it("100% : tout fait -> full", () => {
    const snapshot = makeSnapshot(8);
    let exec = initExecution(snapshot, "2026-07-25T18:00:00.000Z");
    for (let i = 0; i < 8; i++) exec = setItemStatus(exec, `0-${i}`, "done");

    const finalized = finalizeExecution(exec, "2026-07-25T19:00:00.000Z", 55);
    expect(finalized.completion.pct).toBe(100);
    expect(finalized.completion.status).toBe("full");
    expect(finalized.completion.done).toBe(8);
    expect(finalized.finishedAtISO).toBe("2026-07-25T19:00:00.000Z");
    expect(finalized.actualDurationMin).toBe(55);
  });

  it("7 faits sur 8, 1 saute -> 88% partial (valeur exacte, pas juste '<90')", () => {
    const snapshot = makeSnapshot(8);
    let exec = initExecution(snapshot, "2026-07-25T18:00:00.000Z");
    for (let i = 0; i < 7; i++) exec = setItemStatus(exec, `0-${i}`, "done");
    exec = setItemStatus(exec, "0-7", "skipped", "time");

    const finalized = finalizeExecution(exec, "2026-07-25T19:00:00.000Z", 50);
    expect(finalized.completion.pct).toBe(88); // Math.round(7/8*100) = Math.round(87.5) = 88
    expect(finalized.completion.status).toBe("partial");
    expect(finalized.completion.done).toBe(7);
    expect(finalized.completion.skipped).toBe(1);
  });

  it("2 faits sur 8, le reste saute -> 25% abandoned (< 40)", () => {
    const snapshot = makeSnapshot(8);
    let exec = initExecution(snapshot, "2026-07-25T18:00:00.000Z");
    exec = setItemStatus(exec, "0-0", "done");
    exec = setItemStatus(exec, "0-1", "done");
    for (let i = 2; i < 8; i++) exec = setItemStatus(exec, `0-${i}`, "skipped", "fatigue");

    const finalized = finalizeExecution(exec, "2026-07-25T19:00:00.000Z", 15);
    expect(finalized.completion.pct).toBe(25);
    expect(finalized.completion.status).toBe("abandoned");
  });

  it("remplacement equivalent (poids 1) vs partiel (poids 0.5) dans le pct", () => {
    const snapshot = makeSnapshot(4);
    let exec = initExecution(snapshot, "2026-07-25T18:00:00.000Z");
    exec = setItemStatus(exec, "0-0", "done");
    exec = applyReplacement(exec, "0-1", {
      originalExerciseId: "ex_1",
      replacementExerciseId: "ex_1_alt",
      reason: "equipment",
      equivalent: true,
      prescription: { sets: 3, reps: 8, durationS: null, restS: 60, note: null },
    });
    exec = applyReplacement(exec, "0-2", {
      originalExerciseId: "ex_2",
      replacementExerciseId: "ex_2_alt",
      reason: "equipment",
      equivalent: false,
      prescription: { sets: 3, reps: 8, durationS: null, restS: 60, note: null },
    });
    exec = setItemStatus(exec, "0-3", "skipped", "time");

    const finalized = finalizeExecution(exec, "2026-07-25T19:00:00.000Z", 40);
    // weightedSum = 1 (done) + 1 (replacedEquivalent) + 0.5 (replacedPartial) + 0 (skipped) = 2.5
    // pct = Math.round(2.5 / 4 * 100) = Math.round(62.5) = 63
    expect(finalized.completion.pct).toBe(63);
    expect(finalized.completion.status).toBe("partial");
    expect(finalized.completion.replacedEquivalent).toBe(1);
    expect(finalized.completion.replacedPartial).toBe(1);
  });

  it("mainReasons retient les 3 raisons les plus frequentes, triees par frequence decroissante", () => {
    const snapshot = makeSnapshot(10);
    let exec = initExecution(snapshot, "2026-07-25T18:00:00.000Z");
    // 4x time, 3x pain, 2x equipment, 1x technical (frequences strictement decroissantes,
    // pas d'ambiguite de tri).
    for (let i = 0; i < 4; i++) exec = setItemStatus(exec, `0-${i}`, "skipped", "time");
    for (let i = 4; i < 7; i++) exec = setItemStatus(exec, `0-${i}`, "adapted", "pain");
    exec = applyReplacement(exec, "0-7", {
      originalExerciseId: "ex_7",
      replacementExerciseId: "ex_7_alt",
      reason: "equipment",
      equivalent: true,
      prescription: { sets: null, reps: null, durationS: null, restS: null, note: null },
    });
    exec = applyReplacement(exec, "0-8", {
      originalExerciseId: "ex_8",
      replacementExerciseId: "ex_8_alt",
      reason: "equipment",
      equivalent: true,
      prescription: { sets: null, reps: null, durationS: null, restS: null, note: null },
    });
    exec = setItemStatus(exec, "0-9", "adapted", "technical");

    const finalized = finalizeExecution(exec, "2026-07-25T19:00:00.000Z", 30);
    expect(finalized.completion.mainReasons).toEqual(["time", "pain", "equipment"]);
  });

  it("est idempotent : un deuxieme appel sur une execution deja finalisee ne change rien (meme reference)", () => {
    const snapshot = makeSnapshot(2);
    let exec = initExecution(snapshot, "2026-07-25T18:00:00.000Z");
    exec = setItemStatus(exec, "0-0", "done");
    exec = setItemStatus(exec, "0-1", "done");

    const finalized = finalizeExecution(exec, "2026-07-25T19:00:00.000Z", 40);
    const secondCall = finalizeExecution(finalized, "2026-07-25T20:00:00.000Z", 999);

    expect(secondCall).toBe(finalized);
    expect(secondCall.finishedAtISO).toBe("2026-07-25T19:00:00.000Z");
    expect(secondCall.actualDurationMin).toBe(40);
  });
});

describe("summarizeExecution", () => {
  it("resume la completion pour le feedback enrichi", () => {
    const snapshot = makeSnapshot(4);
    let exec = initExecution(snapshot, "2026-07-25T18:00:00.000Z");
    exec = setItemStatus(exec, "0-0", "done");
    exec = setItemStatus(exec, "0-1", "adapted", "pain");
    exec = setItemStatus(exec, "0-2", "skipped", "time");
    exec = applyReplacement(exec, "0-3", {
      originalExerciseId: "ex_3",
      replacementExerciseId: "ex_3_alt",
      reason: "equipment",
      equivalent: false,
      prescription: { sets: null, reps: null, durationS: null, restS: null, note: null },
    });

    const finalized = finalizeExecution(exec, "2026-07-25T19:00:00.000Z", 45);
    const summary = summarizeExecution(finalized);

    expect(summary.done).toBe(1);
    expect(summary.adapted).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.replaced).toBe(1);
    expect(summary.fingerprint).toBe("fp-test");
    expect(summary.completionStatus).toBe(finalized.completion.status);
    expect(summary.completionPct).toBe(finalized.completion.pct);
  });
});
