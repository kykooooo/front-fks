// utils/microcycleUtils.ts
//
// AFFICHAGE UNIQUEMENT — dérive une "phase" lisible par le joueur à partir de sa
// position dans le microcycle (`microcycleSessionIndex`, lu dans le store).
//
// ⚠️ Ce fichier NE touche À RIEN du moteur : ni au champ `phase` de la session
//    (qui vaut "Playlist"), ni à l'avancement du cycle (applyFeedback.ts), ni à la
//    génération, ni au contexte IA. Il calcule une valeur d'affichage dérivée.
//
// ⚠️ MAPPING À GARDER SYNCHRO AVEC LA PÉRIODISATION DU BACKEND.
//    Le moteur découpe un cycle de 12 séances en 4 phases selon la position de la
//    séance. Le mapping ci-dessous doit refléter exactement ce découpage :
//      - séances 1 → 4   : "base"    → "Fondations"
//      - séances 5 → 8   : "build_1" → "Montée en puissance"
//      - séances 9 → 11  : "build_2" → "Pic de forme"
//      - séance  12      : "deload"  → "Relâche"
//    Si MICROCYCLE_TOTAL_SESSIONS_DEFAULT change, revoir ces bornes pour rester aligné.

import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../domain/microcycles";

/** Clés techniques internes — NE JAMAIS afficher au joueur (jargon). */
export type MicrocyclePhaseKey = "base" | "build_1" | "build_2" | "deload";

export type MicrocyclePhaseMeta = {
  key: MicrocyclePhaseKey;
  /** Libellé joueur, motivant, sans jargon. */
  label: string;
  /** Phrase de sens (perf & progression, zéro médical / zéro peur). */
  meaning: string;
};

export type MicrocyclePhaseInfo = MicrocyclePhaseMeta & {
  /** Numéro de la séance courante (1-based, borné à `total`). */
  sessionNumber: number;
  total: number;
};

export const MICROCYCLE_PHASES: Record<MicrocyclePhaseKey, MicrocyclePhaseMeta> = {
  base: {
    key: "base",
    label: "Fondations",
    meaning: "Tu poses les bases — du propre avant de charger.",
  },
  build_1: {
    key: "build_1",
    label: "Montée en puissance",
    meaning: "Ça grimpe : le volume monte, ton corps encaisse plus.",
  },
  build_2: {
    key: "build_2",
    label: "Pic de forme",
    meaning: "Le sommet du cycle — c'est ici que tu prends le plus. Donne tout.",
  },
  deload: {
    key: "deload",
    label: "Relâche",
    meaning: "On lève le pied pour absorber tout le travail. Tu repars plus fort.",
  },
};

/** Ordre des phases pour l'affichage du "voyage" du cycle. */
export const MICROCYCLE_PHASE_ORDER: MicrocyclePhaseKey[] = [
  "base",
  "build_1",
  "build_2",
  "deload",
];

const clampTotal = (total?: number): number =>
  Number.isFinite(total) && (total as number) > 0
    ? Math.trunc(total as number)
    : MICROCYCLE_TOTAL_SESSIONS_DEFAULT;

/**
 * Phase d'une séance donnée (numéro 1-based). Bornes calées sur la périodisation
 * backend (cycle de 12 séances). Robuste aux entrées hors bornes.
 */
export function phaseKeyForSession(
  sessionNumber: number,
  total: number = MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
): MicrocyclePhaseKey {
  const t = clampTotal(total);
  const raw = Number.isFinite(sessionNumber) ? Math.trunc(sessionNumber) : 1;
  const n = Math.min(t, Math.max(1, raw));
  if (n >= t) return "deload"; // dernière séance = relâche
  if (n <= 4) return "base"; // 1 → 4
  if (n <= 8) return "build_1"; // 5 → 8
  return "build_2"; // 9 → avant-dernière
}

/**
 * Phase courante du joueur, dérivée du nombre de séances déjà validées
 * (`microcycleSessionIndex`, 0-based). La séance courante = index + 1.
 */
export function getMicrocyclePhase(
  microcycleSessionIndex: number,
  total: number = MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
): MicrocyclePhaseInfo {
  const t = clampTotal(total);
  const idx = Math.max(
    0,
    Math.trunc(Number.isFinite(microcycleSessionIndex) ? microcycleSessionIndex : 0),
  );
  const sessionNumber = Math.min(t, idx + 1);
  const meta = MICROCYCLE_PHASES[phaseKeyForSession(sessionNumber, t)];
  return { ...meta, sessionNumber, total: t };
}

export type MicrocyclePhaseRange = MicrocyclePhaseMeta & {
  /** Première séance de la phase (1-based, inclusif). */
  start: number;
  /** Dernière séance de la phase (1-based, inclusif). */
  end: number;
  /** Nombre de séances dans la phase. */
  count: number;
};

/**
 * Regroupe les séances en blocs de phase (1-based, inclusifs) — sert à
 * regrouper/teinter la timeline pour visualiser le voyage du cycle.
 * Ne retourne que les phases non vides, dans l'ordre.
 */
export function getMicrocyclePhaseRanges(
  total: number = MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
): MicrocyclePhaseRange[] {
  const t = clampTotal(total);
  const groups: MicrocyclePhaseRange[] = [];
  for (let n = 1; n <= t; n++) {
    const key = phaseKeyForSession(n, t);
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) {
      groups.push({ ...MICROCYCLE_PHASES[key], start: n, end: n, count: 1 });
    } else {
      last.end = n;
      last.count += 1;
    }
  }
  return groups;
}
