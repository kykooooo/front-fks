# Les 14 situations — ce que chacune prouve

> Une « situation » (ou *fixture*) est un jeu de données inventé qui met l'écran dans un
> cas précis. C'est l'équivalent d'une mise en place à l'entraînement : on rejoue toujours
> la même phase pour voir si le joueur prend la bonne décision.
>
> **Toutes les données sont fictives.** Horloge figée au **jeudi 30 juillet 2026, 9 h 15**,
> pour que deux rendus à deux jours d'écart donnent exactement le même résultat.
>
> Les textes de la colonne « action » sont **relevés dans le rendu**, pas retapés à la main.

---

## Le quotidien — 90 % de l'usage réel

### 1. Nouveau joueur `nouveau-joueur`

Compte tout neuf : aucun historique, aucun cycle, rien à mesurer.

| | |
|---|---|
| **Action attendue** | **« Choisir mon cycle »** — *5 cycles, 12 séances chacun.* |
| Pourquoi | aucune ligne |
| Forme | **pas de courbe** — « Ta tendance se construit » |
| Conseil | aucun |
| Pastille d'état | **aucune** |

**Ce que ça prouve** — que l'app ne dit plus rien qu'elle ne sache. Aujourd'hui, ce même
joueur lit « **En forme — prêt à performer** », voit une courbe de 7 points entièrement
fabriquée, et reçoit un reproche sur sa mobilité. Ici : une action, une phrase honnête,
rien d'autre. Le mot « Série » n'apparaît nulle part.

**À regarder aussi** — le vide. 399 px de contenu dans 729 px : environ 330 px de fond nu.
C'est le manque n° 1 du prototype, assumé et non comblé.

---

### 2. Séance prévue aujourd'hui `seance-prevue-aujourdhui`

La prescription du jour est là, pas encore commencée. **C'est la situation de référence.**

| | |
|---|---|
| **Action attendue** | **« C'est parti »** — *Force bas du corps · 45 min · Modérée* |
| Action secondaire | « Voir le détail » — un **lien texte**, jamais un aplat |
| Pourquoi | *« Tu as deux jours de charge dans les jambes : on garde le volume, on baisse l'intensité. »* (source : `sessionTheme`) |
| Cycle | en cours — Duels & puissance, séance 4 sur 12, Fondations |
| Semaine | 1 sur 2 — *Plus qu'une séance pour atteindre ton objectif.* |
| Forme | courbe sur 7 points, portée écrite |
| Conseil | *« Garde 90 secondes de récupération entre les gros efforts, sinon la qualité tombe. »* |

**Ce que ça prouve** — deux choses. D'abord **la ligne « Pourquoi »**, qui répond à la
question à laquelle l'app ne répondait pas. Ensuite **l'action unique** : aujourd'hui, ce
même écran affiche le même bouton deux fois (en haut, et dans la carte « Prochaine séance »
900 px plus bas) et écrit l'état du jour trois fois.

C'est la situation à mettre en côte à côte en premier.

---

### 3. Séance à reprendre `seance-a-reprendre`

Le joueur a lancé sa séance ce matin et s'est arrêté en cours de route.

| | |
|---|---|
| **Action attendue** | **« Reprendre ma séance »** — *Force bas du corps · 45 min · Modérée* |
| Action secondaire | « Revoir le détail » |
| Conseil | *« Pose bien le talon au sol sur les fentes. »* |

**Ce que ça prouve** — que le bouton s'adapte à ce qui s'est réellement passé : « Reprendre »
et non « C'est parti ». Le reste de l'écran ne bouge pas : c'est le même jour, la même séance.

⚠️ **Cette situation ne peut pas encore se déclencher en vrai.** L'app ne trace pas une
séance ouverte puis abandonnée (`Session.completed` est un simple oui/non).
Le prototype le signale lui-même.

---

### 4. Séance terminée aujourd'hui `seance-terminee`

La journée est faite, le retour du joueur est enregistré. Plus rien à faire.

