// services/__tests__/notificationPreferences.test.ts
//
// PERMISSION DU TÉLÉPHONE ≠ PRÉFÉRENCE DU JOUEUR ≠ RAPPELS PROGRAMMÉS.
//
// Exécuté sur le vrai service, expo-notifications mocké : chaque test dit ce
// que le planificateur contient VRAIMENT à la fin, pas ce qu'un interrupteur
// affiche.

const mockNotif = {
  permission: "granted" as "granted" | "denied" | "undetermined",
  requestResult: "granted" as "granted" | "denied",
  tokenFails: false,
  scheduled: [] as Array<{ type: string; trigger: any }>,
  requested: 0,
};

jest.mock("expo-notifications", () => ({
  __esModule: true,
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: mockNotif.permission })),
  requestPermissionsAsync: jest.fn(async () => {
    mockNotif.requested += 1;
    mockNotif.permission = mockNotif.requestResult;
    return { status: mockNotif.requestResult };
  }),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  getExpoPushTokenAsync: jest.fn(async () => {
    if (mockNotif.tokenFails) throw new Error("projectId absent");
    return { data: "ExponentPushToken[test]" };
  }),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {
    mockNotif.scheduled = [];
  }),
  scheduleNotificationAsync: jest.fn(async (req: any) => {
    mockNotif.scheduled.push({ type: req.content?.data?.type, trigger: req.trigger });
    return `id-${mockNotif.scheduled.length}`;
  }),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DAILY: "daily", WEEKLY: "weekly", DATE: "date", TIME_INTERVAL: "timeInterval" },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: "proj" } } } },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  applyNotificationPreferences,
  ensureNotificationPermission,
  getNotifPrefs,
  registerForPushNotifications,
  registerPushTokenBestEffort,
  SESSION_REMINDER_TIME,
} from "../notifications";

const types = () => mockNotif.scheduled.map((s) => s.type).sort();

beforeEach(async () => {
  await AsyncStorage.clear();
  mockNotif.permission = "granted";
  mockNotif.requestResult = "granted";
  mockNotif.tokenFails = false;
  mockNotif.scheduled = [];
  mockNotif.requested = 0;
});

describe("permission refusée par le téléphone", () => {
  test("ON demandé → rien n'est programmé, la réponse dit « denied », le miroir n'est pas menti", async () => {
    mockNotif.permission = "undetermined";
    mockNotif.requestResult = "denied";
    const r = await applyNotificationPreferences({ enabled: true, sessionReminder: true }, { requestPermission: true });
    expect(r.permission).toBe("denied");
    expect(r.scheduled).toEqual({ sessionReminder: false, weeklyRecap: false });
    expect(mockNotif.scheduled).toEqual([]);
    expect(mockNotif.requested).toBe(1);
  });

  test("sans demande explicite (démarrage / reset), un refus déjà posé n'ouvre pas de popup", async () => {
    mockNotif.permission = "denied";
    const r = await applyNotificationPreferences({ enabled: true, sessionReminder: true });
    expect(r.permission).toBe("denied");
    expect(mockNotif.requested).toBe(0);
    expect(mockNotif.scheduled).toEqual([]);
  });
});

describe("permission accordée, token push indisponible", () => {
  test("le token n'est pas une condition : les rappels locaux sont programmés quand même", async () => {
    mockNotif.tokenFails = true;
    const token = await registerPushTokenBestEffort();
    expect(token).toBeNull();
    // Et la fonction historique ne jette plus : `null` ne signifie plus « refusé ».
    await expect(registerForPushNotifications()).resolves.toBeNull();

    const r = await applyNotificationPreferences({ enabled: true, sessionReminder: true });
    expect(r.permission).toBe("granted");
    expect(r.scheduled.sessionReminder).toBe(true);
    expect(types()).toEqual(["session_reminder", "weekly_recap"]);
  });

  test("ensureNotificationPermission répond sans se soucier du token", async () => {
    mockNotif.tokenFails = true;
    await expect(ensureNotificationPermission()).resolves.toBe("granted");
  });
});

describe("les interrupteurs et ce qui est programmé restent d'accord", () => {
  test("notifications ON + rappel ON → un rappel quotidien à l'heure fixe + le récap hebdo", async () => {
    await applyNotificationPreferences({ enabled: true, sessionReminder: true });
    expect(types()).toEqual(["session_reminder", "weekly_recap"]);
    const daily = mockNotif.scheduled.find((s) => s.type === "session_reminder")!;
    expect(daily.trigger).toMatchObject({ type: "daily", hour: SESSION_REMINDER_TIME.hour, minute: SESSION_REMINDER_TIME.minute });
    const prefs = await getNotifPrefs();
    expect(prefs.enabled).toBe(true);
    expect(prefs.sessionReminder).toBe(true);
  });

  test("notifications ON + rappel OFF → seul le récap reste", async () => {
    await applyNotificationPreferences({ enabled: true, sessionReminder: false });
    expect(types()).toEqual(["weekly_recap"]);
    expect((await getNotifPrefs()).sessionReminder).toBe(false);
  });

  test("notifications OFF → tout est annulé, le miroir est OFF, aucune permission demandée", async () => {
    await applyNotificationPreferences({ enabled: true, sessionReminder: true });
    mockNotif.permission = "undetermined";
    const r = await applyNotificationPreferences({ enabled: false, sessionReminder: false });
    expect(mockNotif.scheduled).toEqual([]);
    expect(r.scheduled).toEqual({ sessionReminder: false, weeklyRecap: false });
    expect((await getNotifPrefs()).enabled).toBe(false);
    expect(mockNotif.requested).toBe(0);
  });

  test("réappliquer (redémarrage) ne crée jamais de doublon", async () => {
    await applyNotificationPreferences({ enabled: true, sessionReminder: true });
    await applyNotificationPreferences({ enabled: true, sessionReminder: true });
    await applyNotificationPreferences({ enabled: true, sessionReminder: true });
    expect(mockNotif.scheduled).toHaveLength(2);
  });

  test("bascules rapides : la DERNIÈRE demandée est celle qui reste posée", async () => {
    const p1 = applyNotificationPreferences({ enabled: true, sessionReminder: true });
    const p2 = applyNotificationPreferences({ enabled: false, sessionReminder: false });
    const p3 = applyNotificationPreferences({ enabled: true, sessionReminder: false });
    await Promise.all([p1, p2, p3]);
    expect(types()).toEqual(["weekly_recap"]);
    expect((await getNotifPrefs()).sessionReminder).toBe(false);
  });

  test("un échec de sauvegarde ne bloque pas les applications suivantes", async () => {
    const spy = jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disque plein"));
    await expect(applyNotificationPreferences({ enabled: true, sessionReminder: true })).rejects.toThrow("disque plein");
    spy.mockRestore();
    await applyNotificationPreferences({ enabled: true, sessionReminder: true });
    expect(types()).toEqual(["session_reminder", "weekly_recap"]);
  });
});
