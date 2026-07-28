# Autorisation d'accès aux données de suivi d'un joueur

_Pilote coach FKS — juillet 2026._
_Pour Kyllian : français simple, analogies foot, et à chaque affirmation le fichier et la ligne qui le prouvent._

---

## 0. Ce qui a changé (27 juillet 2026) — À LIRE EN PREMIER

Le mécanisme décrit dans les sections suivantes posait `pending` à **tout joueur
U13 / U15** au moment où il rejoignait un club. Sur le papier, c'était prudent.
Dans la réalité du pilote, c'était **une panne** :

> **Il n'existe aucun écran d'approbation dans l'application.** Le seul moyen de
> lever un `pending` est d'ouvrir la console Firebase et de modifier le document
> à la main. Un club U15 qui distribue FKS à ses joueuses sans suivi
> administratif voyait donc un **effectif entièrement vide** — c'est exactement
> le pilote de Laurent.

Un verrou dont personne n'a la clé n'est pas une protection : c'est une porte
soudée. **Kyllian a tranché** : le verrou d'âge est retiré, et remplacé par une
**politique portée par le club, configurable, décidée côté serveur**.

### La doctrine du pilote, en clair

| Point | Décision |
|---|---|
| Mode par défaut | `automatic_safe_projection` |
| Un joueur rejoint volontairement avec un code **valide** | sa projection coach **non sensible** s'active, sans validation administrative |
| Confirmation d'âge par le coach | **aucune** |
| Blocage de l'onboarding, des séances, de l'usage autonome | **aucun** |
| `revoked` | refuse **toujours** l'accès, dans tous les modes |
| Valeur d'état inconnue ou invalide | **refuse toujours** (fail-closed inchangé) |
| Mode alternatif `approval_required` | **existe, câblé et testé** — activé pour aucun club pilote |
| Politique absente ou illisible | défaut serveur, **défini et testé sans le front** |
| Le joueur peut-il changer la politique ? | **non**, les règles Firestore le refusent |
| Le joueur est-il informé ? | **oui**, au moment où il saisit son code |

### Le champ

```
clubs/{clubId}.joinAccessPolicy
```

