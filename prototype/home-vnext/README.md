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

**Aller droit à la question du moment** — les 7 axes à trancher, sur l'écran de référence :

```
http://127.0.0.1:8140/#etat=v2-tendance-disponible&var=vnext2&w=375&vue=visible&x13=0&typo=allegee&anim=0&onglet=axes
```

Le panneau de droite pose un axe à la fois — typographie, densité, hauteur, lisibilité, carte
Progression, pied secondaire, absence de pastille globale. Chaque axe dit **quel réglage
manipuler**, et ses boutons posent la **combinaison entière** (état, variante, largeur, vue,
texte, présentation) d'un seul clic.

**La comparaison typographique** se fait en martelant la touche `t` sans quitter l'écran des
yeux : seule la typographie change, les mots sont identiques.

**Variante 1 contre variante 2**, à 375 px :

```
http://127.0.0.1:8140/#etat=v2-tendance-disponible&var=duo&paire=v1v2&w=375&vue=entiere&x13=0&typo=allegee&anim=0&onglet=axes
```

À gauche l'écran validé, qui finit sur le lien flottant « Voir ma progression » et garde sa
pastille d'état dans l'en-tête. À droite le même écran, où ce lien a disparu au profit d'une
carte et où la pastille n'existe plus. Les autres cas s'atteignent en un clic dans la liste
latérale, ou avec `↓`.

Aucune installation. Aucune dépendance nouvelle. Tout est déjà dans `node_modules`
(`react-native-web`, `jsdom`, `@babel/core`). **Ne lance jamais `npm install`.**

### Options de mise au point

| Variable | Effet |
|---|---|
| `FKS_SETTLE=200` | temps laissé aux effets pour se stabiliser, en ms (défaut 900) |
| `FKS_ETATS=hors-ligne,nouveau-joueur` | ne génère que ces états. Un cas de variante 2 dont l'écran d'accueil n'est pas dans la liste est **ignoré, avec une alerte** — jamais posé sur un autre écran en douce |
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

`__tests__/homeVNext/visualiseurAxes.test.ts` verrouille le panneau « Valider » lui-même :
les 7 axes existent et portent chacun **deux verdicts séparés** ; aucune cible ne pointe sur
un état, une largeur, une vue, une paire ou une présentation qui n'existe pas (une faute de
frappe dans un identifiant afficherait sinon « état non généré » à la place du bouton, sans
rien casser) ; les 8 situations demandées sont couvertes ; et la combinaison de présentation
par défaut ne passe **aucune** prop à l'écran.

**Pourquoi un vrai navigateur** : `jsdom` n'a aucun moteur de mise en page — toute hauteur y
vaut 0. Les hauteurs, les zones tactiles, les débordements et les contrastes ne peuvent être
mesurés que dans un moteur de rendu réel. Le vérificateur lance Chrome (ou Edge) sans
interface, lui sert les pages depuis un serveur éphémère, et récupère le JSON par
`--dump-dom`. Aucun pilote à installer.

### La variante 2 a son propre vérificateur

```
node prototype/home-vnext/verifier-variante2.js
```

`verifier.js` juge les 150 pages de la variante 1. Il ne regarde **pas** les 60 pages de la
variante 2 : elles n'existaient pas quand il a été écrit. Ce second fichier fait le même
travail, avec les mêmes outils, les mêmes seuils et le même moteur de mesure, plus les règles
qui n'existent que pour la carte.

| # | Vérification | Méthode |
|---|---|---|
| 0 | Les 60 pages existent et ne sont pas des pages d'erreur | présence + absence du gabarit « carte non détectée » |
| d1 | Une seule action principale | comptage du marqueur sur les **210** pages (150 v1 + 60 v2) |
| d2 | **R8** — un seul aplat, et **aucun dans la carte** | couleurs réellement rendues, opacité effective comprise ; l'appartenance à la carte vient du nœud `home-vnext-progression` |
| d3 | Deux tactiles ne portent pas le même libellé visible | texte visible de chaque lien/bouton, sur les **60** pages, groupé par texte |
| f | **R4** — aucun état physique global dans la carte | texte rendu de la carte seule |
| f2 | **D1 sur l'écran** — aucune pastille d'état du jour, **quelles que soient les données** | marqueur `home-vnext-etat-du-jour` sur les 60 pages, **attendu 0 écrit en clair**. Il était déduit de `chargesClubCapturees` via un champ `etatGlobal` depuis **supprimé du contrat** : l'expression valait donc toujours 0 et le contrôle ne protégeait plus rien. Second filet dans l'audit d'appariement (`etat_global_entete`) : les libellés de `FOOTBALL_LABELS` sont aussi comptés dans le texte de l'**écran entier**, pour le cas où un état reviendrait ailleurs que dans une pastille |
| g | **R5** — pas de courbe sans vrais points | attendu déduit de `progVm.state`, jamais d'une liste écrite à la main |
| h | **R6** — aucune « série » | HTML rendu + sources, commentaires retirés |
| i | **R7** — pas de redite avec « Ma semaine » | nombres **lus dans le HTML**, des deux côtés |
| j | **R3** — portée présente et mot pour mot | texte rendu comparé à `courbe.portee` |
| k | Sens d'un écart de test | recalculé depuis l'écart signé **et** `lowerIsBetter`, puis comparé au mot affiché |
| l | Accessibilité de la carte | un seul focusable, jamais imbriqué, ≥ 44 pt, `aria-label` explicite |
| m | 320 px et ×1,3 | débordement, chevauchement, **et troncature réelle dans la carte** (échec, pas observation) |
| n | Rien sous la barre d'onglets | vide réel en bas d'écran, hypothèse d'inset écrite dans le rapport |
| o | Contraste WCAG des textes **de la carte** | ratio sur les couleurs rendues, fond effectif reconstitué |

