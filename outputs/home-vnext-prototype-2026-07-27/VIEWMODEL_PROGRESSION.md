# La carte « Ma progression » — comment elle décide quoi afficher

> Ce document explique **en français simple** la mécanique derrière la carte de la
> variante 2. Pas de code, pas de jargon. Si tu veux juste regarder les écrans, va dans
> [`README.md`](README.md), section « VARIANTE 2 ».
>
> Fichier concerné : `screens/homeVNext/progressionViewModel.ts`.

---

## 1. L'idée en une phrase

**La carte ne décide rien toute seule.** Un petit programme regarde ce que l'app sait
vraiment, en tire une liste de faits, et la carte se contente de les poser à l'écran.

**Analogie foot** : le ViewModel, c'est le staff qui prépare la feuille de match. La carte,
c'est le tableau d'affichage du stade. Le tableau n'invente pas un buteur : il affiche ce
que le staff lui donne. Si le staff n'a rien pour une ligne, la ligne n'existe pas —
le tableau ne met pas « 0 » à la place.

Pourquoi c'est important pour toi : **le jour où on branchera la vraie donnée, il n'y aura
rien à réviser côté écran.** Le seul endroit où un chiffre peut être faux, c'est le
programme — un seul fichier, testé.

---

## 2. Les trois états, et ce qui les déclenche

La carte n'a pas dix apparences. Elle en a **trois**, et on sait toujours dans laquelle
on est.

### État 1 — « TA PROGRESSION DÉMARRE ICI » *(le compte tout neuf)*

**Ce qui le déclenche** : **zéro séance terminée**. Rien d'autre n'est regardé.

**Ce qui s'affiche** :
- trois repères numérotés : « Termine ta première séance », « Partage ton ressenti »,
  « Compare tes prochains tests » ;
- une mention : « 0 séance terminée — tes premiers repères apparaîtront ici ».

**Ce qui ne s'affiche PAS** : aucune courbe, aucun chiffre de performance, **aucun bouton**.

Un détail qui compte : dans cet état, la carte est **incapable** d'afficher une courbe ou
une comparaison de tests. Ce n'est pas une consigne qu'un développeur pourrait oublier —
ces informations ne lui sont même pas transmises. On ne peut pas se tromper par distraction.

### État 2 — « TA PROGRESSION SE CONSTRUIT » *(ça commence, mais c'est trop tôt)*

**Ce qui le déclenche** : au moins **1 séance terminée**, mais pas encore assez pour une
tendance fiable (voir les seuils, §3).

**Ce qui s'affiche** : une liste de faits, chacun un chiffre **réellement mesuré** —

| Fait | Exemple |
|---|---|
| Séances terminées | 2 |
| Minutes réalisées | 76 min |
| Ressentis enregistrés | 2 |
| Avant d'afficher une tendance | Encore 2 séances |

Le dernier est **calculé** : c'est le seuil moins ce que le joueur a déjà fait. Il n'est
écrit en dur nulle part, et il change de formulation selon **ce qui bloque vraiment** —
« Encore 2 séances », ou « Encore 2 jours enregistrés », ou « Pas encore mesurable ».
Le joueur sait ce qui lui manque, pas juste qu'il lui manque quelque chose.

**Toujours aucun bouton** vers la page Progression (voir §5).

### État 3 — « TA PROGRESSION » *(il y a de quoi tracer)*

**Ce qui le déclenche** : assez de séances **et** assez de jours réellement enregistrés
(voir §3). Les deux, pas l'un ou l'autre.

**Ce qui s'affiche** :
- la courbe, tracée **uniquement sur de vrais points** — aucun point d'amorçage, aucun
  point inventé pour « faire joli » ;
- juste en dessous, **la portée exacte** de la mesure : « Calculé sur tes séances FKS
  uniquement — tes entraînements club n'y sont pas comptés » ;
- **un** fait complémentaire (le cumul de séances, ou les minutes, ou les jours actifs) ;
- la comparaison de tests terrain, s'il y en a une de possible ;
- **et là, seulement là, le pied « Voir ma progression »**.

---

## 3. Les quatre seuils — à valider par toi

Aucun de ces seuils ne touche à une séance, une charge, une intensité ou une prescription.
Ce sont **uniquement** des seuils d'affichage : à partir de quand on a le droit de montrer
quelque chose.

| Seuil | Valeur | Ce qu'il commande |
|---|---:|---|
| Séances avant une tendance | **4** | En dessous, on liste des faits, on ne dessine pas |
| Points avant de tracer | **3** | Il faut au moins 3 points pour qu'une ligne veuille dire quelque chose |
| Jours réellement enregistrés | **3** | **En plus** des points : 7 points adossés à 0 jour de charge réelle ne dessinent pas un joueur |
| Jours distincts pour comparer un test | **2** | Deux essais du même après-midi **ne sont pas** une progression |

