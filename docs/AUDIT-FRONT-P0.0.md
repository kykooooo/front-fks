# AUDIT FRONT P0.0 — FKS (app joueur / pilote clubs)

> Équivalent front de l'audit P0.0 backend. **Lecture seule — aucune modification de code, aucun commit.**
> Périmètre : `front-fks` (React Native / Expo SDK 54, RN 0.81, React 19). Backend non touché.
> Méthode : suivi du payload `fks.next_session.v2` de bout en bout + scan des écrans principaux. Les trouvailles marquées **✓ vérifié** ont été relues directement dans le code (citations `fichier:ligne`).
> Format d'une trouvaille : **(écran)** — cause technique — **gravité pilote** — _fix proposé (1 ligne)_.
> Gravité = impact sur un coach/joueur pilote réel (Laurent, U15 F) : **HAUTE** = visible/cassant en séance ; **MOYENNE** = gêne ou incohérence ; **BASSE** = cosmétique / conforme.

---

## TOP 5 — à corriger avant les retours de Laurent

| # | Trouvaille | Écran(s) | Gravité | Fix (1 ligne) |
|---|-----------|----------|---------|---------------|
| 1 | **Lag tactile** : le chrono re-render toute la séance chaque seconde (cause n°1 du "tactile répond mal") ✓ | SessionLive + SessionPreview | HAUTE | Isoler le chrono dans un sous-composant local (`<SessionTimer/>`) pour que le tick ne redessine que l'horloge. |
| 2 | **Circuit cassé en Live** : la consigne de bloc (`×N tours`, ordre) n'est jamais affichée ET les presets 40/20 ne lancent qu'un repos (pas de chrono travail ni de tours) ✓ | SessionLive | HAUTE | Afficher `cleanDisplayNote(block.notes)` dans la carte de bloc Live + faire que le tap preset enchaîne travail→repos ×`rounds`. |
| 3 | **Photos Pexels kitsch** en header de séance et post-séance, incohérentes avec la DA claire sobre ✓ | SessionPreview (HeroCard) + SessionSummary | HAUTE | Remplacer par un header sobre (bandeau accent bleu + icône cycle, comme les cartes cycle) ; `bannerImages.ts` devient supprimable. |
| 4 | **Chips repos trop petits sans `hitSlop`** (~26 px) alors que la version Live est déjà corrigée (minHeight 44 + hitSlop) ✓ | SessionPreview (TimerCard) | HAUTE | Porter le fix déjà présent en Live : `minHeight: 44` + `hitSlop` sur `restChip`. |
| 5 | **Aucun anti-double-tap sur la navigation** : double-tap = double push (écrans empilés) → "la navigation casse" ✓ | Home→génération, Preview→Live, SessionHub | MOYENNE→HAUTE | Garde `isNavigatingRef` (réarmée au focus) sur les CTA de navigation. |

