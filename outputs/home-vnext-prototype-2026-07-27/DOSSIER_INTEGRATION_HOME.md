# Dossier d'intégration Home VNext — exécution à blanc contre origin/main (971c37c)

**Assemblé le 02/08/2026** à partir de trois enquêtes (restes du 31/07 re-vérifiés, périmètre/lots, conflits coach), toutes mesurées contre les arbres réels ce même jour.

**RIEN N'EST INTÉGRÉ PAR CE DOSSIER.** Aucun fichier de l'app n'a été modifié. C'est une feuille de route : l'intégration réelle démarre **après le merge de l'espace Coach**, dans l'ordre acté par le fondateur : **boucle (déjà mergée dans origin/main) → coach → Home**.

---

## 0. Entête — arbres de référence, conventions, décisions déjà prises

### 0.1 Les arbres (vérifiés le 02/08)

| Arbre | Réf | État |
|---|---|---|
| main actuel | **origin/main = 971c37c** | contient la boucle de suivi joueur (72 fichiers depuis 724c062) |
| prototype | worktree `home-vnext-prototype`, branche `feat/home-vnext-prototype` = **5752f54** (base 724c062) | 6 commits jamais poussés ; worktree propre (HEAD et `status --porcelain` re-vérifiés ce jour) |
| coach | **origin/feat/coach-pilot-experience = 4ecf79f** | = la branche locale (tout est poussé — la note mémoire « +8 commits non poussés » est périmée, re-vérifié) ; base 724c062 (merge-base re-vérifié), PAS rebasée ; 221 fichiers |
| reduce-motion | origin/fix/cta-reduce-motion | 2 commits sur base 971c37c : `75b5f19` (pulsation CTA) + `1e450da` (LoadingOverlay) — **non mergés** (re-vérifié `rev-list`) |

**Conventions de lecture** : tout `fichier:ligne` est lu sur **origin/main**, sauf mention « 5752f54 » (prototype) ou « coach » (4ecf79f). Toutes les références viennent des trois enquêtes ; celles marquées « re-vérifié ce jour » ont été contrôlées une seconde fois pendant l'assemblage (faits porteurs ou contradictions inter-enquêtes — les arbitrages sont signalés là où ils ont lieu : §1.1 nota, §2 R6 (contradiction documentée, tranche renvoyée en §6 Q3), §4.1.c).

### 0.2 Pour Kyllian, en trois phrases

Ce document est le plan de match de l'intégration du nouveau Home : qui joue où, dans quel ordre, où sont les pièges. On n'a touché à rien — c'est une préparation, pas un changement. **Les trois questions du §6 sont tranchées (02/08)** ; plus aucune décision ouverte, tout le reste est déjà décidé ou purement technique.

### 0.3 Décisions DÉJÀ prises par le fondateur — liste fermée, personne ne les re-débat

1. Typo allégée, **sans graisse 800**.
2. **Un seul CTA**.
3. **Pas de pastille d'état global**.
4. **Progression intégrée au Home**.
5. Ligne cumul à **12 px**, assumée.
6. Écran « test en recul » validé **en neutre**.
7. **Mapping cycle→test acté** : Explosivité → sprint 10 m ; Endurance → 6 min ; Force → saut (repère de puissance associé au cycle) ; Fondation/Saison → mesure comparable la plus récente ; **départage figé uniquement à égalité**.
8. **GO intégration donné le 31/07**.

