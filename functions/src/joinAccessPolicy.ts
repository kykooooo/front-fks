// functions/src/joinAccessPolicy.ts
//
// POLITIQUE DE RATTACHEMENT, PORTEE PAR LE CLUB.
//
// Module SERVEUR PUR : aucun Firestore, aucune horloge, AUCUNE dependance front.
// C'est ici, et nulle part ailleurs, que se decide quel etat d'autorisation est
// pose sur un joueur AU MOMENT OU IL REJOINT un club.
//
// ─── LE NOM DIT LA PORTEE, ET C'EST VOLONTAIRE ──────────────────────────────
//
// Ce champ s'appelait `coachAccessPolicy`. Le nom laissait croire qu'il
// gouvernait "l'acces du coach" en general, donc aussi celui des membres DEJA
// rattaches. C'est faux, et ca l'a toujours ete : la politique ne decide que de
// l'etat POSE A L'ENTREE. Un nom qui promet plus que le code ne fait est un
// piege, pas un detail — il a donc ete renomme `joinAccessPolicy` : la politique
// du RATTACHEMENT (join), pas la politique de l'acces.
//
// Formulation de reference, celle a afficher a un coach le jour ou un ecran
// existera : « S'applique aux prochains joueurs qui rejoignent le club »
// (constante `JOIN_ACCESS_POLICY_SCOPE_LABEL`, cote front,
// domain/joinAccessPolicy.ts).
//
// AUCUN CHEMIN DE COMPATIBILITE avec l'ancien nom n'existe, et c'est DELIBERE :
// rien n'est deploye, aucun club n'existe en base. Un repli qui relirait
// `coachAccessPolicy` serait du code mort laissant croire a une migration qui
// n'a jamais eu lieu.
//
// ─── Le champ ────────────────────────────────────────────────────────────────
// Porte : clubs/{clubId}.joinAccessPolicy
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
// ─── CE QUE CHANGER LA POLITIQUE NE FAIT PAS ────────────────────────────────
//
// Elle ne touche AUCUN membre deja rattache. Ni pour ouvrir, ni pour fermer.
// `resolveCoachAccess` (coachAccess.ts) conserve tout etat deja pose et lisible,
// et le chemin de resynchro (`ensureCoachAccessState`, coachAccessSync.ts) ne
// lit meme pas la politique quand un etat valide existe deja. Fermer un acces
// existant reste un geste EXPLICITE, joueur par joueur ("revoked", §7.4 de la
// doc). Une action groupee sur les membres existants pourra etre ajoutee plus
// tard ; elle n'existe pas aujourd'hui, et surtout elle ne se declenchera jamais
// en effet de bord d'un changement de politique.
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
export const JOIN_ACCESS_POLICY_FIELD = "joinAccessPolicy";

export const JOIN_ACCESS_POLICIES = [
  "automatic_safe_projection",
  "approval_required",
] as const;
export type JoinAccessPolicy = (typeof JOIN_ACCESS_POLICIES)[number];

/**
 * Valeur appliquee EN L'ABSENCE de configuration explicite.
 *
 * Definie ICI, cote serveur, et testee ici. Le front n'a aucun mot a dire : il
 * ne lit pas ce champ, il ne l'ecrit pas, et l'application pourrait etre
 * entierement remplacee sans que ce defaut change.
 */
export const DEFAULT_JOIN_ACCESS_POLICY: JoinAccessPolicy = "automatic_safe_projection";

/** Politique reconnue, ou `null` si la valeur n'en est pas une. */
export function normalizeJoinAccessPolicy(value: unknown): JoinAccessPolicy | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return (JOIN_ACCESS_POLICIES as readonly string[]).includes(v)
    ? (v as JoinAccessPolicy)
    : null;
}

/**
 * Politique EFFECTIVE : la valeur configuree si elle est reconnue, le defaut
 * sinon. Absente, vide, inconnue, mal typee -> defaut (cf. en-tete).
 */
export function resolveJoinAccessPolicy(value: unknown): JoinAccessPolicy {
  return normalizeJoinAccessPolicy(value) ?? DEFAULT_JOIN_ACCESS_POLICY;
}

/** Meme question, en partant du document club brut (absent inclus). */
export function clubJoinAccessPolicy(
  club: Record<string, unknown> | null | undefined,
): JoinAccessPolicy {
  return resolveJoinAccessPolicy(club?.[JOIN_ACCESS_POLICY_FIELD]);
}
