// services/__tests__/notificationSync.test.ts
//
// LA COORDINATION DES RAPPELS, EXÉCUTÉE AVEC DES PROMESSES CONTRÔLÉES.
//
// Deux étages :
//  A. le coordinateur seul (`createNotificationSync`) avec un service factice
//     dont chaque appel est une promesse qu'on résout À LA MAIN — pour prouver
//     qu'une opération périmée n'écrit jamais, quel que soit l'ordre d'arrivée ;
//  B. le coordinateur + le VRAI service (expo-notifications mocké) — pour
//     prouver ce que contient le planificateur à la fin : démarrage OFF avec
//     d'anciens rappels, token qui ne répond jamais, déconnexion.

// ─── Mocks expo (étage B) ───────────────────────────────────────────────────
const mockNotif = {
  permission: "granted" as "granted" | "denied" | "undetermined",
  scheduled: [] as Array<{ type: string }>,
  tokenPending: false,
  tokenWaiters: [] as Array<(v: { data: string }) => void>,
  requested: 0,
  suspendreProchainSchedule: false,
  scheduleSuspendu: null as null | (() => void),
};

jest.mock("expo-notifications", () => ({
  __esModule: true,
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: mockNotif.permission })),
  requestPermissionsAsync: jest.fn(async () => {
    mockNotif.requested += 1;
    return { status: mockNotif.permission === "denied" ? "denied" : "granted" };
  }),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getExpoPushTokenAsync: jest.fn(
    () =>
      new Promise<{ data: string }>((resolve) => {
        if (mockNotif.tokenPending) mockNotif.tokenWaiters.push(resolve);
        else resolve({ data: "ExponentPushToken[test]" });
      }),
  ),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {
    mockNotif.scheduled = [];
  }),
  // L'appel natif peut être SUSPENDU après son invocation (le rappel est
  // déjà « en vol » côté système) et libéré depuis le test.
  scheduleNotificationAsync: jest.fn(
    (req: any) =>
      new Promise<string>((resolve) => {
        const terminer = () => {
          mockNotif.scheduled.push({ type: req.content?.data?.type });
          resolve(`id-${mockNotif.scheduled.length}`);
        };
        if (mockNotif.suspendreProchainSchedule) {
          mockNotif.suspendreProchainSchedule = false;
          mockNotif.scheduleSuspendu = terminer;
        } else {
          terminer();
        }
      }),
  ),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: "daily", WEEKLY: "weekly", DATE: "date", TIME_INTERVAL: "timeInterval" },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "proj" } } } },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createNotificationSync,
  type NotificationSyncContext,
  type NotificationSyncService,
} from "../notificationSync";
import * as notifications from "../notifications";

