// services/signalAnalytics.ts
//
// Analytics Signal FKS — s'appuie UNIQUEMENT sur le système existant (trackEvent).
// Champs autorisés : exercise_id, catalog_version, planned_repetitions,
// completed_repetitions, error_code.
// INTERDITS : aucune donnée personnelle, aucun temps de réaction, aucune donnée
// audio, aucun score sportif.

import { trackEvent } from "./analytics";

export type SignalAnalyticsContext = {
  exercise_id: string;
  catalog_version?: string | null;
  planned_repetitions: number;
};

export function trackSignalStarted(ctx: SignalAnalyticsContext): void {
  trackEvent("signal_fks_started", {
    exercise_id: ctx.exercise_id,
    catalog_version: ctx.catalog_version ?? null,
    planned_repetitions: ctx.planned_repetitions,
  });
}

export function trackSignalCompleted(
  ctx: SignalAnalyticsContext & { completed_repetitions: number }
): void {
  trackEvent("signal_fks_completed", {
    exercise_id: ctx.exercise_id,
    catalog_version: ctx.catalog_version ?? null,
    planned_repetitions: ctx.planned_repetitions,
    completed_repetitions: ctx.completed_repetitions,
  });
}

export function trackSignalAbandoned(
  ctx: SignalAnalyticsContext & { completed_repetitions: number }
): void {
  trackEvent("signal_fks_abandoned", {
    exercise_id: ctx.exercise_id,
    catalog_version: ctx.catalog_version ?? null,
    planned_repetitions: ctx.planned_repetitions,
    completed_repetitions: ctx.completed_repetitions,
  });
}

export function trackSignalError(
  ctx: SignalAnalyticsContext & { error_code: string; completed_repetitions?: number }
): void {
  trackEvent("signal_fks_error", {
    exercise_id: ctx.exercise_id,
    catalog_version: ctx.catalog_version ?? null,
    planned_repetitions: ctx.planned_repetitions,
    completed_repetitions: ctx.completed_repetitions ?? 0,
    error_code: ctx.error_code,
  });
}
