// screens/feedback/__tests__/useFeedbackSave.test.tsx
// Tests d'integration legers du hook useFeedbackSave (Lot 4) : idempotence
// dure (double-tap), dedup offline, attachement de l'executionSummary.
// Harness minimal via react-test-renderer (aucune librairie de test de hooks
// dediee disponible dans ce repo — jest.worktree.config.js supporte deja les
// .test.tsx, cf. son commentaire).
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

// services/analytics.ts importe @amplitude/analytics-react-native dont la
// copie imbriquee d'AsyncStorage accede au module natif au simple import
// (jest.setup.js ne mocke que le paquet top-level) -> crash hors reseau.
// useFeedbackSave.ts importe trackEvent : mock local pour rester hors chaine.
jest.mock("../../../services/analytics", () => ({
  trackEvent: jest.fn(),
  initAnalytics: jest.fn(),
  setAnalyticsUserId: jest.fn(),
}));

jest.mock("../../../state/orchestrators/applyFeedback", () => ({
  applyFeedback: jest.fn(),
}));

import { applyFeedback } from "../../../state/orchestrators/applyFeedback";
import { useFeedbackSave } from "../hooks/useFeedbackSave";
import { useLoadStore } from "../../../state/stores/useLoadStore";
import { useSessionsStore } from "../../../state/stores/useSessionsStore";
import { useFeedbackStore } from "../../../state/stores/useFeedbackStore";
import { useExecutionStore } from "../../../state/stores/useExecutionStore";
import { getQueue, clearQueue } from "../../../utils/offlineQueue";
import { useBodyStore } from "../../../state/stores/useBodyStore";
import { ajouterGene } from "../../../hooks/monCorps/monCorpsActions";
import type { PrescribedItem, PrescribedSnapshot, SessionExecution } from "../../../domain/tracking/types";

const mockApplyFeedback = applyFeedback as jest.Mock;

function makePrescribedItem(index: number): PrescribedItem {
  return {
    key: `0-${index}`, exerciseId: `ex_${index}`, name: `Exercice ${index}`,
    blockId: "block", blockIndex: 0, itemIndex: index, blockType: "strength",
    role: null, sets: 3, reps: 8, workS: null, restS: 60, durationMin: null, notes: null,
  };
}

function makeSnapshot(): PrescribedSnapshot {
  return {
    sessionId: "s1", fingerprint: "fp-1", generatedAtISO: null,
    launchedAtISO: "2026-07-25T09:00:00.000Z", cycleGoal: "force", sessionIndex: 3,
    phase: "Progression", matchContext: "none", plannedDurationMin: 55, rpeTarget: 6,
    intensity: "moderate", focusPrimary: "strength", items: [makePrescribedItem(0), makePrescribedItem(1)],
  };
}

function makeFinishedExecution(): SessionExecution {
  return {
    version: 1, sessionId: "s1", fingerprint: "fp-1", snapshot: makeSnapshot(),
    items: [
      { key: "0-0", status: "done", reason: null, comment: null, actual: null, replacement: null, setsChecked: 3, setsTotal: 3 },
      { key: "0-1", status: "done", reason: null, comment: null, actual: null, replacement: null, setsChecked: 3, setsTotal: 3 },
    ],
    startedAtISO: "2026-07-25T09:00:00.000Z", finishedAtISO: "2026-07-25T10:00:00.000Z",
    actualDurationMin: 55, allAsPlanned: true,
    completion: { pct: 100, done: 2, adapted: 0, skipped: 0, replacedEquivalent: 0, replacedPartial: 0, status: "full", mainReasons: [] },
  };
}

const baseParams = {
  targetSessionId: "s1",
  targetSession: { id: "s1", completed: false, exercises: [], durationMin: 55 },
  sessionDateKey: "2026-07-25",
  todayKey: "2026-07-25",
  canSaveToday: true,
  rpe: 6,
  fatigue: 3,
  pain: 0,
  recovery: 3,
  durationClamped: 55,
  durationInvalid: false,
  navigation: { dispatch: jest.fn(), navigate: jest.fn(), goBack: jest.fn() },
  haptics: { success: jest.fn(), warning: jest.fn() },
};

