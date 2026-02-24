# FKS - App de Preparation Physique Football

## Vision
Application mobile de preparation physique personnalisee pour footballeurs, pilotee par IA.

## ✅ Mises a jour recentes (resume)
- **Zero ballon** : aucune seance ne doit inclure medball/swiss/fitball/football.
- **Materiel** : ne plus proposer ces equipements cote app (meme si envoyes, le backend les filtre).
- **Cycles** : blocs “football/medball” retires (coherence avec l’objectif prepa physique).
- **Auth flow pro** :
  - Welcome dirige maintenant vers la bonne entree (`Register` ou `Login`) selon le CTA choisi.
  - Ecrans `Login/Register/Onboarding/Welcome` passes en style premium dark coherent (sans dependance image externe).
  - Stack auth simplifiee (`headerShown: false`) pour garder une UI maitrisee.
- **Inscription/connexion plus fiables** :
  - Boutons submit desactives tant que les champs ne sont pas valides.
  - Messages Firebase mappes en messages clairs FR (invalid credential, email deja pris, weak password, reseau, too many requests).
- **Dates & timezone** :
  - Normalisation progressive vers `toDateKey` pour eviter les decalages jour local/UTC.
  - Corrections de tri/date label sur profils/historiques/coaching.
- **Coach robustness** :
  - Hook coach (`useCoachPlayersData`) durci : lecture `getDocs`, normalisation des jours, guards anti-setState apres unmount.
  - Composants calendrier/analytics relies aux day keys normalisees.
- **Settings fiabilises** :
  - Toggles notifications/rappels proteges par gestion d’erreur + rollback UI en cas d’echec.
- **Tests terrain** :
  - Chargement historique assaini (normalisation entree, tri, limite), affichage timestamp plus robuste.
- **Pipeline Force 2-agents** :
  - Backend genere via Agent A (prescription blocs) + Agent B (coaching textuel).
  - Champs enrichis : `session_theme`, `coaching_tips[]`, `post_session.recovery_tips[]`.
  - Labels blocs Force affines par token (`FORCE_TOKEN_LABEL` dans `blockConfig.ts`) : Force/Renfo/Prevention/Appuis/Core.
  - `recovery_tips` affiches dans SessionPreviewScreen (post-seance) et SessionSummaryScreen.
- **Notifications push locales** :
  - `expo-notifications` integre, service dans `services/notifications.ts`.
  - Rappels seance, streak, veille de match, recap hebdo.
  - Toggles dans Settings avec rollback UI.
- **ProgressScreen repense** :
  - Hero football-friendly (plus de jargon ATL/CTL/TSB cote joueur).
  - Systeme de milestones (6 accomplissements avec lock/unlock).
  - Comparaison tests terrain avant/apres.
- **Backend dev local** :
  - `config/backend.ts` pointe automatiquement vers l'IP du Mac (via `hostUri`) en dev, port 4000.
  - Retry automatique sur timeout (cold start Render) dans `api.ts`.

## Architecture Technique

### Backend
- **Langage** : Node.js (Express)
- **Base de donnees** : Firestore
- **Coeur metier** : Generation de seances d'entrainement via systeme de tokens/formats/cycles
- **IA** : OpenAI (generation de seances + assistant chat)

### Frontend
- **Framework** : React Native (Expo SDK 54, React 19, RN 0.81)
- **State Management** : Zustand 5 (avec persistance AsyncStorage)
- **Auth & Sync** : Firebase Auth + watchers Firestore temps reel
- **Navigation** : React Navigation 7 (native-stack + bottom-tabs)
- **Animations** : react-native-reanimated 4 (modals, gestures) + Animated RN (entrees, micro-animations)
- **Gestures** : react-native-gesture-handler 2.28
- **Haptics** : expo-haptics
- **Charts** : react-native-svg (sparklines TSB faites a la main)
- **Notifications** : expo-notifications (rappels locaux planifies)
- **Monitoring** : Sentry (sentry-expo) + Amplitude analytics
- **Validation** : Zod 4

## Concepts Cles Metier

### Systeme de Generation (Backend)
- **Token** = type d'exercice (accel, force, core, run, recovery, etc.)
- **Format** = template de structure (A, B, C) pour la variete
- **Cycle/Playlist** = programme de 12 seances (Fondation, Force, Endurance, Technique & Vitesse)
- **Archetype** = seance type dans un cycle
- **Whitelist** = liste d'exercices autorises par token/format pour eviter les exos hors scope

