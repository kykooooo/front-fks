# FKS - App de Preparation Physique Football

## Vision
Application mobile de preparation physique personnalisee pour footballeurs, pilotee par IA.

## Mises a jour recentes (avril 2026)

### Session pre-beta test (latest)

**Bugs bloquants corriges** :
- **Theme dark mode** : champ `bg` restaure dans `constants/theme.ts` (light `#f7f5f1`, dark `#070707`) — les ecrans ne rendent plus du blanc en dark mode
- **Chat modal TestFlight** : wrap `<Modal>` natif autour de `ModalContainer` dans ChatScreen (fix invisibilite sur release build new arch Fabric). Le meme pattern est a reutiliser si d'autres modales inline dans des tabs ne s'affichent pas en release.
- **Nom exercice SessionLive** : fontSize 18 au lieu de 15px (lisible en sueur)
- **Warning Nordic debutants** : integre dans SessionLive en plus de Preview (via helper `utils/beginnerSafety.ts`)
- **Toast post-feedback football-friendly** : remplace le jargon "ATL 24 CTL 22 TSB 0" par `"Seance 4/12 validee 🟢 — Cycle Force · Tu es en forme. Pret a performer."`

**UX amplifications** :
- **`HomeProgressHero`** : nouvelle card pleine largeur en haut du Home, affiche 3 chiffres de tests avec delta colore (+0.12s vert, -0.5cm orange) et badge 🏆 PR si record personnel (calcule via `utils/testProgress.ts`)
- **`BaselineTestsWelcomeModal`** : modale 1ere ouverture du Home si `0 tests` + flag `baselineTestsPromptSeen` non vu (hook `utils/useBaselinePromptSeen.ts`)
- **`CyclePrompt`** : nouveau CTA primary "Mesurer mes progres" a fin de cycle 12/12 (ferme la boucle tests ↔ cycles)
- **`SafetyBanner`** : composant reutilisable (variantes full + compact) integre sur SessionPreview (full) et SessionLive (compact). Inclut boutons **SAMU 15** et **Urgences 112** cliquables via `Linking.openURL("tel:15")`.
- **Carte "Pourquoi cette seance"** (💡) sur SessionPreview : affiche `v2.analytics.rationale` du backend au-dessus des coaching tips (transparence IA)
- **Setup generation memorise** : `lastGenerationSetup` ajoute a `state/settingsStore.ts` (persist AsyncStorage) — evite au joueur de re-selectionner environment+equipment a chaque generation

**Securite & legal** :
- Mentions legales completes dans `utils/legalContent.ts` : section "Avertissement medical" + section "Utilisateurs mineurs" (obligation legale + protection)
- `SafetyBanner` permanente + numeros urgence cliquables = signal de serieux cote parent / coach

**Notifications** :
- Nouvelle pref `retestReminder` dans `services/notifications.ts`
- `scheduleRetestReminder(cycleLabel, daysDelay=30)` : programme une notif locale 30j apres chaque fin de cycle, appelee depuis `useFeedbackSave.ts` quand `shouldPromptCycleEnd` passe a true
- Message type : *"Mesure tes progres 🏆 — Ça fait 30 jours que t'as termine ton cycle Force. C'est le moment de retester ton 30m, ton CMJ ou ton Yo-Yo — tu vas voir tes gains."*

**Performance** :
- **Compression 5 images hero/slide** : **10.95 MB → 658 KB (-94%)**. Originaux sauvegardes dans `assets/images/_originals/` (gitignore).
- Script reutilisable `scripts/compress-hero-images.mjs` (sharp + mozjpeg, max 1200px width, quality 82)
- DevDep `sharp` ajoute

**Nouveaux fichiers** :
- `utils/beginnerSafety.ts` (warning exos risques pour debutants en debut de cycle)
- `utils/testProgress.ts` (helper `computeTopProgress` + `formatDelta` + `isPersonalRecord`)
- `utils/useBaselinePromptSeen.ts` (hook flag AsyncStorage par uid)
- `components/home/HomeProgressHero.tsx`
- `components/home/BaselineTestsWelcomeModal.tsx`
- `components/ui/SafetyBanner.tsx`
- `scripts/compress-hero-images.mjs`

**Deploiements** :
- 3 OTA updates TestFlight (channel `testflight`) — les users en TestFlight recoivent les updates au prochain cold start, pas de rebuild natif necessaire
- Backend : commits `098cc13` + `56cf563` + `dfe8465` pushes sur `main` → Render auto-deploy

**Score pre-beta test** : 9.8/10. App prete pour test avec vrais joueurs.

