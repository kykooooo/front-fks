# Home actuel contre proposition vNext — les chiffres

> **Toutes les valeurs de ce document sont des MESURES**, pas des estimations.
> Elles sortent d'un vrai moteur de rendu (Chrome sans interface), qui charge les deux
> écrans avec les mêmes composants, la même feuille de style et la même méthode.
> Les rares valeurs estimées sont écrites **« estimé »** en toutes lettres.
>
> Fichier de mesures brut : [`mesures-hauteurs.md`](mesures-hauteurs.md).
> Les chiffres sur l'existant qui ne viennent pas de mes mesures sont sourcés
> `AUDIT_HOME.md §x`.

---

## 1. Le résumé en cinq lignes

| Ce qu'on mesure | Home actuel | Proposition vNext |
|---|---:|---:|
| Hauteur moyenne de page (60 mesures) | référence | **−40,0 %** |
| Blocs de premier niveau, en moyenne | **7,9** | **5,3** |
| Écrans qui tiennent sans faire défiler (sur 60) | **0** | **31** |
| Pire contraste de texte de tout l'écran | **2,15 : 1** | **5,02 : 1** |
| Plus petite zone tactile | **31 px** | **44 px** |

Le seuil d'accessibilité pour un texte est de 4,5 : 1, et la taille minimale d'une zone
tactile est de 44 points. **La proposition passe les deux ; l'écran actuel ne passe ni l'un
ni l'autre.**

---

## 2. Hauteur de page, état par état

Vue « page entière » : rien n'est coupé, marges de safe area comprises.
Une baisse de hauteur signifie moins de choses à faire défiler, pas du texte rétréci —
les tailles de police de la proposition sont dans la même fourchette que l'actuel.

| État | 320 px | 375 px | 390 px | 768 px | Écart moyen |
|---|---|---|---|---|---:|
| Nouveau joueur | 1204 → **359** | 1177 → **399** | 1163 → **402** | 1100 → **323** | **−68 %** |
| Séance prévue aujourd'hui | 1174 → **811** | 1108 → **833** | 1111 → **836** | 1065 → **723** | **−28 %** |
| Séance à reprendre | 1174 → **793** | 1108 → **815** | 1111 → **818** | 1065 → **723** | **−29 %** |
| Séance terminée | 1262 → **645** | 1233 → **669** | 1236 → **672** | 1153 → **595** | **−47 %** |
| Jour de récupération | 1297 → **809** | 1249 → **833** | 1252 → **836** | 1172 → **723** | **−36 %** |
| Jour sans séance prévue | 1277 → **673** | 1213 → **697** | 1216 → **700** | 1153 → **623** | **−45 %** |
| Reprise après interruption | 1241 → **500** | 1230 → **536** | 1216 → **521** | 1153 → **442** | **−59 %** |
| Tendance indisponible | 1257 → **563** | 1230 → **603** | 1216 → **606** | 1153 → **527** | **−53 %** |
| Tendance disponible | 1167 → **643** | 1103 → **667** | 1106 → **670** | 1043 → **593** | **−42 %** |
| Erreur de génération | 1220 → **643** | 1176 → **667** | 1179 → **670** | 1096 → **593** | **−45 %** |
| Hors-ligne | 1259 → **849** | 1196 → **889** | 1199 → **892** | 1116 → **781** | **−28 %** |
| Aucune directive club | 1174 → **777** | 1108 → **817** | 1111 → **820** | 1065 → **723** | **−30 %** |
| Directive club non appliquée | 1174 → **777** | 1108 → **817** | 1111 → **820** | 1065 → **723** | **−30 %** |
| Joueur autonome sans club | 1174 → **777** | 1108 → **817** | 1111 → **820** | 1065 → **723** | **−30 %** |
| *Textes longs (test de résistance)* | 1299 → **833** | 1267 → **873** | 1254 → **876** | 1116 → **781** | **−32 %** |

**Moyenne sur les 60 comparaisons : −40,0 %.**

### Ce que le tableau ne dit pas et qu'il faut lire avec

