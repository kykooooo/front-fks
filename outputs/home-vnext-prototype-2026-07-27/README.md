# Prototype Home vNext — itération finale

> **C'est l'itération FINALE du prototype.** Tu as regardé la variante 2 et validé la
> direction « Progression intégrée ». Ce qui a changé depuis est en section
> **[Ce qui a changé dans cette itération](#ce-qui-a-changé-dans-cette-itération)**,
> et les **5 choses à regarder en priorité** sont juste en dessous.

---

## POUR LANCER — les deux lignes

Ouvre un terminal et colle ces deux lignes :

```
cd C:\Users\Gamer\front-fks\.claude\worktrees\home-vnext-prototype
node prototype/home-vnext/serve.js
```

## PUIS OUVRE — l'adresse qui va droit au but

# http://127.0.0.1:8141/#etat=v2-test-physique-en-recul&var=duo&paire=v1v2&w=375&vue=entiere&x13=0&typo=allegee&anim=0&onglet=regle

Cette adresse ouvre directement **l'écran le plus important de l'itération** : à gauche la
variante 1 (qui garde sa pastille « En forme », exprès, pour que la comparaison se voie), à
droite la variante 2 que tu as validée — et le panneau de droite déjà ouvert sur **la règle
de sélection du test**.

C'est tout. Pas d'installation, pas de téléphone, pas de compte, pas de connexion.

> **Le port change parfois.** Si 8141 est déjà pris, le serveur prend tout seul le suivant
> et **affiche l'URL réelle** dans le terminal. C'est cette ligne-là qui fait foi. Au moment
> où ces captures ont été faites, le serveur répondait sur **8141**. Si le tien répond
> ailleurs, change juste le numéro et **garde tout ce qui suit le `#`**.

> Si les pages n'existent pas encore (dossier `prototype/home-vnext/out/` vide),
> lance d'abord `node prototype/home-vnext/build.js`, puis relance le serveur.

Pour arrêter : `Ctrl+C` dans le terminal.

---

## Les bascules, en haut de l'écran

Sept réglages, tous indépendants. L'URL garde ton réglage : elle se partage telle quelle.

| Bascule | Choix | Touche | Ce que ça change |
|---|---|:--:|---|
| **Variante** | `Proposition vNext` · **`Progression intégrée`** · `Home actuel` · `Côte à côte` | `v` | quel écran tu regardes. **`Progression intégrée` = la variante que tu as validée.** |
| **Paire** *(en côte à côte)* | **`vNext / Progression`** · `Actuel / vNext` · `Actuel / Progression` | `c` | qui est comparé à qui |
| **Largeur** | `320` · `375` · `390` · `768` | `w` | 320 = vieil iPhone SE · 375 = la référence |
| **Vue** | `Zone visible sans défilement` · `Page entière` | `e` | la première est la vue **honnête**, la seconde montre tout |
| **Texte** | `x1` · `x1.3` | — | un joueur qui a grossi la police de son téléphone |
| **Typo** | **`Allégée`** *(défaut)* · `Actuelle` | **`t`** | **la question du moment.** Martèle `t` sans quitter l'écran des yeux : les mots ne bougent pas, seule la typographie change. |
| **Animations** | `Normales` · `Réduites` | `a` | le réglage d'accessibilité du téléphone. **Au repos les deux sont identiques — c'est le résultat voulu**, voir plus bas. |

Panneaux de droite : **Valider** (les axes à trancher) · **La règle** (quel test s'affiche,
et pourquoi celui-là) · **Cet état** · **Mesures** · **Limites**.
`p` masque les panneaux, `↑` `↓` changent d'état.

---

## Ce qui a changé dans cette itération

Quatre changements, tous issus de tes décisions.

### 1. La pastille d'état global a été RETIRÉE — complètement *(décision D1)*

Plus aucun jugement global sur la variante 2 : ni « En forme », ni « Frais », ni « Prêt à
performer », ni « Un peu chargé », ni « Charge modérée ».

Ce n'est plus un verrou conditionnel qu'un drapeau pourrait rouvrir : **le champ d'entrée
et le champ de sortie ont été supprimés du contrat**. Aucune donnée d'entrée ne peut faire
ressortir un libellé d'état. Un contrôle du vérificateur compte les pastilles sur les 60
pages de la variante 2 et **attend zéro, écrit en clair**.

Motif, dans tes mots : le modèle de charge part encore de valeurs d'usine et ne connaît pas
les entraînements club. Une pastille « Charge FKS » ne pourra revenir que le jour où son
calcul reposera sur des données entièrement réelles, avec sa portée expliquée.

**La variante 1 garde la sienne** — uniquement pour que l'écart se voie en côte à côte.

### 2. La typographie a été allégée

Diagnostic que tu as posé : « la police paraît trop grosse ». La mesure dit autre chose —
c'était l'**accumulation de poids**. Sur le rendu réel : **32 textes en graisse 800 avant,
ZÉRO après**. Et pourtant **le texte lu grandit** : corps et liens passent de 13 à 14 px,
interligne de 18 à 20.

Aucune valeur n'a été réduite pour gagner de la hauteur (**décision D2**) : les
métadonnées (12 px) et les valeurs chiffrées (16 px) ne perdent pas un pixel.

Le tableau rôle par rôle est dans [`COMPARAISON.md`](COMPARAISON.md), le raisonnement dans
[`DECISIONS_VISUELLES.md`](DECISIONS_VISUELLES.md).

### 3. Le test affiché sur le Home suit une règle publiée *(décision D3)*

Un seul repère de test à l'écran, choisi par une règle **déterministe** en trois étages :
l'objectif du cycle actif → la mesure la plus récente → un ordre de départage figé.

**Jamais « la meilleure progression ».** La fonction qui choisit ne reçoit **que** le nom du
test et la date de sa dernière mesure — l'écart n'est pas dans sa signature. Un tri
flatteur est littéralement impossible à écrire sans changer le type d'entrée.

La preuve est à l'écran, fixture **« Test physique en recul »** : deux améliorations étaient
disponibles dans la même batterie (+3 cm au saut, +25 m au 6 min) et c'est le **sprint en
retrait** (+0,07 s) qui s'affiche, parce que c'est lui que la règle désigne.

Le tableau cycle → test est une **décision produit qui t'attend** : chaque ligne cite le
texte du dépôt qui la fonde, et deux cycles sur cinq n'ont volontairement aucun test.
Tout est en §5 bis et §5 ter de [`VIEWMODEL_PROGRESSION.md`](VIEWMODEL_PROGRESSION.md).

### 4. Le réglage « Réduire les animations » est respecté

Le prototype n'a **aucune** animation en boucle — la seule animation existante est
l'enfoncement du bouton sous le doigt. Quand le réglage est actif, le bouton du jour ne
porte **plus aucune** consigne de mouvement (pas même une consigne neutre).

Au repos, les deux rendus sont **identiques à l'œil**, et c'est le résultat voulu : aucune
information de l'écran n'est portée par un mouvement. La preuve est dans le balisage —
capture `mouvement-reduit-vs-normal-tendance-disponible-375.png`.

**À comparer avec la production** : `components/home/HomePrimaryCTA.tsx` (lignes 39-49) joue
une pulsation en boucle infinie **sans jamais consulter le réglage d'accessibilité**. Hors
périmètre, non corrigée — mais mesurée et affichée dans l'onglet « Limites ».

---

## LES 5 CHOSES À REGARDER EN PRIORITÉ

| # | Quoi | Comment y aller |
|---|---|---|
| **1** | **Le test en recul.** L'écran affiche une mauvaise nouvelle alors que deux bonnes étaient disponibles. C'est la preuve que la sélection est aveugle au résultat. | l'adresse en haut de ce fichier |
| **2** | **Typo actuelle contre allégée.** Reste sur `v2-tendance-disponible` et martèle **`t`**. Les mots ne bougent pas. | `t`, en boucle |
| **3** | **L'en-tête sans pastille.** En côte à côte, regarde le **haut** des deux colonnes : « En forme » à gauche, plus rien à droite. | `c` puis paire `vNext / Progression` |
| **4** | **Le tableau cycle → test.** C'est la décision qui t'attend : 5 lignes, 2 volontairement vides. Conteste-les. | onglet **La règle**, en bas |
| **5** | **Le défilement, en 320 px et en ×1,3.** Tu l'as accepté (D2) — vérifie quand même que ce qui compte reste lisible. | `w` pour 320 px, puis `x1.3` |

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

**À droite — les panneaux.** Cinq onglets : *Valider* (les axes à trancher un par un),
**La règle** (quel test s'affiche et pourquoi celui-là, plus le tableau cycle → test),
*Cet état* (ce que la maquette affirme et pourquoi), *Mesures*, *Limites*.

Raccourcis clavier — la liste complète est dans le tableau des bascules en haut de ce
fichier. Les plus utiles : `↑` `↓` changent de situation, **`t` bascule la typographie**,
`c` passe en côte à côte, `e` change de vue, `p` masque les panneaux.

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

Les 7 cas de la carte apparaissent dans la liste de gauche avec l'identifiant `v2-…`.
Le panneau de droite « **Points à valider** » contient **14 questions spécifiques à la
variante 2** : chaque bouton t'emmène directement sur l'état concerné. Et l'onglet
« **Axes** » découpe la relecture en **7 jugements séparés** — tu peux dire oui à la
typographie et non à la hauteur sans que les deux verdicts se contaminent.

## Les 6 cas à regarder (plus une preuve)

La carte n'a que **trois états**. Ce n'est pas une carte qui « se remplit » petit à petit :
elle change de nature selon ce que l'app sait vraiment. Le détail en français simple est
dans [`VIEWMODEL_PROGRESSION.md`](VIEWMODEL_PROGRESSION.md).

| # | Cas | État | Ce que tu dois vérifier |
|---|---|---|---|
| 1 | **Nouveau joueur** | `empty` | Trois repères numérotés et une mention honnête. **Aucun graphique, aucun bouton.** La page Progression n'a pas une seule ligne vraie pour ce joueur : on ne l'y envoie pas. |
| 2 | **Deux séances, tendance indisponible** | `collecting` | Quatre faits **réellement mesurés** : 2 séances / 76 min / 2 ressentis / « Encore 2 séances ». Le « Encore 2 » est **calculé**, pas écrit en dur. Toujours aucun bouton. |
| 3 | **Tendance disponible** | `ready` | La courbe s'affiche **avec sa portée exacte** juste en dessous. Le pied « Voir ma progression » apparaît, en lien discret. Et un test refait deux fois : saut en longueur 205 → 214 cm, **+9 cm** — le sens « plus grand = mieux ». C'est le **cycle actif** (« Duels & puissance ») qui désigne ce test-là. |
| 4 | **Test physique amélioré** | `ready` | La carte affiche le **sprint 10 m : 1,85 → 1,78 s, soit « −0,07 s »**. Un chiffre négatif qui est une bonne nouvelle : sur un sprint, mieux veut dire plus petit, et c'est le mot « en progrès » qui le dit — jamais une flèche. Le saut en longueur (218 → 227 cm) est calculé lui aussi ; la carte n'en montre qu'un, **celui que vise le cycle « Vitesse & détente »** — et pas le plus récent, qui serait le test 505, enregistré 45 min plus tard le même jour. |
| 5 | **Test physique en recul** | `collecting` | Retour de coupure : **sprint 10 m 1,81 → 1,88 s**, écrit « en retrait ». Dans la **même batterie**, le saut a gagné 3 cm et le 6 min 25 m — deux bonnes nouvelles disponibles, et c'est quand même le recul qui s'affiche. **C'est la preuve que la sélection ne regarde jamais le résultat.** |
| 6 | **Aucune comparaison de test** | `ready` | Quatre tests existent, **aucune paire comparable** : deux essais du 6 min le **même jour**. La page Progression actuelle afficherait ici une fausse progression de +35 m. La carte explique pourquoi elle ne compare pas. |
| — | **Donnée manquante** *(preuve, hors des 6)* | `collecting` | 3 séances, **aucune durée ni ressenti connus**. Les deux faits **disparaissent**. Ni « 0 min », ni « — », ni tiret. C'est la règle la plus importante du lot. |

> **Comment le test affiché est choisi.** Trois étages, dans cet ordre, et **aucun ne
> regarde le résultat** : 1) le test que vise le **cycle actif** (Force → saut en longueur,
> Endurance → 6 min, Explosivité → sprint 10 m ; Fondation et Saison n'en ont aucun) ;
> 2) sinon la mesure **la plus récente** ; 3) à égalité de date — le cas normal, puisqu'une
> batterie s'enregistre en **une seule fois** — un ordre figé tranche, sprint puis saut puis
> 6 min. Le tableau complet et ses justifications sont dans l'onglet « La règle » du
> visualiseur.

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

