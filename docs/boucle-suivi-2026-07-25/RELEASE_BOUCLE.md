# RELEASE_BOUCLE — Synthèse finale du chantier boucle de suivi joueur (25/07/2026)

Branche : `claude/player-tracking-loop-559906` (worktree `silly-kirch-9ea0cf`, base main `724c062`). **Poussée : non** (déploiement = décision Kyllian). Backend : **zéro modification**.

## Commits livrés

| Commit | Contenu |
|---|---|
| `06b3559` | Lot 1 — socle : types contractuels, snapshot+fingerprint de prescription, transitions d'exécution pures, config des seuils, modes, `useExecutionStore`, docs de conception |
| `a6fbfc9` | Lots 3+5 — registre de remplacements déterministe + moteur de règles shadow (corrigés post-revue adversariale : 1 P0 + 7 P1) |
| `e60388a` | Lots 2+4+6 — capture en séance, feedback enrichi idempotent, décision shadow, section « Ton suivi », question reprise, hook aiContext gated (corrigés post-revue : 2 P1 + 6 P2) |
| (ce commit) | Livrables du compte rendu |

## Ce qui existait déjà (et a été réutilisé, pas recréé)

- La séance générée `aiV2` déjà persistée avec planned + completed (le snapshot serveur existait de fait).
- Feedback RPE/durée/fatigue/douleur/récup + blessure, orchestrateur `applyFeedback` (ATL/CTL/TSB, retry, idempotence aval), queue offline chiffrée, obligation de feedback (Alert `usePrimaryCta`).
- Boucle RPE backend (±2 sur ≥3 séances) et garde-fou douleur récurrente — le moteur front s'y aligne au lieu de les dupliquer.
- Ids d'exercices stables (`EXERCISE_BY_ID`, 400 entrées), rules Firestore owner-only, analytics Amplitude.

## Ce qui a été ajouté

1. **Photographie de la prescription** figée au lancement (empreinte djb2, phase, contexte match, items ordonnés) — l'historique ne peut plus être réécrit par une évolution du catalogue.
2. **Capture du réalisé** : statuts Fait/Adapté/Sauté/Remplacé par exercice, raisons, valeurs réelles optionnelles typées, « Tout s'est passé comme prévu » en 1 geste, crash-safe.
3. **Remplacement d'exercice** déterministe, sans LLM : 43/45 exercices importants couverts, 2 propositions max, douleur = painSafe strict ou aveu honnête, tout enregistré (prescrit vs réalisé).
4. **Feedback enrichi** auto (complétion %, statut, compteurs, raisons) + soumission idempotente dure.
5. **Signaux + moteur de règles** `tracking-rules/1.0.0` : 11 règles premier-match-gagne (douleur > coupure > données insuffisantes > reste), déterministe, pur, versionné.
6. **Explications joueur** en français simple, construites uniquement depuis les signaux réels.
7. **Trois modes** : Collecte ON / Shadow ON / Application OFF (code + tests complets, activable par joueur via `users/{uid}.trackingConfig.apply` sans redéploiement).
8. **Reprise après coupure** : détection 14 j / 28 j (config), question optionnelle au setup pour les nouveaux, jamais de bascule de cycle silencieuse.
9. **Vue « Ton suivi »** dans Progression (phase, N/12, complétion, RPE prévu vs ressenti, évolution charges même-exercice, dernière décision expliquée, prochaine étape).
10. **Observabilité pilote** : événements Amplitude sur tout le parcours (démarrage, marquages, remplacements, fin, décision shadow, reprise) — jamais de données inter-joueurs.

## Fichiers modifiés par projet

- **Backend `C:\Users\Gamer\fks` : AUCUN.**
- **Front** : 3 commits, ~75 fichiers (dont ~40 nouveaux). Modules nouveaux : `domain/tracking/**` (14 fichiers + 12 suites de tests), `state/stores/useExecutionStore.ts`, `components/session/{ItemActionsSheet,ReplacementSheet,liveTrackingHelpers}`, `components/progress/TonSuiviSection`, `hooks/{useTrackingProgress,useSelfReportedGapDays,trackingProgress/}`, `screens/feedback/{deviationReasonLabels,components/ExecutionSummaryCard}`, `state/orchestrators/trackingShadow.ts`. Extensions prudentes : SessionLive/SessionSummary/Feedback/Progress/ProfileSetup, `applyFeedback`, `resetUser`, `persistHelpers`, `sessionsRepo`/`firestoreSchemas` (tolérance), `offlineQueue` (+`hasQueuedAction`), `domain/types.ts` (optionnels), `services/aiContext.ts` (hook unique gated).

## Migrations