**Les deux extrêmes sont les deux vérités du prototype.**
Le nouveau joueur gagne **68 %** : c'est l'écran qui arrête d'inventer, il n'y a presque
plus rien à dire une fois qu'on retire ce qui était faux.
La séance prévue ne gagne que **28 %** : c'est l'écran qui, lui, a vraiment quelque chose
à dire — et il en dit même **plus** qu'aujourd'hui, puisqu'il ajoute la ligne « pourquoi ».

**Le gain n'est pas un gain de densité, c'est un gain de silence.**
Rien n'a été rétréci ni compressé. Ce qui a disparu, c'est ce qui était dit deux ou trois
fois, ou ce qui n'était pas vrai (§4).

---

## 3. Ce que le joueur voit sans faire défiler

Mesuré sur un iPhone 375 × 812. Après retrait de la barre d'onglets (49 pt) et de la marge
basse (34 px), il reste **729 px** utilisables pour l'écran.

| État | Contenu vNext | Reste |
|---|---:|---|
| Nouveau joueur | 399 px | **+330 px de fond nu** |
| Reprise après interruption | 536 px | +193 px |
| Tendance indisponible | 603 px | +126 px |
| Séance terminée | 669 px | +60 px |
| Tendance disponible | 667 px | +62 px |
| Erreur de génération | 667 px | +62 px |
| Jour sans séance prévue | 697 px | +32 px |
| Séance à reprendre | 815 px | 86 px à faire défiler |
| Aucune directive club / non appliquée / sans club | 817 px | 88 px à faire défiler |
| Séance prévue / Jour de récupération | 833 px | 104 px à faire défiler |
| *Textes longs* | 873 px | 144 px à faire défiler |
| Hors-ligne | 889 px | 160 px à faire défiler |

**À dire honnêtement : 29 couples situation × largeur sur 60 demandent encore de faire
défiler**, surtout à 320 px (vieil iPhone SE) et sur les états les plus chargés à 375 px.
Ce n'est pas du contenu masqué — rien ne passe sous la barre d'onglets, c'est vérifié et
mesuré — mais la règle « l'écran finit tôt » n'est pleinement tenue que sur la moitié des cas.

À titre de comparaison, l'écran actuel demande de faire défiler **dans les 60 cas sur 60**,
avec 379 px sous la ligne de flottaison sur l'état le plus courant, et l'audit relève
**41 à 44 % du contenu sous la ligne** sur les 12 états qu'il a rendus (`AUDIT_HOME.md §7.3`).

---

## 4. Ce qui a disparu, et pourquoi

### 4.1 Les répétitions supprimées

L'audit compte, sur l'écran actuel (`AUDIT_HOME.md §3.2`) :