> **Renommé le 27/07 — le nom dit maintenant la portée.** Ce champ s'appelait
> `coachAccessPolicy`. Le nom laissait croire qu'il gouvernait « l'accès du
> coach » en général, donc **aussi celui des membres déjà rattachés**. C'est
> faux, et ça l'a toujours été : il ne décide que de l'état posé **à l'entrée**.
> Il s'appelle donc `joinAccessPolicy` — la politique du **rattachement**.
>
> **Aucun chemin de compatibilité** avec l'ancien nom n'a été écrit, et c'est
> délibéré : rien n'est déployé, aucun club n'existe en base. Un repli qui
> relirait l'ancien nom serait du code mort laissant croire à une migration qui
> n'a jamais eu lieu.
>
> **La phrase à afficher**, au mot près, le jour où un réglage existera :
> « S'applique aux prochains joueurs qui rejoignent le club »
> (`domain/joinAccessPolicy.ts`, `JOIN_ACCESS_POLICY_SCOPE_LABEL`, verrouillée
> par un test d'égalité stricte). **Il n'existe aujourd'hui aucun écran** où ce
> réglage se change : on n'a pas fabriqué une interface pour y poser une phrase,
> on a posé la phrase, testée, prête à l'emploi.

Deux valeurs, et rien d'autre (`functions/src/joinAccessPolicy.ts`) :

| Valeur | État posé au rattachement | Le coach voit le suivi ? |
|---|---|---|
| `automatic_safe_projection` (**défaut**) | `not_required` | oui |
| `approval_required` | `pending` | non, tant qu'une décision humaine n'est pas prise |

> **Analogie foot.** Avant, le règlement disait : « tout joueur de moins de 15
> ans doit passer devant la commission ». Sauf que la commission n'existait pas
> et ne s'était jamais réunie. Résultat : aucun jeune sur la feuille de match.
> Maintenant, **chaque club choisit son règlement**. Par défaut : le joueur qui
> présente une licence valable (le code d'invitation) entre. Le club qui veut une
> commission peut en avoir une — le bouton existe, il n'est juste allumé nulle part.

### Défaut ≠ fail-closed : ne pas confondre les deux verrous

C'est le point qu'un lecteur pressé va mal lire, donc il est dit deux fois :

- **la POLITIQUE d'un club** — absente, vide, inconnue, mal typée → **défaut**
  (`automatic_safe_projection`). C'est un arbitrage produit : 99 % des clubs
  n'ont jamais entendu parler de ce champ, ils obtiennent le mode pilote ;
- **l'ÉTAT d'un joueur** (`coachAccess`) — absent, vide, `"APPROVED"`, `true`,
  `1`, `{}` → **REFUS**. Ça, c'est fail-closed, et **rien n'a bougé**.

Autrement dit : le doute sur la **configuration d'un club** se résout par le mode
nominal ; le doute sur l'**autorisation d'un joueur** se résout par le refus.
Vérifié des deux côtés : `functions/tests/joinAccessPolicy.test.ts`
(« le defaut de la POLITIQUE n'assouplit pas le default-deny de l'ETAT »).

### Le verrou d'âge a réellement disparu du chemin de décision

Pas « neutralisé », pas « désactivé par un drapeau » : **retiré**.

- `initialCoachAccess` ne prend plus qu'une politique
  (`functions/src/coachAccess.ts`) ;
- le module de décision n'importe plus rien de `coachLabels` — un test lit le
  fichier et échoue si `ageCategory` / `AgeCategory` / `normalizeAgeCategory`
  y réapparaissent ;
- au rattachement, **le document `users/{uid}` n'est plus lu du tout**
  (`functions/src/inviteCodes.ts`, transaction de `joinClubWithCode`). La donnée
  n'entre pas dans la transaction : elle ne peut donc pas peser sur la décision,
  même par accident. Un test instrumente les lectures pour le prouver ;
- un mineur et un adulte, mêmes conditions, obtiennent le **même état** — testé
  au niveau du module, du rattachement et du script de mise à niveau.

### Changer la politique ne redistribue PAS les accès existants

Décision explicite, et c'est le point le plus délicat du lot.

`resolveCoachAccess` conserve désormais **tout état déjà posé et valide** —
`pending`, `approved`, `revoked` **et** `not_required`. La politique ne joue que
quand il n'y a **aucun** état lisible (membership ancien, valeur corrompue).

**Conséquence assumée** : un club qui bascule en `approval_required` **ne perd
pas** la visibilité sur ses membres déjà rattachés ; elle ne s'applique qu'aux
joueurs qui rejoignent **après** le changement. Symétriquement, repasser en mode
par défaut **n'ouvre pas** d'un coup les accès laissés en attente.

**Pourquoi ce sens-là et pas l'inverse.** Le trigger `onUserWritten` s'exécute à
chaque enregistrement de profil. Si la politique était réappliquée à chaque
passage, un coach qui coche « approbation requise » un mardi soir verrait son
effectif se vider tout seul, joueur par joueur, au fil des sauvegardes de profil
des jours suivants — sans écran pour l'expliquer, et sans moyen de revenir en
arrière autrement qu'en console. Ce serait la **même panne qu'on vient de
corriger, dans l'autre sens**. Une révocation reste possible et explicite :
c'est `revoked`, posé joueur par joueur (§7.4).

**Prouvé sur le chemin réel, pas seulement sur la fonction pure.**
`functions/tests/joinAccessPolicyScope.test.ts` monte un club dont l'effectif
porte les quatre états (`approved`, `pending`, `revoked`, `not_required`) plus
deux cas limites, bascule la politique, puis **rejoue le chemin de resynchro**
— celui qu'emprunte le trigger `onUserWritten` à chaque enregistrement de
profil, c'est-à-dire précisément celui qui aurait pu tout balayer. Le magasin de
test **écrit réellement** dans son état : une écriture silencieuse ferait tomber
la comparaison avant/après. Résultat : aucun état ne bouge, **zéro écriture**, et
le script de mise à niveau lancé après la bascule ne referme rien non plus. Le
même test prouve la contrepartie — un joueur qui rejoint **après** obtient bien
`pending`.

#### Action groupée sur les membres existants : pas maintenant, et pourquoi

Fermer d'un coup les accès déjà ouverts d'un club **n'existe pas** aujourd'hui.
Ce n'est pas un oubli :

1. **ça ne doit jamais être un effet de bord.** Si changer un réglage refermait
   l'effectif, on retomberait exactement sur la panne de juillet — un coach coche
   une case, son effectif se vide, personne ne sait pourquoi ;
2. **une fermeture en masse est irréversible en l'état.** Il n'existe aucun écran
   d'approbation : ce qui passe en `pending` y reste jusqu'à une intervention en
   console. Distribuer ça à tous les membres d'un club d'un seul geste serait
   irresponsable tant que l'écran d'en face n'existe pas ;
3. **le besoin n'est pas prouvé.** Aucun club pilote n'est en
   `approval_required`, et personne n'a demandé à refermer un effectif entier.

Le jour où ce sera nécessaire, ce sera une **commande administrateur nommée**, du
même genre que la mise à niveau des membership et la migration des notes :
simulation par défaut, double confirmation, compteurs sans identifiants, et une
vérification à lancer après coup. Pas une case à cocher. En attendant, la
fermeture d'un accès existant est un geste explicite, joueur par joueur (§7.4) —
et un test vérifie qu'aucun module de ce lot n'expose une fonction d'application
groupée.

### Ce que ça n'ouvre pas

La projection reste **coach-safe**. Douleur, fatigue, zone corporelle,
commentaire libre, ressenti, RPE, ATL/CTL/TSB ne sont **jamais** transmis, quel
que soit le mode (`functions/src/dto.ts` : `FORBIDDEN_KEYS`,
`SENSITIVE_KEY_ROOTS`, garde-fou `assertCoachSafe`). Ce lot déplace un
interrupteur d'affichage ; il ne touche pas à la frontière des données sensibles.

### Ce que le joueur voit maintenant

Là où il saisit son code — setup de profil (`screens/ProfileSetupScreen.tsx`,
étape 0) et carte « Mon club » (`components/settings/ClubManagementCard.tsx`) —
un encart liste **ce que son encadrement verra** et **ce qu'il ne verra jamais**
(`domain/clubDataDisclosure.ts`, `components/club/ClubDataDisclosure.tsx`).

Il **informe** : aucune case à cocher, aucun bouton, aucune condition. Il ne peut
pas empêcher de rejoindre un club, ni retarder l'onboarding. Son contenu est
arrimé au contrat réel par un test : ajouter un champ à la projection sans
l'annoncer au joueur fait échouer la suite.

### Le risque restant, sans le noyer

Il faut le dire franchement, parce que c'est la contrepartie du choix :

1. **L'âge reste déclaratif, et plus rien ne s'en sert.** Avant, une catégorie
   `U15` déclarée déclenchait au moins une friction. Maintenant, elle ne
   déclenche rien. Ce n'est pas une perte de garantie réelle — la garantie
   n'existait pas, puisque la friction était infranchissable et que l'âge était
   de toute façon saisi par le joueur lui-même — mais **la friction affichée a
   disparu**. Assumons-le tel quel.
2. **Ce mécanisme ne règle RIEN juridiquement.** Il ne prouve aucun consentement,
   ne dit pas qui a autorisé quoi, ne conserve aucune trace opposable, et ne
   remplace ni un document signé, ni une information des familles, ni une
   politique de confidentialité, ni un registre de traitement. La question du
   consentement des mineurs reste **entièrement ouverte** (§6, §9).
3. **Le mode `approval_required` reste sans écran.** Un club qui l'active
   condamne ses joueurs à `pending` jusqu'à une intervention en console. C'est
   documenté (§7.3), et c'est précisément pourquoi il n'est le défaut de
   personne.

---

## 1. Le problème d'origine, en une phrase

> **Historique.** Cette section décrit la situation **avant** le 27 juillet 2026.
> Le mécanisme d'interrupteur qu'elle motive existe toujours ; c'est seulement
> ce qui décide de sa position à l'entrée qui a changé (§0).

Le pilote compte des U15. Jusqu'ici, **rien côté serveur** n'empêchait un coach de
voir le suivi d'un joueur mineur. Le seul garde-fou vivait sur **l'écran de setup
du profil**, côté téléphone : `screens/ProfileSetupScreen.tsx` bloquait le bouton
tant qu'une case n'était pas cochée (`domain/parentalConsent.ts:40`,
`isParentalConsentBlocking`).

Un verrou sur l'écran, c'est un arbitre qui siffle mais qui n'a pas de carton. Il
suffisait de ne pas passer par cet écran :

- un profil **créé avant** l'ajout de la case n'a jamais rencontré le blocage ;
- un profil dont la catégorie d'âge est renseignée **après** le rattachement ;
- un profil écrit par un autre chemin.

Et le projecteur serveur, lui, ne posait **aucune** question :
`functions/src/projector.ts` construisait la projection coach à partir du
membership et du profil, **sans jamais lire** la moindre preuve d'autorisation.
La catégorie d'âge (`U15`) était même **projetée et affichée au coach**
(`functions/src/projector.ts:351`).

---

## 2. Ce qui a été ajouté : un interrupteur, côté serveur

Un seul champ, sur le document de membership :

```
clubs/{clubId}/members/{playerUid}.coachAccess
```

Quatre valeurs, et rien d'autre — vocabulaire **produit**, volontairement neutre
(`functions/src/coachAccess.ts:39`) :

| Valeur | Ce que ça veut dire | Le coach voit le suivi ? |
|---|---|---|
| `pending` | une étape reste à faire | **non** |
| `approved` | l'étape a été faite | oui |
| `revoked` | l'accès a été retiré | **non** |
| `not_required` | aucune étape supplémentaire n'était requise | oui |

**Aucun mot juridique dans le code.** Pas de « consentement », pas de
« parental », pas de « RGPD », pas de « tuteur ». Ce champ ne prétend pas dire ce
qui est légal : il dit si l'affichage est ouvert ou fermé.

### Les trois notions restent séparées

C'est le point le plus important, et c'est ce qui rend le mécanisme lisible :

1. **Être dans l'effectif** = le document `members/{playerUid}` existe ;
2. **Être consultable par le coach** = le champ `coachAccess` ;
3. **L'étape supplémentaire d'un mineur** = ce qui fait passer de `pending` à `approved`.

> **Analogie foot.** Le joueur est **licencié au club** (1) : il s'entraîne, il
> joue, tout va bien. Mais il n'est pas encore **qualifié pour la feuille de
> match** (2). Ce sont deux tampons différents, sur deux papiers différents. Un
> joueur peut très bien être licencié sans être qualifié — et ça ne veut pas dire
> qu'il ne s'entraîne pas.

Conséquence assumée : **un mineur est membre du club sans être consultable**,
tant que l'étape n'a pas été faite. Ce n'est pas un bug, c'est le cas nominal.

---

## 3. Default-deny : le doute ferme la porte

Toute valeur **absente, vide, mal orthographiée, mal typée ou inconnue** refuse
l'accès (`functions/src/coachAccess.ts:71`, `isCoachAccessGranted`).

C'est ce qui protège les **membership anciens** : ceux écrits avant l'existence
du champ n'ouvrent **rien**. Sans cette règle, tout le pilote actuel serait passé
au travers du nouveau verrou le jour de son déploiement.

**Ce verrou-là n'a pas bougé le 27 juillet.** Ce qui a changé, c'est ce qui
décide de l'état posé **à l'entrée** — voir §0. Au rattachement
(`functions/src/coachAccess.ts`, `initialCoachAccess`) :

- club en `automatic_safe_projection` (défaut) → `not_required` ;
- club en `approval_required` → `pending` ;
- politique absente ou illisible → **défaut serveur**, donc `not_required`.

> L'âge n'entre plus dans cette décision, et le profil du joueur n'est même plus
> lu pendant le rattachement.

---

## 4. Les quatre verrous (défense en profondeur)

Un seul verrou, ça se contourne. Quatre, il faut les franchir tous.

### Verrou 1 — Les règles Firestore (la base elle-même)

`firestore.rules:56` (fonction) et `firestore.rules:171` (usage) :

```
match /playerSummaries/{playerUid} {
  allow read: if isClubStaff(clubId) &&
    isPlayerMember(clubId, playerUid) &&
    isCoachAccessGranted(clubId, playerUid);
  allow write: if false;
}
```

C'est **la base de données** qui refuse, avant qu'un seul octet ne sorte. Même
une application modifiée, même un script, même le coach lui-même : refusé.

Le champ absent est traité par `.data.get("coachAccess", "")` : la valeur par
défaut `""` n'est pas dans la liste autorisante, donc **refus**. Vérifié contre
l'émulateur, pas supposé : `firestore-tests/rules.coachAccess.test.ts:91`.

### Verrou 2 — Le projecteur serveur (la donnée n'est même pas fabriquée)

`functions/src/projector.ts:341` : le refus est prononcé **avant** toute lecture
du profil et des séances. Rien n'est calculé.

Et surtout : quand le projecteur renvoie `null`, `rebuildPlayerSummary`
**SUPPRIME** la projection déjà en base (`functions/src/rebuild.ts:91`). Passer
un joueur en `revoked` ne se contente donc pas d'arrêter de produire : ça
**retire** ce qui existait déjà. Prouvé contre l'émulateur :
`functions/tests/integration/rebuild.emulator.test.ts` (« bascule approved →
revoked : la projection DÉJÀ ÉCRITE est SUPPRIMÉE »).

### Verrou 3 — Les Cloud Functions (qui pose l'état, et qui ne peut pas)

- **Au rattachement** : `functions/src/inviteCodes.ts` — la seule porte d'entrée
  dans un club (`joinClubWithInviteCode`) lit la politique **sur le document
  club déjà chargé** et écrit l'état initial, dans la même transaction que le
  membership. Aucune lecture supplémentaire, aucune lecture du profil joueur.
- **Réparation** : `functions/src/triggers.ts` (`onUserWritten`) →
  `ensureCoachAccessState` (`functions/src/coachAccessSync.ts`). Ce n'est **plus
  un recalcul** : c'est un filet qui pose l'état **s'il manque**, rien de plus.

`resolveCoachAccess` (`functions/src/coachAccess.ts`) obéit à **une seule
règle** :

1. tout état **déjà posé et valide** est conservé — `pending`, `approved`,
   `revoked` **et** `not_required` ;
2. seul un champ **absent ou illisible** reçoit l'état initial de la politique.

**Il ne peut JAMAIS produire `approved` tout seul**, ni retirer un accès, ni en
rouvrir un qui avait été fermé. Vérifié par un test qui essaie toutes les
combinaisons d'entrées (`functions/tests/coachAccess.test.ts`, « ne produit
JAMAIS approved »).

**Coût** : dans le cas courant (état déjà posé), la politique du club n'est même
**pas lue**. Un test compte les lectures pour le prouver.

### Verrou 4 — Les requêtes de lecture (l'app dit la vérité)

`repositories/clubsRepo.ts` distingue désormais **trois** situations qui étaient
auparavant confondues en une seule (« indisponible ») :

| État | Ce qui se passe | Ce que l'écran dit |
|---|---|---|
| **non autorisé** | décision serveur | « Suivi non accessible » |
| **pas encore préparé** | le serveur n'a pas fini | « Synchronisation en cours » |
| **erreur de lecture** | droits inattendus, réseau | « Chargement impossible » |

Pourquoi c'est important : un refus de règle Firestore remonte en
`permission-denied`, **strictement indiscernable** d'une coupure réseau. Le coach
aurait lu « on n'arrive pas à lire » là où la vérité est « ce joueur n'est pas
consultable ». L'app lit donc le champ **sur le membership** (qu'elle a le droit
de lire — c'est l'effectif, pas de la donnée de suivi) et ne demande même pas la
projection d'un joueur non autorisé.

