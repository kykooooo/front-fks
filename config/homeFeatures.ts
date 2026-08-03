// config/homeFeatures.ts
// =============================================================================
// L'INTERRUPTEUR DU HOME VNEXT
// =============================================================================
//
// UNE SEULE LIGNE decide quel accueil le joueur voit. `false` remet l'ancien
// `screens/HomeScreen.tsx` en place et ne laisse AUCUNE autre difference : le
// nouvel ecran et ses hooks restent dans le depot, compiles et testes, mais plus
// personne ne les monte. C'est le repli d'urgence, et il ne demande ni revert ni
// redeploiement d'un binaire — un `eas update` suffit.
//
// POURQUOI IL EST A `true` SUR CETTE BRANCHE : la recette telephone est
// bloquante avant tout merge (320/375/390 px x texte x1,3 x animations
// reduites), et elle ne peut pas avoir lieu sur un ecran que personne n'affiche.
// La valeur qui part en production est une decision de merge, pas une decision
// de branche.
//
// A SUPPRIMER au lot de nettoyage (L6), une fois le vNext par defaut et l'ancien
// Home retire : un flag qui ne peut plus etre bascule est un mensonge.
// =============================================================================

export const HOME_FEATURES: {
  /** `true` = accueil vNext ; `false` = `screens/HomeScreen.tsx` (ancien). */
  readonly VNEXT: boolean;
} = {
  VNEXT: true,
};
