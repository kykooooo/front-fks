// utils/__tests__/feedbackWindow.test.ts
// Fenêtre de validation partagée (FeedbackScreen / NewSessionScreen / usePrimaryCta)
// + sélection de la séance en attente (anti "séance zombie").

import { feedbackWindowKeys, isWithinFeedbackWindow } from "../dateHelpers";
import { selectPendingSession } from "../sessionHelpers";
import type { Session } from "../../domain/types";

const TODAY = "2026-07-10";

const makeSession = (over: Record<string, unknown>): Session =>
  ({
    id: "s-default",
    completed: false,
    ...over,
  }) as unknown as Session;

describe("feedbackWindowKeys — fenêtre de validation partagée", () => {
  it("retourne exactement aujourd'hui, J-1, J-2 et demain", () => {
    expect(feedbackWindowKeys(TODAY).sort()).toEqual(
      ["2026-07-08", "2026-07-09", "2026-07-10", "2026-07-11"].sort()
    );
  });

  it("gère les bords de mois sans décalage", () => {
    expect(feedbackWindowKeys("2026-08-01").sort()).toEqual(
      ["2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"].sort()
    );
  });
});

describe("isWithinFeedbackWindow", () => {
  it("accepte aujourd'hui, J-1, J-2 et demain", () => {
    expect(isWithinFeedbackWindow("2026-07-10", TODAY)).toBe(true);
    expect(isWithinFeedbackWindow("2026-07-09", TODAY)).toBe(true);
    expect(isWithinFeedbackWindow("2026-07-08", TODAY)).toBe(true);
    expect(isWithinFeedbackWindow("2026-07-11", TODAY)).toBe(true);
  });

  it("refuse J-3, J+2 et les dates absentes", () => {
    expect(isWithinFeedbackWindow("2026-07-07", TODAY)).toBe(false);
    expect(isWithinFeedbackWindow("2026-07-12", TODAY)).toBe(false);
    expect(isWithinFeedbackWindow("", TODAY)).toBe(false);
    expect(isWithinFeedbackWindow(undefined, TODAY)).toBe(false);
    expect(isWithinFeedbackWindow(null, TODAY)).toBe(false);
  });
});

describe("selectPendingSession — logique pendingSession de usePrimaryCta", () => {
  it("ignore une séance non complétée de 5 jours (zombie) → le Home propose de générer", () => {
    const sessions = [
      makeSession({ id: "zombie", dateISO: "2026-07-05", completed: false }),
    ];
    expect(selectPendingSession(sessions, TODAY)).toBeUndefined();
  });

  it("renvoie la séance du jour même si une zombie plus ancienne existe", () => {
    const sessions = [
      makeSession({ id: "zombie", dateISO: "2026-07-03", completed: false }),
      makeSession({ id: "today", dateISO: "2026-07-10", completed: false }),
    ];
    expect(selectPendingSession(sessions, TODAY)?.id).toBe("today");
  });

  it("ignore les séances complétées", () => {
    const sessions = [
      makeSession({ id: "done", dateISO: "2026-07-10", completed: true }),
    ];
    expect(selectPendingSession(sessions, TODAY)).toBeUndefined();
  });

  it("renvoie la plus ancienne des séances dans la fenêtre", () => {
    const sessions = [
      makeSession({ id: "tomorrow", dateISO: "2026-07-11", completed: false }),
      makeSession({ id: "j2", dateISO: "2026-07-08", completed: false }),
    ];
    expect(selectPendingSession(sessions, TODAY)?.id).toBe("j2");
  });

  it("départage une même journée par createdAt (la plus ancienne d'abord)", () => {
    const sessions = [
      makeSession({
        id: "late",
        dateISO: "2026-07-10",
        createdAt: "2026-07-10T18:00:00.000Z",
      }),
      makeSession({
        id: "early",
        dateISO: "2026-07-10",
        createdAt: "2026-07-10T08:00:00.000Z",
      }),
    ];
    expect(selectPendingSession(sessions, TODAY)?.id).toBe("early");
  });

  it("ignore une séance sans date (jamais bloquante)", () => {
    const sessions = [makeSession({ id: "nodate", completed: false })];
    expect(selectPendingSession(sessions, TODAY)).toBeUndefined();
  });
});