### Systeme ATL/CTL/TSB
- **Tau dynamiques** par niveau joueur : Loisir (7/21), Competition (10/28), Haut niveau (14/35)
- **Progression visible** : playerRationale TSB-aware sur le SessionPreview (le joueur voit pourquoi sa seance est adaptee)
- **Adaptation labels** affichees dans le HeroCard (etat du jour, poste, phase)
- **Format circuit lisible** : "4 tours · 40s effort · 20s repos" au lieu de "4x · 1 reps · 40s/20s"

### Cycles (9 cycles, tous a 12 sessions)
- **Phase progression** : cycle_progress (session_number, phase, phase_label) injecte dans les 10 agents (5 Agent A + 5 Agent B)
- **Few-shots phase-aware** dans tous les agents (base vs pic vs deload)
- **Force** : 3→6 archetypes (+ unilateral_power, push_pull_complex, field_power)
- **Engine** : 3→7 archetypes (+ fartlek_terrain, circuit_cardio, intervals_progressifs, mixte_force_cardio)
- **Explosivite** : 4→6 archetypes (+ cod_agility, deceleration)
- **Explosif** : 3→5 archetypes (+ contrast PAP, reactif), 15→12 sessions
- **Hybrid** : 15→12 sessions, easy-subs ajoutes
- **Offseason** : +2 archetypes fun (defi_circuit, sport_cross)
- **RSA** : shuttle_solo remplace SSG pour joueurs solo
- **Saison** : 2 archetypes hard ajoutes + tous themes renommes
- **Foundation** : tous themes renommes en langage football
- **Tous les cycles en mode strict** (playlist target respectee)
- **Themes engageants** sur tous les cycles (plus de jargon technique)

### Qualite prepa physique (Agent A)
- **RPE gradue** obligatoire : 8 main lift → 6 accessoire → 5 core (plus de "RPE 7" partout)
- **Tempos obligatoires** sur force et prehab : "Tempo 3-1-X", "Tempo 4-0-1" (Nordic)
- **Notes techniques** obligatoires sur chaque exercice
- **Warm-up sets** mentionnes sur les main lifts

### Langage joueur (Agent B)
- **Notes traduites** : "Descends en 3s, effort 7/10" au lieu de "Tempo 3-1-X RPE 7"
- **Football context concret** : "La puissance de tes demarrages sur les 5 premiers metres"
- **Coaching tips motivants** : images de match, pas de jargon
- **Venue-aware** : terrain/home/gym adapte le ton et les references

### Routines pre-faites
- **6 categories** par moment : Avant l'effort, Apres l'effort, Jour de match, Mobilite, Prevention, Circuits
- **25 routines** avec exercices structures (sets/reps/repos/tempo/notes)
- **Impact TSB** : les circuits comptent dans la charge (via applyExternalLoad)
- **Noms francais** : plus de jargon anglais (Fente laterale, Gainage lateral, etc.)

### Exercices
- **18 exercices bodyweight** ajoutes (squat saute, fente sautee, pistol squat, pike push-up, mountain climbers, etc.)
- **2 exercices circuit** bodyweight (circuit_home_cardio, circuit_tabata_bodyweight)
- **3 exercices mobilite** dynamique (inchworm, spiderman walk, scorpion stretch)

### Inscription simplifiee
- **3 etapes** au lieu de 5 (Profil → Planning → Materiel)
- **Niveaux simplifies** : "Loisir / Competition / Haut niveau" (3 au lieu de 5)
- **Cycle reporte** apres inscription (le joueur decouvre d'abord l'app)
- **Materiel non-bloquant** : le joueur sans materiel peut finir l'inscription
- **Social login** : Apple Sign-In + Google Sign-In ajoutes

### Backend
- **Modele IA** : GPT-5.4 mini (plus rapide, moins cher, meme qualite que 5.2)
- **PHASE_LABELS** config pour progression cycle
- **Venue** passe a Agent B pour coaching adapte
- **Engine circuit** : token circuit_foundation_c supporte dans le pipeline
- **explosif_contrast** autorise sous moderate cap

### UX / Technique
- **SafeArea** corrigee sur tous les ecrans (Dynamic Island + barre Home iPhone)
- **Notifications** : streak reminder + match eve conditionnel ajoutes
- **Mode hors-ligne** : message clair ("Pas de connexion — seance de secours preparee")
- **Chat IA** : 25 msg/jour (etait 10), 800 chars (etait 500), cooldown 1.5s (etait 2.5s)
- **Hero image** : position absolute pour remplir le container sur HomeScreen

## Architecture Technique

### Backend
- **Langage** : Node.js (Express)
- **Base de donnees** : Firestore
- **Coeur metier** : Generation de seances via pipeline 2-agents (Agent A prescription + Agent B coaching)
- **IA** : OpenAI GPT-5.4 mini (generation seances + assistant chat)
- **Deploiement** : Render (auto-deploy depuis main)