| Information | Fois écrite aujourd'hui | Dans la proposition |
|---|---:|---:|
| L'état du jour (« Un peu chargé ») | **3** — pastille du header + titre de la carte `TON ÉTAT` + titre du conseil, souvent mot pour mot | **1** — la pastille du header, et seulement si l'app a de quoi le dire |
| La série (« N jours d'affilée ») | **2** — ligne de stats + carte Progression, même variable à 30 lignes d'écart | **0** — interdit dans le prototype |
| L'action / la prochaine séance | **2 à 3** — le CTA + la carte du bas + l'alerte de l'onglet Séance | **1** — vérifié automatiquement sur les 150 pages |

Sur l'état « récupération », l'audit relève le pire cas : **le même message écrit 4 fois**
et **3 boutons vers la même destination, dans 3 couleurs différentes**.

**Le cas le plus net est le CTA dupliqué.** L'audit a comparé ligne à ligne le bouton du
haut (`HomePrimaryCTA`) et le bouton primaire de la carte du bas (`HomeNextSessionCard`) :
même libellé, même destination, même état désactivé. C'est **littéralement le même bouton
rendu deux fois, à 900 px d'écart**.

Dans la proposition, c'est vérifié par une mesure automatique, pas par mon œil : un
marqueur invisible est posé sur l'emplacement d'action, et le vérificateur compte les
marqueurs sur chacune des **150 pages générées**. Résultat : **exactement 1 par page**.
Deuxième contrôle, indépendant du marqueur : le vérificateur compte dans le rendu les
surfaces colorées d'au moins 120 × 40 px — **au plus un aplat par écran**, contre
**jusqu'à 2 sur l'écran actuel**.

### 4.2 Les blocs supprimés

| Bloc retiré | Pourquoi |
|---|---|
| **Carte « Prochaine séance »** (162 px) | C'est le CTA du haut, rendu une deuxième fois. Rien de neuf. |
| **Ligne « Série »** et **flamme de la carte Progression** | Doublon entre elles ; et surtout la valeur peut être composée **à 100 % de charges club auto-injectées** que le joueur n'a jamais confirmées (`AUDIT_HOME.md §3.1`). Compter comme « fait » une séance supposée est un mensonge. |
| **Carte « Progression »** (134 px) | Un teaser sans information, qui répétait la série. Remplacé par un simple lien texte en fin d'écran. |
| **Carte « Conseil du jour »** (131 à 291 px) quand elle paraphrase | Sur les 13 règles, les deux règles de repli les plus fréquentes répétaient l'état du jour écrit 20 px plus haut. Dans la proposition, le conseil **disparaît entièrement** si plus de la moitié de ses mots ont déjà été dits ailleurs sur l'écran. Résultat mesuré : le conseil est présent sur 8 situations sur 15, absent sur 7. |
| **La carte `TON ÉTAT` de 223 px** | Le bloc le plus gros et le plus blanc de l'écran, **sans aucune action**, dont l'audit mesure que la courbe occupe 232 px pour une amplitude réelle de **0,7 px sur 90** dans l'état « reprise ». Remplacé par une carte « Ma forme » plus courte, qui dit sur quoi elle est calculée. |
| **Les repères « 0 » et « −10 » de la courbe** | Contraste mesuré à **2,15 : 1** — le pire ratio de tout l'écran actuel — pour deux chiffres sans unité ni légende, qui décrédibilisent le reste. La proposition trace la forme **sans aucun chiffre**, ce qui est vérifié automatiquement. |
| **Le disque décoratif gris de la carte du bas** | Mesuré : un `<div>` vide de 160 × 160 px qui **dépasse le cadre de l'écran de 43 px sur la droite, à toutes les largeurs, y compris 768**. C'est le seul débordement de l'écran actuel, et il est présent sur les 60 pages mesurées. Côté proposition : **0 débordement**. |

### 4.3 Ce qui a été retiré alors que ça n'est pas un défaut

**Le calendrier de la semaine et la ligne de statistiques à trois colonnes.**
Ce n'était pas faux, mais ça n'aidait pas à décider quoi faire aujourd'hui. La proposition
garde un seul repère de régularité, « Ma semaine : 1 séance sur 2 », recoupé
automatiquement avec le nombre de séances FKS **réellement terminées** — le vérificateur
le contrôle sur les 15 situations.

---

## 5. Ce qui est apparu, et pourquoi

| Ajout | Pourquoi | Où le voir |
|---|---|---|
| **La ligne « Pourquoi : … »** | C'est **la** question à laquelle l'app ne répondait pas (`AUDIT_HOME.md §1.2`, question 4). Les champs existaient déjà dans la séance envoyée par le backend (`sessionTheme`, `playerContext`, `analytics.rationale`) mais n'étaient lus que par l'écran de préparation. La ligne ne s'affiche **que** si l'un de ces champs est là. Elle n'est jamais inventée : si tout est vide, il n'y a pas de ligne. | Situations 2, 3, 5, 6, 11, 12, 13, 14 |
| **L'état « reprise »** | Après 24 jours, l'écran arrête de dire « Frais — bien reposé », met le cycle **en pause** (sans nom de phase, puisqu'aucune montée en puissance n'a eu lieu) et propose « Reprendre mon programme ». | Situation 7 |
| **« Ta tendance se construit »** | Quand il y a moins de 4 séances terminées, aucune courbe n'est tracée et aucun état n'est affirmé. L'écran dit ce qu'il faut faire pour que ça devienne utile. | Situations 1, 7, 8 |
| **La portée de la mesure, écrite** | « Calculé sur tes séances FKS uniquement — tes entraînements club n'y sont pas comptés. » Une métrique qui ne voit qu'une partie de la vie du joueur doit le dire. | Toutes les situations à courbe |
| **L'accusé de réception le jour où la séance est faite** | Aujourd'hui, l'écran devient un rectangle gris désactivé le jour où le joueur a fait ce qu'on lui demandait (`AUDIT_HOME.md §5`). La proposition remplace l'aplat par un bloc « Séance faite · 45 min · effort 7/10 » qui reprend **ce que le joueur a lui-même déclaré**. | Situation 4 |
| **Un état « erreur » et un état « hors-ligne »** | L'écran actuel n'a **aucune branche de chargement ni d'erreur** : il affiche l'écran complet avec les valeurs d'usine. La proposition dit « Tu es hors connexion, ce que tu vois peut dater ». | Situations 10 et 11 |

---

## 6. Ce que la comparaison ne prouve pas

- **Aucune mesure n'a été faite sur un téléphone.** Tout vient de Chrome, avec la police
  du système et non San Francisco : les points de retour à la ligne peuvent bouger de
  quelques pourcents. Les hauteurs sont justes à quelques pixels, pas au pixel.
- **La hauteur de la barre d'onglets (49 pt + marge basse) est la valeur publiée par
  Apple, pas une mesure sur ton téléphone.** C'est le premier point à confirmer en recette.
- **Les deux colonnes n'affichent pas toujours exactement le même scénario.** Le Home
  actuel n'a pas les mêmes entrées que la proposition (pas de champ « erreur de
  génération », pas de champ « hors-ligne »). Quand c'est le cas, le visualiseur affiche
  un bandeau d'écart au-dessus de la comparaison, et l'entrée est marquée
  `approx.` ou `sans équivalent` dans la liste de gauche. **Trois situations sur quinze
  n'ont aucun équivalent** côté production : séance à reprendre, erreur de génération,
  directive club non appliquée.