Les deux premiers ne sont pas des inventions : ce sont **exactement** les mêmes seuils que
le bloc « Ma forme » de la variante 1. C'est volontaire. Les deux blocs vivent sur le même
écran : deux seuils différents produiraient un écran qui **se contredit** — la carte
dirait « pas encore de tendance » à dix pixels d'un bloc qui en affiche une. Un test
verrouille cette égalité : si quelqu'un change l'un sans l'autre, ça casse.

Le quatrième seuil (« 2 jours distincts ») est celui qui manque le plus à l'app
aujourd'hui — voir §6.

---

## 4. La règle qui compte le plus : une donnée inconnue disparaît

**Jamais « 0 min ». Jamais « — ». Jamais un tiret.** Si l'app ne connaît pas la durée
d'une séance, la ligne « Minutes réalisées » **n'existe pas**.

C'est le cas « Donnée manquante » dans le visualiseur : 3 séances terminées, aucune durée
connue, aucun ressenti. La carte affiche **deux lignes**, pas quatre :

```
Séances terminées                    3
Avant d'afficher une tendance    Encore 1 séance
```

Et elle rétrécit : **102 px** au lieu de 194 px. Elle est **la carte la plus légère des
six cas**.

Pourquoi c'est important : « 0 minute » est un mensonge. Ça ne veut pas dire « on ne sait
pas », ça veut dire « tu n'as rien fait ». Un joueur qui a bossé 50 minutes sans que l'app
l'enregistre lirait un reproche.

---

## 5. Pourquoi le pied « Voir ma progression » n'existe que dans un état sur trois

Ce n'est pas de la retenue esthétique. J'ai lu la page Progression bloc par bloc
(`screens/ProgressScreen.tsx`) et compté ce qu'un joueur y trouverait vraiment.

### Sur un compte neuf (état 1), la page n'a pas une seule ligne vraie

| Bloc de la page | Ce que le joueur y voit |
|---|---|
| Le grand encart « TA FORME » en haut | Un libellé d'état et une courbe de 30 jours calculés **à partir de deux constantes d'usine**. C'est la décroissance de deux réglages par défaut, pas le joueur |
| Les 6 accomplissements | **Les six sont verrouillés** : « 0/1 », « 0/10 », « 0/50 », « 0/7 », « 0/1 », « 0/30 ». Un mur de cadenas |
| Le calendrier du mois | Pas un seul jour actif |
| Les stats du mois | « 0 », « — », « — », « 0 j » |
| L'évolution des tests | Ne s'affiche même pas |

**Zéro ligne vraie.** On n'y envoie personne. Même si ce joueur avait enregistré des tests,
la carte les garde chez elle — c'est le contenu de l'état que tu as figé.

### À 1-3 séances (état 2), la page reste dominée par les valeurs d'amorçage

C'est **la définition même** du seuil de 4 séances : en dessous, le modèle est encore
piloté par ses réglages de départ. Le mur d'accomplissements reste verrouillé à 5 sur 6
au mieux. Et « Stats du mois » réaffiche le nombre de séances et la durée moyenne —
c'est-à-dire **exactement les faits que la carte vient d'énoncer**.

Le seul bloc honnête de la page, l'évolution des tests, **la carte le calcule elle-même,
et en mieux** : sur 17 champs de test au lieu de 9, et en exigeant deux jours distincts.
Elle peut donc le montrer sur place. **Le voyage coûte deux blocs faux et ne rapporte rien.**

### À partir de 4 séances (état 3), la page porte enfin du vrai

Trois blocs deviennent réels, et la carte ne peut pas les contenir :

- le **calendrier du mois jour par jour**, alimenté par de vraies séances et de vraies
  charges saisies ;
- les **stats du mois et l'écart avec le mois précédent**, comptés sur des séances réelles ;
- la **liste complète des comparaisons de tests**, là où la carte n'en montre qu'une.

**C'est là que le bouton apparaît**, et pas avant.

### Mais le bouton part avec une réserve

Le grand encart du haut de la page **reste faux** — il ne devient pas vrai à 4 séances.
Cette réserve est écrite noir sur blanc dans le programme et répétée dans les avertissements
du prototype : **le haut de la page Progression doit être corrigé avant toute mise en
production de ce lien.**

---

## 6. Les calculs de la page Progression qu'on a refusé de reprendre

Il aurait été plus rapide de réutiliser le code existant. Je ne l'ai pas fait, et voici
pourquoi — sans langue de bois.

### 6.1 La courbe et le libellé d'état du haut de page — REFUSÉ

La page redémarre son calcul depuis deux constantes d'usine sur 45 jours de chauffe, et
**un jour sans donnée y devient un point à charge zéro**. La légende annonce « Ta forme sur
30 jours » **sans jamais dire sur quoi c'est calculé**.

Sur un compte neuf, la totalité de ce bloc **est** la décroissance de deux constantes.
La carte ne reprend ni le calcul, ni le libellé, et n'affiche une courbe que sur de vrais
points observés.

### 6.2 Le mot « série » — REFUSÉ, et deux fois plutôt qu'une

