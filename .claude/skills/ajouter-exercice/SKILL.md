---
name: ajouter-exercice
description: Ajouter un nouvel exercice dans la banque d'exercices FKS (272 exos actuels). Workflow fullstack qui synchronise la banque backend (source de vérité), la banque frontend miroir, la liste BACKEND_EXERCISE_IDS, les vidéos, instructions et bénéfices. À déclencher automatiquement quand l'utilisateur dit "ajouter un exercice", "nouvel exo", "ajouter X à la banque", "le backend doit pouvoir proposer Y", ou évoque la création d'un nouvel exercice (squat, fente, plyo, sprint, core, etc.).
---

# /ajouter-exercice — Ajouter un exercice dans la banque FKS

## Objectif
Ajouter un nouvel exercice dans la banque, en synchronisant les **7 fichiers** impactés entre backend et frontend. Oublier un seul → l'exo est invisible OU crash silencieux.

## Danger principal
La banque d'exercices existe **en double** : backend (`src/exerciseBank.ts`, source de vérité) + frontend miroir (`engine/exerciseBank.ts`). Si un seul côté est mis à jour :
- Backend seul → l'exo peut être généré, mais le frontend ne sait pas l'afficher (name, description manquants, fallback "Exercice inconnu").
- Frontend seul → code mort, l'exo n'est jamais proposé par le backend.

## ⚠️ Ce repo est le FRONTEND
L'autre repo (`C:/Users/Gamer/fks/`) est le backend. **Les deux côtés doivent être modifiés ensemble.**

## Avant de commencer, aligne-toi avec l'utilisateur
- **ID** en snake_case (convention : `<modality>_<nom>` ex : `str_back_squat`, `speed_accel_20m`, `plyo_box_jump`, `core_deadbug`)
- **Nom** affichable (ex : "Back squat")
- **Description** technique (ex : "Barre sur trapèzes, descente contrôlée 3s, remontée explosive")
- **Football context** (ex : "Renforce les jambes pour les duels et les sauts")
- **Modality** : `strength` | `speed` | `plyo` | `run` | `core` | `mobility` | `circuit`
- **Equipment** requis (ex : `["barbell", "squat_rack"]` ou `[]` pour bodyweight)
- **Contraindications** (ex : `["knee_pain", "back_pain"]`)
- **Focus** (ex : `"lower"`, `"upper_push"`, `"posterior_chain"`, `"explosive"`, `"reactive"`)
- **Cycle-specific ?** S'il doit apparaître dans Foundation uniquement, Force uniquement, etc.
- **Token pool** : à quel(s) token(s) il appartient (ex : `strength_force_lower_main` ?)

---

## Checklist CÔTÉ BACKEND (à faire dans `C:/Users/Gamer/fks/`)

- [ ] **Banque principale** : ajouter l'objet dans `src/exerciseBank.ts`
  ```typescript
  {
    id: "str_bulgarian_split_squat",
    name: "Bulgarian split squat",
    description: "Pied arrière sur banc, descente contrôlée...",
    football_context: "Renforce le travail unilatéral pour les duels et changements de direction.",
    modality: "strength",
    equipment: ["dumbbells", "bench"],
    contraindications: ["knee_pain"],
    focus: "lower"
  }
  ```
- [ ] **Banque cycle-specific** (si besoin) :
  - `src/foundationExerciseBank.ts` si Foundation-only
  - `src/forceExerciseBank.ts` si Force-only
- [ ] **Token pool whitelist** : ajouter l'ID dans le bon token dans `src/playlists/<cycle>/blockTemplates.<cycle>.ts`
  - ⚠️ Sans ça, même si l'exo existe dans la banque, il ne sera **jamais sélectionné** par l'orchestrateur
- [ ] **Filtres cycle** (si exclusion conditionnelle) : `src/playlists/<cycle>/filters.<cycle>.ts`
- [ ] **Few-shots Agent A** (optionnel mais recommandé pour qualité) : l'ajouter dans les exemples de `src/agents/agentA.<cycle>.ts` pour guider le LLM
  - ⚠️ Attention au bug commit `098cc13` : un ID ghost dans les few-shots cause des sessions dégradées en silence