/** Harness : monte le hook, expose la derniere API via un callback. */
function Harness({ params, onReady }: { params: any; onReady: (api: ReturnType<typeof useFeedbackSave>) => void }) {
  const api = useFeedbackSave(params);
  onReady(api);
  return null;
}

async function renderHarness(params: any) {
  let api: ReturnType<typeof useFeedbackSave> | null = null;
  await act(async () => {
    TestRenderer.create(<Harness params={params} onReady={(a) => { api = a; }} />);
  });
  return () => api as ReturnType<typeof useFeedbackSave>;
}

beforeEach(async () => {
  mockApplyFeedback.mockReset();
  await clearQueue();
  useLoadStore.setState({ atl: 10, ctl: 10, tsb: 0 } as any);
  useSessionsStore.setState({ microcycleGoal: null, microcycleSessionIndex: 0, lastAiContext: undefined, activePathwayId: null, activePathwayIndex: 0 } as any);
  useFeedbackStore.setState({ dayStates: {} } as any);
  useExecutionStore.getState().resetAll();
  useBodyStore.setState({ bodyInjuries: [], migrationFeedbackAt: null } as any);
});

describe("useFeedbackSave — idempotence dure (Lot 4)", () => {
  test("deux onSave() rapproches ne produisent qu'UN seul applyFeedback", async () => {
    mockApplyFeedback.mockReturnValue({ sessionId: "s1", dateISO: "2026-07-25", rpe: 6, atlDelta: 0, ctlDelta: 0 });
    const getApi = await renderHarness(baseParams);

    await act(async () => {
      await Promise.all([getApi().onSave(), getApi().onSave()]);
    });

    expect(mockApplyFeedback).toHaveBeenCalledTimes(1);
  });

  test("un troisieme appel APRES la fin du premier peut de nouveau proceder (verrou libere en finally)", async () => {
    mockApplyFeedback.mockReturnValue({ sessionId: "s1", dateISO: "2026-07-25", rpe: 6, atlDelta: 0, ctlDelta: 0 });
    const getApi = await renderHarness(baseParams);

    await act(async () => {
      await getApi().onSave();
    });
    expect(mockApplyFeedback).toHaveBeenCalledTimes(1);

    // Deuxieme séance distincte : le verrou du premier appel est bien retombe.
    mockApplyFeedback.mockClear();
    const getApi2 = await renderHarness({ ...baseParams, targetSessionId: "s2", targetSession: { id: "s2", completed: false, exercises: [] } });
    await act(async () => {
      await getApi2().onSave();
    });
    expect(mockApplyFeedback).toHaveBeenCalledTimes(1);
  });
});

describe("useFeedbackSave — dedup offline (Lot 4)", () => {
  test("deux echecs reseau successifs sur la meme seance -> une SEULE action en queue", async () => {
    mockApplyFeedback.mockImplementation(() => {
      throw new Error("Network request failed");
    });

    const getApi1 = await renderHarness(baseParams);
    await act(async () => {
      await getApi1().onSave();
    });
    expect(await getQueue()).toHaveLength(1);

    // Deuxieme tentative (nouveau montage, simule un deuxieme passage) : la
    // queue contient deja un feedback pour "s1" -> pas de doublon ajoute.
    const getApi2 = await renderHarness(baseParams);
    await act(async () => {
      await getApi2().onSave();
    });
    expect(await getQueue()).toHaveLength(1);
  });
});