C'est le vrai prix. **En moyenne +95 px, soit +16 %.** Sur 35 mesures,
**21 écrans tiennent sans défiler en variante 1, 17 en variante 2** — quatre écrans
basculent sous la ligne de flottaison, de **9 à 38 px** de dépassement.

**Tu as tranché ce point le 28 juillet** : *« Le défilement est accepté. Les 29 px sous la
ligne à taille normale ne sont pas un problème. »* Rien n'a donc été rogné pour les
récupérer — au contraire, le texte courant a **grandi** (13 → 14 px, interligne 18 → 20) et
les liens aussi (13 → 14 px). Le dépassement de « Tendance disponible » à 375 px est passé
de 29 px à **9 px**, mais par la typographie et une ligne de cumul ramenée au rang de
métadonnée, jamais en coupant un mot ni en rétrécissant une zone tactile.

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

En variante 2, **non**, et ce n'est plus une question ouverte : **tu as tranché le
28 juillet (D1)**, la pastille d'état du jour est retirée de l'en-tête **sans condition**.
Un écran ne peut pas annoncer ton état en haut, puis écrire 200 px plus bas que tes
entraînements club n'y sont pas comptés.

Ce qui a changé depuis l'itération que tu as regardée : le retrait n'est **plus derrière un
drapeau**. L'option d'entrée a été **supprimée** du programme, pas seulement mise à faux —
il n'existe donc aucune valeur capable de faire revenir « En forme » en variante 2. Motif
que tu as donné : le calcul lui-même part de valeurs d'usine (`ATL0` / `CTL0`), donc
connaître les charges club n'aurait pas suffi.

