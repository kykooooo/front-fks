// functions/src/coachAccessPolicy.ts
//
// POLITIQUE D'ACCES COACH, PORTEE PAR LE CLUB.
//
// Module SERVEUR PUR : aucun Firestore, aucune horloge, AUCUNE dependance front.
// C'est ici, et nulle part ailleurs, que se decide quel etat d'autorisation est
// pose sur un joueur AU MOMENT OU IL REJOINT un club.
//
// ─── Le champ ────────────────────────────────────────────────────────────────
// Porte : clubs/{clubId}.coachAccessPolicy
// Valeurs : "automatic_safe_projection" | "approval_required".
//
// ─── Les deux modes ─────────────────────────────────────────────────────────
//
//  1. "automatic_safe_projection" (DEFAUT, mode du pilote)
//     Un joueur qui rejoint VOLONTAIREMENT un club avec une invitation VALIDE
//     voit sa projection coach non sensible activee sans validation
//     administrative. Etat pose : "not_required".
//
//  2. "approval_required" (prevu, active pour AUCUN club pilote)
//     Le rattachement pose "pending" : le joueur entre bien dans l'effectif,
//     mais son suivi n'est pas consultable tant qu'une decision humaine n'a pas
//     ete prise (procedure documentee dans AUTORISATION_ACCES.md, §7).
//
// ─── POURQUOI UN DEFAUT QUI OUVRE, ET PAS UN DEFAUT QUI FERME ───────────────
//
// L'ancien mecanisme posait "pending" a tout U13/U15 au rattachement. Or il
// n'existe AUCUN ecran d'approbation dans l'application : le seul chemin pour
// lever un "pending" est une modification manuelle dans la console Firebase.
// Consequence reelle, pas theorique : un club U15 qui distribue FKS a ses
// joueuses SANS suivi administratif voyait un EFFECTIF ENTIEREMENT VIDE — c'est
// exactement le pilote de Laurent.
//
// Un verrou dont personne ne detient la cle n'est pas une protection, c'est une
// panne. La decision produit (Kyllian, juillet 2026) est donc : le mode par
// defaut ouvre la projection NON SENSIBLE quand le joueur est entre de lui-meme
// avec un code valide, et le mode qui ferme reste disponible, cable et teste,
// pour le jour ou un club le demandera.
//
// Ce que ce defaut n'ouvre PAS : la projection reste coach-safe. Douleur,
// fatigue, zone corporelle, commentaire libre, ressenti, RPE, ATL/CTL/TSB ne
// sont JAMAIS transmis, quel que soit le mode (cf. functions/src/dto.ts,
// FORBIDDEN_KEYS + SENSITIVE_KEY_ROOTS, et le garde-fou assertCoachSafe).
//
// ─── DEFAUT vs FAIL-CLOSED : deux questions differentes ─────────────────────
//
// Ne pas confondre les deux verrous, ils ne portent pas sur la meme valeur :
//
//  - la POLITIQUE (ce module) : absente, vide, inconnue ou mal typee ->
//    "automatic_safe_projection". C'est un DEFAUT, arbitre produit. Un club qui
//    n'a jamais entendu parler de ce champ (99 % des clubs, y compris tous les
//    clubs existants) obtient le mode pilote.
//  - l'ETAT d'autorisation du joueur (coachAccess.ts) : absent, vide, inconnu ou
//    mal type -> REFUS. Ca, c'est FAIL-CLOSED, et ca ne bouge pas. Une valeur
//    pourrie sur un membership n'ouvre jamais rien.
//
// Autrement dit : le doute sur la CONFIGURATION D'UN CLUB se resout par le mode
// nominal ; le doute sur L'AUTORISATION D'UN JOUEUR se resout par le refus.

/** Nom du champ, ecrit une seule fois ici (les fautes de frappe ouvrent des trous). */
export const COACH_ACCESS_POLICY_FIELD = "coachAccessPolicy";

export const COACH_ACCESS_POLICIES = [
  "automatic_safe_projection",
  "approval_required",
] as const;
export type CoachAccessPolicy = (typeof COACH_ACCESS_POLICIES)[number];

/**
 * Valeur appliquee EN L'ABSENCE de configuration explicite.
 *
 * Definie ICI, cote serveur, et testee ici. Le front n'a aucun mot a dire : il
 * ne lit pas ce champ, il ne l'ecrit pas, et l'application pourrait etre
 * entierement remplacee sans que ce defaut change.
 */
export const DEFAULT_COACH_ACCESS_POLICY: CoachAccessPolicy = "automatic_safe_projection";

/** Politique reconnue, ou `null` si la valeur n'en est pas une. */
export function normalizeCoachAccessPolicy(value: unknown): CoachAccessPolicy | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return (COACH_ACCESS_POLICIES as readonly string[]).includes(v)
    ? (v as CoachAccessPolicy)
    : null;
}

/**
 * Politique EFFECTIVE : la valeur configuree si elle est reconnue, le defaut
 * sinon. Absente, vide, inconnue, mal typee -> defaut (cf. en-tete).
 */
export function resolveCoachAccessPolicy(value: unknown): CoachAccessPolicy {
  return normalizeCoachAccessPolicy(value) ?? DEFAULT_COACH_ACCESS_POLICY;
}

/** Meme question, en partant du document club brut (absent inclus). */
export function clubCoachAccessPolicy(
  club: Record<string, unknown> | null | undefined,
): CoachAccessPolicy {
  return resolveCoachAccessPolicy(club?.[COACH_ACCESS_POLICY_FIELD]);
}
