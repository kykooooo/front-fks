---
name: sync-check
description: Scan read-only des 7 points de couplage critiques entre frontend FKS et backend FKS pour détecter toute désynchronisation avant déploiement. À déclencher automatiquement quand l'utilisateur dit "vérifie la synchro", "tout est bien aligné front-back", "check cohérence", "sync OK ?", avant un /deployer, ou après avoir touché à exerciseBank / fksSchema / aiContext / microcycles / backendExerciseIds / shared/injuryMapping / shared/SAFETY_PHRASES / INJURY_IA_CHARTER. READ-ONLY — ne modifie JAMAIS le code.
---

# /sync-check — Vérification synchro front ↔ back

## Objectif
Ce skill scanne les **7 points de couplage critiques** entre ce repo frontend (`C:/Users/Gamer/front-fks/`) et le repo backend (`C:/Users/Gamer/fks/`), et sort un rapport clair : **OK** ou **DÉSYNC** avec ligne précise.

## Règle absolue
**READ-ONLY.** Ce skill ne modifie JAMAIS un fichier. Il ne fait que lire et comparer. Si une désync est trouvée, il propose un fix en texte, mais laisse l'utilisateur décider.

## Chemins des deux repos
- **Frontend** (ce repo) : `C:/Users/Gamer/front-fks/`
- **Backend** : `C:/Users/Gamer/fks/`

## Les 7 points à vérifier

### Point 1 — Schéma session v2 (Zod front vs Zod back)
**Fichiers** :
- Backend source : `C:/Users/Gamer/fks/src/fksSchema.ts` → `FksNextSessionSchema`
- Frontend miroir : `schemas/sessionSchema.ts` → `sessionV2Schema`
- Frontend type : `screens/newSession/types.ts` → `FKS_NextSessionV2`

**Méthode** :
1. Lire les deux schémas Zod et extraire la liste des champs top-level + champs dans `blocks[].items[]`.
2. Comparer : tout champ présent côté back mais absent côté front → **désync silencieuse** (le front drop la donnée via `.catch()`).
3. Vérifier que le type TS `FKS_NextSessionV2` contient bien ces champs en camelCase.

**Attendu** : ensembles identiques après normalisation snake_case ↔ camelCase.

### Point 2 — Banque d'exercices (272 exos)
**Fichiers** :
- Backend : `C:/Users/Gamer/fks/src/exerciseBank.ts` + `foundationExerciseBank.ts` + `forceExerciseBank.ts`
- Frontend : `engine/exerciseBank.ts`

**Méthode** :
1. Extraire tous les `id: "..."` côté backend (exerciseBank principal).
2. Extraire tous les `id: "..."` côté frontend (`engine/exerciseBank.ts`).
3. Diff : IDs uniquement back (→ frontend ne pourra jamais afficher proprement) + IDs uniquement front (→ code mort).
4. Pour chaque ID commun, vérifier que `name` et `modality` matchent.

**Attendu** : ensembles identiques ou diff justifié (ex : exos backend-only pour génération mais pas utilisés côté UI).

### Point 3 — `backendExerciseIds.ts` complet
**Fichier** : `engine/backendExerciseIds.ts`

**Méthode** :
1. Lire la liste `BACKEND_EXERCISE_IDS`.
2. Côté backend, chercher tous les IDs référencés dans `src/playlists/<cycle>/blockTemplates.<cycle>.ts` et `src/agents/agentA.*.ts` (few-shots).
3. Tout ID référencé côté back mais absent de `BACKEND_EXERCISE_IDS` → **le frontend ne l'envoie pas comme allowed** → le backend fallback ou drop.

**Attendu** : `BACKEND_EXERCISE_IDS` est un sur-ensemble des IDs utilisés par le backend.

### Point 4 — `aiContext.ts` vs attentes backend
**Fichiers** :
- Frontend : `services/aiContext.ts` → `FKS_AiContext`
- Backend : `C:/Users/Gamer/fks/src/fksOrchestrator.ts` + `src/fksWorkflow.ts` (lecture `ctx.profile`, `ctx.constraints`, `ctx.metrics`, `ctx.microcycle`, `ctx.recent_fks_sessions`)

**Méthode** :
1. Extraire du frontend tous les champs envoyés dans le payload (`prepareBackendContext` dans `screens/newSession/api.ts`).
2. Extraire du backend tous les accès `ctx.<champ>` et `context.<champ>`.
3. Tout champ lu côté back mais non envoyé côté front → **valeur `undefined`** → comportement potentiellement dégradé.

**Attendu** : tout champ lu côté back existe dans le payload front.

### Point 5 — Cycles et archetypes
**Fichiers** :
- Frontend : `domain/microcycles.ts` → liste des cycles (ex : `fondation`, `force`, `engine`, etc.)
- Backend : `C:/Users/Gamer/fks/src/playlists/<cycle>/archetypes.<cycle>.ts`

**Méthode** :
1. Lister les cycles exposés côté frontend (goals sélectionnables par joueur).
2. Vérifier que chaque cycle a un dossier `src/playlists/<cycle>/` côté back avec au moins 1 archetype.
3. Vérifier que chaque cycle a **12 sessions** dans sa playlist principale (`PLAYLIST_<CYCLE>_12`).

**Attendu** : 1-to-1 mapping, 12 sessions partout.

