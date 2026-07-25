# ARCHITECTURE_BOUCLE — Boucle de suivi joueur (25/07/2026)

## Principe directeur

**100 % front + Firestore.** Le backend est stateless côté joueur et intégralement en chantier (vague 8,5) : la boucle vit dans l'app. L'influence sur la prochaine séance passe par le contexte de génération que le moteur accepte déjà (leviers documentés dans l'audit backend), derrière le mode Application (OFF au pilote).

## Vue d'ensemble

```
Génération (existant)                 SessionLive (Lot 2)                Feedback (Lot 4)
  v2 + aiV2 persistés    ──lancé──▶  snapshot prescription figé   ──▶   feedback enrichi auto
                                      capture fait/adapté/sauté          (complétion, compteurs, raisons)
                                      remplacements (Lot 3)                      │
                                            │                                    ▼
                                            ▼                          applyFeedback (existant, étendu)
                                     useExecutionStore (Lot 1)         + execution attachée au doc session
                                            │                                    │
                                            ▼                                    ▼
                                   Firestore users/{uid}/sessions/{id}.execution + .tracking
                                            │
                              Signaux + moteur de règles (Lot 5) ── shadow decision stockée + expliquée
                                            │
                       ProgressScreen (Lot 6) ◀── explication FR ──▶ [mode Application OFF : hook aiContext]
```

## Modules (tous nouveaux sauf mention)

### `domain/tracking/` — cœur pur, sans dépendance UI ni Firebase
- `types.ts` — tous les types de la boucle (voir MODELE_DONNEES.md). Source de vérité des contrats inter-lots.
- `prescription.ts` — `buildPrescribedSnapshot(v2, meta)` : extraction structurée + `fingerprintPrescription(v2)` (hash djb2 stable des champs prescriptifs, même famille que `hashContext` de `api.ts`).
- `execution.ts` — helpers purs : init d'une exécution depuis un snapshot, transitions de statut d'item, calcul `completionPct` et compteurs, `summarizeExecution()`.
- `signals.ts` — `computeTrackingSignals(history: CompletedSessionLike[], nowISO): TrackingSignals` (pur, tolérant aux données absentes/historiques).
- `rulesEngine.ts` — `decideAdjustment(signals, config): TrackingDecision` déterministe, versionné (`RULES_VERSION`), premier-match-gagne, sécurité d'abord. AUCUN ML, AUCUN LLM.
- `explain.ts` — `buildDecisionExplanation(decision, signals): string` FR, construite uniquement depuis les signaux réels ; si données insuffisantes, le dit.
- `resumption.ts` — `detectTrainingGap(history, nowISO, config)` + recommandation reprise/fondations.
- `apply.ts` — `applyDecisionToContext(context, decision, config): FKS_AiContext` : mappe une décision vers les leviers backend existants (deload, durée dispo, pains déjà gérés, préférence de variantes via equipment). **Pur, testé, appelé seulement si mode Application ON.**
- `config.ts` — `TRACKING_CONFIG` : tous les seuils, documentés, aucune valeur magique ailleurs.
- `modes.ts` — `resolveTrackingModes(userDoc?): {collect, shadow, apply}` ; défauts `{collect: true, shadow: true, apply: false}` ; overrides lus depuis `users/{uid}.trackingConfig` (seul canal remote existant → contrôle progressif sans redéploiement lourd, un OTA suffit pour changer les défauts).
- `replacements/` — voir ci-dessous.

### `domain/tracking/replacements/` — remplacement d'exercice (Lot 3)
- `registry.ts` — registre curé `REPLACEMENT_REGISTRY: Record<exerciseId, ReplacementEntry[]>` sur les ids stables de `EXERCISE_BY_ID`. Séparé du catalogue (zone 8,5) : ne modifie AUCUNE définition d'exercice.
- `select.ts` — `selectReplacement(request): ReplacementProposal | null` déterministe : registre d'abord, sinon fallback règle (même `focus` + même classe modality + intensité ≤ + matériel dispo + tags compatibles douleur/âge). Max 2 propositions par item (pas de boucle). `null` honnête si rien de valable.
- `contract.ts` — contrat de qualité : fonctions de validation (alternative ≠ même matériel manquant, qualité principale conservée, âge, douleur, durée) + test d'intégrité du registre (tous les ids existent dans la banque).

### État & persistance
- `state/stores/useExecutionStore.ts` (Lot 1) — store Zustand persisté (`fks-execution-v1`) : exécution en cours (une seule), historique local léger (cap 50), préférences durables de remplacement (`replacementPreferences`), dernière décision shadow. Survit au crash (même philosophie que `fks_live_session`).
- **Firestore — aucun changement de rules nécessaire** : tout est embeddé dans des documents déjà owner-only :
  - `users/{uid}/sessions/{id}.execution` (réalisé) et `.tracking` (décision shadow) — ajoutés au payload par `buildCompletedSessionFirestorePayload` (extension additive).
  - `users/{uid}.lastTrackingDecision` (merge) — pour affichage Progression multi-appareil.
  - `plannedSessions` inchangé (le `ai` embarqué EST le snapshot de prescription côté serveur).
- Schémas de lecture (`repositories/sessionsRepo.ts`, `schemas/firestoreSchemas.ts`) : champs **optionnels + passthrough** → les anciennes séances restent lisibles, statut `unknown` propre.

### Écrans (extensions)
- `SessionLiveScreen` (Lot 2) : au mount, si mode collecte → fige le snapshot + initialise l'exécution ; statut par exercice (fait implicite via séries / Adapté / Sauté), action « Je ne peux pas faire cet exercice » → raison → proposition de remplacement ; à la fin, action « Tout s'est passé comme prévu » (validation en 1 geste) ; l'exécution part dans le store, plus seulement dans les params de nav.
- `screens/feedback/**` (Lot 4) : résumé d'écart auto (« Séance réalisée à 88 % »…), statut terminée/partielle/abandonnée calculé, compteurs, raisons ; garde d'idempotence dure (ref synchrone + clé = sessionId) ; enrichissement de `SessionFeedback` (champs optionnels).
- `SessionSummaryScreen` (Lot 2 ou 4) : affiche le réalisé réel (depuis le store, plus les params).
- `ProgressScreen` (Lot 6) : section « Ton suivi » — phase, séance N/12, complétion, RPE cible vs ressenti, dernière décision + pourquoi, prochaine étape.

### Orchestration
- `state/orchestrators/applyFeedback.ts` (extension additive, Lot 4/5) : après le flux existant — attache `execution` au doc session, calcule la décision shadow (si mode shadow), la stocke (session + `users/{uid}.lastTrackingDecision` + store), track analytics. Jamais bloquant pour le flux existant (try/catch, la charge ATL/CTL/TSB reste prioritaire).
- `services/aiContext.ts` (POINT D'INTÉGRATION UNIQUE, Lot 5) : à la toute fin de `buildAIPromptContext`, un seul appel `maybeApplyTrackingAdjustments(context)` — pass-through si mode Application OFF (défaut). Documenté dans COHABITATION_AGENT_85.md.

### Observabilité (Lot 6)
Événements Amplitude (via `trackEvent` existant, jamais de données inter-joueurs) :
`live_session_started`, `live_exercise_marked` (status, reason?), `live_replacement_proposed/accepted/refused/none_available`, `live_session_finished` (completionPct, counts), `feedback_enriched_submitted`, `tracking_decision_shadow` (decision, rulesVersion), `resumption_detected`.

## Les trois modes

| Mode | Défaut pilote | Effet |
|---|---|---|
| Collecte | **ON** | snapshot + exécution + feedback enrichi enregistrés |
| Shadow | **ON** | décision calculée, stockée, consultable (Progression) — n'influence RIEN |
| Application | **OFF** | `applyDecisionToContext` branché dans `aiContext` ; activable par `users/{uid}.trackingConfig.apply = true` (par joueur, sans déploiement) |

Code + tests du mode Application livrés complets même s'il reste OFF.

## Séquencement des lots

1. **Lot 1** — socle : `domain/tracking/{types,prescription,execution,config,modes}.ts` + `useExecutionStore` + tests. (bloquant pour tout)
2. **Lot 3 ∥ Lot 5** — remplacements ∥ signaux+règles+explications+reprise+apply (purs, répertoires disjoints).
3. **Lot 2 ∥ Lot 4 ∥ Lot 6** — écrans (Live ∥ Feedback ∥ Progression+analytics).
4. **Lot 7** — validation complète (tests, typecheck, lint, parcours manuel).

## Compatibilité / migration
- Aucune migration de données : uniquement des champs optionnels nouveaux. Anciennes séances → `execution` absent → signaux « données manquantes » → décision `standard`.
- Pas de fabrication d'historique. Statut `unknown` explicite dans les types.
- Backend sans nouveaux champs : l'app n'attend RIEN de nouveau du backend (la boucle est front-only).
- Piège jest worktree : les lots de tests se lancent avec `npx jest --config` ad hoc (config clonée sans `testPathIgnorePatterns` worktree) — documenté dans TESTS_BOUCLE.md.
