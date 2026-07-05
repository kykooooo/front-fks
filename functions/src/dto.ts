// functions/src/dto.ts
// Contrat DTO strict de la projection coach-safe + garde-fou anti-fuite.

import type { AgeCategory } from "./coachLabels";

export type SessionStatus = "planned" | "done" | "unknown";

export interface CoachLatestSession {
  // NB : pas d'`id` — un doc ID Firestore est une chaîne client arbitraire non
  // bornée ; inutile au lecteur coach après la sélection serveur planned/completed.
  // Il reste UNIQUEMENT interne (SessionCandidate) pour comparer planned vs completed.
  dateKey: string | null;
  title: string | null;
  focusLabel: string | null;
  intensityLabel: string | null;
  durationMin: number | null;
  blockCount: number | null;
  status: SessionStatus;
}

export interface CoachLastActivity {
  dateKey: string | null;
  durationMin: number | null;
}

export interface CoachAdaptation {
  adapted: boolean;
  /** Labels d'une allowlist serveur uniquement (jamais de token brut). */
  labels: string[];
}

/**
 * Cœur MÉTIER de la projection : déterministe à partir des sources. Ne contient
 * PAS `sourceEventAt`/`updatedAt` (posés par `rebuildPlayerSummary`, cf. §5).
 * Deux exécutions sur des sources identiques produisent le même `CoachPlayerSummaryCore`.
 */
export interface CoachPlayerSummaryCore {
  playerUid: string;
  firstName: string | null;
  ageCategory: AgeCategory | null;
  position: string | null;
  level: string | null;
  profileComplete: boolean;
  latestSession: CoachLatestSession | null;
  lastActivity: CoachLastActivity | null;
  adaptation: CoachAdaptation;
}

/** DTO complet écrit dans Firestore = cœur métier + enveloppe watermark/idempotence. */
export interface CoachPlayerSummary extends CoachPlayerSummaryCore {
  /** Millisecondes epoch de l'événement source (lisibilité + fallback compare). */
  sourceEventAt: number;
  /** Heure RFC3339 exacte de l'événement source (source de vérité du watermark). */
  sourceEventTime: string;
  /** Id CloudEvent de l'événement source (tie-break déterministe). */
  sourceEventId: string;
  /** Posé serveur (serverTimestamp en prod). Peut changer sans changer le métier. */
  updatedAt: unknown;
}

/**
 * Clés STRICTEMENT interdites, à quelque profondeur que ce soit. Aligné sur
 * `firestore-tests/fixtures.FORBIDDEN_SUMMARY_KEYS` + exigences §3 PR-2.
 * `ai`/`aiV2`/`feedback`/`metrics`/`selection_debug` = blueprints/bruts jamais projetés.
 */
export const FORBIDDEN_KEYS: readonly string[] = [
  "pain",
  "painzone",
  "painzones",
  "injury",
  "injuries",
  "severity",
  "fatigue",
  "sleep",
  "recovery",
  "recoveryperceived",
  "comment",
  "menstruation",
  "cycle",
  "rpe",
  "atl",
  "ctl",
  "tsb",
  "metrics",
  "feedback",
  "ai",
  "aiv2",
  "selection_debug",
  "guardrails",
  "guardrailsapplied",
  "guardrails_applied",
  "clientguardrailsapplied",
  "tokens",
  "prompt",
  "prompts",
  "rationale",
  "rationales",
];

const FORBIDDEN_SET = new Set(FORBIDDEN_KEYS.map((k) => k.toLowerCase()));

/**
 * Vérifie récursivement qu'aucune clé interdite n'existe dans l'objet (dernier
 * rempart avant écriture Firestore). Jette si une clé interdite est trouvée.
 * N'inspecte QUE les clés (pas les valeurs) — la valeur ne peut fuiter que via
 * une clé, puisque la projection ne contient que des chaînes déjà traduites.
 */
export function assertCoachSafe(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertCoachSafe(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_SET.has(key.toLowerCase())) {
        throw new Error(`assertCoachSafe: clé interdite "${key}" à ${path}`);
      }
      assertCoachSafe(v, `${path}.${key}`);
    }
  }
}
