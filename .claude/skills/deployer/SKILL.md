---
name: deployer
description: Analyser les changements des deux repos FKS et produire une checklist de déploiement claire avec commandes prêtes à copier-coller. Détecte automatiquement si un rebuild natif EAS est requis (changement natif app.json / package.json natifs / ios / android) ou si un OTA update suffit. Rappelle les tests backend à faire passer avant push Render. À déclencher automatiquement quand l'utilisateur dit "je veux déployer", "on pousse en prod", "TestFlight update", "OTA ou rebuild ?", "ship it". NE LANCE AUCUNE COMMANDE — uniquement analyse + checklist + commandes à copier.
---

# /deployer — Préparer un déploiement fullstack (analyse seule)

## Règle absolue
**Ce skill N'EXÉCUTE AUCUNE commande.** Il analyse, affiche la checklist, et fournit les commandes à copier-coller. Toute décision d'exécution revient à l'utilisateur.

## ⚠️ Ce repo est le FRONTEND
L'autre repo (`C:/Users/Gamer/fks/`) est le backend. Le déploiement touche **souvent les deux** : ordre d'exécution backend → front (sinon le front appelle un backend pas encore prêt).

## Objectif
Produire un rapport clair qui répond à **4 questions** :
1. Y a-t-il des changements backend à déployer ?
2. Y a-t-il des changements frontend à déployer ?
3. Le frontend nécessite un **rebuild natif EAS** ou un **OTA update** suffit ?
4. Quelles commandes copier-coller dans quel ordre ?

## Étape 1 — État des deux repos

### Backend (`C:/Users/Gamer/fks/`)
- [ ] Lancer `git status` et `git log --oneline origin/main..HEAD`
- [ ] Identifier si des commits locaux non pushés existent
- [ ] Lister les fichiers modifiés

### Frontend (ce repo)
- [ ] Lancer `git status` et `git log --oneline origin/main..HEAD`
- [ ] Identifier si des commits locaux non pushés existent
- [ ] Lister les fichiers modifiés

## Étape 2 — Détection OTA vs Rebuild natif (frontend)

**Rebuild natif EAS REQUIS si un de ces fichiers a changé** :
- `app.json` / `app.config.js` (champs natifs : name, slug, ios.bundleIdentifier, android.package, version, buildNumber, plugins liés natif, permissions)
- `package.json` : ajout/suppression d'une dépendance **native** (ex : `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `react-native-*`, `expo-notifications`, `expo-haptics` si nouveau)
- `ios/*` ou `android/*` si générés
- `GoogleService-Info.plist` ou `google-services.json`
- `eas.json`
- Tout fichier `.podspec`, `Podfile`, `build.gradle`
- Nouveaux permissions natives (caméra, géoloc, notifications push, etc.)

**OTA suffit si uniquement** :
- `.tsx`, `.ts` sans changement de deps natives
- `assets/*` (images, polices déjà liées)
- `app.json` mais **uniquement** les champs JS (`expo.extra.*`, `expo.updates.*`)
- Logique de composants, hooks, stores, schemas, etc.

**Méthode** :
1. `git diff origin/main..HEAD --name-only` côté frontend
2. Passer chaque fichier contre les règles ci-dessus
3. Si UN SEUL fichier natif a bougé → **REBUILD NATIF REQUIS** + citer le fichier déclencheur

## Étape 3 — Checklist backend (si changements)

- [ ] `npm test` passe → **les 468 tests vitest**
- [ ] `npm run build` passe (TypeScript strict)
- [ ] Lancer `/sync-check` (côté back) pour vérifier schémas / banque exos cohérents avec le front
- [ ] Commit avec message clair (feat / fix / refactor)
- [ ] `git push origin main` → Render auto-deploy (≈ 2-3 min)
- [ ] Vérifier déploiement : curl `GET /health` et `GET /ready` sur l'URL Render
- [ ] Vérifier dans logs Render qu'il n'y a pas d'erreur au démarrage

## Étape 4 — Checklist frontend

