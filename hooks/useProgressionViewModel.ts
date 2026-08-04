// hooks/useProgressionViewModel.ts
// =============================================================================
// LE RESUME CANONIQUE, VU DEPUIS LA PAGE PROGRESSION
// =============================================================================
//
// La page Progression et la carte de l'accueil disent la meme chose, a partir du
// meme selecteur PUR (`screens/homeVNext/progressionViewModel.ts`) et du meme
// etat de stores (`hooks/home/useEtatStoresHome.ts`). C'est tout l'objet du
// resume canonique : le joueur qui tape « Voir ma progression » doit retrouver
// EXACTEMENT les chiffres qu'il vient de lire, pas une seconde version calculee
// autrement.
//
// UNE SEULE DIFFERENCE AVEC L'ACCUEIL, ET ELLE EST DECLAREE ICI :
// `semaineCourante.blocAffiche = false`.
//
// Ce champ ne dit pas « la semaine n'existe pas ». Il dit « aucun bloc de cette
// PAGE n'a deja affiche le compte de la semaine », ce qui est vrai et
// verifiable : le compteur hebdomadaire vit au Home, seul (decision fermee du
// fondateur). Sur l'accueil, le bloc « Ma semaine » existe, et le selecteur s'en
// sert pour ne pas redire le meme nombre a 300 px d'ecart ; ici, il n'y a rien a
// eviter.
//
// CE QUE CE HOOK NE FAIT PAS : construire le ViewModel de l'accueil. La page n'a
// besoin ni de l'action du jour, ni du bloc semaine, ni du bloc de demarrage —
// les calculer pour les jeter ferait payer a chaque rendu de la page un travail
// dont rien ne sort.
// =============================================================================

import { useMemo } from "react";

import {
  buildProgressionViewModel,
  type ProgressionSemaineCourante,
  type ProgressionViewModel,
} from "../screens/homeVNext/progressionViewModel";
import { construireEntreeProgression } from "./home/homeVNextAdapter";
import { useEtatStoresHome } from "./home/useEtatStoresHome";

/**
 * Sur la page Progression, aucun bloc n'affiche le compte de la semaine.
 * Constante de module : une reference stable, et une valeur qu'on peut citer
 * dans un test sans la reecrire.
 */
export const SEMAINE_NON_AFFICHEE: ProgressionSemaineCourante = {
  blocAffiche: false,
  seancesAffichees: 0,
};

export function useProgressionViewModel(): ProgressionViewModel {
  const etat = useEtatStoresHome();

  return useMemo(
    () => buildProgressionViewModel(construireEntreeProgression(etat, SEMAINE_NON_AFFICHEE)),
    [etat]
  );
}
