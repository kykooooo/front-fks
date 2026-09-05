# Audit du parcours d'inscription FKS — phase 0 (lecture seule)

**Date** : 2026-09-05
**Base auditée** : `origin/main` = `11b88e8` (branche de travail `audit/inscription`)
**Backend consulté en lecture** : `C:\Users\Gamer\fks-worktrees\readiness3`
**Méthode** : lecture du code écran par écran, exécution des suites de tests du périmètre (20 suites, 785 tests, tout vert — voir annexe A), mesure des contrastes WCAG (annexe B), inventaire des événements analytics (annexe C). Aucune ligne de code modifiée, aucune écriture Firestore/Auth réelle.

> Lecture rapide pour Kyllian : le résumé ci-dessous tient en une page. Le reste est la preuve, ligne par ligne, pour celui qui codera les correctifs.

---

## Résumé exécutif

**La grande surprise** : la demande du 01/09 (« un truc direct pour dire qu'on est coach ») **est déjà sur main depuis le 03/08** (merge `b50539a`, commit `06bf890`). L'écran d'accueil porte un lien « Je suis coach » (`screens/WelcomeScreen.tsx:233-242`) qui fait sauter tout le questionnaire joueur et pose le coach directement sur la création de club (`navigation/RootNavigator.tsx:716`). Deux explications possibles au fait que Kyllian ne l'ait pas vu : (1) son téléphone tournait encore début septembre sur un build antérieur au 18/08 (constat de la recette maison du 01/09) ; (2) le lien est volontairement discret (caption grise sous les deux CTA). **Avant tout nouveau chantier, il faut que Kyllian vérifie sur son téléphone à jour** : si l'entrée coach actuelle lui convient, le lot B ci-dessous rétrécit à trois correctifs.

Ce qui reste vrai dans sa remarque : le parcours coach a **trois trous** (l'intention coach vit uniquement en mémoire et meurt si l'app est fermée ; la création de club n'est pas atomique ; un coach qui « s'entraîne aussi » atterrit dans l'app joueur avec un profil vide sans jamais voir le questionnaire) et l'inscription joueur a **un défaut qui compte pour le pilote** : le code club est vérifié après tout le reste, et son refus s'affiche 2,2 secondes puis disparaît — le joueur croit avoir rejoint, le coach ne le voit jamais.

**Les 5 pires trouvailles**

| # | P | Trouvaille | Preuve |
|---|---|---|---|
| 1 | **P0** | Code club refusé = un toast de 2,2 s puis le Home. Aucune trace ensuite. Le joueur est invisible du coach sans le savoir. La reprise est enterrée dans Profil → Paramètres → Club, alors que le message dit « depuis Profil ». | `screens/ProfileSetupScreen.tsx:516-524`, `components/ui/ToastHost.tsx:43`, `screens/profileSetup/attachClub.ts:42-43`, `screens/SettingsScreen.tsx:416-417` |
| 2 | **P1** | Le funnel analytics est **totalement aveugle** : la clé Amplitude est vide dans tous les builds (`app.json` → `""`, `app.config.js` ne lit aucune variable d'environnement), donc les 8 événements d'inscription posés en juillet ne partent nulle part. | `app.json:40`, `app.config.js:42`, `services/analytics.ts:8,14` |
| 3 | **P1** | L'intention « Je suis coach » n'existe qu'en mémoire : app fermée entre l'inscription et la création du club (ou reconnexion sur un autre téléphone) → le coach retombe sur les 4 étapes du questionnaire joueur, seule sortie = un lien tout en bas de l'étape 1. | `navigation/RootNavigator.tsx:425,716`, `screens/ProfileSetupScreen.tsx:701-709` |
| 4 | **P1** | `createClubAsCoach` = 3 écritures séquentielles sans transaction. Si la 3ᵉ échoue ou si les 15 s expirent : club orphelin créé, coach renvoyé au questionnaire joueur, et chaque nouvel appui crée un **autre** club. | `repositories/clubsRepo.ts:46-63,95-111,191-205`, `screens/CoachOnboardingScreen.tsx:108` |
| 5 | **P1** | Un coach qui active « Je m'entraîne aussi » bascule dans l'app joueur avec `profileCompleted: true` (posé par la création de club) mais **aucun** poste, niveau, catégorie, objectif. Le questionnaire n'est jamais proposé ; la génération part avec un profil vide. Le commentaire du navigateur suppose le contraire. | `repositories/clubsRepo.ts:195-205` (`:201`), `navigation/RootNavigator.tsx:475-481,700,764`, `components/coach/CoachSelfPlayerCard.tsx:107-128` |

**Comptage aujourd'hui (session ininterrompue, sans erreur)**

| Profil | Écrans | Taps (hors clavier) | Saisies clavier | Temps estimé |
|---|---|---|---|---|
| Joueur sans code club | 6 (Welcome, Register, 4 étapes) | 15 à 22 | 2 (email, mdp) + prénom | ≈ 2 min 00 – 2 min 45 |
| Joueur avec code club | 6 | 15 à 22 | 3 (+ code 10 caractères) | ≈ 2 min 15 – 3 min 00 |
| Coach via « Je suis coach » | 3 + 1 alerte | 6 à 8 | 3 (email, mdp, nom du club) | ≈ 1 min 30 – 2 min 00 |
| Coach qui rate le lien | 7 (Register + étape 1 défilée + création) | +1 | idem | +30 s et de la confusion |

**Option coach recommandée (§3)** : garder l'entrée Welcome existante et la **rendre robuste** — (a) persister l'intention coach en local (AsyncStorage, effacée à la consommation), (b) rendre la création de club atomique côté client (`writeBatch`) ou serveur, (c) ne plus poser `profileCompleted: true` pour un coach mais un état dédié, avec un questionnaire joueur déclenché à la bascule « Je m'entraîne aussi ». Pas de second bouton primaire sur Welcome, pas d'étape « rôle » dans le setup (options B/C écartées, raisons en §3).

**Le lot coach est-il front-only ?** Les correctifs (a) et (b-client) sont front-only. Le (c) touche la **sémantique** de `users/{uid}.profileCompleted` que les rules laissent écrire librement (liste blanche `firestore.rules:323-341`) : front-only aussi, **sauf** si on ajoute un champ nouveau (ex. `playerProfileCompleted`) → il faut alors l'ajouter à `userMutableFields()` dans les rules et au test `firestore-tests/rules.userDocument.test.ts` → revue sécurité obligatoire (petite, mais obligatoire). Le « rejoindre un staff existant » n'existe pas côté serveur (aucun chemin client vers `accessRole: "coach"`, documenté `docs/coach-pilote-2026-07/MATRICE_DROITS_COACH.md:240`) : ce serait une Cloud Function nouvelle = hors lot, revue sécurité complète.

---

## 0. Ce que la mémoire du projet croyait, et ce qui est vrai sur main

| Croyance (brief) | Réalité vérifiée sur `11b88e8` |
|---|---|
| « Point d'entrée coach = un lien dans ProfileSetup step 0 » | **Périmé.** Il y a DEUX entrées : le lien « Je suis coach » sur Welcome (`WelcomeScreen.tsx:233-242`, mergé 03/08) qui arrive directement sur `CoachOnboarding` (`RootNavigator.tsx:716`), ET l'ancien lien en bas de l'étape 1 du setup, conservé (`ProfileSetupScreen.tsx:701-709`). |
| « Onboarding slides (une fois, clé AsyncStorage) après le setup » | **Il n'y a plus d'écran de slides après le setup.** Les 3 slides SONT le Welcome (`WelcomeScreen.tsx:27-46`). Après « Terminer », c'est le Home directement (`RootNavigator.tsx:764`). La clé `fks_welcome_done` ne sert qu'à choisir Welcome vs Login au prochain démarrage (`RootNavigator.tsx:650`). CLAUDE.md est à corriger sur ce point. |
| « Routing par `role` lu dans le snapshot profil » | **Périmé.** `users/{uid}.role` n'est plus lu ; l'espace est dérivé de l'appartenance `clubs/{clubId}/members/{uid}.accessRole` (`RootNavigator.tsx:427-442`, `domain/appSpace.ts:110-168`), et `role` est un champ **gelé** côté rules (`firestore.rules:372-380`). |
| « DA Polish direction A actée, à vérifier si mergée » | **Mergée** le 03/08 (`da9f929`, commits `2bec805`…`268c881`). Les 6 échecs de contraste sont corrigés (`b1701e2`) : le CTA est passé de `#F2741B` (2,88:1) à `cta #C85014` (4,55:1). Restent 2 échecs légers en clair et 3 en sombre (annexe B). |
| « `STORAGE_KEYS.ONBOARDING_DONE` mort, vraie clé en dur ×2 » | **Corrigé.** Une seule clé `WELCOME_DONE: "fks_welcome_done"` (`constants/storage.ts:12`), aucune littérale ailleurs (grep). |
| « Placeholder code club FKSFC-2026 ≠ format généré » | **Corrigé.** Placeholder `Ex: ABCDE-FGHJK` (`ProfileSetupScreen.tsx:626`) = 10 caractères en 2 groupes de 5 (`functions/src/inviteCodes.ts:84,318-324`). |
| « Matériel sorti du setup » | **Fait.** 4 étapes (`ProfileSetupScreen.tsx:74`), aucune grille matériel. |
| « Accord parental U13/U15 » | **Fait pour U15** (U13 n'est plus sélectionnable, `domain/types.ts:50-52`) : case bloquante + preuve persistée (`ProfileSetupScreen.tsx:331-334,475-477`, `domain/parentalConsent.ts:41-50`). |
| « Funnel aveugle entre login_success et session_generate_start » | **Les événements existent** (`register_success`, `profile_step_completed`, `club_code_checked`, `profile_completed`, `cycle_reco_shown`, `first_session_generated` — annexe C) **mais ne partent nulle part** (clé Amplitude vide, voir P1-01). Pire qu'avant : on croit mesurer. |
| « Prénom requis au Register » (design 12/07 §4.2) | **Pas fait.** Prénom facultatif au Register (`RegisterScreen.tsx:66`), puis obligatoire à l'étape 1 (`ProfileSetupScreen.tsx:325`) — demandé deux fois (friction F4 du design toujours vraie). |
| « Étape Club dédiée à validation immédiate » (design §4.3) | **Pas fait.** Le code reste un champ optionnel de l'étape 1, vérifié après l'enregistrement du profil (`attachClub.ts:49-85`). Ce qui a été fait : le profil n'est plus perdu si le code est refusé (test `screens/profileSetup/__tests__/attachClub.test.ts`). |
| « Écran Ton programme est prêt » (design §5) | **Pas fait.** Fin du setup = toast « Profil enregistré — Configuration terminée ! » + Home (`ProfileSetupScreen.tsx:534`). Le cycle est auto-assigné en silence (`ProfileSetupScreen.tsx:418-420,479-489`). |
| « Save incrémental par étape » (design lot 3) | **Pas fait.** Tout l'état du questionnaire est en `useState` (`ProfileSetupScreen.tsx:157-199`) ; rien n'est écrit avant « Terminer ». |

---

## 1. Cartographie du parcours réel sur main

### 1.1 Schéma du flux (qui décide, sur quel état)

```
[boot] App.tsx hydrate settings → setThemeMode → require(RootNavigator)   (App.tsx:88-93)
   │
   ▼
RootNavigator (navigation/RootNavigator.tsx)
   ├─ welcomeDone === null ─────────────► Splash « Chargement… »                 (:625)
   ├─ initializing (auth ou profil) ────► Splash « Chargement de ton profil… »   (:637-646)
   ├─ !user ───────────────────────────► AuthNavigator                           (:647-660)
   │      initialRouteName = welcomeDone ? "Login" : "Welcome"                   (:650)
   │      Welcome ──reset──► Register | Login  (+ intentionCoach en mémoire)     (:335-341, :653)
   │      Register/Login créent/ouvrent la session Firebase → onAuthStateChanged  (:519-541)
   │
   ├─ appSpace.decision === "en-attente" ► Splash « Chargement de ton espace… » (:673)
   ├─ autorité coach indéterminée ──────► CoachAccessUnconfirmedScreen           (:688-690)
   ├─ appSpace.space === "coach" ───────► CoachNavigator (3 onglets)              (:694-696)
   ├─ profileCompleted === false ───────► Portillon « nav-gate »                  (:700-758)
   │      initialRouteName = intentionCoach ? "CoachOnboarding" : "ProfileSetupGate"  (:716)
   │      ProfileSetupGate = ProfileSetupScreen (4 étapes) ──Terminer──► setProfileCompleted(true)
   │      CoachOnboarding = création de club ──► appSpace bascule "coach" tout seul
   └─ sinon ────────────────────────────► AppNavigator (Home / Séance / Profil)   (:764)
```

**États qui pilotent** :
- `welcomeDone` (AsyncStorage `fks_welcome_done`, posé par les 3 CTA de Welcome — `WelcomeScreen.tsx:106,112,127`).
- `user` (Firebase Auth).
- `profileCompleted` (Firestore `users/{uid}.profileCompleted`, écouté en temps réel — `RootNavigator.tsx:577-612`).
- `clubId` (Firestore `users/{uid}.clubId` → où regarder) puis `appSpace` dérivé de `clubs/{clubId}/members/{uid}` (`hooks/useAppSpace.ts`, `domain/appSpace.ts:150-168`).
- `intentionCoach` : **mémoire React uniquement** (`RootNavigator.tsx:425`), posée par Welcome, consommée une fois (`:501-509`), oubliée à la déconnexion (`:531`).

### 1.2 Écran par écran

**Welcome** (`screens/WelcomeScreen.tsx`) — 3 slides icône + texte (`:27-46`), dots tappables, lien « Passer » (`:159-171`). Bloc bas : CTA « Commencer » → Register (`:212-220`), lien « J'ai déjà un compte » → Login (`:221-229`), lien caption « Je suis coach » → Register **avec** `intentionCoach: true` (`:233-242`, `:125-129`). Les trois posent `WELCOME_DONE` avant même qu'un compte existe. Aucune lecture Firestore. `<Screen>` respecté (`:150`).

**Login** (`screens/LoginScreen.tsx`) — 2 champs (email trim + regex `:61-63`, mdp non vide), bouton désactivé tant qu'invalide ou en cours (`:210`), « Mot de passe oublié » (`:98-126`), lien vers Register. Mapping FR : `invalid-email`, `user-not-found`/`wrong-password`/`invalid-credential`, `too-many-requests`, `network-request-failed`, défaut (`:35-50`). Événements `login_success` / `login_failed` (`:82,85`). Aucune écriture.

**Register** (`screens/RegisterScreen.tsx`) — 3 champs : prénom **facultatif** (`:184-193`), email, mdp ≥ 6 (`:66`), case consentement obligatoire avec liens Politique/Mentions ouvrables avant compte (`:263-289`), jauge de force par longueur (`:149-151`). Séquence : `createUserWithEmailAndPassword` → `register_success` → chrono `ONBOARDING_START_TS` → `updateProfile(displayName)` si prénom → `setDoc(users/{uid}, {email, displayName, firstName, profileCompleted:false, createdAt, updatedAt}, merge)` (`:95-120`). Si le compte est créé mais le doc échoue : toast « Compte créé — petit souci réseau », l'utilisateur reste connecté et le setup rattrape (`:126-135`). Mapping FR : `invalid-email`, `email-already-in-use`, `weak-password`, `network-request-failed`, `too-many-requests`, défaut (`:35-50`). Bouton désactivé tant qu'invalide (`:294`).

**ProfileSetupScreen** (`screens/ProfileSetupScreen.tsx`, 1 437 lignes, `TOTAL_STEPS = 4` `:74`) — même composant en onboarding (via `ProfileSetupGate`, prop `onProfileCompleted`) et en édition depuis Profil (`isEditMode` `:147`). Barre de progression pondérée 15/8/5/3 (`:82`). Préremplissage one-shot depuis Firestore + `displayName` Auth (`:212-267`). « Changer de compte » = signOut (`:387-396`). Retour matériel Android = étape précédente (`:375-385`). Le bouton « Suivant » n'est **pas** désactivé quand l'étape est invalide : la validation se fait au tap avec toast + shake (`:322-358`), sauf la case parentale qui désactive (`:895-897,996`).

| Étape | Champs (valeur persistée) | Validation | Écrit où |
|---|---|---|---|
| **1 Identité** (`:613-711`) | Prénom (texte, `firstName`) · Code club (texte, **non persisté**, envoyé au serveur) · Poste `Gardien/Defenseur/Milieu/Attaquant` (`:94`) · Catégorie `U15/U17/U18/Senior` (`domain/types.ts:34,50`) · **Accord parental si U15** (`parentalConsent`) · Niveau `Amateur/Regional/National/Semi-pro/Pro` (`:95`) · Pied `Pied droit/Pied gauche/Ambidextre` (`:96`) · lien « Tu fais partie du staff ? » (`:701-709`) | prénom, poste, catégorie sélectionnable, case parentale si U15, niveau, pied (`:324-337`) | rien avant « Terminer » |
| **2 Objectif** (`:713-768`) | Carte cycle « Aucun cycle actif » + lien « Choisir » → CycleModal (`:716-742`) · Objectif (4 valeurs `:97-102`, `mainObjective`) · Séances FKS/sem `1-4` (`targetFksSessionsPerWeek`) · Reprise facultative (`selfReportedGapDays` 0/21/60/120 ou null `:111-116`) | objectif, séances (`:338-341`) | rien |
| **3 Club** (`:770-806`) | Entraînements club oui/non (`hasClubTrainings`) · jours club (`clubTrainingDays`) · jours de match (`matchDays`, `matchDay` = premier) ; `clubTrainingsPerWeek`/`matchesPerWeek` dérivés des jours (`:408-409`) | oui/non ; jours si oui (`:342-349`) | rien |
| **4 Salle** (`:808-881`) | Accès salle `regular/occasional/none` (`hasGymAccess` `:465`) · Gêne actuelle facultative (zone + gravité) → écrite dans **Mon corps** local, jamais dans le profil (`:421-429`) | accès salle (`:350-354`) | « Terminer » |

**« Terminer »** (`:399-563`) : écrit en local la gêne éventuelle, puis `saveProfileThenAttachClub` sous garde 15 s (`:448-495`) : (1) `setDoc(users/{uid}, {...profil, profileCompleted:true, cycle auto-assigné si aucun actif, updatedAt}, merge)` (`:450-491`) — tous les champs sont dans la liste blanche des rules (`firestore.rules:323-341`) ; (2) si un code a été saisi, callable `joinClubWithInviteCode` (`services/clubInvites.ts:84-108`). Toasts : « Profil enregistré, club non rejoint » / « Tu as rejoint {club} » / « Configuration terminée ! » (`:516-534`). Puis `onProfileCompleted()` → Home.

**CoachOnboardingScreen** (`screens/CoachOnboardingScreen.tsx`) — 2 champs (nom du club ≥ 2 caractères, nom du coach facultatif, `:43-47,201-221`), bouton « Créer mon club » → `Alert.alert` de confirmation (`:90-98`) → `createClubAsCoach` sous garde 15 s (`:108-112`). Sortie : « Retour » si une pile existe derrière, sinon « Je suis joueur finalement » fourni par le portillon (`:51-56`, `RootNavigator.tsx:734-742`) ; « Se déconnecter » (`:176-186`). `ScreenContainer` → `<Screen>` (`components/ui/ScreenContainer.tsx:29`), règle d'or respectée. Écrit : `clubs/{id}` (`clubsRepo.ts:46-63`), `clubs/{id}/members/{uid}` `accessRole:"owner"` (`:95-111`), `users/{uid}` `{uid, clubId, firstName?, profileCompleted:true, updatedAt}` (`:195-205`). Toast « Club créé ! Génère ton code d'invitation depuis l'onglet Semaine » (`:117-121`) — vrai (`screens/coach/CoachWeekScreen.tsx:1458-1475`, onglet `navigation/CoachTabs.tsx:157`).

**Arrivée Home joueur** — `HomeVNextContainer` (« écran normal dès le jour 1 », `screens/homeVNext/HomeVNextContainer.tsx:20`), avec la progression qui dit « Termine ta première séance. » (`screens/homeVNext/progressionViewModel.ts:1364`). Aucune promesse « ton programme est prêt » n'est faite, donc aucune promesse trahie — mais aucun moment fort non plus.

**Arrivée coach** — `CoachTabs` : Aujourd'hui / Effectif / Semaine (`CoachTabs.tsx:138-157`).

### 1.3 Comptage détaillé

**Joueur sans code club** : Welcome 1 tap · Register 2 saisies obligatoires (+ prénom facultatif) + 1 case + 1 tap · Splash · É1 : prénom (0 si saisi au Register) + 4 choix + 1 tap = 5 (+1 case si U15) · É2 : 2 choix + 1 tap = 3 · É3 : 1 choix + 0-3 jours + 0-1 jour de match + 1 tap = 2 à 6 · É4 : 1 choix + 0-3 (gêne) + 1 tap = 2 à 5. **Total : 6 écrans, 15 à 22 taps, 2 à 3 saisies clavier.** Temps : Welcome 5 s, Register 45-60 s, É1 30-40 s (16 lignes de choix à faire défiler), É2 15 s, É3 15-25 s, É4 10-20 s, enregistrement 1-3 s → **≈ 2 min 00 – 2 min 45**. L'étape 1 concentre à elle seule ~50 % de l'effort (le code le dit : `STEP_DENSITY_WEIGHTS = [15, 8, 5, 3]`, `ProfileSetupScreen.tsx:82`).

**Joueur avec code club** : + 10 caractères au clavier à l'É1 (≈ 15-20 s) → **≈ 2 min 15 – 3 min 00**. Si le code est refusé : + le temps de comprendre, et le chemin Profil → Paramètres → Club (3 écrans).

**Coach par « Je suis coach »** : Welcome 1 tap · Register (idem joueur) · Splash · CoachOnboarding : nom du club au clavier + 1 tap + 1 tap sur l'alerte · Splash espace · Aujourd'hui. **3 écrans + 1 alerte, 6 à 8 taps, 3 saisies.** Puis Semaine → « Générer un code » (1 tap). **≈ 1 min 30 – 2 min 00.**

**Coach qui ne voit pas le lien** (tape « Commencer ») : Register → É1 → doit faire défiler prénom, code club, encart de divulgation, 4 postes, 4 catégories, 5 niveaux, 3 pieds pour trouver « Tu fais partie du staff ? » tout en bas (`:701-709`). Le lien fonctionne sans remplir l'étape (c'est un `navigate`, pas un `goNext`). **+1 écran, +1 long défilement, et le sentiment décrit par Kyllian.**

---

## 2. Bugs et incohérences

Classement : **P0** = bloque ou trompe un joueur/coach réel ; **P1** = dégrade nettement ; **P2** = finition. Chaque ligne a son scénario et sa preuve. Ce qui n'a pas pu être prouvé est en §5.

### 2.1 P0

**P0-01 — Code club refusé : le joueur ne le saura pas, le coach ne le verra jamais.**
*Scénario* : joueuse sur le parking, le coach lui dicte le code, elle se trompe d'une lettre (l'alphabet exclut I, L, O, 0, 1 — `functions/src/inviteCodes.ts:81` — mais elle ne le sait pas). Elle remplit les 4 étapes, tape « Terminer ». Le profil s'enregistre, le serveur refuse le code, un toast orange « Profil enregistré, club non rejoint » s'affiche **2 200 ms** (`ToastHost.tsx:43`, aucune `durationMs` passée en `ProfileSetupScreen.tsx:520-524`) pendant que l'écran bascule vers le Home. Elle range son téléphone. Rien, sur le Home ni sur le Profil, ne dit « pas de club ». Le coach ouvre Effectif : elle n'y est pas.
*Aggravants* : le message de repli dit « Tu pourras réessayer depuis Profil » (`attachClub.ts:42-43`) et l'aide du champ dit « depuis ton profil » (`ProfileSetupScreen.tsx:637`), mais l'écran Profil n'a aucune section club (`screens/ProfileScreen.tsx` : seuls « Paramètres » et « Historique », `:792-800`) ; la carte « Rejoindre un club » vit dans Paramètres (`SettingsScreen.tsx:416-417`, `ClubManagementCard.tsx:254`). L'événement `club_code_checked {valid:false}` qui devait mesurer ce taux ne part pas (P1-01).
*Preuve du chemin* : `ProfileSetupScreen.tsx:448-524`, `attachClub.ts:49-85`, `clubInvites.ts:84-108`.
*Ce que le design du 12/07 prévoyait* : étape Club dédiée, validation immédiate (§4.3) — non implémentée.

### 2.2 P1

**P1-01 — Analytics : la clé Amplitude est vide dans tous les builds.**
`app.json:40` → `"AMPLITUDE_API_KEY": ""` ; `app.config.js:42` → `AMPLITUDE_API_KEY: extra.AMPLITUDE_API_KEY ?? ""` (contrairement à `SENTRY_DSN` juste au-dessus, aucune lecture de variable d'environnement, `:41`) ; `services/analytics.ts:8` → `initAnalytics` sort si la clé est vide ; `:14` → `trackEvent` ne fait rien. Grep repo entier : aucune autre source (`eas.json` muet). **Conséquence** : les 14 événements du parcours (annexe C) sont du code mort en production. Le critère de done du design (« le funnel Amplitude le prouve ») est inatteignable tel quel. *Pas un bug utilisateur, mais un bug business : on ne peut pas dire combien de joueurs abandonnent, ni où.*

**P1-02 — L'intention coach meurt si l'app est fermée.**
`intentionCoach` est un `useState` (`RootNavigator.tsx:425`), remis à zéro à la déconnexion (`:531`) et après consommation (`:501-509`). *Scénario* : le coach tape « Je suis coach », crée son compte, arrive sur « Espace coach », va chercher le nom exact de son équipe dans ses messages, l'app est tuée par iOS (ou il la ferme). Relance → `welcomeDone` vrai → pas de Welcome → session Firebase restaurée → `profileCompleted:false` → portillon avec `initialRouteName = "ProfileSetupGate"` (`:716`) → **questionnaire joueur, étape 1 « Dis-nous qui tu es », Poste, Catégorie…** Sa seule porte : le lien en bas de l'étape (`ProfileSetupScreen.tsx:701-709`), ou « Changer de compte ». Même chose s'il se connecte sur un second téléphone avant d'avoir créé le club. C'est très exactement « se taper toute l'inscription ».

**P1-03 — Création de club non atomique : club orphelin + coach perdu.**
`createClubAsCoach` (`clubsRepo.ts:186-205`) enchaîne `setDoc(clubs/{id})` (`:51-60`), `setDoc(clubs/{id}/members/{uid})` (`:101-110`), `setDoc(users/{uid})` (`:195-205`) — trois allers-retours, aucun `writeBatch`. L'appel est sous `withTimeout(…, 15000)` (`CoachOnboardingScreen.tsx:108`). *Scénario* : 4G médiocre, la 3ᵉ écriture n'a pas répondu à 15 s → toast « Impossible de créer le club pour le moment… Ta saisie est conservée — réessaie » (`:126-133`). Pendant ce temps le club et l'appartenance **existent**. Le coach retape « Créer mon club » → `doc(collection(db,"clubs"))` génère un **nouvel** id (`clubsRepo.ts:50`) → second club. Si la 3ᵉ écriture n'atterrit jamais : `users/{uid}.clubId` reste null → `useAppSpace` ne lit aucune appartenance → espace joueur (`domain/appSpace.ts:110-117`) → `profileCompleted:false` → questionnaire joueur, intention déjà consommée. Le club existe, le coach ne le retrouvera pas.

**P1-04 — Coach qui « s'entraîne aussi » : app joueur avec un profil vide, questionnaire jamais proposé.**
`createClubAsCoach` pose `profileCompleted: true` (`clubsRepo.ts:201`) sans aucun champ joueur. Quand le coach active « Je m'entraîne aussi » (`CoachSelfPlayerCard.tsx:107-128` → callable `enrollSelfAsClubPlayer`), les deux espaces s'ouvrent et il peut basculer en joueur (`domain/appSpace.ts:150-168`). Le navigateur voit `profileCompleted === true` → `AppNavigator` (`RootNavigator.tsx:764`) : Home, Séance, génération — avec `position`, `level`, `ageCategory`, `mainObjective` **absents**. Aucune garde « profil incomplet » nulle part (grep `profileCompleted` dans `screens/newSession`, `screens/homeVNext`, `hooks/home` : zéro). Le backend accepte des valeurs nulles et dérive un niveau par défaut (`readiness3/src/agents/audiencePromptFragments.ts:50-60`) — donc une séance sort, dosée sans catégorie d'âge. Le commentaire du navigateur (`RootNavigator.tsx:475-481`) décrit ce cas comme « profil joueur pas rempli → portillon remonté » : **faux**, le portillon ne remonte pas puisque `profileCompleted` est vrai. Le coach peut corriger via Profil → carte de stats → `ProfileSetup` en édition (`ProfileScreen.tsx:481`), s'il y pense.

**P1-05 — Toutes les réponses du setup sont perdues si l'app est fermée avant « Terminer ».**
État 100 % en mémoire (`ProfileSetupScreen.tsx:157-199`), écriture unique à la fin (`:450-491`). Préremplissage au retour = prénom seulement pour un compte neuf (`:212-267`). *Scénario* : appel téléphonique à l'étape 3, iOS purge l'app → retour à l'étape 1 vide. Le design (lot 3, « save incrémental par étape ») le prévoyait.

**P1-06 — Il n'existe aucun chemin pour un second coach (adjoint).**
Un adjoint qui tape « Je suis coach » ne peut que **créer un autre club**. Aucun écran ni callable n'attribue `accessRole: "coach"` (grep `functions/src` : seules `createClub`/`transferClubOwnership` touchent l'autorité ; documenté ouvert dans `docs/coach-pilote-2026-07/MATRICE_DROITS_COACH.md:240`). Le texte de Welcome « Je suis coach, créer mon club » (`WelcomeScreen.tsx:238`) est honnête, mais pour un staff à deux personnes le produit n'a pas de réponse. *Pas un bug : un manque à nommer dans la proposition (§3).*

### 2.3 P2

| # | Trouvaille | Preuve |
|---|---|---|
| P2-01 | Prénom demandé deux fois : facultatif au Register, obligatoire à l'É1 (design : requis au Register). Le bouton Register s'appelle « Suivant » alors qu'il crée le compte (label a11y « Créer mon compte »). | `RegisterScreen.tsx:66,184-193,292,300`, `ProfileSetupScreen.tsx:325` |
| P2-02 | `autoComplete="name"` sur le champ Prénom du Register → iOS propose le **nom complet** du contact (« Kyllian Le Bris ») dans un champ Prénom ; cette valeur devient `firstName` et s'affiche au coach dans l'effectif. `given-name` est le bon jeton. Le champ Prénom du setup n'a aucun `autoComplete` ; le champ code club n'a ni `autoComplete="off"` ni `textContentType="oneTimeCode"`. | `RegisterScreen.tsx:188`, `ProfileSetupScreen.tsx:613-620,624-631` |
| P2-03 | Mapping Firebase incomplet : Register ne traite pas `auth/operation-not-allowed` (provider désactivé côté console → « Vérifie tes infos et réessaie », faux) ni `auth/invalid-credential` ; Login ne traite pas `auth/user-disabled` (compte désactivé → « Email ou mot de passe incorrect »… non : défaut « Vérifie tes informations », faux). Les 5 codes courants du brief sont couverts. | `RegisterScreen.tsx:35-50`, `LoginScreen.tsx:35-50` |
| P2-04 | Jauge de force du mot de passe = longueur seule : `aaaaaaaaaa` est « Fort ». Le label « Moyen » (warn `#D97706` sur `#F5F7FA`) fait 2,97:1. | `RegisterScreen.tsx:149-151,257`, annexe B |
| P2-05 | Une valeur persistée porte un accent : `"Mieux encaisser les entraînements et les matchs"` (î), en contradiction avec le commentaire « SANS accents » trois lignes plus bas. Pas de casse visible aujourd'hui (le matching `recommendMicrocycle` cherche « encaisser », l'objectif n'est pas projeté au coach) mais la règle est trahie et toute correction exige une migration des profils existants. | `ProfileSetupScreen.tsx:100,119-121`, `domain/recommendMicrocycle.ts:44` |
| P2-06 | Un joueur de 12 ans n'a **aucune** catégorie proposée (U13 retirée) : il ment (U15) ou n'entre pas. Aucune barrière d'âge minimum explicite dans le parcours, alors que la politique parle de « avant 15 ans ». Point juridique à trancher, pas un bug de code. | `domain/types.ts:34,50-52`, `ProfileSetupScreen.tsx:649-652` |
| P2-07 | Club en `joinAccessPolicy: "approval_required"` : le joueur voit « Tu as rejoint {club} » alors que sa fiche est `coachAccess: "pending"` et invisible du coach. Aucune UI joueur « en attente ». (Politique non-défaut, opt-in coach.) | `functions/src/inviteCodes.ts:851-852,876`, `functions/src/coachAccess.ts:105-107`, `ProfileSetupScreen.tsx:525-532` |
| P2-08 | `welcomeDone` est posé **avant** qu'un compte existe : un utilisateur qui quitte au Register revoit au prochain lancement « Content de te revoir » sur Login. | `WelcomeScreen.tsx:106,112,127`, `RootNavigator.tsx:650`, `LoginScreen.tsx:153` |
| P2-09 | Carte cycle à l'É2 en plein onboarding : « Aucun cycle actif — Gère ton cycle depuis l'accueil ou le profil » + lien « Choisir » vers CycleModal, alors que le cycle sera auto-assigné au save. Moment de doute (friction F5 du design, toujours là). L'événement s'appelle `cycle_reco_shown` mais rien n'est montré. | `ProfileSetupScreen.tsx:716-742,479-489,506` |
| P2-10 | Aucun `maxFontSizeMultiplier` sur les 5 écrans. Sur Welcome, le bloc CTA est en `position:absolute` avec une réserve fixe de 216 px : en Dynamic Type XXL, les trois lignes (bouton + 2 liens) débordent sur le sous-titre. | `WelcomeScreen.tsx:92,300-307`, grep |
| P2-11 | Thème sombre : le parcours est cohérent au démarrage (le thème est appliqué **avant** le `require` du navigateur, `App.tsx:91-93`), mais la palette sombre est déclarée « non retravaillée » et échoue sur le CTA (blanc sur `#ff7a1a` = 2,61:1), la bordure des champs (1,60:1) et les dots (1,79:1). Un changement de thème à chaud ne repeint pas les `StyleSheet.create` figés — défaut de toute l'app, hors périmètre. | `constants/theme.ts:66-95`, annexe B |
| P2-12 | Deux contrastes clairs juste sous le seuil : bordure des champs `#7E90A8` sur `#F1F4F8` = 2,96:1 (seuil 3:1), label « Moyen » 2,97:1. Les 6 échecs de l'audit DA sont bien corrigés. | annexe B, `b1701e2` |
| P2-13 | `SafeAreaView` importé et utilisé dans la modale Politique de confidentialité du setup — littéralement contraire à la règle d'or, défendable (une `Modal` RN sort de l'arbre `<Screen>`), à documenter ou remplacer par `useSafeAreaInsets`. | `ProfileSetupScreen.tsx:19,1024,1049` |
| P2-14 | Vocabulaire coach mixte : « Espace coach » (titre), « espace ENTRAÎNEUR » (alerte), « Je suis coach » (Welcome). Le tutoiement, lui, est unifié (commit `23b4d6c`). | `CoachOnboardingScreen.tsx:91-95,193` |
| P2-15 | L'événement `register_failed` n'existe pas (seul `login_failed`) ; aucun événement ne distingue le CTA Welcome choisi (joueur / coach / connexion) ; aucun `coach_club_created`. | annexe C |
| P2-16 | Le compte créé sans doc `users/{uid}` (cas « petit souci réseau ») est rattrapé par le setup — mais le doc n'aura jamais de champ `email` (le setup n'écrit pas `email`, et les rules ne l'autorisent qu'à la création). Cosmétique : l'email vit dans Auth. | `RegisterScreen.tsx:126-135`, `ProfileSetupScreen.tsx:450-491`, `firestore.rules:314-316` |
| P2-17 | « Suivant » du setup n'est pas désactivé quand l'étape est invalide (règle « boutons submit désactivés tant qu'invalide »). Choix assumé (validation au tap + toast), à acter ou aligner. | `ProfileSetupScreen.tsx:996,322-358` |
| P2-18 | Les tests du périmètre sont **des sentinelles textuelles** (lecture du fichier + `toContain`) : 0 test rendu sur la validation email/mdp, le mapping d'erreurs, le double-tap, l'ordre des étapes. Ils protègent des régressions de texte, pas de comportement. | annexe A |

### 2.4 Ce qui est correct et doit le rester

- Sécurité du code club : chemin **serveur uniquement** (`joinClubWithInviteCode`, région `europe-west4`, `clubInvites.ts:6-9,84-91`) ; `inviteCodes`, `clubInviteMeta`, `inviteAttempts` fermés à tout client (`firestore.rules:1027-1037`) ; aucun `getDoc(inviteCodes)` côté client (grep `repositories`/`services`/`screens`/`components` : zéro). Le serveur ne dit pas **pourquoi** un code est refusé (expiré/révoqué/épuisé/inconnu → même message, `inviteCodes.ts:246-247`) : anti-énumération, correct.
- Aucune lecture de `clubs` avant authentification (Welcome/Login/Register n'importent pas Firestore, sauf l'écriture `users/{uid}` de Register après création du compte).
- Liste blanche `users/{uid}` : toutes les clés écrites par Register, le setup et `createClubAsCoach` y figurent (`firestore.rules:314-341`) ; `clubId` vers un nouveau club exige une appartenance active réelle (`:429-434`), satisfaite par l'ordre d'écriture de `createClubAsCoach`. Aucun champ joueur fantôme écrit pour un coach.
- Le profil n'est jamais perdu à cause d'un code refusé (`attachClub.ts`, 5 tests).
- Anti double-tap partout (boutons désactivés en `loading`) ; garde 15 s sur les écritures ; hors ligne au boot, plus de questionnaire vierge (`RootNavigator.tsx:587-593`).
- Consentement parental U15 : bloquant, persisté avec horodatage, non redemandé en édition, décoché si la catégorie change (`domain/parentalConsent.ts`, 1 suite de tests).
- Le format du placeholder du code correspond au format réel ; la normalisation tolère minuscules, espaces et tirets.

---

## 3. Entrée « Je suis coach » directe — proposition

### 3.1 Les options

**(A) Garder l'entrée Welcome existante et la rendre robuste** — recommandée.
Le geste existe déjà et respecte la règle « un seul CTA primaire par écran ». Ce qui manque n'est pas un bouton, c'est la **fiabilité** du chemin : intention persistée, création atomique, état coach distinct de « profil joueur complet ». Coût faible, zéro nouvel écran, zéro changement de rules si on reste sur les champs existants.

**(B) Étape 0 « Tu es… joueur / coach » dans le setup après Register** — écartée.
Elle ajoute un écran à 100 % des joueurs (le cas majoritaire) pour servir les coachs, et elle arrive **après** la création du compte, donc trop tard pour changer le texte du Register. Le portillon actuel fait déjà ce choix sans écran grâce à l'intention. Seul mérite : survivre à la fermeture de l'app — que (A) obtient en persistant l'intention.

**(C) Deux CTA primaires sur Welcome (« Je suis joueur » / « Je suis coach »)** — écartée.
Casse la hiérarchie visuelle validée par la DA Polish, et fait croire à une porte séparée alors que l'inscription est la même. Si Kyllian trouve le lien trop discret sur son téléphone, on monte d'un cran (`body` 14/600 au lieu de `caption`, icône plus grande) sans en faire un bouton.

### 3.2 L'option A en détail

**Écrans et états**

1. **Welcome** — inchangé, sauf : `handleCoach` écrit `AsyncStorage.setItem(STORAGE_KEYS.COACH_INTENT, "true")` en plus de l'état mémoire (nouvelle clé à ajouter dans `constants/storage.ts`, à purger dans `services/accountDeletionHelpers.localAccountKeysToPurge`). Texte proposé : « Je suis coach ou membre du staff » (annonce l'adjoint, voir cas limites).
2. **Register** — même écran ; si l'intention est posée, le sous-titre devient « Crée ton compte coach. Tu créeras ton club juste après. » (lecture de l'intention via une prop/route param, pas de store dans l'écran). Prénom **requis** dans les deux cas (règle 12 déjà appliquée au setup ; on l'aligne au Register, cela supprime la double saisie P2-01 et donne au coach son prénom sans champ supplémentaire).
3. **Portillon** — `intentionCoach` initialisé depuis AsyncStorage au boot (dans le même `useEffect` que `WELCOME_DONE`, `RootNavigator.tsx:559-568`) ; consommé **et effacé du stockage** au même endroit qu'aujourd'hui (`:501-509`) ; effacé aussi à la déconnexion (`:531`) et par « Je suis joueur finalement » (`:735-738`).
4. **CoachOnboarding** — même écran. Deux changements : (i) `createClubAsCoach` passe en `writeBatch` (club + appartenance + `users/{uid}`) : une seule validation atomique côté rules, plus de club orphelin ; garder la garde 15 s. (ii) Le nom du coach n'est plus demandé (il vient du Register) — un champ de moins.
5. **Après création** — inchangé (bascule automatique vers CoachTabs).

