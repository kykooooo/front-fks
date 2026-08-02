// hooks/coach/useCoachAttention.ts
//
// Liste "À vérifier aujourd'hui" : les joueurs qui méritent une LECTURE HUMAINE.
//
// Ce hook est volontairement VIDE de règles : il ne décide ni d'un niveau, ni
// d'un seuil, ni d'un tri. Les signaux viennent de domain/coachView/attention
// (via toCoachPlayerView), le filtrage et le tri de domain/coachView/roster.
// Ici on ne fait que mémoriser le résultat pour ne pas retrier l'effectif à
// chaque rendu.
//
// RAPPEL DE CADRE (ce que la liste n'est PAS) : ni score de risque, ni
// prédiction de blessure, ni classement entre joueurs. C'est une file d'attente
// d'attention : "regarde ces profils, l'app ne peut pas conclure à ta place".
//
// Deux niveaux SÉPARÉS, jamais fusionnés en un seul tas :
//   à vérifier   (statut "check") = signal clair, lecture humaine nécessaire ;
//   à surveiller (statut "watch") = signal léger ou données incomplètes.

import { useMemo } from "react";

import {
  buildCoachRoster,
  countCoachRosterFilters,
  type CoachRosterFilter,
} from "../../domain/coachView/roster";
import type { CoachPlayerView } from "../../domain/coachView/types";

export type CoachAttentionState = {
  /** Statut "check", trié par priorité de lecture. */
  aVerifier: CoachPlayerView[];
  /** Statut "watch", trié par priorité de lecture. */
  aSurveiller: CoachPlayerView[];
  /** Compteurs par filtre, sur l'effectif COMPLET (pour les onglets/pastilles). */
  counts: Record<CoachRosterFilter, number>;
};

/**
 * @param views effectif déjà mis en forme (useCoachRoster.views).
 */
export function useCoachAttention(views: CoachPlayerView[]): CoachAttentionState {
  return useMemo(
    () => ({
      aVerifier: buildCoachRoster(views, { filter: "a_verifier", sort: "priorite" }),
      aSurveiller: buildCoachRoster(views, { filter: "a_surveiller", sort: "priorite" }),
      counts: countCoachRosterFilters(views),
    }),
    [views],
  );
}
