# Audit de l'espace coach — avant refonte

**Date** : 27 juillet 2026
**Branche** : `feat/coach-pilot-experience`
**Pour** : Kyllian (fondateur, non-dev)
**Objet** : ce que le coach voit aujourd'hui, ce qui l'induit en erreur, et pourquoi
la refonte est structurée comme elle l'est.

> **Comment lire ce document.** Chaque affirmation est suivie de sa preuve sous la
> forme `fichier:ligne`. Tu n'as pas besoin d'ouvrir les fichiers pour comprendre :
> le texte se lit seul. Les preuves sont là pour que n'importe qui puisse vérifier
> derrière moi.
>
> **Référence des numéros de ligne** : commit **`724c062`**, c'est-à-dire l'état
> exact **avant** la refonte. Les lots de développement travaillent en parallèle
> dans le même répertoire ; pour retrouver une preuve à l'identique, utiliser
> `git show 724c062:<fichier>`. Toutes les citations ci-dessous ont été
> revérifiées contre ce commit.
>
> **Un mot de vocabulaire, une fois pour toutes.** On appelle **projection** la
> fiche résumée que le serveur fabrique pour chaque joueur et dépose dans un
> dossier que seul le coach peut ouvrir. C'est comme la feuille de match : le
> joueur a son carnet d'entraînement complet (privé), le coach reçoit une feuille
> résumée préparée par le staff. Le coach ne lit **jamais** le carnet. Il lit
> **seulement** la feuille.

---

## 1. Le parcours coach actuel, écran par écran

Il y a trois écrans coach, pas un de plus.

### 1.1 Création du club — `CoachOnboardingScreen`

Le coach arrive ici depuis l'édition de profil ("Tu fais partie du staff ?"),
route déclarée dans `navigation/RootNavigator.tsx:217-221`.

Ce qu'il voit : un titre "Espace coach", deux champs (nom du club obligatoire,
son propre nom facultatif), un bouton "Créer mon club"
(`screens/CoachOnboardingScreen.tsx:113-143`).

Ce qui se passe au clic : le club est créé, un code d'invitation est généré, le
coach devient owner + membre `coach`, et son profil est marqué "complété" pour
qu'il n'ait pas à répondre au questionnaire joueur
(`repositories/clubsRepo.ts:184-207`). Le code d'invitation apparaît **dans un
toast**, c'est-à-dire un message qui disparaît tout seul au bout de 2,2 secondes
(`screens/CoachOnboardingScreen.tsx:71-76`). Il le retrouvera plus tard dans
l'onglet Semaine, mais à cet instant précis il peut très bien le rater.

**Taps : 3** (nom du club, éventuellement son nom, bouton créer).

### 1.2 L'écran principal — `CoachHomeScreen`