**Ce qui s'écrit dans `users/{uid}` pour un coach** (respect de la liste blanche `firestore.rules:314-341`) :
- au Register : `email`, `displayName`, `firstName`, `profileCompleted: false`, `createdAt`, `updatedAt` (`:314-316` + mutables) — inchangé ;
- à la création du club : `uid`, `clubId` (légitime via l'appartenance `owner` posée dans le même batch — `firestore.rules:429-434,119-121,845-849`), `updatedAt`, et **`profileCompleted`** : voir ci-dessous.

**`profileCompleted` : le vrai sujet.** Aujourd'hui le champ veut dire deux choses (« questionnaire joueur rempli » ET « coach installé »). Deux voies :
- **A-mini (front-only, aucune rule)** : continuer à poser `profileCompleted: true` pour un coach, mais ajouter une **garde de complétude joueur** dans le navigateur : si `appSpace.space === "player"` et que le snapshot n'a pas `position`/`ageCategory`/`level`, on monte le portillon joueur (`ProfileSetupGate`) même si `profileCompleted` est vrai. Corrige P1-04 sans toucher au contrat de données. Inconvénient : la sémantique reste bancale et la garde duplique la liste des champs requis (à centraliser dans une fonction `isPlayerProfileComplete(data)` de `domain/`, testée).
- **A-propre (touche les rules)** : ne plus écrire `profileCompleted` à la création de club ; ajouter `playerProfileCompleted` (ou renommer) → il faut l'ajouter à `userMutableFields()` (`firestore.rules:323-341`), au test `firestore-tests/rules.userDocument.test.ts`, et migrer les coachs existants (Cloud Function `backfill`). **Revue sécurité obligatoire** (petite : un booléen de plus dans une liste blanche, aucun droit dérivé).
- Recommandation : **A-mini maintenant** (pilote), A-propre dans le lot « refonte Profil » déjà ouvert.

**Ce que RootNavigator doit lire** : `intentionCoach` (mémoire + AsyncStorage), `profileCompleted`, la complétude joueur dérivée du snapshot (A-mini), `appSpace` — rien de nouveau côté Firestore.

**Cas limites**
- *Coach qui veut aussi s'entraîner* : « Je m'entraîne aussi » existe déjà (`CoachSelfPlayerCard.tsx:62`, callable `enrollSelfAsClubPlayer`). Avec la garde A-mini, sa première bascule vers l'espace joueur ouvre le questionnaire (4 étapes, sans code club puisqu'il est déjà membre) — c'est le comportement que le commentaire du navigateur croit déjà avoir.
- *Joueur qui a cliqué coach par erreur* : « Je suis joueur finalement » existe (`CoachOnboardingScreen.tsx:51-56`) ; il doit aussi effacer la clé AsyncStorage. Sur Register, le lien « Connecte-toi » ne doit pas effacer l'intention (un coach avec compte mais sans club en a besoin — comportement actuel correct).
- *Coach qui rejoint un club existant comme staff non-propriétaire* : **aucun flux n'existe** (P1-06). Hors lot : nécessite une Cloud Function `issueStaffInviteCode`/`joinClubAsStaff` (ou une extension du code club avec un rôle), des rules et une revue sécurité complète (c'est une élévation d'accès). À court terme, le texte de CoachOnboarding doit le dire : « Ton club existe déjà ? Demande au coach principal — l'ajout d'un adjoint arrive bientôt. »
- *Coach dont la création échoue après le batch* : impossible par construction (batch = tout ou rien) ; le timeout ne peut plus laisser d'orphelin.