Il écrit `outputs/home-vnext-prototype-2026-07-27/mesures-hauteurs-variante2.md` : la hauteur
de page **variante 1 contre variante 2**, état par état et largeur par largeur. C'est ce que la
carte coûte en hauteur par rapport au lien qu'elle remplace.

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

- choisir l'un des **15 états de la variante 1** (liste latérale, groupée par situation) —
  les 14 états produit, plus `stress-textes-longs`, qui n'est pas un état produit mais un
  test de résistance de la mise en page ;
- choisir l'un des **7 cas de la variante 2** (groupes `Variante 2 —` en bas de la liste) :
  les 6 cas de démonstration de la carte progression, plus `v2-donnee-manquante`, qui n'est
  pas un état produit mais la preuve visuelle de R1 (un fait sans donnée disparaît) ;
- basculer entre **Proposition vNext** / **Progression intégrée** / **Home actuel** /
  **Côte à côte** ;
- en côte à côte, choisir la **paire** : `vNext / Progression` (variante 1 contre variante 2,
  la question du fondateur), `Actuel / vNext`, `Actuel / Progression` ;
- changer de largeur : **320 / 375 / 390 / 768** ;
- changer de vue : **zone visible sans défilement** / **page entière** ;
- activer la variante **texte ×1,3** (générée en 375 px uniquement) ;
- changer de **typographie** (« Allégée » / « Actuelle ») et d'**animations** (« Normales » /
  « Réduites ») — voir la section suivante ;
- lire, dans un panneau **séparé de l'écran produit** : les 7 axes à trancher séparément, la
  règle de sélection du test et le tableau cycle → test, la hauteur mesurée et ce qui passe
  sous la ligne de flottaison, les seuils d'affichage des deux contrats, la portée de la
  tendance et le verdict R4 pour l'état courant, les contrastes mesurés, les avertissements
  du prototype (`protoWarnings`) et ce que le harnais ne reproduit pas.

Raccourcis clavier : `↑` `↓` changent d'état, `v` change de variante (en sautant celles
qui n'existent pas sur l'état courant), `c` passe en côte à côte puis fait tourner la
paire, `e` change de vue, `p` masque les panneaux, `t` bascule la typographie, `a` bascule
les animations, `w` alterne 320 / 375 px. L'URL garde l'état courant : elle peut être
partagée telle quelle.

### L'axe présentation : typographie × mouvement

Deux réglages qui ne changent **aucune donnée** — ils changent comment elle est posée. Les
deux sont des props de `HomeVNextScreen` (`echelle`, `reduceMotion`) : le harnais ne
fabrique rien, il passe les valeurs que l'app passera. Les quatre combinaisons viennent de
`PRESENTATIONS_A_COMPARER` (`components/homeVNext/homeVNextPresentation.tsx`), jamais d'une
liste recopiée dans le harnais.

- La combinaison **par défaut** (allégée, animations normales) est générée aux 4 largeurs, et
  ses fichiers gardent **exactement le nom qu'ils avaient** : les pages déjà validées ne
  bougent pas.
- Les trois autres sont générées en **320 et 375 px**, les deux largeurs où la typographie se
  joue. Ailleurs, le cadre affiche la présentation par défaut **et le dit**.
- Le **Home de production** n'a ni `echelle` ni `reduceMotion` : sa colonne reste toujours sur
  la présentation par défaut, et le cadre l'écrit. C'est un fait du produit, pas un manque du
  harnais.