| | |
|---|---|
| **Action attendue** | **« Séance faite »** — *Force bas du corps · 45 min · effort 7/10* |
| Forme du bloc | **accusé de réception**, pas un aplat coloré |
| Semaine | 2 sur 2 — *Objectif de la semaine atteint.* |
| Pourquoi | aucune ligne |
| Conseil | aucun |

**Ce que ça prouve** — que **le jour de la réussite n'éteint plus l'écran**. Aujourd'hui,
le meilleur emplacement de l'app devient un rectangle gris désactivé (« Journée off / Tu as
déjà fait ta séance ») et cette carte grise est même répétée en bas.

Ici, l'emplacement d'action reste occupé, mais sans aplat — il n'y a plus rien à lancer.
Le chiffre « effort 7/10 » est **ce que le joueur a lui-même déclaré**, jamais un score
calculé par l'app.

---

### 5. Jour de récupération `jour-recuperation`

| | |
|---|---|
| **Action attendue** | **« C'est parti »** — *Récup active · 25 min · Facile* |
| Pourquoi | *« Grosse charge sur les trois derniers jours : aujourd'hui on relâche pour absorber. »* |
| Pastille | À alléger |
| Conseil | *« Si tu ne peux pas tenir une conversation en bougeant, c'est déjà trop rapide. »* |

