// domain/coachAccess.ts
//
// LECTURE de l'état serveur d'autorisation d'accès aux données de suivi d'un
// joueur. Miroir strict de `functions/src/coachAccess.ts`.
//
// ⚠️ CE MODULE NE DÉCIDE RIEN. Il traduit une valeur écrite par le serveur en
// quelque chose d'affichable. L'app n'a aucun moyen de poser ni de modifier cet
// état : les règles Firestore l'interdisent à tout client (y compris au coach et
// à l'owner du club). Si ce fichier disait "oui" alors que la base dit "non", la
// lecture serait quand même refusée — l'écran ne ferait qu'afficher une erreur
// à la place d'un message clair.
//
// POURQUOI LE FRONT LIT QUAND MÊME LE CHAMP : sans lui, un refus de lecture
// arriverait sous la forme d'un `permission-denied` indiscernable d'une panne
// réseau. Le coach lirait "on n'arrive pas à lire" là où la vérité est "ce
// joueur n'est pas encore consultable". Ce sont deux informations différentes,
// et le champ est justement lisible par le coach (il est sur le membership, pas
// sur les données de suivi).
//
// Vocabulaire PRODUIT et NEUTRE : rien de juridique, rien de médical, aucune
// mention d'un tiers. On dit ce qui est vrai — une étape reste à faire — sans
// prétendre dire ce qu'elle vaut en droit.

export const COACH_ACCESS_STATES = ["pending", "approved", "revoked", "not_required"] as const;
export type CoachAccessState = (typeof COACH_ACCESS_STATES)[number];

/** Les deux seuls états qui ouvrent la lecture (miroir serveur + règles). */
export const COACH_ACCESS_GRANTING_STATES: readonly CoachAccessState[] = ["approved", "not_required"];

/** État reconnu, ou `null` si la valeur n'en est pas un (default-deny). */
export function normalizeCoachAccess(value: unknown): CoachAccessState | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return (COACH_ACCESS_STATES as readonly string[]).includes(v) ? (v as CoachAccessState) : null;
}

/**
 * Deny-first, exactement comme le serveur : absent, vide, mal orthographié,
 * booléen, objet → NON autorisé. Un membership écrit avant l'existence du champ
 * n'ouvre donc rien, ici comme en base.
 */
export function isCoachAccessGranted(value: unknown): boolean {
  const state = normalizeCoachAccess(value);
  return state !== null && COACH_ACCESS_GRANTING_STATES.includes(state);
}

/**
 * Ce qu'on affiche à la place du suivi d'un joueur non consultable.
 *
 * Le ton est NEUTRE et ne laisse jamais croire que le joueur ne s'entraîne pas :
 * il s'entraîne peut-être très bien, c'est seulement l'accès à son suivi qui
 * n'est pas ouvert. La nuance compte : un coach qui lit "aucune séance" prend
 * une décision sportive fausse.
 */
export type CoachAccessCopy = { titre: string; corps: string };

export const COACH_ACCESS_COPY: CoachAccessCopy = {
  titre: "Suivi non accessible",
  corps:
    "Une étape reste à faire avant que le suivi de ce joueur soit consultable. Il fait bien partie de l'effectif, et il peut s'entraîner normalement : seul l'affichage de ses données est en attente.",
};

/** Même message, décliné pour une liste (N joueurs concernés). */
export function coachAccessRosterCopy(nombre: number): CoachAccessCopy {
  const pluriel = nombre > 1;
  return {
    titre: `${nombre} joueur${pluriel ? "s" : ""} non consultable${pluriel ? "s" : ""}`,
    corps: pluriel
      ? "Ces joueurs font partie de l'effectif, mais une étape reste à faire avant que leur suivi soit consultable. Ils peuvent s'entraîner normalement."
      : "Ce joueur fait partie de l'effectif, mais une étape reste à faire avant que son suivi soit consultable. Il peut s'entraîner normalement.",
  };
}