- **Le Home actuel bouge en permanence, même en mode « réduire les animations ».**
  Son bouton principal lance une pulsation infinie sans consulter le réglage
  d'accessibilité. Conséquence pratique : ses captures ne sont pas reproductibles à
  l'identique d'un rendu à l'autre. C'est un défaut réel du produit, relevé au passage,
  **non corrigé** — `components/home/` est hors du périmètre de ce prototype.

---

## 7. Les vérifications passées

Toutes ces mesures ont été produites par le même vérificateur, qui rend un verdict chiffré
et refuse de conclure quand il n'a pas pu tourner. Lance-le avec
`node prototype/home-vnext/verifier.js`.

| # | Vérification | Verdict | Comment |
|---|---|---|---|
| a | TypeScript du prototype | **PASS** | 0 erreur réelle |
| b | Tests ciblés | **PASS** | 238 tests, 2 suites |
| c | Rendu sans plantage | **PASS** | 300 pages générées, 300 présentes, aucune page d'erreur |
| c bis | Mesure dans un vrai navigateur | **PASS** | 300 pages chargées et mesurées |
| d | Texte agrandi ×1,3 | **PASS** | 0 chevauchement, 0 débordement sur 15 pages — mais **13 textes coupés par le bornage**, dont un qui pose problème : voir ci-dessous |
| e | Une seule action principale | **PASS** | 150 pages, exactement 1 marqueur par page |
| e bis | Un seul aplat coloré | **PASS** | mesuré sur les couleurs rendues, indépendamment du marqueur |
| f | Aucun faux état de forme | **PASS** | aucune courbe sur donnée insuffisante, aucun ATL/CTL/TSB, aucun chiffre dans le tracé |
| g | Aucune « série » | **PASS** | rendu **et** code source : aucune occurrence |
| h | Aucune charge club supposée | **PASS** | compteur de semaine recoupé avec les séances réellement terminées |
| i | Rien sous la barre d'onglets | **PASS** | vide réel mesuré en bas d'écran |
| j | Zones tactiles ≥ 44 pt | **PASS** | 350 éléments mesurés, aucun sous le plancher |
| k | Contraste WCAG | **PASS** | 2410 textes mesurés, pire ratio **5,02 : 1** |
| l | Textes longs | **PASS** | 0 débordement aux 4 largeurs + ×1,3 |
| m | Idempotence | **PASS** | deux builds, 329 fichiers, mêmes empreintes |

