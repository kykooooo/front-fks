# Décisions visuelles — chaque choix, et sa raison

> Ce document explique **pourquoi** l'écran proposé a cette tête. Rien n'a été décidé
> « parce que c'est plus joli » : chaque choix répond à un défaut mesuré de l'audit,
> ou reprend une règle déjà écrite du projet.
>
> Un seul choix reste **une proposition à trancher** : la teinte du bouton d'action (§4).

---

## 1. L'échelle typographique — 6 paliers au lieu de 21

### Le problème mesuré

Le Home actuel pose **21 couples taille/graisse différents**, dont un `12.5` (une valeur
non entière unique dans tout le dépôt) et **14 styles de texte sous 13 px, dont 4 à 10 px**
(`AUDIT_HOME.md §3.4` et §7.4). C'est ça qui fait « pas la même app » : rien ne se répète,
donc rien ne fait système.

### Pourquoi PAS `theme.typography`

Le thème du projet contient bien un bloc `theme.typography`. La consigne était de vérifier
moi-même son usage réel. **Vérifié par recherche sur tout le dépôt, sur `theme.typography`
et sur `typography.` : zéro fichier l'utilise.** Les seules occurrences trouvées sont deux
lignes de commentaire dans le fichier de tokens du prototype, qui expliquent précisément ça.

Donc : l'imposer n'aurait pas aligné le prototype sur le reste de l'app — ça aurait
créé un **cinquième** langage graphique, en plus des quatre déjà en présence. Analogie
foot : ce serait sortir un maillot que personne dans l'équipe ne porte, en disant qu'on
joue enfin en équipe.

### Ce qui a été fait à la place

Une petite échelle locale au prototype, **calée sur les écrans les plus aboutis du dépôt**.
Chaque palier indique d'où il vient, et rien n'est inventé.

| Palier | Métrique | D'où il vient |
|---|---|---|
| `screenTitle` | 22 / 800 / interligne 28 | `HomeScreen.tsx` > `greeting`, conservé tel quel |
| `actionLabel` | 17 / 800 / interligne 22 | `components/ui/Button.tsx` > `labelLg` (taille `lg`) |
| `metricValue` | 16 / 700 / interligne 20 | `sessionPreview/HeroCard` **et** `RoutineScreen` — les deux écrans les plus aboutis utilisent déjà exactement ça |
| `body` | 13 / 600 / interligne 18 | `HeroCard.subtitle` (13) et `prebuilt/CategoryTile` (13/700), poids ramené à 600 |
| `caption` | 12 / 500 / interligne 16 | `HeroCard.progressLabel` et `RoutineScreen.heroSubtitle` |
| `overline` | 13 / 800 / esp. 1,2 / capitales | `components/ui/SectionHeader.tsx`, copié à l'identique |

**Aucun texte sous 12 px.** L'écran actuel en a 14, dont 4 à 10 px.

---

## 2. Les rayons — 2 valeurs au lieu de 7

Le Home actuel utilise sept rayons en valeurs écrites à la main : **26, 22, 20, 16, 14, 12,
999**. Deux d'entre eux — **22** (le bouton principal) et **26** (la carte hero) —
**n'existent dans aucune échelle du projet**. Et `theme.radius` n'est utilisé nulle part
sur cet écran.

Le prototype n'en garde que deux, **toutes deux prises dans `theme.radius`** :

- `carte` = `theme.radius.lg` = **16** — toutes les surfaces : le bloc d'action, les cartes ;
- `pilule` = `theme.radius.pill` = **999** — les pastilles.

Les rayons 20 / 22 / 24 / 26 sont **bannis** du prototype.

---

## 3. L'espacement — un seul rythme

Le Home actuel mélange trois rythmes verticaux (14 / 16 / 10) et pose un `paddingTop: 8`
hors grille alors que tous les autres écrans sont à 16.

Le prototype prend tout dans `theme.spacing` :

| Usage | Valeur |
|---|---|
| Marge latérale d'écran | 16 |
| Entre deux sections | 16 |
| Intérieur d'une carte | 16 |
| Entre deux lignes d'une carte | 12 |
| Collage serré | 8 |
| Respiration finale | 24 |

