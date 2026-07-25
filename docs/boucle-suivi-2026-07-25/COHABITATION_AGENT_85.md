# Cohabitation avec l'agent « Qualité 8,5 » — état au 25/07/2026

## Où travaille chaque agent

| Chantier | Projet | Espace de travail | Branche | Tip |
|---|---|---|---|---|
| Qualité 8,5 (autre agent) | Backend `C:\Users\Gamer\fks` | worktree `C:\Users\Gamer\fks-worktrees\readiness3` | `feat/vague-85` | `2eac00e` (68 commits depuis la base `ebe340e`) |
| Qualité 8,5 (autre agent) | Front `C:\Users\Gamer\front-fks` | worktree `.claude/worktrees/fks-qualite-vague-85-cecba4` | `claude/fks-qualite-vague-85-cecba4` | `724c062` (= main, **aucun diff pour l'instant**) |
| Boucle de suivi joueur (ce chantier) | Front | worktree `.claude/worktrees/silly-kirch-9ea0cf` | `claude/player-tracking-loop-559906` | base `724c062` (= main) |

Les deux chantiers sont isolés par worktree + branche : **aucun fichier partagé sur disque**. Le risque de collision est un risque de **merge futur**, pas d'écrasement immédiat.

## Fichiers protégés (touchés par feat/vague-85 côté backend — 91 fichiers)

Zones intégralement considérées comme appartenant à l'agent 8,5 (base `ebe340e..2eac00e`) :

- `src/fksAgent.ts`, `src/fksOrchestrator.ts`, `src/fksWorkflow.ts`, `src/fksPost.ts`, `src/fksFilters.ts`, `src/fksConfig.ts`, `src/fksPlayerContext.ts`, `src/index.ts`
- `src/catalog/**` (données, schéma, rôles, safety, éditorial, migration)
- `src/exerciseBank.ts`, `src/forceExerciseBank.ts`, `src/foundationExerciseBank.ts`
- `src/agents/agentB.*`
- `src/shared/**` (athleticFloor, sessionDuration, protectedContexts, indivExplain, calibExplain)
- `src/playlists/**`
- `src/dev/generation/**`, `src/dev/generationMassTest.ts`, `src/dev/prepaReview/**`
- `src/__tests__/**` (fixtures readiness/jury comprises)
- `render.yaml`, `.env.example`, `docs/ai-engine-architecture.md`

**Décision de cohabitation : ce chantier ne modifie AUCUN fichier backend.** La boucle de suivi est construite 100 % côté front + Firestore (voir ARCHITECTURE_BOUCLE.md). Les leviers backend nécessaires (influence de la prochaine séance) passent par le **payload de contexte déjà accepté** par le moteur — zéro nouveau code backend requis pour le pilote.

## Côté front

- La branche 8,5 front n'a encore aucun diff vs main. Zones que la mission lui réserve potentiellement : `screens/newSession/**` (pipeline génération), textes/coaching_tips, readiness.
- Ce chantier évite les modifications lourdes dans `screens/newSession/**`. Si un point d'intégration y devient indispensable (ex. brancher la décision shadow dans le contexte de génération), il sera **additif, minimal et documenté ici**.

## Points d'intégration en attente (à revalider après la vague 8,5)

1. **`services/aiContext.ts` / `screens/newSession/api.ts`** — si le mode Application (OFF par défaut) doit un jour moduler le contexte envoyé au backend, le branchement se fera ici. Pour l'instant : shadow only, aucune modification de la génération.
2. **Registre de remplacements** — construit sur les identifiants stables d'exercices du front. La vague 8,5 modifie le catalogue backend : après son merge, revalider que les ids référencés existent toujours (script de contrôle prévu dans les tests du registre).
3. **`recovery_tips` / textes de séance** — l'agent 8,5 retravaille les textes ; la boucle n'en dépend que par affichage, aucun couplage.

## Règles appliquées par ce chantier

- Aucun `reset --hard`, `clean`, `checkout --`, stash ou restauration sur un espace partagé.
- Aucun changement de branche dans un checkout partagé ; travail uniquement dans le worktree dédié `silly-kirch-9ea0cf`.
- Commits limités aux fichiers de ce chantier, vérifiés un à un avant chaque commit (`git status --porcelain` + `git diff --stat --cached`).
- Les fichiers non commités observés dans les checkouts principaux (lockfiles, briefings .docx, `outputs/`) sont laissés strictement intacts.
