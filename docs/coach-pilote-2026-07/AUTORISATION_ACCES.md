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
clubs/{clubId}.coachAccessPolicy
```

Deux valeurs, et rien d'autre (`functions/src/coachAccessPolicy.ts`) :

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
Vérifié des deux côtés : `functions/tests/coachAccessPolicy.test.ts`
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

Trois garde-fous :

1. **simulation par défaut** — sans `--apply`, le chemin d'écriture est
   physiquement remplacé, pas seulement désactivé par un `if` ;
2. `--apply` **seul ne suffit pas** : il faut aussi `--je-confirme` ;
3. la sortie ne contient **aucun identifiant, aucun prénom** — uniquement des
   compteurs.

Ordre à respecter :

```
# 1. Simulation. N'écrit rien. Lire les compteurs et vérifier qu'ils
#    ressemblent à l'effectif réel avant d'aller plus loin.
node lib/coachAccessBackfillCli.js --clubId=<idDuClubPilote>

# 2. Si et seulement si les compteurs sont cohérents :
node lib/coachAccessBackfillCli.js --clubId=<idDuClubPilote> --apply --je-confirme
```

**Toujours un club à la fois** (`--clubId`), jamais toute la base d'un coup.

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
- ❌ ajouter le champ à la main dans l'app côté joueur ou coach — les règles le
  refusent, mais surtout ce serait contourner le seul point où la décision est
  tracée.

---

## 8. Où c'est vérifié

| Couche | Fichier | Ce qui est prouvé |
|---|---|---|
| Règles — état | `firestore-tests/rules.coachAccess.test.ts` | absent → refus ; `pending` → refus ; `revoked` → refus ; `approved` → lecture ; `not_required` → lecture ; aucun client ne peut écrire le champ (création, mise à jour partielle, suppression, joueur / coach / owner) |
| Règles — politique | `firestore-tests/rules.coachAccessPolicy.test.ts` | le joueur ne peut jamais l'écrire (création, mise à jour partielle, merge, suppression du champ) ; coach et owner le peuvent ; le coach ne gagne rien d'autre ; valeur inconnue refusée ; configurer la politique n'ouvre aucun droit sur `coachAccess` |
| Politique — décision | `functions/tests/coachAccessPolicy.test.ts` | deux modes ; défaut serveur appliqué à toute valeur absente / vide / inconnue / mal typée ; `automatic_safe_projection` → `not_required` ; `approval_required` → `pending` ; le défaut de la politique n'assouplit pas le fail-closed de l'état |
| Projecteur | `functions/tests/coachAccess.test.ts` | aucune projection quand l'état refuse ; aucun symbole d'âge dans le module de décision ; mineur et adulte → même état ; `approved` jamais fabriqué ; changer la politique ne réévalue pas un membre existant |
| Rebuild | `functions/tests/integration/rebuild.emulator.test.ts` | projection existante **supprimée** au passage en `revoked` |
| Rattachement | `functions/tests/inviteCodes.test.ts` | état posé par la politique du club ; le profil du joueur n'est **pas lu** ; un rejeu ne réinitialise ni n'ouvre rien |
| Callables | `functions/tests/callableRights.test.ts` | `approval_required` laisse entrer sans ouvrir ; mode par défaut ouvre la projection non sensible |
| Script | `functions/tests/coachAccessBackfill.test.ts` | simulation n'écrit rien ; idempotent ; suit la politique du club ; ne fabrique jamais `approved` |
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
