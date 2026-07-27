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
// ni "RGPD", ni "tuteur". Il y a un interrupteur d'acces, et une procedure
// humaine (documentee dans docs/coach-pilote-2026-07/AUTORISATION_ACCES.md) qui
// decide de le mettre sur "approved".
//
// ─── Les 3 notions sont SEPAREES ────────────────────────────────────────────
//  1. rattachement au club       = existence du document members/{playerUid} ;
//  2. autorisation de consultation = ce champ `coachAccess` ;
//  3. etape supplementaire mineur = ce qui fait passer de "pending" a "approved".
//
// Un joueur peut donc etre MEMBRE du club sans que son suivi soit lisible par le
// coach. C'est le cas NOMINAL d'un mineur tant que l'etape n'a pas ete faite —
// pas une anomalie, pas une erreur, pas un bug a corriger.
//
// ─── DEFAULT-DENY ───────────────────────────────────────────────────────────
// Toute valeur absente, vide, inconnue, mal typee ou non listee ci-dessous
// REFUSE l'acces. C'est ce qui protege les documents ANCIENS, ecrits avant
// l'existence de ce champ : ils n'ouvrent rien.

import { normalizeAgeCategory, type AgeCategory } from "./coachLabels";

/** Nom du champ, ecrit une seule fois ici (les fautes de frappe ouvrent des trous). */
export const COACH_ACCESS_FIELD = "coachAccess";

export const COACH_ACCESS_STATES = ["pending", "approved", "revoked", "not_required"] as const;
export type CoachAccessState = (typeof COACH_ACCESS_STATES)[number];

/**
 * Les DEUX seuls etats qui ouvrent la lecture du suivi.
 *
 * Cette liste est recopiee A LA MAIN dans firestore.rules (les regles ne peuvent
 * pas importer de TypeScript). Il n'existe donc AUCUN verrou automatique
 * d'egalite entre les deux ecritures : ce qui les tient, ce sont deux suites de
 * tests qui exercent les MEMES valeurs des deux cotes
 * (functions/tests/coachAccess.test.ts et firestore-tests/rules.coachAccess.test.ts).
 * Ajouter un etat autorisant ici SANS toucher les regles laisserait la base le
 * refuser — fail-closed, donc sans danger, mais silencieux : reporte toujours.
 */
export const COACH_ACCESS_GRANTING_STATES: readonly CoachAccessState[] = ["approved", "not_required"];

/**
 * Categories d'age qui declenchent une etape supplementaire avant consultation.
 *
 * Miroir de `domain/parentalConsent.CATEGORIES_REQUIRING_PARENTAL_CONSENT` cote
 * front. Volontairement des chaines litterales : le retrait eventuel de U13 dans
 * `domain/types.ts` ne doit rien casser ici.
 */
export const AGE_CATEGORIES_REQUIRING_EXTRA_STEP: readonly AgeCategory[] = ["U13", "U15"];

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

/** true si la categorie d'age impose une etape supplementaire AVANT consultation. */
export function requiresExtraStep(ageCategory: unknown): boolean {
  const cat = normalizeAgeCategory(ageCategory);
  if (!cat) return false; // "inconnu" n'est pas "mineur" : cf. initialCoachAccess
  return AGE_CATEGORIES_REQUIRING_EXTRA_STEP.includes(cat);
}

/**
 * Etat pose au RATTACHEMENT (joinClubWithInviteCode).
 *
 * - categorie exigeant une etape supplementaire  -> "pending" ;
 * - categorie connue et sans etape supplementaire -> "not_required" ;
 * - categorie INCONNUE ou ABSENTE                 -> "pending".
 *
 * Ce dernier cas EST le default-deny. On ne devine JAMAIS un age : un profil
 * incomplet, ancien, ou dont la categorie n'est pas reconnue est traite comme
 * s'il pouvait s'agir d'un mineur.
 */
export function initialCoachAccess(ageCategory: unknown): CoachAccessState {
  const cat = normalizeAgeCategory(ageCategory);
  if (!cat) return "pending";
  return AGE_CATEGORIES_REQUIRING_EXTRA_STEP.includes(cat) ? "pending" : "not_required";
}

/**
 * Etat apres un changement de profil (la categorie d'age a pu apparaitre ou
 * changer). Recalcul SERVEUR, jamais demande par un client.
 *
 * DEUX REGLES, et seulement deux :
 *  1. "approved" et "revoked" sont des DECISIONS HUMAINES : elles ne sont jamais
 *     ecrasees par un recalcul automatique. Seule la procedure documentee les
 *     modifie.
 *  2. Depuis tout autre etat (y compris absent/inconnu), on applique
 *     `initialCoachAccess`. Consequence voulue : ce recalcul peut RESSERRER
 *     ("not_required" -> "pending" si la categorie devient U15) et peut lever le
 *     doute initial ("pending" -> "not_required" quand la categorie devient
 *     connue et hors etape supplementaire). Il ne peut JAMAIS produire
 *     "approved" tout seul.
 *
 * POURQUOI lever le doute automatiquement : sans cela, un joueur majeur qui
 * rejoint le club AVANT d'avoir renseigne son profil resterait invisible pour
 * toujours. La categorie d'age est declarative (elle l'etait deja au setup) :
 * ce mecanisme donne une garantie TECHNIQUE d'interrupteur, pas une preuve
 * d'identite.
 */
export function resolveCoachAccess(current: unknown, ageCategory: unknown): CoachAccessState {
  const state = normalizeCoachAccess(current);
  if (state === "approved" || state === "revoked") return state;
  return initialCoachAccess(ageCategory);
}
