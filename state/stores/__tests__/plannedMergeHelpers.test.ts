// state/stores/__tests__/plannedMergeHelpers.test.ts
//
// AUDIT P0-1 — le watcher plannedSessions effaçait la séance complétée du jour.
// Repro d'origine : générer + faire + valider une séance aujourd'hui, puis
// regénérer une séance le même jour → la séance faite disparaissait du store
// (exclue de `planned` par completedLocalIds ET de `nonPlanned` par incomingIds),
// perdant historique/compteur/streak — et définitivement le feedback si
// hors-ligne + kill app.
//
// Ces tests verrouillent les invariants du merge pur (plannedMergeHelpers).

import {
  mapIncomingPlannedSessions,
  mergePlannedIntoLocalSessions,
  type IncomingPlannedDoc,
} from "../plannedMergeHelpers";
import type { Session } from "../../../domain/types";

const TODAY = "2026-07-16";
const TOMORROW = "2026-07-17";
const YESTERDAY = "2026-07-15";

const makeDoc = (over: Partial<IncomingPlannedDoc> = {}): IncomingPlannedDoc => ({
  id: "p1",
  date: TODAY,
  status: "planned",
  phase: "Construction",
  focus: "strength",
  intensity: "moderate",
  plannedLoad: 40,
  exercises: [],
  ai: { title: "Force bas du corps" },
  ...over,
});

const makeLocal = (over: Partial<Session> = {}): Session =>
  ({
    id: "s1",
    date: TODAY,
    dateISO: `${TODAY}T10:00:00.000Z`,
    focus: "strength",
    phase: "Construction",
    intensity: "moderate",
    volumeScore: 50,
    exercises: [],
    completed: false,
    ...over,
  } as Session);

describe("mapIncomingPlannedSessions — filtres status + date", () => {
  test("garde les docs status 'planned' du jour et du futur", () => {
    const out = mapIncomingPlannedSessions(
      [makeDoc({ id: "a", date: TODAY }), makeDoc({ id: "b", date: TOMORROW })],
      TODAY
    );
    expect(out.map((s) => s.id)).toEqual(["a", "b"]);
    expect(out[0].completed).toBe(false);
    expect(out[0].aiV2).toEqual({ title: "Force bas du corps" });
  });

  test("exclut un doc marqué 'completed' au feedback (P0-1b)", () => {
    const out = mapIncomingPlannedSessions(
      [makeDoc({ id: "done", status: "completed" }), makeDoc({ id: "todo" })],
      TODAY
    );
    expect(out.map((s) => s.id)).toEqual(["todo"]);
  });

  test("status absent/null = planned (compat docs historiques sans marqueur)", () => {
    const out = mapIncomingPlannedSessions(
      [makeDoc({ id: "legacy", status: undefined }), makeDoc({ id: "legacy2", status: null })],
      TODAY
    );
    expect(out.map((s) => s.id)).toEqual(["legacy", "legacy2"]);
  });

  test("exclut les docs passés et les docs sans date exploitable", () => {
    const out = mapIncomingPlannedSessions(
      [makeDoc({ id: "old", date: YESTERDAY }), makeDoc({ id: "nodate", date: "" })],
      TODAY
    );
    expect(out).toEqual([]);
  });

  test("liste null/undefined → tableau vide (jamais de crash)", () => {
    expect(mapIncomingPlannedSessions(null, TODAY)).toEqual([]);
    expect(mapIncomingPlannedSessions(undefined, TODAY)).toEqual([]);
  });
});

describe("mergePlannedIntoLocalSessions — la séance complétée SURVIT (P0-1a)", () => {
  test("REPRO AUDIT : séance faite aujourd'hui + son doc encore 'planned' → elle reste", () => {
    // La séance s1 a été faite/validée aujourd'hui, mais son doc plannedSessions
    // n'a pas (encore) été marqué completed (écriture en vol ou échouée).
    const done = makeLocal({ id: "s1", completed: true });
    const incoming = mapIncomingPlannedSessions([makeDoc({ id: "s1" })], TODAY);

    const merged = mergePlannedIntoLocalSessions([done], incoming);

    // Avant le fix : [] — la séance faite disparaissait (historique/compteur/streak).
    expect(merged).toEqual([done]);
  });

  test("REPRO AUDIT complet : regénération le même jour → la faite ET la nouvelle survivent", () => {
    const done = makeLocal({ id: "s1", completed: true });
    const fresh = makeLocal({ id: "s2", completed: false }); // regénérée, poussée localement
    const incoming = mapIncomingPlannedSessions(
      [makeDoc({ id: "s1" }), makeDoc({ id: "s2" })],
      TODAY
    );

    const merged = mergePlannedIntoLocalSessions([fresh, done], incoming);

    // s1 complétée : jamais écartée. s2 : son doc entrant est filtré (jour déjà
    // complété) → la copie locale ne doit pas être "avalée" pour autant.
    expect(merged.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
    expect(merged.find((s) => s.id === "s1")?.completed).toBe(true);
    expect(merged.find((s) => s.id === "s2")?.completed).toBe(false);
  });

  test("un doc planifié d'un jour déjà complété ne redevient pas une carte 'à faire'", () => {
    const done = makeLocal({ id: "s1", completed: true });
    // Doc distant p9 (autre id) planifié aujourd'hui, sans copie locale.
    const incoming = mapIncomingPlannedSessions([makeDoc({ id: "p9" })], TODAY);

    const merged = mergePlannedIntoLocalSessions([done], incoming);

    expect(merged.map((s) => s.id)).toEqual(["s1"]); // p9 n'entre pas
  });

  test("remplacement 1-pour-1 : la copie locale non complétée cède sa place à la version entrante", () => {
    const localStale = makeLocal({ id: "s3", completed: false, volumeScore: 999 });
    const incoming = mapIncomingPlannedSessions([makeDoc({ id: "s3", plannedLoad: 40 })], TODAY);

    const merged = mergePlannedIntoLocalSessions([localStale], incoming);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("s3");
    expect(merged[0].volumeScore).toBe(40); // version Firestore, pas la copie locale
  });

  test("planifiée de demain entre normalement, complétées d'hier conservées", () => {
    const doneYesterday = makeLocal({
      id: "old",
      completed: true,
      date: YESTERDAY,
      dateISO: `${YESTERDAY}T10:00:00.000Z`,
    });
    const incoming = mapIncomingPlannedSessions([makeDoc({ id: "next", date: TOMORROW })], TODAY);

    const merged = mergePlannedIntoLocalSessions([doneYesterday], incoming);

    expect(merged.map((s) => s.id).sort()).toEqual(["next", "old"]);
  });

  test("pas de doublon : une complétée locale n'est jamais dupliquée par son doc entrant", () => {
    const done = makeLocal({ id: "s1", completed: true });
    const incoming = mapIncomingPlannedSessions([makeDoc({ id: "s1" })], TODAY);

    const merged = mergePlannedIntoLocalSessions([done], incoming);

    expect(merged.filter((s) => s.id === "s1")).toHaveLength(1);
  });
});
