# Prototype Home vNext — à regarder

---

## POUR LANCER

Ouvre un terminal, place-toi dans le dossier du worktree, et lance ces deux lignes :

```
cd C:\Users\Gamer\front-fks\.claude\worktrees\home-vnext-prototype
node prototype/home-vnext/serve.js
```

## PUIS OUVRE

# http://127.0.0.1:8140/

C'est tout. Pas d'installation, pas de téléphone, pas de compte, pas de connexion.

> **Le port change parfois.** Si 8140 est déjà pris, le serveur prend tout seul le
> suivant et **affiche l'URL réelle** dans le terminal (`Visualiseur : http://127.0.0.1:8141/`).
> C'est cette ligne-là qui fait foi, pas celle du titre ci-dessus. Au moment où ces
> captures ont été faites, le serveur répondait sur **8141**.

> Si les pages n'existent pas encore (dossier `prototype/home-vnext/out/` vide),
> lance d'abord `node prototype/home-vnext/build.js`, puis relance le serveur.

Pour arrêter : `Ctrl+C` dans le terminal.

---

## Ce que c'est

Une **maquette qui fonctionne** de l'écran d'accueil proposé, en 14 situations de jeu
différentes, à côté du Home actuel, avec les vrais composants et le vrai thème du projet.

C'est le prolongement direct de l'audit de juillet
(`docs/home-audit-2026-07/` dans l'autre worktree) : l'audit disait ce qui ne va pas,
ce prototype montre à quoi ça ressemblerait si on le réparait.

## Ce que ce n'est PAS

- **Ce n'est pas en production.** Le Home actuel de l'app n'a pas bougé d'un octet.
  La preuve chiffrée est dans [`FICHIERS_NON_MODIFIES.md`](FICHIERS_NON_MODIFIES.md).
- **Ce n'est pas branché.** Aucune donnée réelle, aucun Firestore, aucun backend,
  aucune génération de séance. Tous les chiffres et tous les textes sont inventés,
  et chaque page le dit en toutes lettres.
- **Ce n'est pas l'implémentation finale.** C'est une proposition à valider ou à
  refuser, écran par écran, avant qu'une ligne de code de production soit écrite.
- **Ce n'est pas un test sur téléphone.** C'est un rendu dans un navigateur.
  Ce qu'il ne peut pas prouver est listé dans [`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md).

---

## Comment naviguer dans le visualiseur

L'écran se lit en trois colonnes.

**À gauche — la liste des situations.** Les 14 situations produit, rangées par famille :
le quotidien, les premiers pas et le retour, ce que l'app sait mesurer, quand ça casse,
avec ou sans club. Plus une 15ᵉ entrée, « Textes longs », qui n'est pas une situation
produit mais un test de résistance de la mise en page.

**Au milieu — l'écran.** Le cadre représente tout l'écran physique du téléphone.
Trois repères sont dessinés par l'outil (ils n'existent pas dans l'app) :

| Repère | Ce que ça veut dire |
|---|---|
| trait gris pointillé en haut | fin de la zone système (heure, batterie, encoche) |
| **trait rouge** | **la ligne de flottaison** : en dessous, il faut faire défiler |
| rectangle hachuré rouge en bas | la barre d'onglets — ce qui est dessous est masqué |

**En haut — les boutons de bascule.**

- **Variante** : `Proposition vNext` / **`Progression intégrée`** / `Home actuel` / `Côte à côte`.
  C'est le bouton le plus utile : `Côte à côte` met deux versions l'une à côté
  de l'autre, même situation, mêmes réglages. **`Progression intégrée` est la variante 2**,
  celle que tu as demandée après avoir validé la variante 1 (voir la section dédiée plus bas).
  En `Côte à côte`, choisis la paire **`vNext / Progression`** : c'est la comparaison
  variante 1 contre variante 2.
- **Largeur** : `320` (vieil iPhone SE) · `375` (iPhone 13 mini, la référence) ·
  `390` (iPhone récent) · `768` (tablette).
- **Vue** : `Zone visible sans défilement` (ce que le joueur voit vraiment en ouvrant
  l'app — **c'est la vue honnête**) / `Page entière` (tout le contenu, rien n'est coupé —
  vue d'exploration, elle ne montre pas ce que voit le joueur).
- **Texte** : `x1` / `x1.3` — simulation d'un joueur qui a grossi la police de son téléphone.

**À droite — les panneaux.** Quatre onglets : *Points à valider* (les 12 questions sur
lesquelles tu dois te prononcer), *Seuils et limites*, *Cet état* (ce que la maquette
affirme et pourquoi), *Hauteurs*.

Raccourcis clavier : `↑` `↓` changent de situation, `v` change de variante,
`e` change de vue, `p` masque les panneaux.

---

## Les 14 situations, une ligne chacune

| # | Situation | Ce qu'on y regarde |
|---|---|---|
| 1 | **Nouveau joueur** | Compte tout neuf. L'app n'a rien mesuré : elle ne doit rien affirmer. |
| 2 | **Séance prévue aujourd'hui** | Le cas normal. La séance est là, et l'écran dit *pourquoi celle-là*. |
| 3 | **Séance à reprendre** | Séance lancée puis abandonnée en cours de route. |
| 4 | **Séance terminée** | La journée est faite. L'écran doit accuser réception, pas s'éteindre. |
| 5 | **Jour de récupération** | La récup est **prescrite** par le programme, pas devinée par l'écran. |
| 6 | **Jour sans séance prévue** | Rien de prêt, et un match noté demain. |
| 7 | **Reprise après 24 jours** | Le cas le plus fréquent chez un amateur, et le pire aujourd'hui. |
| 8 | **Tendance indisponible** | 2 séances : assez pour agir, pas assez pour tracer une courbe. |
| 9 | **Tendance disponible** | 5 séances : la courbe s'affiche, avec ce sur quoi elle est calculée. |
| 10 | **Erreur de génération** | La préparation a échoué. L'écran le dit et propose de réessayer. |
| 11 | **Hors-ligne** | Ça marche quand même, mais l'écran prévient que ça peut dater. |
| 12 | **Aucune directive club** | Joueur sans club : l'écran est complet, aucun trou. |
| 13 | **Directive club non appliquée** | Le coach a donné une consigne que le moteur n'a pas prise. |
| 14 | **Joueur autonome sans club** | Ni club ni coach : l'écran tient tout seul. |

Le détail — ce que chaque situation **prouve** et l'action attendue — est dans
[`FIXTURES.md`](FIXTURES.md).

---

# VARIANTE 2 — la carte « Ma progression »

## Ce que tu as demandé

Tu as regardé la variante 1 et validé le CTA, la ligne « Pourquoi » et « Ma semaine ».
Ta seule réserve portait sur **le bas de l'écran** : le lien « Voir ma progression »
flotte tout seul sous la dernière carte, il a l'air d'avoir été ajouté après coup.

La variante 2 ne change **que ça** : le lien devient une **vraie carte de contenu**,
et le lien devient le **pied de cette carte**, sous un filet, à l'intérieur de la même
surface. Plus de lien orphelin. Il garde ses mots — « Voir ma progression » — parce qu'il
mène au même écran : ce qui change, c'est sa place, pas sa destination.

**La variante 1 n'a pas bougé.** Elle est toujours là, entière, dans le sélecteur —
c'est bien une comparaison, pas un remplacement.

## Comment y accéder

Dans le visualiseur, en haut à gauche :

| Pour voir | Clique sur |
|---|---|
| la variante 2 seule | **Variante → `Progression intégrée`** |
| variante 1 **contre** variante 2 | **Variante → `Côte à côte`**, puis la paire **`vNext / Progression`** |
| le Home actuel contre la variante 2 | **Variante → `Côte à côte`**, puis **`Actuel / Progression`** |

Les 6 cas de la carte apparaissent dans la liste de gauche avec l'identifiant `v2-…`.
Le panneau de droite « **Points à valider** » contient **12 questions spécifiques à la
variante 2** : chaque bouton t'emmène directement sur l'état concerné.

## Les 5 cas à regarder (plus une preuve)

La carte n'a que **trois états**. Ce n'est pas une carte qui « se remplit » petit à petit :
elle change de nature selon ce que l'app sait vraiment. Le détail en français simple est
dans [`VIEWMODEL_PROGRESSION.md`](VIEWMODEL_PROGRESSION.md).

| # | Cas | État | Ce que tu dois vérifier |
|---|---|---|---|
| 1 | **Nouveau joueur** | `empty` | Trois repères numérotés et une mention honnête. **Aucun graphique, aucun bouton.** La page Progression n'a pas une seule ligne vraie pour ce joueur : on ne l'y envoie pas. |
| 2 | **Deux séances, tendance indisponible** | `collecting` | Quatre faits **réellement mesurés** : 2 séances / 76 min / 2 ressentis / « Encore 2 séances ». Le « Encore 2 » est **calculé**, pas écrit en dur. Toujours aucun bouton. |
| 3 | **Tendance disponible** | `ready` | La courbe s'affiche **avec sa portée exacte** juste en dessous. Le pied « Voir ma progression » apparaît, en lien discret. Et un test refait deux fois : saut en longueur 205 → 214 cm, **+9 cm** — le sens « plus grand = mieux ». |
| 4 | **Test physique amélioré** | `ready` | La carte affiche le **sprint 10 m : 1,85 → 1,78 s, soit « −0,07 s »**. Un chiffre négatif qui est une bonne nouvelle : sur un sprint, mieux veut dire plus petit, et c'est le mot « en progrès » qui le dit — jamais une flèche. Le saut en longueur (218 → 227 cm) est calculé lui aussi, la carte n'en montre qu'un : le plus récent. |
| 5 | **Aucune comparaison de test** | `ready` | Quatre tests existent, **aucune paire comparable** : deux essais du 6 min le **même jour**. La page Progression actuelle afficherait ici une fausse progression de +35 m. La carte explique pourquoi elle ne compare pas. |
| — | **Donnée manquante** *(preuve, hors des 5)* | `collecting` | 3 séances, **aucune durée ni ressenti connus**. Les deux faits **disparaissent**. Ni « 0 min », ni « — », ni tiret. C'est la règle la plus importante du lot. |

## Les 4 questions que la variante 2 pose vraiment

### 1. Est-ce que la carte remplace le lien, ou est-ce qu'elle s'ajoute ?

Mets-toi en `Côte à côte`, paire `vNext / Progression`, largeur 375, et **descends
jusqu'en bas des deux colonnes**.

Les **mêmes mots** des deux côtés, ce n'est pas un oubli : le lien mène au même écran, il
a donc gardé son libellé. Ce qui change, c'est sa **place**.

- **OUI** si, à droite, plus rien ne **flotte** sous les cartes — le lien est devenu le
  pied d'une carte, dans la même surface — et si ce qui l'entoure t'apprend quelque chose
  que tu ne savais pas en regardant le haut de l'écran.
- **NON** si les deux coexistent, ou si la carte ne fait que renvoyer ailleurs sans rien
  dire. Dans ce cas le lien texte faisait le même travail pour dix fois moins de place.

### 2. Est-ce que ça coûte trop de hauteur ?

C'est le vrai prix. **En moyenne +89 px, soit +15 %.** Sur 30 mesures,
**20 écrans tenaient sans défiler en variante 1, 15 en variante 2** — cinq écrans
basculent sous la ligne de flottaison : quatre de **2 à 31 px**, le cinquième de
**110 px** (« deux séances » en texte agrandi ×1,3, le pire cas du lot).

Le tableau complet est dans [`mesures-hauteurs-variante2.md`](mesures-hauteurs-variante2.md),
la lecture en français dans [`COMPARAISON.md`](COMPARAISON.md).

### 3. Est-ce que le pied « Voir ma progression » reste secondaire ?

Il ne doit **jamais** concurrencer l'action du jour. Sur la carte c'est un texte bleu
avec un chevron, **jamais un aplat coloré** — le seul aplat de l'écran reste le bouton
orange. Et il **n'existe que dans l'état `ready`** : dans les deux autres états, la page
Progression n'a rien de vrai à montrer, donc il n'y a aucun bouton du tout.

Regarde aussi l'écran « Aucune comparaison de test » : le lien **« Voir le détail »** y
est juste sous l'action du jour et ouvre **la séance**, pendant que le pied ouvre **la
progression**. Deux destinations, deux libellés. Ils portaient les mêmes mots il y a une
version — c'est corrigé, et le vérificateur refuse maintenant que ça revienne.

### 4. Est-ce qu'on a le droit de te dire « En forme » ?

En variante 2, **non** — et la pastille d'état du jour a disparu de l'en-tête. C'est ta
règle, appliquée telle que tu l'as écrite : *ne pas afficher « En forme » ou « Prêt à
performer » si les entraînements club et les autres charges ne sont pas réellement
connus.* Un écran ne peut pas annoncer ton état en haut, puis écrire 200 px plus bas que
tes entraînements club n'y sont pas comptés.

**La variante 1 la garde**, pour que tu voies l'écart en côte à côte. Ce qui reste à
trancher : garder l'en-tête nu, ou écrire une pastille **reformulée** qui dise
explicitement qu'elle ne parle que des séances FKS (par exemple « Charge FKS : modérée »).
Ce libellé-là n'a pas été inventé à ta place. Détail en §4 bis.2 de
[`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md).

---

## Les 4 choses à regarder en priorité

### 1. Le nouveau joueur (situation 1) — c'est le cœur du sujet

Aujourd'hui, un joueur qui vient de s'inscrire lit : « **En forme — prêt à performer** »,
voit une courbe de forme sur 7 jours, et reçoit un reproche sur sa mobilité.
**Rien de tout ça n'est vrai** : ce sont les valeurs d'usine du modèle de charge
(`CTL0 = 15`, `ATL0 = 12`), pas des mesures.

La proposition affiche : *« Ta tendance se construit — fais ta première séance et
dis-nous comment ça s'est passé. »* Une action, une phrase honnête, rien d'autre.

**Mais regarde aussi le vide.** À 375 px, cet écran fait 399 px de contenu dans
729 px disponibles : il reste **330 px de fond nu**. C'est le manque le plus visible
du prototype, et il est assumé — pas comblé avec du remplissage. Voir
[`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md), question ouverte n° 1.

### 2. Le côte à côte sur « Séance prévue » (situation 2)

C'est là qu'on voit la répétition disparaître. À gauche, le Home actuel affiche
**le même bouton deux fois** (le CTA orange en haut, la carte « Prochaine séance » en bas :
même libellé, même destination, même état désactivé — c'est littéralement le même bouton).
Il écrit aussi l'état du jour **trois fois**. À droite, une action, une seule.

Et surtout : la proposition ajoute la ligne qui manque le plus à l'app —
**« Pourquoi : tu as deux jours de charge dans les jambes… »**

### 3. La reprise après 24 jours (situation 7)

Aujourd'hui, après 24 jours sans rien, le Home dit « **Frais — bien reposé** », trace une
courbe parfaitement plate où le trou de 24 jours est invisible, et affiche le cycle figé
sur « Montée en puissance ».

La proposition dit qu'elle ne sait plus, met le cycle en pause, et propose
« Reprendre mon programme ». **Attention à une chose** : le sous-titre est au futur
(« On te préparera une remise en route progressive ») parce que le moteur de reprise
**n'existe pas encore**. C'est honnête, mais ça reste une promesse à tenir avant toute
mise en production.

### 4. La couleur du bouton d'action — à trancher

Le bouton principal actuel est du blanc sur l'orange FKS `#F2741B` :
**contraste 2,88 pour 1**, là où la norme d'accessibilité demande 4,5. C'est le bouton
n° 1 de l'application, et c'est le moins lisible de l'écran.

La proposition utilise `#B4530C` — **le même orange, simplement assombri**
(teinte 25,4° contre 24,8°), mesuré à **5,02 pour 1**. C'est un choix d'identité,
pas une correction technique : **regarde-le et tranche**. Le fichier de couleurs du
projet (`constants/theme.ts`) n'a pas été modifié.

---

## Les autres documents

| Fichier | Ce qu'il contient |
|---|---|
| [`COMPARAISON.md`](COMPARAISON.md) | Actuel contre proposition **et variante 1 contre variante 2**, chiffres mesurés |
| [`VIEWMODEL_PROGRESSION.md`](VIEWMODEL_PROGRESSION.md) | **Nouveau.** Les 3 états de la carte progression en français simple, et les calculs de la page Progression qu'on a refusé de reprendre |
| [`DECISIONS_VISUELLES.md`](DECISIONS_VISUELLES.md) | Chaque choix de design et sa raison, **variante 2 comprise** |
| [`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md) | Ce qui n'est pas branché, ce que l'outil ne peut pas prouver, les questions ouvertes |
| [`FIXTURES.md`](FIXTURES.md) | Les 14 situations : ce que chacune prouve, l'action attendue |
| [`FICHIERS_NON_MODIFIES.md`](FICHIERS_NON_MODIFIES.md) | La preuve que le produit est intact |
| [`mesures-hauteurs.md`](mesures-hauteurs.md) | Le tableau brut des 60 mesures de hauteur (variante 1) |
| [`mesures-hauteurs-variante2.md`](mesures-hauteurs-variante2.md) | **Nouveau.** Les 30 comparaisons de hauteur variante 1 / variante 2 |
| [`captures/`](captures/) | 60 images de la variante 1 |
| [`captures-v2/`](captures-v2/) | **Nouveau.** 13 images de la variante 2 |

---

## Si tu ne veux pas lancer le serveur

Les dossiers de captures contiennent les images.

**Variante 1** — [`captures/`](captures/), les plus parlantes :

- `comparaison-seance-prevue-aujourdhui-actuel-vs-vnext-375.png` — le côte à côte
- `comparaison-nouveau-joueur-actuel-vs-vnext-375.png` — l'écran qui arrête d'inventer
- `etat-01` à `etat-14-…-vnext-375-page-entiere.png` — les 14 situations proposées
- `outil-visualiseur-vue-cote-a-cote.png` — à quoi ressemble l'outil

**Variante 2** — [`captures-v2/`](captures-v2/), 13 images :

| Image | Ce qu'elle montre |
|---|---|
| `comparaison-v1-vs-v2-nouveau-joueur-375.png` | **Commence par celle-là.** Variante 1 à gauche, variante 2 à droite, même situation |
| `comparaison-v1-vs-v2-deux-seances-375.png` | Le même côte à côte sur l'état « ça se construit » |
| `comparaison-v1-vs-v2-tendance-disponible-375.png` | Le même côte à côte quand la courbe existe — **c'est là que le lien flottant disparaît au profit du pied de carte** |
| `v2-01-nouveau-joueur-…` à `v2-05-aucune-comparaison-de-test-…` | Les 5 cas de la carte, page entière, 375 px |
| `v2-preuve-r1-donnee-manquante-375-page-entiere.png` | La preuve qu'une donnée inconnue **disparaît** au lieu d'afficher 0 |
| `largeur-320px-iphone-se-…-v2.png` (×2) | Le petit iPhone SE : le cas le plus serré |
| `texte-agrandi-x1-3-tendance-disponible-v2-375.png` | Police agrandie ×1,3 |
| `outil-visualiseur-selecteur-variante2.png` | Le nouveau sélecteur de variante dans l'outil |
| `_rapport-captures.json` | Le compte-rendu machine : **13 réussies, 0 échouée** |

Le détail du nommage est en bas de [`COMPARAISON.md`](COMPARAISON.md).

---

*Prototype produit le 27 juillet 2026 sur la branche `feat/home-vnext-prototype`,
à partir du commit `724c062`. Rien n'est commité, rien n'est poussé, rien n'est fusionné.*
