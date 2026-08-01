// domain/tracking/resumption.ts
// Detection d'une coupure d'entrainement + recommandation de reprise.
// L'historique reel est prioritaire ; un nouvel utilisateur sans historique
// peut fournir un gap auto-declare (onboarding) -- jamais de donnee inventee :
// si ni l'un ni l'autre n'est disponible, source "unknown" et level "none".
import { TRACKING_CONFIG } from "./config";
import type { TrackingConfig } from "./config";
import { findLastCompletedSessionDateMs } from "./signals";
import type { TrackingHistoryEntry } from "./signals";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ResumptionLevel = "none" | "soft" | "hard";
export type ResumptionSource = "history" | "self_reported" | "unknown";

export type TrainingGap = {
  gapDays: number | null;
  level: ResumptionLevel;
  source: ResumptionSource;
};

export type ResumptionRecommendation = {
  recommendCycle: "fondation" | null;
  reduceDose: boolean;
  message: string;
};

function parseDateMs(value: string): number | null {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function levelFor(gapDays: number, config: TrackingConfig): ResumptionLevel {
  if (gapDays >= config.resumption.gapDaysHard) return "hard";
  if (gapDays >= config.resumption.gapDaysSoft) return "soft";
  return "none";
}

/**
 * Detecte une coupure d'entrainement. Historique prioritaire (source
 * "history") ; si aucune seance terminee connue ET qu'un gap auto-declare est
 * fourni (info onboarding d'un nouvel utilisateur), l'utilise (source
 * "self_reported") ; sinon "unknown"/"none" -- jamais de fausse donnee.
 */
export function detectTrainingGap(
  history: TrackingHistoryEntry[],
  nowISO: string,
  config: TrackingConfig = TRACKING_CONFIG,
  selfReportedGapDays?: number | null
): TrainingGap {
  const nowMs = parseDateMs(nowISO);
  const lastCompletedMs = findLastCompletedSessionDateMs(history, config);

  if (lastCompletedMs !== null && nowMs !== null) {
    const gapDays = Math.max(0, Math.floor((nowMs - lastCompletedMs) / DAY_MS));
    return { gapDays, level: levelFor(gapDays, config), source: "history" };
  }

  if (typeof selfReportedGapDays === "number" && Number.isFinite(selfReportedGapDays) && selfReportedGapDays >= 0) {
    const gapDays = Math.floor(selfReportedGapDays);
    return { gapDays, level: levelFor(gapDays, config), source: "self_reported" };
  }

  return { gapDays: null, level: "none", source: "unknown" };
}

/** Recommandation de reprise FR joueur -- hard implique fondations + dose reduite, soft dose reduite seulement. */
export function buildResumptionRecommendation(
  level: ResumptionLevel,
  config: TrackingConfig = TRACKING_CONFIG
): ResumptionRecommendation {
  // config n'influence pas la recommandation textuelle (seuils deja
  // appliques par detectTrainingGap pour produire `level`) -- conserve dans
  // la signature pour coherence avec les autres fonctions du module et pour
  // une evolution future sans casser l'appelant.
  void config;

  if (level === "hard") {
    return {
      recommendCycle: "fondation",
      reduceDose: true,
      message:
        "Ça fait un moment que tu n'as pas terminé de séance. On repart en douceur avec les fondations avant de retrouver ton niveau.",
    };
  }
  if (level === "soft") {
    return {
      recommendCycle: null,
      reduceDose: true,
      message: "Reprise après une petite pause : la prochaine séance sera un peu plus courte pour repartir en douceur.",
    };
  }
  return { recommendCycle: null, reduceDose: false, message: "" };
}
