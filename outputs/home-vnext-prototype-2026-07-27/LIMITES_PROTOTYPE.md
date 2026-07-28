# Limites du prototype — ce qu'il ne prouve pas

> C'est le document d'honnêteté. Il existe pour qu'aucun chiffre et aucune image de ce
> dossier ne soit pris pour plus qu'il n'est.
>
> Règle de lecture : **si ce n'est pas écrit ici, c'est que c'est mesuré.** Si c'est écrit
> ici, c'est que c'est à confirmer, bouchonné, ou absent.

---

## 1. Ce qui est bouchonné (remplacé par du faux)

**Toutes les données affichées sont inventées.** Aucune ne vient de Firestore, du backend,
ni d'un compte réel. Chaque page le rappelle par une pastille « FICTIF » et un bandeau
permanent en haut du visualiseur.

Sont remplacés par des objets inertes avant même d'être chargés :

| Bouchonné | Conséquence |
|---|---|
| `services/firebase` | **Aucun accès Firestore possible**, même par accident |
| Tous les stores (`trainingStore`, `settingsStore`, sessions, charges externes…) | L'écran ne lit rien de réel |
| La navigation | Appuyer sur un bouton **ne fait rien**. Un prototype ne navigue pas. |
| Les SDK natifs (haptique, flou, dégradés, images, gestes, animations) | Voir §3 |

**Aucun appel réseau sortant, aucun appel backend, aucune génération de séance, aucun appel
LLM payant** n'a été fait pour produire ce dossier.

---

## 2. Ce qui n'est PAS branché — et qu'il faudra brancher avant toute production

C'est la partie la plus importante de ce document. Le ViewModel signale lui-même ces
manques, état par état, dans le panneau « Cet état » du visualiseur.

### 2.1 Le moteur de reprise progressive n'existe pas

Sur l'état « Reprise après 24 jours », l'écran affiche :
**« On te préparera une remise en route progressive. »**

Le verbe est au **futur**, et c'est volontaire : aujourd'hui, la génération de séance ne
sait pas qu'elle doit alléger après une interruption. **Si cet écran partait en production
tel quel, un joueur recevrait une séance normale après 24 jours d'arrêt.**

C'est honnête, ce n'est pas suffisant. **Le moteur doit être branché avant la mise en
production de cet état.**

### 2.2 Trois champs du contrat n'ont aucune source dans l'app

| Champ | Pourquoi il n'est pas branchable aujourd'hui |
|---|---|
| **Séance « commencée »** (état 3) | L'app ne trace pas une séance ouverte en live puis abandonnée : `Session.completed` est un simple oui/non. L'état « Reprendre ma séance » est rendu correctement, mais **il ne peut pas encore se déclencher en vrai**. À brancher dans `SessionLiveScreen`. |
| **Erreur de génération** (état 10) | Aucun store ne conserve l'échec. `screens/newSession/` affiche un toast puis oublie. Champ à créer. |
| **Directive club** (états 12 et 13) | Le contexte de semaine du club (`clubs/{clubId}/weekContexts`) n'est lu **qu'au moment de la génération**, dans `services/aiContext.ts`, et n'est stocké dans aucun store. Le Home n'y a aucun accès. |

### 2.3 Le « pourquoi cette séance » vient des fixtures, pas du backend

La ligne « **Pourquoi : …** » est l'ajout le plus important de la proposition. Dans le
prototype, son texte vient d'un jeu de données que j'ai écrit.

**Ce qui est vrai** : les champs existent réellement dans la séance renvoyée par le
backend (`sessionTheme`, `playerContext.title` / `.summary`, `analytics.rationale`,
`coachingTips`) et sont déjà lus par l'écran de préparation de séance. La plomberie existe.

**Ce qui reste à prouver** : que ces champs sont **remplis assez souvent et assez bien**
pour qu'une ligne s'affiche dans la vraie vie. Le prototype ne le démontre pas. À vérifier
sur un échantillon de séances réelles avant de compter dessus.

La règle est de toute façon stricte : **si les quatre champs sont vides, il n'y a pas de
ligne.** Rien n'est jamais inventé pour remplir l'emplacement.

### 2.4 Le Home ne lit jamais le réseau

`hooks/useNetworkStatus.ts` existe mais n'est appelé par `screens/HomeScreen.tsx` nulle
part. L'état « hors-ligne » est donc rendu correctement, mais le champ qui le déclenche
reste à câbler.

### 2.5 Le match « demain » n'est pas un vrai match

Sur l'état 6, l'écran écrit « **Tu as noté un match demain** » — et jamais « ton match ».
La nuance est voulue : l'information vient d'un **jour de la semaine coché au profil**
(`matchDays`), pas d'un match réel avec une date confirmée. L'écran n'a pas le droit de le
présenter comme un fait établi.

### 2.6 Un ton d'affichage n'est exercé par aucune situation

La note discrète du bas d'écran peut avoir deux tons, « info » et « prudence ».
**Aucune des 15 situations ne produit le ton « prudence »** : son rendu n'est donc vérifié
nulle part. Si ce ton devient réel un jour, il faudra décider à quoi il ressemble.

---

## 3. Ce que le harnais ne peut pas prouver

Le prototype tourne dans **Chrome, sur un PC**. Ce n'est pas un iPhone.

