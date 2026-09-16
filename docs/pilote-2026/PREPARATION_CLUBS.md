# PRÉPARATION CLUBS — Inventaire du parcours premier jour (Phase 1)

**Date** : 15/08/2026 · **Code audité** : `6574882` (= main, binaire RC pilote v1.1.0 — exactement ce que les clubs auront) · **Statut** : lecture seule, RIEN modifié, RIEN mergé · **Fichier non commité.**

**Mission** : rejouer le parcours d'un coach de club et d'un joueur U15 à la PREMIÈRE ouverture (compte neuf, zéro donnée) et classer tout ce qui « fait pas fini ». Ce rapport ne re-signale pas ce que les branches de correctif existantes couvrent déjà (§7).

---

## 0. L'essentiel en 6 lignes

1. **Le parcours nominal jour 1 est solide** : inscription → setup → cycle auto-assigné → Home honnête → génération gardée → séance → feedback → compteurs à jour. Vérifié par exécution (3 300+ tests verts, sondes du pipeline réel du Home, messages d'erreur exécutés).
2. **4 P0 confirmés** : 2 nouveaux (« Passer » du Welcome dessiné sous la barre de statut ; swipe du feedback + « Rester » = écran mort iOS) et 2 déjà connus de l'audit Profil, re-prouvés par exécution sur ce code (compte neuf « En forme », graphe de forme 7 jours fabriqué).
3. **27 P1** (vus en une semaine de pilote) : franglais résiduel sur le chemin de séance (« hard/moderate », « Readiness », dates ISO brutes), 3 scénarios hors-ligne qui coincent (« Terminer » le setup, boot à froid, « Démarrer ce cycle »), la permission notifications jamais demandée, et les 3 ex-P0 données du Profil.
4. **72 P2** — dette et incohérences que seuls nous voyons ; aucun n'est bloquant pilote.
5. **8 problèmes historiques vérifiés FERMÉS sur main** (fausse séance, TWF onboarding, collision ProfileSetup, latence génération, watcher planned, wipe-au-boot, séance zombie, fuite coach) — la RC est bien plus saine que la mémoire des audits le laissait croire.
6. **Plan Phase 2** : ~28 commits atomiques sur `fix/preparation-clubs`, P0 d'abord, 3 décisions produit à trancher avant (marquées 🎯).

---

## 1. ⚠️ Signalement immédiat — données (consigne « en tête de rapport »)

- **Aucun P0 de sécurité découvert.** La fuite joueur→coach est verrouillée et testée (espace dérivé du serveur, default-deny, `appSpace.test.ts` + `coachAccessInvariants` exécutés verts). Aucun secret dans le code audité. Le bloc debug backend est gaté `__DEV__`.
- **Perte de données réelle n° 1 (connue, toujours vivante)** : le cap 30 des tests terrain détruit physiquement les entrées les plus anciennes à la 31e sauvegarde (`TestsScreen.tsx:253-254` + `useTestsStorage.ts:69-72`, AsyncStorage réécrit, aucune copie Firestore). Requalifiée P1 en délai d'apparition (≥31 sauvegardes ≈ 3 journées de tests complètes), mais c'est LA perte irréversible du binaire → **Lot C en Phase 2**.
- **À instruire (P2 non contre-vérifié)** : au boot hors-ligne, un snapshot vide `fromCache` peut écraser les données club locales — jours d'entraînement, jours de match, objectif hebdo (`useSyncStore.ts:187-192, 245-247`). Le wipe des SÉANCES est fermé (vérifié), celui des préférences club ne l'est pas. À trancher en tête de Phase 2.

---

## 2. Méthode et chiffres

- **29 agents** (14 inspecteurs — un par tronçon du parcours + 4 balayages transverses + 1 vérificateur d'état connu — puis 15 contre-vérifications), ~4,1 M tokens, 987 opérations.
- **113 accusations brutes → 103 après dédup → contre-vérification adversariale** : chaque P0 candidat a eu un réfutateur individuel (mission : démolir), les P1 ont été instruits par lots. Résultat : 7 P0 candidats → **4 confirmés, 3 requalifiés P1** ; 36 P1 candidats → 21 confirmés, 3 nuancés-mais-P1, 12 requalifiés P2. La passe mord (des accusations ont été cassées ou re-scopées dans les deux sens).
- **Chiffres exécutés, pas d'impressions** : suites jest lancées depuis le worktree avec les overrides (3 300+ tests verts sur plusieurs runs complets), modules purs transpilés et exécutés en node (TSB compte neuf, streakStats, recommendMicrocycle, pipeline du Home, classifyError, sémantique Firestore hors-ligne contre hôte injoignable), scans AST (9 327 littéraux de chaînes, 297 fichiers de navigation, census couleurs/typo).
- ⚠️ **Piège jest aggravé découvert** : sous Windows, `npx jest <chemin>` en pattern positionnel ne filtre PAS (la suite entière tourne) — utiliser `--runTestsByPath` et toujours vérifier le compte de tests. 3 suites coach sont flaky sous charge parallèle (timeouts), vertes en isolation — ne pas accuser le code produit.
- **Limite assumée** : aucun rendu sur téléphone réel. Les deux P0 « visuels » sont des chaînes de preuve statiques complètes (géométrie arithmétique, machine à états déterministe) ; une capture téléphone tranche chacun en 30 s.

---

## 3. LES 4 P0 — un club le voit en 5 minutes et perd confiance

### P0-1 · Le lien « Passer » du tout premier écran se dessine SOUS la barre de statut 🆕
**Écran** : Welcome (la seconde 1 de l'app). **Preuve** : `skip` est en `position:"absolute", top:8, right:20` (`WelcomeScreen.tsx:243-247`) dans le conteneur paddé de `<Screen>` — or le moteur de layout (Yoga 3, vérifié dans les sources RN 0.81.5 embarquées) positionne un enfant absolute avec inset SANS ajouter le padding du parent. Résultat : « Passer » à ~16-33 px du bord physique, sous batterie/wifi sur iPhone à encoche, sous les icônes système Android (`edgeToEdgeEnabled: true`), tap probablement intercepté par la barre de statut iOS. Le même écran compense manuellement le BAS (`insets.bottom`, l.185) et ToastHost se donne un `NOTCH_SAFE_TOP` manuel — seul « Passer » n'a pas sa compensation.
**Correctif** : ajouter `insets.top` au `top` du style skip (1 ligne + capture de recette).

### P0-2 · Swipe du feedback + « Rester » = écran mort (iOS) 🆕
**Écran** : FeedbackScreen — le modal qui s'ouvre après la 1re séance. **Scénario** : le joueur swipe vers le bas (geste standard), la feuille glisse ENTIÈREMENT hors écran (`translateY = screenHeight`, `useSwipeToDismiss.ts:39`), PUIS l'alerte « Feedback non enregistré — Quitter sans valider ton retour ? » apparaît. S'il choisit « Rester » (le choix prudent), rien ne remet `translateY` à 0 ni ne réarme `dismissingRef` (`ModalContainer.tsx:50-58` — l'effet ne rejoue que si `visible` change, or il vaut littéralement `true`, `FeedbackScreen.tsx:249`). Fond flouté vide, croix et Valider hors écran, backdrop neutralisé. **Seule issue iPhone : tuer l'app** (les valeurs saisies aux curseurs sont perdues ; la séance reste re-validable, pas de perte de séance). Variante : tap backdrop + « Rester » tue silencieusement swipe et backdrop pour la suite. Contre-vérifié maillon par maillon, aucune garde salvatrice dans le dépôt ; Android s'échappe par le bouton retour matériel — mais iOS/TestFlight est le canal pilote.
**Correctif** : au « Rester », rejouer l'animation d'entrée (translateY→0) et réarmer `dismissingRef` ; test du cycle swipe→Rester→swipe.

### P0-3 · Compte neuf affiché « En forme — Prêt à performer, c'est le moment d'envoyer. » (connu : audit Profil P0-1)
Re-prouvé par EXÉCUTION sur `6574882` : TSB compte neuf = CTL0(15) − ATL0(12) = +3 → zone OPTIMAL → puce ÉTAT « En forme » verte + carte « Ta forme » + badges « Frais »/« C'est bon » (`ProfileScreen.tsx:103,204,342-345,553-564`, `useLoadStore.ts:21`, `trainingDefaults.ts:14-15,149`). Rendu inconditionnel — aucun état « pas encore de données ». **Le scénario club est frontal : un coach fait installer l'app à 15 joueurs, les 15 profils affichent le même « En forme » vert au même moment — le chiffre est visiblement inventé.** Violation de la règle 12, déjà éradiquée du Home vNext mais vivante sur le Profil. Diff `55aed5a..HEAD` vide sur ces fichiers : l'audit Profil reste exact ligne à ligne.

### P0-4 · « Ta forme sur 7 jours » : 7 barres fabriquées (connu : audit Profil P0-2)
Exécuté : `tsbHistory=[]`, `tsb=3` → l'expression réelle de la l.570 (`tsbHistory[idx] ?? tsb`) rend `["3","3","3","3","3","3","3"]` — une semaine d'historique de forme inventée pour un joueur inscrit depuis 2 minutes, étiquetée J…J-6 (`ProfileScreen.tsx:567-576`). Même après quelques jours, chaque trou est comblé par la valeur du jour.

**Correctif P0-3/P0-4 (même geste)** : état « Pas encore de données » sur la puce ÉTAT et la carte « Ta forme » tant qu'aucune séance/charge réelle n'existe, et ne tracer le graphe qu'avec des jours observés — exactement le pattern déjà écrit dans `homeVNextAdapter.ts:240-247`.

---

## 4. LES 27 P1 — un club le voit en une semaine

Chaque entrée a été contre-vérifiée (verdict entre crochets). Groupées par tronçon du parcours. 🎯 = décision produit à trancher avant correction.

### Les 3 ex-P0 données du Profil (audit Profil P0-3/P0-4/P0-5 — requalifiés en délai d'apparition, pas en gravité)
- **P1-01 [NUANCE]** · **« Club / match : 0 sem » à vie** — `computeStreakStats(sessions, [] as any, …)` (`ProfileScreen.tsx:257`) : tableau des charges externes vide EN DUR. Exécuté : avec les vraies données → 3 sem ; avec `[]` → 0 pour toujours. **Aggravé** : touche TOUS les joueurs à jours club/match déclarés (l'auto-application des charges remplit le store toute seule) — la donnée correcte existe à un import près. Invisible jour 1 (tout est à 0, cohérent), certain en semaine 1 quand « Semaines FKS » monte et pas lui.
- **P1-02 [NUANCE]** · **« Tests ce mois » ne compte pas les tests terrain** — il compte les séances contenant un exercice `modality:"run"` d'intensité ≥ *moderate* (`streakStats.ts:29-35,71-76`, exécuté : 1 batterie de tests → 0 ; 1 footing tempo → 1). **Aggravé** : « moderate » suffit — le trophée bronze tombe en 2 footings pendant que les vrais tests restent à 0, et le même écran affiche « Derniers tests : il y a N j » depuis la VRAIE source juste au-dessus.
- **P1-03 [NUANCE]** · **Cap 30 destructeur des tests terrain** (voir §1). La comparaison avant/après du Home/Progression survit (2 jours les plus récents) ; ce qui meurt : le « Record », la moyenne, et les références de début de saison — irrécupérables.

### Auth / Setup / Entrée (4)
- **P1-04 [CONFIRMÉ]** · **Prénom laissé vide à l'inscription → la partie locale de l'email devient le prénom** (« kyky76700 »), écrite en base, re-présentée au setup ET au coach dans son effectif (`RegisterScreen.tsx:107-109`, `CoachPlayerRow.tsx:91`). Valeur de remplissage interdite par la règle 12 ; sur un effectif entier, le cas arrivera.
- **P1-05 [CONFIRMÉ ×2]** · **« Terminer » le setup hors réseau = overlay bloquant sans fin** : « Enregistrement de ton profil… », barre qui monte en ~2 s puis gèle à 95 %, aucun bouton Annuler, `setDoc` Firestore pend indéfiniment hors-ligne (exécuté contre hôte injoignable : ni resolve ni reject) ; force-kill = questionnaire entier perdu (`ProfileSetupScreen.tsx:427,962-968`, `LoadingOverlay.tsx:171-176,273-276`). Si le réseau revient, ça repart tout seul — le blocage n'est définitif que hors-ligne. Les clubs testeront dans des vestiaires.
- **P1-06 [NUANCE]** · **Boot à froid hors réseau (compte déjà configuré) : après ~10 s de Splash, l'app montre… le questionnaire de profil VIERGE** (snapshot `fromCache` vide traité comme « pas de profil », `RootNavigator.tsx:561-572,643-644` ; sémantique Firestore exécutée : cache mémoire vide à chaque cold start, aucun `persistentLocalCache` configuré). Un joueur configuré croit son compte effacé. Correctif naturel : attendre tant que `fromCache && !exists` + message hors-ligne borné.
- **P1-07 [NUANCE]** 🎯 · **Un joueur peut créer un club et basculer tout son app en espace coach** sans garde-fou de confirmation, irréversible sans le support (`ProfileSetupScreen.tsx:669-674` → `CoachOnboardingScreen` → `clubsRepo.ts:198-206`). Nuance : geste délibéré (lien explicite + nom + bouton), pas un mis-tap. Décision : dialog de confirmation « Tu vas devenir compte coach » ? (1 commit si oui.)

### Home / Génération (4)
- **P1-08 [CONFIRMÉ]** 🎯 · **Séance générée jamais ouverte, le lendemain : « Ta séance … attend ton retour » exige un ressenti sans issue « je ne l'ai pas faite »** (`viewModel.ts:1368,1408`, sonde exécutée ; fenêtre J-2..J+1). Le joueur honnête doit mentir au feedback ou attendre 2 jours. Décision : ajouter une issue « Pas faite » au feedback, ou restreindre ce CTA aux séances réellement commencées.
- **P1-09 [verdicts partagés P1/P2]** 🎯 · **L'objectif n° 1 du setup (« Être en forme toute la saison ») auto-assigne le cycle « Saison / Maintien » au lieu de « Fondation »** — bug d'ordre de sous-chaînes, la branche écrite pour « fondation » est du code mort (`recommendMicrocycle.ts:38-39`, exécuté sur les 4 objectifs du setup). Deux instructeurs divergent sur la gravité (mapping « sémantiquement défendable ») — mais c'est LA première décision produit qu'un pilote voit, et « Fondation » absorbe précisément la reprise. Décision : quel cycle pour cet objectif jour 1 ?
- **P1-10 [NUANCE ×2]** · **Bouton « Jour OFF (+1j) » : un outil d'horloge dev resté en prod**, sans retour visuel, chaque tap décaye ATL/CTL et avance la date de charge en silence (`GenerationActions.tsx:93`, `CurrentSessionCard.tsx:97`, `useLoadStore.ts:78-90`). Corruption transitoire (rebuildLoad écrase au prochain boot/sync), mais le graphe TSB du Profil et le contexte envoyé au backend la voient pendant la session. Correctif : gater `__DEV__` (les deux emplacements).
- **P1-11 [CONFIRMÉ]** · **Toast « Séance planifiée pour le 2026-08-16. »** — date ISO brute dans une phrase française (`orchestrator.ts:122`, `NewSessionScreen.tsx:537`), alors que `formatDayFR` existe.

### Séance (Preview / Live / Feedback) (5)
- **P1-12 [CONFIRMÉ]** · **Badges d'intensité en anglais brut sur CHAQUE carte de bloc, Preview ET Live** : « hard », « moderate », « easy » (`BlockCard.tsx:103`, `SessionLiveScreen.tsx:452`) — `utils/frLabels.ts` a déjà la table de traduction, elle n'est juste pas branchée là.
- **P1-13 [CONFIRMÉ]** · **Feedback, carte « État du joueur » : date brute « 2026-08-15 » en badge + anglicisme « Readiness »** (`HeroReadinessCard.tsx:37,46`) — `formatDayFR` sert trois écrans plus loin.
- **P1-14 [CONFIRMÉ]** · **« Basées sur l'intensité moderate »** — token backend anglais au milieu d'une phrase française (`SuggestionsCard.tsx:34`, encore `frLabels` non branché).
- **P1-15 [CONFIRMÉ]** · **Champ « Durée réelle » : vidé au premier tap, jamais re-rempli, et un champ laissé vide retombe EN SILENCE sur la durée prévue** (pas le chrono) sans que l'UI le dise (`MetricsRow.tsx:33`, `applyFeedback.ts:70`). L'amont UI de l'ex-P0-6 Profil (le « min » de l'historique) — les deux se corrigent ensemble.
- **P1-16 [NUANCE]** · **Le motif TouchableWithoutFeedback banni de l'onboarding (recette 01/08) enveloppe encore 4 modals** : Feedback, ExternalLoad, CycleModal, DeleteAccount (`FeedbackScreen.tsx:285`, etc.). Le symptôme prouvé au téléphone était le focus TextInput ; les curseurs sont des Touchables — à trancher aux pouces, mais le motif est identique à celui déjà régressé une fois.

### Progression / Tests (3)
- **P1-17 [CONFIRMÉ]** · **La notification « Récap de la semaine » (ON par défaut, dimanche 20 h) ouvre la page Progression dans les états que le produit a verrouillés** (empty/collecting, inatteignables par navigation normale) — et la page ne contient aucun bilan de semaine (`notifications.ts:196`, `useNotificationHandler.ts:42`). Dimanche soir de la semaine 1 pilote, précisément.
- **P1-18 [CONFIRMÉ]** · **État « collecting » : la même phrase imprimée deux fois, l'une sous l'autre** (`ProgressScreen.tsx:381` + `progressionViewModel.ts:1386`) — exposé par le chemin P1-17.
- **P1-19 [CONFIRMÉ]** · **Une batterie de tests enregistrée n'existe pas pour le Home/Profil déjà montés** : aucun mécanisme de rafraîchissement inter-écrans, « zéro test » toute la session d'app (`useTestsStorage.ts:67-71`, `useEtatStoresHome.ts:80`). Le joueur fait ses tests puis revient au Home : rien n'a changé.

### Langue / cohérence (5)
- **P1-20 [CONFIRMÉ]** · **Le Profil affiche les valeurs persistées SANS accents** : « Defenseur · Regional », objectif « Gagner en vitesse / explosivite » (`ProfileScreen.tsx:325,333` lisant `lastAiContext` brut) — les DISPLAY_LABELS accentués existent dans ProfileSetupScreen et ne sont pas réutilisés. Visible dès la première génération.
- **P1-21 [CONFIRMÉ]** · **Espace coach : tutoiement et vouvoiement mélangés, la MÊME phrase existe dans les deux registres** (`CoachErrorState.tsx:67` vs `CoachWeekScreen.tsx:451`, 5 fichiers « vous » vs 4 « tu », 1 mixte intra-phrase). Les coachs pilotes le liront jour 1.
- **P1-22 [CONFIRMÉ]** · **Jargon interne sur le parcours génération : « Séance Prime (reset) », « Pourquoi reset ? »** (`ResetVariantModal.tsx:29`, `resetExplain.ts:96-151`).
- **P1-23 [CONFIRMÉ]** · **Routines & extras : titres franglais** (« Warm-up terrain complet », « Cooldown post-entraînement », « jours streak », typo « Adapt le nombre de reps ») (`prebuiltSessions.ts` multiples, `BadgesCard.tsx:53`). Hors périmètre de fix/bibliotheque-precision (limité à engine/) — vérifié.
- **P1-24 [CONFIRMÉ]** · **Calendrier de la page Progression : numéro du jour actif quasi illisible** — gris presque noir #0b0b0c sur pastille bleu foncé, contraste MESURÉ 2,40:1 (reliquat du thème sombre, `ProgressScreen.tsx:836-848`).

### Hors-ligne / système (3)
- **P1-25 [CONFIRMÉ]** · **« Démarrer ce cycle » hors-ligne : bouton mort silencieux** — aucun état de chargement dans tout CycleModalScreen, le toast d'erreur est inatteignable (`CycleModalScreen.tsx:181-216,421-422`). Modal fermable, retaps sans danger — le défaut est le silence total.
- **P1-26 [CONFIRMÉ]** · **La permission notifications n'est JAMAIS demandée pendant toute la première session** (course au boot : `App.tsx:77-81` lit le store avant hydratation), aucun rappel programmé, mais Réglages affiche « Notifs activées » (`SettingsScreen.tsx:365`) et RoutineScreen « Rappels Actifs ». Le mensonge peut durer au-delà du jour 1 (l'effet ne rejoue qu'au changement de réglage).
- **P1-27 [NUANCE→P1 retenu]** · Divers hors-ligne du coach jour 1 : **« Créer mon club » hors-ligne = overlay infini sans annulation** (`CoachOnboardingScreen.tsx:107,208` — même famille que P1-05, fix commun `variant="light"` + timeout).

---

## 5. LES 72 P2 — nous seuls les voyons (liste compacte, refs exactes dans les journaux)

**Auth/entrée (6)** : validation muette (messages d'erreur de saisie = code mort, bouton gris qui ne répond rien — RegisterScreen:87-89/289) · codes Firebase non mappés → messages génériques qui peuvent mentir (compte désactivé) · double mapping erreurs concurrent (errorHandler vs écrans, Alert.alert dans showErrorWithRetry) · ToastHost : notch codé en dur + 2,2 s trop court pour 2 lignes · flag WELCOME_DONE posé dès « Commencer » (abandon d'inscription → relance sur « Content de te revoir » sans compte) · suite coachEntryIntent flaky sous charge.

**Setup (4)** : splash « Chargement de ton espace… » + remontage complet juste après un rattachement club réussi · « Terminer » sans garde de réentrance (double-tap = 2 enregistrements) · aucun brouillon persisté (kill Android pendant l'aller-retour WhatsApp pour le code club = questionnaire vidé — ×2 constats fusionnés) · intention « Je suis coach » non persistée (kill avant création club → questionnaire joueur).

**Boot/navigation (5)** : flash blanc au boot en thème sombre · CLAUDE.md ment (« Mode Coach retiré », « Onboarding slides ») · deep links fks:// entièrement morts (scheme jamais déclaré) · route ExternalLoad déclarée mais inaccessible (aucun bouton n'y mène dans tout le binaire) · param fantôme startInFavorites de VideoLibrary.

**Home (2)** : repli « dernière génération » inopérant (l'adaptateur lit le wrapper du store comme payload — sonde exécutée) · deux bandeaux hors-ligne superposés qui disent la même chose.

**Génération (9)** : toggle « Traîneau / Sled » envoie `power_sled` que le backend ne connaît pas (case sans effet) · Salle : « équipement standard inclus » puis chips qui reproposent les mêmes équipements (+ doublon Poulie, 1re chip auto-cochée) · hint « Aucun matériel ? » qui ignore les chips cochées · 3e lieu tapé avalé en silence (limite de 2 non dite) · « Me recommander un cycle » = même action que « Voir les cycles » · trois noms pour Routines & extras (tuile/header/détail) · « Utiliser cette séance » (cache) sans verrou anti double-tap (2 écritures Firestore possibles) · mode avion : « Le serveur se réveille... » affiché brièvement avant l'erreur réseau (mauvaise raison) · barre d'overlay calibrée 25 s vs cold start assumé 90-180 s.

**Contenu prébuilt (1)** : routine « Warm-up pré-match terrain » prescrit « exercice technique avec ballon » et « duels d'épaules » — contradiction doctrine zéro-ballon/solo (`prebuiltSessions.ts:503`, hors périmètre des deux branches existantes — vérifié).

**Preview/Live (7)** : coches et chrono de preview perdus d'un swipe et jamais transférés au Live (qui change d'unité de comptage) · statuts Adapté/Sauté/Remplacé qui réapparaissent en relançant une séance quittée (« Ta progression sera perdue » pas tenu) · navigation programmatique (tap notif) sort de séance sans confirmation · consigne du club tronquée à 4 lignes sans « voir plus » · 4 abonnements de store morts · TimerCard preview : presets inertes (tappables en Live) · Vibration.vibrate en direct au lieu de useHaptics (reduceMotion ignoré) — viole la convention n° 8.

**Feedback/Résumé (5)** : toast « Il sera retenté automatiquement » = promesse fausse (rien ne retente après ~3,5 s — ×2 constats fusionnés) · deux « charge estimée » différentes à 4 s d'écart (Résumé sans pondération de modalité, Feedback avec) · un snapshot Firestore mi-saisie réinitialise les curseurs en silence · deep link feedback sans séance = formulaire complet avec bouton « Séance trop ancienne » · recovery_tips du Résumé lisibles 4 s (mais accessibles sans limite en Preview + Historique — nuancé).

**Progression/Tests (8)** : « vs mois dernier » toujours au pluriel + vert flèche montante sur écart nul · bornes de saisie lâches (sprint 10 m à 17 s accepté ; le 0,1 s est lui bien rejeté) · « Un seul test enregistré » après une batterie de 3 mesures · tirets « — » dans Stats du mois (doctrine du même écran) · « +9.00 cm » (2 décimales forcées sur mesures entières) · double titre « Tests terrain » (nav + héro) · param initialPlaylist mort (= P2-9 audit Profil, confirmé) · batterie jour 1 sans accusé de réception hors écran Tests (nuancé depuis P1).

**Hors-ligne/infra (5)** : deux détecteurs réseau divergents (NetInfo vs ping Google 30 s) · file offline du feedback jamais alimentée = code mort (pipeline de resync tourne à vide ; aucune perte locale, perte serveur possible en multi-appareil) · annulation de génération pendant persistance pendue → téléportation vers Preview minutes plus tard · snapshot vide fromCache écrase les données club locales au boot hors-ligne (**à instruire, cf. §1**) · refus de permission au boot non reflété dans Réglages.

**Visuel/socle (7)** : SessionHubScreen entier sur SafeAreaView + modale confidentialité du setup (règle d'or n° 13, nouveaux cas hors liste Profil) · 395 couleurs en dur dans 56 fichiers hors thème (mini-palettes Tailwind/vieux orange sur le parcours génération) · 569 fontSize en dur, 19 tailles distinctes (l'échelle theme.typography consommée par 6 fichiers) · textes backend de coaching sans numberOfLines (Preview/Live/Résumé) · overlay de chargement NOIR par défaut dans une app claire (génération + feedback + création club — commentaire in-code périmé) · carte « Créer une séance » en vieux orange sous les seuils de contraste du projet (titre lisible, sous-titre 13 px faible) · consignes d'échauffement en franglais (« ankle rocks », « Ramp sets » — carte de repli rarement atteinte).

**Espace coach (1)** : texte d'accessibilité sans accents (« Relance la verification de tes acces ») + placeholder « Ex: Coach Marvin » visible des coachs pilotes (à évaluer).

**Historique/stores (2)** : cap 200 séances confirmé à sa nouvelle adresse (`state/stores/useSessionsStore.ts:38`) · voie résiduelle mission-r3 : un bloc renvoyé avec `items` absent devient un pseudo-exercice « Bloc » 5 min au lieu d'un refus (`transform.ts:55-64`).

---

## 6. Vérifié FERMÉ sur main (ne pas re-corriger)

| Problème historique | Verdict sur 6574882 | Preuve |
|---|---|---|
| « Fausse séance » (placeholder « Séance à confirmer ») | **CORRIGÉ** (mission-r3 mergé) — refus typés partout, carte d'échec honnête, AUCUNE écriture sur panne | 36 tests exécutés verts ; reste la voie résiduelle P2 « bloc sans items » |
| TWF avale les taps (recette 01/08) | **CORRIGÉ** sur les 4 écrans d'onboarding + test source ; motif restant sur 4 modals = P1-16 | `onboardingTactile.test.ts` vert |
| Collision route ProfileSetup (recette 01/08) | **CORRIGÉ** (« ProfileSetupGate » ≠ « ProfileSetup », keys par arbre) ; la branche `fix/profilesetup-complete-bridge` est **obsolète et supprimable** (réimplémenté sur main) | `RootNavigator.tsx:660-665` |
| Latence génération 15 s sans feedback (recette 01/08) | **CORRIGÉ** — overlay 5 étapes + Annuler + timeout 90 s + retry unique + « Le serveur se réveille… » | `api.ts:224-238` |
| Watcher planned efface la séance faite (pré-saison P0) | **CORRIGÉ** — invariants extraits et testés | `plannedMergeHelpers` vert |
| Wipe-au-boot sans restore (pré-saison P0) | **CORRIGÉ** — triple mécanisme (authResolved, file sérialisée, snapshots per-user) | `resetUser.ts:29-136` |
| Séance zombie au Home | **MERGÉ** (763173d ancêtre de main) — ne bloque ni CTA ni génération, badge « Non validée » honnête | `git merge-base` exécuté |
| Fuite joueur → espace coach | **VERROUILLÉ** — default-deny serveur, AppSpaceSwitch rend null sans double espace réel | 3 suites exécutées vertes |
| Version affichée | **OK** — « FKS · v1.1.0 » | `SettingsScreen.tsx:742` |

---

## 7. Déjà couvert par les branches existantes (référencé, pas dupliqué)

- **Bibliothèque d'exercices** (contenu des fiches, durées inventées, vidéos substituées, « À éviter », noms franglais d'exos, typos engine/) → corrigé sur `fix/bibliotheque-precision` (9 commits). **Non re-signalé.**
- **Exercices non-solo** (mention « à deux », stubs rsa_*, garde solo, Signal) → corrigé sur `fix/non-solo-front`. **Non re-signalé.**
- Les deux sont **combinées sur `recette/bibliotheque-non-solo`** — prête, en attente de ta recette téléphone. Tant qu'elle n'est pas mergée, les clubs VERRONT ces défauts-là : c'est la branche à faire passer en premier.
- **Onglet Profil** : les 35 problèmes de AUDIT_PROFIL.md (branche `claude/refonte-profil-fks-a1f76b`). Diff `55aed5a..HEAD` VIDE sur les 9 fichiers concernés → l'audit reste exact ligne à ligne. Ses 5 P0 sont intégrés au plan ci-dessous (2 confirmés P0 jour-1, 3 requalifiés P1 délai). Seul delta neuf trouvé : les 2 badges de tendance « Stable » sur zéro donnée (P2).
- **Contrastes du parcours d'inscription** : audit DA du 31/07, décision de direction artistique pendante. Non re-signalé.

---

## 8. Ce qui est SAIN — vérifié, à préserver (extraits)

- **L'entrée est propre** : mapping FR des erreurs Firebase branché, anti double-soumission, RGPD bloquante (+ consentement parental U15 réellement bloquant au setup), liens légaux accessibles avant création de compte, session persistée (pas de re-login), textes des 3 écrans d'auth relus mot à mot : rien à signaler.
- **Le setup protège la saisie** : profil enregistré AVANT l'attache club (un code refusé/une panne ne coûte jamais le questionnaire — 5 tests exécutés), chaque cause d'échec du code club a son message FR actionnable, chemin sans code fluide, back Android = étape précédente.
- **Le Home vNext tient ses promesses jour 1** (pipeline EXÉCUTÉ) : aucune valeur de remplissage, carte Progression vide conforme à la recette verbatim, skeleton borné 10 s, cycle auto-assigné (jamais de Home sans cycle), fixes c89d3ab/9848936 tiennent, 932 tests verts.
- **La génération est blindée** : verrou anti double-tap payant, refus typés, messages honnêtes exécutés, garde feedback claire, zéro ballon côté UI, cache 5 min honnête, distinction « générée mais pas enregistrée » sans réappel payant.
- **La séance survit** : chrono sur horloge réelle (verrouillage écran OK), reprise après kill (prompt propre, 4 h, même id), séance générée jamais perdue par un swipe, notes techniques `token:` filtrées, feuilles Adapter/Sauter/Remplacer en bon français.
- **Le feedback est local-first exemplaire** : ATL/CTL/TSB appliqués en synchrone avant persistance, jamais bloqué par le réseau, idempotent, fenêtre de validation partagée, « Ma semaine » passe à 1 immédiatement (compteur canonique).
- **Navigation saine** : 0 cible de navigation inconnue sur 297 fichiers scannés, 0 onPress vide, notifs gardées par routes montées, deep links gardés.
- **Tests terrain** : état vide propre et engageant, bornes qui rejettent le 0,1 s, virgule française convertie, 1 km en min+s.

---

## 9. PLAN DE CORRECTION PHASE 2 — branche `fix/preparation-clubs`, aucun merge

**Décisions à trancher AVANT (🎯)** : ① P1-08 issue « Pas faite » au feedback ou CTA restreint ? ② P1-09 quel cycle pour « Être en forme toute la saison » jour 1 (je recommande Fondation) ? ③ P1-07 dialog de confirmation avant création de club ?

| Lot | Contenu | Commits | Vérification |
|---|---|---|---|
| **A — P0 interaction jour 1** | A1 : « Passer » + insets.top (P0-1). A2 : réarmement du modal au « Rester » (P0-2) | 2 | test cycle swipe→Rester→swipe ; capture recette téléphone |
| **B — P0 mensonges Profil compte neuf** | B1 : état « Pas encore de données » puce ÉTAT + carte « Ta forme » (P0-3). B2 : graphe 7 j = jours observés uniquement (P0-4), pattern homeVNextAdapter | 2-3 | tests unitaires état neuf ; mêmes fixtures que le Home |
| **C — données Profil/Tests (ex-P0)** | C1 : brancher externalLoads réels (P1-01). C2 : « Tests ce mois » depuis la vraie source testsCount (P1-02). C3 : cap 30 → conservation intégrale (ou cap large ≥ 500) SANS destruction des records (P1-03) | 3 | streakStats exécuté avant/après ; test de non-destruction au save |
| **D — langue & formats du chemin de séance** | frLabels branché sur badges de bloc (P1-12) + suggestions (P1-14) ; formatDayFR sur toast planif (P1-11) + héro feedback (P1-13) ; « Readiness » → « État du jour » ; valeurs affichées via DISPLAY_LABELS au Profil (P1-20) ; jargon reset (P1-22) ; franglais prébuilt + « Adapt » (P1-23) ; registre coach unifié tu (P1-21) | 6-8 | grep-tests source par table de labels ; relecture verbatim |
| **E — robustesse hors-ligne & système** | E1 : timeout+Annuler+message sur l'overlay « Terminer » et « Créer mon club » (P1-05, P1-27). E2 : gate boot `fromCache && !exists` + message (P1-06). E3 : loading + toast atteignable sur « Démarrer ce cycle » (P1-25). E4 : permission notifs demandée après hydratation + état Réglages honnête (P1-26). E5 : « Jour OFF » gaté __DEV__ (P1-10). E6 : durée réelle re-remplissable + mention du repli (P1-15). E7 : notif récap → Home tant que la page n'a pas d'état bilan (P1-17) + dédoublonnage collecting (P1-18). E8 : refresh tests inter-écrans (P1-19). E9 : prénom vide = null, jamais l'email (P1-04). E10 : TWF des 4 modals → même motif que l'onboarding (P1-16) | 10-12 | tests ciblés par fix (chemins --runTestsByPath explicites) + suite complète ; les scénarios hors-ligne fléchés recette téléphone |
| **F — selon décisions 🎯** | P1-07 / P1-08 / P1-09 | 1-3 | — |

**Total estimé : ~28 commits atomiques** (avant/après cité dans chaque message), suite complète relancée après chaque lot. **P2 : hors périmètre Phase 2** sauf opportunités à coût nul dans un fichier déjà ouvert (signalées au cas par cas). Après Phase 2 : **CHECKLIST TÉLÉPHONE de 15 gestes max** (livrable dédié) — incluant les 6 points que seul le téléphone peut trancher (rendu « Passer », swipe feedback, TWF aux pouces, boot mode avion ×2, texte agrandi).

---

## 10. Limites de la mesure

- Analyse statique + exécution de modules purs + suites jest : **aucun rendu device**. Les plafonds maxFontSizeMultiplier, les gestes réels et les latences réseau réelles restent le domaine de ta recette téléphone (comme pour le Home, dont la recette existe : `docs/home-vnext-2026-08/RECETTE_HOME.md`).
- Le comportement Firestore hors-ligne a été exécuté avec le SDK du dépôt contre un hôte injoignable (sémantiques identiques en RN, timings possiblement plus longs sur réseau dégradé).
- Les P2 n'ont PAS été contre-vérifiés individuellement (preuves du trouveur uniquement, refs citées).
- Backend hors périmètre : le finding power_sled repose sur la note de contrat versionnée côté front.

## 11. Traçabilité

Workflow `wf_741fec68-992` (session du 15/08) : 29 agents, 113 accusations, journaux complets dans `subagents/workflows/wf_741fec68-992/journal.jsonl` de la session. Verdicts : 7 P0 candidats → 4 P0 / 3 P1 ; 36 P1 candidats → 24 P1 / 12 P2 ; 60 P2 directs. Suites exécutées à plusieurs reprises : 139-142 suites / 3 288-3 402 tests verts selon les runs (flakiness coach sous charge documentée, verte en isolation).
