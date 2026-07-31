// domain/tracking/__tests__/resumption.test.ts
import { buildResumptionRecommendation, detectTrainingGap } from "../resumption";
import type { TrackingHistoryEntry } from "../signals";
import { TRACKING_CONFIG } from "../config";

const NOW_ISO = "2026-07-25T12:00:00.000Z";

function daysAgo(n: number): string {
  const d = new Date(NOW_ISO);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

describe("detectTrainingGap -- historique prioritaire", () => {
  it("coupure de 15 jours -> level soft, source history", () => {
    const history: TrackingHistoryEntry[] = [{ dateISO: daysAgo(15), completedAtISO: daysAgo(15) }];
    const gap = detectTrainingGap(history, NOW_ISO);
    expect(gap).toEqual({ gapDays: 15, level: "soft", source: "history" });
  });

  it("coupure de 30 jours -> level hard, source history", () => {
    const history: TrackingHistoryEntry[] = [{ dateISO: daysAgo(30), completedAtISO: daysAgo(30) }];
    const gap = detectTrainingGap(history, NOW_ISO);
    expect(gap).toEqual({ gapDays: 30, level: "hard", source: "history" });
  });

  it("gapDays pile au seuil soft (14j) -> soft (inclusif)", () => {
    const history: TrackingHistoryEntry[] = [
      { dateISO: daysAgo(TRACKING_CONFIG.resumption.gapDaysSoft), completedAtISO: daysAgo(TRACKING_CONFIG.resumption.gapDaysSoft) },
    ];
    expect(detectTrainingGap(history, NOW_ISO).level).toBe("soft");
  });

  it("gapDays pile au seuil hard (28j) -> hard (inclusif)", () => {
    const history: TrackingHistoryEntry[] = [
      { dateISO: daysAgo(TRACKING_CONFIG.resumption.gapDaysHard), completedAtISO: daysAgo(TRACKING_CONFIG.resumption.gapDaysHard) },
    ];
    expect(detectTrainingGap(history, NOW_ISO).level).toBe("hard");
  });

  it("gapDays sous le seuil soft -> none", () => {
    const history: TrackingHistoryEntry[] = [{ dateISO: daysAgo(3), completedAtISO: daysAgo(3) }];
    const gap = detectTrainingGap(history, NOW_ISO);
    expect(gap).toEqual({ gapDays: 3, level: "none", source: "history" });
  });

  it("prend la seance terminee la plus recente, pas une seance abandonnee plus recente", () => {
    const history: TrackingHistoryEntry[] = [
      { dateISO: daysAgo(2), completedAtISO: null }, // pas terminee (pas de completedAtISO)
      { dateISO: daysAgo(20), completedAtISO: daysAgo(20) },
    ];
    expect(detectTrainingGap(history, NOW_ISO).gapDays).toBe(20);
  });
});

describe("detectTrainingGap -- nouvel utilisateur (auto-declare)", () => {
  it("sans historique, avec un gap auto-declare de 45 j -> level hard, source self_reported", () => {
    const gap = detectTrainingGap([], NOW_ISO, TRACKING_CONFIG, 45);
    expect(gap).toEqual({ gapDays: 45, level: "hard", source: "self_reported" });
  });

  it("sans historique et sans info -> gapDays null, level none, source unknown (jamais de fausse donnee)", () => {
    const gap = detectTrainingGap([], NOW_ISO);
    expect(gap).toEqual({ gapDays: null, level: "none", source: "unknown" });
  });

  it("historique present mais aucune seance terminee : utilise quand meme le gap auto-declare", () => {
    const history: TrackingHistoryEntry[] = [{ dateISO: daysAgo(2) }]; // pas de completedAtISO, pas d'execution
    const gap = detectTrainingGap(history, NOW_ISO, TRACKING_CONFIG, 10);
    expect(gap).toEqual({ gapDays: 10, level: "none", source: "self_reported" });
  });

  it("gap auto-declare negatif ou non fini -> ignore (source unknown)", () => {
    expect(detectTrainingGap([], NOW_ISO, TRACKING_CONFIG, -5).source).toBe("unknown");
    expect(detectTrainingGap([], NOW_ISO, TRACKING_CONFIG, NaN).source).toBe("unknown");
  });
});

describe("detectTrainingGap -- purete", () => {
  it("ne modifie jamais l'historique passe en entree", () => {
    const history: TrackingHistoryEntry[] = [{ dateISO: daysAgo(5), completedAtISO: daysAgo(5) }];
    const snapshot = JSON.parse(JSON.stringify(history));
    detectTrainingGap(history, NOW_ISO);
    expect(history).toEqual(snapshot);
  });
});

describe("buildResumptionRecommendation", () => {
  it("hard -> recommande fondation + dose reduite + message non vide", () => {
    const reco = buildResumptionRecommendation("hard");
    expect(reco.recommendCycle).toBe("fondation");
    expect(reco.reduceDose).toBe(true);
    expect(reco.message.length).toBeGreaterThan(0);
  });

  it("soft -> pas de changement de cycle, dose reduite, message non vide", () => {
    const reco = buildResumptionRecommendation("soft");
    expect(reco.recommendCycle).toBeNull();
    expect(reco.reduceDose).toBe(true);
    expect(reco.message.length).toBeGreaterThan(0);
  });

  it("none -> aucun changement, message vide", () => {
    const reco = buildResumptionRecommendation("none");
    expect(reco).toEqual({ recommendCycle: null, reduceDose: false, message: "" });
  });
});