---

## 5. Ce que voit le coach

L'interface **reflète**, elle ne décide pas. Rien n'est calculé côté téléphone.

- **Effectif** : un bandeau « N joueurs non consultables », distinct des bandeaux
  « en préparation » et « non lus » (`screens/coach/CoachRosterScreen.tsx:491`).
- **Effectif entièrement non consultable** : on **ne dit pas** « aucun joueur dans
  l'effectif ». Ce serait faux — les joueurs sont là.
- **Fiche joueur** : « Suivi non accessible », aucune donnée de suivi affichée
  (`components/coach/CoachEmptyState.tsx`, variante `accessRestricted`).

Trois règles de ton, testées :

1. **jamais alarmant** — niveau `unknown`, le neutre de la hiérarchie à 4 statuts
   existante ; aucune 5ᵉ couleur inventée ;
2. **jamais « il ne s'entraîne pas »** — le texte dit explicitement « il fait
   partie de l'effectif et peut s'entraîner normalement ». Un coach qui lit
   « aucune séance » prend une décision sportive fausse ;
3. **jamais juridique ni médical** — un test échoue si les mots « consentement »,
   « parental », « RGPD », « tuteur », « mineur » ou « santé » apparaissent
   (`domain/__tests__/coachAccess.test.ts`).

**Il n'y a volontairement PAS de bouton « approuver ».** Il n'existe aujourd'hui
aucun écran branché sur un chemin serveur d'approbation. Mettre un bouton qui ne
fait rien, ou qui ferait semblant, serait pire que pas de bouton. L'approbation
est une **procédure documentée** (§7), pas une fonctionnalité.

