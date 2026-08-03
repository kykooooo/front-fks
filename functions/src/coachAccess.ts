// functions/src/coachAccess.ts
//
// ETAT SERVEUR D'AUTORISATION D'ACCES AUX DONNEES DE SUIVI D'UN JOUEUR.
//
// Module PUR (aucun Firestore, aucune horloge). C'est la SEULE source de verite
// de la decision "le coach a-t-il le droit de lire le suivi de ce joueur ?".
// Les regles Firestore, le projecteur serveur et le front lisent tous le meme
// champ, avec la meme convention.
//
// ─── Le champ ────────────────────────────────────────────────────────────────
// Porte : clubs/{clubId}/members/{playerUid}.coachAccess
// Valeurs : "pending" | "approved" | "revoked" | "not_required".
//
// Vocabulaire PRODUIT et NEUTRE, volontairement. Ce code ne pretend PAS resoudre
// le consentement des mineurs : il n'y a ici ni "consentement", ni "parental",
// ni "RGPD", ni "tuteur". Il y a un interrupteur d'acces, et une politique
// portee par le club (joinAccessPolicy.ts) qui decide de sa position au
// rattachement.
//
// ─── Les 3 notions sont SEPAREES ────────────────────────────────────────────
//  1. rattachement au club         = existence du document members/{playerUid} ;
//  2. autorisation de consultation = ce champ `coachAccess` ;
//  3. politique du club            = ce qui decide de l'etat pose en 2 quand un
//     joueur entre (functions/src/joinAccessPolicy.ts).
//
// Un joueur peut donc etre MEMBRE du club sans que son suivi soit lisible par le
// coach. Sous le mode "approval_required", c'est meme le cas NOMINAL tant qu'une
// decision humaine n'a pas ete prise — pas une anomalie, pas un bug a corriger.
//
// ─── AUCUN VERROU D'AGE ICI ────────────────────────────────────────────────
// Ce module NE LIT PAS la categorie d'age, et ne doit jamais la relire. L'ancien
// mecanisme posait "pending" a tout U13/U15, alors qu'aucun ecran d'approbation
// n'existe : le resultat n'etait pas une protection, c'etait un effectif vide
// pour un club de jeunes. La decision produit (Kyllian, juillet 2026) l'a
// remplace par une politique CONFIGURABLE PAR CLUB. Le raisonnement complet, et
// le risque residuel assume, sont dans joinAccessPolicy.ts et dans
// docs/coach-pilote-2026-07/AUTORISATION_ACCES.md.
//
// ─── DEFAULT-DENY, INTACT ───────────────────────────────────────────────────
// Toute valeur absente, vide, inconnue, mal typee ou non listee ci-dessous
// REFUSE l'acces. C'est ce qui protege les documents ANCIENS, ecrits avant
// l'existence de ce champ : ils n'ouvrent rien. Retirer le verrou d'age n'a
// RIEN change a ce verrou-la : ce sont deux questions differentes (le premier
// portait sur un attribut du joueur, celui-ci porte sur la valeur du champ).

import { resolveJoinAccessPolicy } from "./joinAccessPolicy";

/** Nom du champ, ecrit une seule fois ici (les fautes de frappe ouvrent des trous). */
export const COACH_ACCESS_FIELD = "coachAccess";

export const COACH_ACCESS_STATES = ["pending", "approved", "revoked", "not_required"] as const;
export type CoachAccessState = (typeof COACH_ACCESS_STATES)[number];

/**
 * Les DEUX seuls etats qui ouvrent la lecture du suivi.
 *
 * Cette liste est recopiee A LA MAIN dans firestore.rules (les regles ne peuvent
 * pas importer de TypeScript), dans la fonction nommee `coachAccessGrantingStates()`.
 * Deux suites de tests exercent les MEMES valeurs des deux cotes
 * (functions/tests/coachAccess.test.ts et firestore-tests/rules.coachAccess.test.ts),
 * et cette derniere porte EN PLUS un verrou litteral (section E) qui compare
 * cette constante au contenu de `coachAccessGrantingStates()`. Ajouter un etat
 * autorisant ici SANS toucher les regles fait donc echouer ce test — plus un
 * refus silencieux.
 */
