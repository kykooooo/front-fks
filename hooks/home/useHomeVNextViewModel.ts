// hooks/home/useHomeVNextViewModel.ts
// =============================================================================
// LES DEUX VIEWMODELS DE L'ACCUEIL
// =============================================================================
//
// Ce hook prend l'etat rendu par `useEtatStoresHome()` (la seule lecture de
// stores du chantier) et le passe a l'adaptateur PUR (`./homeVNextAdapter`) puis
// aux deux selecteurs PURS (`screens/homeVNext/viewModel.ts`,
// `progressionViewModel.ts`). Aucune regle d'affichage ne vit ici — s'il fallait
// en ecrire une, sa place serait dans le selecteur, ou elle est testable sans
// monter React.
//
// LA DIFFERENCE AVEC `useProgressionViewModel` (hooks/useProgressionViewModel.ts,
// que consomme la page Progression) tient en un seul champ : `semaineCourante`.
// L'accueil affiche un bloc « Ma semaine », la page non. C'est ce champ qui
// empeche la carte de redire, 300 px plus bas, le chiffre que le bloc vient
// d'annoncer.
// =============================================================================

import { useMemo } from "react";

import { HOME_FEATURES } from "../../config/homeFeatures";
import {
  buildHomeVNextViewModel,
  type HomeVNextInput,
  type HomeVNextViewModel,
} from "../../screens/homeVNext/viewModel";
import {
  buildProgressionViewModel,
  type ProgressionViewModel,
} from "../../screens/homeVNext/progressionViewModel";
import {
  construireEntreeHome,
  construireEntreeProgression,
  construireSemaineCouranteDepuisLeHome,
  type EtatStoresHome,
} from "./homeVNextAdapter";
import { useEtatStoresHome } from "./useEtatStoresHome";

export type HomeVNextViewModels = {
  /** Le ViewModel de l'ecran. */
  vm: HomeVNextViewModel;
  /** Le ViewModel de la carte progression (variante 2). */
  progression: ProgressionViewModel;
  /** L'entree exacte qui a produit les deux — utile au visualiseur et au debug. */
  etat: EtatStoresHome;
  /**
   * L'entree normalisee du selecteur d'ecran.
   *
   * Exposee pour UNE raison precise : le conteneur doit savoir SUR QUELLE
   * SEANCE le ViewModel a fonde son action, pour naviguer vers celle-la et pas
   * une autre. `HomeVNextViewModel` ne porte deliberement aucun identifiant —
   * une couche de presentation n'a pas a transporter de cle technique — et
   * re-selectionner la seance dans le conteneur ouvrirait l'ecart : entre le
   * calcul et le tap, un watcher Firestore peut changer la selection, et le
   * joueur partirait sur une seance qu'il n'a jamais vue a l'ecran.
   */
  entree: HomeVNextInput;
};

export function useHomeVNextViewModel(): HomeVNextViewModels {
  const etat = useEtatStoresHome();

  return useMemo(() => {
    const entreeHome = construireEntreeHome(etat);
    // Variante 2 : decision fermee. Bloc de demarrage V-A : pilote par
    // `HOME_FEATURES.DEMARRAGE_PREMIERE_MISSION` (OFF depuis la decision
    // Kyllian du 04/08 — voir config/homeFeatures.ts). Sans lui, l'option
    // `demarrage` vaut `undefined` et le ViewModel se comporte exactement
    // comme s'il n'existait pas : c'est le SEUL endroit de l'app qui decide
    // "A" ou rien, pour que ce choix ne puisse pas diverger d'un montage a
    // l'autre.
    const vm = buildHomeVNextViewModel(entreeHome, {
      variante: "v2",
      demarrage: HOME_FEATURES.DEMARRAGE_PREMIERE_MISSION ? "A" : undefined,
    });

    // R7 — la carte progression a besoin de savoir ce que « Ma semaine » affiche
    // DEJA sur le meme ecran, pour ne pas redire le meme chiffre. On le lui donne
    // depuis le ViewModel qui vient d'etre construit : pas de second calcul.
    // Le cablage est une fonction PURE et testee
    // (`construireSemaineCouranteDepuisLeHome`) : ecrit en ligne ici, il etait
    // vrai par construction et protege par aucun test.
    const progression = buildProgressionViewModel(
      construireEntreeProgression(etat, construireSemaineCouranteDepuisLeHome(vm))
    );

    return { vm, progression, etat, entree: entreeHome };
  }, [etat]);
}