---

## 6. Ce que ce mécanisme garantit — et ce qu'il ne garantit pas

### Il garantit, techniquement

- Qu'un coach **ne peut pas lire** le suivi d'un joueur dont l'état n'est pas
  `approved` ou `not_required` — refus prononcé par la base de données.
- Qu'aucune projection **n'est produite** pour un tel joueur, et qu'une
  projection existante **est supprimée** quand l'état bascule.
- Qu'**aucun client** — ni le joueur, ni le coach, ni le propriétaire du club —
  ne peut poser, modifier ou effacer ce champ. Y compris par une mise à jour
  partielle, y compris en le supprimant.
- Qu'un membership **ancien**, sans le champ, n'ouvre rien.
- Qu'aucun automatisme ne peut produire `approved`.

### Il NE garantit PAS, juridiquement

Sois clair là-dessus, Kyllian, parce que c'est là que ça compte :

- **Ce n'est pas une preuve de consentement.** Le champ dit qu'un interrupteur a
  été mis sur « ouvert ». Il ne dit pas **qui** l'a demandé, **qui** l'a autorisé,
  ni si cette personne en avait le droit.
- **L'âge est déclaratif — et depuis le 27 juillet, il ne sert plus à rien ici.**
  La catégorie vient du joueur lui-même, au setup, et rien ne la vérifie. Elle
  n'entre plus du tout dans la décision d'accès (§0). Le mécanisme donne une
  garantie **d'interrupteur**, jamais **d'identité** ni **d'âge**.
