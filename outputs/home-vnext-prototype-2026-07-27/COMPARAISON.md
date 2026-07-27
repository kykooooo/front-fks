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

## Annexe — le nommage des captures

| Motif | Contenu |
|---|---|
| `etat-01` … `etat-14-<situation>-vnext-375-page-entiere.png` | Les 14 situations proposées, 375 px, rien n'est coupé |
| `comparaison-<situation>-actuel-vs-vnext-375.png` | Les 4 côte à côte |
| `largeur-seance-prevue-vnext-<320\|390\|768>px-….png` | La même situation aux autres largeurs |
| `texte-agrandi-x1-3-….png` | Texte grossi de 30 % |
| `outil-visualiseur-vue-cote-a-cote.png` | À quoi ressemble l'outil |
| `vnext-….png` / `actuel-….png` | **Autre lot**, produit plus tôt : vue « zone visible » (ce que le joueur voit sans défiler). Utile pour l'honnêteté, moins pour comparer les hauteurs. |