**Aucune.** Champs optionnels uniquement ; anciens docs lisibles tels quels (statut `unknown` propre, `dataQuality: insufficient` → décision standard) ; aucune donnée rétroactive fabriquée ; backend sans nouveaux champs = déjà le mode de fonctionnement (boucle 100 % front+Firestore). Rules Firestore **inchangées** (tout sous `users/{uid}`).

## Décisions possibles du moteur

`continue_planned`, `hold_dose`, `reduce_volume_light`, `reduce_intensity_light`, `suggest_variant`, `prefer_replacement`, `resume_mode` (soft/hard), `keep_despite_time`, `block_increase_pain`, `standard_insufficient_data` — chacune avec explication FR et trace (`rulesVersion`, digest de signaux). Détail : REGLES_AJUSTEMENT.md.

## État des trois modes au lancement pilote

| Mode | État | Contrôle |
|---|---|---|
| Collecte | **ON** | défaut code (OTA pour changer) |
| Shadow | **ON** | défaut code (OTA pour changer) |
| Application | **OFF** | activable PAR JOUEUR via `users/{uid}.trackingConfig.apply=true`, sans déploiement |

## Résultats tests et builds

Voir TESTS_BOUCLE.md : **843 tests verts (59 suites), tsc 0 erreur, eslint 0 nouvelle erreur, `expo export web` exit 0**. Boot web KO pour cause **préexistante** (`getReactNativePersistence` firebase-web, `services/firebase.ts` intact — c'est ce que corrige la branche non mergée `expo-web-boot`).

## Parcours manuel

**Partiellement vérifié** : build + revues adversariales ligne à ligne + 843 tests. Le parcours tactile complet reste à faire en **passe téléphone avec Kyllian** (Expo Go/TestFlight) :
1. Générer une séance → la lancer → cocher normalement → Terminer → « Tout s'est passé comme prévu » → vérifier Summary (« réalisée à 100 % ») → feedback (carte résumé) → Progression (« Ton suivi » + décision).
2. Relancer une séance → « ⋯ » sur un exo de force → « Je ne peux pas » → matériel → vérifier la proposition + la carte remplacée → Terminer → vérifier « Original → Remplacement » au Summary.
3. Marquer une douleur au feedback → vérifier la décision « pas d'augmentation » dans Progression.
4. Double-taper « Valider » au feedback → une seule séance enregistrée.

## Cohabitation 8,5 — constat final

Zéro interférence : le worktree backend 8,5 (`fks-worktrees/readiness3`, tip `9d47fbc` en fin de chantier) et sa branche front (toujours 0 diff vs main) sont restés intacts ; aucun fichier backend touché ; aucun `reset/clean/checkout --/stash` sur un espace partagé ; chaque commit vérifié fichier par fichier. Détails et points de revalidation : COHABITATION_AGENT_85.md.

## Points d'intégration restants / à revalider après la vague 8,5

1. **Ids d'exercices** : si la vague 8,5 renomme/déprécie des ids côté catalogue backend, revalider le registre de remplacements (test d'intégrité automatique : `validateRegistryIntegrity` = 0 erreur requis).
2. **Merge** : `screens/newSession/**` n'a pas été touché → conflit improbable ; `services/aiContext.ts` porte le seul hook (10 lignes additives, documenté) → conflit trivialement résoluble.
3. **Option documentée non activée** : envoyer les `exercise_id` réalisés dans `recent_fks_sessions` rendrait la mémoire anti-répétition backend « voyante » — à décider après le merge 8,5.

## Risques restants (assumés, documentés)

- `users/{uid}.lastTrackingDecision` est écrit mais pas encore relu (graine multi-appareil/coach) — 1 write par feedback ; à brancher ou retirer plus tard.
- Kill-switch distant limité au mode `apply` ; couper collecte/shadow pour un joueur exige un OTA (suffisant au pilote, documenté dans `modes.ts`).
- `injuryDeclared` de la séance en cours non visible par la décision du même appel (la douleur passe déjà par `feedback.pain`) — limite documentée.
- 2 carve-outs registre (P2) : `str_leg_press→str_bulgarian_split` marqué similar (chaise = appui, pas charge) ; `str_inverted_row` sans note « sous une table solide ».
- Le moteur front et la boucle RPE backend convergent sur les mêmes seuils : en mode Application futur, surveiller le cumul (le front n'applique que des réductions bornées, jamais d'augmentation — invariant testé).

## Ce que FKS peut affirmer honnêtement

Chaque séance lancée est photographiée ; chaque séance réalisée est enregistrée avec ses écarts et leurs raisons ; le feedback est relié à l'exécution ; une décision déterministe, expliquée en français simple, est produite et consultable ; le joueur voit sa progression et le pourquoi de sa prochaine séance ; l'application automatique est prête mais volontairement éteinte jusqu'à validation sur les premières données réelles du pilote.
