// state/orchestrators/__tests__/markSessionNotDone.test.ts
//
// « JE NE L'AI PAS FAITE » — les trois règles actées (décision Kyllian 15/08),
// EXÉCUTÉES sur les vrais stores :
//  1. AUCUNE charge : ATL/CTL/TSB et dailyApplied strictement intacts.
//  2. Archivée, pas effacée : notDone + notDoneAt posés, completed inchangé,
//     la séance reste dans le store (historique « Pas faite »).
//  3. Ne bloque plus rien : selectPendingSession ne la retient plus → CTA du
//     Home et génération libérés (ils passent tous par ce sélecteur).
// La persistance Firestore est stubbée (hors réseau), comme applyFeedback.test.

jest.mock("../../../services/plannedSessionsRepo", () => ({
  markPlannedSessionNotDone: jest.fn().mockResolvedValue(undefined),
}));

import { markSessionNotDone } from "../markSessionNotDone";
import { useSessionsStore } from "../../stores/useSessionsStore";
import { useLoadStore } from "../../stores/useLoadStore";
import { markPlannedSessionNotDone } from "../../../services/plannedSessionsRepo";
import { selectPendingSession } from "../../../utils/sessionHelpers";
import type { Session } from "../../../domain/types";

const TODAY = "2026-04-20";

const makeSession = (over: Partial<Session> = {}): Session =>
  ({
    id: "s1",
    dateISO: `${TODAY}T00:00:00.000Z`,
    date: TODAY,
    focus: "strength",
    phase: "Construction",
    intensity: "moderate",
    volumeScore: 50,
    exercises: [],
    completed: false,
    ...over,
  } as Session);

const flushMicrotasks = () => new Promise<void>((r) => setTimeout(r, 0));

describe("markSessionNotDone — archive sans charge, libère la suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionsStore.setState({ sessions: [makeSession()] });
  });

  test("règle 1 — ATL/CTL/TSB et dailyApplied ne bougent PAS", async () => {
    // Le seed du store (beforeEach) déclenche le rebuildLoad ambiant, qui sème
    // son amorce — comportement pré-existant, hors sujet ici. On laisse ce
    // bruit se poser AVANT la photo : ce test mesure l'effet de
    // markSessionNotDone seul, qui doit être exactement nul sur la charge.
    await flushMicrotasks();
    const avant = useLoadStore.getState();
    const photo = {
      atl: avant.atl,
      ctl: avant.ctl,
      tsb: avant.tsb,
      tsbHistory: [...(avant.tsbHistory ?? [])],
      dailyApplied: { ...(avant.dailyApplied ?? {}) },
    };

    expect(markSessionNotDone("s1")).toBe(true);
    await flushMicrotasks();

    const apres = useLoadStore.getState();
    expect(apres.atl).toBe(photo.atl);
    expect(apres.ctl).toBe(photo.ctl);
    expect(apres.tsb).toBe(photo.tsb);
    expect(apres.tsbHistory ?? []).toEqual(photo.tsbHistory);
    expect(apres.dailyApplied ?? {}).toEqual(photo.dailyApplied);
  });

  test("règle 2 — archivée, pas effacée : notDone posé, completed inchangé", () => {
    markSessionNotDone("s1");
    const s = useSessionsStore.getState().sessions.find((x) => x.id === "s1");
    expect(s).toBeDefined();
    expect(s!.notDone).toBe(true);
    expect(typeof s!.notDoneAt).toBe("string");
    expect(s!.completed).toBeFalsy();
    expect(s!.feedback).toBeUndefined(); // aucun RPE inventé
  });

  test("règle 3 — le sélecteur de séance en attente la lâche immédiatement", () => {
    // Sanity : avant, elle bloque (c'est exactement le scénario P1-08).
    expect(selectPendingSession(useSessionsStore.getState().sessions, TODAY)?.id).toBe("s1");
    markSessionNotDone("s1");
    expect(selectPendingSession(useSessionsStore.getState().sessions, TODAY)).toBeUndefined();
  });

  test("le marqueur serveur part en fire-and-forget", async () => {
    markSessionNotDone("s1");
    await flushMicrotasks();
    expect(markPlannedSessionNotDone).toHaveBeenCalledTimes(1);
    expect(markPlannedSessionNotDone).toHaveBeenCalledWith("s1");
  });

  test("idempotent — le second appel ne fait rien de plus", async () => {
    expect(markSessionNotDone("s1")).toBe(true);
    expect(markSessionNotDone("s1")).toBe(false);
    await flushMicrotasks();
    expect(markPlannedSessionNotDone).toHaveBeenCalledTimes(1);
  });

  test("une séance complétée refuse — le feedback a gagné", async () => {
    useSessionsStore.setState({ sessions: [makeSession({ completed: true })] });
    expect(markSessionNotDone("s1")).toBe(false);
    await flushMicrotasks();
    expect(markPlannedSessionNotDone).not.toHaveBeenCalled();
  });

  test("une séance inconnue refuse sans rien toucher", () => {
    expect(markSessionNotDone("fantome")).toBe(false);
    expect(useSessionsStore.getState().sessions).toHaveLength(1);
  });
});
