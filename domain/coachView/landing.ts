// domain/coachView/landing.ts
//
// SUR QUEL ONGLET LE COACH ATTERRIT EN ENTRANT DANS SON ESPACE.
//
// LE DÉFAUT CORRIGÉ (retour terrain du 07/09).
// « Quand on arrive sur l'écran coach, il n'y a rien qui s'affiche puisqu'il n'y
// a pas de joueurs. » Un club neuf n'a aucun joueur : l'onglet « Aujourd'hui »
// n'a alors rien à montrer — sa raison d'être ("qui dois-je regarder
// maintenant ?") suppose un effectif. Le premier écran du coach est donc une
// carte d'état vide, et rien d'autre. L'onglet utile dans ce cas est
// « Semaine » : c'est là que se posent le cadre de la semaine et le code
// d'invitation, c'est-à-dire les deux seules choses qu'un coach sans effectif
// peut réellement faire.
//
// POURQUOI CETTE DÉCISION VIT DANS LE DOMAINE, ET PAS DANS LE NAVIGATEUR.
// Elle repose sur une combinaison d'états (club lu ou non, effectif lu ou non,
// effectif vide ou non) dont chaque branche a un sens précis. Écrite en ligne
// dans un composant, elle serait invérifiable ; ici elle est une fonction pure,
// testée cas par cas.
//
// LA RÈGLE QUI PRIME SUR TOUTES LES AUTRES : ON NE CONCLUT PAS SANS RÉPONSE.
// Tant qu'on ne SAIT pas si l'effectif est vide, la fonction renvoie `null` —
// « pas encore décidable ». Elle ne renvoie jamais « Semaine » par défaut, et
// surtout jamais « Aujourd'hui » qu'il faudrait corriger ensuite : un
// atterrissage sur Aujourd'hui suivi d'un saut vers Semaine, c'est exactement le
// clignotement que l'appelant doit pouvoir éviter. Un effectif vide qu'on
// n'aurait pas su lire (`unavailable`) n'est PAS un effectif vide : dans le
// doute, on ne dévie pas du comportement actuel.

/** Les deux seuls onglets sur lesquels l'espace coach peut atterrir. */
export type CoachLandingTab = "CoachToday" | "CoachWeek";

/**
 * Atterrissage historique, et repli de toutes les branches indécises : l'onglet
 * « Aujourd'hui ». Dévier de ce défaut demande une raison POSITIVE (on a lu
 * l'effectif, et il est vide) — jamais une absence d'information.
 */
export const COACH_LANDING_DEFAULT_TAB: CoachLandingTab = "CoachToday";

/**
 * Ce que la couche de lecture coach sait au moment de la décision.
 * Les trois premiers champs sont recopiés tels quels depuis `useCoachClub` et
 * `useCoachRoster` : cette fonction n'introduit AUCUN nouveau compteur.
 */
export type CoachLandingInput = {
  /** `useCoachClub().status`. */
  clubStatus: "loading" | "ready" | "notInClub" | "error";
  /** `useCoachRoster().status`. */
  rosterStatus: "loading" | "ready" | "unavailable";
  /**
   * Une lecture d'effectif a-t-elle ABOUTI (`useCoachRoster().fetchedAt !== null`) ?
   *
   * Ce champ n'est pas une redondance de `rosterStatus`. `useCoachRoster` monte
   * d'abord avec `clubId = null` (le club n'est pas encore résolu) et se déclare
   * alors « ready » avec 0 membre — un zéro qui ne mesure rien. Sans cette
   * garde, l'espace coach d'un club plein atterrirait sur Semaine à cause d'une
   * fenêtre de rendu.
   */
  rosterAnswered: boolean;
  /** `useCoachRoster().memberCount` — l'effectif réel, source de vérité unique. */
  memberCount: number;
  /**
   * Taille d'effectif MÉMORISÉE localement pour ce compte ET ce club
   * (services/memoireEffectifCoach), ou `null` si l'on n'a rien de tel.
   *
   * Ce n'est pas une source concurrente : c'est la valeur de `memberCount`
   * elle-même, recopiée lors de la dernière lecture aboutie. Elle existe pour
   * qu'un coach n'attende pas 26 requêtes avant de voir une barre d'onglets.
   *
   * Elle est déjà filtrée par club en amont : une valeur écrite pour un autre
   * club arrive ici en `null`, jamais comme un effectif à croire.
   */
  tailleEffectifMemorisee?: number | null;
  /**
   * Délai de garde écoulé. Filet de sécurité de l'appelant : sans lui, une
   * lecture qui ne répondrait jamais laisserait l'espace coach sur un squelette
   * définitif. Il ne fait que forcer le repli, il ne décide de rien.
   */
  timedOut?: boolean;
};

/**
 * Onglet d'atterrissage, ou `null` tant que la question n'est pas tranchable.
 *
 * L'appelant DOIT traiter `null` comme « attends » (un squelette), et non comme
 * « prends le défaut » : c'est la seule façon de n'afficher qu'une fois le bon
 * onglet.
 */
export function chooseCoachLandingTab(input: CoachLandingInput): CoachLandingTab | null {
  // 0. MÉMOIRE LOCALE : on a déjà lu cet effectif, pour CE club, lors d'une
  //    session précédente. On tranche donc sans attendre quoi que ce soit du
  //    réseau — c'est le seul moyen d'éviter des secondes de squelette au cas
  //    MAJORITAIRE, celui du coach dont le club est plein.
  //
  //    CE QUE ÇA COÛTE, ET POURQUOI C'EST ACCEPTABLE. Un club qui vient de
  //    passer de 0 à 1 joueur (ou l'inverse) ouvre une fois de plus sur l'onglet
  //    d'avant. Le prix est un onglet — pas un chiffre faux, pas une donnée
  //    inventée : cette valeur ne s'affiche nulle part. Et la première lecture
  //    réelle de la session la corrige pour la fois suivante.
  if (input.tailleEffectifMemorisee != null) {
    return input.tailleEffectifMemorisee === 0 ? "CoachWeek" : COACH_LANDING_DEFAULT_TAB;
  }

  // 1. Le seul cas où l'on SAIT : club résolu + effectif lu et abouti.
  const decidable =
    input.clubStatus === "ready" && input.rosterStatus === "ready" && input.rosterAnswered;
  if (decidable) {
    return input.memberCount === 0 ? "CoachWeek" : COACH_LANDING_DEFAULT_TAB;
  }

  // 2. Les cas où l'on sait qu'on ne saura pas : pas de club, lecture du club
  //    refusée, effectif illisible. Aucun n'autorise à conclure « club vide » —
  //    on retombe donc sur le comportement actuel, immédiatement (faire attendre
  //    n'apporterait rien).
  if (input.clubStatus === "notInClub" || input.clubStatus === "error") {
    return COACH_LANDING_DEFAULT_TAB;
  }
  if (input.rosterStatus === "unavailable") {
    return COACH_LANDING_DEFAULT_TAB;
  }

  // 3. Filet : la lecture s'éternise. On ouvre l'espace plutôt que de le laisser
  //    fermé derrière un squelette.
  if (input.timedOut) {
    return COACH_LANDING_DEFAULT_TAB;
  }

  // 4. Lecture en cours (club ou effectif), ou effectif qui n'a pas encore
  //    répondu pour CE club : on ne conclut rien.
  return null;
}