**Analytics à poser** (utile seulement après P1-01) : `welcome_cta {kind: "register"|"login"|"coach"}`, `register_failed {code}`, `coach_club_create_confirmed`, `coach_club_created {durationSec}`, `coach_club_create_failed {reason}`, `coach_intent_restored` (intention relue au boot), `coach_back_to_player`.

**Textes FR proposés**
- Welcome : « Je suis coach ou membre du staff »
- Register (intention coach) : titre « Crée ton compte coach » · sous-titre « Ton club se crée à l'étape suivante, en 30 secondes. »
- CoachOnboarding : titre « Ton club sur FKS » · sous-titre « Donne le nom de ton équipe. Tu recevras un code à partager à tes joueurs ; FKS construit leur prépa, toi tu gardes le terrain. » · champ « Nom du club et catégorie — ex. : ES Wasquehal U17 » · bouton « Créer mon club » · alerte « Créer l'espace coach de {nom} ? — Tu pourras y suivre tes joueurs. Ce compte devient un compte coach. [Annuler] [Créer] » · lien bas « Ton club existe déjà sur FKS ? Demande au coach principal. »
- Sortie : « Finalement, je suis joueur »

### 3.3 Impact rules / functions — verdict

- **Lot B en version A-mini : front-only.** Aucune rule, aucune function : `writeBatch` écrit les mêmes documents avec les mêmes clés ; `onUserWritten` (`functions/src/triggers.ts:77-119`) et `onMemberWritten` réagissent à l'identique.
- **Version A-propre : touche `firestore.rules` (+1 clé) et un backfill** → revue sécurité obligatoire, même minime.
- **Adjoint/staff : hors lot**, Cloud Function nouvelle + rules + matrice de droits.

