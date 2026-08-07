# AUDIT PROFIL — Phase 0 (mesures, lecture seule)

**Date** : 2026-08-07 · **Code audité** : branche issue de `origin/main` 55aed5a (Home vNext mergé) · **Production intacte** : aucun fichier de l'app touché.

**Méthode** : 2 workflows multi-agents (43 agents, ~3,3 M tokens) — 5 lecteurs d'inventaire (un par groupe d'écrans), 3 chasseurs de mensonges (réglages inertes / doubles vérités / données fausses), puis **une vérification adversariale par accusation** (un réfutateur indépendant qui essaie de démolir la preuve). 4 constats supplémentaires contre-vérifiés directement par l'orchestrateur.

**Bilan des vérifications : 39 accusations instruites, 39 CONFIRMÉES, 0 réfutée.** Trois défauts ont été trouvés indépendamment par deux chasseurs différents (convergence). Après fusion des recoupements : **35 problèmes** dans la liste fermée — **6 P0, 14 P1, 15 P2**.

> **Comment lire les hauteurs** : estimées depuis les styles (paddings + hauteurs fixes + lignes de texte × interligne), largeur utile 390 pt, police système ×1,0. C'est une estimation statique à ±15 % — la recette téléphone (Phases 1 et 3) mesurera le rendu réel en 320/375/390 et texte agrandi. Repère : un iPhone 390×844 montre ~650 pt utiles sous le header et au-dessus de la tab bar.

---

## 1. Chiffres clés