### Generation de Seance (Flow)
1. Context envoye par le front (profil, ATL/CTL/TSB, contraintes, temps dispo, materiel, douleurs)
2. Backend choisit un archetype dans le cycle actif
3. Genere un plan de blocs (tokens)
4. Pour chaque token, choisit format + pioche exercices dans exercise bank
5. Applique filtres (materiel/douleurs) + garde-fous (duree, volume)
6. Retourne JSON fks.next_session.v2

### Pipeline 2-Agents (Force)
- **Agent A** (prescription) : genere blocs + exercices + sets/reps/tempos
- **Agent B** (coaching) : enrichit avec `coaching_tips[]`, `post_session.recovery_tips[]`, `session_theme`
- Chaque bloc porte un `token:xxx` dans ses notes (ex: `token:strength_force_lower_main`)
- Le front mappe les tokens vers des labels affines via `FORCE_TOKEN_LABEL` dans `blockConfig.ts`

## Contraintes Globales (2026-02)
- **Zero ballon** : aucun exercice impliquant medball/swiss/fitball/football.
- **UI materiel** : ne pas proposer ces equipements cote app (meme si envoyes, le backend les filtre).
- **Preset salle** : `gym_full` n’inclut plus `medball`.

### Metriques de Charge
- **ATL** (Acute Training Load) = charge aigue
- **CTL** (Chronic Training Load) = charge chronique
- **TSB** (Training Stress Balance) = equilibre forme/fatigue
- Calcul via EMA (Exponential Moving Average) dans `engine/loadModel.ts`

### Cycles Disponibles (avec lieux recommandes)
- **Fondation** : Maison / Terrain / Salle - base physique generale
- **Force** : Maison (light) / Salle (ideal) - renfo bas/haut
- **Endurance / Engine** : Maison (cardio leger) / Terrain / Salle - aerobie, tempo, intervalles
- **Explosivite (vitesse & technique)** : Terrain (ideal) / Salle - vitesse, appuis
- **Explosif (puissance)** : Terrain / Salle (ideal) - sprint + power + plyo
- **RSA (Repeated Sprint Ability)** : Terrain (ideal) / Salle - repeter les sprints
- **Saison / Maintien** : Partout - rester frais sans fatigue
- **Off-Season / Transition** : Partout - recup active, maintien leger

## Structure du Projet

