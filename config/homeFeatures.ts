// config/homeFeatures.ts
// =============================================================================
// L'INTERRUPTEUR DU HOME VNEXT
// =============================================================================
//
// UNE SEULE LIGNE decide quel accueil le joueur voit. `false` monte l'ancien
// `screens/HomeScreen.tsx` et ne laisse AUCUNE autre difference : le
// nouvel ecran et ses hooks restent dans le depot, compiles et testes, mais plus
// personne ne les monte. Rebasculer ne demande ni revert ni redeploiement d'un
// binaire — un `eas update` suffit.
//
// POURQUOI IL EST A `false` : DECISION PRODUIT du fondateur, 15/08/2026, prise
// en direct — l'ecran d'accueil actif redevient l'ANCIEN Home (« A »), porteur
// (1) des corrections d'honnetete de fix/home-honnetete (le Home ne ment plus,
// le look ne bouge pas) et (2) de la carte « Ma progression » enrichie SUR
// PLACE (meme cadre, meme position, contenu du resume canonique). Le vNext
// n'est plus « le repli d'urgence » : c'est l'ALTERNATIVE DESACTIVEE, conservee
// compilee et testee, re-basculable en cinq minutes si la decision s'inverse.
//
// La checklist ci-dessous (« comment retirer l'ancien ») date de l'epoque
// vNext-actif ; elle ne redevient d'actualite que si la decision s'inverse a
// nouveau. Elle reste ici parce qu'elle est verifiee et qu'une enquete refaite
// coute plus cher qu'une checklist conservee.
//
// MISE A JOUR 15/08 (bascule A) — trois faits de la checklist ont change :
//   - `useLoadSeries` n'existe PLUS (supprime par la bascule : H2, la serie TSB
//     vient du store). Le rayer de l'etape 4.
//   - `hooks/home/useRealLoadData.ts` (H1) est nouveau et doit etre GARDE meme
//     si l'ancien accueil part : `useContextualAdvice` (garde pour
//     NewSessionScreen) lui prend countRealActivityDays.
//   - Partent AVEC l'ancien accueil, en plus de la liste : HomeProgressionCard
//     (+ components/home/__tests__/) et, dans hooks/home/__tests__/, les suites
//     activityStreak et needsCycleChoice (realLoadData et adviceGating restent
//     avec leurs hooks). Les comptes de lignes des etapes 2-4 datent d'avant.
//
// -----------------------------------------------------------------------------
// POURQUOI IL A SURVECU AU LOT L6 — ET COMMENT LE RETIRER
// -----------------------------------------------------------------------------
// A DIRE SANS DETOUR : le lot L6 s'appelle « nettoyage » et n'a supprime AUCUN
// fichier. `git diff --diff-filter=D origin/main..HEAD` est vide. La branche
// embarque donc un accueil complet en double — le nouveau, monte, et l'ancien,
// intact derriere cette ligne. Quiconque lit le nom du lot et regarde le diff a
// le droit de trouver que les deux ne se ressemblent pas.
//
// C'est un choix, pas un oubli, et voici la raison.
//
// La recette telephone n'a pas encore eu lieu.
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
// LA RECETTE, ELLE, EXISTE ET VIT DANS LE DEPOT :
// `docs/home-vnext-2026-08/RECETTE_HOME.md`. Tant qu'elle n'est pas cochee, la
// phrase ci-dessus n'est pas une precaution de style : c'est l'etat reel.
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
//
//      ATTENTION, CONTRADICTION DOCUMENTAIRE : le dossier d'integration
//      (`DOSSIER_INTEGRATION_HOME.md`, branche prototype) dit « GARDER
//      useWeekSummary (source du L2) ». Cette phrase est PERIMEE, et c'est la
//      liste ci-dessus qui fait foi. Verification refaite le 04/08 : le seul
//      import restant est `screens/HomeScreen.tsx` (l. 32), l'ancien accueil.
//      Le lot L2 est passe au resume canonique (`domain/resumeCanonique.ts`) et
//      ne lit plus ce hook. Il part donc AVEC l'ancien accueil, pas avant.
//      La commande qui tranche, si le doute revient :
//        grep -rn "useWeekSummary" --include=*.ts --include=*.tsx .
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

// =============================================================================
// LE BLOC V-A « PREMIERE MISSION » — DESACTIVE (decision Kyllian 04/08)
// =============================================================================
//
// LA DECISION, TELLE QU'ELLE A ETE PRISE : l'ecran d'un compte a 0 seance
// reste l'ECRAN NORMAL des le jour 1 — meme CTA, meme ligne de cycle, meme
// carte Progression que tout le monde. L'app ne change pas de forme pour un
// joueur neuf.
//
// Ce que ca deplace, mecaniquement, sans une ligne de plus : la carte
// Progression, dans son etat vide, affiche deja une checklist de trois
// reperes (« Termine ta première séance. » / « Partage ton ressenti. » /
// « Compare tes prochains tests. » — `progressionViewModel.ts` §6.7). Une fois
// le bloc V-A retire, cette checklist devient LE message de demarrage
// unique — elle n'a rien gagne, elle etait deja la.
//
// POURQUOI LE CODE RESTE (bloc, ViewModel, tests unitaires, respiration
// f568d83) : conserve pour un futur onboarding SANS cycle actif — un moment
// ou l'app aura reellement quelque chose de plus a dire a un joueur qui n'a
// encore rien choisi. Tant que ce moment n'existe pas, le drapeau reste OFF.
// `hooks/home/useHomeVNextViewModel.ts` est le SEUL point qui le lit.
export const HOME_FEATURES: {
  /** `true` = accueil vNext ; `false` = `screens/HomeScreen.tsx` (ancien). */
  readonly VNEXT: boolean;
  /**
   * `true` = le bloc V-A « Première mission » remplace le CTA normal + « MA
   * FORME » sur un compte a 0 seance. `false` = decision Kyllian 04/08 —
   * conserve pour un futur onboarding sans cycle actif ; l'app ne change pas
   * de forme.
   */
  readonly DEMARRAGE_PREMIERE_MISSION: boolean;
} = {
  VNEXT: false,
  DEMARRAGE_PREMIERE_MISSION: false,
};
