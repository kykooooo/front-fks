# AUDIT_BOUCLE — État de l'existant (25/07/2026)

Cartographie établie par deux agents d'exploration (front worktree `silly-kirch-9ea0cf` base main `724c062` ; backend `feat/catalog-v2-editorial` `ebe340e`).

## Ce qui existe déjà

### Prescription
- La séance générée (`fks.next_session.v2`) est validée (Zod `sessionV2Schema`), transformée (`v2ToLocalSession`) et **persistée intégralement** : le JSON `aiV2` complet accompagne la séance dans `users/{uid}/plannedSessions/{id}` (champ `ai`) puis dans `users/{uid}/sessions/{id}` (champ `aiV2`) à la complétion. → Le snapshot de prescription existe matériellement ; il manque l'empreinte (hash), le lien formel avec l'exécution, et l'extraction structurée prescrit-par-exercice.
- Chaque item porte un `exercise_id` stable (banque front `EXERCISE_BY_ID`, 400 entrées ; exceptions non stables : items `warmup_*` et placeholders).
- `rpe_target`, `duration_min`, `session_index` (0-11), phase de volume, contexte match : tous présents dans `aiV2` + contexte.

### Exécution en séance (SessionLiveScreen, 1552 l.)
- Marquage **par série** (`checkedSets`), binaire fait/pas-fait. Timers complets (chrono, repos auto, circuits), reprise après crash (`fks_live_session`, 4 h), protection sortie.
- **Manque** : aucun statut Adapté/Sauté, aucune raison d'écart, aucune saisie de valeurs réelles, aucun remplacement d'exercice.
- **Trou majeur** : à la fin, `completedItems/totalItems` partent dans les params de navigation vers SessionSummary et **ne sont jamais persistés**. Le réalisé meurt à l'écran.

### Feedback (FeedbackScreen + useFeedbackSave)
- Capture : RPE 1-10, durée réelle (min), fatigue 1-5, douleur 0-5, récupération 1-5, blessure structurée (`InjuryRecord`). Pas de commentaire libre dans l'UI (le champ `comment` existe dans le type).
- Persistance robuste : `applyFeedback` (orchestrateur) → ATL/CTL/TSB, avancement microcycle idempotent, `persistCompletedSession` retry×3, `markPlannedSessionCompleted` (setDoc merge, idempotent). Queue offline chiffrée (`offlineQueue.ts`, handler `feedback` seul branché).
- Obligation de feedback : `usePrimaryCta` alerte si séance en attente (fenêtre J-2..J+1) — c'est un Alert, pas un blocage dur.
- Double-soumission : garde `isSaving` (state React, non synchrone) + bouton disabled + garde aval `session.completed`. **Pas de ref synchrone ni de clé d'idempotence.**

### Boucle d'ajustement existante (backend, à ne pas dupliquer)
- Écart RPE réel vs cible (`recent[].rpe` vs `ai.rpe_target`), **≥3 deltas** : moyenne ≥ +2 → cap `easy` + durée ×0.9 ; ≤ −2 → durée ×1.05 (`fksOrchestrator.ts:328-380`).
- Douleur `feedback.pain ≥ 6` (échelle 0-10 attendue) ×3 → recovery-only. ⚠️ Le front envoie une douleur 0-5 avec `pain_scale:"0-10"` déclaré — écart de contrat documenté (audit contrat 17/07).
- Caps : fatigue (TSB tiers), âge, match J-2..J+1, club, blessure (`injury_max_severity`), durée dispo. Tous pilotables par le contexte envoyé.
- **Aucune détection de coupure** : un joueur revenant de 3 mois avec metrics=0 → tsb=0 → cap `moderate`, aucun traitement reprise. Le mode reprise est purement déclaratif (`goal=offseason/fondation`).
- Mémoire anti-répétition **aveugle en prod** (le front n'envoie ni `blocks` ni `exercise_id` dans `recent_fks_sessions`) ; rotation déterministe en remplacement.

### Progression (ProgressScreen, 1108 l.)
- Hero TSB football-friendly, 6 milestones, comparaison tests terrain, calendrier mensuel, stats du mois. **Rien** sur : complétion, RPE cible vs ressenti, décision d'ajustement, prochaine étape de cycle.

### Infra transverse
- Stores : 6 stores Zustand (`state/stores/`), `trainingStore.ts` n'existe plus (CLAUDE.md périmé sur ce point). Sessions cap 200.
- Firestore rules : `users/{uid}/**` strictement owner-only (sessions + plannedSessions matchés explicitement) ; toute **nouvelle sous-collection nécessiterait un ajout de rules** → on privilégie l'embed dans les documents existants.
- Flags : `config/devFlags.ts` uniquement ; **aucun mécanisme FEATURES ni remote config**. Seul canal distant : le doc `users/{uid}`.
- Analytics : Amplitude `trackEvent` (no-op silencieux si clé absente) ; **aucun événement sur le déroulé de séance**.
- Tests : jest-expo ; **piège confirmé** : `testPathIgnorePatterns` exclut `/.claude/worktrees/` → depuis ce worktree, `npx jest` liste 0 test. Contournement obligatoire pour valider les lots.

## Ce qui manque (à construire)

1. Empreinte + extraction structurée de la prescription au lancement de séance.
2. Statut par exercice (fait/adapté/sauté/remplacé) + raisons + valeurs réelles optionnelles + action « tout comme prévu ».
3. Système de remplacement déterministe (registre de correspondances sur ids stables).
4. Persistance du réalisé (local + Firestore, embed dans le doc session).
5. Feedback enrichi (complétion auto, compteurs, raisons) + idempotence dure.
6. Signaux de suivi + moteur de règles déterministe versionné + explications FR.
7. Modes collecte / shadow / application (application OFF par défaut, pilotable via `users/{uid}`).
8. Détection de coupure + mode reprise (inexistant partout).
9. Vue progression « où j'en suis / est-ce que je progresse / pourquoi » .
10. Observabilité pilote (événements Amplitude sur tout le parcours).

## Fichiers qui devront être touchés (front uniquement)

- **Nouveaux modules** (zéro risque) : `domain/tracking/**`, `state/stores/useExecutionStore.ts`, `config/trackingConfig.ts`, tests associés.
- **Écrans (hors zone 8,5)** : `SessionLiveScreen`, `SessionSummaryScreen`, `screens/feedback/**`, `ProgressScreen`.
- **Extensions prudentes** : `domain/types.ts` (champs optionnels sur `SessionFeedback`/`Session`), `state/stores/persistHelpers.ts` (payload Firestore), `state/orchestrators/applyFeedback.ts` (attache exécution + décision), `repositories/sessionsRepo.ts` (schéma tolérant), `services/analytics.ts` (rien à changer, ajout d'appels).
- **Point d'intégration génération (minimal, documenté)** : un seul hook additif dans `services/aiContext.ts` pour le mode Application (OFF) — voir COHABITATION_AGENT_85.md.

## Fichiers protégés

Voir COHABITATION_AGENT_85.md : tout le backend (91 fichiers `feat/vague-85`) + prudence maximale sur `screens/newSession/**`.