```
/
  App.tsx                    # Point d'entree, NavigationContainer + ToastHost
  package.json

  /config
    backend.ts               # URL backend
    devFlags.ts              # Feature flags dev (bypass feedback, etc.)
    firebaseConfig.ts        # Config Firebase
    trainingDefaults.ts      # Constantes ATL0, CTL0, poids externes

  /constants
    theme.ts                 # Design system (couleurs, radius, spacing)
    feedback.ts              # Limites RPE/fatigue/douleur
    warmups.ts               # Templates echauffements

  /domain
    microcycles.ts           # Definition des cycles (id, label, icon, locations, highlights)
    recommendMicrocycle.ts   # Algorithme de recommandation de cycle
    types.ts                 # Types metier (SessionFeedback, InjuryRecord, Modality, etc.)

  /engine
    loadModel.ts             # Calcul ATL/CTL/TSB (updateTrainingLoad)
    dailyAggregation.ts      # Agregation charges par jour
    exerciseBank.ts          # Banque d'exercices principale
    exerciseInstructions.ts  # Consignes textuelles par exercice
    exerciseVideos.ts        # Refs videos par exercice

  /state
    trainingStore.ts         # Store Zustand principal (sessions, charges, ATL/CTL/TSB, Firestore sync)
    settingsStore.ts         # Preferences utilisateur (theme, haptics, weekStart, weeklyGoal)
    appModeStore.ts          # Mode coach/joueur

  /services
    firebase.ts              # Instance auth + db
    aiContext.ts              # Construction du contexte IA envoye au backend
    notifications.ts         # Push notifications locales (rappels, streak, match)
    analytics.ts             # Amplitude tracking
    monitoring.ts            # Sentry init

  /navigation
    RootNavigator.tsx        # Auth flow + App flow + modals (transparentModal)

  /screens
    HomeScreen.tsx            # Dashboard principal (StatusBar + Hero + CTA + Carousel)
    LoginScreen.tsx           # Connexion (shake + toast sur erreur)
    RegisterScreen.tsx        # Inscription (fade in + slide up + shake)
    ProfileSetupScreen.tsx    # Setup profil multi-etapes
    CycleModalScreen.tsx      # Selection/gestion cycle (modal)
    FeedbackScreen.tsx        # Feedback post-seance (modal, readiness score)
    ExternalLoadScreen.tsx    # Ajout charge externe (modal)
    SessionPreviewScreen.tsx  # Preview seance avant lancement (modal)
    SessionLiveScreen.tsx     # Seance en cours (timer, blocs)
    SessionSummaryScreen.tsx  # Resume post-seance
    SessionHistoryScreen.tsx  # Historique (stagger animation)
    VideoLibraryScreen.tsx    # Catalogue exercices + videos
    ChatScreen.tsx            # Assistant IA
    NewSessionScreen.tsx      # Generation de seance
    ProgressScreen.tsx        # Milestones, hero football-friendly, comparaison tests
    TestsScreen.tsx           # Tests terrain
    SettingsScreen.tsx        # Parametres
    WelcomeScreen.tsx         # Ecran d'accueil premium (CTA -> Login ou Register)
    LegalNoticeScreen.tsx     # Mentions legales
    PrivacyPolicyScreen.tsx   # Politique de confidentialite
    /newSession               # Sous-modules generation (api, orchestrator, transform, UI)

  /components
    /home
      HomeStatusBar.tsx       # Bande compacte : phase + TSB + alerte match
      HomeReadinessHero.tsx   # Card large readiness + sparkline TSB (SVG)
      HomePrimaryCTA.tsx      # Bouton action principale contextuel (pulse animation)
      HomeCarousel.tsx        # FlatList horizontale + pagination dots
      HomeCarouselCard.tsx    # Template card pour carousel
      HomeTestsNudge.tsx      # Nudge tests terrain
      HomeCycleHero.tsx       # (legacy) Hero cycle
      HomeDashboardCard.tsx   # (legacy) Dashboard metriques
      HomeReadinessCard.tsx   # (legacy) Card readiness ancienne version
      HomeNextSessionCard.tsx # (legacy) Card prochaine seance
      HomeWeekSummaryCard.tsx # (legacy) Resume semaine

    /modal
      ModalContainer.tsx      # Wrapper modal universel (blur + slide + handle)
      useModalAnimation.ts    # Hook animation entree/sortie (slide/fade/right)
      useSwipeToDismiss.ts    # Hook gesture swipe-to-dismiss

    /session
      blockConfig.ts          # Config blocs (couleurs, icones, labels Force par token)

    /ui
      Button.tsx              # Bouton avec press animation (scale + darken + haptic)
      Card.tsx                # Card generique (variants: surface, soft)
      Badge.tsx               # Badge/pill
      SectionHeader.tsx       # Header de section
      ScreenContainer.tsx     # Wrapper ecran avec SafeArea + scroll
      ToastHost.tsx           # Systeme de toast global (slide from top)
      LoadingOverlay.tsx      # Overlay de chargement

  /hooks
    useHaptics.ts             # Hook haptics centralise (respecte reduceMotion + settings)
    useNetworkStatus.ts       # Statut reseau + queue count
    /home
      useLoadSeries.ts        # Calcul serie TSB 7 jours (warmup 21j)
      useMatchSoon.ts         # Detection match < 48h
      useWeekDays.ts          # Jours de la semaine avec statuts (FKS, club, match, etc.)
      useWeekSummary.ts       # Resume semaine (fksCount, extCount, message)
      useActivityStreak.ts    # Streak d'activite consecutive
      usePrimaryCta.ts        # Logique CTA intelligent (repos/generer/commencer/feedback)
      useHomeCarouselItems.tsx # Construction items carousel

  /utils
    dateHelpers.ts            # Helpers partages (toDateKey, isSameDay, frToKey)
    toast.ts                  # Bus de toast (showToast/onToast via DeviceEventEmitter)
    animations.ts             # Animations utilitaires (shake, fadeIn, scale, slideUp)
    errorHandler.ts           # Gestion erreurs (classify, showError, showErrorWithRetry, safeFetch)
    legalContent.ts           # Textes mentions legales / politique confidentialite
    offlineQueue.ts           # Queue hors-ligne pour actions en attente
    virtualClock.ts           # Horloge virtuelle (mode dev)
```

## Parcours Utilisateur (Frontend)

### Onboarding
Welcome -> Login/Register -> Setup profil (poste, niveau, pied fort, objectif, charge club/match, materiel, code club) -> Choix mode (joueur/coach) -> Onboarding slides