| Mesure | Valeur |
|---|---|
| Écrans du sous-arbre Profil | 8 écrans + 3 légaux (~5 500 lignes d'écran auditées) |
| `ProfileScreen.tsx` | **1 008 lignes**, 9 sections, **~2 100–2 420 pt de scroll ≈ 3,5 hauteurs d'écran**, 6–9 zones tappables |
| `SettingsScreen.tsx` | **819 lignes**, 10 sections, **~2 450 pt ≈ 3,7 hauteurs d'écran**, 29 zones tappables |
| Part du ProfileScreen en stats **lecture seule** | **~66–68 % du scroll** (6 sections sur 9, zéro zone tappable) |
| Ces 6 sections lecture seule | recouvrent des concepts déjà affichés ailleurs (Home, Progression, Hub) — et **4 contiennent au moins un mensonge P0** |
| Les 3 vraies actions (Mon profil / Paramètres / Historique) | reléguées dans la **dernière** section, à ~2 000 pt de profondeur |
| Réglages visibles inertes dans Settings | **5 sur 13** contrôles (38 %) : Sons, Distance, Poids, Mode privé, Données anonymisées |
| Canaux de notification | doc CLAUDE.md en annonce 4, le code en planifie **2** (rappel séance 18h fixe + récap hebdo) |
| Section Club des Réglages | ~700 pt à elle seule (28 % de l'écran) |
| `ProfileScreen` absent de la structure documentée dans CLAUDE.md | l'écran a grossi hors radar |

**Le constat structurel** : l'onglet Profil est aujourd'hui un **second Home d'avant la refonte** — pastille d'état de forme, trophées, streaks, courbes amorcées, compteurs recopiés — exactement les patterns que le Home vNext a bannis un par un. Et paradoxalement, presque rien du « profil » au sens identité/compte : l'identité du joueur y est un chip… alimenté par un instantané périmé (P1-1).

---

## 2. Cartographie de l'onglet

```
Tab « Profil » → ProfileScreen (1 008 l.)
 ├─ ProfileSetup (édition, 1 347 l., 4 étapes)         [bouton tout en bas + chips « À définir »]
 ├─ CycleModal (995 l., 4 vues : liste/confirm/gestion/fin)
 ├─ NewSession (« Continuer »)
 ├─ Tests (456 l. + composants screens/tests/)
 ├─ SessionHistory (253 l.)
 └─ Settings (819 l.)
     ├─ ProfileSetup (encore — 2e porte d'entrée)
     ├─ LegalNotice (45 l., ~545 pt statiques)
     ├─ PrivacyPolicy (45 l., ~1 400 pt statiques)
     └─ DeleteAccount (~270 l., flux réel Auth+Firestore+local)
```

### ProfileScreen — les 9 sections dans l'ordre de rendu

| # | Section | Hauteur est. | Tappable | Source réelle | Verdict |
|---|---|---|---|---|---|
| 1 | Héro (avatar, nom, objectif, chips SÉANCES/ÉTAT/DERNIÈRE, poste/pied/niveau) | 266 pt | non | `lastAiContext.profile` (instantané) + TSB store | **P1-1, P0-1, P2-7** |
| 2 | Parcours (stepper pathway, conditionnel) | 142 pt | non | store pathway | sain |
| 3 | Mon rythme (FKS/Club/Matchs par sem) | 117 pt | si vide | watcher Firestore temps réel | **sain** (« À définir » sans zéro) |
| 4 | Programme (cycle + carte tests) | 267–400 pt | 2–4 | store cycle + `readTestsRaw` brut | **P1-9, P2-9** |
| 5 | Ta régularité (3 lignes momentum) | 206 pt | non | `computeStreakStats(sessions, [], …)` | **P0-3, P0-4** |
| 6 | Ta forme (statut + 2 graphes 7 j) | 385 pt | non | TSB amorcé + remplissages | **P0-1, P0-2** |
| 7 | Trophées (grille 2×2) | 304 pt | non | mêmes streaks | **P0-4, P1-7** |
| 8 | Ta semaine (calendrier L→D club/match) | 138 pt | non | jours déclarés | sain |
| 9 | Dernières séances + **les 3 boutons d'action** | 290 pt | 4 | filtre local recopié | **P2-6, P2-11** |

Sections 1, 2, 5, 6, 7, 8 = **1 441 pt de lecture seule sur ~2 115 pt de contenu (68 %)**.

### SettingsScreen — les 10 sections

| # | Section | Hauteur est. | Contenu | Verdict |
|---|---|---|---|---|
| 1 | Héro « Paramètres » | 115 pt | 3 badges qui **recopient les switches du même écran** | **P2-11** |
| 2 | Compte | 219 pt | Identité (badge « Vérifié » **P1-14**), Profil joueur, Déconnexion | — |
| 3 | Club | **~700 pt** | ClubManagementCard + AppSpaceSwitch — **légitime** (lu par la génération) mais dominant | volume |
| 4 | Préférences | 461 pt | 7 rangs — Notifs/Rappel/Vibrations/Objectif/Feedback auto **fonctionnent** ; Sons **inerte** (P1-4) ; « Stratégie rappel » masquée (P2-1) | mixte |
| 5 | Apparence | 89 pt | Thème clair/sombre — **réel** | sain |
| 6 | Unités & formats | 213 pt | Semaine **réel** ; Distance + Poids **inertes** (P1-5) | mixte |
| 7 | Confidentialité | 346 pt | Mode privé + Données anonymisées **inertes** (P1-2, P1-3) ; 3 navigations | mixte |
| 8 | Debug | 0 pt | non rendue en prod | sain |
| 9 | Données & support | 157 pt | Export (**P1-13**), Réinitialiser (**P1-6**, **P2-14**) | — |
| 10 | Footer version | 27 pt | — | sain |

### Les autres écrans

- **TestsScreen** (~1 900 pt en consultation) : socle 3 tests + stats + dernière perf + optionnels + historique. Storage canonique respecté, pas de valeur d'amorçage — mais **P0-5** (record détruit au cap 30), **P1-12** (delta sans 2 jours locaux), **P2-15**.
- **CycleModalScreen** (995 l., 4 vues de 240 à 1 230 pt) : re-affiche cycle + tests + reco **déjà montrés par la section Programme du Profil**, avec ses propres copies de logique (P1-9, P2-8, P2-9, P2-10).
- **SessionHistoryScreen** (253 l.) : liste saine côté dates (toDateKey partout) — mais **P0-6** (« min » faux) et titre doublé (P2-11).
- **Légal/Privacy/Delete** : adresse légale **complète et conforme** ; DeleteAccount tient ses promesses côté client ; écarts politique↔réalité en **P2-12**.

---

## 3. Ce que le joueur vient faire vs la place que ça occupe

| Action réelle | Fréquence plausible | Où c'est aujourd'hui |
|---|---|---|
| Suivre/continuer son cycle | hebdo (mais déjà au Home) | section 4, ~530 pt de profondeur |
| Consulter son historique | hebdo | bouton **en toute fin d'écran** (~2 000 pt) |
| Tests terrain | mensuel | carte conditionnelle + TestsScreen |
| Régler notifications & co | ponctuel (1–2 fois) | Settings, via bouton **en toute fin d'écran** |
| Éditer son profil (poste, objectif, rythme) | rare | ProfileSetup, via bouton **en toute fin** ou chips « À définir » |
| Légal / export / suppression | exceptionnel | Settings, en bas |

En face : les deux tiers du scroll sont des **statistiques en lecture seule qui doublonnent le Home et la Progression** (état de forme, régularité, trophées, semaine, forme 7 j) — dont quatre mentent (P0-1 à P0-4). Aucune des raisons de venir dans l'onglet n'est servie dans le premier écran visible.

---

## 4. LA LISTE FERMÉE — 35 problèmes vérifiés

Chaque entrée a été confirmée par un vérificateur adversarial indépendant (ou contre-vérifiée directement, marqué ⊙). Sévérités : **P0** = le joueur voit un mensonge ou perd des données · **P1** = réglage inerte visible / donnée périmée / divergence réelle · **P2** = dette, incohérence sans impact joueur direct.

### P0 — mensonges visibles / pertes de données (6)

- **P0-1 · Un compte neuf s'affiche « En forme — Prêt à performer »** sur les constantes d'amorçage (TSB = CTL0−ATL0 = +3). Chip ÉTAT du héro + carte « Ta forme » + tags « Frais »/« C'est bon ». `ProfileScreen.tsx:103,204,342-345,553-564` ; amorce `useLoadStore.ts:18-22`, `trainingDefaults.ts:14-16,149`. Le Home vNext interdit exactement ça, en le nommant (`homeVNextAdapter.ts:240-247` recalcule depuis zéro et refuse le store). Aucun état « pas encore de données » sur le Profil — violation frontale de la règle 12.
- **P0-2 · Le graphe « Ta forme sur 7 jours » est fabriqué deux fois.** (a) Chaque barre manquante est bouchée avec le TSB **du jour** (`tsbHistory[idx] ?? tsb`, `ProfileScreen.tsx:570`) : compte neuf = 7 barres identiques à +3 ; historique partiel = des « jours passés » qui affichent la valeur d'aujourd'hui. (b) L'axe « J…J-6 » égrène en réalité des **événements** de charge, pas des jours (push par feedback/charge sans dédup, `applyFeedback.ts:144`, `applyExternalLoad.ts:81` ; `rebuildLoad` ne redéduplique qu'à l'hydratation/sync). ⊙ S'y ajoute, vérifié directement : le graphe d'intensité voisin remplit les jours vides avec `?? 0` et la « Moy » est diluée par ces zéros (`ProfileScreen.tsx:221,226-229,589`).
- **P0-3 · « Club / match : 0 sem » à vie.** `computeStreakStats(sessions, [] as any, …)` — le tableau des charges externes est passé **vide en dur** (`ProfileScreen.tsx:257`) alors que `useExternalStore.externalLoads` existe et est importé dans le même fichier. `weeksClubMatch` vaut mathématiquement toujours 0 (`streakStats.ts:59-68`), affiché comme un fait (`:534,543`). Note pour le correctif : même bien câblé, c'est un streak de semaines consécutives ancré sur la semaine courante — 0 restera parfois légitime.
- **P0-4 · « Tests ce mois » / trophée « Tests du mois » ne comptent aucun test terrain.** Ils comptent des séances FKS « VMA-like » par heuristique sur les exercices (modality run / nom contenant « vma » / focus speed, intensité ≥ moderate — un footing modéré compte comme un « test »). `ProfileScreen.tsx:288,535`, `streakStats.ts:29-36,70-76`. Les vrais tests sont lus dans le même fichier (`testsCount`, `:129-133`) mais pas utilisés ici. 3 batteries faites ce mois → « 0 test ».
- **P0-5 · Le record de tests est détruit, pas seulement caché.** Cap silencieux à 30 entrées **réécrit par-dessus l'unique stockage** (AsyncStorage, aucune copie Firestore) : `TestsScreen.tsx:253` (`slice(0,30)` à chaque sauvegarde) + `useTestsStorage.ts:57`. La pill « Meilleur » devient fausse passé 30 relevés, et la perte se propage à la progression du Home. Une entrée = une batterie **ou** un seul test rapide : 30 arrive vite.
- **P0-6 · L'historique affiche une charge sRPE suffixée « min ».** Sans `durationMin`, repli sur `${Math.round(volumeScore)} min` (`SessionHistoryScreen.tsx:124-129`) — or volumeScore est un score de charge (affiché honnêtement « UA » dans `SessionPreviewScreen.tsx:162`). Systématique pour toute séance planifiée non validée listée, et pour toute séance validée sans durée saisie. « 270 min » possibles pour une séance d'une heure.

### P1 — réglages inertes visibles, données périmées, divergences réelles (14)

- **P1-1 · L'identité du héro est périmée par construction.** Prénom, poste, niveau, pied, objectif lus dans `lastAiContext.profile` — un instantané écrit à la génération de séance (`ProfileScreen.tsx:118,159-163` ; écrit par `services/aiContext.ts:406`, rechargé au montage de l'onglet Séance mais gardé par `if (aiContext) return`). Conséquences : poste modifié au setup → l'ancien poste s'affiche jusqu'à la prochaine génération ; compte sans génération → « Joueur » sans rien, alors que tout est dans `users/{uid}` déjà observé en temps réel.
- **P1-2 · « Données anonymisées » est un faux interrupteur de consentement.** `privacyAnalytics` n'a zéro consommateur d'exécution ; `services/analytics.ts` n'importe jamais le settingsStore et Amplitude s'initialise inconditionnellement si la clé existe (`App.tsx:76`). Nuance factuelle : `app.json:40` fixe la clé à `""` (pas de fallback env dans `app.config.js:42`), donc Amplitude ne tourne pas dans les builds actuels — le toggle reste un consentement structurellement inhonorable. `SettingsScreen.tsx:624-634`.
- **P1-3 · « Mode privé — Masquer le nom et les infos visibles » ne masque rien nulle part.** `privateMode` n'existe que dans le store et le switch (`settingsStore.ts:13,48`, `SettingsScreen.tsx:613-620`). Aucun écran ni service club ne le lit.
- **P1-4 · « Sons » ne fait rien sur téléphone.** Les deux seuls consommateurs sont gardés `Platform.OS === "web"` (`SessionLiveScreen.tsx:1157-1179`, `SessionPreviewScreen.tsx:183-205`) ; les notifs codent `sound: true` en dur et `shouldPlaySound: false` coupe le son foreground indépendamment du réglage (`notifications.ts:42,128,151,179,198,228`). Le badge « Sons actifs/coupés » affiche un état sans effet sur les builds distribués.
- **P1-5 · Distance (km/mi) et Poids (kg/lb) ne convertissent rien.** Aucun consommateur d'exécution (`settingsStore.ts:14-15`, éditeurs `SettingsScreen.tsx:562-584`) pendant que l'app affiche kg/km **en dur** à 6+ endroits (`testReferenceMapping.ts:67,74`, `TonSuiviSection.tsx:38`, `testConfig.ts:205-257`, `ItemActionsSheet.tsx:169`, `NewSessionScreen.tsx:61-63`).
- **P1-6 · Réinitialiser les préférences fabrique une double vérité notifications.** `resetSettings` remet `notificationsEnabled: true` sans toucher `fks_notif_prefs` ni replanifier : badge vert, switch ON, zéro notification — et la divergence **survit aux redémarrages** (`scheduleAllNotifications` sort à vide, `notifications.ts:213`) ; dans cet état le toggle « Rappel séance » est inerte aussi. Seul un OFF→ON manuel répare. `settingsStore.ts:84`, `SettingsScreen.tsx:319-338,365`.
- **P1-7 · Le trophée « Semaine active » recompte la semaine avec sa propre implémentation.** Fenêtre **glissante** 7 j (`lastNDates`, `ProfileScreen.tsx:218,262-269`) contre la semaine calendaire canonique de `domain/resumeCanonique.ts` (règle 11), et objectif **inventé** `Math.max(1, targetFks ?? 2)` (`:271`) — le défaut « ?? 2 » que `resumeCanonique.ts:258-261` dénonce nommément — affiché dans le hint « Encore X séances ». Le test sentinelle d'unicité ne l'attrape pas : sa regex cherche `week(Key)?Set.has(`, la variable s'appelle `last7Set` (`resumeCanoniqueUnicite.test.ts:87`).
- **P1-8 · « PLAYLIST » affiché comme phase d'entraînement.** Le héro (`{phase ?? 'FKS'}`, uppercase) et le badge « Phase Playlist » exposent un jeton interne figé au défaut du store pour tous les joueurs (`setPhase` : zéro appelant ; `applyFeedback.ts:146-148` fige la valeur). `ProfileScreen.tsx:311,429`, `useSessionsStore.ts:16,42`.
- **P1-9 · Les tests terrain sont lus en brut au Profil et au CycleModal.** `JSON.parse(readTestsRaw())` maison sans validation ni canonicalisation (`ProfileScreen.tsx:125-142`, `CycleModalScreen.tsx:145-157`), contournant `useTestsStorage` (source du Home et de TestsScreen) — le contrat du Home cite ces deux lignes comme contre-exemple (`viewModel.ts:426-431`). Une dernière entrée legacy (« explosif ») → reco de cycle différente entre Profil et Home ; entrées sans `ts` valide → `testsCount` gonflé.
- **P1-10 · L'objectif principal a trois fraîcheurs.** Copie `lastAiContext` au Profil (pill objectif périmée **visible en permanence**), `getDoc` one-shot au CycleModal, `onSnapshot` temps réel au Home — le hook partagé `useMainObjective.ts:5-10` documente le problème sans être branché sur les deux premiers. Reco « ON TE CONSEILLE » calculable sur l'ancien objectif (visible sans cycle actif). `ProfileScreen.tsx:118,163,174,330-335,472-478`, `CycleModalScreen.tsx:133-144,162-165`.
- **P1-11 · Deux arithmétiques d'avancement pour le même état.** `microcycleSessionIndex = 3` s'affiche « 3/12 » (faites) au Hub Séances — fraction **nue**, sans mot — contre « Séance 4/12 » (courante) au Profil et au Home. `SessionHubScreen.tsx:218-221,244-247` vs `ProfileScreen.tsx:239-240,483` et `HomeVNextAction.tsx:382`. Sur CycleModal les deux coexistent mais avec des libellés qui les distinguent.
- **P1-12 · Le delta « vs. précédent » des tests ignore la règle des 2 jours locaux.** Compare les deux dernières saisies par timestamp brut, même à 5 minutes d'écart (`OverviewCard.tsx:108`, `testHelpers.ts:87-105`) — la règle actée (CLAUDE.md, implémentée dans `progressionViewModel.ts:765-781`) exige 2 jours locaux distincts. En prime `delta === 0` → `return null` : pas d'état « identique », contra le sens à trois valeurs.
- **P1-13 · « Fichier JSON de toutes tes données » n'exporte pas tout.** Manquent les tests terrain (clé AsyncStorage à part — que la suppression de compte, elle, purge bien) et les prefs fines de notifications ; posture RGPD du libellé non tenue. Et le nom de fichier est daté en UTC (`toISOString().slice(0,10)`, date de la veille avant ~1-2h du matin). `SettingsScreen.tsx:200-240,715,225`.
- **P1-14 · Le badge « Vérifié » ne vérifie rien — et il est quasi constant.** Critère = présence d'un `displayName` (`SettingsScreen.tsx:385`), que `RegisterScreen.tsx:102` pose systématiquement à l'inscription. Aucun `sendEmailVerification` dans l'app. « Vérifié » partout, « Standard » seulement si l'updateProfile a échoué.

### P2 — dette, incohérences sans impact joueur direct (15)

- **P2-1 · `reminderStrategy` : persisté, jamais câblé, doublement mort.** Trois stratégies stockées, une réalité (alarme quotidienne fixe 18h00, `notifications.ts:33-34,116-136,215`) ; le contrôle est masqué dans Settings avec commentaire d'avertissement (`SettingsScreen.tsx:468-472`) et son unique lecteur est un écran injoignable (P2-2). Deviendrait P1 si la route redevenait joignable sans câblage.
- **P2-2 · `RoutineScreen` : route déclarée, injoignable.** `RootNavigator.tsx:234` est l'unique occurrence de « Routine » ; aucun navigate, absent du linking.
- **P2-3 · Trois canaux de notification morts.** `scheduleStreakReminder` (`notifications.ts:139`), `scheduleMatchEveReminder` (`:161`), `sendLocalNotification` (`:222`) : zéro appelant ; les cases `streak_reminder`/`match_eve` du handler de tap sont injoignables (`useNotificationHandler.ts:35-36`). Cohérent avec la purge des streaks — mais le canal aurait dû partir avec.
- **P2-4 · CLAUDE.md ment sur son propre périmètre.** `CLAUDE.md:59` annonce 4 canaux de rappels (2 réels) ; la structure documentée ne contient pas `ProfileScreen.tsx` ; « Mode Coach retiré » alors qu'un CoachStack complet vit sur main (`RootNavigator.tsx:117-130,265-299`).
- **P2-5 · Le cycle actif est résolu sans canonicalisation dans 4 écrans** (`ProfileScreen.tsx:236`, `SessionHubScreen.tsx:216`, `CycleModalScreen.tsx:94-97`, `TestsScreen.tsx:125` via `isMicrocycleId` brut) là où le Home canonicalise. Vérification adversariale : divergence **non atteignable** par les voies vivantes (le store canonicalise à l'écriture) — dette d'incohérence, pas un bug actif.
- **P2-6 · Le total de séances est recopié en filtre local** au Profil (`:177`) et au Hub (`:214`) au lieu du prédicat canonique ; chemin de divergence réel mais étroit (séances sans date lisible comptées ici, exclues du cumul de la carte Progression via `dateKey !== ""`). Deux totaux « depuis tes débuts » possibles sur la même page Progression.
- **P2-7 · Chip « SÉANCES » plafonné à 200 en local.** La troncature arrive à la **génération** (`pushSession` → `slice(0,200)`) ; le watcher redescend tout — pour un joueur > 200 séances le total oscille selon le moment. `ProfileScreen.tsx:177,340`, `useSessionsStore.ts:38`.
- **P2-8 · `daysBetween` en millisecondes, dupliqué.** Arithmétique ms au lieu de jours locaux (`ProfileScreen.tsx:70`, copie `CycleModalScreen.tsx:67-70`), pilote le seuil 30 j des nudges tests. Vérification : le « il y a 0 j » vitrine ne s'affiche jamais (gardé par > 30 j) — reste un off-by-one au seuil et une violation de la convention n° 9.
- **P2-9 · Paramètres de route morts.** ⊙ `initialPlaylist` envoyé vers Tests par 2 écrans (`ProfileScreen.tsx:521`, `CycleModalScreen.tsx:407`) — TestsScreen ne lit **aucun** param (zéro `useRoute`). `mode: 'select'|'manage'` déclaré et envoyé 3 fois, jamais lu (la vue est choisie par le store).
- **P2-10 · Socle visuel (règle d'or n° 13) violé par 4 écrans du périmètre.** `SafeAreaView` direct dans `ProfileScreen.tsx:6,297`, `LegalNoticeScreen.tsx:13`, `PrivacyPolicyScreen.tsx:13` ; `CycleModalScreen.tsx:670-671` fait `edges=["bottom"]` + `paddingTop: insets.top` à la main. Styles morts (`styles.safeArea` de SettingsScreen:749, etc.).
- **P2-11 · Doublons d'affichage.** ⊙ Les 3 badges du héro Réglages recopient les switches du même écran (`SettingsScreen.tsx:363-376`) ; ⊙ « Historique » affiché deux fois à l'ouverture (header natif `RootNavigator.tsx:237` + `SectionHeader` `SessionHistoryScreen.tsx:98`) ; mini-historique du Profil (`:186-202,681-741`) refait filtre+tri+titre avec une résolution différente de SessionHistoryScreen ; CycleModal re-affiche cycle/dots/reco/tests déjà montrés par la section Programme.
- **P2-12 · Écarts légaux à trancher (hors refonte UI, dans le périmètre Settings).** La politique ne mentionne pas Sentry alors que `monitoring.ts:18-19` envoie l'uid ; « suppression 2 ans après la dernière connexion » (`legalContent.ts:73`) sans mécanisme repérable ; le toast de suppression « Toutes tes données ont été effacées » (`DeleteAccountScreen.tsx:167`) excède la purge réelle (Amplitude/Sentry hors périmètre, `clubs/{clubId}` jamais effacé — annoncé à l'écran au propriétaire, pas dans la politique).
- **P2-13 · Champs de setup semi-morts.** `hasClubTrainings` écrit et prérempli mais lu par personne ; `gymEquipment`/`homeEquipment` plus éditables nulle part mais toujours envoyés au backend ; `matchDay` singulier écrit en double avec `matchDays` (compat sans date de fin). `ProfileSetupScreen.tsx:440-448`. Message du repli code club qui pointe « Profil → Mon club » alors que la carte vit dans Réglages (`attachClub.ts:43`).
- **P2-14 · Reset et bornes.** `resetSettings` remet le thème clair sans le reload que le changement manuel juge nécessaire (UI incohérente jusqu'au redémarrage) ; chips Objectif hebdo 1–4 dans Settings vs `OBJECTIF_HEBDO_MAX = 6` accepté par le domaine — un 5 ou 6 venu du setup est inreprésentable dans l'éditeur.
- **P2-15 · Petites malhonnêtetés des tests.** La BatteryCard lit un état de formulaire éphémère : après sauvegarde, tout réaffiche « À faire / 0/3 renseignés » même si la batterie date d'une heure ; « Moy. » calculée sur jusqu'à 30 entrées all-time sans mention de fenêtre (un relevé de 6 mois pèse autant qu'hier).

---

## 5. Ce qui est sain (vérifié aussi — à préserver dans la refonte)

Les chasseurs ont blanchi 29 pistes ; l'essentiel :

- **L'objectif hebdo est proprement recâblé** : `services/objectifHebdo.ts` unique écrivain du champ canonique, Settings lit/écrit via `resoudreObjectifHebdo`/`enregistrerObjectifHebdo`, l'ancien `weeklyGoal` n'est plus qu'un repli documenté, un test source verrouille.
- **Réglages réellement branchés** : Notifications + Rappel séance (pour ce qu'ils prétendent), Vibrations (via useHaptics), Thème (2 palettes complètes), Semaine Lun/Dim, Feedback auto, Charges externes auto (coupe vraiment l'auto-ajout).
- **Progression Home ↔ page Progression : vraiment le même ViewModel** ; compteur hebdo canonique partout **sauf** ProfileScreen (P1-7) ; avancement de cycle : source unique, seule la présentation diverge (P1-11).
- **« Mon rythme » est exemplaire** : « À définir » quand c'est null (jamais un zéro), source temps réel, tap vers le setup — c'est le pattern à généraliser.
- **SessionHistoryScreen** : dates saines (toDateKey partout), aucun agrégat divergent. **TestsScreen** : pas de valeur d'amorçage, sections masquées à vide, dates locales.
- **DeleteAccountScreen tient ses promesses côté client** (tests terrain purgés, conséquences dérivées du serveur, avertissement propriétaire honnête) ; **adresse légale complète** ; la case RGPD d'inscription promise existe réellement.
- **La carte Club des Réglages n'est pas un reste du mode coach** : le cadre club est réellement lu par la génération (`aiContext.ts:209-229`).
- **Aucun reste coach dans ProfileScreen** ; « Club / sem » et le calendrier sont des contraintes déclarées côté joueur, légitimes.

---

## 6. Limites de la mesure

- Hauteurs **estimées depuis les styles**, largeur 390 pt, police ×1,0 — pas un rendu réel. Les largeurs 320/375 et le texte agrandi (les 3 tailles de la recette téléphone) donneront des hauteurs supérieures, surtout sur le héro et les cartes à texte backend.
- L'audit est statique (lecture) : les états conditionnels (pathway actif, carte tests, branches vides) sont documentés mais pas exhaustivement combinés.
- Périmètre : sous-arbre de l'onglet Profil + les deux écrans frontières cités quand un défaut les traverse (SessionHub pour P1-11/P2-6, Home comme référence). Le backend n'a pas été audité.

## 7. Traçabilité

- Workflow 1 (`wf_068533dc-c16`) : 26 agents — 5 inventaires, 3 chasses (42 accusations), 18 vérifications adversariales.
- Workflow 2 (`wf_0aaa3a10-e0a`) : 17 vérifications adversariales sur les accusations restantes (dédupliquées).
- Contre-vérifications orchestrateur (⊙) : graphe intensité `?? 0` + Moy diluée ; params de route morts ; badges héro Réglages ; titre Historique ×2.
- Journaux : dossiers `subagents/workflows/wf_*/journal.jsonl` de la session.
