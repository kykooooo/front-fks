# Autorisation d'accès aux données de suivi d'un joueur

_Pilote coach FKS — juillet 2026._
_Pour Kyllian : français simple, analogies foot, et à chaque affirmation le fichier et la ligne qui le prouvent._

---

## 1. Le problème, en une phrase

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

Même logique au rattachement (`functions/src/coachAccess.ts:100`,
`initialCoachAccess`) :

- catégorie U13 / U15 → `pending` ;
- catégorie U17 / U18 / Senior → `not_required` ;
- **catégorie inconnue ou absente → `pending`**.

> On ne devine **jamais** un âge. Un profil incomplet est traité comme s'il
> pouvait être celui d'un mineur.

---

## 4. Les quatre verrous (défense en profondeur)

Un seul verrou, ça se contourne. Quatre, il faut les franchir tous.

### Verrou 1 — Les règles Firestore (la base elle-même)

`firestore.rules:56` (fonction) et `firestore.rules:171` (usage) :

```
match /playerSummaries/{playerUid} {
  allow read: if (isCoach(clubId) || isClubOwner(clubId)) &&
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

- **Au rattachement** : `functions/src/inviteCodes.ts:555` — la seule porte
  d'entrée dans un club (`joinClubWithInviteCode`) calcule et écrit l'état
  initial, dans la même transaction que le membership.
- **Au changement de profil** : `functions/src/triggers.ts:95` — quand la
  catégorie d'âge apparaît ou change, l'état est recalculé côté serveur.

Ce recalcul (`resolveCoachAccess`, `functions/src/coachAccess.ts:127`) obéit à
**deux règles seulement** :

1. `approved` et `revoked` sont des **décisions humaines** : jamais écrasées ;
2. sinon, on applique la règle initiale. Il peut donc **resserrer**
   (`not_required` → `pending` si la catégorie devient U15) et **lever le doute**
   (`pending` → `not_required` quand la catégorie devient connue et adulte).

**Il ne peut JAMAIS produire `approved` tout seul.** C'est vérifié par un test
qui essaie toutes les combinaisons possibles d'entrées
(`functions/tests/coachAccess.test.ts`, « ne produit JAMAIS approved »).

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
- **L'âge est déclaratif.** La catégorie vient du joueur lui-même, au setup. Rien
  ne la vérifie. Un joueur de 14 ans qui coche « Senior » obtient `not_required`.
  Le mécanisme donne une garantie **d'interrupteur**, pas **d'identité**.
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

Ce qu'il fait : pour chaque membership `role=player` sans champ, il applique
**exactement la même décision** que le serveur en production. Il produit donc
`not_required` (joueur adulte déclaré) ou `pending` (mineur, ou âge inconnu).
**Il ne produit jamais `approved`.**

Trois garde-fous :

1. **simulation par défaut** — sans `--apply`, le chemin d'écriture est
   physiquement remplacé, pas seulement désactivé par un `if` ;
2. `--apply` **seul ne suffit pas** : il faut aussi `--je-confirme` ;
3. la sortie ne contient **aucun identifiant, aucun prénom, aucune catégorie
   d'âge** — uniquement des compteurs.

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
| Règles | `firestore-tests/rules.coachAccess.test.ts` | absent → refus ; `pending` → refus ; `revoked` → refus ; `approved` → lecture ; `not_required` → lecture ; aucun client ne peut écrire le champ (création, mise à jour partielle, suppression, joueur / coach / owner) |
| Projecteur | `functions/tests/coachAccess.test.ts` | aucune projection quand l'état refuse ; état initial `pending` si l'âge est inconnu ; `approved` jamais fabriqué |
| Rebuild | `functions/tests/integration/rebuild.emulator.test.ts` | projection existante **supprimée** au passage en `revoked` |
| Rattachement | `functions/tests/inviteCodes.test.ts` | état posé à l'entrée dans le club ; un rejeu ne réinitialise ni n'ouvre rien |
| Script | `functions/tests/coachAccessBackfill.test.ts` | simulation n'écrit rien ; idempotent ; ne fabrique jamais `approved` |
| Lecture front | `repositories/__tests__/clubsRepo.test.ts` | les trois états ne se contaminent pas |
| Écrans | `screens/coach/__tests__/CoachPlayerScreen.test.tsx`, `CoachRosterScreen.test.tsx` | trois rendus différents ; jamais « aucun joueur » quand il y en a |
| Copie | `domain/__tests__/coachAccess.test.ts` | aucun mot juridique ou médical ; jamais « ne s'entraîne pas » |

---

## 9. Limites connues, dites franchement

1. **L'âge reste déclaratif** (§6). Le mécanisme ne peut pas faire mieux : c'est
   une limite de conception, pas un oubli.
2. **Le recalcul automatique peut lever un `pending`** quand la catégorie passe à
   « Senior ». C'est nécessaire — sans ça, un joueur qui rejoint avant d'avoir
   rempli son profil resterait invisible pour toujours — mais ça signifie qu'un
   mineur qui déclare un âge adulte se rend consultable. Une seule chose ne peut
   pas être obtenue ainsi : `approved`.
3. **Deux lectures au lieu d'une** sur la fiche joueur (membership puis
   projection). C'est le prix de la distinction honnête entre « non autorisé » et
   « erreur ». Sur l'effectif, le coût est **nul** : le champ voyage dans la
   requête `members` qu'on faisait déjà.
4. **Deux écrans hérités non branchés** (`screens/CoachHomeScreen.tsx`,
   `screens/CoachPlayerDetailScreen.tsx`) n'affichent pas ce nouvel état. Ils ne
   sont référencés par aucune route (`navigation/RootNavigator.tsx`,
   `navigation/CoachTabs.tsx`) : aucun utilisateur ne peut les atteindre. À
   supprimer un jour, sur une branche dédiée.
5. **La callable de rattachement renvoie désormais `coachAccess`** au joueur
   (`functions/src/inviteCodes.ts:462`). **Aucun écran ne l'utilise encore.** Le
   jour où on voudra dire au joueur « ton coach ne verra pas encore ton suivi »,
   l'information est déjà là — mais elle n'a pas été inventée un écran pour elle.