### Mode Joueur
- **Home** : StatusBar (phase + TSB + match) -> ReadinessHero (ATL/CTL/TSB + sparkline) -> CTA intelligent -> Carousel (semaine, tests, progression)
- **Cycles** : 1 seul cycle actif, choix/gestion via modal, recommandation basee sur objectif + tests
- **Generation** : choix environnement + materiel -> backend genere -> preview -> live -> feedback (RPE, fatigue, douleur)
- **Tests terrain** : batterie de tests par playlist, conseilles avant demarrage cycle
- **Bibliotheque** : catalogue exercices + videos validees + alternatives + favoris
- **Chat** : assistant IA contextuel (rate limit 10 msg/jour, 500 chars max)

### Mode Coach
Dashboard coach : liste joueurs, details joueur (profil + seances)

## Systeme de Modals

Tous les ecrans modals utilisent `ModalContainer` (composant wrapper universel) :
- **Presentation** : `transparentModal` + `animation: "fade"` dans le navigator
- **Backdrop** : BlurView (expo-blur) avec tap-to-dismiss
- **Animation** : slide from bottom (300ms in / 250ms out) via reanimated
- **Gesture** : swipe-to-dismiss (threshold 150px ou velocity > 1200)
- **Style** : rounded corners 20px + handle bar + shadow

Ecrans concernes : FeedbackScreen, CycleModalScreen, ExternalLoadScreen, SessionPreviewScreen

## Systeme d'Animations

### Micro-animations (Phase 3)
- **Button** : scale down 0.96 au press + overlay darken + haptic impactLight
- **Erreurs** : shake animation (3 secousses) sur formulaires login/register
- **Entrees** : stagger fade+slideUp sur HomeScreen (hero, CTA, carousel) et SessionHistory
- **CTA** : pulse subtil (scale 1 -> 1.015) en boucle quand actif
- **Toast** : slide from top + fade, auto-dismiss apres 2.2s

### Haptics
Hook `useHaptics()` centralise :
- Respecte le setting utilisateur (`hapticsEnabled`)
- Respecte `reduceMotion` (accessibilite)
- Pas de haptics sur web
- API : `impactLight()`, `impactMedium()`, `impactHeavy()`, `success()`, `warning()`, `error()`

## Points Techniques Importants

### Garde-fous Backend
- Caps duree selon match/club/deload
- Fallback vers seances "safe" si contraintes trop strictes
- Anti-repetition (systeme de memoire)
- Post-traitements validation (structure, volume, equipement)

### Contraintes Generation
- **Obligatoire** : respecter materiel disponible + douleurs/blessures
- **Cycle actif** : obligatoire pour generer
- **Feedback** : doit etre rempli apres seance (bloque prochaine generation hors mode dev)
- **12 seances** : fin de cycle -> prompt choix nouveau cycle

### Gestion d'erreurs
- `ErrorBoundary` global dans App.tsx
- `withSessionErrorBoundary` HOC pour les ecrans session
- `showErrorWithRetry` pour erreurs avec action de retry
- `classifyError` pour distinguer reseau / auth / autre
- Queue offline (`offlineQueue.ts`) pour feedback en mode hors-ligne

### Navigation
- Auth flow : Welcome -> Login/Register (route initiale dynamique selon CTA welcome)
- Profile setup obligatoire avant acces app
- Onboarding affiche une seule fois (AsyncStorage flag)
- Mode coach/joueur choisi au premier lancement
- Modals en `transparentModal` pour le blur/swipe custom

## Regles a TOUJOURS Respecter

1. **Jamais de generation sans cycle actif**
2. **Filtres materiel/douleurs = priorite absolue**
3. **12 seances = cycle complet**
4. **Feedback obligatoire apres seance** (met a jour charge + avance cycle)
5. **Un seul cycle actif a la fois**
6. **Format JSON fks.next_session.v2 pour les seances**
7. **Toast (pas Alert.alert) pour les notifications utilisateur simples**
8. **Haptics via useHaptics() uniquement** (jamais d'appel direct expo-haptics)
9. **Helpers partages dans utils/** (pas de duplication de toDateKey, isSameDay, frToKey)
10. **Hooks metier du Home dans hooks/home/** (garder HomeScreen leger)

## Note pour Claude
Je ne suis pas developpeur, j'ai cree cette app avec GPT. Quand tu m'expliques du code, utilise un francais simple et des analogies foot si possible.