### Frontend
- **Framework** : React Native (Expo SDK 54, React 19, RN 0.81)
- **State Management** : Zustand 5 (slices: load, sessions, external, feedback, debug, sync)
- **Auth** : Firebase Auth (email + Apple Sign-In + Google Sign-In) + watchers Firestore temps reel
- **Navigation** : React Navigation 7 (native-stack + bottom-tabs)
- **Animations** : react-native-reanimated 4 (modals, gestures) + Animated RN (entrees, micro-animations)
- **Gestures** : react-native-gesture-handler 2.28
- **Haptics** : expo-haptics
- **Charts** : react-native-svg (sparklines TSB)
- **Notifications** : expo-notifications (rappels locaux planifies)
- **Social Auth** : expo-apple-authentication + @react-native-google-signin/google-signin
- **Monitoring** : Sentry (desactive SDK 54 new arch) + Amplitude analytics
- **Validation** : Zod 4
- **Build** : EAS Build (TestFlight iOS + APK Android)

## Concepts Cles Metier

### Systeme de Charge (EWMA Banister)
- **ATL** = charge aigue (fatigue) — tau dynamique par niveau (7/10/14 jours)
- **CTL** = charge chronique (fitness) — tau dynamique (21/28/35 jours)
- **TSB** = CTL - ATL (positif = frais, negatif = fatigue)
- **6 labels joueur** : Crame / Cuit / Charge / En forme / Frais / Rouille
- **5 tiers d'intensite backend** : easy / easy_plus / moderate_light / moderate / hard

### Cycles (9 cycles, 12 sessions chacun)
- **Fondation** : base physique generale — 7+ archetypes
- **Force** : 6 archetypes (squat, hinge, unilateral, push/pull, field power, upper duel)
- **Engine** : 7 archetypes (Z2, tempo, intervals, fartlek, circuit, progressifs, mixte)
- **Explosivite** : 6 archetypes (accel, plyo, vmax/COD, agilite, deceleration)
- **Explosif** : 5 archetypes (sprint neuro, force lower, plyo power, contrast PAP, reactif)
- **RSA** : 8 archetypes (sprints, COD, mixed, shuttle solo, circuit, SSG, recovery)
- **Hybrid** : 5 archetypes (contrast, speed-power, maxV, upper-speed, full complex)
- **Saison** : 12 archetypes uniques (maintien en cours de saison)
- **Offseason** : 7 archetypes (recovery, fun, maintenance, mobilite, defi, cross-training)

### Pipeline 2-Agents
- **Agent A** (prescription) : exercices + sets/reps/repos/tempo + RPE gradue + notes techniques
- **Agent B** (coaching) : titres + notes en langage joueur + football_context + coaching_tips + recovery_tips
- **Phase progression** : base(1-4) → build(5-8) → pic(9-11) → deload(12) transmise aux 2 agents
- **Venue-aware** : terrain/home/gym adapte le ton d'Agent B

### Routines Pre-faites
- 25 routines hardcodees en 6 categories (Avant/Apres effort, Jour match, Mobilite, Prevention, Circuits)
- Exercices structures (RoutineBlock[] avec RoutineExercise[])
- Impact TSB selectif (circuits = oui, mobilite/prevention = non)

## Structure du Projet

```
/
  App.tsx                    # Point d'entree + Google Sign-In init
  GoogleService-Info.plist   # Config Firebase iOS (Google Sign-In)

  /config
    backend.ts               # URL backend
    devFlags.ts              # Feature flags dev
    firebaseConfig.ts        # Config Firebase web
    trainingDefaults.ts      # Seeds ATL/CTL, TAU_BY_LEVEL, getTauForLevel(), PHASE_LABELS

  /services
    firebase.ts              # Instance auth + db
    socialAuth.ts            # Apple Sign-In + Google Sign-In
    aiContext.ts              # Contexte IA envoye au backend
    notifications.ts         # Push notifications locales (session, streak, match eve, weekly)
    analytics.ts             # Amplitude tracking

  /state/stores
    useLoadStore.ts          # ATL/CTL/TSB + tau dynamiques
    useSessionsStore.ts      # Sessions + playerLevel + microcycle
    useExternalStore.ts      # Charges externes + completedRoutines
    useSyncStore.ts          # Firestore watchers + distribution playerLevel

  /state/orchestrators
    rebuildLoad.ts           # Recalcul complet ATL/CTL/TSB avec tau dynamiques
    applyFeedback.ts         # Feedback post-seance → mise a jour charge
    applyExternalLoad.ts     # Charge externe (club/match/routine circuit)

  /screens
    WelcomeScreen.tsx         # 3 slides + CTA Register/Login
    LoginScreen.tsx           # Email + Apple + Google Sign-In
    RegisterScreen.tsx        # Email + Apple + Google Sign-In
    ProfileSetupScreen.tsx    # 3 etapes (Profil, Planning, Materiel)
    HomeScreen.tsx            # Hero image + StatusBar + ReadinessHero + CTA
    SessionPreviewScreen.tsx  # Preview avec playerRationale + adaptationLabels
    SessionLiveScreen.tsx     # Timer + auto-rest + bip/vibration
    ChatScreen.tsx            # Assistant IA (25 msg/jour, 800 chars)
    /prebuilt                 # Routines pre-faites (25 routines, 6 categories)
```