### Si OTA suffit (le cas le plus fréquent)
- [ ] Tests Jest passent : `npm run test` (au moins `engine/__tests__/loadModel.test.ts`)
- [ ] `/sync-check` lancé (côté front) → ✅ OK
- [ ] `/verif-release` lancé → checklist SafeArea/dark mode/touch targets/Toast/haptics
- [ ] Commit poussé sur main
- [ ] Commande OTA :
  ```bash
  eas update --channel testflight --message "<description courte>"
  ```
- [ ] Les users en TestFlight reçoivent l'update au prochain cold start

### Si rebuild natif requis
- [ ] Incrémenter `version` et/ou `buildNumber` dans `app.json`
- [ ] Tests Jest passent
- [ ] `/sync-check` lancé → ✅ OK
- [ ] `/verif-release` lancé
- [ ] Rebuild iOS TestFlight :
  ```bash
  eas build --profile production --platform ios
  eas submit --platform ios --latest
  ```
- [ ] Rebuild Android APK si besoin :
  ```bash
  eas build --profile production --platform android
  ```
- [ ] Review TestFlight Apple (peut prendre quelques heures)
- [ ] Communiquer aux testeurs qu'un rebuild natif est nécessaire (ils doivent télécharger la nouvelle version dans TestFlight, pas juste relancer l'app)

## Étape 5 — Ordre d'exécution recommandé

**Toujours** :
1. Backend d'abord (Render auto-deploy ~2-3 min)
2. Vérifier healthcheck backend en prod
3. Frontend ensuite (OTA ou rebuild)

**Pourquoi** : si on push le front en premier et qu'il appelle un endpoint backend pas encore déployé → erreurs 404 chez les users.

## Format du rapport

```markdown
# Préparation déploiement — <date>

## Changements détectés

### Backend
- Commits locaux non pushés : <N>
- Fichiers modifiés : <liste>
- Résumé : ...

### Frontend
- Commits locaux non pushés : <N>
- Fichiers modifiés : <liste>
- Résumé : ...

## Décision type de déploiement frontend
**<REBUILD NATIF REQUIS | OTA SUFFIT | AUCUN CHANGEMENT FRONT>**

Justification : <fichier déclencheur s'il y a rebuild>

## Checklist pré-déploiement
- [ ] Backend : npm test (468 tests)
- [ ] Backend : npm run build (TS strict)
- [ ] /sync-check : ✅
- [ ] /verif-release (si front touché) : ✅
- [ ] Commits messages clairs

## Commandes à exécuter (dans l'ordre)

### 1. Backend
\```bash
cd C:/Users/Gamer/fks
npm test
npm run build
git add -A
git commit -m "<message>"
git push origin main
# Attendre 2-3 min le déploiement Render
curl https://<render-url>/health
\```

### 2. Frontend (OTA)
\```bash
cd C:/Users/Gamer/front-fks
npm run test
git add -A
git commit -m "<message>"
git push origin main
eas update --channel testflight --message "<description>"
\```

### 2bis. Frontend (Rebuild natif — si applicable)
\```bash
cd C:/Users/Gamer/front-fks
# Bump version/buildNumber dans app.json
eas build --profile production --platform ios
eas submit --platform ios --latest
\```

## Risques identifiés
- ...

## Verdict
✅ Prêt à déployer / ⚠️ Bloquant à fixer d'abord
```

## Pièges à éviter (rappels)

1. **Ne jamais skip `npm test` backend** — tu as déjà 468 tests qui protègent contre les régressions.
2. **Ne jamais push front avant back** si un nouveau champ/endpoint backend est attendu.
3. **Rebuild natif sans bump version** → EAS refuse la soumission.
4. **OTA sur un channel différent** (ex : `production` vs `testflight`) → les users TestFlight ne reçoivent rien.
5. **Flag `FKS_*_2AGENT` différent entre local et Render** → qualité dégradée en prod alors qu'elle est bonne en local.

## Checklist de vérification finale

- [ ] État des deux repos analysé (`git status` + `git log origin/main..HEAD`)
- [ ] OTA vs rebuild natif décidé avec justification (fichier déclencheur cité)
- [ ] Commandes générées dans l'ordre backend → front
- [ ] Pas une seule commande lancée par le skill (respect du read-only)
- [ ] Risques listés (ex : déploiement backend seul sans front correspondant)
