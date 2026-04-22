---
name: verif-release
description: Scanner le git diff courant contre la checklist de conventions projet FKS frontend avant un release TestFlight/OTA. Vérifie SafeArea complète, dark+light mode, touch targets 44px, Toast (pas Alert), useHaptics (pas import direct), hooks Home dans hooks/home/, labels niveaux "Loisir/Competition/Haut niveau", notes en langage joueur. À déclencher automatiquement avant un /deployer, ou quand l'utilisateur dit "vérifie la release", "c'est bon pour TestFlight ?", "check les conventions", "tout est propre avant push ?".
---

# /verif-release — Checklist conventions projet avant release

## Objectif
Scanner les fichiers modifiés depuis `origin/main` (ou les fichiers de la feature en cours) contre la liste des **conventions projet FKS** qui reviennent tout le temps dans les commits de correction.

## Pourquoi ce skill existe
Les 5 derniers commits frontend sont des corrections de ces mêmes règles : SafeArea, touch targets 44px, Toast vs Alert, dark mode theme.bg. Le pattern est clair : ces règles sont oubliées à chaque nouvelle feature. Ce skill les rappelle avant qu'elles deviennent un commit de fix.

## Méthode
1. Lister les fichiers modifiés : `git diff origin/main..HEAD --name-only` + `git status`
2. Pour chaque fichier TSX/TS touché, passer chaque règle ci-dessous
3. Pour chaque règle violée, indiquer **fichier:ligne** et proposition de fix
4. Rapport final : ✅ Clean ou ❌ N violations

## Règles à scanner

### R1 — SafeArea complète sur les écrans
**Fichiers concernés** : `screens/*.tsx`

**Règle** : tout écran doit avoir `<SafeAreaView edges={["top", "right", "left", "bottom"]}>` (ou équivalent avec `useSafeAreaInsets`).

**Motivation** : Dynamic Island (iPhone 14+) + barre Home des iPhones modernes. Sans les 4 edges, l'UI est tronquée.

**Détection** :
- Chercher `<SafeAreaView>` sans attribut `edges`
- Chercher `edges={["top"]}` seul (manque `bottom`)
- Chercher des écrans avec `<View>` root sans SafeAreaView

### R2 — Theme dark + light
**Fichiers concernés** : tous les composants qui stylent

**Règle** :
- Utiliser `theme.colors.bg` ou `theme.colors.background` depuis `constants/theme.ts` (les deux existent, même valeur)
- Jamais de couleur en dur (`#fff`, `#000`, `white`, `black`)
- Si dark mode affecte la couleur → utiliser `useColorScheme()` ou les variantes du theme

**Motivation** : un écran qui rend blanc en dark mode a déjà été un bug bloquant (fix récent commit theme dark mode).

**Détection** :
- Grep `color: '#` ou `backgroundColor: '#` dans les styles
- Grep `color: 'white'` / `color: 'black'`
- Exceptions : couleurs marketing ciblées (accent, alerte) mais toujours via le theme

### R3 — Touch targets ≥ 44px
**Fichiers concernés** : tous les composants avec `onPress`

**Règle** : tout élément cliquable (`Pressable`, `TouchableOpacity`, `Touchable*`) doit avoir une zone de clic d'au moins **44×44 px** (recommandation Apple HIG + accessibilité).

**Motivation** : commit `48b23df` (RPE dots 30px → 44px) + commit `86279d9` (touch targets fix sur tous écrans). Se répète.

**Détection** :
- `<Pressable>` ou `<TouchableOpacity>` avec style qui a `height < 44` ou `minHeight < 44`
- Boutons avec `padding` trop faible qui résulte en target < 44px
- Si la zone visuelle est petite, ajouter `hitSlop` pour agrandir la zone cliquable

### R4 — Toast via `showToast()` (pas `Alert.alert`)
**Fichiers concernés** : tous les composants

**Règle** : pour les messages utilisateur courts → `showToast()` depuis `components/ui/ToastHost.tsx`. Jamais `Alert.alert` pour une simple notification.

**Exceptions** : `Alert.alert` reste OK pour les confirmations critiques (delete, logout) avec boutons OK/Cancel.

**Détection** :
- Grep `Alert.alert\(` → vérifier que c'est bien un cas de confirmation, pas une notification

### R5 — Haptics via `useHaptics()` (pas import direct `expo-haptics`)
**Fichiers concernés** : tous les composants

