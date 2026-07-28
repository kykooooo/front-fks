# Migrer la page Progression — ce qu'il faudra abandonner

> Document demandé explicitement par Kyllian, le 28 juillet 2026.
>
> Il répond à une question simple : **le Home et la page Progression racontent-ils
> la même chose ?** Aujourd'hui, non. Et l'écart n'est pas un détail de mise en page :
> c'est un écart d'honnêteté.

---

## LE POINT CAPITAL, ÉCRIT NOIR SUR BLANC

**Tant que cette migration n'est pas faite, le pied « Voir ma progression » de la carte
emmène le joueur vers un écran MOINS honnête que le Home dont il vient de sortir.**

Concrètement, sur l'état `ready` du prototype :

| Le joueur lit sur le Home | Puis il clique, et il lit sur la page Progression |
|---|---|
| « Calculé sur tes séances FKS uniquement — tes entraînements club n'y sont pas comptés » | rien du tout sur la portée. La légende dit « Ta forme sur 30 jours » (`screens/ProgressScreen.tsx`:547-549) |
| une courbe tracée **uniquement sur de vrais points** | une courbe de 30 points dont **chaque jour sans donnée vaut une charge de zéro** (`ProgressScreen.tsx`:255-270) |
| aucun jugement global (décision **D1**) | « TA FORME » + un libellé du type « En forme » / « Frais » (`ProgressScreen.tsx`:470-474) |
| un repère de test choisi par une règle publiée, et **jamais** par l'amplitude du résultat | 9 champs sur 17, et deux essais du même après-midi comptés comme une progression (`ProgressScreen.tsx`:169-203) |

C'est la raison pour laquelle le contrat de la carte porte un champ `reserve`
(`screens/homeVNext/progressionViewModel.ts`:573-578) : même quand le lien est affiché,
le programme **écrit** ce que la destination a encore de faux. La réserve n'est pas une
décoration : c'est une dette, et ce document est son échéancier.

**Conséquence de décision** : si tu intègres la variante 2 sans faire au moins l'étape 1
ci-dessous, tu répares le Home et tu laisses le mensonge à un clic de distance.

---

## 1. LE CONTRAT DU RÉSUMÉ CANONIQUE PARTAGÉ

### L'idée, en analogie foot

Aujourd'hui, le Home et la page Progression sont **deux commentateurs dans deux cabines
séparées**, qui regardent le même match et annoncent deux scores différents. Le résumé
canonique, c'est **un seul chronomètre officiel** : les deux cabines lisent le même
tableau, donc elles ne peuvent plus se contredire.

### Ce que c'est, techniquement

Une **fonction pure** — `progressionViewModel(input)` dans
`screens/homeVNext/progressionViewModel.ts`. On lui donne des faits, elle rend un résultat.
Elle ne lit aucune base, ne regarde pas l'heure, ne déclenche aucun appel réseau.
Deux écrans peuvent l'appeler sans se marcher dessus.

Ce qu'elle reçoit (`ProgressionInput` / `ProgressionInputBase`,
`progressionViewModel.ts`:355-414) :

| Entrée | D'où elle viendra |
|---|---|
| `seancesTerminees` | `useSessionsStore.sessions` filtrées sur `completed` |
| `testsTerrain` | l'historique unifié des tests, celui que `TestsScreen` écrit |
| `microcycleGoal` | `canonicalizeMicrocycleGoal(useSessionsStore.microcycleGoal)` |
| `tendance` | la série de charge, **quand elle existe vraiment** |
| `semaineCourante` | le compteur de la semaine, celui-là même qu'affiche « Ma semaine » |

Chaque champ porte, en commentaire, le nom exact du magasin qui l'alimentera.
Le branchement ne demandera aucune enquête.

### Les trois états

`ProgressionViewModel` est une **union discriminée** sur `state`
(`progressionViewModel.ts`:597-632). Ce n'est pas une convention de rédaction : c'est le
typage qui rend certains écrans **impossibles à produire**.

