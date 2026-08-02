// hooks/coach/__tests__/useCoachAttention.test.tsx
//
// Ce hook ne doit contenir AUCUNE règle : ces tests vérifient qu'il ORCHESTRE
// (il sépare "à vérifier" de "à surveiller", il mémorise) et rien d'autre.
// Les seuils et les signaux sont testés dans domain/coachView, pas ici.

import { renderHook } from "./hookHarness";

import { useCoachAttention } from "../useCoachAttention";
import { toCoachPlayerViews } from "../../../domain/coachView/fromSummary";
import type { CoachPlayerSummary } from "../../../domain/coachSummary";

const TODAY = "2026-07-27";

const base = (playerUid: string, firstName: string): CoachPlayerSummary => ({
  playerUid,
  firstName,
  ageCategory: null,
  position: null,
  level: null,
  profileComplete: true,
  latestSession: null,
  lastActivity: null,
  adaptation: { adapted: false, labels: [] },
  activity: null,
  lastPlanned: null,
  lastDone: null,
  execution: null,
});

/** Séance prévue passée, aucune séance faite derrière → statut "check". */
const aVerifier = (uid: string, prenom: string): CoachPlayerSummary => ({
  ...base(uid, prenom),
  lastPlanned: {
    dateKey: "2026-07-22",
    title: "Séance FKS",
    focusLabel: null,
    intensityLabel: null,
    durationMin: 40,
    blockCount: 4,
  },
  lastDone: {
    dateKey: "2026-07-18",
    title: "Séance FKS",
    focusLabel: null,
    intensityLabel: null,
    durationMin: 40,
    blockCount: 4,
  },
  activity: { doneDateKeys: ["2026-07-18"] },
});

/** Séance faite hier, rien d'anormal → statut "normal". */
const sansSouci = (uid: string, prenom: string): CoachPlayerSummary => ({
  ...base(uid, prenom),
  lastDone: {
    dateKey: "2026-07-26",
    title: "Séance FKS",
    focusLabel: null,
    intensityLabel: null,
    durationMin: 40,
    blockCount: 4,
  },
  activity: { doneDateKeys: ["2026-07-26", "2026-07-24", "2026-07-22"] },
});

describe("useCoachAttention", () => {
  test("sépare 'à vérifier' de 'à surveiller' et ne mélange jamais les deux", async () => {
    const views = toCoachPlayerViews([aVerifier("p1", "Anna"), sansSouci("p2", "Bea")], TODAY);
    const h = await renderHook(() => useCoachAttention(views));

    expect(h.current.aVerifier.map((v) => v.playerUid)).toEqual(["p1"]);
    expect(h.current.aVerifier.every((v) => v.statut === "check")).toBe(true);
    expect(h.current.aSurveiller.every((v) => v.statut === "watch")).toBe(true);
    expect(h.current.aVerifier).not.toContain(h.current.aSurveiller[0]);
    await h.unmount();
  });

  test("chaque entrée porte au moins un signal expliquant POURQUOI", async () => {
    const views = toCoachPlayerViews([aVerifier("p1", "Anna")], TODAY);
    const h = await renderHook(() => useCoachAttention(views));

    for (const view of h.current.aVerifier) {
      expect(view.signaux.length).toBeGreaterThan(0);
      expect(view.signaux[0].pourquoi.length).toBeGreaterThan(0);
      expect(view.signaux[0].source).toBeTruthy(); // provenance toujours explicite
    }
    await h.unmount();
  });

  test("compteurs de filtres exposés pour l'effectif complet", async () => {
    const views = toCoachPlayerViews([aVerifier("p1", "Anna"), sansSouci("p2", "Bea")], TODAY);
    const h = await renderHook(() => useCoachAttention(views));

    expect(h.current.counts.tous).toBe(2);
    expect(h.current.counts.a_verifier).toBe(1);
    await h.unmount();
  });

  test("effectif vide → listes vides, jamais d'exception", async () => {
    const h = await renderHook(() => useCoachAttention([]));
    expect(h.current.aVerifier).toEqual([]);
    expect(h.current.aSurveiller).toEqual([]);
    expect(h.current.counts.tous).toBe(0);
    await h.unmount();
  });

  test("mémorisé : même référence d'entrée → même référence de sortie", async () => {
    const views = toCoachPlayerViews([aVerifier("p1", "Anna")], TODAY);
    const h = await renderHook(() => useCoachAttention(views));
    const first = h.current.aVerifier;

    await h.rerender();
    expect(h.current.aVerifier).toBe(first);
    await h.unmount();
  });
});
