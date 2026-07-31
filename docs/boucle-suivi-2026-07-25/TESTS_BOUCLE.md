# TESTS_BOUCLE — Couverture, exécution et résultats (25/07/2026)

## Comment lancer les tests depuis ce worktree (piège connu)

Le bloc jest de `package.json` exclut `/.claude/worktrees/` (`testPathIgnorePatterns`) : depuis ce worktree, `npx jest` liste **0 test**. Contournement officiel du chantier :

```bash
npx jest --config jest.worktree.config.js --forceExit
```

(`jest.worktree.config.js` à la racine reprend le preset jest-expo sans l'exclusion worktree ; commité sur la branche.)

## Résultats finaux (état commité `e60388a`)

| Vérification | Commande | Résultat |
|---|---|---|
| Suite complète | `npx jest --config jest.worktree.config.js --forceExit` | **59 suites / 843 tests verts** (+1 skip préexistant `injuryMapping.parity`, backend absent en env test) |
| Types | `npx tsc --noEmit` | **0 erreur** |
| Lint | `npx eslint` sur les fichiers touchés | **aucune nouvelle erreur** (baseline vérifiée par diff stash ; 267 erreurs préexistantes repo-wide, hors chantier) |
| Build app | `npx expo export --platform web` | **exit 0**, bundle 7 Mo généré (tout le code du chantier bundlé) |
| Build backend | — | **sans objet** : zéro modification backend (chantier 8,5 seul actif côté `C:\Users\Gamer\fks`) |
| Boot web (smoke) | `serve` du bundle + navigation | **KO préexistant** : `getReactNativePersistence` indisponible sur firebase-web (`services/firebase.ts`, INTACT sur cette branche — `git log main..HEAD` = 0). C'est la limitation connue que la branche non mergée `claude/expo-web-boot-bfa533` corrige. Pas une régression du chantier. |
| Parcours manuel complet | — | **À faire en passe téléphone avec Kyllian** (Expo Go / TestFlight) — le web ne boote pas sans la branche expo-web-boot, l'auth exige de toute façon une saisie humaine. Checklist proposée dans RELEASE_BOUCLE.md. |

## Couverture des scénarios exigés par la mission

| Scénario exigé | Test(s) qui le prouvent |
|---|---|
| Séance réalisée entièrement | `rulesEngine.test.ts` (continue_planned), `execution.test.ts` (pct 100, full) |
| Séance partielle par manque de temps | `rulesEngine.test.ts` (keep_despite_time, jamais reduce), `signals.test.ts` (timeConstrainedIncomplete) |
| Exercice adapté faute de matériel | `replacements.test.ts` (alternative poids du corps + prescription adaptée), `signals.test.ts` (1× = aucune influence) |
| Séance trop difficile | `rulesEngine.test.ts` (suggest_variant après ≥2), `replacements.test.ts` (régression easier) |
| RPE < cible sur plusieurs expositions | `rulesEngine.test.ts` (règle 10 : note de marge, jamais d'augmentation front) |
| RPE > cible | `rulesEngine.test.ts` (règle 7, variantes intensité/volume selon complétion) |
| Douleur signalée | `rulesEngine.test.ts` (block_increase_pain PRIORITAIRE), `replacements.test.ts` (painSafe seul, null honnête), `apply.test.ts` (pains jamais retirés) |
| Données manquantes | `signals.test.ts` + `rulesEngine.test.ts` (insufficient → standard ; feedback-only → standard SAUF douleur/coupure qui priment) |
| Données incohérentes | `signals.test.ts` (RPE 15, durée 500 min → inconsistent → standard) |
| Double soumission | `useFeedbackSave.test.tsx` (double-tap → 1 seul applyFeedback, ref synchrone) |
| Perte réseau et nouvelle tentative | `useFeedbackSave.test.tsx` + tests offlineQueue (dédup par sessionId, rejeu → null si completed) |
| Coupure prolongée | `resumption.test.ts` (15 j soft / 30 j hard), `rulesEngine.test.ts` (règles 2-3) |
| Nouvel utilisateur après coupure | `resumption.test.ts` (selfReportedGapDays, source self_reported ; sans info → unknown, jamais de fausse donnée) |
| Shadow sans modification de la prescription | `applyFeedback.test.ts` (charge/completed/metrics intacts avec ET sans tracking, deltas ATL/CTL identiques) |
| Application désactivée par configuration | `aiContext.test.ts` (pass-through prouvé apply=false ; ajustement réel apply=true) |
| Caps âge/fatigue/match | `replacements.test.ts` (minAge, matchSoon/highFatigue : jamais similar+high), `apply.test.ts` (invariant sur 1650 combinaisons) — les caps backend restent la référence, non touchés |
| Pas d'augmentation après douleur | `apply.test.ts` (neverIncreaseBeyondPlan paramétrique), `rulesEngine.test.ts` (règle 1 avant tout) |
| Propriété et sécurité des données joueur | `resetUser.test.ts` (non-fuite compte A→B du store exécution) ; rules Firestore INCHANGÉES (tout sous `users/{uid}` owner-only, testées par la suite firestore-tests existante) |

## Scénarios remplacement (complément de mission)

Tous couverts dans `replacements.test.ts` + `replacements-contract.test.ts` (86 tests) : matériel, place, solo, trop difficile, douleur, aucune alternative → null honnête, exercice principal (qualité centrale conservée, prouvé par identité des résultats), adaptation séries/reps/durée (isométries en secondes), anti-boucle (2 max + excludeIds), déterminisme, intégrité registre 0 erreur, double remplacement même item (exclusion du remplacement courant), historique sans alternative (compat).

## Chiffres du registre de remplacement

- **45 exercices importants** identifiés ; **43 couverts** par ≥1 alternative validée (60 entrées, 43 clés).
- **2 sans alternative, assumés** : `sprint_flying_30m` (rien ne préserve la vitesse maximale lancée) et `plyo_depth_jumps` (qualité réactive depth-jump non substituable) — le système l'avoue et propose de passer.
- Contrôles automatiques : ids 100 % réels, jamais « similar » pour un lourd→léger, notes d'improvisation pour les drills à plots, zéro medball (règle zéro-ballon), pools de fallback curés par famille fine.

## Dette de test connue (préexistante, hors chantier)

- `services/analytics.ts` (Amplitude) crashe sous jest à l'import (copie imbriquée d'AsyncStorage non mockée par `jest.setup.js`) — contourné par `jest.mock` local dans les tests du chantier ; un mock global dans `jest.setup.js` serait plus propre (à faire hors chantier).
- 267 erreurs eslint préexistantes repo-wide (aucune dans les fichiers du chantier).