| État | Ce qui le déclenche | Ce que l'écran a le droit d'afficher |
|---|---|---|
| **`empty`** | zéro séance terminée | 3 repères numérotés + une mention honnête. `courbe: null` est un **type littéral** : une courbe est inécrivable ici. Aucun bouton. |
| **`collecting`** | au moins 1 séance, pas encore assez pour une tendance | une liste de **faits mesurés**, plus la phrase qui dit ce qui manque (« Encore 2 séances »). `courbe: null` là aussi. Aucun bouton. |
| **`ready`** | assez de séances **et** assez de jours réellement enregistrés | la courbe sur de vrais points, sa **portée écrite**, un fait complémentaire, le repère de test s'il existe, et **seulement là** le lien de sortie. |

Le point important pour un non-développeur : dans les deux premiers états, la courbe et la
comparaison de tests **ne sont même pas transmises** au composant. Un développeur pressé ne
peut pas « oublier » de les masquer — il n'a rien à masquer.

### Ce que le contrat distingue, et que la page Progression ne distingue pas

C'est le cœur du sujet. Cinq distinctions, cinq endroits où la page actuelle mélange.

| Le contrat distingue | La page Progression aujourd'hui |
|---|---|
| **une donnée mesurée** (une durée que l'app a enregistrée) | ne distingue pas : `avgDuration` vaut `null` puis s'affiche « — » (`ProgressScreen.tsx`:319-330 et 731-733) |
| **une donnée absente** — la ligne **disparaît**, jamais « 0 », jamais un tiret | affiche « 0 » ou « — » selon le bloc (`:719`, `:725`, `:732`) |
| **une tendance affichable** — 4 séances **et** 3 points **et** 3 jours réellement enregistrés | trace toujours, quoi qu'il arrive : 30 points sont produits même sur un compte vide (`:243-273`) |
| **une comparaison de test disponible** — 2 mesures du même test à **2 jours distincts** | ne vérifie jamais la date (`:187`) : deux essais du même après-midi passent pour une progression |
| **la portée limitée aux données FKS** — écrite mot pour mot sous la courbe | jamais écrite nulle part |

---

## 2. CE QUE `ProgressScreen` DEVRA ABANDONNER

Cinq chantiers. Pour chacun : où c'est, ce qui est faux, ce qui le remplace.

---

### 2.1 Les amorces ATL0 / CTL0 comme base d'affichage

**Où** : `screens/ProgressScreen.tsx`:251-252, dans le calcul `loadSeries` (`:243-273`).
Les constantes viennent de `config/trainingDefaults.ts`:14-15 — `CTL0: 15`, `ATL0: 12`.

```
let atlSeed = TRAINING_DEFAULTS.ATL0;   // 12
let ctlSeed = TRAINING_DEFAULTS.CTL0;   // 15
```

**Ce qui est faux.** Ces deux nombres sont des **valeurs d'usine**, choisies pour que le
moteur de charge démarre sans diviser par zéro. Ce ne sont pas des mesures du joueur.
La page les injecte, les fait décroître sur 45 jours de chauffe (`:245-246`), puis affiche
les 30 derniers jours du résultat.

Sur un compte tout neuf, **la totalité de la courbe et du libellé d'état EST la
décroissance de ces deux constantes.** Le joueur lit un bilan de forme calculé sur des
données qui n'existent pas. C'est exactement ce que le fondateur a refusé en décision D1 —
sauf qu'ici ce n'est pas une pastille, c'est toute la moitié haute de l'écran.

Il y a pire que faux : c'est **faux dans le sens flatteur**. `CTL0` (15) est supérieur à
`ATL0` (12), donc le TSB de départ est positif, donc l'écran annonce un joueur frais et
disponible. Un joueur qui n'a jamais rien fait est accueilli par un bon bulletin.

**Ce qui le remplace.** Le champ `tendance` du contrat
(`ProgressionTendanceInput`) n'est transmis **que** quand il y a de vrais points. Les
seuils (4 séances, 3 points, 3 jours réellement enregistrés) sont dans
`progressionViewModel.ts` et sont **les mêmes** que ceux du bloc « Ma forme » de la
variante 1 — un test verrouille cette égalité, pour que les deux blocs d'un même écran ne
se contredisent jamais. En dessous du seuil, l'écran passe en `collecting` : il liste des
faits, il ne dessine pas.

---

### 2.2 Les courbes artificielles

**Où** : `ProgressScreen.tsx`:255-270 (fabrication des points), `:433-449` (géométrie),
`:482-549` (rendu SVG), légende `:547-549`.

**Ce qui est faux.** Trois choses distinctes, souvent confondues :

1. **Un jour sans donnée devient un point à charge zéro.** Ligne 257 :
   `const load = Number(dailyApplied[key] ?? 0) || 0;`. « Je ne sais pas ce que tu as fait
   mardi » et « tu n'as rien fait mardi » sont écrits **de la même façon**. Pour un
   amateur qui s'entraîne au club sans que l'app le sache, c'est la situation NORMALE, pas
   un cas limite.
2. **La courbe fait toujours exactement 30 points**, quel que soit le nombre de jours
   réellement observés. Sa densité visuelle ne dit rien de la quantité de données derrière.
3. **La légende ne dit pas sur quoi c'est calculé.** « Ta forme sur 30 jours »
   (`:547-549`). Pas « tes séances FKS », pas « hors entraînements club ». Le joueur lit
   « ta forme », pas « la part de ta forme que l'app connaît ».

**Ce qui le remplace.** L'état `ready` du contrat porte `courbe: ProgressionCourbe`
(`progressionViewModel.ts`:536-547), qui contient **les points réels** et un champ `portee`
de type `string` **non nullable** : une courbe sans sa portée est inécrivable. La phrase
est affichée sous le tracé et vérifiée **mot pour mot** par le vérificateur du prototype
(contrôle `j` de `verifier-variante2.js`).

---

### 2.3 Les séries (« streaks ») aux définitions discutables

**Où** : deux calculs **différents**, sous **le même mot**, dans le même fichier :

| Calcul | Ligne | Définition |
|---|---|---|
| `globalMaxStreak` | `:333-348` | plus longue suite de jours consécutifs sur **toute** l'histoire du joueur |
| `maxStreakThisMonth` | `:350-365` | plus longue suite **à l'intérieur du mois en cours** |

Le premier alimente l'accomplissement « 7 jours d'affilée » (`:87-94`), le second la case
« Record streak » des stats du mois (`:735-739`).

**Ce qui est faux.** Trois défauts :

1. **Deux chiffres, un seul mot.** Un joueur peut lire « Record streak : 3 j » dans les
   stats et voir l'accomplissement « 7 jours d'affilée » débloqué juste au-dessus. Les deux
   sont « vrais » — ils ne mesurent pas la même chose, et rien ne le dit.
2. **Le 1ᵉʳ du mois remet le compteur à zéro** (`:355`, la boucle part de
   `startOfMonth`). Une série de 6 jours à cheval sur deux mois est comptée 2 et 4.
3. **Une série mélange les séances FKS et les charges externes** : `activitySet` reçoit les
   deux (`:286-292`). Le « record » n'est donc ni un record FKS, ni un record d'activité
   réelle — c'est un record d'entrées dans l'app.

**Ce qui le remplace.** Rien. Le mot, la métrique et la flamme sont **interdits** dans tout
le prototype, et une vérification automatique le contrôle **dans le rendu et dans le code
source** (contrôle `h` de `verifier-variante2.js`, contrôle `g` de `verifier.js`) : zéro
occurrence. Une série de jours consécutifs récompense la **fréquence**, pas la progression,
et elle punit un joueur qui suit correctement un jour de repos prescrit.

Si tu veux garder une notion d'assiduité, il faudra **une** définition, écrite, une seule,
et affichée avec sa période. Ce n'est pas une décision de développeur.

---

### 2.4 Les cycles estimés par division du nombre de séances

**Où** : `ProgressScreen.tsx`:399-400.

```
// Proxy : cycles estimés via séances FKS complétées ÷ 12 (pas de compteur de cycles persisté)
const estimatedCycles = Math.floor(completedSessions.length / 12);
```

**Ce qui est faux.** Le commentaire du code le dit lui-même : c'est un **substitut**. Ce
nombre alimente l'accomplissement « Cycle terminé » (`:95-102`), qui s'affiche comme un
fait accompli (« Fait ! »).

Un joueur qui a fait 12 séances **réparties sur trois cycles abandonnés** verra « Cycle
terminé — Fait ! ». Il n'a terminé aucun cycle. À l'inverse, un joueur qui termine un cycle
raccourci ne le verra jamais. La division est commode ; elle ne mesure rien.

**Ce qui le remplace.** Deux options, dans cet ordre de préférence :

1. **Un vrai compteur persisté.** Le produit sait déjà ce qu'est la fin d'un cycle (12
   séances → invitation à en choisir un nouveau, règle n° 3 du `CLAUDE.md`). Il suffit
   d'écrire l'événement quand il se produit, au lieu de le déduire après coup.
2. **En attendant, ne rien afficher.** Le contrat ne porte aucun champ « cycles » : sur le
   Home, la ligne n'existe pas. Une ligne absente est honnête ; une ligne déduite ne l'est
   pas.

---

### 2.5 Les accomplissements présentés comme des mesures alors qu'ils sont déduits

**Où** : `computeMilestones` (`ProgressScreen.tsx`:56-112), rendu `:552-...`.

Les six accomplissements, et ce que chacun vaut vraiment :

| Accomplissement | Ligne | Source | Verdict |
|---|---|---|---|
| Première séance | `:63-70` | `completedSessions.length` | **mesuré** — c'est vrai |
| 10 séances | `:71-78` | idem | **mesuré** |
| 50 séances | `:79-86` | idem | **mesuré** |
| 7 jours d'affilée | `:87-94` | `globalMaxStreak` (§2.3) | **déduit**, définition discutable |
| Cycle terminé | `:95-102` | `estimatedCycles` (§2.4) | **déduit d'une division** |
| 30 jours d'activité | `:103-110` | `activitySet.size` | **ambigu** : mélange séances FKS et charges externes déclarées à la main (`:286-292`) |

**Ce qui est faux.** Ce n'est pas que les six soient faux — trois sont parfaitement justes.
Le problème est qu'ils sont **présentés à l'identique** : même grille, même icône, même
cadenas, même mot « Débloqué ». Rien à l'écran ne distingue un compteur de séances (exact)
d'une division par 12 (approximative). Le joueur reçoit les six avec le même niveau de
confiance.

Et une donnée déduite, dans un habit de médaille, se lit comme une récompense méritée.
C'est la forme la plus difficile à contester : personne ne va vérifier une médaille.

**Ce qui le remplace.** Le contrat n'a **pas** de notion d'accomplissement. Il a des
`faits` (`ProgressionFait`) : un libellé, une valeur, et la règle R1 — **un fait dont la
valeur est inconnue n'existe pas**. C'est plus pauvre, et c'est le but.

Si les accomplissements reviennent un jour, la règle à tenir est simple : **ne garder que
ceux qui sont comptés, pas ceux qui sont déduits.** Trois des six passent sans rien changer.

---

### 2.6 Deux chantiers hors de ta liste, à traiter avec (ils sont dans le même écran)

**a) Le libellé d'état global — c'est la décision D1, appliquée à l'autre écran.**
`ProgressScreen.tsx`:240 (`getFootballLabel(tsb)`) et `:470-474` (le rendu « TA FORME » +
libellé + message). C'est exactement le libellé que tu as fait retirer du Home. Le retirer
d'un écran et le laisser sur l'autre ne change rien pour le joueur : il le lit quand même,
un clic plus loin. Même motif, même remède : **rien tant que le calcul ne repose pas sur
des données entièrement réelles avec une portée expliquée.**

