// state/coachAuthorityGate.ts
//
// LE PORTEUR DE L'AUTORITE COACH, ET LE SIGNAL DE PURGE.
//
// ─── LE TROU QUE CE FICHIER FERME ───────────────────────────────────────────
// Les hooks coach ont deja une garde anti-reponse tardive. Elle est indexee sur
// la ROUTE : « cette reponse parle-t-elle encore du club / du joueur affiche ? ».
// Elle est correcte, et elle ne couvre PAS le cas qui nous occupe : meme club,
// meme joueur, meme ecran — mais l'autorite a change entre le depart de la
// requete et son retour. La reponse passe alors toutes les gardes et repeuple
// l'ecran avec des donnees qui viennent d'etre retirees.
//
// La correction est un JETON D'AUTORITE, et deux details comptent plus que le
// reste :
//   1. il est porte par l'AUTORITE, pas par la requete. Une requete ne sait pas
//      qu'elle a ete revoquee ; l'autorite, elle, le sait ;
//   2. il est verifie AU MOMENT D'ECRIRE dans l'etat, jamais a l'emission. Une
//      verification a l'emission laisse grande ouverte la seule fenetre qui
//      compte : celle du vol.
//
// ─── POURQUOI UN SINGLETON DE MODULE, ET PAS UN CONTEXTE ────────────────────
// L'autorite est publiee par `hooks/useAppSpace` (la racine) et lue par les
// hooks coach (les feuilles). Ce depot n'a AUCUN contexte React — il diffuse par
// singleton de module (utils/toast, utils/offlineQueue). On suit la maison.
//
// Ce n'est PAS une seconde source de verite : ce module ne DECIDE rien, il
// RELAIE ce que `useAppSpace` a derive de `clubs/{clubId}/members/{uid}.role`.
// Personne d'autre n'a le droit d'appeler `publishCoachAuthority` — un second
// emetteur recreerait exactement la divergence que le lot precedent a fermee.
//
// ─── CE QU'IL FAUT SAVOIR SUR L'ETAT INITIAL (choix assume) ─────────────────
// Tant que PERSONNE n'a publie d'autorite, le portillon laisse passer. Fail-open,
// donc, et il faut dire pourquoi plutot que de le cacher :
//
//   . ce portillon n'est pas un controle d'acces. Les controles d'acces sont les
//     regles Firestore et les Cloud Functions. Lui empeche une donnee DEJA
//     autorisee de survivre a la perte de son autorisation ;
//   . il ne peut pas etre « non publie » dans l'application reelle :
//     `RootNavigator` monte `useAppSpace` a la racine et ne rend l'espace coach
//     qu'apres publication d'un `autorise` ;
//   . un portillon ferme par defaut casserait silencieusement tout montage d'un
//     ecran coach hors navigateur (tests unitaires, previsualisation) — c'est-a-dire
//     qu'il produirait des ecrans vides sans que personne ne sache pourquoi.
//
// Une fois la premiere publication faite, l'application est verrouillee : le
// portillon ne redevient jamais « non publie ».

import type { CoachAuthorityStatut } from "../domain/coachAuthority";
import { ouvreEspaceCoach } from "../domain/coachAuthority";

/** Ce que la racine diffuse : un etat d'autorite, et le jeton qui le date. */
export type CoachAuthorityBroadcast = {
  statut: CoachAuthorityStatut;
  /**
   * Compteur monotone incremente A CHAQUE CHANGEMENT d'autorite (compte, club,
   * statut, role). Deux instantanes identiques ne le bougent pas : une lecture
   * en vol sous une autorite stable doit pouvoir s'appliquer normalement, sinon
   * le garde-fou deviendrait un blocage.
   */
  jeton: number;
};

/**
 * Raison d'une purge. Elle n'est affichee nulle part — l'ecran, lui, dit ce
 * qu'il constate. Elle sert a rendre les tests lisibles et a distinguer, dans un
 * journal, une revocation reelle d'une simple revalidation.
 */
export type CoachPurgeRaison = "revocation" | "revalidation" | "incertitude" | "fermeture";

type Ecouteur = (raison: CoachPurgeRaison) => void;

