// state/appSpaceGate.ts
//
// LE PORTEUR DU SELECTEUR D'ESPACE (Joueur / Coach).
//
// ─── LE PROBLEME QU'IL RESOUD ───────────────────────────────────────────────
// Le droit aux deux espaces est derive UNE SEULE FOIS, a la racine
// (`hooks/useAppSpace`, monte par `navigation/RootNavigator`). Le SELECTEUR,
// lui, doit s'afficher dans les DEUX espaces — reglages joueur d'un cote,
// ecran Semaine du coach de l'autre — c'est-a-dire loin en dessous.
//
// Deux solutions etaient possibles, et l'une d'elles est un piege :
//   . rappeler `useAppSpace` dans chaque ecran -> DEUXIEME abonnement Firestore
//     ET deuxieme lecture de la preference locale. C'est-a-dire deux etats qui
//     se croient tous les deux vrais : exactement la divergence que tout ce
//     peirmetre s'interdit ;
//   . RELAYER l'etat deja derive. C'est ce fichier.
//
// ─── POURQUOI UN SINGLETON DE MODULE, ET PAS UN CONTEXTE ────────────────────
// Ce depot n'a AUCUN contexte React — il diffuse par singleton de module
// (utils/toast, utils/offlineQueue, state/coachAuthorityGate). On suit la
// maison, et on suit surtout le fichier voisin qui fait deja exactement ca pour
// l'autorite coach.
//
// Ce n'est PAS une source de verite : ce module ne DECIDE rien, il RELAIE ce que
// `useAppSpace` a derive de `clubs/{clubId}/members/{uid}`. Personne d'autre que
// la racine n'a le droit d'appeler `publishAppSpaceSwitch`.
//
// ─── ETAT INITIAL : FERME (et c'est l'inverse de coachAuthorityGate) ────────
// Tant que rien n'a ete publie, `peutChoisir` vaut `false` : aucun selecteur
// nulle part. Le contraste avec `coachAuthorityGate` (qui laisse passer par
// defaut) est VOLONTAIRE, parce que les deux portillons ne gardent pas la meme
// chose : la-bas, fermer par defaut viderait des ecrans en test sans que
// personne comprenne ; ici, ouvrir par defaut afficherait un bouton « Passer en
// espace coach » a quelqu'un qui n'y a aucun droit. Un bouton qui ne mene nulle
// part est le genre de promesse vide qu'on refuse.

import type { AppSpace } from "../domain/appSpace";

export type AppSpaceSwitchState = {
  /**
   * La personne a-t-elle REELLEMENT les deux espaces ? Derive du serveur
   * (`domain/appSpace.espacesDisponibles`), jamais d'une preference locale.
   */
  peutChoisir: boolean;
  /** L'espace actuellement affiche. */
  espace: AppSpace;
  /**
   * Memorise un choix. N'ouvre RIEN : la preference ne fait que choisir entre
   * deux espaces deja autorises (cf. domain/appSpace.resolveAppSpace).
   */
  choisir: (espace: AppSpace) => void;
};

/** Etat ferme : aucun selecteur, et un `choisir` qui ne fait rien. */
const FERME: AppSpaceSwitchState = {
  peutChoisir: false,
  espace: "player",
  choisir: () => {},
};

let courant: AppSpaceSwitchState = FERME;
type Ecouteur = (etat: AppSpaceSwitchState) => void;
const ecouteurs = new Set<Ecouteur>();

/** Publie l'etat courant. RESERVE a `navigation/RootNavigator`. */
export function publishAppSpaceSwitch(prochain: AppSpaceSwitchState): void {
  courant = prochain;
  for (const ecouteur of [...ecouteurs]) {
    try {
      ecouteur(prochain);
    } catch {
      // Un abonne qui echoue ne doit jamais empecher les autres d'etre notifies.
    }
  }
}

export function readAppSpaceSwitch(): AppSpaceSwitchState {
  return courant;
}

/** S'abonne. Rend la fonction de desabonnement. */
export function onAppSpaceSwitchChange(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}

/**
 * Remet le portillon a l'etat ferme. RESERVE AUX TESTS : en production, l'etat
 * n'est jamais depublie — il change de valeur.
 */
export function resetAppSpaceGateForTests(): void {
  courant = FERME;
  ecouteurs.clear();
}