**b) La comparaison de tests — le seul bloc honnête de la page, et il est réparable.**
`computeTestComparisons` (`:169-203`) a trois défauts précis :

| Défaut | Ligne | Conséquence |
|---|---|---|
| Compare **9 champs** alors que le projet en définit **17** (`FIELD_DEFS`, `screens/tests/testConfig.ts`:87) | `:144-160` | manquent : triple bond, bond latéral, T-test, **test 505**, goblet reps, split squat (kg et reps), trap bar 3RM |
| Ne vérifie **jamais** que les deux valeurs viennent de **deux jours différents** | `:187` | deux essais du même après-midi = « progression » |
| Compare encore `yoYoIR1_m` | `:157` | ce test est **volontairement retiré du produit** (`testConfig.ts`:315-317) |

Le deuxième est reproductible et il est **dans le prototype, à l'écran** : la fixture
`v2-aucune-comparaison-de-test` contient un 6 minutes couru deux fois le même jour
(1420 m à 10 h 00, 1455 m à 16 h 05). La page Progression annoncerait **+35 m**. La carte
affiche une explication, pas un chiffre.

**Ce qui le remplace** : `comparaisonsTests` du contrat, qui lit la liste officielle des 17
champs, exige 2 jours distincts, et dit « identique » quand l'écart est nul.