### Point 6 — `shared/injuryMapping.ts` (MVP blessures Jour 2)
**Fichiers** :
- Frontend : `shared/injuryMapping.ts`
- Backend : `C:/Users/Gamer/fks/src/shared/injuryMapping.ts`
- Associé back : `C:/Users/Gamer/fks/src/exerciseBank.ts` → `type Contraindication`

**Méthode** :
1. `diff -q` entre les deux fichiers : ils DOIVENT être byte-identiques.
2. Extraire les clés de `INJURY_AREA_TO_BACKEND_PAIN` et les valeurs de `BackendPainToken`.
3. Vérifier que chaque valeur de `BackendPainToken` existe dans le type `Contraindication` côté backend.
4. Vérifier côté front que `type InjuryArea` (`domain/types.ts`) contient bien les 10 clés déclarées.

**Attendu** :
- Fichiers identiques (0 diff).
- Chaque `BackendPainToken` figure dans `Contraindication`.
- Chaque clé `InjuryAreaFR` figure dans `InjuryArea` (`domain/types.ts`).

### Point 7 — `shared/SAFETY_PHRASES.ts` + champ `injury_adaptation_explanation` (MVP Jour 3)
**Fichiers** :
- Frontend : `shared/SAFETY_PHRASES.ts`, `schemas/sessionSchema.ts`, `screens/newSession/types.ts` (`FKS_NextSessionV2.injuryAdaptationExplanation`)
- Backend : `C:/Users/Gamer/fks/src/shared/SAFETY_PHRASES.ts`, `C:/Users/Gamer/fks/src/fksSchema.ts` (`injury_adaptation_explanation`), `C:/Users/Gamer/fks/src/agents/injuryPromptFragments.ts`
- Charte narrative : `C:/Users/Gamer/fks/INJURY_IA_CHARTER.md`

**Méthode** :
1. `diff -q shared/SAFETY_PHRASES.ts ↔ src/shared/SAFETY_PHRASES.ts` : byte-identiques.
2. Extraire les clés de l'objet `SAFETY_PHRASES` : doit contenir **5 phrases** : `GENERAL_DISCLAIMER`, `PAIN_SPIKE_ALERT`, `REST_VALIDATION`, `SESSION_FOOTER_WARNING`, `INJURY_PROGRESS_SUGGESTION`.
3. Vérifier que `injury_adaptation_explanation` existe côté back (`fksSchema.ts`) ET côté front (`sessionSchema.ts`) avec `max(200)`.
4. Vérifier que le type camelCase `FKS_NextSessionV2.injuryAdaptationExplanation` est présent côté front.
5. Vérifier que les 10 agents (`agentA.{foundation,force,engine,explosivite,rsa}.ts` + 5 Agent B) importent `AGENT_A_INJURY_SECTION` ou `AGENT_B_INJURY_SECTION` depuis `injuryPromptFragments.ts`.

**Attendu** :
- Fichiers `SAFETY_PHRASES.ts` identiques.
- 5 phrases présentes des deux côtés.
- Champ `injury_adaptation_explanation` dans les 2 schémas + type camelCase.
- 10 prompts agents enrichis de la section blessures.

## Format du rapport

Toujours sortir ce format markdown, même si tout est OK :

```markdown
# Rapport /sync-check — <date>

## 1. Schéma session v2
Statut : ✅ OK / ❌ DÉSYNC
Détails : ...

## 2. Banque exercices
Statut : ✅ OK / ❌ DÉSYNC
IDs uniquement back : [...]
IDs uniquement front : [...]

## 3. backendExerciseIds.ts
Statut : ✅ OK / ❌ DÉSYNC
IDs manquants dans BACKEND_EXERCISE_IDS : [...]

## 4. aiContext payload
Statut : ✅ OK / ❌ DÉSYNC
Champs lus back mais non envoyés : [...]

## 5. Cycles / archetypes
Statut : ✅ OK / ❌ DÉSYNC
Cycles front sans backend : [...]
Playlists ≠ 12 sessions : [...]

## 6. shared/injuryMapping.ts
Statut : ✅ OK / ❌ DÉSYNC
diff byte-identique : OUI / NON
BackendPainToken orphelins : [...]

## 7. shared/SAFETY_PHRASES.ts + injury_adaptation_explanation
Statut : ✅ OK / ❌ DÉSYNC
diff byte-identique SAFETY_PHRASES : OUI / NON
Phrases manquantes : [...]
injury_adaptation_explanation front : ✅ / ❌
injury_adaptation_explanation back : ✅ / ❌
Agents sans section blessures : [...]

## Verdict global
✅ Safe to deploy / ⚠️ Désync mineure / ❌ Ne pas déployer
```

## Commandes utiles
```bash
# Chercher tous les exercise_id côté back
grep -rn "exercise_id: \"" C:/Users/Gamer/fks/src/

# Lister IDs dans exerciseBank backend
grep -n "^  id:" C:/Users/Gamer/fks/src/exerciseBank.ts

# Lister IDs dans BACKEND_EXERCISE_IDS
cat C:/Users/Gamer/front-fks/engine/backendExerciseIds.ts
```

## Checklist de vérification finale
- [ ] Les 5 points ont été scannés
- [ ] Chaque désync trouvée est documentée avec **fichier + ligne**
- [ ] Aucun fichier n'a été modifié (read-only respecté)
- [ ] Verdict global explicite en fin de rapport
- [ ] Si désync → proposer un fix texte sans l'appliquer
