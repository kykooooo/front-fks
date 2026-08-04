// screens/progression/echelleCourbe.ts
// =============================================================================
// L'ECHELLE VERTICALE DE LA COURBE DE FORME
// =============================================================================
//
// POURQUOI CE FICHIER EXISTE
// -----------------------------------------------------------------------------
// La page Progression tracait sa courbe sur un axe FIGE de -20 a +20, et rabotait
// (`Math.max`/`Math.min`) toute valeur qui sortait de ces bornes. Tant que la
// serie etait amorcee sur les constantes ATL0/CTL0, elle vivait au milieu de cet
// intervalle et le rabotage ne se declenchait jamais.
//
// La serie PURGEE, elle, part de zero des deux cotes. Comme la constante de temps
// du CTL (28 jours) est le double de celle de l'ATL (14 jours), le TSB reste
// mecaniquement negatif pendant des semaines : ce n'est pas un reglage, c'est la
// forme du modele. Un joueur assidu descend donc regulierement sous -20 — et
// l'ecran DESSINAIT alors -20 a la place de sa vraie valeur. La courbe s'aplatit
// contre le bord bas, deux jours differents se superposent, et le trace affiche
// un chiffre que personne n'a mesure.
//
// Un ecran qui vient de purger ses valeurs inventees ne peut pas, deux blocs plus
// bas, dessiner une valeur fausse. D'ou cette echelle RELATIVE A LA SERIE.
//
// LA MEME REGLE QUE LA COURBE DE L'ACCUEIL
// -----------------------------------------------------------------------------
// `components/homeVNext/HomeVNextSparkline.tsx` calcule deja son echelle ainsi
// (min -> max, serie plate placee a mi-hauteur). Les deux ecrans du meme trajet
// suivent donc la meme regle : aucune constante du modele de charge n'entre dans
// le dessin, donc aucune valeur d'amorcage ne peut s'y inviter.
//
// POURQUOI UN MODULE A PART PLUTOT QU'UNE FONCTION DANS L'ECRAN
// -----------------------------------------------------------------------------
// Parce qu'elle devient testable. La faute corrigee ici etait invisible a tsc, a
// eslint et aux tests de rendu : elle ne se voyait que sur une serie reelle de
// joueur assidu. Une fonction pure se met sous test avec ces valeurs-la.
// =============================================================================

/** Bornes verticales d'un trace, deduites de la serie elle-meme. */
export type EchelleCourbe = {
  /** Plus petite valeur de la serie. Dessinee TOUT EN BAS de la zone utile. */
  min: number;
  /** Plus grande valeur de la serie. Dessinee TOUT EN HAUT de la zone utile. */
  max: number;
  /**
   * `true` quand toutes les valeurs sont identiques : il n'y a pas de haut ni de
   * bas a distinguer, le trace est pose a mi-hauteur (et surtout, on ne divise
   * pas par zero).
   */
  plate: boolean;
};

export type GeometrieCourbe = {
  /** Hauteur totale de la zone de dessin, en pixels. */
  hauteur: number;
  /** Marge haute ET basse, en pixels, pour qu'un point ne soit jamais rogne. */
  marge: number;
};

/**
 * Deduit les bornes verticales d'une serie.
 *
 * Rend `null` quand il n'y a rien a mettre a l'echelle (serie vide) ou quand une
 * valeur n'est pas un nombre fini : mieux vaut ne rien dessiner que dessiner une
 * echelle batie sur un `NaN`.
 */
export function calculerEchelleCourbe(points: readonly number[]): EchelleCourbe | null {
  if (points.length === 0) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const valeur of points) {
    if (!Number.isFinite(valeur)) return null;
    if (valeur < min) min = valeur;
    if (valeur > max) max = valeur;
  }
  return { min, max, plate: max === min };
}

/**
 * Place une valeur sur l'axe vertical, en pixels depuis le haut de la zone.
 *
 * AUCUN RABOTAGE. Une valeur hors de l'echelle n'est pas ramenee sur le bord :
 * elle sort du cadre, ce qui est visible et donc corrigible, au lieu d'etre
 * silencieusement transformee en une valeur voisine. En pratique le cas
 * n'arrive pas, puisque l'echelle est construite SUR la serie tracee — c'est
 * exactement pour cela que les deux fonctions vont ensemble.
 */
export function versYCourbe(
  valeur: number,
  echelle: EchelleCourbe,
  geometrie: GeometrieCourbe
): number {
  const utile = geometrie.hauteur - geometrie.marge * 2;
  if (echelle.plate) return geometrie.marge + utile / 2;
  const ratio = (valeur - echelle.min) / (echelle.max - echelle.min);
  return geometrie.marge + (1 - ratio) * utile;
}

/**
 * La ligne de reference du zero a-t-elle un sens sur cette serie ?
 *
 * C'est le SEUL repere qui subsiste sur le trace, et il ne se dessine que
 * lorsqu'il tombe reellement dans l'intervalle parcouru. Une ligne « d'equilibre »
 * plaquee contre le bord haut d'une serie entierement negative ne repere rien :
 * elle laisse croire que le joueur frole l'equilibre alors qu'il n'en approche
 * jamais.
 */
export function zeroEstDansLEchelle(echelle: EchelleCourbe): boolean {
  return echelle.min <= 0 && echelle.max >= 0;
}