**« Réduire les animations » ne se voit pas, et c'est le résultat voulu.** Au repos, les deux
rendus sont identiques à l'œil. Ce qui se prouve est dans le balisage : le bouton du jour
porte une consigne de mouvement dans un cas, aucune dans l'autre. Le panneau « Cet état »
affiche les quatre combinaisons côte à côte — c'est le tableau entier qui fait la preuve, pas
une seule ligne.

### Ce que la vérification de reproductibilité a trouvé

Deux générations successives produisent des fichiers **rigoureusement identiques** pour la
proposition et pour la carte progression. Les seules pages qui diffèrent sont celles du
**Home de production**, toujours au même endroit : l'échelle de son bouton principal
(`1.014793…` puis `1.014800…`). Cause : `components/home/HomePrimaryCTA.tsx` joue une
pulsation **en boucle infinie** sans jamais consulter `reduceMotion`.

Le harnais **force** « mouvement réduit » avant chaque rendu. Si ce bouton consultait le
réglage, il serait immobile. Il pulse quand même : c'est la démonstration, sur un fichier,
que la préférence d'accessibilité n'est pas respectée en production. Hors périmètre, non
corrigé — mais **mesuré et affiché** dans l'onglet « Limites ».

### La variante 2 ne peut pas être servie par erreur

La carte progression a ses propres jeux de données, écrits sans écran autour. Le harnais la
pose donc sur un écran d'accueil existant, et **il ne peut pas mentir sur ce qu'il montre** :

- après chaque rendu, il cherche le marqueur `home-vnext-progression` dans le HTML produit.
  Absent, la page n'est **pas servie** : elle est remplacée par une page d'explication qui
  dit si l'écran a réagi ou non, ce qui manque, et la seule ligne à corriger. Afficher la
  variante 1 sous l'étiquette « Progression intégrée » ferait valider un écran inexistant ;
- l'appariement entre l'écran et la carte est **audité à chaque génération** (12 contrôles
  chiffrés par état et par largeur, plus 5 points de cohérence). Un écart non déclaré lève
  une alerte de génération ; un écart déclaré s'affiche en rouge sur l'état concerné, avant
  qu'on le regarde ;
- `__tests__/homeVNext/appariementVariante2.test.ts` verrouille la condition qui rend
  l'assemblage honnête : « Ma semaine » doit afficher **exactement** le nombre contre lequel
  la carte a calculé son garde-fou R7.

Trois des sept cas portent un écart déclaré. Il ne se voit **jamais sur l'écran de la
variante 2** (l'écran y absorbe le bloc « Ma forme » et le lien flottant) mais **en côte à
côte**, où les deux colonnes tracent alors deux séries différentes ou annoncent deux comptes
différents. C'est un artefact d'assemblage du prototype, pas une proposition de produit.

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
verifier.js              les vérifications de la variante 1, et leur verdict chiffré
verifier-variante2.js    les mêmes, sur les 60 pages de la carte progression,
                         + le tableau de hauteurs variante 1 contre variante 2
tsconfig.proto.json      type-check ciblé (contourne le typeRoots cassé en worktree)
jest.proto.config.js     tests ciblés (contourne l'exclusion des worktrees)
types/                   déclaration locale pour react-test-renderer (@types absent du dépôt)
lib/
  mesureTemplate.js      la page que le navigateur exécute pour mesurer
  paths.js               racines déduites de __dirname (aucun chemin machine en dur)
  hook.js                hook require : transpilation babel + détournement des imports
  dom.js                 environnement jsdom + mesures onLayout approchées
  devices.js             les 4 formats et le calcul de la zone visible
  render.js              le moteur : un seul pipeline pour les trois variantes
  pageTemplate.js        gabarit d'une page d'écran (HTML statique, sans JS)
  viewerTemplate.js      le visualiseur (HTML + CSS + JS)
  scenariosActuel.js     jeux de données fictives pour le Home de production
  mapping.js             correspondance états vNext ↔ scénarios, et ses approximations
  appariementVariante2.js  où la carte progression est posée, ce que ça coûte,
                           la détection du rendu et l'audit de cohérence
  presentations.js       l'axe typographie × mouvement : quelles combinaisons sont
                         générées, à quelles largeurs, et la mesure du mouvement
  axesAValider.js        les 7 axes à trancher séparément + les 8 situations couvertes
  iteration.js           ce qui a changé depuis l'itération précédente, et ce qui
                         est rejouable par une bascule ou seulement chiffrable
  pointsAValider.js      les 12 + 14 questions posées au fondateur (le détail,
                         point par point — les axes en sont la vue de décision)
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