/**
 * `null` = aucune autorite publiee (cf. l'entete : le portillon laisse passer).
 * Ce n'est PAS un etat d'autorite, c'est l'absence de branchement.
 */
let courant: CoachAuthorityBroadcast | null = null;
const ecouteurs = new Set<Ecouteur>();

/**
 * Publie l'autorite courante. RESERVE a `hooks/useAppSpace`.
 *
 * Effet de bord voulu : toute publication dont le statut n'ouvre PAS l'espace
 * coach declenche la purge. La purge est donc impossible a oublier — elle n'est
 * pas un appel separe qu'un futur ecran pourrait omettre, elle est la
 * consequence mecanique de la perte d'autorite.
 */
export function publishCoachAuthority(prochain: CoachAuthorityBroadcast): void {
  const precedent = courant;
  courant = prochain;
  if (ouvreEspaceCoach(prochain.statut)) return;
  // Rien a purger si l'on n'a jamais rien ouvert : evite une rafale de purges
  // au demarrage (`chargement` initial) chez des abonnes qui n'ont rien charge.
  if (precedent === null && prochain.statut === "chargement") return;
  notifier(raisonDe(prochain.statut, precedent));
}

function raisonDe(
  statut: CoachAuthorityStatut,
  precedent: CoachAuthorityBroadcast | null,
): CoachPurgeRaison {
  if (statut === "indetermine") return "incertitude";
  if (statut === "chargement") return "revalidation";
  // `refuse` : une revocation si l'espace etait ouvert, une simple fermeture
  // sinon (changement de compte, joueur sans encadrement, club quitte).
  return precedent && ouvreEspaceCoach(precedent.statut) ? "revocation" : "fermeture";
}

function notifier(raison: CoachPurgeRaison): void {
  // Copie de la collection : un abonne qui se desabonne pendant la diffusion ne
  // doit pas faire sauter les suivants.
  for (const ecouteur of [...ecouteurs]) {
    try {
      ecouteur(raison);
    } catch {
      // Un abonne qui echoue ne doit jamais empecher les autres d'etre purges.
    }
  }
}

/** Jeton courant, a CAPTURER au depart d'une lecture coach. */
export function currentCoachAuthorityToken(): number {
  return courant?.jeton ?? 0;
}

/** Autorite publiee, ou `null` si la racine n'a encore rien publie. */
export function readCoachAuthority(): CoachAuthorityBroadcast | null {
  return courant;
}

/**
 * LA VERIFICATION AU MOMENT D'ECRIRE.
 *
 * @param jetonCapture jeton lu au DEPART de la lecture.
 * @returns true si cette reponse peut encore etre ecrite dans l'etat.
 *
 * Les deux conditions sont verifiees, et pas seulement l'egalite des jetons :
 * l'egalite suffirait aujourd'hui (tout changement de statut incremente le
 * jeton), mais elle reposerait sur une propriete d'un AUTRE fichier. Verifier
 * aussi le statut rend l'invariant vrai localement, donc increvable.
 */
export function canCommitCoachData(jetonCapture: number): boolean {
  if (courant === null) return true; // portillon non branche : cf. entete
  return courant.jeton === jetonCapture && ouvreEspaceCoach(courant.statut);
}

/**
 * S'abonne a la purge. Rend la fonction de desabonnement.
 *
 * A utiliser par TOUT detenteur de donnees coach qui n'est pas garanti demonte
 * par la fermeture de l'espace (store, cache, contexte). Les hooks coach s'y
 * abonnent quand meme : leur demontage est aujourd'hui la vraie purge, mais un
 * demontage est une propriete de l'arbre React, pas une garantie ecrite.
 */
export function onCoachDataPurge(ecouteur: Ecouteur): () => void {
  ecouteurs.add(ecouteur);
  return () => {
    ecouteurs.delete(ecouteur);
  };
}

/**
 * Remet le portillon a l'etat « non branche ». RESERVE AUX TESTS : en
 * production, l'autorite n'est jamais depubliee — elle change de valeur.
 */
export function resetCoachAuthorityGateForTests(): void {
  courant = null;
  ecouteurs.clear();
}