> **Juste sous le TOP 5** (HAUTE mais bloquées/rares) : `injury_adaptation_explanation` strippé par le schéma → invisible (Axe 1, nécessite que le backend l'émette ET un ajout au schéma) ; `SessionErrorFallback` fait `navigate('Tabs')` → piège prisonnier si crash dans un écran transparentModal (Axe 4, chemin rare).

---

## AXE 1 — Affichage des séances (fidélité au contrat `fks.next_session.v2`)

### Chaîne de rendu (résumé)
1. **Validation Zod** : `screens/newSession/api.ts:210` `sessionV2Schema.safeParse(...)` contre `schemas/sessionSchema.ts`. ⚠️ **Tout champ absent du schéma est strippé** et n'atteint jamais le front.
2. **Casse** : `api.ts:224` `snakeToCamel(...)` (`utils/caseTransform.ts`) → `timer_presets→timerPresets`, `coaching_tips→coachingTips`, etc.
3. **Preview** : `screens/SessionPreviewScreen.tsx` (v2 brut) → `screens/sessionPreview/components/BlockCard.tsx` + helpers `sessionPreviewConfig.ts` (`cleanDisplayNote`, `formatItemMeta`, `getDisplayName`).
4. **Live** : `SessionPreviewScreen.tsx:309` `navigate('SessionLive', { v2 })` → `screens/SessionLiveScreen.tsx` **réimplémente** localement `formatItemMeta`/`cleanDisplayNote`/`getCoachTip` (copies) et **n'utilise pas** `blockConfig.ts`.
5. **Summary** : reçoit un objet `summary` **dérivé** (pas le v2) → ne voit que title/subtitle/durée/rpe/intensity/focus/srpe/**recoveryTips**.

### Trouvailles

| Champ enrichi | Écran | Constat (citation) | Gravité | Fix (1 ligne) |
|---|---|---|---|---|
| **note de bloc / circuit** (`block.notes`, ex. "Enchaîne 1→2→3, ×3 tours") | **SessionLive** | ✓ Jamais rendu : le `renderItem` (`SessionLiveScreen.tsx:836-992`) affiche titre + meta + items, **jamais `block.notes`**. Le joueur ne voit pas les tours en pleine séance. | **HAUTE** | Ajouter un `<Text>{cleanDisplayNote(block.notes)}</Text>` dans la carte de bloc Live. |
| **`display.timer_presets`** (work_s/rest_s/rounds, circuits 40/20) | **SessionLive** | ✓ Chips affichés (`:805-822`) mais au tap seul `preset.restS` est utilisé (`:811-816` → `startRest(rest)`). `work_s` et `rounds` ne lancent **aucun chrono travail ni décompte de tours** ; `rounds` n'existe que dans le label. | **HAUTE** | Faire démarrer un cycle travail→repos répété `rounds` fois au tap du preset. |
| **`injury_adaptation_explanation`** | tous | ✓ **Absent de `schemas/sessionSchema.ts`** → strippé au `safeParse`, jamais affiché. Un joueur en douleur ne voit jamais l'explication de l'adaptation faite pour lui (info de confiance clé pilote). | **HAUTE** | Ajouter le champ au schéma puis l'afficher (près de la section "Sécurité" en Preview). _Dépend du backend qui doit l'émettre._ |
| **`badges`** (`v2.badges`) | **SessionSummary** | Déclaré (`sessionSchema.ts:78`), normalisé, persisté, mais la card "Badges" du Summary affiche des pills **dérivées** (intensity/focus/durée/rpe), pas `v2.badges`. Les badges pensés par le moteur n'apparaissent jamais. | MOYENNE | Injecter `v2.badges` dans la card Badges (passer `badges` au `summary`). |
| **Finisher** ("Finisher — défi") | Preview + Live | ✓ Pas d'entrée `finisher` dans `components/session/blockConfig.ts` → `FALLBACK_CONFIG` (gris, "Bloc", icône ellipse) en Preview ; en Live aucun bloc n'a couleur/icône (blockConfig non branché). Le défi final est indistinct. | MOYENNE | Ajouter une entrée `finisher` (couleur vive + icône flamme/trophée) + brancher `getBlockConfig` en Live. |
| **holds "3×30s"** | Preview + Live | Pas de champ `hold` au contrat → arrive en `sets:3` + `work_s:30` → `formatItemMeta` rend `"3x · 30s"` (`sessionPreviewConfig.ts:158-174`). Lisible mais ambigu (le `s` travail ≠ repos). | BASSE | Cas `sets>1 && workS && !reps && !restS` → formater "N × Ms tenue". |
| **`item.description`** | Preview | Rendu en Live (`SessionLiveScreen.tsx:963-965`) mais **jamais en Preview** (BlockCard ne lit pas `description`). | BASSE | Afficher `description` dans BlockCard comme en Live. |
| **notes d'items longues** ("Descends en 3s… Effort 7/10") | Preview + Live | ✓ **Conforme** : rendues via `cleanDisplayNote(item.notes)` **sans `numberOfLines`** sur le style `itemNote` (preview `BlockCard.tsx:152`, live `SessionLiveScreen.tsx:970`) → wrap intégral, lisible. Le `numberOfLines={2}` ne porte que sur le **nom**. | BASSE | RAS. |
| **`coaching_tips`** (jusqu'à 5) | Preview + Live | ✓ **Tous affichés, aucun slice/troncature** (`SessionPreviewScreen.tsx:408-417`, `SessionLiveScreen.tsx:1043-1054`). Non transmis au Summary (acceptable, post-séance). | BASSE | RAS (option : passer au Summary). |
| **masquage `token:`** | Preview / Live | ✓ **Conforme** : `cleanDisplayNote` filtre toute ligne `token:` (`sessionPreviewConfig.ts:57-66` + copie Live). Aucun rendu de note brute trouvé. (En Live la note de bloc n'est de toute façon pas affichée — voir ligne 1.) | BASSE | RAS sur le filtre. |
| **`post_session.recovery_tips`** | Preview + Summary | ✓ **Conforme** : Preview section "Post-séance" (`:433-438`) + Summary section "Récupération" (`SessionSummaryScreen.tsx:262-274`). | BASSE | RAS. |
| **`analytics.rationale`** | tous | ✓ **Confirmé non affiché** (debug interne). Commentaire explicite `SessionPreviewScreen.tsx:345`. | BASSE | RAS — conforme. |
| **`selection_debug`** (`reasons`, `reset_variant_id`) | tous | ✓ Déclaré (`sessionSchema.ts:85-88`), interne, non affiché (à confirmer aucun rendu — aucun trouvé). | BASSE | RAS — laisser interne. |
| **`analytics.target_metrics.total_reps`** | tous | Déclaré (`sessionSchema.ts:91-93`), jamais rendu. | BASSE | RAS (ou afficher en récap volume si utile). |

### Champs backend ignorés / mal rendus (synthèse)
- **`block.notes` en Live** (consigne circuit) — invisible. **HAUTE**
- **`timer_presets` work_s/rounds** — non exploités (seul repos). **HAUTE**
- **`injury_adaptation_explanation`** — strippé au schéma, jamais affiché. **HAUTE**
- **`v2.badges`** — persisté mais jamais affiché (Summary affiche des dérivés). **MOYENNE**
- **Finisher** — pas de style dédié. **MOYENNE**
- **`item.description` en Preview** — non affiché. **BASSE**

---

## AXE 2 — Images / kitsch

### Inventaire `constants/bannerImages.ts` — **toutes des URLs Pexels distantes** (`{ uri }`), fallback couleurs sombres incohérentes avec le thème clair

| Clé | Écran qui l'affiche | Rendu |
|---|---|---|
| `force` / `engine` / `explosif` / `foundation` | **SessionPreview → HeroCard** (selon cycle) | `screens/sessionPreview/components/HeroCard.tsx:64` via `cycleToBannerKey` |
| `home` | Fallback HeroCard si cycle non matché | `bannerImages.ts:18` |
| `celebration` | **SessionSummary** (header post-séance) | `SessionSummaryScreen.tsx:183` |
| `empty` | **SessionHistory** (état vide, `<Image>` direct) | `SessionHistoryScreen.tsx:95` |
| `welcome` | **aucun** (WelcomeScreen n'importe plus rien) | code mort |
| `WELCOME_CAROUSEL` (export) | **aucun** | code mort (`bannerImages.ts:64-70`) |

Rendu via `components/ui/ImageBanner.tsx` : `<Image resizeMode="cover">` + `LinearGradient` sombre + tint noir `rgba(0,0,0,0.25)` + textes blancs → conçu pour photo sombre, **anti-DA claire**.

### Autres images
- **Légitimes** : `assets/icon.png`, `splash-icon.png`, `adaptive-icon.png`, `favicon.png` (config app) ; `{ uri }` YouTube dans `YouTubePlayer.tsx:99` (vidéo d'exo, pas déco).
- **Code mort sur disque** (aucun `require`/ref) : `assets/images/_originals/{hero-dark,hero-light,slide1-ball,slide2-sprint,slide3-tunnel}.jpg`, `assets/backgrounds/ChatGPT Image ….png`.

### Trouvailles

| Écran | Cause | Gravité | Fix (1 ligne) |
|---|---|---|---|
| **SessionPreview (HeroCard)** | Photo Pexels plein cadre (salle muscu / sprint…) + overlay sombre + texte blanc en header, vs DA claire (`HeroCard.tsx:63-85`) ✓ | **HAUTE** | REMPLACER par header sobre (bandeau accent bleu #2A4D8F + icône cycle, cohérent cartes cycle). |
| **SessionSummary** | Photo Pexels "célébration" sombre + kicker blanc en header post-séance (`SessionSummaryScreen.tsx:182-190`) | **HAUTE** | REMPLACER par header sobre (couleur succès/accent + icône check/trophée, fond clair). |
| **SessionHistory** | Photo Pexels "terrain vide" dans l'état vide (`SessionHistoryScreen.tsx:94-99`) | MOYENNE | REMPLACER par empty-state sobre (icône calendrier sur fond clair). |
| **bannerImages.ts + assets `_originals/` + `backgrounds/`** | Assets photo/carousel jamais affichés (code mort) | BASSE | SUPPRIMER (aucun impact UI). |

> **Note de portée** : si les 3 usages (HeroCard, Summary, History) passent en headers sobres, **tout `bannerImages.ts` + `ImageBanner.tsx` deviennent supprimables**. Les Pexels distantes ajoutent aussi un risque de latence/échec réseau révélant le fallback sombre.

---

## AXE 3 — Tactile / réactivité (plainte : "parfois le tactile ne répond pas bien")

Classé du plus probable au moins probable comme cause du ressenti.

### HAUTE — causes les plus probables

| Écran / composant | Cause (citation) | Gravité | Fix (1 ligne) |
|---|---|---|---|
| **SessionLive** | ✓ Chrono `setInterval` 1000 ms (`SessionLiveScreen.tsx:399-417`), `sessionSec` lu dans le rendu racine (`:751`) → **chaque seconde re-render tout l'arbre**, dont l'`Animated.FlatList` et son `renderItem` inline non mémoïsé (`:836-992`), pendant qu'on coche les séries. Suspect n°1. | **HAUTE** | Isoler le chrono dans `<SessionTimer/>` + mémoïser `renderItem`/extraire la BlockCard. |
| **SessionPreview** | ✓ Même schéma : `setInterval` 1000 ms (`SessionPreviewScreen.tsx:150-157`), `sessionSec` lu au même niveau que `blocks.map(...)` (`:372-386`) → **chaque seconde re-render toute la liste de BlockCard** + Hero + coaching. Taper une case pendant le timer = thread déjà occupé. | **HAUTE** | Déplacer l'état chrono dans `TimerCard` (state local). |
| **SessionPreview (TimerCard)** | ✓ Chips repos 30/60/90s : `paddingVertical: 5` (`TimerCard.tsx:117-124`) → ~26 px, **< 44 px et sans `hitSlop`**. La version Live a déjà `minHeight: 44` → incohérence. | **HAUTE** | `minHeight: 44` + `hitSlop` sur `restChip` (porter le fix Live). |
| **SessionPreview (BlockCard)** | Checkbox 22×22 px (`BlockCard.tsx:232-241`) sans `hitSlop` (le `TouchableOpacity` parent englobe le texte → large horizontalement, mais petit verticalement). La version Live met `hitSlop` partout (`SessionLiveScreen.tsx:902,938`). | MOYENNE→HAUTE | Ajouter `hitSlop` sur `itemMain` ou agrandir la checkbox à 28-32 px. |

### MOYENNE

| Écran / composant | Cause | Gravité | Fix (1 ligne) |
|---|---|---|---|
| **ModalContainer (swipe-to-dismiss)** | `Gesture.Pan()` (`components/modal/useSwipeToDismiss.ts:25-42`) sans `activeOffsetY`/`failOffsetX` → s'active au moindre mouvement vertical, en concurrence avec le scroll et les taps (SessionPreview, CycleModal). Ressenti "j'appuie, l'écran bouge au lieu de cliquer". | MOYENNE | `.activeOffsetY(15)` + `.failOffsetX([-20,20])`, ou composer avec `Gesture.Native()` du ScrollView. |
| **HomePrimaryCTA** | `Animated.loop` pulse permanent (`HomePrimaryCTA.tsx:27-37`, `useNativeDriver` OK) mais `TouchableOpacity` avec seulement `activeOpacity={0.9}`, **pas de scale/haptic** au press, alors que le `Button` partagé le fait. Le bouton n°1 a un feedback plus pauvre que les secondaires. | MOYENNE | Baser le CTA sur `<Button>` ou ajouter `onPressIn` haptic + scale. |
| **GenerationActions** | CTA "Générer" / "Jour OFF" / "Repos 2 jours" = `TouchableOpacity` **sans `activeOpacity`** (`screens/newSession/ui/GenerationActions.tsx:68,82,85`), incohérent avec `Button`. | MOYENNE | Passer en `<Button>` ou ajouter `activeOpacity`. |
| **EquipmentSelector** | Chips "équipement supplémentaire" sans `activeOpacity`, `paddingVertical: 8` (~32 px) sans `hitSlop` (`EquipmentSelector.tsx:313-322`). | MOYENNE | `activeOpacity` + `minHeight: 44`/`hitSlop`. |
| **HomeScreen (header)** | Bouton Déconnexion `paddingVertical: 6` (~24 px) sans `hitSlop` (`HomeScreen.tsx:354-357`) ; `handleLogout` non mémoïsé capturé dans `setOptions`. | MOYENNE | `hitSlop` + `useCallback(handleLogout)`. |

### BASSE
- **CycleModal** `closeButton` ~38 px sans `hitSlop` (`:646`) ; `testsCompactLink` `paddingVertical: 2` (~20 px) (`:748`). → ajouter `hitSlop`.
- **EnvironmentSelector** : cartes OK (`activeOpacity={0.85}`, pleine largeur) mais pas de haptic au toggle (doctrine `useHaptics()`). → option.
- **SessionLive** dots pagination 6×6 : non interactifs (juste indicateurs) → RAS.

### Points SAINS (à ne pas re-toucher)
- **Sélecteurs Zustand** : finement sélectionnés partout (`useLoadStore(s=>s.tsb)`, etc., `HomeScreen.tsx:129-143`, `NewSessionScreen.tsx:111-129`). **Pas la cause.**
- **FlatList Live** : `keyExtractor` + `getItemLayout` + `viewabilityConfig`/`onViewableItemsChanged` stables. Seul défaut = `renderItem` inline non mémoïsé (aggravé par le re-render chrono ci-dessus).
- **SessionPreview** bouton close : `minWidth/minHeight: 44` (`:481`) — bon exemple à répliquer.

---

## AXE 4 — Navigation / robustesse d'écrans (plainte : "la navigation et l'affichage peuvent encore casser")

### 1. Écrans `transparentModal` — piège `navigate` vers écran d'app
Les 4 modaux (`Feedback`, `ExternalLoad`, `SessionPreview`, `CycleModal`, `RootNavigator.tsx:184-215`) :
- **CycleModal / ExternalLoad / Feedback** : ✓ **SAINS** — sortie via `goBack()` ou `CommonActions.reset(...)` (`useFeedbackSave.ts:76-81`). Le commentaire de garde anti-régression CycleModal est en place. **Bug "prisonnier" NON réintroduit.**
- **SessionPreview** : `navigate('SessionLive'/'SessionSummary')` poussent des écrans **par-dessus** le modal (présentation card) → s'affichent correctement ; Summary sort via `reset` vers Tabs → le modal sous-jacent est détruit proprement. **Pas un bug**, mais ne JAMAIS y introduire un `navigate("Tabs")` direct.

| Écran | Scénario / cause | Gravité | Fix (1 ligne) |
|---|---|---|---|
| **SessionErrorFallback** | ✓ `handleGoHome` fait `navigation.navigate('Tabs', { screen: 'Home' })` (`components/SessionErrorFallback.tsx:24`). Si un crash React survient **dans SessionPreview** (transparentModal), ce fallback s'affiche dans la présentation modale → **Home rendu dans la fenêtre transparente = piège prisonnier**. Chemin rare (nécessite un crash). | MOYENNE | Remplacer par `CommonActions.reset({routes:[{name:'Tabs',params:{screen:'Home'}}]})` (cohérent avec SessionSummary). |

### 2. Double push / double-tap — **aucun anti-rebond dans l'app**

| Écran | Cause | Gravité | Fix (1 ligne) |
|---|---|---|---|
| **Button (global)** | `components/ui/Button.tsx:99-103` = `Pressable` sans debounce. Aucun CTA de nav n'est gardé. | MOYENNE (systémique) | Garde `useRef` "isNavigating" réarmée au focus, ou debounce dans `Button`. |
| **Home → génération** | `usePrimaryCta.ts:87-168` → `navigate("SessionLive"/"SessionPreview"/"NewSession")` sans garde. Chemin le plus à risque. | MOYENNE | Garde `isNavigatingRef` dans le hook. |
| **SessionHub** | `navigate(option.route)` (`SessionHubScreen.tsx:317`) sans garde → double `GenerateSession`/`History` empilés. | MOYENNE | Idem. |
| **SessionPreview → Live / Summary** | `onGoLive` (`:306-310`), `finishAction` (`:228-262`) sans garde. | MOYENNE | Garde `didFinishRef` / `isNavigatingRef`. |

### 3. `goBack()` sur stack vide
- ✓ **Pas de risque** : `canGoBack()` n'est utilisé qu'à `LoginScreen.tsx:142`, mais les modaux sont **toujours** poussés sur Tabs (route racine `RootNavigator.tsx:168`) → `goBack()` a toujours une cible. Pas de no-op/crash reproductible. (Ajouter `canGoBack()` sur les "close" = par prudence, pas un bug.)

### 4. États chargement / erreur de génération (Render cold start ~50 s) — **ROBUSTE**
- ✓ **Loading** : `LoadingOverlay` plein écran (`visible={generating}`, `NewSessionScreen.tsx:778-788`) + retour bloqué (`beforeRemove`) + header back masqué. **Pas d'écran blanc.**
- ✓ **Timeout** : `fetchV2` timeout 90 000 ms (`api.ts:188`, couvre les 50 s) + **retry auto 1×** sur `ETIMEDOUT` (`:189-196`).
- ✓ **Erreur réseau/serveur/timeout** : `classifyError` → **fallback auto** (`buildFallbackSession`, cardio+mobilité) + toast + navigation Preview (`NewSessionScreen.tsx:482-496`). **Pas de cul-de-sac.**
- Nuance : pas de `showErrorWithRetry` ici (choix cohérent : fallback auto). _Option : CTA "Réessayer" explicite après échec de validation._ — BASSE.

### 5. SafeArea / clavier

| Écran | Constat | Gravité | Fix (1 ligne) |
|---|---|---|---|
| **TestsScreen** | `SafeAreaView` OK mais **aucun `KeyboardAvoidingView`** (`TestsScreen.tsx:272-273`) ; formulaire avec `TextInput` (valeurs + notes) → le bouton submit peut être masqué par le clavier. | MOYENNE | Envelopper le ScrollView dans `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"`. |
| **FeedbackScreen** | ✓ SAIN : SafeArea + `KeyboardAvoidingView` (`:219-223`) + `keyboardShouldPersistTaps` + submit dans `bottomBar` hors ScrollView. | BASSE | RAS. |
| **SessionLive** | ✓ SAIN : `SafeAreaView edges=[top,right,left,bottom]` (`:708`), pas de `TextInput`. | BASSE | RAS. |

### 6. ErrorBoundary

| Écran | Constat | Gravité | Fix (1 ligne) |
|---|---|---|---|
| **App (global)** | ✓ `<ErrorBoundary>` global (`App.tsx:89`). | BASSE | RAS. |
| **SessionPreview / SessionLive** | ✓ Couverts par `withSessionErrorBoundary` (`SessionPreviewScreen.tsx:469`, `SessionLiveScreen.tsx:1102`). | BASSE | RAS. |
| **SessionSummary / Feedback** | ❌ **NON couverts** par `withSessionErrorBoundary` (`SessionSummaryScreen.tsx:36`, `FeedbackScreen.tsx:55` exportés sans HOC) → seulement le fallback générique global. | MOYENNE | Envelopper les deux avec `withSessionErrorBoundary`. |

### Scénarios de casse reproductibles (synthèse)
1. **Double-tap** sur un CTA de nav (Home/Hub/Preview) → 2 écrans empilés, l'utilisateur doit faire 2× retour. **MOYENNE, systémique.**
2. **Crash React dans SessionPreview** → `SessionErrorFallback` `navigate("Tabs")` rend Home dans la fenêtre modale (prisonnier). **MOYENNE, rare.**
3. **Crash dans Summary/Feedback** → pas de fallback séance contextuel (générique seulement). **MOYENNE.**
4. **Clavier sur TestsScreen** → bouton submit masqué sur petit écran. **MOYENNE.**

### Points SAINS
transparentModal (aucun `navigate`-vers-Tabs restant, bug CycleModal non réintroduit) ; loading/timeout/erreur de génération (overlay + retry 90 s + fallback auto, pas d'écran blanc) ; `goBack()` (modaux jamais en racine) ; SafeArea/clavier de Feedback & SessionLive ; ErrorBoundary global.

---

## Notes transverses
- **Duplication Live ↔ Preview** : `formatItemMeta`, `cleanDisplayNote`, `getCoachTip` sont copiés dans `SessionLiveScreen.tsx` au lieu de réutiliser `sessionPreviewConfig.ts`/`blockConfig.ts` → source d'incohérences (ex. note de bloc affichée en Preview, pas en Live ; chips Live corrigés, Preview non). Une consolidation réduirait les écarts de rendu.
- **`blockConfig.ts` non branché en Live** : aucune carte de bloc Live n'a couleur/icône → impacte aussi le finisher (Axe 1) et la lisibilité générale.
- **Dépendance backend** : `injury_adaptation_explanation` (Axe 1) et l'exploitation correcte des holds supposent une coordination avec le moteur — à inscrire au prochain point contrat.

_Fin de l'audit — lecture seule, aucune modification appliquée._