- **Ça ne dit rien sur les données de santé.** Le fait que le coach ne voie ni
  douleur, ni fatigue, ni RPE relève d'un autre chantier (la frontière
  coach-safe). Ce verrou-ci ne le remplace pas.
- **Ça ne remplace pas un document signé**, ni une information des familles, ni
  une politique de confidentialité, ni un registre de traitement.
- **Ça n'efface rien.** Un joueur passé en `revoked` voit sa projection coach
  supprimée, mais ses propres données restent chez lui, intactes. C'est un verrou
  d'accès, pas une suppression.

### Ce qui reste à trancher (juridique ou contractuel)

| # | Question | Qui décide |
|---|---|---|
| 1 | Comment l'autorisation est-elle **recueillie** pour un mineur, et sous quelle forme conservée ? | Kyllian + conseil juridique |
| 2 | Faut-il **retirer les U13** de l'app plutôt que de les gérer ? (déjà envisagé ailleurs) | Kyllian |
| 3 | La **catégorie d'âge affichée au coach** (`U15` sur la fiche) est-elle acceptable, ou faut-il la retirer aussi ? | Kyllian |
| 4 | Qui, dans le club, a le droit de **demander** l'ouverture d'un accès ? | contrat club |
| 5 | Combien de temps un accès reste-t-il ouvert ? Faut-il le **repasser** chaque saison ? | Kyllian |
| 6 | Que se passe-t-il quand un joueur **quitte** le club : `revoked`, ou suppression du membership ? | produit |

Aucune de ces six questions ne se règle dans le code. Le code se contente de
respecter la décision une fois prise.

---

## 7. Procédure pilote — mise à niveau des joueurs déjà rattachés

> **RIEN N'A ÉTÉ EXÉCUTÉ.** Aucune donnée réelle n'a été lue ni modifiée dans ce
> chantier. Ce qui suit est une procédure à dérouler par un humain, en conscience.

### 7.1 La situation de départ

Les joueurs déjà dans un club **n'ont pas le champ**. Au déploiement, le
default-deny les rend donc **tous non consultables**. C'est brutal, et c'est
voulu : mieux vaut un coach qui ne voit rien pendant deux jours qu'un mineur
exposé.

### 7.2 Étape 1 — Poser l'état de départ (script, à exécuter une fois)

Le script est écrit et testé sur données inventées, **jamais exécuté** :
`functions/src/coachAccessBackfill.ts` (cœur) et
`functions/src/coachAccessBackfillCli.ts` (ligne de commande).

Ce qu'il fait : pour chaque membership `role=player` **sans état valide**, il
applique **exactement la même décision** que le serveur en production. Il produit
donc `not_required` (club en mode par défaut) ou `pending` (club en
`approval_required`). **Il ne produit jamais `approved`**, et il ne touche
**aucun** membership qui porte déjà un état lisible.

#### Les garde-fous : d'abord **où**, ensuite **combien**

**Où** — c'est exactement le même verrou que la migration des notes
(`MIGRATION_NOTES.md`) et que le transfert de propriété
(`TRANSFERT_PROPRIETE.md`) : un seul module (`functions/src/migrationCible.ts`),
lu par les trois outils. Une règle de sécurité recopiée trois fois est une règle
qui dérive.

1. **cible obligatoire** — sans `--projet=<projectId>`, la commande ne fait rien
   et ne se connecte même pas. On ne devine pas la base sur laquelle on travaille ;