Le point 7 est déjà implémenté et verrouillé dans le prototype (re-vérifié ce jour sur 5752f54) : `PROGRESSION_TEST_PAR_CYCLE` (`screens/homeVNext/progressionViewModel.ts:874-920` — force→`broadJumpCm` :887, endurance→`endurance6min_m` :896, explosivite→`sprint10s` :905, fondation/saison→`null` :878/:914), `PROGRESSION_ORDRE_DEPARTAGE` (:963-969, appliqué uniquement à égalité d'horodatage), et R9 « la sélection ne voit que `{champ, apresTs}` » (:986-990).

---

## 1. Le périmètre — ce qui a bougé, et comment « Ton suivi » survit

### 1.1 Le diff 724c062 → origin/main : 72 fichiers, mais UN seul sur le périmètre Home

`git diff --shortstat 724c062 origin/main` (re-vérifié) : **72 fichiers, +11 970 / −90** — essentiellement le merge de la boucle de suivi joueur (`domain/tracking/**`, `state/stores/useExecutionStore.ts`, `components/progress/TonSuiviSection.tsx`, `hooks/useTrackingProgress.ts`, `jest.worktree.config.js`) + la déclaration canonique `types/react-test-renderer.d.ts` (commit 971c37c lui-même).

Sur le périmètre Home strict (re-vérifié `diff --numstat` : une seule ligne de résultat) :

- `screens/ProgressScreen.tsx` : **+4/−0**, passe de 1108 à 1112 lignes (re-vérifié `wc -l`). Les 4 lignes : import `TonSuiviSection` l.35, commentaire l.553, `<TonSuiviSection />` l.554, ligne vide l.555.
- Diff **VIDE** : `screens/HomeScreen.tsx`, `components/home/`, `hooks/home/`, `screens/tests/`, `navigation/`, `screens/ProfileScreen.tsx`, `utils/streakStats.ts`, `utils/dateHelpers.ts`.

**Règle de décalage** pour lire `MIGRATION_PROGRESSSCREEN.md` (écrit contre 724c062) sur origin/main : **+1** pour toute référence entre :35 et :551, **+4** à partir de :552 (l'insertion des 3 lignes se fait après l'ancienne :551 — hunk `@@ -549,6 +550,9 @@` re-vérifié). Aucune autre modification du fichier.

**Table de repérage origin/main** (re-vérifiée par extraits ce jour) :

| Bloc | origin/main | (le doc migration citait) |
|---|---|---|
| import `TonSuiviSection` | l.35 | — |
| `computeMilestones` | l.57 | :56-112 |
| accomplissement « 7 jours d'affilée » | l.88-95 | :87-94 |
| `TEST_FIELDS` (liste locale 9 champs) | l.145 | :144-160 |
| `computeTestComparisons` | l.170-204 | :169-203 |
| `getFootballLabel(tsb)` | l.241 | :240 |
| amorces ATL0/CTL0 dans `loadSeries` | l.252-253 (bloc l.244-274, bouchage `dailyApplied[key] ?? 0` l.258, `tsbSeries` l.276) | :251-252 |
| streaks `globalMaxStreak` / `maxStreakThisMonth` | l.334-349 / l.351-366 | :333-348 / :350-365 |
| `estimatedCycles` (÷12) | l.401 | :399-400 |
| HERO forme (commentaire « Forme actuelle » l.467, kicker affiché « TA FORME » l.471, titre coloré l.472-474, message l.475, pastille l.477-479) | l.467-480 | :466-479 |
| légende « Ta forme sur 30 jours » | l.548-550 (`</Card>` l.551) | :547-549 |
| **TonSuiviSection** | **l.553-554** | (n'existait pas) |
| MILESTONES | l.556-557 | :552-… |
| STATS DU MOIS | l.716-718 ; Séances l.723, RPE l.729, durée l.736, **Record streak l.739-743** (valeur l.742) | :713-740 |

*Nota (arbitrages d'assemblage, re-vérifiés)* : les enquêtes citaient « :740-742 » et « :739-743 » pour la case Record streak — l'item complet est l.739-743, le label l.741, la valeur l.742. Le hero est nommé « Forme actuelle » en commentaire (l.467) mais affiche « TA FORME » (l.471) : les deux formulations désignaient le même bloc. Enfin `domain/tracking/config.ts` : `window: { sessions: 5, days: 28 }` est à la **ligne 15** (une enquête citait :16).

`domain/adviceRules.ts` (:155 et :287, autres appels à `getFootballLabel`) n'est pas dans les 72 fichiers du diff — références valables telles quelles.

### 1.2 « Ton suivi » survit mécaniquement — trois contraintes, pas une menace

`components/progress/TonSuiviSection.tsx` (origin/main, 257 lignes — re-vérifié) est **autonome** : imports = react / react-native / @expo/vector-icons, `constants/theme`, `components/ui/{Card,Badge,SectionHeader}`, `hooks/useTrackingProgress`, deux types (`hooks/trackingProgress/buildTrackingProgress`, `domain/tracking/types`), `services/analytics` (l.7-18). Le hook `hooks/useTrackingProgress.ts` (75 lignes — re-vérifié) branche `useExecutionStore`, `useSessionsStore`, `useExternalStore`, `useDebugStore`, `useSelfReportedGapDays` (Firestore) et `utils/virtualClock` sur la fonction pure `buildTrackingProgress` (l.13-35).

**Aucune de ces dépendances n'est touchée** par la refonte L5 (qui supprime des blocs DANS `ProgressScreen.tsx`) ni par les fichiers du prototype. La section survit donc mécaniquement ; les trois contraintes d'intégration sont :

- **(a) continuer de la rendre** — elle ne partage rien avec ce qui disparaît ;
- **(b) sa place** — décision de maquette au L5 (options §2.3 du rapport périmètre, reprises en §6 Q1) ;
- **(c) les doublons** — deux compteurs de séances sur le même écran après L5 (« séances **suivies** » = fenêtre tracking live 5 séances / 28 j, `domain/tracking/config.ts:15`, vs « séances **terminées** depuis tes débuts » = cumul du contrat), et le compteur hebdo calculé par deux chemins avec deux cibles (détail au R1, unification au L2).

À surveiller aussi : `TonSuiviSection` émet `trackEvent("progress_tracking_viewed")` au mount (:46-54) — si la refonte déplace ou fusionne la section, vérifier la continuité de cette métrique (repris au L5).

### 1.3 Recouvrement d'information : TonSuivi vs carte progression (et vs Home v2)

Sources : composant ci-dessus ; `TrackingProgressViewModel` (`hooks/trackingProgress/buildTrackingProgress.ts` origin/main l.69-93) ; `ProgressionViewModel` (5752f54 `screens/homeVNext/progressionViewModel.ts:597-632`) ; `WeekBlock` (5752f54 `screens/homeVNext/viewModel.ts:596-605` — re-vérifié).

| Information | TonSuivi (ProgressScreen) | Carte progression (Home v2 / résumé canonique) | Recouvrement |
|---|---|---|---|
| Cycle · « Séance 4/12 » · phase | oui | non (le cycle vit dans le bloc action du Home) | écrans différents, OK |
| Bandeau reprise après coupure | oui (`resumption`) | **non** — `ProgressionViewModel` ignore la reprise (coût assumé et commenté, 5752f54 HomeVNextScreen.tsx:93-98 — re-vérifié) | **unique TonSuivi** |
| « N séances suivies — complétion moyenne X % » | oui (fenêtre 28 j, exécutions trackées) | « Séances terminées depuis tes débuts : N » (cumul) | **PARTIEL** : deux compteurs à l'écran après L5, périmètres différents — les libellés portent la différence, à vérifier à l'écran |
| « X/Y séances cette semaine » | oui (`countCompletedThisWeek`, `buildTrackingProgress.ts:187-194` re-vérifié, via `weekKeyOf` + cible `targetFksSessionsPerWeek` profil) | pas sur la carte, mais le bloc « Ma semaine » du Home v2 affiche `doneCount/goalCount` via `useWeekSummary.fksCount` + `weeklyGoal` settings | **OUI, inter-écrans** : même concept, deux calculs ET deux cibles → risque d'écart à un tap d'intervalle (le défaut P0.2 que le prototype corrige ailleurs) |
| Effort ressenti vs prévu (delta RPE) | oui | non | unique TonSuivi |
| Évolutions charges/reps par exercice, qualités 28 j, dernière décision, prochaine étape | oui | non | unique TonSuivi |
| Courbe + portée, faits cumulés, comparaisons de tests, repère de test, lien détail | non | oui | unique carte |

**Verdict : pas de doublon massif.** TonSuivi est le « suivi fin » de la boucle (décisions, RPE, exos) ; la carte est le « bilan cumulé ». Deux frictions réelles : (1) deux compteurs de séances sur le même écran après L5 (traité par les libellés, R1) ; (2) le compteur hebdo à deux chemins/deux cibles (unifié au L2).

### 1.4 Le prototype (5752f54) : contenu, et pourquoi le rebase ne coince pas

Code destiné à l'app — **uniquement des dossiers nouveaux**, zéro fichier en commun avec origin/main ni avec la branche coach :

- `screens/homeVNext/` : `HomeVNextScreen.tsx` (309 l.), `viewModel.ts` (1438 l.), `progressionViewModel.ts` (1563 l.), `fixtures.ts` (1505 l.)
- `components/homeVNext/` : 15 fichiers (Action 441, Progression 883, Primitives 355, Sparkline 226, Header 104, Week 114, Form 125, Note 89, DataNotice 64, Exit 34, Skeleton 101, `homeVNextTypo.ts` 452, `homeVNextTokens.ts` 215, `homeVNextPresentation.tsx` 294, `homeVNextMarqueurs.ts` 89)
- `__tests__/homeVNext/` : 7 suites + 1 helper (`libellesEtatInterdits.ts`)
- `prototype/home-vnext/` : harnais react-native-web (build/serve/verifier/captures + stubs) + `jest.proto.config.js` + `tsconfig.proto.json` + `types/react-test-renderer.d.ts` local
- `outputs/home-vnext-prototype-2026-07-27/` : docs (dont `MIGRATION_PROGRESSSCREEN.md`, `LIMITES_PROTOTYPE.md`, `VIEWMODEL_PROGRESSION.md`) + captures

**Conséquence git** : les 6 commits du prototype se rebasent/mergent sur n'importe quel main futur (y compris post-coach) **sans conflit attendu**. La surface de conflit n'apparaît qu'aux lots de câblage — L3 (`navigation/RootNavigator.tsx`) et L5 (`screens/ProgressScreen.tsx`) — qui sont des éditions nouvelles faites pendant l'intégration, pas des commits du prototype.

**Un seul piège inter-arbres** : `prototype/home-vnext/types/react-test-renderer.d.ts` (5752f54) et `types/react-test-renderer.d.ts` (origin/main) déclarent le même module ambiant et **diffèrent**. Le tsconfig racine du main inclut `**/*.ts` : après rebase, un `tsc` racine verrait les deux déclarations → risque d'identifiants dupliqués. **À traiter au L1** : supprimer la copie du prototype, garder la canonique du main, retirer `"./types/**/*.d.ts"` de l'include de `tsconfig.proto.json`. (Risque déduit du tsconfig, pas encore reproduit par un run — à contrôler au premier tsc racine post-rebase.)

---

## 2. Les restes du 31/07, re-vérifiés contre origin/main

### 2.0 Tableau récapitulatif

| # | Reste | Statut | Références clés à jour (origin/main sauf mention) |
|---|---|---|---|
| 1 | Résumé canonique partagé Home/Progression | **PÉRIMÉ EN PARTIE** | useTrackingProgress.ts:28-35 ; buildTrackingProgress.ts:187-194, :237-296, :374-384 ; signals.ts:342 ; config.ts:15 |
| 2 | Purge des amorces ATL0/CTL0 | **INCHANGÉ** (décalage +1) | ProgressScreen :241, :244-274, :252-253, :258, :467-480, :482-550 ; trainingDefaults :14-16 ; useLoadStore :19-21 ; rebuildLoad :39-40 |
| 3 | Streaks aux définitions discutables | **INCHANGÉ** (recensement : 4 à l'écran + 1 interne) | ProgressScreen :334-349, :351-366, :88-95, :739-743 ; useActivityStreak :12-33 ; streakStats :44-82 ; ProfileScreen :257, :275, :286 |
| 4 | État de construction honnête (« collecting ») | **INCHANGÉ / pattern DÉJÀ COUVERT** | ProgressScreen :723, :729, :736 ; TonSuiviSection :2-6, :71, :82-86, :89, :100-102, :107, :119, :131 |
| 5 | Mention « séances FKS uniquement » | **INCHANGÉ** (absente partout) | emplacement cible :548-550, juste au-dessus de :553-554 |
| 6 | Date locale pour le jour d'un test | **ALLÉGÉ** — recommandation ci-dessous, tranche à Kyllian (§6 Q3) | dateHelpers :15-32 ; ProgressScreen :170-204 ; useTestsStorage :45-57 |
| 7 | Branchement réel de `joursObserves` (+ 7bis reprise) | **DÉJÀ COUVERT EN PARTIE PAR LA BOUCLE** | useExecutionStore :13, :78-90 ; applyExternalLoad :150, :155 ; ExternalLoadScreen :106 ; domain/types :134-143, :203-204 ; resumption :45-65 ; config :59-63 ; useSelfReportedGapDays |
| 8 | reduceMotion | **RETIRÉ DE LA LISTE** (conforme) | origin/fix/cta-reduce-motion:hooks/useReduceMotion.ts ; commits 75b5f19 + 1e450da (non mergés) |

### R1 — Résumé canonique partagé : le contrat tient, le plan de branchement intègre la boucle

Rien dans origin/main ne contredit le contrat du prototype (5752f54 `screens/homeVNext/progressionViewModel.ts` : seuils :158-225 — le bloc porte « SEUILS D'AFFICHAGE DU PROTOTYPE — À VALIDER PAR LE FONDATEUR » :158, re-vérifié ; entrée :362-406 ; `joursObserves` :295-302 ; union d'états :597-632). Mais la boucle fait déjà une partie du travail, avec des périmètres différents :

**Ce que la boucle couvre déjà** :
- `hooks/useTrackingProgress.ts` (75 l.) branche les stores (:28-35) sur `hooks/trackingProgress/buildTrackingProgress.ts`.
- **Comptage de séances exécutées : OUI, mais fenêtré et d'une autre nature.** `sessionsTracked` = `signals.sessionsAnalyzed` (`domain/tracking/signals.ts:342`) = exécutions portant un `completion.pct` calculé (`hasExploitableExecution` :134-137), fenêtre **5 séances / 28 jours** (`domain/tracking/config.ts:15` — re-vérifié). C'est « séances jouées via le tracking live récemment », PAS le cumul `seancesTerminees` du contrat.
- **Progression par exercice : OUI, et le prototype ne l'a pas.** `computeExerciseEvolutions` (`buildTrackingProgress.ts:237-296`). Le contrat ne compare que des tests terrain — **distincts et complémentaires**.
- **Détection de reprise : OUI, canonique et plus riche** — voir R7bis.
- **Comptage hebdo : OUI, et c'est un doublon nouveau.** `countCompletedThisWeek` (`buildTrackingProgress.ts:187-194` — re-vérifié) compte via `weekKeyOf` (`utils/dateHelpers.ts:103-115` — re-vérifié, **lundi fixe**, sert aussi de clé `clubs/{clubId}/weekContexts` l.100-102 : ne PAS le rendre dépendant du réglage) avec cible `targetFksSessionsPerWeek` (profil). Le Home compte via `useWeekSummary`/`useWeekDays` (**respecte `weekStart` mon/sun**, `hooks/home/useWeekDays.ts:38-41`) avec cible `weeklyGoal` (settings, `HomeScreen.tsx:126`, défaut 2). **Deux numérateurs possibles ET deux dénominateurs** pour « X/Y cette semaine ». (La résolution du doublon weeklyGoal vit sur une branche planning-hebdo NON mergée — sur origin/main le doublon est vivant.)

**Ce qui reste distinct (le contrat garde sa raison d'être)** : machine à états empty/collecting/ready, courbe à vrais points + portée obligatoire, seuils 4/3/3 (`SEANCES_MIN_POUR_TENDANCE = 4` viewModel.ts:66, `POINTS_MIN_POUR_COURBE = 3` :84 — re-vérifié ; `PROGRESSION_JOURS_OBSERVES_MIN_POUR_COURBE = POINTS_MIN_POUR_COURBE` progressionViewModel.ts:190), comparaisons de tests 17 champs / 2 jours distincts, faits cumulés (`ProgressionFaitCle` :439-449). Rien de tout ça n'existe dans la boucle.

**Ce que l'intégration devra faire** (repris dans les lots) :
1. Brancher la reprise et le seuil 14 j sur `domain/tracking/` (R7bis) au lieu des constantes locales du prototype → L2.
2. Unifier le compteur hebdo : une seule logique de semaine (celle du Home, weekStart-aware) et une seule cible — sans toucher `weekKeyOf` (clé partagée coach/joueur) → L2.
3. Distinguer les libellés « séances suivies » ≠ « séances terminées » sur l'écran refondu → L5.
4. Décider du sort de `TonSuiviSection` dans la Progression refondue → §6 Q1.

### R2 — Purge des amorces ATL0/CTL0 : INCHANGÉ (+1)

- Graines : `ProgressScreen.tsx:252-253` (`atlSeed = TRAINING_DEFAULTS.ATL0`, `ctlSeed = …CTL0` — re-vérifié), dans `loadSeries` :244-274 (warmup 45 j :246, bouchage à zéro `dailyApplied[key] ?? 0` :258 — re-vérifié). Constantes : `config/trainingDefaults.ts:14-15` (CTL0 15, ATL0 12 ; « TSB initial = +3 » :16).
- Courbe 30 j qui en dérive : `tsbSeries` :276 ; géométrie :419-455 ; rendu SVG :482-547 (couleur = `footballLabel.color` :526 et :537) ; légende :548-550.
- Libellé d'état qui en dérive : `footballLabel` :241 ; hero :467-480. **Attention** : le `tsb` du hero vient du **store**, lui-même amorcé aux mêmes constantes (`state/stores/useLoadStore.ts:19-21`, re-semé par `state/orchestrators/rebuildLoad.ts:39-40`) — la purge d'affichage ne suffit pas, c'est le retrait du hero (étape 1 du plan de migration) qui s'impose.
- À ne PAS toucher : `domain/adviceRules.ts:155` et :287 (autres appels `getFootballLabel`) ; hors périmètre Progression : `HomeScreen.tsx:137`, `components/home/HomeReadinessHero.tsx:57`, `screens/ProfileScreen.tsx:204`.

### R3 — Streaks : INCHANGÉ, recensement complet = 4 définitions à l'écran + 1 interne moteur

| # | Définition | Où (origin/main) | Ce qu'elle compte |
|---|---|---|---|
| 1 | `globalMaxStreak` | ProgressScreen.tsx:334-349 | meilleure suite de **jours**, toute l'histoire, FKS + charges externes mélangées (`activitySet` :287-293) ; alimente l'accomplissement « 7 jours d'affilée » :88-95 (re-vérifié) |
| 2 | `maxStreakThisMonth` | ProgressScreen.tsx:351-366 | meilleure suite de jours **bornée au mois** ; case « Record streak » :739-743 (re-vérifié) |
| 3 | « Série » du Home | hooks/home/useActivityStreak.ts:12-33, affichée HomeScreen.tsx:299 | suite de jours **courante** finissant aujourd'hui (jour de grâce), FKS + externes |
| 4 | Badge « Régularité » du Profil | utils/streakStats.ts:44-82 (`weeksFks`) ; ProfileScreen.tsx:257 (calcul, `[] as any` pour les externes), :275 (seuils 2/4/8), :286 (badge) | suite de **semaines** consécutives (lundi fixe, `toWeekKeyMonday` :7-13) avec ≥1 séance FKS |
| 5 | `streakOkSessions` (interne) | domain/tracking/signals.ts (config `rpe.streakTolerance` config.ts:32, `progression.minStreakForSmallStep` :45) | suites de séances au RPE proche de la cible — **signal moteur de la boucle, jamais affiché : NE PAS le ramasser dans la purge** |

`ProfileScreen.tsx:530` porte aussi un en-tête « Ta régularité » (tendance TSB, pas un streak). Au L5 : purge des définitions 1-2 (+ accomplissement :88-95 et case :739-743) selon l'étape 4 du plan de migration ; les définitions 3-4 sont hors ProgressScreen mais à citer dans la décision produit « une seule définition, écrite » (décision déjà documentée au plan, pas nouvelle) ; la #5 est intouchable.

### R4 — État « collecting » : INCHANGÉ côté ProgressScreen, pattern DÉJÀ COUVERT par TonSuivi

- ProgressScreen n'a toujours **aucun** état collecting : courbe produite quoi qu'il arrive (:244-274), hero toujours rendu, milestones toujours rendus (:556+), stats affichant « 0 » et « — » (Séances :723, RPE :729, durée :736 — re-vérifié).
- `TonSuiviSection` fait exactement ce registre par **garde par bloc** : « Pas encore assez de données sur tes dernières séances. » (:82-86), « Pas encore assez de données sur ton effort ressenti. » (:100-102, seuil 3 deltas `minSessionsForSignal` config.ts:29) ; blocs non rendus quand vides (:71, :89, :107, :119, :131). Aucune valeur inventée, jamais de « 0 » bouché.
- Pour l'intégration : deux styles d'honnêteté coexisteront — l'union discriminée du contrat (supérieure pour la courbe : impossible à afficher par construction) et la garde par bloc (bonne pour des lignes indépendantes). **À unifier au moins dans la formulation des phrases « pas encore assez de données »** → L5.

### R5 — Mention « séances FKS uniquement » : INCHANGÉ (absente partout)

- `git grep` sur origin/main (re-vérifié) : la mention de **portée** « FKS uniquement » n'existe nulle part (0 occurrence). Le libellé « séances FKS » existe, mais toujours dans un autre registre — réglage/setup (`ProfileSetupScreen.tsx:323` et `:639`, `SettingsScreen.tsx:456`), titre de routine (`RoutineScreen.tsx:274`), commentaires de code (`ProgressScreen.tsx:400`, `state/computeDailyApplied.ts:6`) — aucun ne décrit la portée de la courbe.
- Emplacement cible dans la Progression refondue : sous la courbe, à l'emplacement de la légende actuelle (:548-550) — étape 1 du plan, lignes à jour :467-480 (retrait hero) + :548-550 (portée).
- Fait nouveau : la phrase tombera juste **au-dessus** de TonSuiviSection (:553-554), dont les données sont FKS-only par construction, alors que la courbe mélange FKS + charges club/match auto-injectées via `dailyApplied`. La portée écrite explique donc aussi pourquoi les deux blocs voisins ne racontent pas le même périmètre.

### R6 — Date du jour d'un test : ALLÉGÉ ; contradiction inter-enquêtes documentée, tranche renvoyée en §6 Q3

- Le vrai code ne calcule **aucun** jour pour les tests : `computeTestComparisons` (:170-204, re-vérifié : `if (tests.length < 2) return []` l.171) prend les 2 valeurs les plus récentes par champ sans règle de date — le défaut « deux essais du même après-midi = progression » est toujours là.
- Les tests stockent un `ts` epoch ms (validé/trié/borné 30 par `screens/tests/hooks/useTestsStorage.ts:45-57` ; `readTestsRaw` :16-22 rend le brut — ProgressScreen l'utilise encore directement :227-237, ce que le contrat interdit).

**La contradiction** : l'enquête « restes » déclarait le sujet tranché (jour local) ; l'enquête « lots » le renvoyait au fondateur avant L4. Re-vérifié ce jour sur les deux arbres :
- `toDateKey` est **explicitement local** (origin/main `utils/dateHelpers.ts:15-32` ; l.25-27 : un horodatage avec heure est parsé puis converti en **jour local**, l'exemple du commentaire est littéralement « 23:30 »).
- Le prototype calcule en **UTC** (5752f54 `progressionViewModel.ts:663-668`, `toISOString().slice(0,10)`) et son propre doc-commentaire (:655-661) + `protoWarnings` (:1155-1159) disent : UTC = artefact de reproductibilité des captures, « un test fait à 23 h ne doit pas basculer au lendemain », « l'app utilise partout ailleurs `toDateKey`, qui est LOCAL ».

**Recommandation du dossier (assemblage, 02/08)** : les deux enquêtes ET le code du prototype décrivent le même comportement attendu (un test à 23 h reste sur son jour vécu) ; seul le jour **local** le garantit, et c'est la convention d'app (helper partagé, règle n°9 du CLAUDE.md). Recommandation : au branchement L4, la règle « 2 jours distincts » se calcule avec `toDateKey(new Date(ts))` — jour local — et l'UTC du prototype (artefact de reproductibilité des captures) est remplacé. **Mais la tranche revient à Kyllian, pas à ce dossier** : ce point n'est pas dans la liste fermée §0.3, et le prototype lui-même écrit deux fois que la question « devra être tranchée avec le fondateur » (doc-commentaire :655-661 et `protoWarnings` :1155-1159). → **§6 Q3**, échéance : avant le branchement L4.

### R7 — `joursObserves` : DÉJÀ COUVERT EN PARTIE PAR LA BOUCLE

Rappel du besoin (contrat, 5752f54 progressionViewModel.ts:295-302) : `joursObserves` = jours distincts où une charge **réelle** a été enregistrée — jamais une injection auto club/match. (Note : le « flag jamais-lu observedDayCount » d'une revue antérieure est sans objet sur 5752f54 — le contrat l'expose sous `joursObserves`, lu :1290 et seuillé :1292-1295, re-vérifié.)

**Sources branchables aujourd'hui sur origin/main** :
1. **`useExecutionStore.history`** (NOUVEAU) : exécutions finalisées (`finishedAtISO`), dédupliquées par sessionId (:78-90), cap 50 (:13), persistées (`fks-execution-v1` :132). Preuve la plus forte, mais couvre uniquement les séances passées par le tracking live.
2. **Sessions complétées ∪ charges externes manuelles** — reconstruction exhaustive : jours de `useSessionsStore.sessions` complétées ∪ jours de `useExternalStore.externalLoads` dont l'id ne commence pas par `auto_`. Marquage fiable : charges auto = `id = \`auto_${source}_${dayKey}\`` (`state/orchestrators/applyExternalLoad.ts:150`) + `notes: "Auto (profil club/match)"` (:155) ; manuelles via `genId()` (`screens/ExternalLoadScreen.tsx:106`). Ce marquage existait à 724c062 — le nouveau, c'est qu'il **suffit** : plus besoin de créer un champ.
3. **Champs embarqués côté session** (NOUVEAU) : `Session.execution` / `Session.tracking` (`domain/types.ts:203-204`, attachés par `applyFeedback.ts:197-259`), `SessionFeedback.executionSummary` (`domain/types.ts:134-143`). Miroir Firestore : `users/{uid}.lastTrackingDecision` (`applyFeedback.ts:239`).

**Ce qui manque encore** : `dailyApplied` reste un `Record<dayKey, number>` sans distinction de source (écritures `applyExternalLoad.ts:80`, `applyFeedback.ts:143` ; fenêtre 90 j via `pruneDailyAppliedWindow`) — la source « telle qu'écrite » dans le contrat n'est pas filtrable directement ; la reconstruction n°2 la remplace. Bornes (history 50, prune 90 j, sessions 200) : aucune ne gêne pour une fenêtre de 30 j.

**Recommandation d'intégration (L2)** : `joursObserves` = |jours (fenêtre 30 j) issus de {sessions complétées} ∪ {externalLoads manuelles}| (source n°2) ; la n°1 = source d'un futur « réellement exécuté » si on durcit plus tard.

### R7bis — La reprise est désormais canonique (découverte de la re-vérification)

- `domain/tracking/resumption.ts` : `detectTrainingGap` (:45-65) — priorité aux séances terminées, puis gap auto-déclaré, sinon « unknown » ; niveaux soft/hard ; `buildResumptionRecommendation` (:68+) — hard ⇒ fondation + dose réduite.
- Seuils : `TRACKING_CONFIG.resumption` (`domain/tracking/config.ts:59-63` — re-vérifié : `gapDaysSoft: 14`, `gapDaysHard: 28`, `minCompletionForLastSession: 40`). Le « 14 » du prototype (5752f54 viewModel.ts:105 `JOURS_SANS_SEANCE_POUR_REPRISE = 14` — re-vérifié — et :982) = même valeur, **deux sources de vérité à fusionner : l'intégration lit la config, ne redéclare pas la constante** → L2.
- NOUVEAU : `hooks/useSelfReportedGapDays.ts` (onSnapshot `users/{uid}.selfReportedGapDays`, posé au setup profil) — l'état « reprise » atteignable même sans historique local.
- Piège déjà résolu par la boucle, à reprendre tel quel : le gap se calcule depuis **toutes** les séances complétées, pas seulement `executionHistory` (fix P2-e, `buildTrackingProgress.ts:159-185` + :374-384) — sinon un joueur régulier sans tracking live déclenche à tort le bandeau reprise.
- Honnêteté du verbe : le futur du prototype (« on te préparera une remise en route progressive ») reste correct en prod — la capacité d'alléger existe (`domain/tracking/apply.ts`, branché `services/aiContext.ts:366-384`) mais le mode apply est **OFF par défaut** (`domain/tracking/modes.ts:25-29`), pilotable via `users/{uid}.trackingConfig.apply`. Réviser la formulation de LIMITES §2.1 : « le moteur sait, mais c'est éteint (décision pilote) ».

### R8 — reduceMotion : RETIRÉ DE LA LISTE (conforme)

`origin/fix/cta-reduce-motion:hooks/useReduceMotion.ts` (27 l.) a exactement la forme attendue (LIMITES §4 quater) : `useReduceMotion(): boolean`, lecture `AccessibilityInfo.isReduceMotionEnabled()` au montage + abonnement `reduceMotionChanged`, garde anti-setState-après-unmount. Valeur initiale `false` le temps de la résolution async (flash d'une frame possible, jugé sans enjeu, non testé sur appareil — point de recette L3). Les 2 commits (`75b5f19` pulsation `HomePrimaryCTA`, `1e450da` LoadingOverlay) sont sur base 971c37c et **non mergés** (re-vérifié). **L'intégration importe `hooks/useReduceMotion` et n'ajoute rien** — le merge de cette branche est le préalable L0.1.

---

## 3. Les lots d'exécution

> **CONDITION DE MERGE (chaque lot visible à l'écran, L3 à L6) : recette téléphone 320 / 375 / 390 px × texte agrandi ×1,3 × animations réduites — AVANT tout merge.** Pourquoi elle est bloquante : les plafonds `maxFontSizeMultiplier` (politique : salutation 1,2 / titreAction 1,2 / overline 1,15, **aucun plafond sur les rôles d'information** — 5752f54 `homeVNextTypo.ts:347-358` et `plafondDuRole` :371-374, re-vérifié) **ne passent pas par react-native-web** : le harnais simule ×1,3 sans la mécanique native, les plafonds n'ont jamais été vus en réel. S'ajoutent `numberOfLines` rendu en `-webkit-line-clamp` côté web, la largeur de courbe par `onLayout` réel, et le précédent du 01/08 (3 bugs natifs trouvés au téléphone, invisibles en web).

**Mapping restes → lots** : R1.1/R1.2/R7/R7bis → L2 · R6 → L4 (tranche en §6 Q3, avant le branchement) · R2/R3/R4/R5/R1.3 → L5 · R8 → L0.1 · R1.4 → §6 Q1 (échéance maquette L5).

### L0 — Préalables (avant d'ouvrir L1)

1. **Merger `fix/cta-reduce-motion`** (75b5f19 + 1e450da ; touche `hooks/useReduceMotion.ts`, `components/home/HomePrimaryCTA.tsx`, `components/ui/LoadingOverlay.tsx`, `hooks/useHaptics.ts`). L'intégration **consomme** `useReduceMotion()` — ne pas le récrire.
2. **Merger l'espace Coach** (ordre acté). La branche coach emporte `navigation/RootNavigator.tsx` : L3 se fait sur le RootNavigator **post-coach** (§4.2).
3. **Arbitrage orchestrateur** sur les branches concurrentes touchant le Home — planning-hebdo É1.5 « calendrier fusionné au Home » (poussée, non mergée) touche le même écran que L3/L6 ; l'ordre boucle→coach→Home ne dit rien d'elle. Hors périmètre de ce dossier, séquençage obligatoire avant L3.

### L1 — Socle typo / tokens / présentation

- **Fichiers** (tels quels, TS strict déjà vert) : `components/homeVNext/homeVNextTypo.ts`, `homeVNextTokens.ts`, `homeVNextPresentation.tsx`, `HomeVNextPrimitives.tsx`, `homeVNextMarqueurs.ts`. Branchement réel de reduceMotion : défaut du provider = `hooks/useReduceMotion()` (mode d'emploi écrit dans `homeVNextPresentation.tsx:21-27`, 5752f54 — re-vérifié), la prop restant une surcharge pour tests/visualiseur. **Supprimer `prototype/home-vnext/types/react-test-renderer.d.ts`** (doublon ambiant, §1.4) et retirer `"./types/**/*.d.ts"` de l'include de `tsconfig.proto.json`.
- **Tests** : `__tests__/homeVNext/echelleEtMouvement.test.tsx` + helper `libellesEtatInterdits.ts` — config `jest.worktree.config.js`.
- **Livrable seul** : oui (rien de visible). **Recette téléphone** : aucune (pas d'écran) — mais c'est le lot qui pose les plafonds : la dette de recette commence ici et se paie au L3.
- **Risque principal** : deux sources de vérité typo/couleurs (theme.ts vs tokens) pendant la transition — documenter, ne pas fusionner précipitamment.

### L2 — ViewModels + branchement stores réels

- **Fichiers** : `screens/homeVNext/viewModel.ts` et `progressionViewModel.ts` (tels quels) + **nouveau** `hooks/home/useHomeVNextViewModel.ts` (adaptateur stores → `HomeVNextInput` + `ProgressionInput`). Chaque champ d'entrée porte sa source exacte en commentaire (viewModel.ts:339-452, 5752f54) ; helpers vérifiés sur origin/main : `utils/sessionHelpers.ts` `isSessionCompleted` l.26, `getSessionDuration` l.40, `selectPendingSession` l.65.
- **Champs sans source aujourd'hui** (LIMITES §2.2) : séance « commencée », `generationError` (champ à créer), `clubDirective` (lu seulement dans `services/aiContext.ts` à la génération). Livrer avec `null` : les états 3/10/12/13 ne se déclenchent pas. Note : le ton « prudence » de la note n'est produit par aucune situation (LIMITES §2.6) — son rendu réel n'est vérifié nulle part, à garder en tête à la recette L3.
- **Le vrai chantier du lot** :
  - `formTrend` : série **sans amorçage** ATL0/CTL0 + compteur `joursObserves` — l'actuel `hooks/home/useLoadSeries.ts` amorce (21 j de warmup) et ne convient pas tel quel. `joursObserves` = source n°2 du R7 (sessions complétées ∪ externes manuelles, fenêtre 30 j).
  - **Reprise** : brancher sur `domain/tracking/resumption.ts` + `TRACKING_CONFIG.resumption` (config.ts:59-63) — ne PAS redéclarer le « 14 » local du prototype (viewModel.ts:105). Reprendre le fix P2-e (gap depuis toutes les séances complétées).
  - **Compteur hebdo unifié** : une seule logique de semaine (celle du Home, weekStart-aware) et une seule cible, pour le bloc « Ma semaine » ET `buildTrackingProgress` — sans toucher `weekKeyOf` (clé partagée coach/joueur). Verrouiller l'égalité par un test.
- **Tests** : `viewModel.test.ts`, `progressionViewModel.test.ts`, `appariementVariante2.test.ts` + nouveaux tests de l'adaptateur (formes réelles des stores). Config `jest.worktree.config.js`.
- **Livrable seul** : oui (hook consommé par personne). **Risque principal** : l'adaptateur réintroduit ce que les ViewModels interdisent (un défaut, un 0 de remplissage) — les tests d'adaptateur verrouillent « donnée absente = champ null », jamais une valeur.

### L3 — Écran Home + navigation (post-coach)

- **Fichiers** : `screens/homeVNext/HomeVNextScreen.tsx` + les 9 composants de rendu restants ; `navigation/RootNavigator.tsx` — sur origin/main le tab Home rend `<HomeScreen />` dans `SwipeTabsWrapper` (l.147-150) ; **après le merge coach, mêmes ancres décalées d'environ +5/+6 lignes** (§4.2). Brancher le conteneur vNext (variante v2 : écran + carte progression, ordre `HOME_VNEXT_SECTION_ORDER_V2` = header · action · week · progression · note, 5752f54 HomeVNextScreen.tsx:108-114 — re-vérifié) + câblage `onAction`/`onExit` vers les routes réelles.
- **Livraison recommandée : derrière un flag** (précédent : `FEATURES.WEEK_PLAN`, flag OFF = zéro diff) — merge sans big-bang, ancien Home en repli jusqu'à la recette.
- **Règle de survie coach (§4.3)** : ajouts locaux uniquement dans RootNavigator (route dans `AppStackParamList`, écran dans `AppNavigator`, éventuel `Tab.Screen`), aucune chaîne appSpace renommée/déplacée, relancer les 4 tests `navigation/__tests__/`.
- **Tests** : `HomeVNextScreen.test.tsx` + suite navigation complète du main post-coach. Config `jest.worktree.config.js`, suite entière.
- **Recette téléphone (bloquante, voir encadré)** : premier lot où les plafonds sont visibles en vrai. Vérifier aussi : un seul aplat, skeleton `hydrating`, bandeau hors-ligne, pulsation coupée sous reduceMotion (y compris le flash possible de la 1re frame, R8), taps à travers `SwipeTabsWrapper` (précédent 01/08 : TWF avalait des taps).
- **Dépend de** : L1 + L2 + coach mergé (+ arbitrage L0.3). **Risque principal** : navigation/gestes natifs invisibles en web.

### L4 — Carte progression + règle de test (activation v2 réelle)

- **Fichiers** : `components/homeVNext/HomeVNextProgression.tsx` (déjà livré fichier au L3) ; remplacer l'adaptateur de démo `progressionInputDepuisHome` (5752f54 fixtures.ts:1068 — re-vérifié, marqué « PAS un branchement de production » :1065-1066) par l'entrée réelle du L2 ; source des tests = `screens/tests/hooks/useTestsStorage.ts` (jamais `readTestsRaw` brut).
- **Règle actée, rien à redébattre** : mapping cycle→test + départage figé + R9 (§0.3, références re-vérifiées).
- **Jour d'un test : recommandation R6, tranche en §6 Q3 (à valider au plus tard avant le branchement de ce lot)** — recommandé : jour **local** via `toDateKey(new Date(ts))` ; l'UTC du prototype (:663-668) est remplacé au branchement. Un test fait à 23 h ne doit pas basculer au lendemain.
- **Tests** : `HomeVNextProgression.test.tsx` + `progressionViewModel.test.ts` (repère et départage déjà verrouillés). Config `jest.worktree.config.js`.
- **Recette téléphone (bloquante, voir encadré)** : les 3 états (empty/collecting/ready) sur compte réel ; en texte agrandi, la **phrase de portée** ne doit pas être coupée (question ouverte n°5 de LIMITES) ; largeur de courbe par `onLayout` réel.
- **Risque principal** : les seuils d'affichage (`PROGRESSION_SEANCES_MIN_POUR_TENDANCE` etc., 5752f54 progressionViewModel.ts:158-225) sont marqués « À VALIDER PAR LE FONDATEUR » — **à faire valider à la démo de ce lot**, sinon ils deviennent des décisions par défaut (§6, rappel d'échéance).

### L5 — Refonte ProgressScreen sur le résumé canonique

- **Fichiers** : `screens/ProgressScreen.tsx` uniquement (+ tests nouveaux). Suivre les étapes 1→4 de `MIGRATION_PROGRESSSCREEN.md` (étape 5 — compteur de cycles persisté — hors périmètre recommandé) avec les lignes **origin/main** de la table §1.1 :
  - **e1** : retirer le hero forme (l.241, l.467-480) et écrire la portée « séances FKS uniquement » sous la courbe (l.548-550) ;
  - **e2** : remplacer `loadSeries` (l.244-274) par les états du contrat (empty/collecting/ready) ;
  - **e3** : remplacer `computeTestComparisons`/`TEST_FIELDS` (l.145-204) par `construireComparaisonsTests` ;
  - **e4** : trancher streaks/milestones (l.57-113, l.334-366, l.739-743 ; garder les 3 comptes) — la décision « retirer les 3 accomplissements déduits vs les séparer visuellement » est documentée au plan et **pas encore prise** (§6, rappel d'échéance).
- **TonSuivi** : continuer de la rendre (§1.2) ; sa place = décision de maquette de ce lot (§6 Q1) ; libellés « suivies » vs « terminées » distincts (R1.3) ; phrases d'honnêteté harmonisées (R4) ; vérifier la continuité de `progress_tracking_viewed` si la section bouge (§1.2).
- **Tests** : nouveaux tests ProgressScreen + un test verrouillant **seuils Home == seuils Progression** (exigé par l'étape 2 du plan) ; `hooks/__tests__/useTrackingProgress.test.ts` (358 l., déjà dans main) doit rester vert. Config `jest.worktree.config.js`, suite entière.
- **Recette téléphone (bloquante, voir encadré)** : page Progression dans les 3 états + TonSuivi visible + aller-retour Home→Progression (le pied « Voir ma progression » n'existe qu'en `ready`).
- **Livrable seul** : oui après L2 (ne dépend pas techniquement de L3/L4) — mais l'ordre L4→L5 reste le bon par défaut ; tant que L5-e1 n'est pas fait, la carte L4 porte sa `reserve` (« le mensonge à un clic de distance », dixit le plan de migration).
- **Risque principal** : produit, pas technique — des joueurs qui voyaient une courbe passeront en `collecting` (**à annoncer, pas à subir**).

### L6 — Nettoyage

- **À supprimer** (inventaire origin/main vérifié) : `screens/HomeScreen.tsx` ; `components/home/` en entier (5 fichiers : HomeAdviceCard, HomeCarouselCard, HomeNextSessionCard, HomePrimaryCTA, HomeReadinessHero — les « legacy » du CLAUDE.md HomeCycleHero/HomeDashboardCard/HomeReadinessCard **n'existent plus** sur origin/main, le CLAUDE.md est périmé là-dessus) ; dans `hooks/home/` : useLoadSeries, useMatchSoon, useWeekDays, useActivityStreak, usePrimaryCta — **GARDER** `useWeekSummary` (source du L2) et **GARDER ou déplacer** `useContextualAdvice` (importé par `screens/NewSessionScreen.tsx:46` — vérifié).
- Imports vérifiés : `components/home/*` n'est importé que par HomeScreen ; `hooks/home/*` par HomeScreen + NewSessionScreen (useContextualAdvice). **Refaire ce grep au moment du lot** : coach + planning-hebdo auront bougé les imports.
- **Harnais** : proposer de garder `prototype/home-vnext/` + `jest.proto.config.js` tant que la doctrine « démo avant commit » s'en sert (attention : `__tests__/homeVNext/visualiseurAxes.test.ts` importe des modules du harnais — supprimer le harnais tue ce test) ; `outputs/` reste en archive. Supprimer le flag L3 une fois le vNext par défaut.
- **Analytics** : inventorier les events du vieux Home qui disparaissent avec lui (non inventoriés dans ce dossier — à lister au moment du lot).
- **Tests** : suite entière `jest.worktree.config.js` + eslint (cwd DANS le worktree) + tsc racine depuis le checkout principal.
- **Recette téléphone (bloquante, voir encadré)** : passe complète de non-régression (Home, génération, Progression, Tests) — recette de fermeture du chantier.
- **Risque principal** : suppression d'un module encore référencé.

---

## 4. Les conflits prévisibles avec la branche coach — à NE PAS résoudre ici

Méthode de l'enquête : intersection des `git diff --name-only 724c062 <branche>` des deux côtés + **merge à blanc** `git merge-tree --write-tree origin/main origin/feat/coach-pilot-experience` (aucun ref ni fichier touché). Résultat : **3 fichiers touchés des deux côtés, UN SEUL conflit textuel réel.** Caveats : la branche coach peut encore avancer avant son merge (numéros de ligne coach = 4ecf79f, les ancres textuelles resteront) ; merge-tree utilise la stratégie ort par défaut (aucun renommage en jeu, risque très faible) ; les 4 tests navigation ont été analysés **sur source**, pas exécutés.

### 4.1 Conflits coach vs main actuel (surgiront AU MERGE COACH, avant l'intégration Home)

| Fichier | Main (base→971c37c) | Coach (base→4ecf79f) | Verdict merge à blanc | Qui résout |
|---|---|---|---|---|
| `screens/ProfileSetupScreen.tsx` | +36/−0 | +103/−56 | **CONFLICT (content)** — 1 zone | **le merge coach** (pas l'intégration Home) |
| `services/aiContext.ts` | +45/−2 | +21/−4 | auto-merge propre | merge coach (simple relecture) |
| `types/react-test-renderer.d.ts` | ajout | ajout | **aucun conflit** (blobs identiques) | personne |

**4.1.a `ProfileSetupScreen.tsx` — LE conflit du merge coach.** Côté main : 5 hunks, purs ajouts = la question « reprise/coupure » de la boucle (constante `SELF_REPORTED_GAP_OPTIONS` :90-96, état :161-162, préremplissage :222-225, **champ payload `selfReportedGapDays` :429-432** — re-vérifié ce jour : commentaire « jamais de valeur inventee » l.429, champ l.430-432 —, bloc UI :645-656). Côté coach : 9 hunks, réécriture du flux de sauvegarde — le `setDoc` direct devient `saveProfileThenAttachClub(...)` (nouveau module `screens/profileSetup/attachClub.ts`), rattachement club côté serveur APRÈS l'enregistrement, `club_code_checked` ré-émis sur `attach.status` (coach:397-446) ; l'ancien flux client `findClubByInviteCode`→`setClubMembership` (main:407-421, hérité de la base — `setClubMembership` à :420) disparaît — c'est l'intention du lot coach. Zone en conflit : bloc main = `setDoc` AVEC `selfReportedGapDays` vs bloc coach = wrapper SANS.
**Résolution correcte (à faire par le merge coach)** : structure coach + **réinjection des 4 lignes `selfReportedGapDays` (origin/main:429-432) dans le payload interne de `saveProfile`**. Risque si résolu « tout coach » : le champ reprise/coupure n'est plus jamais écrit pour les nouveaux profils — perte silencieuse d'une donnée qui nourrit le contexte backend ET l'état reprise du Home vNext (R7bis dépend de `users/{uid}.selfReportedGapDays`). **L'intégration Home vérifiera après le merge coach que le champ est toujours écrit — c'est son seul intérêt dans ce fichier.**

**4.1.b `services/aiContext.ts` — auto-merge confirmé, zones disjointes.** Main : imports tracking + `const context` → `let context` + bloc « mode Application » en fin de `buildAIPromptContext` (:354-390 env.). Coach : import + lecture de la DIRECTIVE club dans le bloc `clubContext` (coach:~198-233). Compatibles sémantiquement (la directive enrichit le contexte transmis ; l'ajustement tracking modifie le contexte après construction).

**4.1.c `types/react-test-renderer.d.ts` — le « conflit garanti » des notes antérieures N'EXISTE PLUS.** Re-vérifié ce jour par `ls-tree` : blob **strictement identique** `c8abb0758f69` sur origin/main ET sur coach. Add/add à contenu identique = résolution automatique ; le merge à blanc ne le liste même pas. (Le brief d'orchestration et la mémoire disaient « conflit garanti » : périmé.) Le SEUL doublon restant est celui du harnais prototype, traité au L1 (§1.4).

**4.1.d Hors conflit, à savoir pour le merge coach** : coach supprime `screens/CoachHomeScreen.tsx` et `screens/CoachPlayerDetailScreen.tsx` (aucun des 72 fichiers de main ne les référence → suppressions nettes) ; `jest.worktree.config.js` (main) et `jest.coach.config.js` (coach) coexisteront (noms distincts volontaires).

### 4.2 Ce que le merge coach change sur le périmètre Home

**Fait cadre** : le périmètre Home strict est **intact** côté coach — aucun `screens/HomeScreen.tsx`, `components/home/`, `hooks/home/`, `screens/ProgressScreen.tsx`, `screens/tests/`, ni `components/SwipeTabsWrapper.tsx` parmi les 221 fichiers.

**`navigation/RootNavigator.tsx` passera intégralement à la version coach, sans conflit** (main ne l'a pas touché depuis la base : blob identique, 482 lignes ; coach le porte à 581 lignes, +112/−13). **L'intégration Home (L3) travaille sur ce RootNavigator-là.**

Ne bouge pas (mêmes déclarations, décalées de +5/+6) : `TabParamList {Home, NewSession, Profile}` (coach:60-64) ; `AppStackParamList` inchangé champ pour champ (coach:66-104) — c'est là que L3 ajoute ses routes ; `PLAYER_TAB_ORDER` (coach:130) ; `MainTabs()` avec `SwipeTabsWrapper` (coach:132-175) ; `AppNavigator()` + modals (coach:178-243, dont `Progression` coach:216, `Tests` coach:228).

Change autour (numéros coach) : l'état `role` disparaît au profit de `clubId` (coach:357, `resolveClubPointer` coach:476-477) ; `useAppSpace({ uid, clubId })` (coach:375, nouvel abonnement `clubs/{clubId}/members/{uid}`) ; relais unique `publishAppSpaceSwitch` (coach:393-400) ; **nouvelles portes AVANT l'app joueur** — `decision === "en-attente"` → Splash (coach:524), `autorite === "indetermine"` → écran dédié (coach:539-541), `space === "coach"` → `CoachNavigator` (coach:545-546) ; `CoachTabs` = second bottom-tab-navigator (166 l.), sans interaction avec les tabs joueur. `components/ui/ToastHost.tsx` : coach seulement, +3/−1 typage timer, comportement identique + nouveau test (149 l.). `screens/SettingsScreen.tsx` : monte `AppSpaceSwitch variant="joueur"`.

### 4.3 Les 4 tests navigation du coach — ce qu'ils verrouillent pour L3

3 des 4 lisent la **source** de `RootNavigator.tsx` (`readFileSync`) au lieu de monter le navigateur → sensibles aux refactors purement cosmétiques.

1. `rootNavigatorSpaceWiring.test.ts` — **risque ÉLEVÉ** : chaîne exacte `useAppSpace({ uid: user?.uid ?? null, clubId })` ; présence `appSpace.space === "coach"` ; absence de `if (role === "coach")`, `data?.role`, `setRole(` ; `decision === "en-attente"` AVANT `space === "coach"` (indexOf). Tombe si L3 renomme une variable, réordonne les portes ou extrait la logique dans un helper.
2. `appSpaceSwitchWiring.test.ts` — **risque MOYEN** : chaînes exactes dans RootNavigator + **scan récursif** de `navigation/ screens/ components/ hooks/ state/ domain/` : le SEUL fichier contenant `publishAppSpaceSwitch(` doit être RootNavigator ; le SEUL `<CoachSelfPlayerCard` doit être `screens/coach/CoachWeekScreen.tsx`. **Tout nouvel écran de l'intégration Home est balayé par ces scans** — il ne doit contenir ni l'un ni l'autre.
3. `coachAccessInvariants.test.ts` — **risque ÉLEVÉ sur sa partie source** (recoupe le n°1), nul sur sa partie domaine.
4. `coachTabs.test.ts` — **risque NUL pour le Home**.

**Règle de survie L3 (déduite, pas une décision)** : toucher RootNavigator UNIQUEMENT par ajouts locaux ; ne jamais renommer/déplacer les chaînes et portes appSpace ; relancer les 4 fichiers `navigation/__tests__/` avant de pousser.

---

## 5. Outillage — configs à utiliser, pièges worktree

### 5.1 Config canonique : `jest.worktree.config.js` (main)

Preset `jest-expo`, `setupFiles: <rootDir>/jest.setup.js`, `testMatch **/__tests__/**/*.test.ts(x)`, ignore node_modules/firestore-tests/functions, mêmes `transformIgnorePatterns` que le dépôt (présent sur origin/main — re-vérifié `ls-tree`). Elle couvre déjà `__tests__/homeVNext/**`. **Passe ciblée : `npx jest --config jest.worktree.config.js __tests__/homeVNext` (chemin en slashs).** Ses globs n'injectent pas `<rootDir>` → pas exposée au bug Windows des antislashs qui a motivé le `testRegex` du proto.

`prototype/home-vnext/jest.proto.config.js` ne sert plus qu'au harnais (`verifier.js`) tant qu'il vit — le retirer quand le harnais part (L6). `tsconfig.proto.json` : corrige `typeRoots` (les ~1510 fausses erreurs du tsc nu en worktree), périmètre limité aux 3 dossiers homeVNext, strict hérité.

### 5.2 Pièges connus (rappel obligatoire)

- `npx jest` NU depuis un worktree : **0 test, exit SUCCÈS** (le bloc jest de package.json exclut `/.claude/worktrees/`) — mesure LE VIDE.
- `npx tsc --noEmit` NU depuis un worktree : **~1510 fausses erreurs** (pas de node_modules local).
- `eslint` depuis la RACINE du dépôt : ignore `.claude/worktrees/` (« File ignored by default » = 0 erreur qui mesure le vide) — toujours lancer avec le cwd DANS le worktree.
- JAMAIS de `npm/yarn install` dans le worktree (node_modules résolu vers la racine).

### 5.3 Preuves fraîches (mesurées le 02/08 sur 5752f54)

- `npx jest --config prototype/home-vnext/jest.proto.config.js` → **7 suites, 844/844 verts, 7,0 s**.
- `npx tsc --noEmit -p prototype/home-vnext/tsconfig.proto.json` → **0 erreur**.

---

## 6. Décisions — TRANCHÉES (Kyllian, 02/08/2026, consignées par le copilote)

> Section mise à jour le 02/08 : les trois questions posées le 01/08 sont fermées. Plus
> **aucune décision ouverte** dans ce dossier — les seuls points restants sont les rappels
> d'échéances ci-dessous, déjà documentés ailleurs.

### Q1 — TRANCHÉE : « Ton suivi » reste, EMPILÉ sous le résumé canonique, libellés distincts

Option (a) retenue. Dans la Progression refondue (L5) : **résumé canonique → Ton suivi →
blocs refondus**, avec les libellés distincts « séances suivies » (fenêtre 28 j / 5 séances,
tracking live) vs « séances terminées » (cumul). Aucune fusion de calculs : deux blocs, deux
périmètres, deux vérités qui ne se contredisent pas parce qu'elles ne prétendent pas mesurer
la même chose. Le bandeau reprise de « Ton suivi » reste visible en haut de page.

### Q2 — TRANCHÉE : la ligne « X/Y séances cette semaine » SORT de « Ton suivi »

Une fois le Home v2 en place (donc au L5, après L3), le compteur hebdomadaire vit **au Home,
seul et unique**. La ligne de « Ton suivi » est retirée ; le test d'égalité perpétuel entre
deux calculs à deux cibles n'a plus lieu d'exister. Conséquence pour le L2 : l'unification du
calcul hebdo reste nécessaire (le Home doit porter la bonne cible), mais elle n'a plus qu'un
seul consommateur d'écran.

### Q3 — REQUALIFIÉE : jour LOCAL — ce n'était pas une question ouverte

Le jour local était **déjà acté le 31/07** dans les restes d'intégration (« date LOCALE pour
les tests », doctrine `toDateKey` du dépôt — origin/main `utils/dateHelpers.ts:15-32`). La
relecture adversariale avait eu raison de refuser de trancher à la place du fondateur, mais
la décision existait déjà : ce dossier la remet à sa place de **décision prise**, pas de
question. Au branchement L4 : jour d'un test = `toDateKey(new Date(ts))`. L'UTC du prototype
reste un artefact de reproductibilité des captures, remplacé au branchement.

### Rappels d'échéances (décisions DÉJÀ documentées, pas nouvelles — listées pour ne pas les rater)

- **Démo L4** : valider les seuils d'affichage de la carte progression (4 séances / 3 points / 3 jours observés / 2 jours par champ de test — marqués « À VALIDER PAR LE FONDATEUR », 5752f54 progressionViewModel.ts:158-225). Sinon ils deviennent des décisions par défaut.
- **L5** : accomplissements — retirer les 3 déduits ou les séparer visuellement (étape 4 de `MIGRATION_PROGRESSSCREEN.md`, documentée, non prise).
- **L5** : annoncer (pas subir) le passage en `collecting` des joueurs qui voyaient une courbe amorcée.
- **L0.3 (orchestrateur, pas Kyllian)** : séquencer la branche planning-hebdo É1.5 vis-à-vis de L3/L6.

---

*Fin du dossier. Fichiers compagnons dans ce même dossier : `MIGRATION_PROGRESSSCREEN.md` (étapes e1→e4, lignes à décaler selon §1.1), `LIMITES_PROTOTYPE.md`, `VIEWMODEL_PROGRESSION.md`. Ce dossier est versionné sur `feat/home-vnext-prototype` (commit initial `28ed105`, décisions du 02/08 dans le commit suivant) ; aucun fichier hors de `outputs/home-vnext-prototype-2026-07-27/` n'a été touché.*
