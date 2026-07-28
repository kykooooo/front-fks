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

import type { AppSpace, PlayerFollowState } from "../domain/appSpace";

export type AppSpaceSwitchState = {
  /**
   * La personne a-t-elle REELLEMENT les deux espaces ? Derive du serveur
   * (`domain/appSpace.espacesDisponibles`), jamais d'une preference locale.
   */
  peutChoisir: boolean;
  /** L'espace actuellement affiche. */
  espace: AppSpace;
  /**
   * SON SUIVI SPORTIF DANS SON CLUB : `actif`, `inactif`, `inconnu`.
   *
   * POURQUOI IL VOYAGE PAR CE PORTILLON-CI plutot que par un second relais : il
   * vient du MEME instantane Firestore que `peutChoisir` (l'appartenance
   * `clubs/{clubId}/members/{uid}`, lue une seule fois a la racine). Un second
   * portillon aurait signifie un second abonnement, ou pire, deux etats derives
   * du meme document a des instants differents — la divergence que tout ce
   * perimetre s'interdit.
   *
   * Ce que ca sert : la carte « Je m'entraine aussi » (espace coach) doit savoir
   * lequel des deux gestes proposer. `peutChoisir` ne suffit pas — il repond a
   * une autre question, et il vaut faux dans DEUX situations opposees.
   */
  suiviJoueur: PlayerFollowState;
  /**
   * Memorise un choix. N'ouvre RIEN : la preference ne fait que choisir entre
   * deux espaces deja autorises (cf. domain/appSpace.resolveAppSpace).
   */
  choisir: (espace: AppSpace) => void;
};

/**
 * Etat ferme : aucun selecteur, aucun geste de suivi propose, et un `choisir`
 * qui ne fait rien. `suiviJoueur: "inconnu"` est le pendant exact de
 * `peutChoisir: false` — tant que la racine n'a rien publie, on n'affirme rien.
 */
const FERME: AppSpaceSwitchState = {
  peutChoisir: false,
  espace: "player",
  suiviJoueur: "inconnu",
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
