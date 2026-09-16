// services/__tests__/analyticsOptOut.test.ts
//
// « STATISTIQUES D'UTILISATION » — le choix du joueur est-il RESPECTÉ ?
//
// Trois moments à prouver, en EXÉCUTANT le service (SDK Amplitude mocké) :
//  1. avant `initAnalytics`, rien ne part — quel que soit l'appel ;
//  2. initialisé avec la préférence à OFF : le SDK est démarré en opt-out
//     (donc ni événements manuels, ni événements automatiques de session, ni
//     identifiant utilisateur) ;
//  3. un changement de préférence est appliqué au SDK sans le réinitialiser,
//     dans les deux sens.

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { AMPLITUDE_API_KEY: "cle-de-test" } } },
}));

jest.mock("@amplitude/analytics-react-native", () => ({
  __esModule: true,
  init: jest.fn(),
  track: jest.fn(),
  setUserId: jest.fn(),
  setOptOut: jest.fn(),
}));

import { init, track, setUserId, setOptOut } from "@amplitude/analytics-react-native";
import {
  __resetAnalyticsForTests,
  initAnalytics,
  isAnalyticsEnabled,
  setAnalyticsEnabled,
  setAnalyticsUserId,
  trackEvent,
} from "../analytics";

const mocks = { init: init as jest.Mock, track: track as jest.Mock, setUserId: setUserId as jest.Mock, setOptOut: setOptOut as jest.Mock };

beforeEach(() => {
  __resetAnalyticsForTests();
  Object.values(mocks).forEach((m) => m.mockClear());
});

describe("avant l'initialisation (préférences pas encore restaurées)", () => {
  test("aucun événement, aucun identifiant ne part", () => {
    trackEvent("app_open");
    setAnalyticsUserId("uid-1");
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.setUserId).not.toHaveBeenCalled();
    expect(mocks.init).not.toHaveBeenCalled();
    expect(isAnalyticsEnabled()).toBe(false);
  });
});

describe("initialisé avec la préférence RESTAURÉE", () => {
  test("OFF : le SDK démarre en opt-out et rien ne part ensuite", () => {
    initAnalytics({ enabled: false });
    expect(mocks.init).toHaveBeenCalledTimes(1);
    const options = mocks.init.mock.calls[0][2];
    expect(options.optOut).toBe(true);
    // Les événements automatiques restent configurés côté SDK, mais l'opt-out
    // les bloque : on ne les désactive pas « à moitié », on coupe à la source.
    expect(options.trackingSessionEvents).toBe(true);

    trackEvent("session_started", { cycle: "force" });
    setAnalyticsUserId("uid-1");
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.setUserId).not.toHaveBeenCalled();
    expect(isAnalyticsEnabled()).toBe(false);
  });

  test("ON : les événements et l'identifiant partent", () => {
    initAnalytics({ enabled: true });
    expect(mocks.init.mock.calls[0][2].optOut).toBe(false);
    trackEvent("session_started", { cycle: "force" });
    setAnalyticsUserId("uid-1");
    expect(mocks.track).toHaveBeenCalledWith("session_started", { cycle: "force" });
    expect(mocks.setUserId).toHaveBeenCalledWith("uid-1");
    expect(isAnalyticsEnabled()).toBe(true);
  });

  test("un second init ne réinitialise pas le SDK", () => {
    initAnalytics({ enabled: true });
    initAnalytics({ enabled: false });
    expect(mocks.init).toHaveBeenCalledTimes(1);
  });
});

describe("changement de préférence pendant la session", () => {
  test("ON → OFF : opt-out immédiat, identifiant retiré, plus aucun événement", () => {
    initAnalytics({ enabled: true });
    setAnalyticsEnabled(false);
    expect(mocks.setOptOut).toHaveBeenLastCalledWith(true);
    expect(mocks.setUserId).toHaveBeenLastCalledWith(undefined);
    mocks.track.mockClear();
    trackEvent("profile_completed");
    expect(mocks.track).not.toHaveBeenCalled();
  });

  test("OFF → ON : la collecte reprend sans réinitialiser", () => {
    initAnalytics({ enabled: false });
    setAnalyticsEnabled(true);
    expect(mocks.setOptOut).toHaveBeenLastCalledWith(false);
    trackEvent("profile_completed");
    expect(mocks.track).toHaveBeenCalledWith("profile_completed", undefined);
    expect(mocks.init).toHaveBeenCalledTimes(1);
  });

  test("changer la préférence AVANT l'init ne démarre rien et est mémorisé", () => {
    setAnalyticsEnabled(true);
    expect(mocks.setOptOut).not.toHaveBeenCalled();
    trackEvent("x");
    expect(mocks.track).not.toHaveBeenCalled();
  });
});

describe("identité et préférence restent synchronisées", () => {
  test("ON → OFF → ON avec le même compte : l'identifiant est retiré puis RÉASSOCIÉ", () => {
    initAnalytics({ enabled: true });
    setAnalyticsUserId("uid-1");
    expect(mocks.setUserId).toHaveBeenLastCalledWith("uid-1");

    setAnalyticsEnabled(false);
    expect(mocks.setUserId).toHaveBeenLastCalledWith(undefined);
    mocks.setUserId.mockClear();

    setAnalyticsEnabled(true);
    // La réactivation explicite réassocie le compte courant — sans attendre un
    // changement d'authentification.
    expect(mocks.setUserId).toHaveBeenCalledWith("uid-1");
    expect(mocks.setOptOut).toHaveBeenLastCalledWith(false);
  });

  test("changement de compte PENDANT OFF, puis réactivation : seul le compte actuel est associé", () => {
    initAnalytics({ enabled: true });
    setAnalyticsUserId("uid-1");
    setAnalyticsEnabled(false);
    mocks.setUserId.mockClear();

    // Déconnexion puis connexion d'un autre compte, collecte toujours OFF.
    setAnalyticsUserId(null);
    setAnalyticsUserId("uid-2");
    expect(mocks.setUserId).not.toHaveBeenCalled(); // rien ne part pendant OFF

    setAnalyticsEnabled(true);
    expect(mocks.setUserId).toHaveBeenCalledTimes(1);
    expect(mocks.setUserId).toHaveBeenCalledWith("uid-2");
    expect(mocks.setUserId).not.toHaveBeenCalledWith("uid-1");
  });

  test("déconnexion pendant OFF, réactivation sans compte : aucun identifiant n'est associé", () => {
    initAnalytics({ enabled: true });
    setAnalyticsUserId("uid-1");
    setAnalyticsEnabled(false);
    setAnalyticsUserId(null);
    mocks.setUserId.mockClear();
    setAnalyticsEnabled(true);
    expect(mocks.setUserId).toHaveBeenCalledWith(undefined);
  });

  test("init avec collecte OFF ne transmet pas l'identité déjà connue ; ON la transmet", () => {
    setAnalyticsUserId("uid-1"); // connu avant l'init (restauration auth rapide)
    initAnalytics({ enabled: false });
    expect(mocks.init.mock.calls[0][1]).toBeUndefined();
    __resetAnalyticsForTests();
    mocks.init.mockClear();
    setAnalyticsUserId("uid-1");
    initAnalytics({ enabled: true });
    expect(mocks.init.mock.calls[0][1]).toBe("uid-1");
  });
});