**La variante 1 la garde**, uniquement pour que tu voies l'écart en côte à côte. Aucune
reformulation n'est proposée : la voie « Charge FKS : modérée » envisagée à l'itération
précédente est **écartée**, « Charge modérée » faisant partie des libellés que tu as
nommément interdits. Une mention de charge ne reviendra que le jour où son calcul reposera
sur des données entièrement réelles, avec sa portée écrite à côté. Détail en §4 bis.2 de
[`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md).

---

## Ce qu'il reste à regarder au-delà des 5 priorités

*(Ces quatre points viennent des itérations précédentes. Ils n'ont pas bougé.)*

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
| [`MIGRATION_PROGRESSSCREEN.md`](MIGRATION_PROGRESSSCREEN.md) | **NOUVEAU — celui que tu as demandé.** Le contrat partagé Home + page Progression, et ce que la page devra **abandonner** : amorces ATL0/CTL0, courbes artificielles, séries, cycles estimés, accomplissements déduits. Avec fichier:ligne, l'ordre de migration, et le risque de chaque étape. |
| [`COMPARAISON.md`](COMPARAISON.md) | Actuel contre proposition, variante 1 contre variante 2, **et typo avant/après avec le compte des graisses** |
| [`VIEWMODEL_PROGRESSION.md`](VIEWMODEL_PROGRESSION.md) | Les 3 états de la carte en français simple, **plus la règle de sélection du test (§5 bis) et le tableau cycle → test (§5 ter)** |
| [`DECISIONS_VISUELLES.md`](DECISIONS_VISUELLES.md) | Chaque choix de design et sa raison, **typo allégée et politique d'agrandissement comprises** |
| [`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md) | Ce qui n'est pas branché, les seuils à valider, les cas **non atteignables** avec le format réel, le traitement de reduceMotion |
| [`FIXTURES.md`](FIXTURES.md) | Les 14 situations : ce que chacune prouve, l'action attendue |
| [`FICHIERS_NON_MODIFIES.md`](FICHIERS_NON_MODIFIES.md) | La preuve que le produit est intact |
| [`mesures-hauteurs.md`](mesures-hauteurs.md) | Le tableau brut des mesures de hauteur (variante 1) |
| [`mesures-hauteurs-variante2.md`](mesures-hauteurs-variante2.md) | Les comparaisons de hauteur variante 1 / variante 2 |
| [`captures-final/`](captures-final/) | **NOUVEAU.** Les 20 images de l'itération finale |
| [`captures-v2/`](captures-v2/) | 13 images de la variante 2, itération précédente |
| [`captures/`](captures/) | 60 images de la variante 1 |