**Règle** : utiliser le hook `useHaptics()` pour déclencher les retours haptiques. Jamais `import * as Haptics from 'expo-haptics'` suivi d'un appel direct dans un composant.

**Motivation** : centralise la logique (on/off selon préférences user) et évite les appels directs dispersés.

**Détection** :
- Grep `from 'expo-haptics'` en dehors de `hooks/useHaptics.ts`

### R6 — Hooks métier Home dans `hooks/home/`
**Fichiers concernés** : logique spécifique HomeScreen

**Règle** : tout hook qui prépare des données pour HomeScreen (streak, week summary, primary CTA, readiness hero, etc.) doit vivre dans `hooks/home/` et pas être inliné dans `HomeScreen.tsx`.

**Motivation** : garder HomeScreen léger (< 200 lignes), pattern établi dans le projet.

**Détection** :
- `HomeScreen.tsx` trop long (>300 lignes) → signe de logique à extraire
- Hook custom défini directement dans `HomeScreen.tsx` au lieu de `hooks/home/`

### R7 — Labels niveaux : 3 valeurs uniquement
**Fichiers concernés** : onboarding, settings, profile

**Règle** : les 3 niveaux joueur sont **"Loisir" / "Competition" / "Haut niveau"**. Jamais 5 niveaux, jamais d'autres labels.

**Motivation** : simplification inscription (commit `cc6429f` et avant), les tau ATL/CTL sont mappés sur ces 3 labels dans `config/trainingDefaults.ts` → `TAU_BY_LEVEL`.

**Détection** :
- Grep pour `"Amateur"`, `"Semi-pro"`, `"Professionnel"`, `"Débutant"`, `"Intermédiaire"` → potentiels restes legacy

### R8 — Notes exercices en langage joueur
**Fichiers concernés** : composants qui affichent des notes d'exercice (SessionLiveScreen, SessionPreviewScreen, ExerciseDetailCard)

**Règle** : les notes doivent être en **langage joueur** :
- ✅ "Descends en 3s, effort 7/10"
- ❌ "Tempo 3-1-X RPE 7"

**Motivation** : commit "Remove all player-facing IA mentions" + rewrite Agent B pour langage foot. Le backend fait ce travail, mais si le front ajoute des hardcoded strings, elles doivent aussi respecter.

**Détection** :
- Chercher des hardcoded strings avec "RPE", "Tempo X-X-X", "AMRAP", etc. dans les composants

### R9 — Jamais de generation sans cycle actif
**Fichiers concernés** : HomeScreen, screens/newSession/

**Règle** : avant tout appel à `fetchV2()`, vérifier qu'il y a un cycle actif (`profile.goal` défini). Sinon afficher le CTA "Choisir un cycle" + `CycleModalScreen`.

**Détection** :
- Appel à `fetchV2()` sans check préalable du cycle actif

### R10 — Tests passent
- [ ] `npm run test` (au moins `engine/__tests__/loadModel.test.ts` = 7 tests)
- [ ] Pas de `.skip` ou `.only` laissés dans le code

---

## Format du rapport

```markdown
# Rapport /verif-release — <date>

## Fichiers scannés
<liste>

## Violations trouvées

### R1 — SafeArea
- [ ] <fichier:ligne> — manque `edges={["bottom"]}`
- ...

### R2 — Theme
- [ ] <fichier:ligne> — couleur en dur `#ffffff`, utiliser `theme.colors.bg`
- ...

### R3 — Touch targets
- ...

(... etc)

## Verdict
✅ Clean, prêt à release
OU
❌ N violations — fix avant /deployer
```

## Commandes utiles
```bash
# Lister fichiers modifiés
git diff origin/main..HEAD --name-only

# Grep SafeArea sans edges
grep -rn "SafeAreaView>" screens/

# Grep couleurs en dur
grep -rn "color: '#" components/ screens/

# Grep Alert.alert
grep -rn "Alert.alert" components/ screens/

# Grep import direct expo-haptics
grep -rn "from 'expo-haptics'" components/ screens/ | grep -v "hooks/useHaptics"

# Lancer tests
npm run test
```

## Checklist de vérification finale

- [ ] Tous les fichiers modifiés ont été scannés
- [ ] Les 10 règles (R1-R10) ont été vérifiées
- [ ] Chaque violation cite **fichier:ligne** précis
- [ ] Proposition de fix indiquée pour chaque violation
- [ ] Verdict global (✅ ou ❌) clair en fin de rapport
- [ ] Aucun fichier modifié (read-only)