describe("useFeedbackSave — executionSummary attache au feedback (Lot 4)", () => {
  test("sans execution en cours -> feedback envoye a applyFeedback SANS executionSummary (compat)", async () => {
    mockApplyFeedback.mockReturnValue({ sessionId: "s1", dateISO: "2026-07-25", rpe: 6, atlDelta: 0, ctlDelta: 0 });
    const getApi = await renderHarness(baseParams);

    await act(async () => {
      await getApi().onSave();
    });

    const [, fb] = mockApplyFeedback.mock.calls[0];
    expect(fb.executionSummary).toBeUndefined();
  });

  test("avec execution finalisee pour cette seance -> executionSummary attache au feedback envoye", async () => {
    mockApplyFeedback.mockReturnValue({ sessionId: "s1", dateISO: "2026-07-25", rpe: 6, atlDelta: 0, ctlDelta: 0 });
    useExecutionStore.getState().startExecution(makeFinishedExecution());

    const getApi = await renderHarness(baseParams);
    await act(async () => {
      await getApi().onSave();
    });

    const [, fb] = mockApplyFeedback.mock.calls[0];
    expect(fb.executionSummary).toEqual({
      completionPct: 100, completionStatus: "full", done: 2, adapted: 0, skipped: 0, replaced: 0,
      mainReasons: [], fingerprint: "fp-1",
    });
  });
});