export const COACH_ACCESS_GRANTING_STATES: readonly CoachAccessState[] = ["approved", "not_required"];

/** Etat reconnu, ou `null` si la valeur n'est pas un etat connu (default-deny). */
export function normalizeCoachAccess(value: unknown): CoachAccessState | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return (COACH_ACCESS_STATES as readonly string[]).includes(v) ? (v as CoachAccessState) : null;
}

/**
 * LA question. Deny-first : on n'autorise que sur une valeur EXPLICITEMENT
 * autorisante. Absent, vide, "APPROVED", true, 1, {} -> refus.
 */
export function isCoachAccessGranted(value: unknown): boolean {
  const state = normalizeCoachAccess(value);
  return state !== null && COACH_ACCESS_GRANTING_STATES.includes(state);
}

/** Meme question, en partant du document membership brut. */
export function isMembershipCoachAccessGranted(membership: Record<string, unknown> | null): boolean {
  if (!membership) return false;
  return isCoachAccessGranted(membership[COACH_ACCESS_FIELD]);
}

/**
 * Etat pose au RATTACHEMENT (joinClubWithInviteCode), en fonction de la SEULE
 * politique du club :
 *
 *  - "automatic_safe_projection" (defaut) -> "not_required" ;
 *  - "approval_required"                  -> "pending".
 *
 * Politique absente, vide, inconnue ou mal typee -> le defaut serveur, donc
 * "not_required" (cf. joinAccessPolicy.ts, section DEFAUT vs FAIL-CLOSED).
 *
 * AUCUNE autre entree. Ni l'age, ni le poste, ni le niveau, ni quoi que ce soit
 * qui vienne du profil du joueur : deux joueurs qui rejoignent le meme club avec
 * le meme code obtiennent le meme etat, point. C'est verifie par un test qui
 * fait entrer un mineur et un adulte dans les memes conditions.
 */
export function initialCoachAccess(policy: unknown): CoachAccessState {
  return resolveJoinAccessPolicy(policy) === "approval_required" ? "pending" : "not_required";
}

/**
 * Etat a appliquer quand on (re)passe sur un membership : trigger de profil,
 * script de mise a niveau. Recalcul SERVEUR, jamais demande par un client.
 *
 * UNE SEULE REGLE, et elle est volontairement plus stricte qu'avant :
 *  1. tout etat DEJA POSE et VALIDE est conserve tel quel — "pending",
 *     "approved", "revoked" ET "not_required" ;
 *  2. c'est seulement quand il n'y a PAS d'etat valide (champ absent, vide, mal
 *     type, valeur inconnue) qu'on pose l'etat initial de la politique.
 *
 * POURQUOI CONSERVER MEME "pending" ET "not_required" (c'est le point delicat).
 * La politique gouverne le RATTACHEMENT, pas la vie du membership. Si ce
 * recalcul reappliquait la politique a chaque passage, alors changer la
 * politique d'un club reevaluerait EN SILENCE tous ses membres deja rattaches,
 * au premier evenement venu (une simple sauvegarde de profil). Un club qui
 * bascule en "approval_required" verrait son effectif disparaitre sans que
 * personne n'ait rien demande — exactement la panne qu'on vient de corriger,
 * a l'envers. Consequence assumee et documentee : changer la politique n'agit
 * que sur les joueurs qui rejoignent APRES le changement.
 *
 * Ce recalcul ne peut donc JAMAIS produire "approved" tout seul, ni retirer un
 * acces, ni en ouvrir un qui avait ete ferme.
 */
export function resolveCoachAccess(current: unknown, policy: unknown): CoachAccessState {
  const state = normalizeCoachAccess(current);
  if (state !== null) return state;
  return initialCoachAccess(policy);
}
