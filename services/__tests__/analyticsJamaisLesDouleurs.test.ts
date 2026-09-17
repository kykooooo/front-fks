// services/__tests__/analyticsJamaisLesDouleurs.test.ts
//
// « JAMAIS TES DOULEURS » — la phrase écrite au joueur dans les Réglages
// est-elle VRAIE ?
//
// Elle ne l'était pas (2026-09) : quatre événements portaient une information
// de douleur ou de fatigue vers Amplitude. La règle est désormais appliquée au
// seul point de passage (services/analytics.ts). On le prouve en EXÉCUTANT le
// service (SDK mocké) avec les quatre charges réelles, puis on vérifie que
// l'écran ne promet rien de plus que ce que le service garantit.

import { readFileSync } from "fs";
import { resolve } from "path";

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

import { track } from "@amplitude/analytics-react-native";
import { __resetAnalyticsForTests, initAnalytics, sansDonneesDeSante, trackEvent } from "../analytics";

const trackMock = track as jest.Mock;

beforeEach(() => {
  __resetAnalyticsForTests();
  trackMock.mockClear();
  initAnalytics({ enabled: true });
});

describe("les quatre fuites connues sont fermées", () => {
  test("ressenti de fin de séance : ni la douleur ni la fatigue ne partent, le reste si", () => {
    trackEvent("feedback_submitted", { cycleId: "force", rpe: 7, fatigue: 4, pain: 3, durationMin: 45 });
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock.mock.calls[0][1]).toEqual({ cycleId: "force", rpe: 7, durationMin: 45 });
  });

  test("exercice sauté ou adapté : douleur, fatigue et « autre » sont INDISTINGUABLES à l'arrivée", () => {
    for (const reason of ["pain", "fatigue", "other"]) {
      trackEvent("live_exercise_marked", { status: "skipped", reason });
    }
    const recus = trackMock.mock.calls.map((appel) => appel[1]);
    expect(recus).toEqual([
      { status: "skipped", reason: "other" },
      { status: "skipped", reason: "other" },
      { status: "skipped", reason: "other" },
    ]);
  });

  test("une raison qui ne dit rien de la santé passe telle quelle", () => {
    trackEvent("live_exercise_marked", { status: "adapted", reason: "equipment" });
    expect(trackMock.mock.calls[0][1]).toEqual({ status: "adapted", reason: "equipment" });
  });

  test("abandon de cycle pour « gêne physique » : la raison se fond dans « autre »", () => {
    trackEvent("cycle_abandoned", { cycleId: "force", reason: "injury", origin: "home" });
    expect(trackMock.mock.calls[0][1]).toEqual({ cycleId: "force", reason: "other", origin: "home" });
  });

  test("décision de suivi motivée par la douleur : l'événement ne part PAS (aucun « autre » où se fondre)", () => {
    trackEvent("tracking_decision_shadow", { kind: "block_increase_pain", rulesVersion: 3, dataQuality: "good", completionPct: 80 });
    expect(trackMock).not.toHaveBeenCalled();
    // Les autres décisions continuent de partir.
    trackEvent("tracking_decision_shadow", { kind: "hold_dose", rulesVersion: 3, dataQuality: "good", completionPct: 80 });
    expect(trackMock).toHaveBeenCalledTimes(1);
  });
});

describe("la règle, isolée", () => {
  test("sans propriétés : rien à filtrer", () => {
    expect(sansDonneesDeSante(undefined)).toBeUndefined();
    trackEvent("login_success");
    expect(trackMock).toHaveBeenCalledWith("login_success", undefined);
  });

  test("ne modifie jamais l'objet de l'appelant", () => {
    const props = { pain: 2, reason: "pain" };
    sansDonneesDeSante(props);
    expect(props).toEqual({ pain: 2, reason: "pain" });
  });
});

describe("aucun appel de l'app ne tente d'envoyer une clé de santé (source)", () => {
  const racine = resolve(__dirname, "..", "..");
  const lire = (rel: string) => readFileSync(resolve(racine, rel), "utf8");

  test("le ressenti n'inscrit plus `pain` ni `fatigue` dans son événement", () => {
    const source = lire("screens/feedback/hooks/useFeedbackSave.ts");
    const debut = source.indexOf("trackEvent('feedback_submitted'");
    expect(debut).toBeGreaterThan(-1);
    const appel = source.slice(debut, source.indexOf("});", debut));
    expect(appel).not.toMatch(/\bpain\b/);
    expect(appel).not.toMatch(/\bfatigue\b/);
  });

  test("l'écran des Réglages fait la promesse — et c'est ce fichier qui la tient", () => {
    expect(lire("screens/SettingsScreen.tsx")).toContain("Jamais tes douleurs.");
    expect(lire("services/analytics.ts")).toContain("sansDonneesDeSante(props)");
  });
});