| Ce qui n'est pas fidèle | Conséquence concrète |
|---|---|
| **La police** — celle du système, pas San Francisco | Les points de retour à la ligne peuvent bouger de quelques pourcents. Un texte qui tient tout juste ici peut passer sur deux lignes sur un vrai iPhone, et l'inverse. **Les hauteurs sont justes à quelques pixels, pas au pixel.** |
| **Le dessin des icônes** — des carrés arrondis à la bonne taille et à la bonne couleur | La **métrique** est juste, le **dessin** est faux. Ne juge pas le choix des pictogrammes sur ces images. |
| **Le mouvement** — tout est figé à l'état d'arrivée | Aucun fondu d'entrée, aucune pulsation, aucun geste, aucun défilement réel. |
| **Le flou, les dégradés, les images** | Absents. |
| **Le retour haptique** | Absent. |
| **Le texte ×1,3** — une simulation CSS | On multiplie les tailles de police et les interlignes. Le vrai Dynamic Type d'iOS redistribue **aussi des marges** et peut basculer des mises en page. **Un écran qui tient ici peut encore casser sur téléphone.** Et je ne l'ai généré qu'à 375 px. |
| **Les marges d'encoche** — les valeurs iOS publiées par appareil | Ce ne sont **pas** des mesures faites sur ton téléphone. |
| **La hauteur de la barre d'onglets** — 49 pt + marge, valeur publiée par Apple | Toute ma ligne de flottaison à 729 px repose dessus. **C'est le premier chiffre à confirmer en recette.** |

### La vue « page entière » ne montre pas ce que voit le joueur

Le visualiseur a deux vues. La vue **« zone visible sans défilement »** est fidèle : c'est
ce que le joueur voit en ouvrant l'app. La vue **« page entière »** neutralise des
conteneurs de mise en page pour tout montrer d'un coup : c'est une vue d'exploration et de
mesure, **pas une vue produit**. Les captures `etat-01` à `etat-14` sont en page entière ;
les captures `vnext-…` / `actuel-…` sont en zone visible.

### La courbe a besoin d'une largeur en pixels

La longueur d'un segment oblique est une hypoténuse : elle ne peut pas s'exprimer en
pourcentage. Dans l'app, la mesure se fait toute seule au montage. Dans tout rendu en une
seule passe (comme ce harnais), il faut lui passer la largeur explicitement, sinon un repli
sur un appareil de référence s'applique et la courbe est légèrement trop large ou trop
étroite. C'est fait correctement ici, mais c'est un piège à retenir pour la production.

---

## 4. Les seuils d'affichage à valider

Cinq seuils décident **de ce que l'écran a le droit de montrer** quand la donnée est maigre.

> **Ce ne sont PAS des seuils sportifs.** Aucun ne touche à une séance, une charge, une
> intensité, un volume ou une prescription. Le moteur de génération ne les voit jamais.
> Un seuil sportif change ce que le joueur **fait** ; ceux-ci changent seulement ce que
> l'app **ose affirmer**.

| Seuil | Valeur | Ce qu'il décide | Pourquoi cette valeur |
|---|---:|---|---|
| Séances avant d'afficher une tendance | **4** | En dessous : pas de courbe, pas de pastille d'état. | 4 = exactement la première phase d'un cycle FKS (« Fondations », séances 1 à 4), un repère que le joueur connaît. Et sous 4 séances, le calcul de charge reste dominé par ses valeurs de démarrage (`CTL0 = 15`, `ATL0 = 12`) : on tracerait la constante d'usine, pas le joueur. **Le wireframe de l'audit en proposait 3.** Une ligne à changer. |
| Points avant de tracer une courbe | **3** | Deux points font un segment, pas une tendance. | Et un jour sans donnée n'est **jamais** un point à zéro. |
| Jours sans séance avant de basculer en « reprise » | **14** | Au-dessus : cycle mis en pause, action « Reprendre mon programme ». | Deux semaines pleines. En dessous, un trou est la vie normale d'un amateur (vacances, examens, match décalé) — dire « content de te revoir » après 4 jours serait un reproche déguisé. |
| Fenêtre où un match peut être mentionné | **2 jours** | En dehors : le match n'apparaît nulle part. | L'audit reproche justement un « Match : Proche » permanent, sans date et sans lien. |
| Part de mots déjà dits au-delà de laquelle le conseil disparaît | **50 %** | Au-dessus : le conseil est **supprimé**, pas grisé. | Seuil de rédaction, pas de sport. C'est ce qui fait disparaître le conseil sur 7 situations sur 15. |

**Les cinq sont marqués « à valider par le fondateur » en toutes lettres dans le code.**

### Quatre seuils de plus, apportés par la variante 2

