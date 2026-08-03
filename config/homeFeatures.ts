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
// -----------------------------------------------------------------------------
// POURQUOI IL A SURVECU AU LOT DE NETTOYAGE (L6) — ET COMMENT LE RETIRER
// -----------------------------------------------------------------------------
// Le lot de nettoyage devait supprimer ce flag et l'ancien accueil avec. Il ne
// l'a pas fait, et c'est un choix, pas un oubli.
//
// La raison tient en une phrase : la recette telephone n'a pas encore eu lieu.
// Les plafonds `maxFontSizeMultiplier` de l'echelle typographique n'ont JAMAIS
// ete vus en natif — react-native-web ne les implemente pas, le visualiseur du
// prototype ne pouvait donc pas les eprouver. C'est exactement la fenetre ou un
// repli vaut son prix : entre « le nouvel ecran est monte » et « quelqu'un l'a
// tenu dans sa main a 320 px avec le texte agrandi ». Supprimer le filet la
// veille du saut aurait ete le seul moment ou ca coute vraiment.
//
// S'y ajoute le pilote : si l'accueil casse chez un vrai joueur, basculer cette
// ligne et pousser un `eas update` prend cinq minutes, la ou un revert demande
// de defaire un lot de 18 000 lignes.
//
// QUAND LE RETIRER : quand la recette telephone est passee ET que le pilote a
// tourne quelques semaines sans avoir eu a basculer.
//
// COMMENT — la liste est verifiee (aucun autre consommateur, greps faits au lot
// de nettoyage), c'est une checklist, pas une enquete :
//
//   1. `navigation/RootNavigator.tsx` : rendre `<HomeVNextContainer />` sans
//      ternaire, retirer les deux imports (`HomeScreen`, `HOME_FEATURES`).
//   2. Supprimer `screens/HomeScreen.tsx` (523 l.) — SEUL consommateur de tout
//      ce qui suit.
//   3. Supprimer `components/home/` en entier (5 fichiers, 732 l.) :
//      HomeReadinessHero, HomePrimaryCTA, HomeCarouselCard, HomeNextSessionCard,
//      HomeAdviceCard.
//   4. Supprimer dans `hooks/home/` (479 l.) : useLoadSeries, useMatchSoon,
//      useWeekDays, useWeekSummary, useActivityStreak, usePrimaryCta.
//      GARDER `useContextualAdvice.ts` : `screens/NewSessionScreen.tsx` l'importe.
//   5. Supprimer ce fichier.
//   6. Deux tests a reprendre, et deux seulement :
//      - `navigation/__tests__/homeVNextWiring.test.ts` : les blocs « le choix
//        passe par HOME_FEATURES », « l'ancien accueil reste importe » et
//        « L'interrupteur lui-meme » n'ont plus d'objet ; le reste (pas de
//        nouvelle route, onglet toujours nomme Home, SwipeTabsWrapper) tient et
//        doit rester.
//      - `domain/__tests__/resumeCanoniqueUnicite.test.ts` : retirer
//        `"hooks/home/useWeekSummary.ts"` de `CONSOMMATEURS` (il lit le fichier,
//        il echouera bruyamment sinon — c'est voulu).
//   Aucun autre test n'importe ces fichiers (ils sont cites en commentaire dans
//   trois suites, ce qui ne casse rien).
// =============================================================================

export const HOME_FEATURES: {
  /** `true` = accueil vNext ; `false` = `screens/HomeScreen.tsx` (ancien). */
  readonly VNEXT: boolean;
} = {
  VNEXT: true,
};