**Deux rails de texte, pas sept.** L'audit mesure sept points de départ différents en
descendant l'écran actuel (16 / 27 / 31 / 33 / 37 / 58 / 98 px) : les titres ne s'alignent
pas d'une carte à l'autre. Le prototype n'en a que deux, dérivés du même 16 :
**16 px du bord** pour tout ce qui est directement sur l'écran, **32 px du bord** pour tout
ce qui est à l'intérieur d'une carte. C'est ce qui fait que l'œil descend en ligne droite.

---

## 4. La teinte d'action — LA proposition à trancher

### Le problème, chiffré

Le bouton n° 1 de l'application est du blanc sur `theme.colors.cta` = `#F2741B`.
Contraste mesuré : **2,88 : 1**. Son sous-titre, en blanc semi-transparent, tombe à
**2,60 : 1**. Le seuil d'accessibilité pour du texte est **4,5 : 1**.

Pire, l'audit relève que le bouton « Journée récup » est à **2,65 : 1** : l'écran est le
moins lisible le jour où le joueur est le plus fatigué.

### La proposition : `#B4530C`

C'est **le même orange, simplement assombri**.

| | Orange actuel | Proposition |
|---|---|---|
| Code | `#F2741B` | `#B4530C` |
| Teinte | 24,8° | **25,4°** |
| Contraste avec du blanc plein | **2,88 : 1** ❌ | **5,02 : 1** ✅ |

Le calcul suit la formule WCAG 2.1 (luminance relative après linéarisation sRGB) :
`L(#B4530C) = 0,1592`, donc `ratio = 1,05 / (0,1592 + 0,05) = 5,02`.

Bonus : ce même ton passe aussi **en texte sur fond blanc** (5,02 : 1) et sur le fond
d'écran `#F5F7FA` (4,68 : 1). Il peut donc servir d'accent sans créer une seconde teinte.

**Candidats mesurés et écartés** : `#E2670F` 3,40 · `#D65F0B` 3,82 · `#C85A0C` 4,27
(tous encore sous le seuil) ; `#9A3412` 7,31 — conforme, mais il vire au brun et
l'identité FKS se perd.

### La règle qui va avec

Sur `#B4530C`, du blanc à 90 % d'opacité ne donne encore que **4,39 : 1** — toujours sous
le seuil. Donc : **tout le texte posé sur l'aplat est du blanc plein, sans exception.**
La hiérarchie entre le libellé et son sous-titre se fait par **la taille et la graisse**,
jamais par la transparence. C'est la règle qui remplace le blanc à 82 % du Home actuel.

### Ce qui reste à faire

**Ce choix n'est pas validé.** `constants/theme.ts` n'a pas été modifié : la valeur vit
dans le prototype et attend ton avis. Regarde-la sur les captures et sur le visualiseur,
et dis oui ou non.

---

## 5. La hiérarchie — un seul aplat sur tout l'écran

### Le problème mesuré

L'audit (`§3.3`) montre que la hiérarchie actuelle est **inversée** :

- La carte `TON ÉTAT` — **passive, aucun bouton dedans** — est en blanc pur, avec le
  plus grand rayon (26) et la plus grande hauteur (223 px). C'est elle qui attire l'œil.
- Les deux seules cartes **actionnables** du bas sont en `#F1F4F8` sur un fond `#F5F7FA` :
  **4 / 3 / 2 d'écart par canal**. Elles se fondent dans l'arrière-plan.
- À l'intérieur de la carte du bas, le bouton **primaire** est un contour transparent et
  le **secondaire** est plein blanc : le secondaire pèse plus lourd que le primaire.
- Et sur certains états, le bouton du conseil est un aplat pleine largeur saturé, en
  concurrence directe avec le bouton principal.

### La règle appliquée

**Un seul aplat coloré sur tout l'écran : l'action du jour. Le reste est carte ou texte.**

Les actions secondaires sont des **liens texte** (« Voir le détail », « Voir ma
progression »), jamais des surfaces pleines. Elles restent tapables à 44 pt de haut, mais
elles ne peuvent plus rivaliser visuellement avec l'action principale.

