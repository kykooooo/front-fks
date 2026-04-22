---
name: debug-generation
description: Debug une génération de séance FKS qui est bizarre, a échoué, ou produit un résultat incohérent. Checklist fixe en 5 points (logs guardrails, payload contexte, diff schémas, cache AsyncStorage, top 3 hypothèses avec fichier). À déclencher automatiquement quand l'utilisateur dit "ma séance est bizarre", "la génération a échoué", "le backend renvoie n'importe quoi", "résultat incohérent", "pourquoi je reçois ça", "séance dégradée", "reset générique au lieu de ce que j'attendais".
---

# /debug-generation — Debug une génération qui déraille

## Objectif
Quand une génération de séance produit un résultat bizarre / échoue / affiche un reset générique au lieu du bon cycle, ce skill fournit une **checklist fixe en 5 points** pour isoler la cause rapidement.

## ⚠️ Ce repo est le FRONTEND
L'autre repo (`C:/Users/Gamer/fks/`) est le backend. Le debug est **systématiquement fullstack** : il faut regarder les deux côtés en parallèle.

## Checklist fixe — 5 points dans l'ordre

### 1. Logs `guardrails_applied` + `selection_debug` côté backend
**Pourquoi** : les guardrails sont la traçabilité des décisions du backend (cap fatigue, feedback reduce, volume phase, pipeline 2-agent utilisé).

**Comment** :
- Lancer backend local : `cd C:/Users/Gamer/fks && npm run dev`
- Générer la séance en question depuis l'app
- Regarder les logs terminal : chercher `[FKS][guardrails]` et `[FKS][selection_debug]`
- Dans la réponse backend (body JSON) : `v2.guardrails_applied[]` et `v2.selection_debug`

**Signaux à identifier** :
- `feedback:rpe_high_reduce` → le backend a réduit à cause du RPE moyen élevé
- `intensity:cap:easy_fatigue` → TSB trop bas, forcé easy
- `pipeline:2agent_<cycle>_v1` → 2-agent actif (si absent → legacy pipeline ou flag désactivé)
- `tier:max_blocks:N` → `maxBlocks` tier-aware (commit `dfe8465`)
- **Absence** de `pipeline:2agent_*` alors qu'on l'attend → flag `FKS_*_2AGENT` désactivé

### 2. Payload contexte envoyé au backend
**Pourquoi** : 50 % des bugs "séance bizarre" viennent d'un contexte malformé envoyé par le front.

**Comment** :
- Dans `screens/newSession/api.ts:183`, logger temporairement le payload juste avant le `fetch` :
  ```typescript
  console.log("[DEBUG] backend payload:", JSON.stringify(context, null, 2));
  ```
- Vérifier :
  - `context.profile.goal` est bien le cycle actif (ex: `"force"`) ?
  - `context.constraints.equipment` contient bien l'équipement sélectionné ?
  - `context.constraints.pains` est bien rempli si douleurs ?
  - `context.metrics.tsb` est cohérent avec l'état du joueur ?
  - `context.microcycle.session_index` est dans `[0, 11]` ?
  - `context.recent_fks_sessions` a bien les 8 dernières (pour feedback adjustments) ?

**Signaux** :
- `goal: undefined` → erreur `missing_goal` côté back
- `equipment: []` en gym → le back force `bodyweight`, pas ce qu'on veut
- `session_index: 15` (hors cycle) → bug côté front dans `useMicrocycleProgress`

### 3. Diff schémas Zod back/front
**Pourquoi** : un champ backend absent du schéma front est silencieusement drop → le composant UI reçoit `undefined`.

**Comment** :
- Lancer `/sync-check` → point 1 (schéma session v2)
- OU manuellement : comparer `C:/Users/Gamer/fks/src/fksSchema.ts` vs `schemas/sessionSchema.ts`
- Dans la console frontend, activer le log Zod : `screens/newSession/api.ts:213-214` le fait déjà en dev (`console.warn("[FKS] Session V2 validation failed:", ...)`)

**Signaux** :
- Le backend renvoie un champ, le composant UI ne l'affiche pas → schéma front drop
- Le frontend affiche un warning Zod mais la séance passe quand même → `.catch()` en action, champ drop