---

## Si tu ne veux pas lancer le serveur

### [`captures-final/`](captures-final/) — les 20 images de l'itération finale

**20 réussies, 0 échouée** (`_rapport-captures.json`).

| Image | Ce qu'elle montre |
|---|---|
| `etat-05-test-physique-en-recul-375-page-entiere.png` | **COMMENCE PAR CELLE-LÀ.** Le sprint en retrait s'affiche alors que deux améliorations existaient dans la même batterie. |
| `comparaison-typo-actuelle-vs-allegee-tendance-disponible-375.png` | **La question du moment.** Mêmes mots à gauche et à droite, seule la typographie change. |
| `comparaison-typo-actuelle-vs-allegee-test-physique-en-recul-375.png` | La même comparaison sur le cas le plus dense |
| `comparaison-typo-actuelle-vs-allegee-tendance-disponible-320.png` | La même comparaison sur le petit iPhone SE |
| `comparaison-progression-avant-apres-tendance-disponible-375.png` | **Avant / après l'intégration** : le lien flottant à gauche, la carte à droite — et la pastille « En forme » qui disparaît en haut à droite |
| `comparaison-progression-avant-apres-nouveau-joueur-375.png` | Le même avant/après sur un compte tout neuf |
| `comparaison-progression-avant-apres-test-physique-en-recul-375.png` | Le même avant/après sur le cas du recul |
| `mouvement-reduit-vs-normal-tendance-disponible-375.png` | **Le réglage d'accessibilité.** Identiques à l'œil ; la preuve est la ligne de code sous chaque colonne. |
| `etat-01` … `etat-06-…-375-page-entiere.png` | Les 6 cas de la carte, page entière, 375 px |
| `etat-R1-preuve-donnee-manquante-375-page-entiere.png` | La preuve qu'une donnée inconnue **disparaît** au lieu d'afficher 0 |
| `largeur-320px-iphone-se-tendance-disponible.png` | Le petit iPhone SE |
| `largeur-320px-iphone-se-deux-seances-tendance-indisponible.png` | Le petit iPhone SE, état « ça se construit » |
| `texte-agrandi-x1-3-tendance-disponible-375.png` | Police agrandie ×1,3 |
| `texte-agrandi-x1-3-test-physique-en-recul-375.png` | Police agrandie ×1,3 sur le cas le plus dense |
| `outil-visualiseur-bascules-et-regle.png` | **L'outil, toutes les bascules visibles**, panneau « La règle » ouvert |
| `outil-visualiseur-axes-a-trancher.png` | L'outil, panneau « Valider » : les axes à trancher un par un |

