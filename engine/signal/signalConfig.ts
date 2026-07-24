// engine/signal/signalConfig.ts
//
// Constantes + validation pures pour Signal FKS V1. Aucune dépendance RN/Expo.

import type { SignalEngineConfig } from "./signalEngine";

/** Situations catalogue compatibles Signal FKS V1. */
export const SIGNAL_COMPATIBLE_SITUATIONS = [
  "fks_backpedal_signal_sprint",
  "fks_late_gate_choice",
  "fks_jockey_turn_sprint",
] as const;

/** Consignes vocales supportées en V1 (aucune couleur en V1). */
export const SIGNAL_V1_CUES = ["gauche", "droite"] as const;
export type SignalV1Cue = (typeof SIGNAL_V1_CUES)[number];

/** Délai minimal absolu autorisé (borne de sécurité, aligné backend). */
export const SIGNAL_MIN_DELAY_FLOOR_MS = 500;

/** Valeurs par défaut du moteur non fournies par le backend. */
export const SIGNAL_ENGINE_DEFAULTS = {
  repetitions: 6,
  countdownMs: 5000,
  recoveryMs: 20000,
  cueHoldMs: 700,
  maxConsecutiveSame: 2,
} as const;

export type SignalConfigInput = {
  mode: "voice_direction" | "color_gate";
  cues: string[];
  minDelayMs: number;
  maxDelayMs: number;
} | null | undefined;

export type SignalConfigErrorCode =
  | "missing_signal_config"
  | "unsupported_mode"
  | "unsupported_cues"
  | "invalid_delays"
  | "incompatible_exercise";

export type SignalConfigValidation =
  | { ok: true; cues: SignalV1Cue[]; minDelayMs: number; maxDelayMs: number }
  | { ok: false; code: SignalConfigErrorCode };

export function isSignalCompatibleExercise(exerciseId: string | null | undefined): boolean {
  if (!exerciseId) return false;
  return (SIGNAL_COMPATIBLE_SITUATIONS as readonly string[]).includes(exerciseId);
}

/**
 * Valide un `signalConfig` reçu du backend pour la V1.
 * N'accepte que le mode voix + consignes gauche/droite + délais cohérents.
 */
export function validateSignalConfig(input: SignalConfigInput): SignalConfigValidation {
  if (!input || typeof input !== "object") {
    return { ok: false, code: "missing_signal_config" };
  }
  if (input.mode !== "voice_direction") {
    return { ok: false, code: "unsupported_mode" };
  }
  const cues = Array.isArray(input.cues) ? input.cues : [];
  const supported = (SIGNAL_V1_CUES as readonly string[]);
  if (cues.length === 0 || !cues.every((c) => supported.includes(c))) {
    return { ok: false, code: "unsupported_cues" };
  }
  const { minDelayMs, maxDelayMs } = input;
  if (
    !Number.isFinite(minDelayMs) ||
    !Number.isFinite(maxDelayMs) ||
    minDelayMs < SIGNAL_MIN_DELAY_FLOOR_MS ||
    maxDelayMs < SIGNAL_MIN_DELAY_FLOOR_MS ||
    maxDelayMs < minDelayMs
  ) {
    return { ok: false, code: "invalid_delays" };
  }
  return {
    ok: true,
    cues: cues as SignalV1Cue[],
    minDelayMs,
    maxDelayMs,
  };
}

/**
 * Construit la config moteur à partir d'un `signalConfig` déjà validé.
 * `repetitions` peut être surchargé (ex: depuis le dosage de la fiche).
 */
export function resolveSignalEngineConfig(
  validated: Extract<SignalConfigValidation, { ok: true }>,
  overrides: Partial<Pick<SignalEngineConfig, "repetitions" | "countdownMs" | "recoveryMs">> = {}
): SignalEngineConfig {
  return {
    repetitions: Math.max(1, overrides.repetitions ?? SIGNAL_ENGINE_DEFAULTS.repetitions),
    countdownMs: overrides.countdownMs ?? SIGNAL_ENGINE_DEFAULTS.countdownMs,
    minDelayMs: validated.minDelayMs,
    maxDelayMs: validated.maxDelayMs,
    recoveryMs: overrides.recoveryMs ?? SIGNAL_ENGINE_DEFAULTS.recoveryMs,
    cueHoldMs: SIGNAL_ENGINE_DEFAULTS.cueHoldMs,
    cues: validated.cues,
    maxConsecutiveSame: SIGNAL_ENGINE_DEFAULTS.maxConsecutiveSame,
  };
}