2. **cible vérifiée** — le projet nommé doit correspondre à celui vers lequel
   pointent les identifiants du terminal (`GCLOUD_PROJECT` /
   `GOOGLE_CLOUD_PROJECT` / `FIREBASE_CONFIG`). Le terminal ouvert la veille sur
   un autre projet est rattrapé ici ;
3. **simulation par défaut** — sans `--apply`, le chemin d'écriture est
   physiquement remplacé, pas seulement désactivé par un `if` ;
4. `--apply` exige `--je-confirme=<le même projet>` — la valeur exacte, pas un
   `--je-confirme` nu (qui se copie-colle sans relire ce qu'on vise). Une cible
   de production exige **en plus** `--oui-je-vise-la-production`.

**Combien** — parce qu'une commande peut viser la bonne base et parcourir tout
autre chose que ce que tu avais en tête (`functions/src/migrationBornes.ts`) :

5. **plafond obligatoire** — `--limite=<n>`, le nombre **maximal** de membership
   parcourus. **Aucune valeur par défaut**, et c'est le point qui a été tranché
   explicitement : un plafond que personne n'a choisi serait un nombre invisible,
   et l'opérateur croirait avoir tout traité. Même doctrine que `--projet` : on
   ne devine pas, on nomme. Dépasser le plafond **arrête proprement** et le
   **dit**, avec un code de sortie **non nul** et le point de reprise — jamais
   une troncature muette ;
6. **compteur attendu** — `--attendu=<n>`, **obligatoire dès qu'on écrit**,
   facultatif en simulation. Si le réel s'en écarte, la commande **refuse avant
   la moindre écriture**. C'est le garde-fou de périmètre : viser douze membres
   et en trouver quatre mille, ce n'est pas une commande lente, c'est une
   commande qui s'est trompée de cible ;
7. **reprise par curseur** — `--reprendre-apres=<clubId>/<playerUid>`, le point
   exact affiché par l'exécution précédente ;
8. la sortie ne contient **aucun prénom, aucune donnée de suivi** — uniquement
   des compteurs, à une exception assumée : le **curseur**, qui est un couple
   d'identifiants techniques et sans lequel la reprise serait impossible.

**Aucun objet capable d'écrire — ni même de lire — n'existe avant que ces
contrôles soient passés :** le magasin Firestore n'est construit qu'après le feu
vert, cible **et** bornes. Un refus n'a donc physiquement pas de quoi écrire — et
un test le compte (`functions/tests/outilsAdministrateurCible.test.ts` pour la
cible, `functions/tests/coachAccessBackfillBornes.test.ts` pour les bornes).
Chaque refus sort avec un **code non nul**.

> **Pourquoi la confirmation nomme ici le projet SEUL**, alors que le transfert
> de propriété exige `projet/club` : cet outil **parcourt** une base, il n'agit
> pas sur un club. `--clubId` y est une **borne** (sans lui, la commande passe
> sur toute la base) et non la cible. Confirmer le projet, c'est donc confirmer
> exactement ce que la commande peut toucher au maximum.

> **Deux options qui se contredisent sont refusées à la lecture de la ligne de
> commande**, pas au n-ième document. Déclarer `--attendu=500` sous
> `--limite=100`, ou reprendre sur `clubB/...` alors que la commande est bornée à
> `--clubId=clubA` : refus immédiat, base jamais ouverte. Découvrir la
> contradiction au centième document, avec quatre-vingt-dix-neuf écritures déjà
> faites, ne serait pas un garde-fou.

#### La procédure, dans l'ordre

```
# 1. SIMULER. N'écrit rien. Le plafond est obligatoire ici AUSSI : une
#    simulation sans plafond parcourrait déjà toute la base.
node lib/coachAccessBackfillCli.js \
  --projet=<leProjet> --clubId=<idDuClubPilote> --limite=200

# 2. LIRE LE NOMBRE. La dernière ligne dit, mot pour mot :
#      "Le perimetre COMPLET fait N document(s)"
#    et écrit la commande d'application exacte, --attendu compris.
#    Vérifie que N ressemble à l'effectif réel du club AVANT d'aller plus loin.

# 3. RELANCER EN LE DÉCLARANT. Recopie le N lu à l'étape 2 :
node lib/coachAccessBackfillCli.js \
  --projet=<leProjet> --clubId=<idDuClubPilote> --limite=200 \
  --attendu=<N> --apply --je-confirme=<leProjet>

# 4. Et si <leProjet> est la production (aucun marqueur demo/test/staging/
#    preprod/sandbox/local/dev, aucun émulateur), il faut EN PLUS :
#      --oui-je-vise-la-production
```

#### Reprendre après une interruption

Deux cas, et un seul geste différent entre les deux.

**a) La commande s'est arrêtée sur le plafond** (`ARRET SUR PLAFOND` dans la
sortie, code non nul). Elle affiche le point exact où elle s'est arrêtée. On
recommence à l'étape 1 en ajoutant ce point, pour re-simuler **le reste** :

```
# Simuler le reste (le --attendu de la tranche précédente ne vaut plus rien) :
node lib/coachAccessBackfillCli.js \
  --projet=<leProjet> --clubId=<idDuClubPilote> --limite=200 \
  --reprendre-apres=<clubId>/<playerUid>

# Puis appliquer le reste, avec le nouveau nombre lu :
node lib/coachAccessBackfillCli.js \
  --projet=<leProjet> --clubId=<idDuClubPilote> --limite=200 \
  --reprendre-apres=<clubId>/<playerUid> \
  --attendu=<N restant> --apply --je-confirme=<leProjet>
```