> **Sept états, pas huit.** La variante 2 compte **7** cas (6 cas de démonstration + la
> preuve R1), pas 8. Le brief en annonçait 8 : il n'en existe que 7 sur le disque, et je
> n'en ai pas fabriqué un huitième pour faire le compte.

> **Ce que ces captures ne montrent pas** : les plafonds d'agrandissement.
> `react-native-web` ne transmet pas `maxFontSizeMultiplier` au navigateur — les pages
> ×1,3 montrent donc le **pire cas**, entièrement non plafonné. C'est conservateur
> (si la mise en page tient sans plafond, elle tient avec), mais il faut le savoir.

### Les dossiers des itérations précédentes

**Variante 1** — [`captures/`](captures/) : `comparaison-seance-prevue-aujourdhui-actuel-vs-vnext-375.png`,
`comparaison-nouveau-joueur-actuel-vs-vnext-375.png`, `etat-01` à `etat-14`,
`outil-visualiseur-vue-cote-a-cote.png`.

**Variante 2, itération précédente** — [`captures-v2/`](captures-v2/), 13 images.
Elles restent utiles pour voir **d'où on part** : elles portent l'ancienne typographie.

Le détail du nommage est en bas de [`COMPARAISON.md`](COMPARAISON.md).

---

*Prototype produit les 27 et 28 juillet 2026 sur la branche `feat/home-vnext-prototype`,
à partir du commit `724c062`. Itération finale du 28 juillet : pastille retirée (D1),
typographie allégée, règle de sélection du test (D3), reduceMotion respecté.
Rien n'est commité, rien n'est poussé, rien n'est fusionné.*