### Un défaut trouvé en regardant les images, que le vérificateur avait manqué

Le compteur de textes coupés ne testait que `overflow: hidden`. Or react-native-web rend
le bornage avec `-webkit-line-clamp`, et le navigateur calcule alors `overflow: clip`.
**Le compteur annonçait 1 texte coupé en texte ×1,3 ; il y en avait 13.**

Trouvé en comparant une capture à l'œil avec le verdict : l'image montrait des points de
suspension que le compteur disait absents. Le vérificateur a été corrigé
(`prototype/home-vnext/lib/mesureTemplate.js`), les chiffres ci-dessus sont les corrigés.

**Ce que ça cache de gênant** : sur 8 situations, le texte coupé est
*« Calculé sur tes séances FKS uniquement — tes entraînements club n'y sont pas comptés »*,
c'est-à-dire **la phrase qui porte l'honnêteté de la mesure**. Un joueur qui grossit la
police garde la courbe et perd la mise en garde. Détail et correction proposée dans
[`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md) §6, question n° 5.

---

# 8. Variante 1 contre variante 2 — le lien flottant contre la carte

> Cette section ne compare plus l'actuel à la proposition. Elle compare **deux versions
> de la proposition entre elles** : la variante 1 que tu as validée (un lien texte
> « Voir ma progression » sous les cartes) et la variante 2 (une carte « Ma progression »
> intégrée, dont le lien devient le pied — mêmes mots, « Voir ma progression », puisque
> c'est le même écran au bout).
>
> Fichier de mesures brut : [`mesures-hauteurs-variante2.md`](mesures-hauteurs-variante2.md).
> **30 comparaisons**, produites par le même moteur de rendu que le reste du document.

## 8.1 Le résumé en quatre lignes

| Ce qu'on mesure | Variante 1 | Variante 2 |
|---|---:|---:|
| Hauteur de page, moyenne sur 30 mesures | référence | **+89,2 px (+14,7 %)** |
| Écrans qui tiennent sans défiler (sur 30) | **20** | **15** |
| Éléments tactiles dans le bloc progression | 1 (le lien, large comme son texte) | **1** (le pied, large comme la carte) |
| Aplats colorés sur l'écran | 1 (l'action du jour) | **1** (l'action du jour) |

La variante 2 **ne rajoute aucun bouton** et **n'ajoute aucun aplat**. Elle coûte de la
hauteur, et elle seule.

> **Ce chiffre a bougé de 1,1 px depuis la version précédente, et voici pourquoi.**
> Il valait **+90,3 px**. Une seule chose a changé : sur l'état « Tendance disponible », la
> carte affichait une phrase d'absence de trois lignes (« Tes tests terrain apparaîtront
> ici dès que… ») ; elle affiche maintenant une **comparaison réellement mesurée** de deux
> lignes (saut en longueur 205 → 214 cm). Deux lignes au lieu de trois : **−1,1 px de
> moyenne**, et un écran de plus qui tient sans défiler (14 → 15). **Rien dans la carte
> elle-même n'a été rétréci** — ni une marge, ni une police, ni un bloc retiré. Le surcoût
> de la variante 2 reste entier : c'est ton arbitrage, pas le mien.

## 8.2 Ce que la carte apporte

Ce n'est pas un habillage du lien : c'est du **contenu qui n'existait nulle part** sur
l'écran. Détail par état :

| État | Ce que la variante 1 affichait, mot pour mot | Ce que la variante 2 affiche en plus |
|---|---|---|
| `empty` (nouveau joueur) | « Ta tendance se construit » + une phrase d'encouragement. **Aucun chiffre.** | **Trois repères numérotés** — ce qu'il faut faire, dans l'ordre, pour que la progression démarre |
| `collecting` (2 séances) | « Ta tendance se construit » + une phrase + **un seul chiffre** : « 2 séances enregistrées » | **Quatre faits mesurés** au lieu d'un : 2 séances, **76 min**, **2 ressentis**, et **combien il en manque** avant une tendance (« Encore 2 séances ») |
| `ready` (courbe) | la courbe + sa portée, puis un lien flottant. **Aucun chiffre sous la courbe.** | **Un fait de cumul** (7 séances terminées) + **la comparaison de tests terrain**, et le lien devient le pied de la carte |

Sur l'état `collecting`, la différence n'est donc pas « rien contre quelque chose » mais
**un chiffre contre quatre** — dont deux (les minutes et les ressentis) n'existaient nulle
part sur l'écran, et un quatrième qui dit **ce qui manque** au lieu de le laisser deviner.

Le gain le plus concret est dans l'état `ready` : la **comparaison de tests terrain**
(saut en longueur, sprint 10 m, test 505) n'apparaissait **nulle part** sur le Home en
variante 1. Il fallait aller sur la page Progression pour la voir — c'est-à-dire traverser
un écran dont le haut est faux.

Et un détail qui compte : la carte affiche **le cumul** (7 séances au total) là où
« Ma semaine » juste au-dessus affiche **la semaine** (2 séances sur 3). Deux nombres
différents, deux sens différents, aucun doublon. Quand les deux nombres risqueraient
d'être identiques, la carte **change de fait affiché** plutôt que de répéter.

## 8.3 Ce que la carte coûte, sans arrondir

**+89,2 px en moyenne, soit +14,7 %.** Mais la moyenne cache l'essentiel : ce qui compte
est de savoir **quels écrans basculent sous la ligne de flottaison**.

Sur les 30 comparaisons, **5 écrans passent de « tient » à « ne tient pas »**.
Aucun ne bascule dans l'autre sens. Voici les cinq, avec le dépassement réel :

| Cas | Largeur | Texte | Marge restante en v1 | Dépassement en v2 |
|---|---:|---:|---:|---:|
| Test physique amélioré | 390 px | ×1 | 89 px | **2 px** |
| Donnée manquante | 375 px | ×1,3 | 6 px | **24 px** |
| Tendance disponible | 375 px | ×1 | 62 px | **29 px** |
| Test physique amélioré | 375 px | ×1 | 60 px | **31 px** |
| Deux séances, tendance indisponible | 375 px | ×1,3 | 6 px | **110 px** |

> **Un sixième cas est sur la ligne, exactement.** « Tendance disponible » à 390 px fait
> **761 px** pour **761 px** disponibles : il tient, au pixel près. Ne compte pas dessus —
> c'est le genre de marge qu'une police système un peu différente efface.

**Quatre de ces cinq dépassements sont inférieurs ou égaux à 31 px** — quelques
millimètres, récupérables sur les marges internes de la carte. **Le cinquième dépasse de
110 px**, et
il n'est pas du même ordre : c'est le cas « deux séances » en police agrandie ×1,3, où la
carte est à son plus lourd (quatre lignes de fait) sur un écran déjà à 6 px de la limite
en variante 1.

> **Correction d'un chiffre annoncé plus tôt.** Une première lecture de ces mesures
> résumait ces six bascules par « de 2 à 31 px seulement ». **C'est faux** : la fourchette
> réelle va de **2 à 110 px**. Les six lignes ci-dessus sont recalculées depuis le fichier
> de mesures brut, avec la hauteur disponible de chaque appareil
> (`hauteur d'écran − 49 pt de barre d'onglets − inset bas` : 729 px à 375, 761 px à 390).
> Le cas ×1,3 avait été confondu avec les autres.

## 8.4 L'encombrement propre de la carte

Combien pèse la carte elle-même, indépendamment du reste de l'écran :

| Cas | À 375 px | À 320 px | Ce qu'elle contient |
|---|---:|---:|---|
| Nouveau joueur (`empty`) | 158 px | 158 px | entête + 3 repères + mention — **aucun élément tactile** |
| Deux séances (`collecting`) | 194 px | 194 px | entête + 4 lignes de fait — **aucun élément tactile** |
| Donnée manquante (`collecting`) | **102 px** | 116 px | entête + 2 lignes de fait — 2 faits ont **disparu** faute de données |
| Tendance disponible (`ready`) | 243 px | 243 px | courbe + portée + 1 fait + comparaison de test + pied |
| Test physique amélioré (`ready`) | 243 px | 243 px | courbe + portée + 1 fait + comparaison de test + pied |
| Aucune comparaison de test (`ready`) | 263 px | 263 px | courbe + portée + 1 fait + explication + pied |

La carte la plus lourde fait **263 px**, la plus légère **102 px**.

**Pourquoi l'écart de page (+89 px) est-il plus petit que la carte elle-même ?** Parce que
la variante 2 **supprime en même temps** le bloc « Ma forme » et le lien flottant : on ne
paie que la différence. La carte ne s'ajoute pas à l'écran, elle **remplace** deux éléments.

Et remarque la ligne « Donnée manquante » : **102 px**, la carte la plus légère de toutes.
Quand l'app ne sait rien, la carte rétrécit au lieu de remplir avec des zéros. C'est la
règle d'honnêteté qui produit ce chiffre, pas une optimisation de mise en page.

## 8.5 Ce que cette comparaison ne tranche pas

- **La hauteur se mesure, le confort se ressent.** 31 px de dépassement veut dire qu'il
  faut un petit coup de pouce pour voir le bas de la carte. Est-ce grave ? Ça ne se
  mesure pas dans un navigateur : **c'est à toi, sur ton téléphone**.
- **Le pied « Voir ma progression » mène à un écran encore faux.** Le haut de la page
  Progression affiche une courbe de 30 jours et un libellé d'état produits par des
  constantes d'usine. La carte porte cette réserve dans son propre code, mais elle ne
  la répare pas. Détail dans [`VIEWMODEL_PROGRESSION.md`](VIEWMODEL_PROGRESSION.md).
- **Rien n'est branché.** Les six cas sont des fixtures écrites à la main. Aucun chiffre
  ne vient d'un vrai compte.

---

## Annexe — le nommage des captures

### Variante 2 — dossier [`captures-v2/`](captures-v2/)

| Motif | Contenu |
|---|---|
| `comparaison-v1-vs-v2-<cas>-375.png` | Les **3 côte à côte** variante 1 / variante 2 |
| `v2-01` … `v2-05-<cas>-375-page-entiere.png` | Les 5 cas de la carte, 375 px, rien n'est coupé |
| `v2-preuve-r1-donnee-manquante-375-page-entiere.png` | La preuve qu'une donnée inconnue disparaît |
| `largeur-320px-iphone-se-<cas>-v2.png` | Les 2 cas les plus serrés sur le petit iPhone |
| `texte-agrandi-x1-3-tendance-disponible-v2-375.png` | Texte grossi de 30 % |
| `outil-visualiseur-selecteur-variante2.png` | Le nouveau sélecteur de variante dans l'outil |
| `_rapport-captures.json` | Le compte-rendu machine : 13 réussies, 0 échouée |

### Variante 1 — dossier [`captures/`](captures/)

| Motif | Contenu |
|---|---|
| `etat-01` … `etat-14-<situation>-vnext-375-page-entiere.png` | Les 14 situations proposées, 375 px, rien n'est coupé |
| `comparaison-<situation>-actuel-vs-vnext-375.png` | Les 4 côte à côte |
| `largeur-seance-prevue-vnext-<320\|390\|768>px-….png` | La même situation aux autres largeurs |
| `texte-agrandi-x1-3-….png` | Texte grossi de 30 % |
| `outil-visualiseur-vue-cote-a-cote.png` | À quoi ressemble l'outil |
| `vnext-….png` / `actuel-….png` | **Autre lot**, produit plus tôt : vue « zone visible » (ce que le joueur voit sans défiler). Utile pour l'honnêteté, moins pour comparer les hauteurs. |