> **Écran supprimé du dépôt (juillet 2026).** Cette section décrit l'état
> **avant refonte** (commit `724c062`, cf. l'avertissement en tête de document).
> `CoachHomeScreen.tsx` n'était déjà plus routé depuis la refonte
> `screens/coach/` ; il a depuis été retiré (`git show 724c062:screens/CoachHomeScreen.tsx`
> pour le relire). Les écrans réels sont aujourd'hui `CoachTodayScreen` /
> `CoachRosterScreen` / `CoachWeekScreen` (`navigation/CoachTabs.tsx`).

Dès que le profil porte `role === "coach"`, l'app bascule sur la pile coach
(`navigation/RootNavigator.tsx:445-448`). Cette pile n'a **pas de barre
d'onglets** : c'est un simple empilement d'écrans
(`navigation/RootNavigator.tsx:238-258`). Toute la navigation coach se fait
donc à l'intérieur d'un seul écran, via un sélecteur à trois segments.

En haut, toujours visible :

1. **En-tête club** — "ESPACE COACH", le nom du club, une pastille "N joueurs",
   et une icône de déconnexion (`screens/CoachHomeScreen.tsx:626-640`).
2. **Carte de chiffres** — trois nombres : *Prêtes*, *À relancer*, *Effectif*
   (`screens/CoachHomeScreen.tsx:646-652`).
3. **"BULLETIN DE LA SEMAINE"** — une phrase de synthèse
   (`screens/CoachHomeScreen.tsx:654-657`).
4. **Sélecteur 3 segments** : Semaine / Séances / Effectif
   (`screens/CoachHomeScreen.tsx:82-87` et `662-678`).

L'onglet ouvert par défaut est **Séances** (`screens/CoachHomeScreen.tsx:115`).

**Onglet Séances** (celui qu'il voit en premier, 0 tap) :
quatre compteurs (*Prêtes*, *Adaptées*, *À relancer*, *Sans séance*,
lignes `489-492`), puis la liste des joueurs triée par priorité. Chaque ligne
porte : une barre de couleur à gauche, le prénom, un badge de poste, un badge de
statut, une ligne "titre de séance · durée · intensité", et parfois une ligne
"Note FKS · <raison>" (`screens/CoachHomeScreen.tsx:501-548`).

**Onglet Semaine** (1 tap) : le code club avec un bouton Partager
(`351-367`), puis le "Cadre de la semaine" : type d'équipe, intensité club,
objectif FKS, match ce week-end, note libre, bouton d'enregistrement
(`369-466`).

**Onglet Effectif** (1 tap) : la même liste, en version annuaire — initiale du
prénom, catégorie d'âge, poste, niveau, et trois badges de statut
(`578-608`).

Tout en bas : mentions légales, confidentialité, suppression de compte
(`684-708`).

### 1.3 La fiche joueur — `CoachPlayerDetailScreen`

> **Écran supprimé du dépôt (juillet 2026).** Même remarque qu'en 1.2 : état
> avant refonte, fichier retiré (`git show 724c062:screens/CoachPlayerDetailScreen.tsx`
> pour le relire). L'écran réel est aujourd'hui `screens/coach/CoachPlayerScreen.tsx`
> (route `CoachPlayerDetail`, cf. `navigation/RootNavigator.tsx`).

**1 tap** depuis n'importe quelle ligne de liste
(`screens/CoachHomeScreen.tsx:522-525` et `583-586`).

Quatre sections : identité, "Dernière séance FKS" (type, intensité, durée,
nombre de blocs), "Pourquoi cette séance" (jusqu'à 4 raisons), "Dernière
activité" (date + durée), et "Garde-fous FKS" (4 phrases fixes de réassurance)
(`screens/CoachPlayerDetailScreen.tsx:206-292`).

### 1.4 Le compte de taps, en résumé

| Ce que le coach veut | Taps depuis l'ouverture de l'app |
|---|---|
| Voir qui est "À relancer" | 0 |
| Ouvrir la fiche d'un joueur | 1 |
| Retrouver son code club | 1 (onglet Semaine) |
| Poser le cadre de la semaine | 1 + 3 choix + 1 bouton |
| Voir l'effectif complet | 1 |

Le nombre de taps n'est **pas** le problème de cet espace. Le problème est ce
qu'il y a **derrière** les taps.

---

## 2. Les irritants, classés par gravité

### P0 — Le coach reçoit une information fausse ou trompeuse

#### P0-1. Une séance générée mais jamais faite éteint définitivement l'alerte

C'est le défaut le plus grave, et il est invisible à l'œil nu.

La logique de statut est dans `domain/coachSummary.ts:260-272`. Elle teste dans
cet ordre :

1. rien du tout → "Sans séance"
2. **il existe une séance planifiée dont la date est aujourd'hui ou plus tard →
   "Prête"** (ligne `263-265`)
3. quelque chose de fait il y a moins de 7 jours → "Faite"
4. sinon → "À relancer"

Le test 2 passe **avant** le test 4. Conséquence concrète : un joueur qui
génère une séance et ne la fait jamais reste éternellement en "Prête". Il ne
basculera **jamais** en "À relancer", même après trois semaines sans rien faire.

En termes de foot : c'est un joueur qui s'échauffe sur le bord du terrain
depuis un mois. Le tableau du coach affiche "prêt à entrer", et ne dira jamais
"il n'est jamais entré".

Et comme le compteur "À relancer" de la carte du haut vient exactement de ce
même calcul (`domain/coachSummary.ts:337-355`, appelé en
`screens/CoachHomeScreen.tsx:255-256`), le chiffre affiché en gros au-dessus du
bulletin **sous-estime structurellement** le nombre de joueurs à relancer.

#### P0-2. "Adaptée" ne veut pas dire ce que le coach comprend

Le mot "Adaptée" apparaît trois fois à l'écran : dans les compteurs
(`screens/CoachHomeScreen.tsx:490`), en badge vert sur l'onglet Effectif
(`603`), et dans le tri de priorité (`domain/coachSummary.ts:298`).

Un entraîneur qui lit "Adaptée" comprend : *le joueur a modifié sa séance*.
C'est faux. Le champ vient de `adaptation.adapted`, qui est posé côté serveur
à partir des garde-fous appliqués **par le moteur FKS**
(`functions/src/projector.ts:156` et `172`). La bonne traduction est : *FKS a
allégé ou ajusté la séance avant de l'envoyer au joueur*. Le joueur, lui, n'a
rien décidé.

C'est le piège produit numéro 1 (détaillé en §7).

#### P0-3. Le "bulletin de la semaine" n'est pas un bulletin de la semaine

La phrase affichée est construite par `buildWeeklyReportSentence`
(`domain/coachSummary.ts:388-409`). Elle colle ensemble deux choses de nature
différente :

- un **libellé de semaine** vrai ("Semaine du 20 au 26 juillet 2026",
  `domain/coachLabels.ts:33-46`) ;
- des **compteurs instantanés** (`summary.toRelance`, `summary.planned`) qui ne
  sont bornés à aucune semaine. Ils regardent la dernière séance connue de
  chaque joueur et une fenêtre glissante de 7 jours
  (`domain/coachSummary.ts:235`, `266`).

Résultat : la phrase dit "Semaine du 20 au 26 juillet — … 3 séances prêtes",
alors que ces 3 séances peuvent dater de la semaine d'avant. Le coach lit une
information de semaine ; l'app lui donne un état à l'instant T habillé en
semaine. C'est le piège produit numéro 2.

#### P0-4. "Faite" reste affiché en vert jusqu'à 7 jours après

`RELANCE_DAYS = 7` (`domain/coachSummary.ts:235`), et le test est
`daysSince <= RELANCE_DAYS` (`266`). Un joueur qui n'a rien fait depuis 6 jours
est affiché "Faite", badge vert (`screens/CoachHomeScreen.tsx:286`). Pour un
coach amateur qui voit ses joueurs 2 fois par semaine, 6 jours d'inactivité,
c'est déjà un décrochage. Le vert le rassure à tort.

#### P0-5. "Durée réelle" n'est pas une mesure

Sur la fiche joueur, la case "Durée réelle" (`screens/CoachPlayerDetailScreen.tsx:270-273`)
affiche `lastActivity.durationMin`. Cette valeur vient en priorité de
`feedback.durationMin` (`functions/src/projector.ts:103`), c'est-à-dire de ce
que le **joueur a déclaré** après sa séance. Ce n'est pas un chronomètre. Le mot
"réelle" affirme une mesure là où il n'y a qu'une déclaration.

### P1 — Le coach ne peut pas répondre à une question métier légitime

#### P1-1. Prévu et fait se disputent une seule case

Le serveur ne projette **qu'une** séance, choisie par `pickCoachSessionToDisplay`
(`functions/src/coachLabels.ts:239-262`, appelée en
`functions/src/projector.ts:153`). Soit on voit la planifiée, soit la faite,
jamais les deux.

La règle de choix est explicite : si la planifiée est plus récente que la faite,
c'est la planifiée qui gagne (`functions/src/coachLabels.ts:258`). Donc dès
qu'un joueur génère une nouvelle séance, la trace de ce qu'il a réellement fait
disparaît de l'écran principal.

**"Ce qui était prévu vs ce qui a été fait" est donc mécaniquement impossible
aujourd'hui.** Ce n'est pas un oubli d'UI : c'est le contrat de données qui n'a
qu'un seul emplacement.

#### P1-2. Pas d'assiduité, parce qu'il n'y a qu'une seule date

`lastActivity` ne contient qu'une date et une durée
(`functions/src/projector.ts:159-161`, contrat en `domain/coachSummary.ts:31-34`).
Un joueur qui a fait 4 séances cette semaine et un joueur qui en a fait 1 sont
strictement indiscernables pour le coach : ils affichent tous les deux la même
dernière date.

"Qui suit bien ?" et "qui s'est entraîné cette semaine ?" sont donc hors de
portée, quelle que soit l'UI qu'on dessine par-dessus.

#### P1-3. Aucune trace de ce que le joueur a réellement exécuté

Rien dans la projection ne dit si le joueur a fait tous les exercices, en a
sauté, en a remplacé, ni pourquoi. Le contrat serveur complet tient en
`functions/src/dto.ts:37-47` — il n'y a pas de champ d'exécution.

C'est la donnée que la branche "boucle de suivi joueur" produit déjà côté
joueur, mais qui ne remonte pas encore au coach (cf. §6).

#### P1-4. Le nombre de blocs ne dit rien à un entraîneur

La fiche joueur affiche "Blocs : 4" (`screens/CoachPlayerDetailScreen.tsx:226-231`).
"Bloc" est un mot du moteur de génération, pas un mot de terrain. Un coach de
club ne sait pas si 4 blocs c'est beaucoup ou peu. Cette case occupe une place
sans aider à décider.

### P2 — Cohérence, confiance, finitions

#### P2-1. La couleur porte parfois seule le sens

La barre de priorité à gauche de chaque ligne (`screens/CoachHomeScreen.tsx:528`)
est orange, verte ou transparente, sans aucun texte associé. Le badge voisin
porte bien le libellé, donc l'information n'est pas perdue — mais la barre
elle-même est un signal purement chromatique, et le vert de "Adaptée"
(`603`, ton `ok`) suggère "c'est bien" là où le sens réel est "FKS a dû
alléger", ce qui mérite plutôt de la neutralité.

#### P2-2. L'aperçu vide promet une fonctionnalité qui n'existe pas — et qui serait interdite

> **Résolu par suppression (juillet 2026) : ce n'est plus dans le dépôt.**
> `CoachHomeScreen.tsx`, qui portait ce texte, a été retiré car non routé
> (cf. note en 1.2). L'aggravant décrit ci-dessous a donc disparu avec le
> fichier — noté ici pour que le point P2-2 reste lisible comme trace d'audit.

Quand le club est vide, l'app affiche une maquette grisée avec la légende :
"Assiduité, ressenti agrégé et alertes à relancer apparaîtront ici, joueur par
joueur." (`screens/CoachHomeScreen.tsx:310-312`).

Or "ressenti agrégé", c'est de la fatigue et de la douleur. C'est exactement ce
que la frontière coach-safe interdit (`functions/src/dto.ts:66-98`). On promet
donc en démo une chose qu'on s'est engagé à ne jamais livrer.

#### P2-3. Un champ projeté n'est jamais affiché

`profileComplete` est calculé côté serveur (`functions/src/projector.ts:145`),
transporté, parsé côté front (`domain/coachSummary.ts:154`)… et affiché nulle
part. À la place, l'écran devine "Profil à compléter" à partir de l'absence de
poste et de niveau (`screens/CoachHomeScreen.tsx:598`). Deux vérités pour la
même idée, dont une inutilisée.

#### P2-4. Le code club s'affiche une fois puis se cache

Au moment de la création, le code passe dans un toast qui disparaît
(`screens/CoachOnboardingScreen.tsx:71-76`). Ensuite il faut savoir aller dans
l'onglet Semaine pour le retrouver (`screens/CoachHomeScreen.tsx:351-367`).
Pour un coach dont le tout premier geste est "j'envoie le code à mon groupe
WhatsApp", c'est un frottement inutile.

#### P2-5. "Il y a X jours" est figé au montage de l'écran

`todayKey` est calculé une seule fois au rendu
(`screens/CoachHomeScreen.tsx:104`). Un écran laissé ouvert pendant la nuit
continue d'afficher les distances de la veille. Effet mineur, mais réel.

#### P2-6. Le coût de lecture est élevé et assumé

Pour afficher la liste, l'app lit d'abord l'effectif, puis **une lecture par
joueur** (`repositories/clubsRepo.ts:279-310`). Le commentaire du fichier
l'annonce honnêtement : ~31 lectures Firestore par rafraîchissement pour 15
joueurs (`repositories/clubsRepo.ts:225-229`). Ce n'est pas un bug — c'est le
prix du garde-fou anti-fiche-périmée — mais il faut le savoir avant d'ajouter
des champs ou d'augmenter la fréquence de rafraîchissement.

---

## 3. Ce qui marche déjà bien et qu'on ne doit surtout pas casser

Il y a du travail solide dans cet espace. Le lister est aussi important que
lister les défauts, parce qu'une refonte maladroite le détruirait sans le voir.

### 3.1 La frontière coach-safe est réelle, pas déclarative

Le coach **ne peut pas** lire les documents bruts du joueur. Ce n'est pas une
politesse de l'app, c'est verrouillé côté base de données :

- `users/{uid}`, ses séances et ses séances planifiées ne sont lisibles que par
  leur propriétaire (`firestore.rules:47-61`) ;
- la projection coach n'est lisible que par le coach ou l'owner du club, **et**
  seulement si le joueur ciblé est encore membre actif du club
  (`firestore.rules:132-136`) ;
- personne, coach compris, ne peut **écrire** dans la projection
  (`firestore.rules:135`, `allow write: if false`). Seule une Cloud Function
  la produit (`functions/src/rebuild.ts:78-105`).

En clair : même si quelqu'un piratait l'app côté téléphone, il ne pourrait pas
lire le carnet du joueur. **C'est l'atout de vente le plus fort de cet espace
face à un club, et il est déjà là.**

### 3.2 Le dernier rempart anti-fuite est automatique

Avant chaque écriture de projection, une fonction parcourt tout l'objet et
**jette une erreur** si elle trouve une clé interdite : douleur, blessure,
fatigue, RPE, sommeil, TSB, commentaire… (`functions/src/dto.ts:66-121`,
appelée en `functions/src/rebuild.ts:74`). Ce n'est pas une relecture humaine,
c'est un verrou qui casse le déploiement si on se trompe. Il faut le garder et
l'étendre, jamais le contourner.

### 3.3 Le parseur défensif côté front

`parseCoachPlayerSummary` (`domain/coachSummary.ts:143-159`) reconstruit
l'objet champ par champ, sans jamais recopier en bloc ce qui arrive du serveur.
Chaque valeur est bornée : dates réellement valides (`77-89`), durées 1-240 min
(`68-69`), nombre de blocs entier 1-20 (`72-73`), textes tronqués, statuts
allowlistés (`91-94`). Une donnée bizarre devient `null`, jamais un affichage
cassé.

C'est ce module qui devra accueillir les nouveaux champs, avec les mêmes bornes.

### 3.4 Les gardes anti-réponse tardive de la fiche joueur

Trois protections cohabitent sur `CoachPlayerDetailScreen`, et elles sont
subtiles :

- `shouldApplyCoachDetailResponse` (`domain/coachSummary.ts:210-223`) refuse
  d'appliquer une réponse réseau si l'écran a été démonté, si une requête plus
  récente est partie, ou si le coach a changé de joueur entre-temps. Traduction
  foot : on n'affiche jamais la fiche du 9 sur le maillot du 6 parce que le
  réseau a mis du retard.
- `nextCoachDetailView` (`domain/coachSummary.ts:188-201`) fait qu'un
  pull-to-refresh raté **ne vide pas** l'écran : on garde le dernier contenu
  valide et on prévient par un toast.
- L'intégrité est vérifiée à la lecture : si le document lu ne décrit pas
  exactement le joueur demandé, il est rejeté (`repositories/clubsRepo.ts:321-323`).

Ces trois choses sont pures et testées. Elles se réutilisent telles quelles.

### 3.5 Le tri par priorité

`sortCoachSummaries` (`domain/coachSummary.ts:294-325`) remonte en haut ce qui
demande une action : À relancer, puis Sans séance, puis Prête, puis Adaptée,
puis Faite. Égalité → prénom, puis identifiant, donc **ordre stable** : la liste
ne saute pas d'un rafraîchissement à l'autre. Le principe est le bon ; seuls les
critères devront évoluer.

### 3.6 Les états honnêtes

L'app distingue trois situations et refuse de les confondre
(`domain/coachSummary.ts:411-419`) : lecture impossible, club réellement vide,
et liste disponible. Si une seule lecture échoue, l'écran affiche "indisponible"
plutôt qu'une demi-liste présentée comme complète
(`repositories/clubsRepo.ts:300-308`). Et les joueurs dont la fiche n'est pas
encore prête sont comptés dans un bandeau neutre, sans aucun identifiant
technique (`screens/CoachHomeScreen.tsx:331-346`).

C'est exactement la bonne doctrine : mieux vaut dire "je ne sais pas" que
d'afficher un zéro qui ment.

### 3.7 Le socle visuel est déjà conforme

Les écrans coach passent par `ScreenContainer`, qui délègue à `<Screen>`
(`components/ui/ScreenContainer.tsx:15-19`). La règle d'or du projet est donc
respectée : aucune safe area bricolée à la main, aucune barre de statut locale.

---

## 4. La matrice de vérité

Les 9 questions que le coach doit pouvoir traiter en moins de 30 secondes,
confrontées à ce que l'app sait réellement aujourd'hui.

*(Le brief en énonce 8 formulations ; "qui a adapté ou sauté" en contient deux —
adapter et sauter sont deux gestes différents — d'où 9 lignes.)*

| # | Question du coach | Aujourd'hui | Pourquoi, et avec quel champ |
|---|---|---|---|
| 1 | **Qui s'est entraîné ?** | Partiel | Seule `lastActivity.dateKey` existe : **une** date, la plus récente (`functions/src/projector.ts:159-161`). On sait "quand la dernière fois", jamais "combien de fois". |
| 2 | **Qui n'a pas fait sa séance ?** | Partiel, et faux dans un cas fréquent | `sessionStatusLabel = "À relancer"` (`domain/coachSummary.ts:270`) exige à la fois aucune planifiée future **et** plus de 7 jours d'inactivité. Une séance générée non faite éteint l'alerte pour toujours (P0-1). |
| 3 | **Qui a adapté sa séance ?** | Impossible | Aucun champ d'exécution dans le contrat serveur (`functions/src/dto.ts:37-47`). `adaptation.adapted` décrit le **moteur**, pas le joueur. |
| 4 | **Qui a sauté des exercices ?** | Impossible | Idem : rien n'est projeté au niveau de l'exercice. |
| 5 | **Qui suit bien ?** | Impossible | Il faudrait un historique de dates ; il n'y a qu'une date unique (`domain/coachSummary.ts:31-34`). |
| 6 | **Ce qui était prévu vs ce qui a été fait** | Impossible | Un seul emplacement `latestSession`, arbitré par `pickCoachSessionToDisplay` (`functions/src/coachLabels.ts:239-262`) : planifiée **ou** faite, jamais les deux. |
| 7 | **Pourquoi le programme a été adapté** | Partiel, et ambigu | `adaptation.labels[]` existe et est traduit en langage terrain (`functions/src/coachLabels.ts:45-115`). Mais la liste affichée sur la liste principale est tronquée au premier label (`screens/CoachHomeScreen.tsx:504`), le mot "Adaptée" ment sur l'auteur du changement (P0-2), et un des labels révèle indirectement une donnée de santé (cf. `SECURITE_A_TRANCHER.md`, S3). |
| 8 | **Qui nécessite une vérification humaine aujourd'hui ?** | Partiel | Un seul signal existe, "À relancer", et il est atteint par le défaut P0-1. Aucune notion de "données incomplètes" ni de niveau intermédiaire. |
| 9 | **Ce qui s'est passé cette semaine** | Impossible, et actuellement trompeur | Le bulletin colle un vrai libellé de semaine à des compteurs qui ne sont bornés à aucune semaine (`domain/coachSummary.ts:388-409`). Il **paraît** répondre, ce qui est pire que de ne pas répondre. |

**Lecture d'ensemble : 0 question sur 9 est pleinement traitée aujourd'hui.**
4 sont impossibles par contrat de données, 4 sont partielles, 1 est
activement trompeuse. Ce n'est pas un problème d'écran : c'est un problème de
ce que le serveur envoie.

---

## 5. Les données disponibles aujourd'hui — liste exhaustive

Voici **tout** ce que le coach reçoit par joueur. Le contrat serveur est
`functions/src/dto.ts:37-47`, sa copie front est `domain/coachSummary.ts:42-52`.

### Identité

| Champ | Type | Origine, contrainte |
|---|---|---|
| `playerUid` | texte | identifiant du joueur |
| `firstName` | texte ou vide | prénom nettoyé, 40 caractères max (`functions/src/coachLabels.ts:207-219`) |
| `ageCategory` | U13 / U15 / U17 / U18 / Senior, ou vide | liste fermée (`functions/src/coachLabels.ts:34-41`) |
| `position` | Gardien / Defenseur / Milieu / Attaquant, ou vide | liste fermée (`functions/src/coachLabels.ts:191`) |
| `level` | Amateur / Regional / National / Semi-pro / Pro, ou vide | liste fermée (`functions/src/coachLabels.ts:192`) |
| `profileComplete` | oui/non | calculé (`functions/src/projector.ts:145`) — **jamais affiché** |

### La séance affichée (une seule, `latestSession`)

| Champ | Type | Note |
|---|---|---|
| `dateKey` | "AAAA-MM-JJ" ou vide | date absolue, sans horloge |
| `title` | texte ou vide | dérivé **uniquement** du focus, jamais du titre saisi côté client (`functions/src/coachLabels.ts:186-188`) |
| `focusLabel` | texte ou vide | liste fermée de 9 focus (`functions/src/coachLabels.ts:160-170`) |
| `intensityLabel` | Légère / Modérée / Intense / Très intense, ou vide | `functions/src/coachLabels.ts:141-154` |
| `durationMin` | 1 à 240, ou vide | `functions/src/coachLabels.ts:222-225` |
| `blockCount` | entier 1 à 20, ou vide | `functions/src/coachLabels.ts:228-231` |
| `status` | planned / done / unknown | liste fermée |

### La dernière activité (`lastActivity`)

| Champ | Type | Note |
|---|---|---|
| `dateKey` | "AAAA-MM-JJ" ou vide | dernière séance réellement terminée |
| `durationMin` | 1 à 240, ou vide | **déclarée** par le joueur, pas chronométrée (`functions/src/projector.ts:103`) |

### L'ajustement moteur (`adaptation`)

| Champ | Type | Note |
|---|---|---|
| `adapted` | oui/non | vrai si au moins un label (`functions/src/projector.ts:172`) |
| `labels[]` | jusqu'à 12 phrases | traduites depuis les garde-fous moteur, liste fermée ; tout jeton inconnu est **supprimé**, jamais recopié (`functions/src/coachLabels.ts:113-114`) |

### Enveloppe technique (ignorée par le front)

`sourceEventAt`, `sourceEventTime`, `sourceEventId`, `updatedAt`
(`functions/src/dto.ts:50-59`) : servent uniquement à ordonner les
reconstructions et à éviter qu'un vieil événement écrase un plus récent
(`functions/src/rebuild.ts:78-95`).

### Au niveau du club (hors joueur)

- `clubs/{clubId}` : nom, code d'invitation, owner, type d'équipe
  (`repositories/clubsRepo.ts:346-354`).
- `clubs/{clubId}/weekContexts/{semaine}` : intensité club, objectif, note
  libre, match ce week-end (`repositories/clubsRepo.ts:357-401`).

### Deux limites de collecte, à connaître

1. Le serveur ne relit que les **8 séances les plus récentes** de chaque
   sous-collection (`functions/src/config.ts:25`).
2. Une séance sans champ `date` n'est **pas** renvoyée par la requête
   (`functions/src/config.ts:18-25`, `functions/src/rebuild.ts:35`). Limite
   connue et assumée.

---

## 6. Ce que la boucle de suivi joueur va apporter

Une autre branche, non encore fusionnée (`claude/player-tracking-loop-559906`),
fait déjà remonter **côté joueur** ce qui a réellement été exécuté. Elle
n'ajoute pas une ligne dans les fichiers coach — c'est voulu.

Elle attache à chaque séance terminée un objet `execution` dont voici les
parties utiles au coach (source : `domain/tracking/types.ts:53-116` de cette
branche) :

- **Par exercice** : un statut `done` / `adapted` / `skipped` / `replaced` /
  `unknown`, et une raison prise dans une liste fermée : `time`, `equipment`,
  `too_difficult`, `fatigue`, `pain`, `technical`, `space`, `no_partner`,
  `other`.
- **Pour la séance entière** : un pourcentage d'accomplissement, un statut
  `full` / `partial` / `abandoned`, les compteurs done / adapted / skipped /
  replaced, et les raisons dominantes (3 max).

Ce que ça débloque, question par question :

| Question | Débloquée par |
|---|---|
| Qui a adapté sa séance ? (Q3) | compteur `adapted` |
| Qui a sauté des exercices ? (Q4) | compteur `skipped` |
| Prévu vs fait (Q6) | pourcentage + statut d'accomplissement |
| Pourquoi (Q7), côté joueur | raisons dominantes, traduites |
| Vérification humaine (Q8) | un abandon ou un taux très bas = signal clair |

**Attention, et c'est central : deux de ces raisons sont des données de santé.**
`pain` et `fatigue` ne doivent **jamais** arriver au coach, ni directement, ni
par déduction. C'est pour ça que la traduction serveur doit envoyer `pain`,
`fatigue`, `other` **et tout jeton inconnu** vers exactement le même libellé
neutre "Autre raison". Si "Autre raison" avait un sens unique, un coach
pourrait déduire par élimination qu'il s'agit d'une douleur — et on aurait
recréé une fuite de santé sans l'avoir décidé.

**Règle de cohabitation** : notre code doit fonctionner à l'identique **avant**
et **après** la fusion de cette branche. Tout champ qui en provient est
facultatif, et son absence est l'état normal d'aujourd'hui — pas une erreur, pas
un écran vide, pas un point d'interrogation rouge.

---

## 7. Les 3 pièges produit à connaître

### Piège 1 — "Adaptée" veut dire "FKS a allégé", pas "le joueur a modifié"

Le champ vient des garde-fous du moteur (`functions/src/projector.ts:83-88`,
`107`, `156`). Il décrit une décision de **l'app**, prise avant que le joueur
ne commence.

Le mot affiché doit le dire sans ambiguïté : quelque chose comme
**"Séance ajustée par FKS"**. Et il faut réserver le vocabulaire "adapté" et
"sauté" à ce que **le joueur** a fait, quand la boucle de suivi arrivera. Sinon
les deux notions vont se confondre dans la tête du coach exactement au moment
où on aura enfin les deux.

### Piège 2 — Le bulletin hebdo mélange deux horloges

Détaillé en P0-3. La leçon générale : **un libellé de période crée une promesse
de période.** Si on écrit "cette semaine", tout ce qui suit doit être calculé
sur cette semaine précise, sinon il ne faut pas écrire "cette semaine".

Corollaire d'architecture : ce calcul de semaine se fait **côté front**, avec
l'horloge du coach. Le serveur, lui, n'a pas d'horloge et ne doit pas en avoir
(`functions/src/projector.ts:41-42`). Il envoie des faits datés ; le front dit
"c'est cette semaine" ou "c'était il y a 3 jours". C'est ce qui garantit qu'un
coach en France et un serveur en Belgique ne se contredisent pas sur ce qu'est
"aujourd'hui".

### Piège 3 — Un signal dérivé de la douleur circule DÉJÀ vers le coach

`functions/src/coachLabels.ts:51-54` traduit tout jeton contenant `injury:`,
`pain`, `douleur` ou `blessure` en une seule phrase :
**"Adaptation sécurité appliquée"**.

Cette phrase est affichée en clair sur la fiche joueur
(`screens/CoachPlayerDetailScreen.tsx:246-252`) et, quand elle est le premier
label, en "Note FKS" sur la liste principale (`screens/CoachHomeScreen.tsx:504`,
`538-543`).

La valeur brute (quelle douleur, où, quelle intensité) ne sort pas — le filtre
fonctionne. Mais **la présence même du label** révèle, pour une personne
nommée, qu'un problème physique a été déclaré. C'est une donnée de santé
dérivée, et ce canal existe en production sans avoir jamais été décidé ni
documenté comme tel.

Ce n'est pas corrigé par ce chantier. C'est documenté séparément, pour ta
décision, dans `SECURITE_A_TRANCHER.md` (point S3).

---

## 8. L'architecture proposée, et pourquoi

Trois briques, dans cet ordre.

### 8.1 Étendre la projection serveur — uniquement sur du non sensible

Quatre ajouts, tous facultatifs :

| Ajout | Ce que c'est | Question débloquée |
|---|---|---|
| `activity.doneDateKeys[]` | jusqu'à 14 dates de séances réellement terminées, tri décroissant | Q1, Q5, Q9 |
| `lastPlanned` | la dernière séance **planifiée**, telle quelle | Q2, Q6 |
| `lastDone` | la dernière séance **faite**, telle quelle | Q2, Q6 |
| `execution` | l'exécution de cette dernière séance faite | Q3, Q4, Q6, Q7, Q8 |

Trois principes gouvernent ces ajouts.

**Principe 1 — le serveur n'a pas d'horloge, et ça reste vrai.** On envoie une
**liste de dates**, jamais un compteur du type "3 séances cette semaine". Parce
qu'un compteur suppose de savoir quand est "cette semaine", donc de savoir quelle
heure il est, donc d'avoir un fuseau horaire — et le serveur n'en a pas. Il
n'envoie que des faits datés, comme une feuille de match : "le 12, le 15, le
18". C'est le front, avec l'horloge du coach, qui en tire "3 fois cette semaine".
Aucun champ du genre `next`, `recent`, `isLate` ou `daysSince` ne doit exister
côté serveur.

**Principe 2 — `lastPlanned` et `lastDone` cohabitent au lieu de se disputer une
case.** C'est la correction directe de P1-1 et P0-1. `latestSession` reste
inchangé pour la compatibilité des versions déjà installées : on ne casse
personne, on ajoute à côté.

**Principe 3 — la traduction des raisons est une porte à sens unique.**
`pain`, `fatigue`, `other` et tout jeton inconnu produisent **exactement** le
même libellé "Autre raison". Non pas par paresse de traduction, mais pour que
la fonction ne soit **pas inversible** : à partir du libellé affiché, on ne peut
pas remonter à la raison d'origine. C'est ce qui empêche la déduction par
élimination décrite en §6. Cette propriété doit être prouvée par un test, pas
seulement écrite en commentaire.

### 8.2 Une couche de lecture pure côté front — `domain/coachView`

Aujourd'hui, l'interprétation est éparpillée : un peu dans `coachSummary.ts`, un
peu dans l'écran (le calcul de `todayKey` en `screens/CoachHomeScreen.tsx:104`,
la fonction `statusTone` en `285-286`, la construction de la ligne en `505-513`).

On rassemble tout ce qui est **calcul** dans un module de domaine pur : pas de
Firestore, pas de React, pas d'horloge implicite — la date du jour est un
paramètre. C'est ce qui rend le tout testable sans lancer l'app, et c'est ce qui
permet de prouver noir sur blanc les règles de statut.

Ce module portera notamment la **hiérarchie de statut à 4 niveaux**, stable :

| Niveau | Libellé affiché | Sens |
|---|---|---|
| `normal` | Rien à signaler | tout va bien |
| `watch` | À surveiller | signal léger, ou données incomplètes |
| `check` | À vérifier | signal clair, un humain doit regarder |
| `unknown` | Indisponible | on n'a pas de quoi conclure |

Pas de niveau "critique" : on ne fait pas de diagnostic. Et jamais un niveau
élevé sur un seul indicateur isolé — un joueur qui saute un exercice n'est pas
"à vérifier", un joueur qui abandonne trois séances d'affilée, oui.

Chaque niveau s'affiche avec **texte + icône + libellé**, jamais par la couleur
seule (correction de P2-1), et chaque signal s'accompagne d'une phrase courte qui
répond à "pourquoi ?".

Et chaque information porte sa **provenance** : déclaré par le joueur / mesuré à
l'exécution / décidé par le moteur FKS / calculé par l'app / absent. Une
estimation ne s'affiche jamais comme une mesure (correction de P0-5).

### 8.3 Une vraie barre d'onglets coach

Aujourd'hui, tout est empilé dans un seul écran avec un sélecteur à 3 segments
(`screens/CoachHomeScreen.tsx:82-87`), et le coach doit faire défiler par-dessus
un en-tête, une carte de chiffres et un bulletin avant d'atteindre le contenu
utile.

Une barre d'onglets sépare des **intentions** différentes — "où en est mon
groupe aujourd'hui ?", "qui est dans mon effectif ?", "quel cadre pour la
semaine ?" — au lieu de les empiler dans un même flux vertical. Chaque onglet
garde sa propre position de défilement, et l'objectif "moins de 30 secondes"
devient tenable : le coach ouvre l'app et il est déjà là où il doit être.

### 8.4 Pourquoi dans cet ordre

Redessiner l'écran d'abord serait du maquillage : les questions Q3 à Q6 sont
impossibles **par contrat de données**, aucune UI ne les débloquera. On étend
donc la projection, on met le calcul dans un module pur et testable, et l'écran
vient en dernier — il ne fait qu'afficher ce qui a déjà été décidé et prouvé
ailleurs.

---

## 9. Les fichiers concernés

### Côté serveur (Cloud Functions)

| Fichier | Rôle | Touché ? |
|---|---|---|
| `functions/src/dto.ts` | contrat de la projection + verrou anti-fuite | oui, ajouts facultatifs |
| `functions/src/projector.ts` | fabrique la projection, sans horloge | oui |
| `functions/src/coachLabels.ts` | traductions à liste fermée | oui (traduction des raisons) |
| `functions/src/rebuild.ts` | reconstruction transactionnelle | probablement non |
| `functions/src/triggers.ts` | déclencheurs | non |
| `functions/src/config.ts` | limites de lecture | à revoir si l'historique de 14 dates l'exige |
| `functions/src/watermark.ts` | ordonnancement des événements | non |

### Côté front

| Fichier | Rôle | Touché ? |
|---|---|---|
| `domain/coachSummary.ts` | contrat + parseur défensif + statuts | oui |
| `domain/coachView/*` | **nouveau** — couche de lecture pure | création |
| `domain/coachLabels.ts` | libellés statiques front | oui |
| `repositories/clubsRepo.ts` | lectures coach-safe | peu ou pas |
| `screens/CoachHomeScreen.tsx` | écran principal | oui |
| `screens/CoachPlayerDetailScreen.tsx` | fiche joueur | oui |
| `screens/CoachOnboardingScreen.tsx` | création de club | marginal |
| `components/coach/coachUi.tsx` | design system local coach | oui |
| `navigation/RootNavigator.tsx` | pile coach → barre d'onglets | oui |

### Interdits absolus de ce chantier

- `firestore.rules` — **aucune** modification, aucun assouplissement.
- `domain/types.ts`, `state/stores/persistHelpers.ts`,
  `schemas/firestoreSchemas.ts`, `state/orchestrators/applyFeedback.ts` — ces
  quatre fichiers sont modifiés par la branche boucle de suivi ; y toucher
  créerait des conflits de fusion pénibles.
- `screens/newSession/**` et `services/aiContext.ts` — le moteur de génération
  n'est pas notre sujet.

---

## 10. Ce qu'on ne fait PAS dans ce chantier, et pourquoi

**On n'ouvre aucune donnée de santé au coach.** Douleur et fatigue restent
interdites, y compris sous forme d'indice ou de moyenne. Ce n'est pas une
limitation technique, c'est la promesse qui rend l'app acceptable dans un club
de mineures. Conséquence directe : l'aperçu qui promet "ressenti agrégé"
(`screens/CoachHomeScreen.tsx:311`) doit être réécrit, pas implémenté.

**On ne touche pas aux règles Firestore.** Elles sont testées, déployées, et
c'est le mur porteur de la frontière coach-safe. Une refonte d'interface n'a
aucune raison d'y toucher.

**On ne fait pas de score de risque, ni de prédiction de blessure.** On ne peut
pas prédire une blessure à partir de "a sauté 2 exercices", et prétendre le
contraire nous mettrait en position de conseil médical devant un club. Le
niveau maximum reste "à vérifier" : *un humain doit regarder*, pas *cet enfant
est en danger*.

**On ne fait pas de classement entre joueurs.** Un tableau qui range les joueurs
du meilleur au pire, dans un club amateur avec des mineurs, est une bombe
sociale. Le tri par priorité d'action ("qui a besoin de moi maintenant") n'est
pas un classement — c'est une file d'attente, et elle change tous les jours.

**On ne donne pas au coach la main sur les séances.** Il pose le cadre de la
semaine, FKS construit la prépa. C'est la promesse commerciale et elle est déjà
tenue par les règles (`firestore.rules:112-116` : le coach écrit le cadre, jamais
une séance).

**On ne corrige pas les 3 points de sécurité découverts pendant l'audit.** Ils
sont d'une autre nature — ils touchent aux règles, à la conformité mineurs et à
une décision produit sur la donnée de santé. Ils sont documentés dans
`SECURITE_A_TRANCHER.md` pour ta décision.

**On ne dépend pas de la fusion de la boucle de suivi.** Notre code marche avant
et après, sans une ligne de changement. Ce qui vient de la boucle est facultatif,
et son absence est un état normal — pas une panne.
