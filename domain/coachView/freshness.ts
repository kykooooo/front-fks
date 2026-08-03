// domain/coachView/freshness.ts
//
// « Ces chiffres datent de quand ? »
//
// Un espace coach qui affiche des données sans dire de quand elles datent laisse
// croire au temps réel. La projection serveur est asynchrone : elle peut avoir
// quelques minutes de retard, et le téléphone peut être hors ligne. On le dit.
//
// Module PUR : l'instant courant est INJECTÉ (`nowMs`), jamais lu via Date.now().

import type { CoachFreshness } from "./types";

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;

/** Au-delà, l'écran peut proposer d'actualiser (données probablement dépassées). */
export const FRAICHEUR_PERIMEE_MIN = 30;

const hhmm = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const memeJour = (a: number, b: number): boolean => {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

/**
 * Fraîcheur des données affichées.
 *
 * @param updatedAtMs date de la dernière synchronisation (ms epoch), ou null.
 * @param nowMs       instant courant (ms epoch), injecté par l'appelant.
 */
export function buildFreshness(updatedAtMs: number | null, nowMs: number): CoachFreshness {
  if (
    updatedAtMs === null ||
    !Number.isFinite(updatedAtMs) ||
    !Number.isFinite(nowMs) ||
    updatedAtMs <= 0
  ) {
    return { libelle: "Données jamais synchronisées", ageMinutes: null, perimee: true };
  }

  // Horloge du téléphone en retard sur le serveur → écart négatif. On ne va pas
  // annoncer une mise à jour "dans le futur" : on la traite comme instantanée.
  const delta = Math.max(0, nowMs - updatedAtMs);
  const ageMinutes = Math.floor(delta / MINUTE);
  const perimee = ageMinutes >= FRAICHEUR_PERIMEE_MIN;

  let libelle: string;
  if (delta < 45_000) {
    libelle = "Mis à jour à l'instant";
  } else if (delta < HEURE) {
    libelle = `Mis à jour il y a ${ageMinutes} min`;
  } else if (memeJour(updatedAtMs, nowMs)) {
    libelle = `Mis à jour à ${hhmm(updatedAtMs)}`;
  } else if (memeJour(updatedAtMs, nowMs - 24 * HEURE)) {
    libelle = `Mis à jour hier à ${hhmm(updatedAtMs)}`;
  } else {
    const d = new Date(updatedAtMs);
    const jour = String(d.getDate()).padStart(2, "0");
    const mois = String(d.getMonth() + 1).padStart(2, "0");
    libelle = `Mis à jour le ${jour}/${mois} à ${hhmm(updatedAtMs)}`;
  }

  return { libelle, ageMinutes, perimee };
}

/** Raccourci quand seul le texte est utile. */
export function buildFreshnessLabel(updatedAtMs: number | null, nowMs: number): string {
  return buildFreshness(updatedAtMs, nowMs).libelle;
}
