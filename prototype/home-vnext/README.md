# Harnais de rendu — prototype Home vNext

Outil de démonstration. Il sert à **regarder** l'écran d'accueil proposé, état par état,
format par format, à côté du Home de production — sans téléphone, sans compte, sans réseau.

Ce n'est ni un test, ni une brique de l'application. Rien de ce dossier n'entre dans le
bundle Expo : `prototype/` n'est importé par aucun écran.

---

## Lancer

Depuis la racine du worktree :

```
node prototype/home-vnext/build.js     # génère toutes les pages dans prototype/home-vnext/out/
node prototype/home-vnext/serve.js     # sert le visualiseur sur http://127.0.0.1:8140/
node prototype/home-vnext/verifier.js  # exécute toutes les vérifications et rend un verdict chiffré
```

Si 8140 est occupé, `serve.js` prend le port libre suivant et **affiche l'URL réelle**.
Le serveur n'écoute que sur `127.0.0.1` : rien n'est exposé sur le réseau.

Aucune installation. Aucune dépendance nouvelle. Tout est déjà dans `node_modules`
(`react-native-web`, `jsdom`, `@babel/core`). **Ne lance jamais `npm install`.**

### Options de mise au point

| Variable | Effet |
|---|---|
| `FKS_SETTLE=200` | temps laissé aux effets pour se stabiliser, en ms (défaut 900) |
| `FKS_ETATS=hors-ligne,nouveau-joueur` | ne génère que ces états |
| `FKS_LARGEURS=375` | ne génère que ces largeurs |
| `PORT=9000` | port de départ de `serve.js` |

Une génération partielle est **signalée en haut du visualiseur** : impossible de croire
par erreur qu'on regarde le lot complet.

> **Attention** : `build.js` vide `out/pages/` avant d'écrire. Une génération filtrée par
> `FKS_ETATS` laisse donc *uniquement* les états demandés sur le disque. Relance sans
> filtre avant de regarder ou de mesurer.

---

## Vérifier

```
node prototype/home-vnext/verifier.js               # tout
node prototype/home-vnext/verifier.js typescript    # type-check ciblé du prototype
node prototype/home-vnext/verifier.js tests         # tests du prototype
node prototype/home-vnext/verifier.js statique      # analyse du HTML généré, sans navigateur
node prototype/home-vnext/verifier.js mesures       # mesures dans un vrai navigateur
node prototype/home-vnext/verifier.js idempotence   # deux builds successifs, empreintes comparées
```

Le verdict est chiffré, jamais « ça a l'air bon ». Une vérification qui n'a pas pu tourner
sort en `NON_EXECUTE` **avec sa raison** — jamais en `PASS` par défaut.

Ce que ça vérifie, et comment :

| # | Vérification | Méthode |
|---|---|---|
| a | TypeScript du prototype | `tsc -p tsconfig.proto.json` — périmètre limité aux 3 dossiers du prototype |
| b | Tests du prototype | `jest --config jest.proto.config.js` |
| c | Rendu de tous les états aux 4 largeurs | présence des pages + aucune page d'erreur + chargement réel |
| d | Texte ×1,3 | recouvrement de deux textes, débordement du cadre, troncatures listées |
| e | **Une seule action principale** | comptage de `data-testid="home-vnext-action-principale"` sur chaque page **et** comptage des aplats colorés dans le rendu |
| f | Aucun faux état de forme | courbe interdite hors `form.kind === "available"`, libellé d'état interdit sans autorisation du ViewModel, zéro ATL/CTL/TSB, zéro chiffre dans le tracé |
| g | Aucune « série » | HTML rendu **et** sources de `screens/homeVNext` + `components/homeVNext` |
| h | Aucune métrique supposée | la portée de la mesure doit être écrite ; le compteur de semaine est recoupé avec les séances réellement terminées |
| i | Rien sous la barre d'onglets | vide réel en bas d'écran, mesuré |
| j | Zones tactiles ≥ 44 pt | hauteur rendue de chaque élément `button` / `link` / focusable |
| k | Contraste WCAG | ratio calculé sur les **couleurs réellement rendues**, fond effectif reconstitué en remontant les parents |
| l | Textes longs | fixture `stress-textes-longs`, rendue aux 4 largeurs + ×1,3 |
| m | Idempotence | deux builds, empreinte SHA-1 de chaque fichier produit |

**Pourquoi un vrai navigateur** : `jsdom` n'a aucun moteur de mise en page — toute hauteur y
vaut 0. Les hauteurs, les zones tactiles, les débordements et les contrastes ne peuvent être
mesurés que dans un moteur de rendu réel. Le vérificateur lance Chrome (ou Edge) sans
interface, lui sert les pages depuis un serveur éphémère, et récupère le JSON par
`--dump-dom`. Aucun pilote à installer.

**Deux configurations dédiées, et pourquoi elles existent** :

- `tsconfig.proto.json` — le `tsconfig.json` de la racine pointe `typeRoots` sur
  `./node_modules/@types`, qui **n'existe pas dans un worktree** (le `node_modules` est
  partagé, deux niveaux plus haut). TypeScript ne trouvait donc plus aucune définition et
  sortait ~1 500 fausses erreurs. Cette configuration repointe `typeRoots` et limite le
  périmètre. Aucune règle n'est assouplie : `strict` reste actif.
- `jest.proto.config.js` — la config jest du dépôt ignore `.claude/worktrees/`. Depuis un
  worktree, `npx jest` liste **0 test et sort en succès**. Cette configuration pose
  `rootDir` sur le worktree et ne ramasse que `__tests__/homeVNext/`.

---

## Ce que le visualiseur permet