**b) La commande a été coupée en plein vol** (Ctrl-C, coupure réseau, quota) :
il n'y a **pas** de curseur affiché. Ne cherche pas à deviner où elle en était —
**relance la même commande depuis le début**. Le script est **idempotent** : ce
qui a déjà été posé est reconnu comme « déjà à jour » et n'est pas réécrit. Le
`--attendu` reste le même : le nombre de membership n'a pas changé, seul leur
contenu a bougé.

> **Le curseur suit le parcours, pas le succès.** Il avance même sur un
> membership en échec — sinon une reprise repasserait indéfiniment sur le même
> document bloquant. Conséquence pratique : **si la sortie annonce des échecs, ne
> reprends pas après le curseur** ; relance la même tranche. L'idempotence fait
> que ça ne coûte rien.

#### Trois pièges, dits franchement

1. **Un chiffre lu sur une simulation tronquée ne vaut rien.** Si la simulation
   affiche `ARRET SUR PLAFOND`, son compteur ne décrit **que la tranche
   parcourue**. La commande te le dit explicitement (« NE DECLARE PAS ce chiffre
   en `--attendu` ») et refuse de te proposer la commande d'application toute
   faite. Remonte `--limite` jusqu'à ce que la simulation aille au bout.
2. **`--limite` n'est pas une suggestion.** C'est le maximum absolu de ce que la
   commande peut toucher. Choisis-le généreusement par rapport à ce que tu
   attends (un club pilote = quelques dizaines de joueurs, `--limite=200` est
   confortable), mais pas au hasard : c'est justement l'écart entre le plafond et
   le réel qui permet au `--attendu` d'attraper une erreur de périmètre. Un
   `--limite` collé au `--attendu` ne laisse plus rien détecter.
3. **Toujours un club à la fois** (`--clubId`), jamais toute la base d'un coup.
   Le verrou ne l'impose pas — c'est la procédure qui l'impose, et c'est à toi de
   la tenir.

Si tu ne sais plus quoi taper, **lance la simulation** : sa dernière ligne écrit
la commande d'application exacte, plafond, compteur attendu et option production
compris.

### 7.3 Étape 2 — Approuver un joueur (geste humain, un par un)

Il n'existe **aucun écran** pour ça, et c'est délibéré : le jour où un bouton
existera, il faudra qu'il soit branché sur un vrai chemin serveur avec une trace.
En attendant, l'approbation se fait à la main, par Kyllian, dans la console
Firebase :

1. ouvrir `clubs/{clubId}/members/{playerUid}` ;
2. mettre `coachAccess` à `approved` ;
3. **noter en dehors de l'app** (le registre du pilote) : quel joueur, quelle
   date, sur quelle base la décision a été prise.

Ce troisième point n'est pas de la paperasse : c'est la seule chose qui, en cas
de question, distinguera une décision d'un clic.

Effet immédiat : l'écriture déclenche `onMemberWritten`
(`functions/src/triggers.ts:63`), la projection est reconstruite, et le joueur
apparaît dans l'effectif du coach sans que personne n'ait à rafraîchir quoi que
ce soit.

### 7.4 Étape 3 — Retirer un accès

Même chemin, valeur `revoked`. La projection déjà en base est **supprimée** par
le trigger. Le joueur reste membre du club et continue de s'entraîner
normalement.

### 7.5 Ce qu'il ne faut PAS faire

- ❌ passer un joueur en `approved` « pour tester » ;
- ❌ lancer le script sans simulation préalable ;
- ❌ lancer le script sur toute la base ;
- ❌ recopier en `--attendu` un chiffre lu sur une simulation qui affichait
  `ARRET SUR PLAFOND` — il ne décrit qu'une tranche ;
- ❌ inventer un `--reprendre-apres` : le seul curseur valable est celui que la
  commande précédente a affiché ;
- ❌ ajouter le champ à la main dans l'app côté joueur ou coach — les règles le
  refusent, mais surtout ce serait contourner le seul point où la décision est
  tracée.

---

## 8. Où c'est vérifié