---

## 3. L'ORDRE DE MIGRATION CONSEILLÉ, ET LE RISQUE DE CHAQUE ÉTAPE

L'ordre n'est pas esthétique : il va du **mensonge le plus visible et le moins cher à
retirer** vers le **chantier le plus lourd**. Chaque étape est livrable seule.

---

### Étape 1 — Retirer le libellé d'état global et écrire la portée sous la courbe

**Quoi** : supprimer le bloc « TA FORME » + libellé (`:466-479`), et ajouter sous la
courbe la même phrase que le Home (« Calculé sur tes séances FKS uniquement — tes
entraînements club n'y sont pas comptés »).

**Pourquoi en premier** : c'est la décision D1, déjà prise, appliquée au second écran.
C'est aussi la modification la moins chère du lot — deux blocs de rendu, aucun calcul.

**Risque : FAIBLE.** Aucun calcul n'est touché. Le seul effet de bord est visuel : le hero
perd sa couleur d'accent, qui venait de `footballLabel.color` (`:471`, `:477`, `:525`,
`:536`). Il faudra choisir une couleur fixe pour la courbe — sinon elle disparaît.
**À vérifier après coup** : `domain/adviceRules.ts`:155 et :287 appellent aussi
`getFootballLabel`. Ne les touche pas dans cette étape ; note-les.