Cette règle est **vérifiée automatiquement, deux fois** :

1. un marqueur invisible est posé sur l'emplacement d'action, et compté sur les 150 pages
   générées → exactement 1 par page ;
2. indépendamment du marqueur, le vérificateur compte dans le rendu les surfaces opaques
   et sombres d'au moins 120 × 40 px → au plus 1 par écran, contre **jusqu'à 2** sur
   l'écran actuel.

**Le cas particulier : le jour où la séance est faite.** L'aplat n'a plus lieu d'être
(il n'y a plus rien à lancer), mais l'écran ne doit pas s'éteindre non plus. Le bloc
devient un **accusé de réception** — même emplacement, même marqueur compté, mais sans
aplat coloré : « Séance faite · 45 min · effort 7/10 ». Le chiffre affiché est celui que
le joueur a lui-même déclaré, pas un score calculé par l'app.

---

## 6. Le bas de l'écran

### Le problème

L'audit a tranché un désaccord entre ses propres méthodes (`§7.3`) : il n'y a **pas** de
contenu masqué par la barre d'onglets, mais **70 px de vide** sous la dernière carte
(24 de padding + 12 d'espaceur + 34 de marge basse), et **34 px de fenêtre de défilement
perdus en permanence**.

Et surtout : les deux seules cartes actionnables du bas sont **sous la ligne de flottaison**,
au bout d'un défilement de 1100 à 1500 px.

### Ce qui a été fait

- **Pas de grande carte finale.** L'écran se termine par un simple lien texte
  (« Voir ma progression »), pas par un bloc de 134 px qui répète ce qui est déjà dit.
- **Pas de deuxième action principale**, pas de répétition du cycle, pas de métrique de
  remplissage.
- **Chaque bloc disparaît entièrement quand il n'a rien à dire.** Aucun emplacement
  réservé, aucune carte vide, aucun « — » à la place d'une valeur. Un joueur sans club,
  sans tendance et sans conseil obtient un écran **court et complet**, pas un écran à trous.
- **24 px de respiration finale**, ajoutés par-dessus la marge basse déjà appliquée par
  `<Screen>`.

**Ce qui n'est pas résolu** : sur les états les plus chargés à 375 px, il reste 86 à 160 px
à faire défiler, et jusqu'à 330 px à 320 px (vieil iPhone SE). Le détail par état est dans
[`COMPARAISON.md`](COMPARAISON.md) §3. Rien n'est masqué, mais la règle « l'écran finit
tôt » n'est pleinement tenue que sur la moitié des cas.

**Et à l'autre extrême** : le nouveau joueur laisse **330 px de fond nu**. Ce vide est
assumé et non comblé — voir [`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md), question n° 1.

---

## 7. Ce qui vient du socle existant

Rien n'a été réinventé quand une brique existait. Sont **importés tels quels**, sans copie
ni variante :

| Brique | Ce qu'elle apporte |
|---|---|
| `components/ui/Screen.tsx` | **La règle d'or du projet.** Seule source de vérité de la safe area. Aucune `SafeAreaView` locale, aucun `paddingTop` magique, aucune `StatusBar` locale. Le Home actuel est le seul écran resté hors de ce socle. |
| `components/ui/Button.tsx` | Impose déjà les bonnes hauteurs (48 / 52 / 56 px) et l'animation de pression. L'audit relève qu'il n'est importé par **aucun** fichier du Home actuel, qui utilise 10 `TouchableOpacity` maison — d'où les 8 zones tactiles sur 8 sous 44 pt. |
| `components/ui/SectionHeader.tsx` | Les titres « MA SEMAINE » / « MA FORME », à l'identique. |
| `theme.colors`, `theme.radius`, `theme.spacing` | La palette et les échelles du projet, réutilisées telles quelles. |
| `domain/microcycles.ts`, `utils/microcycleUtils.ts` | Le nom du cycle et sa phase, calculés par le vrai code métier. |
| `utils/dateHelpers.ts` | Les dates, jamais recalculées à la main. |

**Aucun de ces fichiers n'a été modifié.** Ils sont importés, pas copiés, pas altérés.

---

## 8. Ce qui a été volontairement NON copié de l'espace Coach

L'espace Coach paraît plus abouti, et pour une raison identifiée par l'audit : il s'est
doté d'un jeu de tokens nommés (`coachColors`, `coachRadius`) et les applique
uniformément. **C'est cette méthode qui a été reprise. Pas les valeurs.**

Ce qui a été laissé de côté, et pourquoi :

| Non copié | Pourquoi |
|---|---|
| **La palette `coachColors`** (fond `#F6F5F2`, bordures chaudes) | C'est une identité visuelle **distincte**, pensée comme « outil staff ». La reprendre côté joueur créerait une cinquième palette au lieu d'en supprimer. Le prototype reste sur `theme.colors`. |
| **Les rayons `coachRadius`** (carte 10, chip 8) | Un rayon de 10 est plus sec, plus « logiciel de bureau ». L'app joueur est à 16. Cohérence d'abord. |
| **Le système de badges à 5 tons** (`ok` / `warn` / `danger` / `info` / `default`) | Un système de couleurs d'alerte suppose qu'on sait qualifier une situation. Le prototype affirme le moins possible : il n'a **qu'une** pastille d'état, et elle ne s'affiche que quand le ViewModel l'autorise. Ajouter du rouge et du vert reviendrait à réintroduire par la couleur les affirmations qu'on vient de retirer du texte. |
| **Les états vides conçus du Coach** (4 dans cet espace, 0 sur le Home) | La méthode est reprise — le prototype a des états honnêtes quand la donnée manque — mais pas les mises en page, qui sont dessinées pour des listes de joueurs. |

À noter au passage : le commentaire d'en-tête de `components/coach/coachUi.tsx` justifie sa
palette locale par « le thème global (dark) qui sert les écrans joueur ». **Ce commentaire
est périmé** — le thème joueur est clair depuis la refonte, et les deux palettes partagent
déjà exactement le même accent `#2A4D8F`. Il y a là une convergence à instruire, hors du
périmètre de ce prototype.

---

## 9. Les règles de rendu tenues

Sept règles, reprises de la règle d'or du projet et de l'audit, et appliquées sans exception :

1. Écran monté dans `<Screen>` : aucune `SafeAreaView` locale, aucun `paddingTop` magique,
   aucune `StatusBar` locale.
2. Sur un bloc de texte : `minHeight`, **jamais** `height`.
3. Tout contenu venant du backend est borné par `numberOfLines`. *(Le Home actuel ne le
   fait qu'à 3 endroits — d'où le CTA qui prend 3 lignes avec un titre de séance long, et
   la même chaîne de 3 lignes affichée deux fois sur le même écran.)*
4. Largeurs en flex, jamais en pixels fixes. *(Le Home actuel a une pilule à `width: 140`
   qui écrase son voisin et déborde à 320 px.)*
5. Un seul aplat coloré sur tout l'écran.
6. Aucun élément interactif sous 44 pt.
7. **Aucun repère numérique brut sur la courbe.** Les « 0 » et « −10 » actuels sont à
   2,15 : 1 — le pire contraste de l'écran — pour deux chiffres sans unité ni légende.

Ces sept règles sont écrites dans `components/homeVNext/homeVNextTokens.ts` et vérifiées
automatiquement.

---

## 10. Ce que je n'ai pas décidé, et qui reste à toi

| Question | Où la regarder |
|---|---|
| **La teinte d'action `#B4530C`** | §4. Le seul choix d'identité du document. |
| **Le seuil de 4 séances avant d'afficher une tendance** | Le wireframe de l'audit en proposait 3. J'ai retenu 4 = la première phase d'un cycle FKS. Une ligne à changer. |
| **Le seuil de 14 jours avant de basculer en « reprise »** | Deux semaines pleines. En dessous, un trou est la vie normale d'un amateur. |
| **Le vide chez le nouveau joueur** | 330 px de fond nu. Le combler demande d'écrire du texte produit — c'est ta décision, pas une correction technique. |

Ces questions, et huit autres, sont posées une par une dans le panneau
**« Points à valider »** du visualiseur, avec pour chacune : quoi regarder, dans quel état,
et ce qui vaut oui ou non.