| Couche | Fichier | Ce qui est prouvé |
|---|---|---|
| Règles — état | `firestore-tests/rules.coachAccess.test.ts` | absent → refus ; `pending` → refus ; `revoked` → refus ; `approved` → lecture ; `not_required` → lecture ; aucun client ne peut écrire le champ (création, mise à jour partielle, suppression, joueur / coach / owner) |
| Règles — politique | `firestore-tests/rules.joinAccessPolicy.test.ts` | le joueur ne peut jamais l'écrire (création, mise à jour partielle, merge, suppression du champ) ; coach et owner le peuvent ; le coach ne gagne rien d'autre ; valeur inconnue refusée ; configurer la politique n'ouvre aucun droit sur `coachAccess` |
| Politique — décision | `functions/tests/joinAccessPolicy.test.ts` | deux modes ; défaut serveur appliqué à toute valeur absente / vide / inconnue / mal typée ; `automatic_safe_projection` → `not_required` ; `approval_required` → `pending` ; le défaut de la politique n'assouplit pas le fail-closed de l'état |
| Politique — **portée** | `functions/tests/joinAccessPolicyScope.test.ts` | un effectif aux quatre états, une bascule de politique, puis le **chemin de resynchro rejoué** : aucun état ne bouge, zéro écriture ; le backfill lancé après ne referme rien ; un joueur qui rejoint après obtient bien le nouvel état ; aucun module n'expose d'action groupée |
| Politique — **les mots** | `domain/__tests__/joinAccessPolicy.test.ts` | « S'applique aux prochains joueurs qui rejoignent le club » au caractère près ; aucune phrase affichable ne promet un effet sur les membres existants |
| Projecteur | `functions/tests/coachAccess.test.ts` | aucune projection quand l'état refuse ; aucun symbole d'âge dans le module de décision ; mineur et adulte → même état ; `approved` jamais fabriqué ; changer la politique ne réévalue pas un membre existant |
| Rebuild | `functions/tests/integration/rebuild.emulator.test.ts` | projection existante **supprimée** au passage en `revoked` |
| Rattachement | `functions/tests/inviteCodes.test.ts` | état posé par la politique du club ; le profil du joueur n'est **pas lu** ; un rejeu ne réinitialise ni n'ouvre rien |
| Callables | `functions/tests/callableRights.test.ts` | `approval_required` laisse entrer sans ouvrir ; mode par défaut ouvre la projection non sensible |
| Script — métier | `functions/tests/coachAccessBackfill.test.ts` | simulation n'écrit rien ; idempotent ; suit la politique du club ; ne fabrique jamais `approved` |
| Script — **bornes** | `functions/tests/coachAccessBackfillBornes.test.ts` | plafond absent, nul, négatif ou non entier → refus **sans ouvrir la base** ; `--apply` sans `--attendu` → refus ; attendu ≠ réel → refus **avant toute écriture** ; options contradictoires (`--attendu` > `--limite`, reprise sur un autre club) → refus à la validation ; plafond atteint → arrêt annoncé, code non nul, ce qui a été écrit annoncé, curseur donné ; simulation tronquée → interdiction explicite d'en déclarer le chiffre ; trois tranches couvrent les 5 membership **une fois chacun** (visites comptées, pas seulement les écritures) ; inventaire non strictement croissant → refus ; témoin positif : simuler → lire le nombre → relancer en le déclarant écrit vraiment |
| Lecture front | `repositories/__tests__/clubsRepo.test.ts` | les trois états ne se contaminent pas |
| Écrans | `screens/coach/__tests__/CoachPlayerScreen.test.tsx`, `CoachRosterScreen.test.tsx` | trois rendus différents ; jamais « aucun joueur » quand il y en a |
| Copie coach | `domain/__tests__/coachAccess.test.ts` | aucun mot juridique ou médical ; jamais « ne s'entraîne pas » |
| Divulgation joueur | `domain/__tests__/clubDataDisclosure.test.ts` | le texte couvre **exactement** les champs réellement projetés ; douleur / fatigue / zone corporelle / commentaire / ressenti / note nommés comme non transmis ; ton non juridique, non médical, sans case à cocher |
| Divulgation — écrans | `components/club/__tests__/clubDataDisclosure.test.tsx`, `clubDisclosureWiring.test.ts` | tout le contenu est rendu ; aucun contrôle interactif ; branchée dans le setup ET les réglages, sans condition ; ne bloque aucune validation |

---

## 9. Limites connues, dites franchement

1. **L'âge reste déclaratif, et n'est plus consulté du tout** (§0, §6). Le
   mécanisme ne prétend plus rien à ce sujet : c'est un choix, pas un oubli.
2. **Le mode `approval_required` n'a aucun écran.** Un club qui l'active
   condamne ses nouveaux joueurs à `pending` jusqu'à une intervention manuelle
   en console (§7.3). C'est exactement le piège dont on vient de sortir : ne
   l'active pour personne tant qu'un écran d'approbation n'existe pas.
3. **Changer la politique ne réévalue pas les membres déjà rattachés** (§0).
   Voulu, argumenté, et testé — mais ça veut dire qu'un club qui resserre sa
   politique doit révoquer **joueur par joueur** s'il veut fermer des accès déjà
   ouverts.
4. **Ce lot ne règle rien juridiquement** (§6). Le consentement des mineurs
   reste entièrement à trancher hors du code.
5. **Deux lectures au lieu d'une** sur la fiche joueur (membership puis
   projection). C'est le prix de la distinction honnête entre « non autorisé » et
   « erreur ». Sur l'effectif, le coût est **nul** : le champ voyage dans la
   requête `members` qu'on faisait déjà.
6. **Deux écrans hérités non branchés** (`screens/CoachHomeScreen.tsx`,
   `screens/CoachPlayerDetailScreen.tsx`) n'affichent pas ce nouvel état. Ils ne
   sont référencés par aucune route (`navigation/RootNavigator.tsx`,
   `navigation/CoachTabs.tsx`) : aucun utilisateur ne peut les atteindre. À
   supprimer un jour, sur une branche dédiée.
7. **La callable de rattachement renvoie `coachAccess`** au joueur
   (`functions/src/inviteCodes.ts`). **Aucun écran ne l'utilise encore.** Le jour
   où on voudra dire au joueur « ton coach ne verra pas encore ton suivi »,
   l'information est déjà là — mais on n'a pas inventé un écran pour elle. Sous
   le mode par défaut, elle vaut de toute façon `not_required`.