---

## 4. Plan d'exécution (ordres de grandeur, pas des engagements)

### Lot A — inscription joueur, P0/P1, front-only
**Fichiers** : `screens/ProfileSetupScreen.tsx`, `screens/profileSetup/attachClub.ts`, `components/settings/ClubManagementCard.tsx` (réutilisée), `screens/homeVNext/*` (bandeau), `app.config.js`, `constants/storage.ts`, `RegisterScreen.tsx`.
1. **P0-01** — deux mouvements : (i) **validation immédiate du code** à l'étape 1 : bouton « Vérifier » à côté du champ qui appelle la callable et affiche « ✓ {nom du club} » ou le refus, **sans** rattacher (le rattachement reste au save — ou bien on rattache tout de suite et on l'affiche : décision produit, le serveur accepte les deux) ; (ii) **état persistant** « Club non rejoint — réessayer » sur le Home (carte) tant que `clubId` est null et qu'un code a été tenté (flag local `fks_club_code_failed_{uid}`), avec lien direct vers la carte « Rejoindre un club ». Corriger les deux textes qui disent « depuis Profil ».
2. **P1-01** — `app.config.js` : `AMPLITUDE_API_KEY: process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY ?? extra.AMPLITUDE_API_KEY ?? ""` + clé dans les secrets EAS (action Kyllian). Sentinelle : test qui échoue si `app.config.js` ne lit pas la variable.
3. **P1-05** — brouillon local du setup : `AsyncStorage` `fks_setup_draft_{uid}` écrit à chaque « Suivant », relu au montage, effacé au save et à la déconnexion. Zéro Firestore (pas de doc partiel à valider par les rules).
4. **P2-01/02** — prénom requis au Register, `autoComplete="given-name"`, `textContentType="oneTimeCode"` + `autoComplete="off"` sur le code club.
5. **P2-03** — compléter les deux mappings (`operation-not-allowed`, `user-disabled`, `invalid-credential` au Register).
**Tests à écrire (sentinelles + rendus)** : rendu Register/Login avec `@testing-library/react-native` — bouton désactivé tant qu'invalide, double tap = un seul appel Firebase (mock), chaque code Firebase → message FR attendu ; `attachClub` : le flag d'échec est posé ; brouillon : écrit à chaque étape, effacé au save. **Risques** : la vérification immédiate consomme une tentative de rate-limit par essai (`inviteCodes.ts:579`) — vérifier le quota `JOIN_ATTEMPT_POLICY` avant ; le brouillon ne doit jamais contenir la gêne « Mon corps » (donnée santé, reste dans son store). **Ordre de grandeur** : 2 à 4 jours d'exécution + recette téléphone.

