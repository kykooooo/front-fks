// state/selectors/blessures.ts
// =============================================================================
// LA SEULE LECTURE DES GENES DECLAREES
// =============================================================================
//
// POURQUOI CE FICHIER EXISTE
// -----------------------------------------------------------------------------
// Avant « Mon corps », la meme donnee etait lue a QUATRE endroits, avec DEUX
// fenetres differentes (DESIGN_MON_CORPS.md §1.4) :
//   - la generation considerait une gene active 7 jours ;
//   - le conseil du Home la considerait active UN SEUL JOUR.
// Resultat : un joueur pouvait recevoir une seance bridee par une gene dont
// l'app ne lui parlait plus depuis six jours.
//
// Il n'y a donc plus qu'une porte. `useBodyStore` n'est lu que par ce fichier
// et par les hooks de l'ecran dedie (`hooks/monCorps/`). Une sentinelle le
// verifie sur la source : `domain/__tests__/monCorpsLectureUnique.test.ts`.
//
// Les regles de decision sont PURES et exportees separement des accesseurs de
// store : les tests raisonnent sur des listes, jamais sur un store global.
// =============================================================================

import { useMemo } from "react";

import type { BodyInjury } from "../../domain/types";
import {
  collectActivePainConstraints,
  type ActivePainConstraints,
} from "../../services/aiContextHelpers";
import { lastNDates, toDateKey } from "../../utils/dateHelpers";
import { useBodyStore } from "../stores/useBodyStore";
import { useDebugStore } from "../stores/useDebugStore";

/**
 * Delai au bout duquel on REDEMANDE au joueur ou il en est (decision D5).
 *
 * 7 jours parce que c'est le chiffre deja partout dans le code
 * (`INJURY_ACTIVE_WINDOW_DAYS`, `TRACKING_CONFIG.pain.windowDays`). Ce qui
 * change, c'est ce qu'il declenche : une QUESTION, plus un oubli silencieux.
 * Sans reponse, la gene reste active — ce delai n'expire rien du tout.
 */
export const JOURS_AVANT_RELANCE = 7;

// ---------------------------------------------------------------------------
// 1. REGLES PURES (aucun store)
// ---------------------------------------------------------------------------

/** Les genes qui pesent encore : `active` ou `recovering`. Guéries exclues. */
export function genesEnCours(injuries: readonly BodyInjury[]): BodyInjury[] {
  return injuries.filter((b) => b.statut === "active" || b.statut === "recovering");
}

/** Les genes passees, pour l'historique replie de l'ecran. */
export function genesPassees(injuries: readonly BodyInjury[]): BodyInjury[] {
  return injuries.filter((b) => b.statut === "healed");
}

/**
 * Les genes en cours dont le joueur n'a plus rien dit depuis au moins
 * `JOURS_AVANT_RELANCE` jours.
 *
 * Compare des CLES DE JOUR LOCALES (`toDateKey`), jamais des millisecondes :
 * une mise a jour d'hier soir a 23 h ne doit pas devenir « il y a 1 jour » a
 * 1 h du matin. `lastNDates(todayKey, 7)` = [J0 ... J-6] : une gene touchee il
 * y a 6 jours y figure encore (pas de relance), il y a 7 jours non (relance).
 */
export function genesARelancer(injuries: readonly BodyInjury[], todayKey: string): BodyInjury[] {
  if (!todayKey) return [];
  const recents = new Set(lastNDates(todayKey, JOURS_AVANT_RELANCE));
  return genesEnCours(injuries).filter((b) => {
    const jour = toDateKey(b.updatedAt);
    if (!jour) return false;
    // Une date dans le futur (horloge virtuelle, import) ne declenche rien.
    if (jour > todayKey) return false;
    return !recents.has(jour);
  });
}

/**
 * La gene la plus preoccupante parmi celles en cours, ou `null` s'il n'y en a
 * aucune. Gravite d'abord, puis la plus recemment touchee. Jamais de moyenne,
 * jamais de score compose.
 */
export function geneLaPlusMarquante(injuries: readonly BodyInjury[]): BodyInjury | null {
  const enCours = genesEnCours(injuries);
  if (enCours.length === 0) return null;
  return [...enCours].sort((a, b) =>
    b.gravite !== a.gravite ? b.gravite - a.gravite : a.updatedAt < b.updatedAt ? 1 : -1
  )[0];
}

/** `true` si une gene encore en cours a ete declaree ce jour-la (cle jour locale). */
export function geneDeclareeLeJour(injuries: readonly BodyInjury[], jourKey: string): boolean {
  if (!jourKey) return false;
  return injuries.some((b) => b.statut !== "healed" && toDateKey(b.declaredAt) === jourKey);
}

// ---------------------------------------------------------------------------
// 2. ACCESSEURS DE STORE — LA SEULE LECTURE
// ---------------------------------------------------------------------------

/** Toutes les genes declarees, les plus recentes en tete. Lecture ponctuelle. */
export function lireBlessures(): BodyInjury[] {
  return useBodyStore.getState().bodyInjuries;
}

/**
 * Ce qui part au backend : `constraints.pains` + `constraints.injury_max_severity`.
 * Point d'entree unique de la generation (`services/aiContext.ts`).
 */
export function contraintesDouleurCourantes(): ActivePainConstraints {
  return collectActivePainConstraints(lireBlessures());
}

/** Les genes a relancer aujourd'hui (horloge virtuelle respectee). */
export function blessuresARelancerAujourdhui(): BodyInjury[] {
  const nowISO = useDebugStore.getState().devNowISO ?? new Date().toISOString();
  return genesARelancer(lireBlessures(), toDateKey(nowISO));
}

// ---------------------------------------------------------------------------
// 3. HOOKS — pour les ecrans qui doivent REAGIR a un changement
// ---------------------------------------------------------------------------

/** S'abonne a la liste complete. */
export function useBlessures(): BodyInjury[] {
  return useBodyStore((s) => s.bodyInjuries);
}

/** S'abonne aux contraintes transmises au moteur (ecran de seance en cours). */
export function useContraintesDouleur(): ActivePainConstraints {
  const injuries = useBlessures();
  return useMemo(() => collectActivePainConstraints(injuries), [injuries]);
}