**Ce que ça prouve** — que **la récup est une séance prescrite par le programme**, pas un
mode que l'écran devine. C'était le pire cas de l'écran actuel : le même message écrit
**4 fois** (pastille + bouton + carte d'état + conseil) et **3 boutons vers la même
destination, dans 3 couleurs différentes**.

Ici : une action, un pourquoi qui explique, un conseil qui apporte autre chose.

---

### 6. Jour sans séance prévue `jour-sans-seance`

Rien n'est prescrit aujourd'hui, et un match est noté demain.

| | |
|---|---|
| **Action attendue** | **« Préparer ma séance »** — *On l'adapte à ton contexte du jour.* |
| Pourquoi | *« Tu as noté un match demain. »* (source : match proche) |
| Conseil | aucun |

**Ce que ça prouve** — deux choses. D'abord que le « pourquoi » **peut venir d'ailleurs que
de la séance** : ici c'est le match. Ensuite la précision du vocabulaire : l'écran écrit
« **tu as noté** un match », jamais « **ton** match » — parce que l'information vient d'un
jour de semaine coché au profil, pas d'un match daté et confirmé.

Le match n'apparaît que dans une fenêtre de 2 jours. L'écran actuel affiche un
« Match : Proche » permanent, sans date et sans lien.

---

## Premiers pas et retour

### 7. Reprise après interruption longue `reprise-longue-interruption`

24 jours sans rien. **C'est l'état le plus fréquent chez un amateur, et le plus mal traité
aujourd'hui.**

| | |
|---|---|
| **Action attendue** | **« Reprendre mon programme »** — *On te préparera une remise en route progressive.* |
| Cycle | **en pause** — Duels & puissance, **sans nom de phase** |
| Forme | **pas de courbe** — « Ta tendance se construit » (motif : reprise en cours) |
| Semaine | aucune |
| Pastille | **aucune** |

**Ce que ça prouve** — que l'app arrête de faire semblant. Aujourd'hui, après 24 jours,
elle affiche « **Frais — bien reposé** », trace une ligne parfaitement plate où le trou de
24 jours est invisible, et affiche le cycle figé sur « Montée en puissance » — une montée
en charge qui n'a jamais eu lieu.

Ici : le cycle passe **en pause** et **perd son nom de phase** (on ne peut plus affirmer où
en est le joueur), la courbe disparaît, la pastille d'état disparaît.

⚠️ **Le sous-titre est au futur** — « on te **préparera** » — parce que le moteur de reprise
progressive n'existe pas encore. C'est honnête, mais c'est une promesse à tenir avant
production.

---

## Ce que l'app sait mesurer

### 8. Tendance indisponible `tendance-indisponible`

Deux séances au compteur : assez pour agir, pas assez pour montrer une tendance.

| | |
|---|---|
| **Action attendue** | **« Préparer ma séance »** |
| Forme | **pas de courbe** — « Ta tendance se construit » (motif : pas assez de séances) |
| Pastille | **aucune** |
| Lien de sortie | **aucun** |

**Ce que ça prouve** — que le seuil fonctionne dans le bon sens : **le joueur peut agir**
(le bouton est bien là, il n'est pas puni), mais **l'app ne se prononce pas** sur sa forme.
Même le lien « Voir ma progression » disparaît : il n'y aurait rien à voir.

C'est le pendant exact de la situation 9. À regarder l'une après l'autre.

---

### 9. Tendance disponible `tendance-disponible`

Assez de séances terminées : la tendance s'affiche, avec sa portée.

| | |
|---|---|
| **Action attendue** | **« Préparer ma séance »** |
| Forme | courbe sur 7 points — *« Calculé sur tes séances FKS uniquement — tes entraînements club n'y sont pas comptés. »* |
| Pastille | En forme |

**Ce que ça prouve** — que quand la courbe apparaît, **elle dit sur quoi elle est calculée**.
Une mesure qui ne voit qu'une partie de la vie du joueur ne doit pas se présenter comme une
mesure complète de son état physique.

Et : **aucun chiffre sur le tracé**. Pas de « 0 », pas de « −10 » — l'écran actuel les
affiche à un contraste de 2,15 : 1, le pire de tout l'écran, sans unité ni légende.

---

## Quand ça casse

### 10. Erreur de génération `erreur-generation`

| | |
|---|---|
| **Action attendue** | **« Réessayer »** — *Le service n'a pas répondu.* |

**Ce que ça prouve** — qu'un échec a une place et une sortie. L'écran actuel n'a **aucune
branche d'erreur** : il affiche l'écran complet avec les valeurs d'usine.

⚠️ Aucun store ne conserve aujourd'hui l'échec d'une génération : champ à créer.

---

### 11. Hors-ligne `hors-ligne`

| | |
|---|---|
| **Action attendue** | **« C'est parti »** (la séance déjà téléchargée reste lançable) |
| Avis en haut | *« Tu es hors connexion : ce que tu vois ici peut dater de ta dernière synchro. »* |

**Ce que ça prouve** — que l'app **qualifie ses chiffres** au lieu de les affirmer.
L'avis se place juste sous le prénom, **avant le premier chiffre de l'écran** : il porte
sur tout ce qui suit.

⚠️ C'est aussi l'état le plus haut du prototype (889 px à 375 px, soit 160 px à faire
défiler). Le bandeau ajoute une ligne à un écran déjà chargé.

⚠️ `hooks/useNetworkStatus.ts` existe mais n'est jamais appelé par le Home : à câbler.

---

## Avec ou sans club — le Home ne doit jamais dépendre d'un suivi club

### 12. Aucune directive club `directive-club-absente`

Joueur sans club : l'écran est complet, aucun bloc en attente.

| | |
|---|---|
| **Action attendue** | **« C'est parti »** — *Force bas du corps · 45 min · Modérée* |
| Forme | courbe — *« Calculé sur tes séances FKS uniquement. »* (phrase plus courte : aucun jour club à écarter) |

**Ce que ça prouve** — qu'il n'y a **aucun trou** : pas de carte vide, pas de « — » à la
place d'une valeur, pas de bandeau « connecte ton club ». C'est le bon point réel de
l'écran actuel, et il est préservé.

---

### 13. Directive club non appliquée `directive-club-non-appliquee`

Le coach a posé une consigne, le moteur ne l'a pas prise en compte.

**Rendu strictement identique à la situation 12.** C'est le résultat attendu, et c'est le
point le plus subtil du prototype.

**Ce que ça prouve** — que l'écran **ne mentionne pas** une consigne qui n'a pas été suivie.
Afficher « ton coach a demandé de lever le pied » alors que la séance du jour n'en tient
pas compte, ce serait laisser croire que la prescription l'intègre. Tant que le moteur ne
la consomme pas, **l'écran se tait**.

Le prototype signale ce choix dans ses propres avertissements, pour qu'on puisse le
contester.

---

### 14. Joueur autonome sans club `joueur-autonome-sans-club`

Ni club ni coach, un autre cycle, un autre objectif hebdo.

| | |
|---|---|
| **Action attendue** | **« C'est parti »** — *Vitesse & démarrages · 40 min · Élevée* |
| Pourquoi | *« Trois jours de calme derrière toi : c'est le bon moment pour du vif. »* |
| Cycle | Vitesse & détente |
| Semaine | 1 sur 3 — *Encore 2 séances pour atteindre ton objectif.* |
| Conseil | *« Marche entre chaque sprint, la récupération complète fait toute la différence. »* |

**Ce que ça prouve** — que l'écran tient tout seul avec un autre cycle et un autre objectif,
et que le compteur de semaine s'accorde correctement (« encore 2 séances » et non
« plus qu'une »).

---

## La 15ᵉ entrée : le test de résistance

### Textes longs `stress-textes-longs`

Ce n'est **pas une situation produit**. C'est une mise en place volontairement extrême, pour
voir si la mise en page casse.

Poussés à la limite : un prénom de 25 caractères, un titre de séance de 108, une raison de
250, un conseil de 200, et un objectif hebdomadaire de 9 séances.

**Résultat mesuré**, aux 4 largeurs plus le texte ×1,3 :

- **0 débordement**
- **0 chevauchement de textes**
- **4 textes coupés** par le bornage à l'échelle 1 (5 en texte ×1,3) : le prénom, le titre
  de séance, la raison et le conseil. C'est le comportement attendu du bornage — l'écran ne
  se déforme pas, il coupe.
- À 768 px, **0 texte coupé** : la largeur suffit.

**Ce que ça prouve** — que le bornage des textes venant du backend fonctionne.
Sur l'écran actuel, un titre de séance long fait passer le bouton principal sur 3 lignes,
et **la même chaîne de 3 lignes est affichée deux fois sur le même écran**.

⚠️ **Mais ce test a révélé un vrai défaut du prototype**, sur les situations normales cette
fois : en texte ×1,3, la phrase qui dit sur quoi la courbe est calculée est coupée sur
**8 situations**. Voir [`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md) §6, question n° 5.

---

## Récapitulatif

| # | Situation | Action attendue | Forme | Conseil |
|---|---|---|---|---|
| 1 | Nouveau joueur | Choisir mon cycle | insuffisante | — |
| 2 | Séance prévue aujourd'hui | C'est parti | courbe | oui |
| 3 | Séance à reprendre | Reprendre ma séance | courbe | oui |
| 4 | Séance terminée | Séance faite *(accusé)* | courbe | — |
| 5 | Jour de récupération | C'est parti | courbe | oui |
| 6 | Jour sans séance prévue | Préparer ma séance | courbe | — |
| 7 | Reprise après interruption | Reprendre mon programme | insuffisante | — |
| 8 | Tendance indisponible | Préparer ma séance | insuffisante | — |
| 9 | Tendance disponible | Préparer ma séance | courbe | — |
| 10 | Erreur de génération | Réessayer | courbe | — |
| 11 | Hors-ligne | C'est parti | courbe | oui |
| 12 | Aucune directive club | C'est parti | courbe | oui |
| 13 | Directive club non appliquée | C'est parti | courbe | oui |
| 14 | Joueur autonome sans club | C'est parti | courbe | oui |
| — | *Textes longs (résistance)* | C'est parti | courbe | oui |

**8 situations sur 15 affichent un conseil, 7 n'en affichent aucun** — parce qu'un conseil
qui répète ce qui est déjà écrit ailleurs sur l'écran est **supprimé**, pas grisé.

**3 situations sur 15 n'ont aucun équivalent** dans le Home actuel : séance à reprendre,
erreur de génération, directive club non appliquée. Le visualiseur les marque
`sans équivalent` et affiche un bandeau d'écart en côte à côte.
