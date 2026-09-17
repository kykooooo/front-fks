// state/__tests__/settingsStorePreferences.test.ts
//
// LE STORE DE RÉGLAGES — ce que « Réinitialiser » touche, ce qu'il préserve,
// et ce qui survit à un redémarrage. Exécuté sur le vrai store (AsyncStorage
// mocké par jest.setup.js).

import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_SETTINGS, RESET_PRESERVED_KEYS, useSettingsStore } from "../settingsStore";

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  await AsyncStorage.clear();
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, _hydrated: true });
});

describe("réinitialisation des préférences de l'appareil", () => {
  test("remet les préférences de confort par défaut", () => {
    useSettingsStore.getState().updateSettings({ hapticsEnabled: false, weekStart: "sun", themeMode: "dark" });
    useSettingsStore.getState().resetSettings();
    const s = useSettingsStore.getState();
    expect(s.hapticsEnabled).toBe(true);
    expect(s.weekStart).toBe("mon");
    expect(s.themeMode).toBe("light");
    expect(s._hydrated).toBe(true);
  });

  test("ne réactive JAMAIS une collecte refusée (privacyAnalytics préservé)", () => {
    useSettingsStore.getState().updateSettings({ privacyAnalytics: false });
    useSettingsStore.getState().resetSettings();
    expect(useSettingsStore.getState().privacyAnalytics).toBe(false);
    expect(RESET_PRESERVED_KEYS).toContain("privacyAnalytics");
  });

  test("ne touche pas au repli d'objectif hebdo (donnée du joueur, pas de l'appareil)", () => {
    useSettingsStore.getState().updateSettings({ weeklyGoal: 4 });
    useSettingsStore.getState().resetSettings();
    expect(useSettingsStore.getState().weeklyGoal).toBe(4);
  });

  test("remet notificationsEnabled et sessionReminders à ON (la permission est revérifiée par l'écran)", () => {
    useSettingsStore.getState().updateSettings({ notificationsEnabled: false });
    expect(useSettingsStore.getState().sessionReminders).toBe(false);
    useSettingsStore.getState().resetSettings();
    expect(useSettingsStore.getState().notificationsEnabled).toBe(true);
    expect(useSettingsStore.getState().sessionReminders).toBe(true);
  });
});

describe("cohérence notifications / rappel", () => {
  test("couper les notifications coupe le rappel de séance", () => {
    useSettingsStore.getState().updateSettings({ notificationsEnabled: false });
    expect(useSettingsStore.getState().sessionReminders).toBe(false);
  });

  test("activer le rappel rallume les notifications", () => {
    useSettingsStore.getState().updateSettings({ notificationsEnabled: false });
    useSettingsStore.getState().updateSettings({ sessionReminders: true });
    expect(useSettingsStore.getState().notificationsEnabled).toBe(true);
    expect(useSettingsStore.getState().sessionReminders).toBe(true);
  });
});

describe("persistance (redémarrage) et indépendance du compte", () => {
  test("les préférences sont écrites sous fks_settings_v1 — une clé d'APPAREIL, sans uid", async () => {
    useSettingsStore.getState().updateSettings({ privacyAnalytics: false, themeMode: "dark" });
    await tick();
    const raw = await AsyncStorage.getItem("fks_settings_v1");
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string).state;
    expect(persisted.privacyAnalytics).toBe(false);
    expect(persisted.themeMode).toBe("dark");
    // Les anciennes valeurs (options retirées de l'écran) restent persistées : rien n'est effacé.
    expect(persisted.distanceUnit).toBe("km");
    expect(persisted.privateMode).toBe(false);
    const cles = await AsyncStorage.getAllKeys();
    expect(cles.filter((k) => k.startsWith("fks_settings"))).toEqual(["fks_settings_v1"]);
  });

  test("une préférence persistée est relue au démarrage", async () => {
    await AsyncStorage.setItem(
      "fks_settings_v1",
      JSON.stringify({ state: { ...DEFAULT_SETTINGS, privacyAnalytics: false, weekStart: "sun" }, version: 0 }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().privacyAnalytics).toBe(false);
    expect(useSettingsStore.getState().weekStart).toBe("sun");
    expect(useSettingsStore.getState()._hydrated).toBe(true);
  });
});
