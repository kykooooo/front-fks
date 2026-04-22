---
name: traiter-feedback-joueur
description: Workflow fixe pour traiter un retour brut d'un joueur/testeur FKS (bug, incohérence, demande feature). Reproduit, identifie si backend/frontend/both, classe (bug critique / bug mineur / feature request), estime priorité et fichier concerné. À déclencher automatiquement quand l'utilisateur colle un texte style "un joueur m'a dit", "feedback TestFlight", "bug report", "un user signale", "retour testeur", "issue d'un beta tester", ou toute paraphrase d'un retour utilisateur brut.
---

# /traiter-feedback-joueur — Workflow retour testeur/joueur

## Objectif
Quand un retour joueur arrive brut ("ma séance était bizarre", "ça a crash quand j'ai cliqué sur X", "je veux pouvoir faire Y"), ce skill applique un workflow fixe pour le transformer en **action concrète** : bug reproduit, côté back/front/both identifié, priorité attribuée, fichier estimé.

## ⚠️ Ce repo est le FRONTEND
L'autre repo (`C:/Users/Gamer/fks/`) est le backend. La majorité des retours joueur touchent UI/UX (frontend) mais **la génération de séance incorrecte est backend** (ou les deux).

## Workflow en 6 étapes

### Étape 1 — Paraphraser le retour brut
- Résumer en 1-2 phrases ce que le joueur décrit
- Extraire : **quoi** (action), **quand** (contexte), **résultat attendu**, **résultat observé**
- Exemple :
  - Brut : "J'ai fait ma séance hier et elle m'a mis un exo que je peux pas faire parce que j'ai pas de medball, c'est chiant"
  - Paraphrasé : "Lors de la génération, un exercice nécessitant du medball a été proposé alors que le joueur n'a pas cet équipement → génération ne respecte pas la contrainte equipment"

### Étape 2 — Reproduire (ou tenter)
- Identifier les conditions : cycle actif, équipement, douleurs, TSB, match day
- Si reproductible en local : lancer backend + frontend dev, reproduire
- Si pas reproductible : noter "Non reproduit — besoin contexte supplémentaire" et lister les infos manquantes à demander au joueur
  - screenshot / enregistrement écran
  - version app (TestFlight version + OTA update id)
  - profil joueur (niveau, poste, équipement, cycle actif)
  - moment précis de l'action

### Étape 3 — Identifier le côté (back / front / both)

**Indices FRONTEND uniquement** :
- Crash visuel (écran blanc, overflow texte, bouton invisible)
- Navigation (retour arrière ne marche pas, écran coincé)
- SafeArea (contenu caché par Dynamic Island ou barre Home)
- Theme (écran blanc en dark mode, inversion des couleurs)
- Touch targets (zone cliquable trop petite)
- Toast / haptics / animations
- Onboarding flow (3 étapes inscription)
- Affichage de la séance reçue du backend

**Indices BACKEND uniquement** :
- "Ma séance est bizarre" (exos inadaptés, volume incohérent)
- Exercice proposé malgré matériel manquant
- RPE target aberrant
- Séance en easy alors que joueur se sent frais (ou inverse)
- `missing_goal` / erreur 500 depuis le backend
- Durée séance hors caps (ex : 90 min pour moderate_light)
- Match day / club day ignoré
- Deload non appliqué en semaine 12
- Coaching tips incohérents, jargon technique (signe Agent B problème)

**Indices FULLSTACK** :
- "L'exo affiché n'existe pas" → ghost ID ou desync banques
- Un champ backend arrive mais est pas affiché → schéma front drop
- Cache bloquant (la séance ne change jamais)
- Payload contexte mal formé

### Étape 4 — Classer (bug critique / bug mineur / feature request)

