// services/__tests__/analyticsCleDepuisBundle.test.ts
//
// MÊME CAUSE QUE LA PANNE DU 22/09/2026 (config/__tests__/backendUrlResolution) :
// depuis eas-cli 18, le manifeste OTA porte `extra.AMPLITUDE_API_KEY = ""`
// (chaîne vide) et seul le bundle embarque la clé (`process.env.EXPO_PUBLIC_*`
// inliné à l'export). L'ancien lecteur `extra.AMPLITUDE_API_KEY ?? ""` ne
// regardait jamais le bundle : la collecte restait muette dans toute OTA,
// même avec la clé posée dans .env.local.
//
// services/analytics.ts lit la clé au chargement du module : chaque cas le
// recharge à neuf avec son propre expo-constants et son propre process.env.

const CLE_ENV = "EXPO_PUBLIC_AMPLITUDE_API_KEY";
const envAvant = process.env[CLE_ENV];

type Analytics = typeof import("../analytics");
type AmplitudeMock = { init: jest.Mock; setOptOut: jest.Mock; setUserId: jest.Mock; track: jest.Mock };

function charger(cas: { extra?: Record<string, unknown>; env?: string }): { analytics: Analytics; amplitude: AmplitudeMock } {
  jest.resetModules();
  const amplitude: AmplitudeMock = { init: jest.fn(), setOptOut: jest.fn(), setUserId: jest.fn(), track: jest.fn() };
  jest.doMock("@amplitude/analytics-react-native", () => amplitude);
  jest.doMock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { extra: cas.extra ?? {} } } }));
  if (cas.env === undefined) delete process.env[CLE_ENV];
  else process.env[CLE_ENV] = cas.env;
  return { analytics: require("../analytics"), amplitude };
}

afterEach(() => {
  jest.dontMock("@amplitude/analytics-react-native");
  jest.dontMock("expo-constants");
  jest.resetModules();
});

afterAll(() => {
  if (envAvant === undefined) delete process.env[CLE_ENV];
  else process.env[CLE_ENV] = envAvant;
});

describe("analytics — d'où vient la clé Amplitude", () => {
  test("manifeste OTA à clé VIDE + clé dans le bundle → le SDK démarre avec la clé du bundle", () => {
    const { analytics, amplitude } = charger({ extra: { AMPLITUDE_API_KEY: "" }, env: "cle-du-bundle" });
    analytics.initAnalytics({ enabled: true });
    expect(amplitude.init).toHaveBeenCalledTimes(1);
    expect(amplitude.init.mock.calls[0][0]).toBe("cle-du-bundle");
    expect(analytics.isAnalyticsEnabled()).toBe(true);
  });

  test("build cloud : clé dans le manifeste, rien dans le bundle → clé du manifeste", () => {
    const { analytics, amplitude } = charger({ extra: { AMPLITUDE_API_KEY: "cle-du-manifeste" } });
    analytics.initAnalytics({ enabled: true });
    expect(amplitude.init.mock.calls[0][0]).toBe("cle-du-manifeste");
  });

  test("les deux présentes : le bundle prime", () => {
    const { amplitude, analytics } = charger({ extra: { AMPLITUDE_API_KEY: "cle-du-manifeste" }, env: "cle-du-bundle" });
    analytics.initAnalytics({ enabled: true });
    expect(amplitude.init.mock.calls[0][0]).toBe("cle-du-bundle");
  });

  test("aucune clé nulle part : le SDK ne démarre pas, rien ne part (comportement historique)", () => {
    const { analytics, amplitude } = charger({ extra: { AMPLITUDE_API_KEY: "" } });
    analytics.initAnalytics({ enabled: true });
    analytics.trackEvent("evenement");
    expect(amplitude.init).not.toHaveBeenCalled();
    expect(amplitude.track).not.toHaveBeenCalled();
    expect(analytics.isAnalyticsEnabled()).toBe(false);
  });
});
