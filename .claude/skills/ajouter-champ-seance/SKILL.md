---
name: ajouter-champ-seance
description: Ajouter un nouveau champ dans la réponse session v2 (format fks.next_session.v2). Workflow fullstack qui synchronise le schéma Zod backend, le schéma Zod frontend, le type TypeScript camelCase et la consommation UI. À déclencher automatiquement quand l'utilisateur dit "ajouter un champ à la séance", "nouveau field dans la réponse", "étendre fks.next_session.v2", "le backend renvoie maintenant X", ou mentionne l'ajout d'une info dans la réponse de génération.
---

# /ajouter-champ-seance — Ajouter un champ dans la réponse session v2

## Objectif
Ajouter un nouveau champ dans la réponse `fks.next_session.v2` **sans casser la validation Zod silencieuse** côté frontend.

## Danger principal
Le schéma Zod frontend (`schemas/sessionSchema.ts`) utilise `.catch()` sur tous les champs → **si tu oublies le schéma front, le champ est silencieusement drop**. Aucune erreur visible. Le champ backend existe mais arrive jamais dans l'UI.

## Avant de commencer, aligne-toi avec l'utilisateur
- Nom du champ en snake_case (backend) → détermine le nom camelCase (frontend)
- Type (string, number, boolean, array, object)
- Nullable ou pas ?
- Valeur par défaut (`.catch()`)
- Position dans le JSON : top-level, dans `blocks[]`, dans `blocks[].items[]`, dans `analytics`, dans `player_context`, etc.
- Qui consomme le champ côté UI ? (SessionPreviewScreen, SessionLiveScreen, etc.)

## ⚠️ Ce repo est le FRONTEND
L'autre repo (`C:/Users/Gamer/fks/`) est le backend. **Les deux côtés doivent être modifiés ensemble.** Pour ce skill, tu commences généralement par le backend (source du champ), puis tu répercutes côté front.

---

## Checklist CÔTÉ BACKEND (à faire dans `C:/Users/Gamer/fks/`)

- [ ] **Schéma Zod** : ajouter le champ dans `src/fksSchema.ts` au bon endroit (root / block / item / analytics / player_context)
  - Exemple root : `FksNextSessionSchema`
  - Exemple block : `BlockSchema`
  - Exemple item : `BlockItemSchema`
- [ ] **Population** : remplir le champ dans le post-processing
  - Top-level → `src/fksPost.ts`
  - Spécifique 2-agent → `src/agents/merge.<cycle>.ts`
  - Analytics → `src/fksOrchestrator.ts` (rationale, target_metrics)
  - Player context → section dédiée dans `fksPost.ts` ou `merge.force.ts`
- [ ] **Valeur par défaut** : le champ doit avoir un fallback solide (ex : `null`, `""`, `[]`) pour les cas où l'Agent B ne le fournit pas
- [ ] **Test vitest** : ajouter ou étendre un test dans `src/__tests__/` qui vérifie le champ présent en sortie
- [ ] **Vérif stricte TS** : `npm run build` (tsc strict mode activé)
- [ ] **Tests passent** : `npm test` (468 tests actuellement)

---

## Checklist CÔTÉ FRONTEND (ce repo)

- [ ] **Schéma Zod front** : ajouter dans `schemas/sessionSchema.ts` avec **le bon `.catch()`** (même type de fallback que côté back)
  - Exemple : `z.string().nullable().optional().catch(null)` pour un string nullable
  - ⚠️ NE PAS oublier `.catch()` sinon un champ manquant fait rejeter toute la séance
- [ ] **Type TypeScript** : ajouter dans `screens/newSession/types.ts` → `FKS_NextSessionV2` (ou sous-type `FKS_Block`, `FKS_BlockItem`, etc.)
  - ⚠️ Nom en **camelCase** (le transform `snakeToCamel` est appliqué automatiquement dans `screens/newSession/api.ts:224`)
- [ ] **Validation de la conversion** : si le champ est dans un array imbriqué, vérifier que `snakeToCamel` le gère correctement (`utils/caseTransform.ts`)
- [ ] **Consommation UI** : afficher le champ dans le bon écran
  - Infos séance globale → `screens/SessionPreviewScreen.tsx`
  - Pendant la séance → `screens/SessionLiveScreen.tsx`
  - Récap post-séance → `screens/FeedbackScreen.tsx`
  - Info contextuelle coach → `components/home/HomeCoachRecommendation.tsx`
- [ ] **Fallback UI** : toujours gérer le cas `undefined`/`null` dans le composant
- [ ] **Test manuel** : lancer le backend local (`cd C:/Users/Gamer/fks && npm run dev`) + frontend (`npm start`) et générer une séance pour vérifier que le champ arrive bien
- [ ] **Vérif Zod silent fail** : si le champ ne s'affiche pas → ajouter temporairement `console.log(parsed.data)` dans `screens/newSession/api.ts` et vérifier que le champ est bien dans l'objet parsé (sinon c'est le schéma front qui drop)

---

## Exemple concret tiré du projet

L'ajout récent de `analytics.rationale` (2026-04) a suivi ce flow :

1. **Backend** : `src/fksSchema.ts` → ajout `analytics: z.object({ rationale: z.string().optional(), target_metrics: ... })`
2. **Backend** : `src/fksOrchestrator.ts` → génère la rationale TSB-aware à la fin du orchestrator
3. **Frontend** : `schemas/sessionSchema.ts:101-106` → ajout `analytics: z.object({ rationale: z.string().optional().catch(undefined), ... }).nullable().optional().catch(null)`
4. **Frontend** : `screens/newSession/types.ts:60-63` → ajout `analytics?: { targetMetrics?: { totalReps?: number }; rationale?: string }`
5. **Frontend** : `screens/SessionPreviewScreen.tsx` → ajout carte "Pourquoi cette séance" (💡) qui lit `v2.analytics?.rationale`

---

## Vérification finale avant commit

- [ ] `/sync-check` lancé → point 1 (schéma session v2) = ✅ OK
- [ ] Génération test en dev : le champ arrive bien jusqu'à l'UI
- [ ] Pas de warning Zod dans la console (`[FKS] Session V2 validation failed`)
- [ ] Cas `undefined`/`null` géré dans l'UI (pas de crash)
- [ ] Le champ est bien en **camelCase** dans le type TS mais en **snake_case** dans les schémas Zod
- [ ] Si le champ est sensible (ex: infos privées), vérifier qu'il est bien filtré avant persist Firestore

## 🔴 Rappel sécurité
**Ne jamais déployer seulement le backend sans la version frontend correspondante.** Les users en prod vont avoir le champ en payload mais ne verront rien (schéma front drop). Lancer `/sync-check` avant tout push.