// -----------------------------------------------------------------------------
// Passerelle « Mon corps » (décision D3, sentinelle §4.6 du design) : la
// proposition ne bloque RIEN — le feedback est déjà enregistré et la charge
// déjà appliquée quand la carte apparaît — et refuser (« Plus tard ») n'écrit
// rien. `hooks/__tests__/monCorpsViewModel.test.ts` couvre déjà la règle PURE
// du seuil ; ce qui manquait, c'est la preuve d'INTÉGRATION : l'ORDRE des
// opérations dans le hook réel.
// -----------------------------------------------------------------------------
describe("useFeedbackSave — passerelle « Mon corps » ne bloque jamais le feedback (D3)", () => {
  test("douleur 2/5 (sous le seuil) : pas de proposition, on repart tout de suite", async () => {
    mockApplyFeedback.mockReturnValue({ sessionId: "s1", dateISO: "2026-07-25", rpe: 6, atlDelta: 0, ctlDelta: 0 });
    const navigation = { dispatch: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
    const getApi = await renderHarness({ ...baseParams, pain: 2, navigation });

    await act(async () => {
      await getApi().onSave();
    });

    expect(mockApplyFeedback).toHaveBeenCalledTimes(1);
    expect(getApi().monCorpsPromptVisible).toBe(false);
    // Pas de carte à refuser : le retour à l'app est immédiat.
    expect(navigation.dispatch).toHaveBeenCalled();
  });

  test("douleur 4/5 (au-dessus du seuil) : le feedback est DÉJÀ appliqué quand la carte paraît", async () => {
    mockApplyFeedback.mockReturnValue({ sessionId: "s1", dateISO: "2026-07-25", rpe: 6, atlDelta: 0, ctlDelta: 0 });
    const navigation = { dispatch: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
    const getApi = await renderHarness({ ...baseParams, pain: 4, navigation });

    await act(async () => {
      await getApi().onSave();
    });

    // Le feedback est appliqué...
    expect(mockApplyFeedback).toHaveBeenCalledTimes(1);
    // ...et la carte paraît sans qu'on ait déjà quitté l'écran.
    expect(getApi().monCorpsPromptVisible).toBe(true);
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  test("« Plus tard » n'écrit RIEN : aucune gêne créée, le feedback déjà enregistré ne bouge pas", async () => {
    mockApplyFeedback.mockReturnValue({ sessionId: "s1", dateISO: "2026-07-25", rpe: 6, atlDelta: 0, ctlDelta: 0 });
    const navigation = { dispatch: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
    const getApi = await renderHarness({ ...baseParams, pain: 5, navigation });

    await act(async () => {
      await getApi().onSave();
    });
    expect(getApi().monCorpsPromptVisible).toBe(true);
    expect(useBodyStore.getState().bodyInjuries).toEqual([]);

    // « Plus tard » = continueAfterFeedback, exposé tel quel au bouton.
    await act(async () => {
      getApi().continueAfterFeedback();
    });

    // Une douleur non située reste non située.
    expect(useBodyStore.getState().bodyInjuries).toEqual([]);
    // Le feedback lui n'est PAS ré-appliqué par le refus de la carte.
    expect(mockApplyFeedback).toHaveBeenCalledTimes(1);
    expect(navigation.dispatch).toHaveBeenCalled();
  });

  test("une gêne active existe : la carte demande « toujours là ? », et répondre change son statut sans en créer une autre", async () => {
    mockApplyFeedback.mockReturnValue({ sessionId: "s1", dateISO: "2026-07-25", rpe: 6, atlDelta: 0, ctlDelta: 0 });
    const gene = ajouterGene({ zone: "genou", gravite: 2, source: "manual" });

    const navigation = { dispatch: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
    const getApi = await renderHarness({ ...baseParams, pain: 4, navigation });

    await act(async () => {
      await getApi().onSave();
    });

    expect(getApi().monCorpsPromptVisible).toBe(true);
    expect(getApi().zoneGeneEnCours).toBe("genou");

    await act(async () => {
      getApi().repondreSurGeneEnCours("recovering");
    });

    const injuries = useBodyStore.getState().bodyInjuries;
    expect(injuries).toHaveLength(1);
    expect(injuries[0].id).toBe(gene.id);
    expect(injuries[0].statut).toBe("recovering");
    // Le geste referme la carte et poursuit, comme "Plus tard".
    expect(navigation.dispatch).toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// P2 (round 2) : la 12e séance ne doit jamais escamoter la passerelle. Avant
// ce correctif, `shouldPromptCycleEnd` empruntait un `else if` qui rendait
// `doitProposerMonCorps` inatteignable dès qu'un cycle se terminait le même
// jour — une douleur ≥3/5 à la séance de fin de cycle n'était JAMAIS proposée.
// -----------------------------------------------------------------------------
describe("useFeedbackSave — fin de cycle (12e séance) n'escamote pas Mon corps (P2)", () => {
  test("douleur 3/5 à la 12e séance : les DEUX cartes apparaissent, aucune n'efface l'autre", async () => {
    mockApplyFeedback.mockReturnValue({ sessionId: "s1", dateISO: "2026-07-25", rpe: 6, atlDelta: 0, ctlDelta: 0 });
    useSessionsStore.setState({
      microcycleGoal: "force",
      microcycleSessionIndex: 11, // 12e séance (index 0-based) d'un cycle de 12
      lastAiContext: undefined,
      activePathwayId: null,
      activePathwayIndex: 0,
    } as any);
    const navigation = { dispatch: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
    const getApi = await renderHarness({ ...baseParams, pain: 3, navigation });

    await act(async () => {
      await getApi().onSave();
    });

    expect(mockApplyFeedback).toHaveBeenCalledTimes(1);
    expect(getApi().cyclePromptVisible).toBe(true);
    expect(getApi().monCorpsPromptVisible).toBe(true);
    // Pas d'auto-continuation qui ferait disparaître les cartes sans geste du joueur.
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  test("douleur 1/5 à la 12e séance : seule la carte cycle apparaît (comportement inchangé)", async () => {
    mockApplyFeedback.mockReturnValue({ sessionId: "s1", dateISO: "2026-07-25", rpe: 6, atlDelta: 0, ctlDelta: 0 });
    useSessionsStore.setState({
      microcycleGoal: "force",
      microcycleSessionIndex: 11,
      lastAiContext: undefined,
      activePathwayId: null,
      activePathwayIndex: 0,
    } as any);
    const getApi = await renderHarness({ ...baseParams, pain: 1 });

    await act(async () => {
      await getApi().onSave();
    });

    expect(getApi().cyclePromptVisible).toBe(true);
    expect(getApi().monCorpsPromptVisible).toBe(false);

    // Ce chemin arme le setTimeout(4500ms) d'auto-continuation existant. On le
    // désarme explicitement (au lieu d'attendre 4,5 s réelles ou de manipuler
    // l'horloge globale) : `continueAfterFeedback` annule le timer via
    // `clearAutoContinue()`, exactement comme le ferait le joueur en tapant
    // « Plus tard » sur la carte cycle.
    await act(async () => {
      getApi().continueAfterFeedback();
    });
  });
});
