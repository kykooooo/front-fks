// functions/src/watermark.ts
//
// Watermark d'événement pour ordonner écritures/suppressions concurrentes ou
// rejouées. Composé de l'heure CloudEvent EXACTE (string RFC3339 UTC, sans perte
// par Date.parse) + l'`id` d'événement (tie-break déterministe). `at` (ms) n'est
// conservé que pour lisibilité/fallback.

export interface EventWatermark {
  /** Heure RFC3339 brute de l'événement (source de vérité pour la comparaison). */
  time: string;
  /** Identifiant unique de l'événement CloudEvent (tie-break déterministe). */
  id: string;
  /** Millisecondes epoch (lisibilité + fallback si `time` non parsable). */
  at: number;
}

/** Construit un watermark depuis un événement CloudEvent v2 (`event.time`, `event.id`). */
export function watermarkFromEvent(event: { time?: string; id?: string }): EventWatermark {
  const time = typeof event.time === "string" ? event.time : "";
  const parsed = time ? Date.parse(time) : NaN;
  return { time, id: typeof event.id === "string" ? event.id : "", at: Number.isFinite(parsed) ? parsed : 0 };
}

/** Construit un watermark explicite (backfill, tests). */
export function explicitWatermark(time: string, id: string): EventWatermark {
  const parsed = Date.parse(time);
  return { time, id, at: Number.isFinite(parsed) ? parsed : 0 };
}

/** Lit le watermark stocké sur un summary existant (tolère les docs legacy sans watermark). */
export function readWatermark(data: Record<string, unknown> | undefined): EventWatermark {
  return {
    time: typeof data?.sourceEventTime === "string" ? data.sourceEventTime : "",
    id: typeof data?.sourceEventId === "string" ? data.sourceEventId : "",
    at: typeof data?.sourceEventAt === "number" ? data.sourceEventAt : Number.NEGATIVE_INFINITY,
  };
}

/**
 * Clé canonique fixe-largeur pour une comparaison lexicographique EXACTE d'un
 * timestamp RFC3339 UTC (suffixe `Z`), fraction de seconde paddée à 9 chiffres
 * (nanosecondes). Renvoie "" si le format n'est pas reconnu (→ fallback numérique).
 */
function canonicalTime(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/);
  if (!m) return "";
  const frac = (m[7] ?? "").padEnd(9, "0").slice(0, 9);
  return `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}${frac}`;
}

/**
 * `true` si `incoming` doit STRICTEMENT gagner sur `existing` (donc écrire/
 * supprimer est autorisé). Ordre : heure (canonique lossless, sinon `at`), puis
 * `id` le plus grand. Comparaison STRICTE : un watermark identique (même heure
 * ET même id = rejeu exact du même événement) → `false`. Comme `rebuild` relit
 * les sources ACTUELLES, autoriser un rejeu exact ne serait pas idempotent (il
 * pourrait réécrire/supprimer selon un état de sources modifié entre-temps).
 * Résultat DÉTERMINISTE indépendant de l'ordre d'arrivée.
 */
export function incomingWins(incoming: EventWatermark, existing: EventWatermark): boolean {
  const ci = canonicalTime(incoming.time);
  const ce = canonicalTime(existing.time);
  if (ci && ce) {
    if (ci > ce) return true;
    if (ci < ce) return false;
  } else {
    if (incoming.at > existing.at) return true;
    if (incoming.at < existing.at) return false;
  }
  // Heure égale → tie-break déterministe par id (strict). id identique = duplicate → perd.
  return incoming.id > existing.id;
}

/** `true` si les deux watermarks désignent EXACTEMENT le même événement (rejeu). */
export function isSameEvent(a: EventWatermark, b: EventWatermark): boolean {
  return a.time === b.time && a.id === b.id;
}