### Lot B — entrée coach robuste (option A-mini)
**Fichiers** : `screens/WelcomeScreen.tsx`, `navigation/RootNavigator.tsx`, `constants/storage.ts`, `services/accountDeletionHelpers.ts`, `repositories/clubsRepo.ts`, `screens/CoachOnboardingScreen.tsx`, `domain/playerProfile.ts` (nouveau, `isPlayerProfileComplete`), `screens/RegisterScreen.tsx` (sous-titre).
1. Intention coach persistée (P1-02) ; 2. `writeBatch` dans `createClubAsCoach` (P1-03) ; 3. garde de complétude joueur dans le portillon (P1-04) ; 4. textes §3.2 ; 5. mention « club existant → coach principal » (P1-06 provisoire).
**Tests** : étendre `navigation/__tests__/coachEntryIntent.test.tsx` (déjà rendu partiellement) : intention relue au boot, effacée à la consommation/déconnexion/retour joueur ; `repositories/__tests__/clubsRepo.test.ts` : un seul `commit`, aucun `setDoc` isolé ; `domain/__tests__/playerProfile.test.ts` : complétude ; sentinelle navigateur : `isPlayerProfileComplete` appelé avant `AppNavigator`. **Risques** : la garde de complétude ne doit pas piéger les comptes **legacy** (profils anciens sans `ageCategory` mais joueurs actifs) — la fonction doit tolérer les champs hérités listés dans `firestore.rules:270-274` ou être limitée aux comptes ayant `clubId` + `accessRole` staff ; à trancher avec un export anonymisé des profils. **Front-only** (cf. §3.3). **Ordre de grandeur** : 1,5 à 3 jours + recette téléphone coach ET coach-joueur.

