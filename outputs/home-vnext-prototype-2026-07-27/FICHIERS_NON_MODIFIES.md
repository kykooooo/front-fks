# Preuve que l'application n'a pas bougé

> Ce prototype est une **maquette à côté**, pas une modification de l'app.
> Ce document en apporte la preuve, avec les sorties réelles des commandes, pas un résumé.

Worktree : `C:\Users\Gamer\front-fks\.claude\worktrees\home-vnext-prototype`
Branche : `feat/home-vnext-prototype`
Commit de référence : `724c062` — *feat(generation): recommande un lieu par cycle sur l'ecran de choix*
`HEAD` actuel : `724c06214f8f5a0a583732182fd485aa1b7d7a46` — **identique**

---

## 1. Aucun écart sur le produit

Commande lancée, telle quelle :

```
git diff --stat 724c062 -- screens/HomeScreen.tsx components/home hooks/home \
  navigation/RootNavigator.tsx engine state services domain config constants App.tsx
```

Sortie réelle :

```
```

**La sortie est vide.** En Git, une sortie vide de `git diff --stat` signifie
**zéro fichier modifié, zéro ligne ajoutée, zéro ligne supprimée** sur l'ensemble de ces
chemins. C'est le résultat recherché.

---

## 2. Tout ce qui a été ajouté

Commande lancée, telle quelle :

```
git status --porcelain
```

Sortie réelle :

```
?? __tests__/
?? components/homeVNext/
?? outputs/
?? prototype/
?? screens/homeVNext/
```

Comment lire cette sortie :

- `??` signifie **fichier ou dossier non suivi par Git** : quelque chose qui vient d'être
  créé et qui n'existait pas dans le dépôt.
- **Il n'y a aucune ligne `M`** (modifié), **aucune ligne `D`** (supprimé),
  **aucune ligne `R`** (renommé). Si un fichier de production avait été touché, il
  apparaîtrait ici avec un `M`.
- `__tests__/` apparaît en entier parce que ce dossier **n'existait pas** au commit de
  départ (vérifié : `git ls-files __tests__` ne renvoie rien).

**Les cinq dossiers listés sont exactement les cinq dossiers autorisés par la mission.**

| Dossier créé | Contenu |
|---|---|
| `screens/homeVNext/` | L'écran proposé, son sélecteur de données, ses 15 jeux de données fictives |
| `components/homeVNext/` | Les composants proposés et leurs tokens locaux |
| `prototype/home-vnext/` | Le harnais de rendu, le visualiseur, les scripts de vérification |
| `__tests__/homeVNext/` | Les tests ciblés (238 tests, 2 suites, tous verts) |
| `outputs/home-vnext-prototype-2026-07-27/` | Ce dossier : les documents et les 60 captures |

**Rien n'a été commité, rien n'a été poussé, rien n'a été fusionné.**

---

## 3. Les fichiers de production qui auraient pu être modifiés — et ne l'ont pas été

Ce sont les fichiers qu'un prototype du Home aurait naturellement eu envie de toucher.
Tous ont été **lus**, aucun n'a été **écrit**.

### Le Home de production — le cœur du sujet

| Fichier | Statut |
|---|---|
| `screens/HomeScreen.tsx` | **intact** |
| `components/home/HomeAdviceCard.tsx` | **intact** |
| `components/home/HomeCarouselCard.tsx` | **intact** |
| `components/home/HomeNextSessionCard.tsx` | **intact** |
| `components/home/HomePrimaryCTA.tsx` | **intact** |
| `components/home/HomeReadinessHero.tsx` | **intact** |
| `hooks/home/useActivityStreak.ts` | **intact** |
| `hooks/home/useContextualAdvice.ts` | **intact** |
| `hooks/home/useLoadSeries.ts` | **intact** |
| `hooks/home/useMatchSoon.ts` | **intact** |
| `hooks/home/usePrimaryCta.ts` | **intact** |
| `hooks/home/useWeekDays.ts` | **intact** |
| `hooks/home/useWeekSummary.ts` | **intact** |

Deux défauts ont été trouvés dans ces fichiers pendant le travail et **délibérément non
corrigés**, parce qu'ils sont hors périmètre :

