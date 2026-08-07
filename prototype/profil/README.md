# Harnais de rendu — prototype Profil vNext

Outil de démonstration. Il sert à **regarder** l'onglet Profil refondu, état par état,
variante par variante, à côté du Profil de production — sans téléphone, sans compte,
sans réseau. Rien de ce dossier n'entre dans le bundle Expo : `prototype/` n'est
importé par aucun écran, et le prototype lui-même (`screens/profilVNext/`,
`components/profilVNext/`) n'est monté par aucune navigation.

C'est la copie adaptée du harnais du Home vNext (`prototype/home-vnext/` du worktree
`home-vnext-prototype`) — même moteur, mêmes garanties, moins de variantes.

---

## Lancer

Depuis la racine du worktree :

```
node prototype/profil/build.js     # génère toutes les pages dans prototype/profil/out/
node prototype/profil/serve.js     # sert le visualiseur sur http://127.0.0.1:8150/
node prototype/profil/verifier.js  # exécute toutes les vérifications et rend un verdict chiffré
```

Si 8150 est occupé, `serve.js` prend le port libre suivant et affiche l'URL réelle.
Le serveur n'écoute que sur `127.0.0.1`.

**Aller droit à la question du moment** — la comparaison qui décide D1, sur l'écran
de référence :

```
http://127.0.0.1:8150/#etat=joueur-complet&var=duo&w=375&vue=visible&x13=0&onglet=decisions
```

À gauche le Profil refondu (contrôle informé), à droite le Profil de production sur
les MÊMES données bouchonnées — avec ses mensonges tels quels (« En forme » sur
l'amorce +3, sept barres identiques, « Club / match : 0 sem », « Tests ce mois : 0 »,
« PLAYLIST »). Le panneau « Décisions » liste les 6 questions, chacune avec ses
options, sa recommandation et son coût mesuré.

Raccourcis : `↑` `↓` état · `v` variante (pur / informé / actuel / côte à côte) ·
`w` largeur (320 / 375 / 390) · `e` vue (zone visible / page entière) · `t` texte ×1,3
(généré en 375 uniquement). L'URL garde l'état courant : elle se partage telle quelle.

Le châssis du téléphone est **mis à l'échelle** pour tenir dans la fenêtre (« affiché
à N % » sous le cadre — les mesures restent en pixels logiques). En vue « zone
visible », ce qui touche la ligne rouge continue sous la barre d'onglets : sur le
téléphone, ça défile.

Options de mise au point : `FKS_ETATS=…`, `FKS_LARGEURS=…`, `FKS_SETTLE=…` (ms),
`PORT=…` — une génération partielle est signalée en haut du visualiseur.
`build.js` vide `out/pages/` avant d'écrire : relance sans filtre avant de mesurer.

---

## Vérifier

```
node prototype/profil/verifier.js               # tout
node prototype/profil/verifier.js typescript    # type-check ciblé (tsconfig.proto.json)
node prototype/profil/verifier.js tests         # jest ciblé (jest.proto.config.js)
node prototype/profil/verifier.js statique      # analyse du HTML généré, sans navigateur
node prototype/profil/verifier.js mesures       # mesures dans un vrai navigateur (Chrome/Edge headless)
node prototype/profil/verifier.js idempotence   # deux builds successifs, empreintes SHA-1
```

Verdict chiffré, jamais « ça a l'air bon » ; un contrôle qui n'a pas pu tourner sort
en `NON_EXECUTE` avec sa raison. Ce qui est vérifié : TypeScript, les 152 tests, la
présence des 168 pages et du marqueur d'écran, les hauteurs réelles (navigateur), la
position des 3 usages réels vs la ligne de flottaison, zéro libellé d'état de forme
(`FOOTBALL_LABELS` lus dans le produit) / « Série » / « Trophée » / « PLAYLIST » /
« TSB », le fait cycle recoupé fixture ↔ ViewModel ↔ page, les 22 chemins autorisés
du ViewModel (liste écrite à la main), les tactiles ≥ 44 pt, le contraste WCAG sur
les couleurs réellement rendues, le 320 px + ×1,3, et l'idempotence.

**État connu au 07/08** : 11 PASS · 1 FAIL assumé — à 320 px, « Réglages » et
« Mes séances passées » passent sous la flottaison (~546 et ~591 px pour 519
visibles). C'est la décision **D6** du panneau, pas un bug à corriger en douce.
Le rapport de hauteurs vit dans `outputs/profil-prototype-2026-08-07/`.

Les pages du **Profil de production** ne sont pas idempotentes (52/56 diffèrent
entre deux builds) : son animation d'entrée (`Animated.stagger`, 9 × 350 ms) ignore
« réduire les animations » et se termine après la capture. Identifié, rapporté,
hors périmètre du prototype.

---

## Ce qui est fidèle, ce qui ne l'est pas

**Fidèle** — la mise en page (mêmes composants, même moteur flexbox), les tailles de
texte, les couleurs, les rayons, les espacements, l'échelle typo du Home (allégée),
les insets par appareil, la coupe à la ligne de flottaison.

**Pas fidèle** — la police (système au lieu de San Francisco), le mouvement (figé),
le retour haptique, et le texte ×1,3 qui est une simulation (le vrai Dynamic Type
redistribue aussi des marges). Le côté « Profil actuel » est alimenté par des stores
bouchonnés : les approximations sont listées dans `lib/scenariosProfil.js` et dans
l'onglet « Limites » du visualiseur.

## Deux configurations dédiées, et pourquoi

- `tsconfig.proto.json` — le tsconfig racine pointe un `typeRoots` qui n'existe pas
  dans un worktree (~1 500 fausses erreurs). Périmètre limité à `profilVNext`,
  `strict` intact.
- `jest.proto.config.js` — la config du dépôt ignore `.claude/worktrees/` : depuis un
  worktree, `npx jest` liste 0 test et sort en succès. Celle-ci pose `rootDir` sur le
  worktree et ne ramasse que `__tests__/profilVNext/`.

## Garanties

Aucun appel réseau, aucun accès Firestore (`services/firebase` remplacé par un stub
inerte avant chargement), aucune écriture hors de `out/`, du cache temporaire système
et de `outputs/`. Le Profil de production (`screens/ProfileScreen.tsx`) est lu, jamais
modifié. Toutes les données affichées sont inventées — chaque page le dit, et un
bandeau permanent le rappelle.
