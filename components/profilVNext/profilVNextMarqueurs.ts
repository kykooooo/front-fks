// components/profilVNext/profilVNextMarqueurs.ts
// =============================================================================
// PROTOTYPE Profil vNext — MARQUEURS STABLES
// =============================================================================
// Rendus en `testID` par React Native et traduits en `data-testid` par
// react-native-web : le meme marqueur sert dans les tests de composant ET dans
// l'analyse du HTML genere par le harnais (patron du Home,
// components/homeVNext/homeVNextMarqueurs.ts).
//
// Regle : un marqueur par AFFIRMATION verifiable, pas un par noeud.
// =============================================================================

export const PROFIL_MARQUEURS = {
  /** La racine de l'ecran — prouve que c'est bien le Profil vNext qui est rendu. */
  ecran: "profil-vnext-ecran",
  /** La carte identite en etat pret. */
  identite: "profil-vnext-identite",
  /** La carte identite en chargement — l'ecran attend, il ne fabrique pas. */
  identiteChargement: "profil-vnext-identite-chargement",
  /** Une valeur affichee « A definir » (identite ou rythme) — l'absence est un etat. */
  aDefinir: "profil-vnext-a-definir",
  /** La carte rythme. */
  rythme: "profil-vnext-rythme",
  /** Une ligne de controle (prefixe — l'id de ligne est ajoute : `-cycle`, `-tests`…). */
  controle: "profil-vnext-controle",
  /** Le fait d'etat d'une ligne (variante informee uniquement). */
  fait: "profil-vnext-fait",
} as const;