### Lot C — finitions P2, funnel, reste du design du 12/07
1. Événements manquants (P2-15) — 0,5 j, inutile avant Lot A-2.
2. Étape 2 sans carte cycle (P2-09) + écran « Ton programme est prêt » (design §5, maquette avant code) — 2 à 3 j.
3. Contrastes résiduels clair (P2-12) et palette sombre du parcours (P2-11) — 0,5 à 1 j ; `maxFontSizeMultiplier` (P2-10) — 0,5 j.
4. `welcomeDone` posé à la création du compte plutôt qu'au tap (P2-08) — 0,25 j.
5. Politique « approval_required » : état « en attente » côté joueur (P2-07) — 0,5 j.
6. Décision juridique âge minimum (P2-06) — hors code, Kyllian.
7. Valeur accentuée (P2-05) : **ne pas corriger sans migration** ; documenter l'exception.
8. Adjoint/staff (P1-06 définitif) : design + Cloud Function + rules + revue sécurité — chantier séparé, 3 à 5 j.

---

## 5. Ce que je n'ai pas pu vérifier

- **Comportement réel sur iPhone** : clavier qui masque les champs, `KeyboardAvoidingView` en mode `padding` sur le setup (`ProfileSetupScreen.tsx:901`), suggestions iOS sur `autoComplete="name"`, rendu Dynamic Type, ombres. Le code est cohérent ; seule la recette téléphone tranche.
- **Ce que le téléphone de Kyllian exécute aujourd'hui** : la recette du 01/09 a montré un binaire antérieur au 18/08 ; si l'OTA du 01/09 (`ee67e789`) est bien active, « Je suis coach » y est. À confirmer par lui en 10 secondes (écran d'accueil, sous « J'ai déjà un compte »).
- **Rules et Cloud Functions déployées vs repo** : j'ai lu `firestore.rules` et `functions/src` du repo ; je n'ai pas comparé à la prod. Les tests `firestore-tests/*.test.ts` exigent l'émulateur (non lancé ici). Les callables `joinClubWithInviteCode`, `enrollSelfAsClubPlayer` sont supposées déployées en `europe-west4`.
- **Défaut de dosage backend quand `ageCategory` est null** (P1-04) : `deriveAudienceLevel(null, …)` existe (`audiencePromptFragments.ts:60`) ; je n'ai pas suivi ce que le moteur fait ensuite d'une audience sans catégorie (Senior par défaut ? garde-fous jeunes désactivés ?). À vérifier côté backend avant de juger la gravité réelle pour un coach U15.
- **Quota de tentatives du code club** (`JOIN_ATTEMPT_POLICY`, `inviteCodes.ts:579`) : je n'ai pas lu les valeurs ; elles conditionnent la « vérification immédiate » du Lot A.
- **Comptes legacy** : combien de profils actifs n'ont pas `ageCategory`/`position` (impact de la garde de complétude, Lot B) — nécessite un export Firestore que je n'ai pas fait (lecture seule imposée, et de toute façon hors périmètre d'un audit de code).
- **Amplitude** : je n'ai pas vérifié si une clé existe dans les secrets EAS ; le code ne la lirait pas de toute façon (`app.config.js:42`), donc la conclusion tient.
- **Analytics « 4,7 s pour 785 tests »** : ce chiffre confirme que la suite est textuelle ; je n'ai pas cherché de tests rendus ailleurs (`__tests__` hors périmètre) qui couvriraient Register/Login.

---

## Annexe A — Tests exécutés

`npx jest --config jest.worktree.config.js` sur : `screens/__tests__/{registerPrenom,coachClubConfirmation,onboardingTactile,welcomeSkipSafeArea}`, `screens/profileSetup`, `navigation/__tests__`, `repositories/__tests__`, `services/__tests__/{clubInvites,clubMembers,clubContext}`, `domain/__tests__/{parentalConsent,appSpace,joinAccessPolicy}`.
**Résultat : 20 suites, 785 tests, 0 échec, 4,7 s.**
Nature : `registerPrenom` (7 greps, 0 rendu), `coachClubConfirmation` (8/0), `onboardingTactile` (22/0), `attachClub` (logique pure, 5 cas), `coachEntryIntent` (29 greps + 8 rendus : le seul à rendre Welcome). Aucun test ne rend Register, Login ni ProfileSetup.

## Annexe B — Contrastes WCAG mesurés (script `contrast.js`, formule WCAG 2.1)

| Paire | Clair | Sombre |
|---|---|---|
| Titres `text` / `bg` | 16,27 ✓ | 19,28 ✓ |
| Sous-titres, liens « J'ai déjà un compte », « Je suis coach » `sub` / `bg` | 5,67 ✓ | 7,86 ✓ |
| Placeholders `muted` / `cardSoft` | 5,11 ✓ | 7,05 ✓ |
| Liens accent / `bg` | 7,65 ✓ | 6,87 ✓ |
| Label blanc sur CTA `cta` | 4,55 ✓ | **2,61 ✗** |
| Bordure des champs `borderStrong` / `cardSoft` (seuil 3:1) | **2,96 ✗** (limite) | **1,60 ✗** |
| Dots inactifs Welcome (seuil 3:1) | 3,04 ✓ | **1,79 ✗** |
| Erreur `danger` / `bg` | 4,50 ✓ | 7,48 ✓ |
| « Moyen » `warn` / `bg` | **2,97 ✗** | 12,07 ✓ |
| « Fort » `success` / `bg` | 4,67 ✓ | 11,42 ✓ |
| Ancien CTA `#F2741B` sur blanc (audit 31/07) | 2,88 — remplacé | — |

## Annexe C — Événements analytics présents dans le parcours (tous inertes tant que P1-01 n'est pas corrigé)

`login_success`, `login_failed {code}` (Login) · `register_success` (Register) · `profile_step_completed {step, stepLabel, totalSteps}` ×2, `club_code_checked {valid}`, `cycle_reco_shown {cycleId}`, `profile_completed {durationSec}` (Setup) · `first_session_generated` (NewSession, consomme `ONBOARDING_START_TS`, `NewSessionScreen.tsx:117-119`) · `session_generate_start/success/error/cancelled/reset/from_cache` (génération).
**Manquants** : `register_failed`, `welcome_cta {kind}`, `coach_club_created`, `coach_club_create_failed`, `profile_setup_abandoned`, `club_code_retry_from_settings`.