---

### Étape 2 — Arrêter de tracer quand il n'y a pas de quoi tracer

**Quoi** : remplacer `loadSeries` (`:243-273`) par les seuils du contrat. En dessous,
afficher l'état `collecting` (une liste de faits) au lieu d'une courbe.

**Pourquoi en deuxième** : c'est le mensonge le plus gros (toute la moitié haute de l'écran
sur un compte neuf), mais il demande de brancher le contrat, donc il vient après l'étape 1.

**Risque : MOYEN.** Deux pièges concrets :
- **Le seuil doit être le même que celui du Home**, sinon les deux écrans se contredisent à
  un clic d'intervalle. Le test qui verrouille l'égalité côté prototype existe déjà — il
  faudra l'étendre.
- **Beaucoup de joueurs actuels basculeront en `collecting`**, y compris des joueurs qui
  voyaient une courbe hier. C'est correct (ils n'auraient jamais dû la voir), mais ça se
  verra. À préparer, pas à subir.

---

### Étape 3 — Réparer la comparaison de tests

**Quoi** : remplacer `computeTestComparisons` (`:169-203`) par `comparaisonsTests` du
contrat : 17 champs, 2 jours distincts obligatoires, écart nul dit « identique »,
`yoYoIR1_m` retiré.

**Pourquoi en troisième** : c'est le seul bloc de la page qui repose sur de vraies mesures.
Le réparer **ajoute** de l'information (8 champs de plus) au lieu d'en retirer — c'est
l'étape qui donne du crédit aux deux précédentes.