- [ ] **Tests vitest** : vérifier que l'exo est bien pris en compte
  ```bash
  npm test
  # 468 tests doivent passer
  ```

---

## Checklist CÔTÉ FRONTEND (ce repo)

- [ ] **Banque miroir** : ajouter le MÊME ID + name + modality dans `engine/exerciseBank.ts`
  - ⚠️ `id` DOIT être identique à la version backend (case sensitive)
  - ⚠️ `name` DOIT matcher (sinon écran preview affiche un nom différent de ce que le backend renvoie)
- [ ] **BACKEND_EXERCISE_IDS** : ajouter l'ID dans `engine/backendExerciseIds.ts`
  - Sans ça, `buildAllowedExercisesPayload()` dans `screens/newSession/api.ts:15` ne l'inclut pas dans `allowed_exercises` → le backend **ne sait pas qu'il a le droit** de proposer l'exo
- [ ] **Vidéo de démo** : ajouter une entrée dans `engine/exerciseVideos.ts`
  - `kind: "vetted"` si URL validée (ex : YouTube Short vérifié)
  - `kind: "search"` fallback avec requête YouTube (ex : `ytShortsSearch("bulgarian split squat technique")`)
- [ ] **Instructions** : ajouter bullet points étape-par-étape dans `engine/exerciseInstructions.ts`
- [ ] **Bénéfices football** : ajouter dans `engine/exerciseBenefits.ts` (texte marketing joueur, pas jargon)
- [ ] **Test manuel** : générer une séance qui pioche dans le token pool → vérifier que l'exo s'affiche correctement avec nom + description + vidéo + instructions

---

## Fichiers impactés (résumé visuel)

| Repo | Fichier | Rôle |
|---|---|---|
| **Back** | `src/exerciseBank.ts` | Source de vérité (name, description, equipment, focus) |
| **Back** | `src/foundationExerciseBank.ts` / `forceExerciseBank.ts` | Si cycle-specific |
| **Back** | `src/playlists/<cycle>/blockTemplates.<cycle>.ts` | Whitelist dans token pool |
| **Back** | `src/agents/agentA.<cycle>.ts` | Few-shots (optionnel) |
| **Front** | `engine/exerciseBank.ts` | Miroir pour UI (id + name + modality min) |
| **Front** | `engine/backendExerciseIds.ts` | Liste envoyée comme allowed_exercises |
| **Front** | `engine/exerciseVideos.ts` | Vidéo démo |
| **Front** | `engine/exerciseInstructions.ts` | Étapes technique |
| **Front** | `engine/exerciseBenefits.ts` | Bénéfice football |

---

## Exemple concret tiré du projet

Commit récent : ajout de 18 exercices bodyweight. Pour chaque exo :
1. Backend : entrée dans `src/exerciseBank.ts` avec `equipment: []`, `modality: "strength"` ou `"plyo"`
2. Backend : ajout token pool dans `src/playlists/force/blockTemplates.force.ts` et/ou `playlists/foundation/blockTemplates.foundation.ts`
3. Frontend : miroir dans `engine/exerciseBank.ts`
4. Frontend : ID dans `BACKEND_EXERCISE_IDS`
5. Frontend : search vidéo fallback dans `exerciseVideos.ts`
6. Frontend : instructions + bénéfice

**Durée typique** : 10-15 min par exo si bien fait, 30 min à déboguer si un fichier est oublié.

---

## Vérification finale avant commit

- [ ] `/sync-check` lancé → point 2 (banque exos) et point 3 (BACKEND_EXERCISE_IDS) = ✅ OK
- [ ] L'ID est présent dans les **9 fichiers** impactés (ou les fichiers pertinents selon le cycle)
- [ ] Génération test en dev : l'exo peut apparaître dans une séance
- [ ] L'écran preview affiche nom + description + vidéo + instructions sans fallback "Exercice inconnu"
- [ ] Tests vitest passent côté back
- [ ] Les deux banques ont le même `name` pour le même `id`
- [ ] Si cycle-specific : l'exo n'apparaît que dans les séances du bon cycle

## 🔴 Rappel
**Un exercice oublié côté frontend = UI cassée pour TOUS les users qui tombent dessus** (fallback texte vide ou crash). **Un exercice oublié côté backend = code mort**. Tester les deux côtés en dev avant de push.
