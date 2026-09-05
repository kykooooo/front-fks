// domain/passwordStrength.ts
//
/**
 * FORCE DU MOT DE PASSE — LONGUEUR **ET** VARIÉTÉ.
 *
 * Avant, la jauge ne comptait que les caractères : `aaaaaaaaaa` s'affichait
 * « Fort » (P2-04 de l'audit). Un indicateur qui ment sur ce point n'est pas
 * cosmétique — il valide une mauvaise habitude au moment précis où l'on pouvait
 * en suggérer une bonne.
 *
 * 0 = rien saisi · 1 = Faible · 2 = Moyen · 3 = Fort. La règle de Firebase
 * (6 caractères minimum) reste la seule qui BLOQUE : cette jauge informe.
 */
export function forceMotDePasse(pwd: string): 0 | 1 | 2 | 3 {
  if (!pwd) return 0;
  if (pwd.length < 6) return 1;
  const varietes =
    (/[a-z]/.test(pwd) ? 1 : 0) +
    (/[A-Z]/.test(pwd) ? 1 : 0) +
    (/[0-9]/.test(pwd) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(pwd) ? 1 : 0);
  // « Fort » se mérite : long ET varié. Dix lettres identiques restent faibles.
  if (pwd.length >= 12 && varietes >= 3) return 3;
  if (pwd.length >= 10 && varietes >= 2) return 3;
  if (pwd.length >= 8 || varietes >= 2) return 2;
  return 1;
}