La page compte une « série » (des jours d'affilée) de **deux façons différentes**, sous
**le même mot**, à deux endroits de la même page : une version sur toute l'histoire du
joueur pour les accomplissements, une version sur le mois pour les stats. Deux chiffres,
un seul mot.

Le mot, la métrique et la flamme sont **interdits** dans tout ce prototype. Une vérification
automatique le contrôle **dans le rendu et dans le code source** : aucune occurrence.

### 6.3 Le compte de cycles « estimé » — REFUSÉ

L'accomplissement « premier cycle » est calculé en divisant le nombre total de séances
par 12. Le commentaire du code dit lui-même que c'est un **substitut** approximatif.
Ce n'est pas une mesure : c'est une division commode. Rien de tel dans la carte.

### 6.4 La comparaison de tests — REPRISE, mais réécrite

C'est le seul bloc honnête de la page, et la carte le montre. Mais son calcul a été
**refait**, pour trois défauts précis :

| Défaut de la page | Ce que fait la carte |
|---|---|
| Elle compare **9 champs de test** alors que le projet en définit **17** — il manque notamment le test 505, le T-test et le triple bond | La carte lit **la liste officielle du projet**, les 17 |
| Elle ne vérifie **jamais** que les deux valeurs viennent de **deux jours différents** | La carte exige **2 jours distincts** |
| Un écart nul y ressort comme une variation | La carte dit « identique » |

Le deuxième point est le plus grave, et il est reproductible : dans le cas
« Aucune comparaison de test » du visualiseur, un joueur a couru le 6 minutes **deux fois
le même jour** (1420 m, puis 1455 m l'après-midi). La page Progression lui annoncerait
**une progression de +35 m**. Ce n'est pas une progression, c'est le deuxième essai.
La carte affiche **une explication**, pas un chiffre.

### 6.5 Les cases « 0 » et « — » des stats du mois — REFUSÉES

Elles violent frontalement la règle du §4.

---

## 7. Pourquoi ce programme est fait pour servir aux deux écrans un jour

Aujourd'hui, la carte du Home et la page Progression **calculent chacune de leur côté**.
D'où les contradictions relevées ci-dessus : deux comptes de « série », deux listes de
champs de test, deux façons de tracer une courbe.

Le programme de la carte est écrit pour pouvoir devenir **la source unique des deux
écrans** :

- **C'est une fonction pure.** Elle ne lit aucune base, ne regarde pas l'heure, ne
  déclenche aucun appel. On lui donne des faits, elle rend un résultat. Deux écrans peuvent
  l'appeler sans se marcher dessus.
- **Chaque donnée d'entrée dit d'où elle vient.** Chaque champ porte en commentaire le
  nom exact du magasin de données qui l'alimentera. Le branchement ne demandera pas
  d'enquête.
- **Elle sort du contenu prêt à afficher.** Les chiffres sont déjà formatés et accordés
  (« Encore 1 séance » / « Encore 2 séances »). L'écran ne peut pas se tromper d'arrondi
  ou de pluriel, parce qu'il ne calcule rien.
- **Elle refuse les états impossibles.** Sur un compte neuf, les informations de courbe et
  de comparaison ne sont **même pas transmises** à la carte.

Ce n'est pas fait pour maintenant. C'est fait pour que, le jour où on refondra la page
Progression, il n'y ait **qu'un seul endroit** où la vérité est calculée.

---

## 8. Ce que ce programme ne sait toujours PAS

À lire avant de considérer que le sujet est clos.

1. **Les entraînements club ne sont pas capturés.** Rien dans l'app n'enregistre ce que le
   joueur fait réellement à l'entraînement de son club. Ce qui existe aujourd'hui n'injecte
   qu'une charge **supposée**, à partir de cases cochées au moment de l'inscription.
   Conséquence : **la carte n'affiche jamais d'état physique global** — ni « En forme »,
   ni « Prêt à performer ». Elle dit sur quoi elle calcule, et elle s'arrête là.
2. **Les quatre seuils du §3 attendent ton avis.** Ils sont argumentés, pas validés.
3. **La page Progression n'a pas été refondue.** Le lien y mène toujours, avec sa réserve.
4. **La comparaison de tests ne montre que ce qui existe.** S'il n'y a pas deux mesures du
   même exercice à deux dates, il n'y a pas de comparaison — et la carte le dit au lieu
   d'en fabriquer une.
5. **Le jour d'un test est calculé en heure universelle** dans le prototype, pour que les
   captures soient reproductibles. Le reste de l'app utilise l'heure locale. À trancher au
   branchement : un test fait à 23 h ne doit pas basculer au lendemain.

Le détail complet est dans [`LIMITES_PROTOTYPE.md`](LIMITES_PROTOTYPE.md).

---

*Document produit le 28 juillet 2026 sur la branche `feat/home-vnext-prototype`.
Rien n'est commité, rien n'est poussé, rien n'est fusionné.
Le Home de production et la page Progression n'ont pas été modifiés.*