/** Une promesse qu'on résout depuis le test. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// ═══════════════════════════════════════════════════════════════════════════
// A. LE COORDINATEUR, SERVICE FACTICE À PROMESSES CONTRÔLÉES
// ═══════════════════════════════════════════════════════════════════════════
describe("coordination — opérations périmées (service factice)", () => {
  type Appel = {
    prefs: notifications.NotificationPreferences;
    options: { requestPermission?: boolean; isStale?: () => boolean };
    d: ReturnType<typeof deferred<notifications.ApplyResult>>;
    /** Ce que le service factice ÉCRIRAIT si l'appel n'était pas périmé au moment de résoudre. */
    ecrit: boolean;
  };

  function harnais(ctxInitial: NotificationSyncContext) {
    let ctx = { ...ctxInitial };
    const appels: Appel[] = [];
    const planificateur = { contenu: null as null | notifications.NotificationPreferences };
    const tokenD = deferred<string | null>();
    const service: NotificationSyncService = {
      applyNotificationPreferences: (prefs, options = {}) => {
        const d = deferred<notifications.ApplyResult>();
        const appel: Appel = { prefs, options, d, ecrit: false };
        appels.push(appel);
        return d.promise;
      },
      registerPushTokenBestEffort: () => tokenD.promise,
      cancelAllScheduledQueued: async (options = {}) => {
        if (options.isStale?.()) return false;
        planificateur.contenu = { enabled: false, sessionReminder: false };
        return true;
      },
    };
    const sync = createNotificationSync({ readContext: () => ctx, service, log: () => undefined });
    /** Résout un appel comme le VRAI service le ferait : n'écrit que s'il n'est pas périmé. */
    const terminer = (appel: Appel) => {
      const stale = appel.options.isStale?.() ?? false;
      if (!stale) {
        appel.ecrit = true;
        planificateur.contenu = appel.prefs;
      }
      appel.d.resolve({
        permission: "granted",
        scheduled: { sessionReminder: appel.prefs.enabled && appel.prefs.sessionReminder, weeklyRecap: appel.prefs.enabled },
        stale,
      });
    };
    return { sync, appels, planificateur, tokenD, terminer, setCtx: (patch: Partial<NotificationSyncContext>) => { ctx = { ...ctx, ...patch }; } };
  }

  const connecteON: NotificationSyncContext = { authResolved: true, uid: "u1", notificationsEnabled: true, sessionReminders: true };

  test("auth pas encore résolue : on ne touche à rien (inconnu ≠ déconnecté)", async () => {
    const h = harnais({ ...connecteON, authResolved: false, uid: null });
    const r = await h.sync.reconcile();
    expect(r).toEqual({ status: "skipped", reason: "auth-unknown" });
    expect(h.appels).toHaveLength(0);
  });

  test("programmation en vol, puis OFF : la résolution tardive n'écrit pas, l'OFF reste posé", async () => {
    const h = harnais(connecteON);
    const p1 = h.sync.reconcile({ requestPermission: true }); // ON, en attente
    await flush();
    expect(h.appels).toHaveLength(1);

    h.setCtx({ notificationsEnabled: false, sessionReminders: false });
    const p2 = h.sync.reconcile(); // OFF
    await flush();
    expect(h.appels).toHaveLength(2);

    // L'OFF se termine d'abord, puis l'ancien ON arrive EN DERNIER.
    h.terminer(h.appels[1]);
    h.terminer(h.appels[0]);
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r2).toEqual({ status: "cancelled", reason: "disabled" });
    expect(r1).toEqual({ status: "skipped", reason: "stale" });
    expect(h.appels[0].ecrit).toBe(false);
    expect(h.planificateur.contenu).toEqual({ enabled: false, sessionReminder: false });
  });

  test("programmation en vol, puis déconnexion : rien n'est reposé", async () => {
    const h = harnais(connecteON);
    const p1 = h.sync.reconcile({ requestPermission: true });
    await flush();

    // Déconnexion : périmée AVANT le signOut (ce que fait Réglages), puis
    // l'état auth confirme et l'app réconcilie.
    h.sync.invalidate();
    h.setCtx({ uid: null });
    const p2 = h.sync.reconcile();
    await flush();

    h.terminer(h.appels[1]);
    h.terminer(h.appels[0]);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r2).toEqual({ status: "cancelled", reason: "signed-out" });
    expect(r1).toEqual({ status: "skipped", reason: "stale" });
    expect(h.appels[0].ecrit).toBe(false);
    expect(h.planificateur.contenu).toEqual({ enabled: false, sessionReminder: false });
  });

  test("changement de compte pendant une opération : seule la programmation du NOUVEAU compte compte", async () => {
    const h = harnais({ ...connecteON, sessionReminders: false });
    const p1 = h.sync.reconcile({ requestPermission: true }); // compte u1, rappel OFF
    await flush();

    h.setCtx({ uid: "u2", sessionReminders: true }); // compte u2, rappel ON
    const p2 = h.sync.reconcile({ requestPermission: true });
    await flush();

    h.terminer(h.appels[1]);
    h.terminer(h.appels[0]); // l'ancienne arrive après
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ status: "skipped", reason: "stale" });
    expect(r2.status).toBe("scheduled");
    expect(h.appels[0].ecrit).toBe(false);
    expect(h.planificateur.contenu).toEqual({ enabled: true, sessionReminder: true });
  });

  test("le token push n'est jamais attendu : le rappel est posé avant que le token réponde", async () => {
    const h = harnais(connecteON);
    const p = h.sync.reconcile({ requestPermission: true });
    await flush();
    h.terminer(h.appels[0]);
    const r = await p; // le token n'a PAS été résolu
    expect(r.status).toBe("scheduled");
    expect(h.planificateur.contenu).toEqual({ enabled: true, sessionReminder: true });
    h.tokenD.resolve(null); // ne change rien après coup
  });

  test("permission refusée : rien de programmé, l'appelant est prévenu", async () => {
    const h = harnais(connecteON);
    const onPermissionDenied = jest.fn();
    const p = h.sync.reconcile({ requestPermission: true, onPermissionDenied });
    await flush();
    h.appels[0].d.resolve({ permission: "denied", scheduled: { sessionReminder: false, weeklyRecap: false } });
    const r = await p;
    expect(r).toEqual({ status: "cancelled", reason: "permission-denied" });
    expect(onPermissionDenied).toHaveBeenCalledTimes(1);
  });

  test("un échec du service ne rejette jamais : il est rendu en résultat", async () => {
    const h = harnais(connecteON);
    const p = h.sync.reconcile();
    await flush();
    h.appels[0].d.reject(new Error("disque"));
    await expect(p).resolves.toMatchObject({ status: "failed" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B. LE COORDINATEUR + LE VRAI SERVICE (expo-notifications mocké)
// ═══════════════════════════════════════════════════════════════════════════
describe("coordination — ce que contient réellement le planificateur", () => {
  const types = () => mockNotif.scheduled.map((s) => s.type).sort();

  beforeEach(async () => {
    await AsyncStorage.clear();
    mockNotif.permission = "granted";
    mockNotif.scheduled = [];
    mockNotif.tokenPending = false;
    mockNotif.tokenWaiters = [];
    mockNotif.requested = 0;
    mockNotif.suspendreProchainSchedule = false;
    mockNotif.scheduleSuspendu = null;
  });

  function harnaisReel(ctxInitial: NotificationSyncContext) {
    let ctx = { ...ctxInitial };
    const sync = createNotificationSync({ readContext: () => ctx, log: () => undefined });
    return { sync, setCtx: (patch: Partial<NotificationSyncContext>) => { ctx = { ...ctx, ...patch }; } };
  }

  test("démarrage avec préférence OFF et anciens rappels présents : le planificateur est vidé", async () => {
    // Des rappels posés par une version précédente / une autre session.
    mockNotif.scheduled = [{ type: "session_reminder" }, { type: "weekly_recap" }];
    const h = harnaisReel({ authResolved: true, uid: "u1", notificationsEnabled: false, sessionReminders: false });
    const r = await h.sync.reconcile();
    expect(r).toEqual({ status: "cancelled", reason: "disabled" });
    expect(mockNotif.scheduled).toEqual([]);
    expect((await notifications.getNotifPrefs()).enabled).toBe(false);
    expect(mockNotif.requested).toBe(0);
  });

  test("démarrage déconnecté (confirmé) avec anciens rappels : vidé aussi ; auth inconnue : intact", async () => {
    mockNotif.scheduled = [{ type: "session_reminder" }];
    const inconnu = harnaisReel({ authResolved: false, uid: null, notificationsEnabled: true, sessionReminders: true });
    expect(await inconnu.sync.reconcile()).toEqual({ status: "skipped", reason: "auth-unknown" });
    expect(mockNotif.scheduled).toHaveLength(1);

    const deconnecte = harnaisReel({ authResolved: true, uid: null, notificationsEnabled: true, sessionReminders: true });
    expect(await deconnecte.sync.reconcile()).toEqual({ status: "cancelled", reason: "signed-out" });
    expect(mockNotif.scheduled).toEqual([]);
  });

  test("token qui ne répond jamais : les rappels locaux sont posés sans l'attendre", async () => {
    mockNotif.tokenPending = true;
    const h = harnaisReel({ authResolved: true, uid: "u1", notificationsEnabled: true, sessionReminders: true });
    const r = await h.sync.reconcile({ requestPermission: true });
    expect(r.status).toBe("scheduled");
    expect(types()).toEqual(["session_reminder", "weekly_recap"]);
    expect(mockNotif.tokenWaiters).toHaveLength(1); // toujours en attente, et ça ne gêne personne
  });

  test("token en attente, puis OFF, puis token qui répond : rien ne se réactive", async () => {
    mockNotif.tokenPending = true;
    const h = harnaisReel({ authResolved: true, uid: "u1", notificationsEnabled: true, sessionReminders: true });
    await h.sync.reconcile({ requestPermission: true });
    expect(types()).toEqual(["session_reminder", "weekly_recap"]);

    h.setCtx({ notificationsEnabled: false, sessionReminders: false });
    await h.sync.reconcile();
    expect(mockNotif.scheduled).toEqual([]);

    // Le token arrive enfin : il n'est chaîné à aucune programmation.
    mockNotif.tokenWaiters.forEach((w) => w({ data: "ExponentPushToken[tard]" }));
    await flush();
    await flush();
    expect(mockNotif.scheduled).toEqual([]);
    expect((await notifications.getNotifPrefs()).enabled).toBe(false);
  });

  test("bascule OFF pendant que le vrai service programme : l'écriture tardive est abandonnée", async () => {
    const h = harnaisReel({ authResolved: true, uid: "u1", notificationsEnabled: true, sessionReminders: true });
    const pOn = h.sync.reconcile({ requestPermission: true });
    // Avant que la programmation ON ait pu écrire, le joueur coupe.
    h.setCtx({ notificationsEnabled: false, sessionReminders: false });
    const pOff = h.sync.reconcile();
    const [rOn, rOff] = await Promise.all([pOn, pOff]);
    expect(rOn).toEqual({ status: "skipped", reason: "stale" });
    expect(rOff).toEqual({ status: "cancelled", reason: "disabled" });
    expect(mockNotif.scheduled).toEqual([]);
    expect((await notifications.getNotifPrefs()).enabled).toBe(false);
  });

  /** Attend que l'appel natif suspendu ait été INVOQUÉ (il est alors « en vol »). */
  const attendreScheduleEnVol = async () => {
    for (let i = 0; i < 50 && !mockNotif.scheduleSuspendu; i += 1) await flush();
    expect(mockNotif.scheduleSuspendu).not.toBeNull();
  };

  test("SCÉNARIO REPRODUIT : appel natif en vol, déconnexion + purge terminale, libération tardive → planificateur vide", async () => {
    const h = harnaisReel({ authResolved: true, uid: "u1", notificationsEnabled: true, sessionReminders: true });
    // 1. ON ; 2. le premier scheduleNotificationAsync est suspendu APRÈS invocation.
    mockNotif.suspendreProchainSchedule = true;
    const pOn = h.sync.reconcile({ requestPermission: true });
    await attendreScheduleEnVol();

    // 3. Déconnexion publiée, réconciliation OFF en file derrière ON.
    h.setCtx({ uid: null });
    const pOff = h.sync.reconcile();

    // 4. Nettoyage terminal de la suppression de compte (ce que fait
    //    accountDeletion.ts) : il ATTEND les écritures engagées avant d'annuler.
    const pPurge = h.sync.purge();
    let purgeResolue = false;
    void pPurge.then(() => { purgeResolue = true; });
    await flush();
    await flush();
    expect(purgeResolue).toBe(false); // l'appel natif est toujours en vol

    // 5. Libération de l'appel natif.
    mockNotif.scheduleSuspendu!();
    const [rOn, rOff, rPurge] = await Promise.all([pOn, pOff, pPurge]);

    expect(rOn).toEqual({ status: "skipped", reason: "stale" });
    expect(rOff).toEqual({ status: "skipped", reason: "stale" });
    expect(rPurge).toEqual({ status: "purged" });
    // Le point : rien ne survit, ni le rappel posé en vol, ni le récap posé après lui.
    expect(mockNotif.scheduled).toEqual([]);
  });

  test("appel natif en vol, puis OFF (sans purge) : l'écriture tardive est retirée par l'opération elle-même", async () => {
    const h = harnaisReel({ authResolved: true, uid: "u1", notificationsEnabled: true, sessionReminders: true });
    mockNotif.suspendreProchainSchedule = true;
    const pOn = h.sync.reconcile({ requestPermission: true });
    await attendreScheduleEnVol();
    h.setCtx({ notificationsEnabled: false, sessionReminders: false });
    const pOff = h.sync.reconcile();
    mockNotif.scheduleSuspendu!();
    const [rOn, rOff] = await Promise.all([pOn, pOff]);
    expect(rOn).toEqual({ status: "skipped", reason: "stale" });
    expect(rOff).toEqual({ status: "cancelled", reason: "disabled" });
    expect(mockNotif.scheduled).toEqual([]);
  });

  test("changement de compte : un nettoyage ANCIEN n'efface pas les rappels légitimes du nouveau compte", async () => {
    const h = harnaisReel({ authResolved: true, uid: "u1", notificationsEnabled: true, sessionReminders: true });
    mockNotif.suspendreProchainSchedule = true;
    const pOn1 = h.sync.reconcile({ requestPermission: true }); // u1, natif en vol
    await attendreScheduleEnVol();

    const pPurge = h.sync.purge(); // déconnexion de u1 (attend l'écriture en vol)
    h.setCtx({ uid: "u2", sessionReminders: true });
    const pOn2 = h.sync.reconcile({ requestPermission: true }); // u2 se connecte pendant l'attente

    mockNotif.scheduleSuspendu!();
    const [r1, rPurge, r2] = await Promise.all([pOn1, pPurge, pOn2]);
    expect(r1).toEqual({ status: "skipped", reason: "stale" });
    expect(rPurge).toEqual({ status: "skipped", reason: "stale" }); // la purge de u1 n'a plus le droit d'effacer
    expect(r2.status).toBe("scheduled");
    expect(types()).toEqual(["session_reminder", "weekly_recap"]);
  });

  test("purge sans rien en vol : annule et se résout ; une réconciliation ensuite repose", async () => {
    const h = harnaisReel({ authResolved: true, uid: "u1", notificationsEnabled: true, sessionReminders: true });
    await h.sync.reconcile({ requestPermission: true });
    expect(mockNotif.scheduled).toHaveLength(2);
    expect(await h.sync.purge()).toEqual({ status: "purged" });
    expect(mockNotif.scheduled).toEqual([]);
    expect((await h.sync.reconcile()).status).toBe("scheduled");
    expect(mockNotif.scheduled).toHaveLength(2);
  });
});
