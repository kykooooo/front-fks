// state/orchestrators/__tests__/resetUser.test.ts
//
// AUDIT P0-2 — boot = wipe-puis-restore avec courses laissant le wipe sans
// restauration. Course 1 (rejouée ici) : resetForUser(null) se gare sur
// `await saveSnapshot` avant d'avoir écrit `_currentUid = null` ; l'auth
// résout dans la fenêtre → resetForUser(uid) lit `_currentUid === uid` →
// early return → restauration jamais faite, le wipe finit seul (stores vidés,
// snapshot intact, utilisateur connecté).
// Le fix sérialise les resets (file de promesses) et relit `_currentUid` au
// moment où chaque reset démarre réellement.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { resetForUser } from "../resetUser";
import { useSyncStore, resetWatchGuard, reactivateListeners } from "../../stores/useSyncStore";
import { useSessionsStore, getSessionsDefaults } from "../../stores/useSessionsStore";
import { useLoadStore, getLoadDefaults } from "../../stores/useLoadStore";
import type { Session } from "../../../domain/types";

const SNAPSHOT_A = "fks-snapshot-v2-uid-A";
const SNAPSHOT_B = "fks-snapshot-v2-uid-B";

const doneSession = (id: string): Session =>
  ({
    id,
    date: "2026-07-16",
    dateISO: "2026-07-16T10:00:00.000Z",
    focus: "strength",
    phase: "Construction",
    intensity: "moderate",
    volumeScore: 50,
    exercises: [],
    completed: true,
    rpe: 7,
  } as Session);

/** Peuple les stores comme si uid-A était connecté avec de la progression. */
function seedUserA() {
  useSessionsStore.setState({
    ...getSessionsDefaults(),
    sessions: [doneSession("sA")],
    microcycleGoal: "force",
    microcycleSessionIndex: 5,
  } as any);
  useLoadStore.setState({ ...getLoadDefaults(), atl: 100, ctl: 90, tsb: -10 } as any);
  useSyncStore.setState({
    _currentUid: "uid-A",
    _rehydrating: false,
    storeHydrated: true,
    _unsubAuth: undefined,
    _unsubSessions: undefined,
    _unsubPlanned: undefined,
    _unsubProfile: undefined,
  } as any);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetWatchGuard();
  reactivateListeners();
  useSessionsStore.setState({ ...getSessionsDefaults() } as any);
  useLoadStore.setState({ ...getLoadDefaults() } as any);
  useSyncStore.setState({
    _currentUid: null,
    _rehydrating: false,
    storeHydrated: true,
    _unsubAuth: undefined,
    _unsubSessions: undefined,
    _unsubPlanned: undefined,
    _unsubProfile: undefined,
  } as any);
});

describe("resetForUser — sérialisation (P0-2, course 1)", () => {
  test("REPRO AUDIT : wipe(null) + restore(uid) concurrents → la restauration gagne", async () => {
    seedUserA();

    // Boot : l'appel n°1 (null) démarre AVANT la résolution auth ; l'auth
    // résout pendant sa fenêtre d'awaits → appel n°2 (uid) concurrent.
    const p1 = resetForUser(null);
    const p2 = resetForUser("uid-A");
    await Promise.all([p1, p2]);

    // Avant le fix : p2 early-return (lisait encore _currentUid === "uid-A"),
    // p1 finissait le wipe → sessions [], atl 0, utilisateur pourtant connecté.
    expect(useSyncStore.getState()._currentUid).toBe("uid-A");
    expect(useSessionsStore.getState().sessions).toHaveLength(1);
    expect(useSessionsStore.getState().sessions[0]?.id).toBe("sA");
    expect(useSessionsStore.getState().microcycleSessionIndex).toBe(5);
    expect(useLoadStore.getState().atl).toBe(100);
  });

  test("trois resets concurrents (null → uid → null) s'exécutent dans l'ordre, sans perte", async () => {
    seedUserA();

    await Promise.all([resetForUser(null), resetForUser("uid-A"), resetForUser(null)]);

    // Dernier mot au logout final : stores vidés, mais le snapshot de uid-A
    // contient bien la progression (re-sauvegardée depuis l'état restauré).
    expect(useSyncStore.getState()._currentUid).toBeNull();
    expect(useSessionsStore.getState().sessions).toHaveLength(0);
    const raw = await AsyncStorage.getItem(SNAPSHOT_A);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).sessions.sessions).toHaveLength(1);
  });
});

describe("resetForUser — déroulés nominaux", () => {
  test("boot même uid : no-op (aucun wipe, stores intacts)", async () => {
    seedUserA();

    await resetForUser("uid-A");

    expect(useSyncStore.getState()._currentUid).toBe("uid-A");
    expect(useSessionsStore.getState().sessions).toHaveLength(1);
    expect(useLoadStore.getState().atl).toBe(100);
    // Pas de snapshot écrit : le reset a early-return.
    expect(await AsyncStorage.getItem(SNAPSHOT_A)).toBeNull();
  });

  test("vrai logout : wipe + snapshot du sortant sauvegardé", async () => {
    seedUserA();

    await resetForUser(null);

    expect(useSyncStore.getState()._currentUid).toBeNull();
    expect(useSessionsStore.getState().sessions).toHaveLength(0);
    expect(useLoadStore.getState().atl).toBe(getLoadDefaults().atl);

    const raw = await AsyncStorage.getItem(SNAPSHOT_A);
    expect(raw).toBeTruthy();
    const snap = JSON.parse(raw as string);
    expect(snap.sessions.sessions[0].id).toBe("sA");
    expect(snap.sessions.microcycleSessionIndex).toBe(5);
    expect(snap.load.atl).toBe(100);
  });

  test("changement d'utilisateur : snapshot de A sauvegardé, snapshot de B restauré", async () => {
    await AsyncStorage.setItem(
      SNAPSHOT_B,
      JSON.stringify({
        load: { atl: 55, ctl: 60, tsb: 5 },
        sessions: { sessions: [doneSession("sB")], microcycleSessionIndex: 3, microcycleGoal: "endurance" },
        feedback: {},
        external: {},
        debug: {},
        sync: { plannedFksDays: [] },
      })
    );
    seedUserA();

    await resetForUser("uid-B");

    expect(useSyncStore.getState()._currentUid).toBe("uid-B");
    expect(useSessionsStore.getState().sessions.map((s) => s.id)).toEqual(["sB"]);
    expect(useSessionsStore.getState().microcycleSessionIndex).toBe(3);
    expect(useLoadStore.getState().atl).toBe(55);
    // Les données de A n'ont pas fui chez B, elles sont dans SON snapshot.
    expect(await AsyncStorage.getItem(SNAPSHOT_A)).toBeTruthy();
  });

  test("nouvel utilisateur sans snapshot : stores aux valeurs par défaut", async () => {
    seedUserA();

    await resetForUser("uid-C");

    expect(useSyncStore.getState()._currentUid).toBe("uid-C");
    expect(useSessionsStore.getState().sessions).toHaveLength(0);
    expect(useSessionsStore.getState().microcycleSessionIndex).toBe(0);
  });
});
