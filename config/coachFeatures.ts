// config/coachFeatures.ts
//
// CAPACITÉS EXPLICITES DE L'ESPACE COACH.
//
// Un drapeau ici ne sert pas à « cacher un truc pas fini » : il sert à rendre
// RÉVERSIBLE une fonction dont la promesse n'est pas encore tenue de bout en
// bout. Tant qu'un maillon manque, on veut pouvoir la retirer de l'écran en
// changeant UNE valeur, sans démonter du code.
//
// RÈGLE : un drapeau ne remplace jamais un texte honnête. Une fonction visible
// derrière un drapeau ACTIVÉ doit dire elle-même ce qu'elle ne fait pas encore.

export const COACH_FEATURES: {
  /**
   * Création d'une directive d'entraînement dans l'écran « Ma semaine ».
   *
   * ACTIVÉE par défaut, avec le libellé honnête
   * (`CLUB_DIRECTIVE_PREPARATION_NOTICE`, domain/clubDirective.ts) : un coach
   * pilote peut préparer sa directive en comprenant qu'elle n'agit pas encore
   * sur les séances.
   *
   * La passer à `false` retire ENTIÈREMENT le bloc de l'écran — plus de champ,
   * plus de bouton, plus d'écriture possible. C'est le geste à faire si un
   * pilote se met à croire que ses directives pilotent la préparation.
   *
   * Elle repassera à sa promesse complète le jour où le moteur de génération
   * lira réellement la directive. Ce jour-là, ce drapeau n'aura plus de raison
   * d'exister.
   */
  DIRECTIVE_CREATION: boolean;
} = {
  DIRECTIVE_CREATION: true,
};