1. `components/home/HomePrimaryCTA.tsx` lance une pulsation infinie **sans consulter le
   réglage « réduire les animations »**, contrairement au fondu d'entrée du même écran.
2. Un `<div>` décoratif vide de 160 × 160 px **dépasse le cadre de l'écran de 43 px sur la
   droite**, à toutes les largeurs y compris 768 px, sur les 60 pages mesurées.

Ils sont documentés dans [`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md) §5, pour être
traités sur une branche dédiée.

### La navigation

| Fichier | Statut |
|---|---|
| `navigation/RootNavigator.tsx` | **intact** |

**Le prototype n'entre pas dans la navigation de l'app.** Il n'y a aucune route vers lui,
aucun onglet, aucun bouton caché. Il n'est atteignable que par le visualiseur local. Un
build de l'application ne l'embarque pas : `prototype/` n'est importé par aucun écran.

### Le socle — importé, jamais modifié

| Fichier | Statut | Ce qu'il fournit au prototype |
|---|---|---|
| `constants/theme.ts` | **intact** | La palette, les rayons, les espacements. **Y compris la couleur d'action actuelle `#F2741B`** : l'orange proposé vit dans le prototype, pas ici. |
| `components/ui/Screen.tsx` | **intact** | La safe area (règle d'or du projet) |
| `components/ui/Button.tsx` | **intact** | Les hauteurs tactiles et l'animation de pression |
| `components/ui/SectionHeader.tsx` | **intact** | Les titres de section |
| `domain/microcycles.ts` | **intact** | Les 5 cycles et leurs libellés |
| `utils/microcycleUtils.ts` | **intact** | Le calcul de la phase de cycle |
| `utils/dateHelpers.ts` | **intact** | Les dates |
| `config/trainingDefaults.ts` | **intact** | Les constantes `CTL0` / `ATL0`, lues pour comprendre le défaut, jamais changées |

### Le moteur, l'état et les services — jamais approchés en écriture

| Dossier | Statut |
|---|---|
| `engine/` | **intact** — aucun calcul de charge n'a été modifié |
| `state/` | **intact** — aucun store touché |
| `services/` | **intact** — Firebase, analytics, notifications, contexte IA |
| `App.tsx` | **intact** |
| `package.json`, `tsconfig.json`, `.gitignore` | **intacts** — aucune dépendance ajoutée, aucune installation lancée |
| `firestore.rules`, `functions/` | **intacts** |
| `screens/Coach*`, `components/coach/` | **intacts** — chantier concurrent, lu seulement pour §8 de [`DECISIONS_VISUELLES.md`](DECISIONS_VISUELLES.md) |

---

## 4. Ce que le prototype n'a pas fait non plus

- **Aucun appel LLM payant.** Aucun.
- **Aucune génération de séance.** Le moteur n'a jamais été appelé.
- **Aucun appel backend, aucun appel réseau sortant.**
- **Aucun accès Firestore.** `services/firebase` est remplacé par un objet inerte **avant**
  d'être chargé : l'accès est impossible, pas seulement évité.
- **Aucun accès à la production, aucun déploiement.**
- **Aucun `npm install` / `yarn install` / `expo install`.** Le prototype n'utilise que ce
  qui était déjà dans `node_modules`.
- **Aucune écriture disque hors des cinq dossiers autorisés** et du cache temporaire du
  système.
- **Aucun `git commit`, `git push`, `git merge`, `git rebase`.** Aucune autre branche
  touchée, aucun autre worktree touché.

---

## 5. Comment le vérifier toi-même

Depuis le worktree du prototype :

```
cd C:\Users\Gamer\front-fks\.claude\worktrees\home-vnext-prototype
git status --porcelain
git diff --stat 724c062
git log --oneline -3
```

- `git status --porcelain` doit ne montrer que des lignes `??` sur les cinq dossiers.
- `git diff --stat 724c062` **sans filtre de chemin** doit lui aussi sortir vide : aucun
  fichier suivi par Git n'a été modifié, où que ce soit dans le dépôt.
- `git log --oneline -3` doit montrer `724c062` en première ligne.

Si une seule de ces trois commandes montre autre chose, c'est que quelque chose a bougé
depuis la rédaction de ce document.