### 4. Cache AsyncStorage (`fks_session_cache_v1`)
**Pourquoi** : le frontend cache la dernière séance 5 min. Si on génère 2 fois avec le même contexte, on tombe sur le cache.

**Comment** :
- Vérifier `screens/newSession/api.ts:28-95` (logique cache)
- Le hash est basé sur `JSON.stringify(context)` sans `allowed_exercises`, `debug`, `debug_allow_all_exercises`
- Si on veut forcer une génération fraîche : vider le cache via `clearSessionCache()` ou réinitialiser l'app

**Signaux** :
- La séance ne change jamais malgré des modifs front → cache actif, nouveau contexte n'invalide pas le hash
- Modifier `context.metrics.tsb` de 1 change le hash → cache busted

### 5. Top 3 hypothèses — le fichier à ouvrir immédiatement

**Hypothèse A : flag pipeline 2-agent désactivé**
- Fichier : `C:/Users/Gamer/fks/.env` (local) ou variables Render (prod)
- Vérifier : `FKS_FORCE_2AGENT=true`, `FKS_ENGINE_2AGENT=true`, `FKS_FOUNDATION_2AGENT=true`, `FKS_EXPLOSIVITE_2AGENT=true`, `FKS_RSA_2AGENT=true`
- Si `false` → pipeline legacy (single pass), qualité coaching dégradée

**Hypothèse B : ghost exercise ID dans la banque**
- Fichier backend : `src/agents/agentA.<cycle>.ts` (few-shots)
- Commande : vérifier que chaque `exercise_id` cité dans les few-shots existe dans `src/exerciseBank.ts`
- Bug de référence : commit `098cc13` (ghost ID `run_15_15_repeat`)
- Signal : la séance a un bloc avec un exo "Exercice inconnu" ou avec un name qui ne matche pas l'ID

**Hypothèse C : validation Zod silencieuse côté front**
- Fichier : `schemas/sessionSchema.ts`
- Tous les champs ont `.catch()` → si un champ manque, il est drop SANS exception
- Symptôme : l'info est dans le JSON backend mais n'apparaît pas dans l'UI
- Fix : logger `parsed.data` juste après `sessionV2Schema.safeParse(data.v2)` dans `screens/newSession/api.ts:210`

---

## Format de réponse attendu

Quand ce skill est déclenché, sortir ce format :

```markdown
# Debug génération — <brève description du symptôme>

## 1. Guardrails backend
- Guardrails trouvés : [...]
- Guardrails attendus absents : [...]
- Diagnostic : ...

## 2. Payload contexte
- Champ suspect : ...
- Valeur observée : ...
- Valeur attendue : ...

## 3. Diff schémas
- Champ drop silencieusement : ... (ou ✅ aucun)

## 4. Cache AsyncStorage
- Cache actif ? oui/non
- Impact ? ...

## 5. Top 3 hypothèses
🎯 Hypothèse la plus probable : A / B / C
Fichier à ouvrir en premier : ...
Test de validation : ...

## Action recommandée
...
```

---

## Commandes utiles

```bash
# Lancer backend local en mode debug verbose
cd C:/Users/Gamer/fks && FKS_DEBUG=true FKS_PLANNER_DEBUG=true npm run dev

# Regarder les logs guardrails en temps réel
# (déjà stdout-ed par le backend)

# Forcer cache-miss côté front : dans l'app, modifier légèrement le TSB simulé OU call clearSessionCache()

# Lire le dernier payload envoyé (dev tools Expo)
# (logger console.log dans screens/newSession/api.ts avant fetch)
```

## Checklist de vérification finale

- [ ] Les 5 points ont été passés dans l'ordre
- [ ] Logs guardrails lus et cités dans le rapport
- [ ] Payload contexte logué et vérifié
- [ ] Schémas back/front comparés (via /sync-check ou manuellement)
- [ ] Cache AsyncStorage considéré (actif ou non)
- [ ] Top 3 hypothèses priorisées avec fichier à ouvrir
- [ ] Action recommandée claire et reproductible
