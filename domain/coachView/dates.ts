// domain/coachView/dates.ts
//
// Arithmétique de dates ABSOLUE sur des clés "YYYY-MM-DD", en UTC.
//
// POURQUOI ce module et pas utils/dateHelpers : dateHelpers expose les helpers
// PRODUIT (toDateKey, isSameDay, weekKeyOf) et raisonne en heure LOCALE, ce qui
// est juste côté joueur (une séance à 23h30 compte pour aujourd'hui). Ici on
// manipule des clés déjà normalisées, venues du serveur, et on a besoin d'un
// calcul d'écart STABLE : passer par une Date locale ferait varier un "il y a
// 3 jours" selon l'heure d'été ou le fuseau du téléphone du coach. On lit donc
// les clés à midi UTC — jamais minuit — pour rester insensible aux décalages.
//
// Aucune horloge implicite : toutes les fonctions prennent leurs dates en entrée.
// Module PUR (ni React, ni Firestore, ni Date.now()).

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86400000;

/** true si la clé est une vraie date calendaire (rejette 2026-02-30, 2026-13-01). */
export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_KEY_RE.exec(value.trim());
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Clé → millisecondes UTC (midi), ou null si la clé est invalide. */
export function keyToUtcMs(key: unknown): number | null {
  if (!isValidDateKey(key)) return null;
  const ms = Date.parse(`${key.trim()}T12:00:00.000Z`);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Écart en jours entre deux clés : positif si `toKey` est APRÈS `fromKey`.
 * Une clé invalide → null (jamais 0 : un écart inconnu n'est pas un écart nul).
 */
export function diffDaysBetweenKeys(fromKey: unknown, toKey: unknown): number | null {
  const a = keyToUtcMs(fromKey);
  const b = keyToUtcMs(toKey);
  if (a === null || b === null) return null;
  return Math.round((b - a) / MS_PER_DAY);
}

/** Clé + N jours (N peut être négatif). Clé invalide → null. */
export function addDaysToKey(key: unknown, days: number): string | null {
  const ms = keyToUtcMs(key);
  if (ms === null || !Number.isFinite(days)) return null;
  const d = new Date(ms + Math.round(days) * MS_PER_DAY);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Comparateur décroissant (plus récent d'abord) sur des clés déjà valides. */
export function compareDateKeysDesc(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

/**
 * Libellé d'ancienneté en langage terrain. `jours` = nombre de jours écoulés
 * depuis le fait (0 = aujourd'hui). Une date future (jours < 0) reste possible
 * pour une séance planifiée : on l'annonce alors au futur, jamais au passé.
 */
export function elapsedLabel(jours: number): string {
  if (!Number.isFinite(jours)) return "Date inconnue";
  const n = Math.round(jours);
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return "Hier";
  if (n === -1) return "Demain";
  if (n < -1) return `Dans ${Math.abs(n)} jours`;
  return `Il y a ${n} jours`;
}
