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