- choisir l'un des 15 états (liste latérale, groupée par situation) — les 14 états produit,
  plus `stress-textes-longs`, qui n'est pas un état produit mais un test de résistance de
  la mise en page ;
- basculer entre **Proposition vNext** / **Home actuel** / **Côte à côte 375** ;
- changer de largeur : **320 / 375 / 390 / 768** ;
- changer de vue : **zone visible sans défilement** / **page entière** ;
- activer la variante **texte ×1,3** (générée en 375 px uniquement) ;
- lire, dans un panneau **séparé de l'écran produit** : les points à valider, les seuils
  d'affichage, les contrastes mesurés, les avertissements du prototype (`protoWarnings`)
  et ce que le harnais ne reproduit pas.

Raccourcis clavier : `↑` `↓` changent d'état, `v` change de variante, `e` change de vue,
`p` masque les panneaux. L'URL garde l'état courant : elle peut être partagée telle quelle.

Les `protoWarnings` s'affichent **dans le panneau, jamais dans l'écran produit** : le
joueur ne doit pas lire les notes de chantier.

---

## Le calcul de la zone visible

Ce que le joueur voit sans défiler n'est pas la hauteur de l'écran :

```
hauteur disponible pour l'écran = hauteur d'écran − (49 pt de tab bar + inset bas)
hauteur réellement lisible       = hauteur disponible − inset haut
```

| Largeur | Écran | Inset haut | Inset bas | Disponible | Lisible |
|---|---|---|---|---|---|
| 320 | 568 | 20 | 0 | **519** | **499** |
| 375 | 812 | 44 | 34 | **729** | **685** |
| 390 | 844 | 47 | 34 | **761** | **714** |
| 768 | 1024 | 20 | 0 | **975** | **955** |

Le cadre affiché représente **tout l'écran physique** : la marge d'encoche est dessinée
par l'application elle-même (`components/ui/Screen.tsx`), donc la première ligne de texte
apparaît `inset haut` pixels plus bas. Le trait rouge est la ligne de flottaison.

Les valeurs d'insets sont les valeurs iOS publiées par appareil ; elles ne sont pas
mesurées sur un téléphone réel. À confirmer en recette téléphone.

---

## Comment ça marche

```
build.js                 orchestration : rend, écrit les pages, écrit le manifeste
serve.js                 serveur statique local, repli de port automatique
verifier.js              les vérifications, et leur verdict chiffré
tsconfig.proto.json      type-check ciblé (contourne le typeRoots cassé en worktree)
jest.proto.config.js     tests ciblés (contourne l'exclusion des worktrees)
types/                   déclaration locale pour react-test-renderer (@types absent du dépôt)
lib/
  mesureTemplate.js      la page que le navigateur exécute pour mesurer
  paths.js               racines déduites de __dirname (aucun chemin machine en dur)
  hook.js                hook require : transpilation babel + détournement des imports
  dom.js                 environnement jsdom + mesures onLayout approchées
  devices.js             les 4 formats et le calcul de la zone visible
  render.js              le moteur : un seul pipeline pour les deux variantes
  pageTemplate.js        gabarit d'une page d'écran (HTML statique, sans JS)
  viewerTemplate.js      le visualiseur (HTML + CSS + JS)
  scenariosActuel.js     jeux de données fictives pour le Home de production
  mapping.js             correspondance états vNext ↔ scénarios, et ses approximations
  pointsAValider.js      les 12 questions posées au fondateur
  limites.js             ce que le harnais ne reproduit pas
  stubs/                 modules natifs remplacés
out/                     tout le contenu généré (non versionné volontairement)
```

Le cache de transpilation vit dans le dossier temporaire du système, pas dans le dépôt.

### Point d'attention (déjà tombé dedans)

Dans `lib/render.js`, **jsdom doit être chargé avant `react-native-web`**. La feuille de
style de react-native-web s'initialise à l'import : sans document, elle bascule en mode
« serveur » et n'injecte plus jamais ses règles. Les pages sortent alors sans aucun style.
Un garde-fou dans `build.js` refuse silencieusement ce cas : il crie si la feuille extraite
fait moins de 3 000 caractères.

---

## Ce qui est fidèle, ce qui ne l'est pas

**Fidèle** — la mise en page (mêmes composants, même moteur de flexbox), les tailles de
texte, les couleurs, les rayons, les espacements, la géométrie des courbes (calculée par
le vrai code produit), les insets par appareil, la coupe au-dessus de la ligne de
flottaison (la zone de défilement coupe toute seule, comme sur le téléphone).

**Pas fidèle** — le dessin des icônes (carrés arrondis à la bonne taille), la police
(système au lieu de San Francisco : quelques pourcents d'écart sur les retours à la ligne),
le mouvement (tout est figé à l'état d'arrivée), le flou, les dégradés, les images, le
retour haptique, et le texte ×1,3 qui est une **simulation** — le vrai Dynamic Type d'iOS
redistribue aussi des marges.

La liste complète, avec le détail module par module, est dans le panneau
**« Seuils et limites »** du visualiseur et dans `lib/limites.js`.

---

## Garanties

- Aucun appel réseau, aucun appel backend, aucune génération de séance.
- Aucun accès Firestore : `services/firebase` est remplacé par un objet inerte **avant**
  d'être chargé.
- Aucune écriture disque hors de `out/` et du cache temporaire.
- Le Home de production (`screens/HomeScreen.tsx`, `components/home/`, `hooks/home/`) est
  lu, jamais modifié.
- Toutes les données affichées sont inventées. Chaque page le dit, chaque écran porte une
  pastille « FICTIF », et un bandeau permanent le rappelle en haut du visualiseur.