La carte « Ma progression » en ajoute **quatre**, marqués de la même façon
(« SEUIL D'AFFICHAGE — À VALIDER PAR LE FONDATEUR »), et soumis à la même règle : aucun ne
touche à une séance, une charge, une intensité ou une prescription.

| Seuil | Valeur | Ce qu'il décide | Pourquoi cette valeur |
|---|---:|---|---|
| Séances avant de passer de « ça se construit » à « voilà ta progression » | **4** | En dessous : des faits listés, pas de courbe, **pas de bouton**. | **Volontairement repris du seuil de la variante 1**, pas redéfini. La carte et le bloc « Ma forme » vivent sur le même écran : deux seuils différents feraient un écran qui se contredit — la carte dirait « pas encore de tendance » à côté d'un bloc qui en affiche une. Un test verrouille cette égalité. |
| Points avant de tracer | **3** | Idem, repris de la variante 1. | Même raison. |
| Jours de charge **réellement enregistrée** | **3** | Exigés **en plus** des points. | Deux comptes distincts, vérifiés tous les deux. 7 points adossés à 0 jour observé ne dessinent pas un joueur : ils dessinent la décroissance d'une constante de démarrage. |
| Jours distincts pour comparer un test | **2** | Deux mesures d'un même exercice doivent venir de **deux jours différents**. | C'est ce que la page Progression actuelle ne vérifie pas : deux essais du même après-midi y produisent une « progression ». |

**Ce qui n'a PAS été inventé** : aucun palier d'accomplissement, aucun nombre de cycles,
aucune durée de référence, aucune valeur cible de test. Rien ne les mesure, donc la carte
ne les dit pas.

---

## 4 bis. La carte « Ma progression » (variante 2) — ce qu'elle ne sait pas encore

> Explication complète et sans jargon dans
> [`VIEWMODEL_PROGRESSION.md`](VIEWMODEL_PROGRESSION.md). Ici : uniquement les trous.

### 4 bis.1 Les entraînements club ne sont capturés nulle part

**C'est la limite qui commande toutes les autres.**

Rien dans l'app n'enregistre ce qu'un joueur fait réellement à l'entraînement de son club.
Ce qui existe aujourd'hui n'injecte qu'une charge **supposée**, à partir de cases cochées
au moment de l'inscription au profil. Une case cochée en juin décide encore de la charge
de juillet, que le joueur soit allé à l'entraînement ou non.

Conséquences, assumées :

- **La carte n'affiche jamais d'état physique global.** Ni « En forme », ni
  « Prêt à performer ». Cette interdiction n'est pas une consigne qu'un développeur
  pourrait oublier : elle est **inscrite dans la forme même de la donnée d'entrée**.
  Tant que le drapeau « charges club capturées » est faux, il est **impossible d'écrire**
  un libellé d'état global — le programme refuse de compiler.
- **Ce drapeau est aujourd'hui TOUJOURS faux.** Il n'est branché sur rien. C'est une place
  réservée pour le jour où la donnée existera, pas une fonctionnalité.
- **La courbe porte donc obligatoirement sa portée** : « Calculé sur tes séances FKS
  uniquement — tes entraînements club n'y sont pas comptés. » Cette phrase n'est pas
  optionnelle dans le programme : une courbe sans portée est impossible à produire.

### 4 bis.2 La pastille « En forme » de l'en-tête — retirée en variante 2

**C'était le point le plus gênant du lot. Il est traité, dans un sens et un seul : celui
que tu as écrit.**

Le constat d'abord. Sur **trois des six écrans** de la variante 2, une pastille **« En
forme »** ou **« Un peu chargé »** apparaissait en haut à droite, à côté de « Salut,
Yanis » — pendant que la carte, ~200 px plus bas, écrivait « tes entraînements club n'y
sont pas comptés ». Un joueur qui lit de haut en bas apprenait donc son état, puis
apprenait qu'on ne peut pas le connaître. **L'écran se contredisait lui-même.**

**TA DÉCISION DU 28 JUILLET (D1), APPLIQUÉE SANS CONDITION.** Cette section décrivait
jusqu'ici un verrou *conditionnel* : la pastille disparaissait tant qu'un drapeau
`chargesClubCapturees` restait faux, et « reviendrait toute seule » le jour où l'app
capturerait les charges club. **Ce n'est plus le cas, et c'est toi qui l'as tranché :**

> *« La pastille d'état global est RETIRÉE COMPLÈTEMENT de la variante "Progression
> intégrée". Aucun de ces libellés, ni aucun autre jugement global : "En forme", "Frais",
> "Prêt à performer", "Un peu chargé", "Charge modérée". Motif : le modèle de charge
> utilise encore des valeurs initiales artificielles et ne connaît pas les entraînements
> club. Une pastille "Charge FKS" ne pourra revenir que le jour où son calcul reposera sur
> des données entièrement réelles avec une portée expliquée. »*

Ce qui a été fait :

- le retrait vit **dans le ViewModel du Home** (`screens/homeVNext/viewModel.ts`, §5.7) —
  **pas** dans le composant d'en-tête : un composant ne doit jamais décider de ce que
  l'app a le droit d'affirmer ;
- il n'est **plus derrière un drapeau**. L'option `chargesClubCapturees` a été
  **supprimée** de ce ViewModel, et le champ de sortie `etatGlobal` a été supprimé du
  contrat de la carte. Il n'existe donc plus aucune valeur d'entrée capable de faire
  revenir « En forme » en variante 2 : la question posée par l'ancien drapeau n'était pas
  la bonne, puisque le calcul lui-même part de `ATL0` / `CTL0` ;
- **la variante 1 garde la sienne**, volontairement, et uniquement pour ça : c'est l'écart
  que tu dois pouvoir regarder côte à côte — elle n'a pas bougé d'un pixel ;
- le retrait est **mesuré, pas supposé** : le vérificateur lit le marqueur de la pastille
  sur toutes les pages de la variante 2 (ligne « f2 »), et une suite de tests interdit en
  plus **tous** les libellés de `FOOTBALL_LABELS` — la liste est *lue* dans la config, pas
  recopiée, donc un septième état ajouté un jour serait couvert sans que personne y pense.

**Ce qui reste ta décision, et seulement celle-là** : à quelle condition une mention de
charge pourra revenir un jour en haut d'écran. Ta règle actuelle est claire — *quand son
calcul reposera sur des données entièrement réelles, avec une portée expliquée*. Tant que
ce n'est pas le cas, aucune reformulation n'est proposée : « Charge FKS : modérée » avait
été envisagée à l'itération précédente, elle est **écartée**, le libellé « Charge modérée »
faisant partie de ceux que tu as nommément interdits.

### 4 bis.3 La page Progression n'a pas été refondue, et ses calculs restent douteux

Le pied « Voir ma progression » mène à un écran que je n'ai **pas** réparé — c'était hors
périmètre, explicitement. Ce qui l'attend là-bas :

| Ce qui est faux | Détail |
|---|---|
| Le grand encart du haut | Courbe de 30 jours et libellé d'état repartis de deux constantes d'usine, sur 45 jours de chauffe. Un jour sans donnée y devient un point à charge zéro. La légende ne dit jamais sur quoi c'est calculé |
| Les 6 accomplissements | Affichés en toutes circonstances. Sur un compte neuf : six cadenas |
| Le compte de cycles | Estimé en divisant les séances par 12 — le code lui-même appelle ça un substitut |
| Le mot « série » | Compté de **deux façons différentes** sur la même page, sous le même mot |
| Le calendrier et les stats du mois | Affichés en toutes circonstances, avec des « 0 » et des « — » |
| La comparaison de tests | Ne couvre que 9 des 17 champs, et ne vérifie jamais que les deux mesures viennent de deux jours différents |

**Le bouton part donc avec sa réserve**, écrite dans le programme et répétée dans les
avertissements du prototype : *le haut de la page Progression doit être corrigé avant toute
mise en production de ce lien.*

Le choix fait ici est de **n'ouvrir le lien que quand la page porte au moins trois blocs
vrais** — pas de le supprimer, pas de le laisser toujours ouvert. Ce n'est pas une
réparation, c'est un pansement honnête.

### 4 bis.4 La comparaison de tests ne montre que ce qui existe vraiment

La carte n'affiche une comparaison que s'il existe **deux mesures du même exercice à deux
jours différents**. Sinon elle explique pourquoi elle ne compare pas.

Ce que ça veut dire concrètement pour un joueur réel :

- un joueur qui n'a jamais fait de test : **aucune comparaison**, et la carte le dit ;
- un joueur qui a fait une seule batterie : **aucune comparaison** — il faut refaire les
  mêmes exercices plus tard ;
- un joueur qui a changé d'exercices entre deux batteries : **aucune comparaison** sur les
  exercices non repris ;
- un joueur qui a fait deux essais le même après-midi : **aucune comparaison** — c'est un
  deuxième essai, pas un progrès.

**C'est volontairement plus sévère que la page actuelle**, et ça se paiera : beaucoup de
joueurs verront « pas encore de comparaison » là où l'app actuelle leur montrerait un
chiffre. Le chiffre serait faux, mais il serait là. **C'est un arbitrage à assumer**, pas
un détail technique.

Une seule comparaison est affichée sur la carte : **la plus récente**, jamais la plus
flatteuse. La liste complète est ce que le pied « Voir ma progression » va chercher.

> **Un défaut de démonstration corrigé ici, et il valait la peine d'être vu.** Le cas qui
> compte vraiment — un **chrono qui baisse** et qui est un **progrès** — n'apparaissait sur
> **aucun** des 60 écrans de la variante 2, alors qu'il existait dans les données. Cause :
> les quatre mesures d'une même batterie partageaient un seul horodatage ; à égalité de
> date, le départage se fait par l'ordre officiel des champs de test, et le saut en
> longueur y arrive en premier. Le seul écart jamais **affiché** était donc « +9 cm » : le
> cas facile, celui où le signe du chiffre et le sens sportif vont dans le même sens.
>
> Ce sont les **données de démonstration** qui ont été corrigées, pas la règle de
> départage : dans la fixture, chaque exercice porte désormais un horodatage distinct, et le
> dernier exercice comparable est le sprint. Les deux sens sont donc lisibles à l'écran :
> **« −0,07 s, en progrès »** sur « Test physique amélioré », **« +9 cm, en progrès »** sur
> « Tendance disponible ». Le vérificateur recalcule le sens à partir de l'écart signé et du
> drapeau « plus petit = mieux », puis le compare à ce que la carte **écrit** (ligne « k »).

> ### ⚠️ Mais cette démonstration n'est pas atteignable en vrai — à lire avant de conclure
>
> **Ce qui est prouvé** : le rendu est juste. Un écart négatif est bien présenté comme un
> progrès, et la carte ne choisit jamais la comparaison la plus flatteuse.
>
> **Ce qui n'est PAS prouvé** : qu'un joueur verra un jour cet écran. L'app enregistre une
> batterie du socle en **une seule entrée avec un seul horodatage**
> (`screens/TestsScreen.tsx:241` — `const cleanEntry: TestEntry = { ts: Date.now() }`, puis
> tous les champs saisis dans cette même entrée). La fixture, elle, écrit **une entrée par
> exercice** à des horaires différents. Ce n'est pas ce que le produit fabrique aujourd'hui.
>
> Vérifié par sonde, avec les deux formes de données :
>
> | Forme des données | Comparaisons calculées | Ce que la carte **affiche** |
> |---|---|---|
> | **Production** (une batterie, un horodatage) | les 3, sprint compris (−0,07 s, amélioration) | **le saut** — le sprint n'atteint aucun écran |
> | **Fixture** (un horodatage par exercice) | les 3 | le sprint |
>
> Autrement dit : le départage à égalité de date par l'ordre officiel des champs
> (`broadJumpCm` avant `sprint10s`) **mord toujours sur les données réelles**. Le cas ne
> devient atteignable que si le joueur refait le sprint **seul**, un autre jour — ce qui
> arrive, mais qu'on ne peut pas présenter comme le cas normal.
>
> **Quatre sorties possibles, toutes du ressort du fondateur** :
> (a) horodater chaque exercice dans `TestsScreen` ; (b) changer la règle de départage à
> égalité de date ; (c) afficher plus d'une comparaison ; (d) l'assumer et l'écrire — ce que
> fait ce paragraphe en attendant la décision.

### 4 bis.5 Le jour d'un test est calculé en heure universelle

Dans le prototype, le jour d'un test est déterminé en heure universelle, pour que les
captures soient reproductibles d'une machine à l'autre. **Le reste de l'app utilise l'heure
locale.**

À trancher au branchement : **un test fait à 23 h ne doit pas basculer au lendemain.**
C'est signalé dans les avertissements du prototype sur les cas concernés.

### 4 bis.6 Aucun de ces six cas ne vient d'un vrai compte

Les six situations de la carte sont des **fixtures écrites à la main**. Les durées, les
tests, les points de courbe : tout est inventé, et chaque page le dit. Ce que ça ne prouve
pas :

- que les données réelles auront cette forme (les durées de séance sont souvent absentes
  en vrai — c'est justement pour ça que le cas « donnée manquante » existe) ;
- que les textes tiendront avec de vrais noms d'exercices ;
- que les seuils tomberont juste sur un vrai historique.

---

## 4 ter. LES CAS QUI NE SONT PAS ATTEIGNABLES AVEC LE FORMAT RÉEL

> **Décision D4** : aucune fixture mensongère. Les données de démonstration doivent
> respecter **exactement** le format que `TestsScreen` produit réellement. Interdit de
> fabriquer des dates pour forcer un exemple à l'écran.

### La faute de l'itération précédente, dite en clair

À l'itération précédente, les batteries de test avaient été **éclatées en une entrée par
exercice**, avec une heure fabriquée pour chacune (10 h 05, 10 h 25, 10 h 45…), dans le seul
but de faire remonter un cas à l'écran. **Le produit ne fabrique pas cette forme de
donnée.** La démonstration montrait donc quelque chose qui n'existe pas.

Ce qui devait changer, c'était **la règle de sélection**, pas les données. C'est fait, et
les fixtures sont revenues au format réel.

### Les six contraintes du format réel — relues dans le code

| # | Contrainte | Où c'est écrit |
|---|---|---|
| 1 | **Une batterie du socle = UNE entrée, UN seul horodatage.** Les 3 tests du socle partagent leur date à la seconde près. | `screens/TestsScreen.tsx`:241, puis :245-249 |
| 2 | Une batterie **peut être incomplète** : passer une étape est permis, et seuls les champs renseignés sont écrits. Une entrée socle à 1 ou 2 champs est **réelle**. | `TestsScreen.tsx`:348-350 et :245-249 |
| 3 | **Un test optionnel est enregistré SEUL**, dans sa propre entrée, avec son propre horodatage. Il ne peut **jamais** partager une entrée avec un test du socle. | `TestsScreen.tsx`:212 et :327-332 |
| 4 | Le champ `notes` **n'existe que** sur une entrée socle. | `TestsScreen.tsx`:250 |
| 5 | `playlist` = le cycle actif **au moment du test**. C'est une **provenance**, pas un sélecteur. | `TestsScreen.tsx`:243-244 |
| 6 | L'historique est **décroissant** (le plus récent d'abord) et **borné à 30 entrées**. | `screens/tests/hooks/useTestsStorage.ts`:56-57 |

### Ce que ces contraintes rendent NON ATTEIGNABLE — et donc non démontrable ici

| Cas | Pourquoi il ne peut pas exister |
|---|---|
| **Deux tests du socle avec des horodatages différents le même jour** | Contrainte 1. Une batterie s'écrit en une fois. C'est **précisément** pour ça que l'ordre de départage (règle 3) est utile au quotidien et pas anecdotique. |
| **Un test optionnel qui départage un test du socle à horodatage égal** | Contrainte 3. Les deux ne partagent jamais une entrée, donc jamais un horodatage. Les rangs 4 à 17 de l'ordre de départage sont donc **structurellement peu sollicités** — ils existent pour un joueur qui n'aurait **que** des tests optionnels comparables. |
| **Une note (`notes`) attachée à un test optionnel** | Contrainte 4. |
| **Un historique de plus de 30 entrées** | Contrainte 6. Un joueur très assidu sur plusieurs saisons **perdra ses plus anciennes mesures** — et donc, un jour, la possibilité de comparer. **Ce n'est pas une limite du prototype, c'est une limite du produit**, et elle n'est écrite nulle part côté joueur. À trancher. |
| **Une comparaison bâtie sur deux mesures du même jour** | Refusée par le contrat (seuil « 2 jours distincts »). La fixture `aucune-comparaison-de-test` **montre le refus**, pas le résultat. |

### La conséquence à assumer

Un jeu de fixtures honnête est **moins spectaculaire** qu'un jeu arrangé. Trois cas de
démonstration reposent sur la règle 1 (le cycle actif désigne le test) parce que c'est la
situation normale ; un seul exerce vraiment les règles 2 et 3. **C'est le produit qui est
comme ça**, ce n'est pas un manque de scénarios.

---

## 4 quater. LE RÉGLAGE « RÉDUIRE LES ANIMATIONS » — ce qui est fait, ce qui ne l'est pas

### Ce qui est modélisé

Le réglage vit dans un contexte de **présentation**, à côté de l'échelle typographique —
pas dans le programme qui décide quoi afficher. Motif : ce programme répond à « qu'est-ce
que l'écran a le **droit** d'afficher ? », une question sur la **donnée**. Un réglage
d'accessibilité du téléphone n'est pas une donnée de joueur. L'y mettre aurait aussi forcé
à ajouter un champ obligatoire aux 15 fixtures, pour zéro information nouvelle.

### Ce qui n'est PAS branché

**Le prototype n'a aucune API système.** C'est la fixture (ou la bascule du visualiseur) qui
pilote le drapeau, jamais le téléphone.

Le branchement réel est écrit en toutes lettres dans le fichier :
`AccessibilityInfo.isReduceMotionEnabled()` au montage **+ un abonnement à
`reduceMotionChanged`**. L'abonnement est un **ajout** : le Home de production ne lit la
préférence **qu'une seule fois**, donc un joueur qui active le réglage en cours de route
n'est pas servi tant qu'il ne relance pas l'app.

### Ce qu'une capture ne peut pas montrer

**Au repos, les deux rendus sont identiques à l'œil.** C'est le résultat voulu — aucune
information n'est portée par un mouvement — mais ça veut dire qu'**aucune capture d'écran
ne peut prouver que le réglage est respecté**.

La preuve est donc dans le **balisage**, et elle est reproduite dans la capture
`captures-final/mouvement-reduit-vs-normal-tendance-disponible-375.png` : la ligne de code
du conteneur du bouton du jour est affichée sous chaque colonne. À gauche il porte une
consigne de mouvement, à droite **aucune**.

### Ce que le prototype ne répare pas

`components/home/HomePrimaryCTA.tsx` (lignes 39-49) joue une pulsation en boucle infinie
sans jamais consulter le réglage. **Hors périmètre, non corrigée.** Le prototype ne fait
que la mesurer : le harnais force « mouvement réduit » avant chaque rendu, et deux
générations successives sont rigoureusement identiques **partout sauf sur ce bouton**.

---

## 5. Hors périmètre, volontairement

### La définition de « Série »

Le mot « Série », la métrique et la flamme sont **totalement interdits** dans ce prototype.
C'est vérifié automatiquement, dans le rendu **et** dans le code source : zéro occurrence.

**Mais ce prototype ne dit pas ce que « Série » devrait devenir.** La question — faut-il
une notion de régularité, et si oui laquelle, calculée sur quoi — est une décision produit
qui t'appartient, et elle est **hors du périmètre de ce travail**.

Ce qui est établi, et qui documente la question : la valeur actuelle peut être composée
**à 100 % de charges club auto-injectées** à partir des seules cases cochées au setup
profil. Un joueur qui a coché mardi/jeudi club et samedi match, **sans une seule séance
FKS**, peut voir « Série 5 j » et une flamme « 5 jours d'affilée ». C'est ça qui rend la
métrique inutilisable en l'état, pas le principe de la régularité.

### Le Home de production

`screens/HomeScreen.tsx`, `components/home/` et `hooks/home/` ont été **lus, jamais
modifiés**. Deux défauts y ont été trouvés au passage et **non corrigés**, parce qu'ils sont
hors périmètre :

1. **Le bouton principal pulse en permanence, même en mode « réduire les animations ».**
   `components/home/HomePrimaryCTA.tsx` lance une boucle infinie sans consulter le réglage
   d'accessibilité — alors que le fondu d'entrée du même écran, lui, le respecte.
   Deux conséquences réelles : aucune comparaison visuelle automatique du Home actuel n'est
   reproductible, et un joueur qui a demandé moins d'animations voit quand même le bouton
   bouger.
2. **Un `<div>` décoratif vide de 160 × 160 px dépasse le cadre de l'écran de 43 px sur la
   droite**, à toutes les largeurs, y compris 768 px, sur les 60 pages mesurées.

---

## 6. Les questions ouvertes

### 1. Le vide chez le nouveau joueur — le manque le plus concret

**Mesure** : 399 px de contenu dans 729 px de zone visible à 375 px, soit environ **330 px
de fond nu** au-dessus de la barre d'onglets.

Le wireframe de l'audit proposait une carte « **ON COMMENCE PAR LÀ** » en trois étapes.
Je ne l'ai pas faite, et voici pourquoi : le contrat de données ne prévoit aucun champ pour
ça, et **écrire ces trois lignes, c'est écrire du texte produit destiné au joueur** — donc
une décision qui t'appartient, pas une correction technique. Inventer ce contenu dans
l'écran aurait été exactement le défaut que ce prototype cherche à réparer.

**Recommandation précise** : ajouter au contrat un bloc `firstSteps` (un titre + une liste
d'étapes), produit par le sélecteur, affiché uniquement quand aucune séance n'a été
terminée. **C'est le manque n° 1 à instruire.**

### 2. La courbe n'est pas décrite à la synthèse vocale

Sa description dit **ce qui est dessiné** et **sur quoi c'est calculé**, mais jamais le
**sens** de la tendance. Déduire « en hausse » ou « en baisse » dans l'écran serait une
affirmation produite par le rendu — or c'est au ViewModel de décider ce que l'app a le
droit d'affirmer.

**En l'état, un joueur non-voyant n'obtient aucune tendance.**
**Recommandation** : ajouter un champ `trendSummary` au contrat.

### 3. La respiration du bas est approximée

Le prototype n'étant pas monté dans le navigateur d'onglets, il ne peut pas lire la hauteur
réelle de la barre. J'applique 24 px par-dessus la marge basse. **En production, il faudra
ajouter la hauteur réelle de la barre d'onglets, sinon le lien de sortie passera dessous.**

### 4. La moitié des cas demande encore de faire défiler

29 couples situation × largeur sur 60. Rien n'est masqué, c'est mesuré. Mais la règle
« l'écran finit tôt » n'est pleinement tenue que sur la moitié des cas.
**Question** : est-ce acceptable, ou faut-il couper encore ?

### 5. En texte agrandi, la phrase qui rend la mesure honnête est coupée

**C'est le défaut le plus concret trouvé dans le prototype lui-même.**

Sur 8 des 14 situations, en texte ×1,3, la phrase
*« Calculé sur tes séances FKS uniquement — tes entraînements club n'y sont pas comptés. »*
est bornée à 2 lignes et **coupée en cours de route**.

Autrement dit : **le joueur qui grossit la police garde la courbe et perd la mise en garde**.
C'est exactement la règle d'honnêteté n° 6 qui casse au moment où elle sert le plus — pour
un joueur qui a des difficultés à lire.

**Comment ça a été trouvé, et ce que ça dit du reste** : en regardant une capture à l'œil.
L'image montrait des points de suspension que le vérificateur automatique annonçait absents.
Cause du faux verdict : le compteur ne testait que `overflow: hidden`, alors que
react-native-web rend le bornage avec `-webkit-line-clamp`, que le navigateur calcule en
`overflow: clip`. Le compteur annonçait **1** texte coupé en ×1,3 ; il y en avait **13**.
Le vérificateur a été corrigé et les chiffres publiés sont les corrigés.

**Leçon** : une vérification automatique qui passe n'est une preuve que si on a vérifié
qu'elle sait échouer. Celle-ci ne savait pas.

**Corrections possibles, à trancher** — aucune n'a été appliquée, ce sont des décisions
de rédaction :
1. raccourcir la phrase (« Basé sur tes séances FKS, pas sur tes entraînements club ») ;
2. la sortir du bornage à 2 lignes et la laisser respirer ;
3. la couper en deux : une phrase courte visible, le détail dans l'écran Progression.

### 6. En 768 px, la largeur gagnée part en vide

Le prototype ne pose **aucune largeur maximale au contenu** : à 768 px, le bouton d'action
s'étire sur toute la largeur et la ligne « Pourquoi » traverse l'écran d'un bord à l'autre.
Visible sur `captures/largeur-seance-prevue-vnext-768px-tablette.png`.

Ce n'est pas un défaut hérité — l'audit fait le même reproche à l'écran actuel à 430 px —
mais ce n'est pas résolu non plus. **Question** : FKS vise-t-il la tablette ? Si oui, il
faut une largeur de lecture maximale (autour de 480 px, contenu centré). Si non, ce point
tombe.

### 7. La teinte d'action

`#B4530C` est conforme (5,02 : 1, mesuré sur le rendu réel — c'est le pire ratio de tout
l'écran proposé, et il passe). Mais c'est **un choix d'identité**, pas une correction
technique. `constants/theme.ts` n'est pas modifié. **À regarder et à trancher.**

### 8. *(Variante 2)* La carte fait basculer six écrans sous la ligne de flottaison

**Mesure** : sur 30 comparaisons, **20 écrans tenaient sans défiler en variante 1, 14 en
variante 2**. Six basculent, aucun dans l'autre sens.

Cinq d'entre eux dépassent de **2 à 31 px** — quelques millimètres, récupérables sur les
marges internes de la carte. **Le sixième dépasse de 110 px** : c'est le cas « deux
séances » en police agrandie ×1,3, où la carte est à son plus lourd (quatre lignes de fait)
sur un écran déjà à 6 px de la limite en variante 1.

> ⚠ **Un chiffre publié plus tôt était faux.** Une première lecture résumait ces six
> bascules par « de 2 à 31 px seulement ». La fourchette réelle va de **2 à 110 px** :
> le cas ×1,3 avait été confondu avec les autres. Recalcul et détail ligne par ligne dans
> [`COMPARAISON.md`](COMPARAISON.md) §8.3.

**Trois pistes, aucune appliquée** — ce sont des décisions :
1. réduire les marges internes de la carte (récupère les cinq cas à ≤ 31 px, pas le sixième) ;
2. en état « ça se construit », n'afficher que **trois** faits au lieu de quatre ;
3. accepter le défilement, en considérant que le bas de la carte n'est pas de l'action
   mais de la lecture.

**La hauteur se mesure, le confort se ressent.** Ce point-là se tranche sur ton téléphone,
pas dans un tableau.

### 9. *(Variante 2)* La carte entière n'est pas cliquable

Tu autorisais la carte entière pressable « si l'accessibilité reste claire ». Elle ne le
reste pas : rendre la carte cliquable fusionne tout son contenu en un seul objet pour la
synthèse vocale, et **la phrase qui porte l'honnêteté de la mesure disparaît ou se noie**.
Le raisonnement complet est dans
[`DECISIONS_VISUELLES.md`](DECISIONS_VISUELLES.md) §6 bis.4.

**Le pied est donc le seul élément tactile** — mais il fait toute la largeur de la carte,
là où le lien de la variante 1 ne faisait que la largeur de son texte. **La cible a grossi.**

Si tu veux quand même la carte entière cliquable, c'est possible : il faudra décider ce
qu'on fait de la phrase de portée.

---

## 7. Détails de chantier

- **Rien n'est commité.** La branche `feat/home-vnext-prototype` ne contient que le commit
  de départ `724c062`. Tout le travail est en fichiers non suivis, dans les cinq dossiers
  autorisés. Voir [`FICHIERS_NON_MODIFIES.md`](FICHIERS_NON_MODIFIES.md).
- **`apercu-home-vnext.html`**, dans ce même dossier, date d'une étape antérieure du
  chantier (avant la correction du bornage des textes). Il n'a pas été régénéré, pour ne
  pas écraser le travail d'un autre intervenant. **Le visualiseur et les captures, eux,
  sont à jour.** En cas de doute, c'est le visualiseur qui fait foi.
- **Deux erreurs de style de code subsistent** dans le fichier de tests
  (`__tests__/homeVNext/viewModel.test.ts`, lignes 449-450 : deux variables non utilisées).
  Fichier écrit par un autre intervenant, laissé intact pour éviter un conflit.
  Correction triviale.
- **Le lint du harnais** sort quelques avertissements, tous dans des fichiers **générés**
  ou dans des bouchons. Ils sont hors du périmètre de `npm run lint`, qui ne ramasse que
  les fichiers TypeScript. **Les sources du prototype, elles, sont propres : 0 erreur,
  0 avertissement.**

---

## 8. Ce que je te conseille de faire avant de valider

1. **Ouvre le visualiseur et passe les 14 situations**, en vue « zone visible sans
   défilement », à 375 px. C'est la vue honnête.
2. **Bascule en « côte à côte »** sur les situations 1, 2, 4 et 7.
3. **Réponds aux 12 questions** du panneau « Points à valider ». Chacune dit quoi regarder,
   dans quel état, et ce qui vaut oui ou non.
4. **Tranche sur la couleur d'action** (§4 de [`DECISIONS_VISUELLES.md`](DECISIONS_VISUELLES.md)).
5. **Décide si le bloc « on commence par là » doit exister**, et si oui, écris-en le texte —
   c'est la seule chose que je n'ai pas voulu inventer à ta place.
6. **Une fois d'accord sur l'écran** : recette téléphone. Les hauteurs, la barre d'onglets,
   la police et le vrai texte agrandi ne peuvent être validés que là.

### Et pour la variante 2, quatre choses de plus

7. **Bascule en « côte à côte », paire `vNext / Progression`**, sur les trois cas
   « nouveau joueur », « deux séances » et « tendance disponible ». **Descends jusqu'en bas
   des deux colonnes** : la question est de savoir si le lien flottant a vraiment disparu,
   ou si la carte s'est ajoutée à côté.
8. **Réponds aux 14 questions** du panneau « Points à valider » propres à la variante 2 —
   dont les deux nouvelles : *« Quel test la carte affiche-t-elle ? »* et *« Un repère en
   recul s'affiche-t-il ? »*. Et passe par l'onglet **« Axes »** : les sept axes s'y
   jugent un par un, avec la bascule à manipuler pour chacun.
9. **Regarde le cas « donnée manquante »** : c'est la démonstration que l'app préfère se
   taire plutôt qu'écrire « 0 min ». Si ce comportement te gêne, il faut le dire maintenant —
   il structure tout le reste.
10. **Valide (ou conteste) le mapping cycle → test** (§5 bis du ViewModel, onglet « La
    règle » du visualiseur). C'est la seule décision produit vraiment neuve de cette
    itération : quel test le Home met en avant selon le cycle actif — Force → saut en
    longueur, Endurance → 6 min, Explosivité → sprint 10 m, Fondation et Saison → aucun.
    Chaque ligne cite la phrase du dépôt qui la fonde et ce qui a été écarté.
    **La pastille « En forme », elle, n'est plus une question ouverte** : ta décision D1 du
    28 juillet l'a retirée sans condition de la variante 2 (§4 bis.2).