**🔴 Bug critique** (à fix cette semaine) :
- Crash de l'app
- Données perdues (séance sauvegardée puis disparue, streak reset)
- Bloquant principal (impossible de finir l'inscription, impossible de valider un feedback)
- Données incorrectes persistées (TSB incorrect après feedback)
- Exposition de données sensibles
- Génération backend qui viole les contraintes critiques (equipment, pain)

**🟡 Bug mineur** (backlog semaine suivante) :
- UI cosmétique (alignement, couleur, texte tronqué)
- Flow non-optimal mais contournable
- Performance modérée (lent mais marche)
- Incohérence mineure dans la coaching copy

**🟢 Feature request** (discussion, pas une correction) :
- "J'aimerais pouvoir X" (pas un bug)
- Suggestion amélioration UX
- Nouveau cycle / nouveau type de séance
- Nouvelle intégration (smartwatch, export, etc.)

### Étape 5 — Estimer fichier concerné

**Génération séance bizarre** :
- Côté back : `src/fksOrchestrator.ts` (pickIntentV22), `src/fksPost.ts` (post-processing), `src/playlists/<cycle>/archetypes.<cycle>.ts`
- Côté front : `screens/newSession/api.ts` (payload envoyé), `services/aiContext.ts` (contexte construit)

**Bug UI frontend** :
- Écran concerné : `screens/<Name>Screen.tsx`
- Composant commun : `components/ui/<Name>.tsx`
- Theme : `constants/theme.ts`
- SafeArea : le screen lui-même

**Bug auth** :
- `screens/LoginScreen.tsx` / `screens/RegisterScreen.tsx`
- `services/firebase.ts` + `services/socialAuth.ts`
- `navigation/RootNavigator.tsx` (machine d'états auth)

**Bug Firestore sync** :
- `state/trainingStore/slices/firestoreSlice.ts`
- `state/useSyncStore.ts`
- `schemas/firestoreSchemas.ts`

**Bug notifications** :
- `services/notifications.ts`

**Bug charge / TSB** :
- `engine/loadModel.ts` (EWMA Banister)
- `state/stores/useLoadStore.ts`
- `state/orchestrators/rebuildLoad.ts`

**Bug chat** :
- Frontend : `screens/ChatScreen.tsx`
- Backend : `src/fksChat.ts`

### Étape 6 — Estimer complexité

- **< 1h** : fix UI (padding, couleur, texte), typo, condition manquante
- **1 jour** : nouveau composant, refactor petit, nouveau hook, fix bug multi-fichiers
- **2-5 jours** : nouvelle feature, nouveau cycle, refactor architecture
- **> 1 semaine** : intégration externe, migration data, nouvelle permission native

---

## Format du rapport

```markdown
# Traitement feedback joueur — <date>

## Retour brut (copié du testeur)
> ...

## Paraphrase claire
<reformulation en 1-2 phrases>

## Conditions de reproduction
- Cycle actif : ...
- Équipement : ...
- TSB / phase : ...
- Match day / club day : ...
- Reproductible en local ? oui / non / infos manquantes

## Localisation
**Côté** : 🔵 FRONTEND / 🟢 BACKEND / 🟣 FULLSTACK
**Fichiers probables** : 
- `<chemin>` — raison
- `<chemin>` — raison

## Classification
**Type** : 🔴 bug critique / 🟡 bug mineur / 🟢 feature request
**Priorité** : 🔴 cette semaine / 🟡 semaine prochaine / 🟢 backlog

## Complexité estimée
< 1h / 1 jour / 2-5 jours / > 1 semaine

## Action recommandée
1. ...
2. ...
3. ...

## Si fullstack
- Backend : ...
- Frontend : ...
- Vérifier `/sync-check` après fix : oui / non
```

## Exemples concrets

### Exemple 1 — "L'exo box jump m'a été proposé mais j'ai pas de box"
- Paraphrase : génération viole la contrainte `equipment`
- Côté : 🟢 BACKEND (filtres equipment strict dans `fksFilters.ts`)
- Type : 🔴 bug critique (équipement manquant = blessure potentielle)
- Fichier : `src/fksFilters.ts` + vérifier `src/exerciseBank.ts` (l'exo box_jump a-t-il bien `equipment: ["box"]` ?)
- Action : ajouter test vitest qui génère avec `equipment: ["bodyweight"]` et assert aucun exo avec `box` dans la session

### Exemple 2 — "Quand j'appuie sur valider feedback, rien ne se passe"
- Paraphrase : clic sur bouton feedback ne déclenche pas l'action
- Côté : 🔵 FRONTEND (UI / event handler)
- Type : 🔴 bug critique (feedback obligatoire pour avancer cycle)
- Fichier : `screens/FeedbackScreen.tsx` + `hooks/useFeedbackSave.ts`
- Action : vérifier que le bouton a bien un `onPress`, touch target ≥ 44px, et que `useFeedbackSave` ne throw pas silencieusement

---

## Checklist de vérification finale

- [ ] Retour brut copié intégralement
- [ ] Paraphrase claire et actionable
- [ ] Conditions de reproduction listées (ou infos manquantes notées)
- [ ] Côté back/front/fullstack identifié avec justification
- [ ] Fichier(s) concerné(s) cité(s) avec chemin précis
- [ ] Type (bug critique / mineur / feature) attribué
- [ ] Priorité claire
- [ ] Complexité estimée
- [ ] Si fullstack → rappel `/sync-check` après fix
