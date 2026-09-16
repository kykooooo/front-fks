// utils/__tests__/exportLocal.test.ts
//
// L'EXPORT DIT CE QU'IL CONTIENT, ET NE CONTIENT QUE DES DONNÉES.

import { buildLocalExport, donneesSeules, nomFichierExport } from "../exportLocal";

const storesFactices = () => ({
  load: { atl: 12, ctl: 20, tsb: 8, _hydrated: true, resetLoadMetrics: () => undefined },
  sessions: { sessions: [{ id: "s1", completed: true }], lastAiContext: { profile: { level: "x" } }, lastAiSessionV2: {}, pushSession: () => undefined },
  feedback: { dayStates: { "2026-09-14": { fatigue: 2 } }, setDailyFeedback: () => undefined },
  external: { clubTrainingDays: ["tue"], matchDays: ["sat"], targetFksSessionsPerWeek: 2, setMatchDays: () => undefined },
  body: { bodyInjuries: [{ id: "g1", zone: "genou", gravite: 2, statut: "active" }], ajouterGene: () => undefined },
  settings: { themeMode: "dark", privacyAnalytics: false, _hydrated: true, updateSettings: () => undefined },
});

describe("donneesSeules", () => {
  test("retire les fonctions, les clés techniques et le contexte IA", () => {
    const out = donneesSeules(storesFactices().sessions);
    expect(out).toEqual({ sessions: [{ id: "s1", completed: true }] });
    expect(donneesSeules(storesFactices().load)).toEqual({ atl: 12, ctl: 20, tsb: 8 });
  });
});

describe("buildLocalExport", () => {
  const exportLocal = buildLocalExport({ exportedAtISO: "2026-09-14T10:00:00.000Z", appVersion: "1.1.0", stores: storesFactices() });

  test("inclut « Mon corps » et les préférences, sans fonctions ni clés techniques", () => {
    expect(exportLocal.data.body).toEqual({ bodyInjuries: [{ id: "g1", zone: "genou", gravite: 2, statut: "active" }] });
    expect(exportLocal.data.settings).toEqual({ themeMode: "dark", privacyAnalytics: false });
    const json = JSON.stringify(exportLocal);
    expect(json).not.toContain("_hydrated");
    expect(json).not.toContain("lastAiContext");
    expect(json).not.toContain("fks_push_token");
  });

  test("le périmètre est écrit dans le fichier : local, partiel, non restaurable", () => {
    expect(exportLocal.format).toBe("fks-local-export");
    expect(exportLocal.scope.restorable).toBe(false);
    expect(exportLocal.scope.excludes.join(" ")).toMatch(/profil complet Firestore/);
    expect(exportLocal.scope.includes.some((l) => l.includes("Mon corps"))).toBe(true);
    expect(exportLocal.exportedAt).toBe("2026-09-14T10:00:00.000Z");
    expect(exportLocal.appVersion).toBe("1.1.0");
  });

  test("le nom du fichier annonce des données LOCALES", () => {
    expect(nomFichierExport("2026-09-14T10:00:00.000Z")).toBe("fks-donnees-locales-2026-09-14.json");
  });
});