**Risque : FAIBLE à MOYEN.** Le seul effet notable : des comparaisons **disparaîtront**
chez les joueurs qui ont enregistré deux mesures le même jour. C'est le but. À dire dans la
note de version, sinon ça remontera comme un bug.

---

### Étape 4 — Trancher le sort des séries et des accomplissements

**Quoi** : supprimer les deux `streak` (`:333-365`), l'accomplissement « 7 jours d'affilée »
(`:87-94`), la case « Record streak » (`:735-739`), et l'accomplissement « Cycle terminé »
(`:95-102`) tant qu'aucun compteur de cycles n'est persisté. Garder les trois
accomplissements comptés (première séance, 10, 50).

**Pourquoi en quatrième** : ce n'est pas une correction technique, c'est une **décision
produit**. Elle t'appartient, et elle peut attendre que les trois premières soient en
production.

**Risque : MOYEN, mais pas technique.** Techniquement c'est de la suppression, donc simple.
Le risque est **d'usage** : les accomplissements sont ce qui ressemble le plus à un jeu
dans l'app. En retirer trois sur six appauvrit l'écran. Deux options honnêtes : les retirer
franchement, ou les garder en les **séparant visuellement** de ce qui est mesuré (une
section « Repères » distincte, jamais mélangée aux chiffres). Ne pas trancher, c'est
choisir la première par défaut.

---

### Étape 5 — Persister un vrai compteur de cycles

**Quoi** : écrire l'événement « cycle terminé » au moment où il se produit (12ᵉ séance
validée), plutôt que de le déduire d'une division.

**Pourquoi en dernier** : c'est la seule étape qui touche à l'**écriture** de données, donc
au store et à Firestore. Toutes les autres ne font que lire.

**Risque : ÉLEVÉ.** C'est la seule étape qui sort du périmètre « affichage » :
- elle touche `state/trainingStore` et la synchronisation Firestore ;
- l'historique existant **n'a pas** l'événement — les joueurs actuels partiront de zéro
  cycle, y compris ceux qui en ont réellement terminé. Il faudra soit l'assumer, soit
  écrire une reprise d'historique, qui est elle-même une estimation… c'est-à-dire le
  problème qu'on cherchait à supprimer.

Ma recommandation : **fais les étapes 1 à 4, laisse la 5 tant que « cycles terminés » n'est
pas une information que quelqu'un réclame.** Ne pas afficher un nombre coûte moins cher que
de le fabriquer.

---

## 4. RÉCAPITULATIF EN UNE PAGE

| # | Étape | Fichier / lignes | Risque | Débloque |
|---|---|---|---|---|
| 1 | Retirer le libellé d'état global, écrire la portée | `ProgressScreen.tsx`:240, :466-479, :547-549 | **Faible** | la cohérence D1 entre les deux écrans |
| 2 | Ne plus tracer sans vrais points | `ProgressScreen.tsx`:243-273, :433-449 | **Moyen** | la fin des amorces ATL0/CTL0 à l'écran |
| 3 | Réparer la comparaison de tests | `ProgressScreen.tsx`:144-203 | **Faible/Moyen** | 8 champs de plus, la fin du « +35 m » du même après-midi |
| 4 | Trancher séries et accomplissements | `ProgressScreen.tsx`:56-112, :333-365, :735-739 | **Moyen** (produit, pas technique) | la fin des deux définitions sous un même mot |
| 5 | Persister un vrai compteur de cycles | store + Firestore | **Élevé** | l'accomplissement « Cycle terminé », s'il est réclamé |

Après l'étape 3, la réserve portée par le champ `reserve` du contrat peut être **réduite**.
Elle ne peut être **retirée** qu'après l'étape 4.

---

*Document produit le 28 juillet 2026 sur la branche `feat/home-vnext-prototype`.
`screens/ProgressScreen.tsx` a été **lu, jamais modifié** — toutes les lignes citées sont
celles du fichier tel qu'il est aujourd'hui. Rien n'est commité, rien n'est poussé,
rien n'est fusionné.*