## Parcours Utilisateur

### Inscription (3 etapes, ~2 min)
Welcome → Register (email OU Apple OU Google) → Profil (poste, niveau, pied fort) → Planning (objectif, sessions, club, matchs) → Materiel (salle, terrain, maison) → Home

### Mode Joueur
- **Home** : Hero image + StatusBar (etat + phase) + ReadinessHero (TSB sparkline) + CTA intelligent
- **Cycles** : choix via modal apres 1ere generation (pas a l'inscription)
- **Generation** : environnement → materiel → backend genere (Agent A + B) → preview → live → feedback
- **Routines** : 25 routines par moment (avant/apres effort, match day, mobilite, prevention, circuits)
- **Chat** : 25 messages/jour, 800 chars max, contexte joueur integre

## Regles a TOUJOURS Respecter

1. **SafeArea** sur TOUS les ecrans : `edges={["top", "right", "left", "bottom"]}` (Dynamic Island + barre Home)
2. **Jamais de generation sans cycle actif**
3. **Filtres materiel/douleurs = priorite absolue**
4. **12 seances = cycle complet** (tous les cycles sont a 12)
5. **Feedback obligatoire apres seance** (met a jour charge + avance cycle)
6. **Toast (pas Alert.alert)** pour les notifications utilisateur
7. **Haptics via useHaptics()** uniquement (jamais d'appel direct expo-haptics)
8. **Helpers partages dans utils/** (toDateKey, isSameDay, frToKey)
9. **Hooks metier du Home dans hooks/home/** (garder HomeScreen leger)
10. **Notes exercices en langage joueur** (effort /10, pas "RPE X" brut)
11. **Tempos traduits en mots** ("descends en 3s" pas "Tempo 3-1-X")
12. **Niveaux** : "Loisir / Competition / Haut niveau" (3 labels, mappees aux tau)
13. **Social login** : Apple (iOS natif) + Google (natif via plugin)

## Skills custom Claude Code (avril 2026)

Sept skills dans `.claude/skills/` automatisent les tâches récurrentes. Déclenchement automatique sur mots-clés (pas besoin de taper le slash command).

| Skill | Portée | Quand |
|---|---|---|
| `/sync-check` | fullstack read-only | Avant tout déploiement. Scanne les 5 points de couplage front/back : schéma session v2, banque exos (272), `BACKEND_EXERCISE_IDS`, contexte `aiContext.ts`, cycles/archetypes. |
| `/ajouter-champ-seance` | fullstack | Nouveau champ dans la réponse `fks.next_session.v2`. Couvre Zod back + Zod front + type TS camelCase + consommation UI. Évite le drop silencieux côté front. |
| `/ajouter-exercice` | fullstack | Nouvel exercice dans la banque (9 fichiers : banque back + miroir front + `BACKEND_EXERCISE_IDS` + vidéo + instructions + bénéfices + token pool). |
| `/debug-generation` | fullstack | Génération bizarre/dégradée. Checklist 5 points : guardrails, payload, diff schémas, cache AsyncStorage, top 3 hypothèses (flag 2-agent, ghost ID, Zod silencieux). |
| `/deployer` | fullstack (analyse) | Avant un push prod. Détecte OTA vs rebuild natif EAS (changements `app.json` / deps natives / `ios` / `android`) et génère les commandes. N'exécute rien. |
| `/verif-release` | frontend | Scan git diff contre la checklist conventions : SafeArea 4 edges, dark+light theme, touch targets 44px, Toast pas Alert, `useHaptics()`, hooks Home dans `hooks/home/`, niveaux 3 labels. |
| `/traiter-feedback-joueur` | fullstack | Retour brut testeur/TestFlight. Paraphrase + identifie back/front/both + classe (bug critique/mineur/feature) + fichier concerné + complexité. |

L'autre repo `C:/Users/Gamer/fks/` (backend) a aussi ses propres skills (dont `/ajouter-archetype` backend-only avec validation croisée anti-ghost-ID).

## Note pour Claude
Je ne suis pas developpeur, j'ai cree cette app avec GPT et Claude. Quand tu m'expliques du code, utilise un francais simple et des analogies foot si possible.
