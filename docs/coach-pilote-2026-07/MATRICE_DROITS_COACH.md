# Matrice des droits coach — ce que le serveur autorise, prouvé par des tests hostiles

_Pilote coach FKS — juillet 2026._
_Pour Kyllian : français simple, et derrière chaque ligne du tableau, le fichier
qui décide et le test qui le vérifie._

---

## 1. La promesse, en une phrase

> Un coach peut lire **son club**, **les joueurs de son club**, **dont l'accès est
> autorisé**, et **uniquement les données que le serveur a préparées pour lui**.

Le reste de ce document sert à répondre à une seule question : est-ce que c'est
vrai ? Pas « est-ce que l'écran le montre », mais « est-ce que la base de données
elle-même refuse ». Un filtre sur l'écran, c'est un arbitre sans sifflet : il ne
protège que les gens qui passent par le terrain.

Trois portes existent, et elles sont indépendantes :

| Porte | Qui décide | Ce qui se passe si elle est franchie |
|---|---|---|
| **Les règles Firestore** | la base, avant que le moindre octet ne sorte | refus « permission denied » |
| **Le projecteur serveur** | la Cloud Function qui prépare la fiche du coach | aucune fiche produite, et la fiche existante est supprimée |
| **Les Cloud Functions appelables** | la Function elle-même (les règles ne la protègent pas : l'Admin SDK les contourne) | erreur renvoyée à l'appelant |

---

## 2. Le tableau des droits

Lecture du tableau : « ✅ » = autorisé, « ❌ » = refusé par le serveur.
Les chemins sont ceux de la base ; `{clubId}` et `{uid}` sont des identifiants.

### 2.1 Ce que voit un COACH (ou l'owner du club)

| Chemin | Lecture | Écriture | La règle qui le prouve | Le test qui le vérifie |
|---|---|---|---|---|
| `clubs/{sonClub}` | ✅ par identifiant | ✅ owner seulement | `firestore.rules:98` / `:101` | `rules.clubsInvitation.test.ts` |
| `clubs/{sonClub}` — **liste de tous les clubs** | ❌ | ❌ | `firestore.rules:95` (`allow list: if false`) | matrice, scénario 10 |
| `clubs/{sonClub}/members` (l'effectif) | ✅ liste complète | ❌ sauf son propre doc coach | `firestore.rules:109` / `:131` | matrice, scénarios 2 et 10 |
| `clubs/{sonClub}/playerSummaries/{joueur}` (la fiche préparée) | ✅ **seulement** si le joueur est encore membre `player` **et** que son accès est autorisé | ❌ pour tout le monde | `firestore.rules:199-202` | matrice, scénarios 4, 5, 7 |
| `clubs/{sonClub}/playerSummaries` — **liste** | ❌ (aucune forme) | ❌ | la règle dépend de l'identifiant du document : illisible en liste | matrice, scénario 10 |
| `clubs/{sonClub}/weekContexts/{semaine}` (son cadre) | ✅ par clé de semaine | ✅ création/mise à jour | `firestore.rules:174` / `:176` | `rules.weekContexts.test.ts` |
| `clubs/{sonClub}/weekContexts` — **liste** | ❌ (fermé en juillet 2026, voir §4) | — | `firestore.rules:175` | `rules.weekContexts.test.ts` |
| `clubs/{autreClub}/…` (tout) | ❌ | ❌ | `isCoach` / `isClubOwner` portent sur le clubId du **chemin** | matrice, scénario 1 |
| `users/{joueur}` (le profil brut) | ❌ | ❌ | `firestore.rules:71` | matrice, scénario 8 |
| `users/{joueur}/sessions` (séances faites : douleur, RPE, commentaire) | ❌ | ❌ | `firestore.rules:76` | matrice, scénario 8 |
| `users/{joueur}/plannedSessions` | ❌ | ❌ | `firestore.rules:81` | matrice, scénario 8 |
| `inviteCodes` / `clubInviteMeta` / `inviteAttempts` | ❌ | ❌ | `firestore.rules:228, 232, 236` | matrice, scénario 8 |

### 2.2 Ce que voit un JOUEUR

| Chemin | Lecture | Écriture | La règle qui le prouve | Le test qui le vérifie |
|---|---|---|---|---|
| `users/{lui}` et ses séances | ✅ | ✅ | `firestore.rules:71-82` | `rules.baseline.test.ts` |
| `clubs/{sonClub}` | ✅ par identifiant | ❌ | `firestore.rules:98` | `rules.clubsInvitation.test.ts` |
| `clubs/{sonClub}/members/{lui}` | ✅ | ❌ (écrit par le serveur) | `firestore.rules:109` / `:131` | matrice, scénarios 2 et 9 |
| `clubs/{sonClub}/members` — **liste de l'effectif** | ❌ | ❌ | `firestore.rules:109` (aucune branche ne s'applique en liste) | matrice, scénarios 2 et 10 |
| `clubs/{sonClub}/members/{coéquipier}` | ❌ | ❌ | `firestore.rules:109` | matrice, scénario 2 |
| `clubs/{sonClub}/playerSummaries/{lui}` (sa propre fiche coach) | ❌ | ❌ | `firestore.rules:199` | matrice, scénario 2 |
| `clubs/{sonClub}/weekContexts/{semaine}` | ✅ par clé de semaine | ❌ | `firestore.rules:174` / `:176` | `rules.weekContexts.test.ts` |
| `clubs/{sonClub}/weekContexts` — **liste** | ❌ | ❌ | `firestore.rules:175` | `rules.weekContexts.test.ts` |
| `users/{autreJoueur}` | ❌ | ❌ | `firestore.rules:71` | `rules.baseline.test.ts` |

### 2.3 Les trois portes appelables (Cloud Functions)

| Function | Qui a le droit | Ce qu'elle refuse | Le test qui le vérifie |
|---|---|---|---|
| `issueClubInviteCode` | l'owner du club, ou un membre de rôle `coach` | coach d'un autre club, joueur, inconnu, ancien coach retiré | `functions/tests/callableRights.test.ts` 9.1 → 9.4 |
| `joinClubWithInviteCode` | tout compte connecté, **avec un code valide** | code inconnu / expiré / révoqué / épuisé, identifiant de club envoyé à la place d'un code, charge utile structurée | `functions/tests/callableRights.test.ts` 9.7 → 9.11 |
| `deleteAccount` | l'utilisateur, **pour son propre compte uniquement** | l'uid vient du jeton d'authentification (`functions/src/deleteAccount.ts:27`), jamais de la charge utile | non couvert par un test automatisé — voir §5, limite 4 |

---

## 3. Les 10 tentatives hostiles, et leur résultat

Toutes ces tentatives sont jouées **contre les vraies règles**, par l'émulateur
Firestore (elles ne sont pas simulées avec un faux). Fichiers :
`firestore-tests/rules.coachRightsMatrix.test.ts` (scénarios 1 à 8 et 10),
`firestore-tests/rules.weekContexts.test.ts` (la fuite fermée),
`functions/tests/callableRights.test.ts` (scénario 9).

| # | La tentative | Résultat | Ce qui l'arrête |
|---|---|---|---|
| 1 | **Coach d'un autre club** : coachB lit le club A (club, effectif, fiches, cadre de semaine) | ❌ tout refusé | `isCoach`/`isClubOwner` portent sur le clubId **du chemin**, jamais sur un clubId fourni par le client |
| 2 | **Utilisateur sans rôle Coach** : un joueur du club lit l'effectif et la fiche d'un coéquipier | ❌ tout refusé, y compris **sa propre** fiche coach | `firestore.rules:109` et `:199`. Se déclarer `role: "coach"` dans son propre profil n'ouvre rien : les règles club ne lisent jamais ce champ |
| 3 | **Ancien coach retiré du club** : son membership est supprimé | ❌ perd tout, immédiatement, y compris les fiches déjà écrites | l'autorisation est relue à chaque requête, il n'y a rien à « expirer » — **mais voir §5, limite 1 (l'owner)** |
| 4 | **Membre révoqué** (`coachAccess: "revoked"`) | ❌ fiche refusée, alors qu'elle existe en base | `isCoachAccessGranted` (`firestore.rules:56`), couche 2 dans `functions/src/projector.ts:341` |
| 5 | **Mineur en attente** (`pending`, ou champ absent sur un vieux membership) | ❌ fiche refusée ; le joueur reste **visible dans l'effectif** | même règle. Être dans l'effectif et être consultable sont deux choses différentes |
| 6 | **Identifiant de club deviné** : un inconnu connaît l'identifiant du club A | ❌ tout refusé, et **aucune différence** entre « ce club existe » et « ce club n'existe pas » | `isClubMember` exige un document de membership réel. Écrire `clubId: clubA` dans son propre profil ne rattache à rien |
| 7 | **Identifiant de joueur connu mais non autorisé** : le coach connaît l'uid (il le voit dans son effectif) | ❌ fiche refusée | la décision est prise **document par document**, pas une fois pour le club |
| 8 | **Lecture directe Firestore** : le coach vise les documents bruts (profil, séances faites, séances prévues) | ❌ tout refusé | `firestore.rules:71-82`. C'est la raison d'être de la fiche préparée par le serveur |
| 9 | **Appel direct à une Function** (avec `curl`, sans passer par l'app) | ❌ refusé : autre club, joueur, inconnu, ancien coach ; un identifiant de club n'est jamais un paramètre ; un rattachement réussi n'ouvre pas l'accès au suivi | `functions/src/inviteCodes.ts`. Versant règles : aucun client ne peut **imiter** l'écriture que seule la Function a le droit de faire |
| 10 | **Pagination ou recherche contournant le filtre** | ❌ voir le détail ci-dessous | |

### Le détail du scénario 10 (le plus subtil)

Une règle Firestore peut porter sur **le contenu ou l'identifiant d'un
document**. Quand c'est le cas, la base ne sait pas l'évaluer sur une lecture de
**collection** : elle refuse la requête entière. Une lecture de collection ne
peut donc jamais « grappiller » ce qu'un accès document par document refuserait.
Encore fallait-il vérifier qu'aucune collection n'ouvrait **plus** en liste qu'en
accès direct. Résultat de la revue, collection par collection :

| Collection | En accès direct (`get`) | En lecture de collection (`list`) | Verdict |
|---|---|---|---|
| `users` | son propre profil | refusée | liste ⊂ direct |
| `users/*/sessions`, `plannedSessions` | les siennes | refusée | liste ⊂ direct |
| `clubs` | membres et owner | **fermée explicitement** | liste ⊂ direct |
| `clubs/*/members` | soi-même, coach, owner | coach et owner **uniquement** | liste ⊂ direct (le joueur perd la liste, garde son document) |
| `clubs/*/playerSummaries` | coach/owner + membre actif + accès autorisé | refusée (règle liée à l'identifiant) | liste ⊂ direct |
| `clubs/*/weekContexts` | tout membre du club | **c'était la fuite — voir §4** | corrigé |
| `inviteCodes`, `clubInviteMeta`, `inviteAttempts` | fermées | fermées | — |

Ont également été essayés, et refusés : la pagination (`orderBy` + `limit(1)`,
c'est-à-dire lire la collection un document à la fois), la recherche filtrée
(`where`), et surtout les **requêtes de groupe de collections**
(`collectionGroup`), qui interrogent toutes les sous-collections d'un même nom
**tous clubs confondus, sans passer par le chemin `/clubs/{clubId}/`**. C'est le
contournement le plus dangereux : si les règles s'étaient appuyées sur autre
chose que ce préfixe de chemin, tout le cloisonnement serait tombé là. Testé sur
`playerSummaries`, `members`, `weekContexts`, `sessions`, `plannedSessions`, pour
un coach, un coach d'un autre club, un joueur et un inconnu : **refusé partout**,
y compris la recherche « où suis-je membre ? » (`where uid == moi`).

---

## 4. La fuite trouvée, et fermée : les notes hebdomadaires du coach

**Ce qui était ouvert.** `clubs/{clubId}/weekContexts` était protégée par un seul
`allow read`. Or `read` couvre **deux** opérations : lire un document, et lire la
collection entière. La condition ne portait ni sur le contenu ni sur la semaine :
n'importe quel membre du club pouvait donc, en **une seule requête**, repartir
avec **toutes** les semaines — intensité, objectif, match du week-end, et la note
libre de 200 caractères écrite par le coach —, semaines passées comprises.

Concrètement : un intrus devenu membre, ou simplement un joueur curieux, aspirait
l'historique du staff d'un coup.

**Ce que fait l'application, en vrai.** Vérification faite dans tout le code :
**aucun endroit** ne lit cette collection en bloc. Il n'y a que deux gestes réels,
et tous les deux visent **un document**, par sa clé de semaine :

- le **joueur** lit le cadre de la semaine courante pour que sa séance en tienne
  compte (`services/aiContext.ts:207`) ;
- le **coach** lit et écrit le cadre de la semaine affichée
  (`repositories/clubsRepo.ts:419` et `:439`).

**Le correctif** (`firestore.rules:173-178`) sépare les deux opérations :

```
allow get:  if isClubMember(clubId) || isClubOwner(clubId);
allow list: if false;
```

La lecture de collection est fermée **à tout le monde**, coach et owner compris :
personne ne l'utilise, et une porte que personne n'emprunte est une porte qu'on
ferme. Le geste légitime, lui, est intact — la génération de séance continue de
recevoir le cadre du coach.

**Pourquoi le joueur garde le droit de lire le cadre.** Parce que c'est
exactement à ça qu'il sert : le coach donne l'intensité de la semaine, et FKS
construit la prépa autour. Lui retirer cette lecture aurait débranché le cadre de
la génération — en silence, ce qui est le pire des deux mondes.

**Preuve.** `firestore-tests/rules.weekContexts.test.ts`, 11 tests. Le dernier est
un **témoin** : il rejoue l'**ancienne** règle dans un projet émulateur séparé et
prouve qu'un joueur y récoltait bien les trois semaines d'un coup, notes
comprises. Un test vert ne vaut que s'il aurait pu être rouge.

---

## 5. À trancher — ce qui reste ouvert

Rien de ce qui suit n'est masqué par un test complaisant : chaque point a un test
**vert qui constate ce qui est**, pas ce qu'on voudrait.

### Limite 1 — retirer l'owner de l'effectif ne lui retire pas ses droits

`isClubOwner` (`firestore.rules:12`) ne regarde pas le membership, mais le champ
`ownerUid` du document club. Un coach fondateur écarté du club **garde donc tout
accès** tant que `ownerUid` n'a pas changé — y compris les fiches des joueurs.
C'est volontaire (l'owner ne doit pas pouvoir s'auto-exclure de son propre club
par accident), mais cela veut dire qu'**il n'existe aujourd'hui aucune procédure
de retrait d'un fondateur** autre que modifier `ownerUid` à la main dans la
console Firebase.

_Test qui le prouve :_ scénario 3, second test (« LIMITE CONNUE »).
_Question :_ veut-on un chemin de transfert de propriété dans l'app, ou est-ce que
la console suffit pour le pilote ?

### Limite 2 — la note libre du coach arrive sur le téléphone de chaque joueur

Une règle Firestore autorise ou refuse **un document entier** ; elle ne masque pas
un champ. Le joueur lit donc le cadre de la semaine **avec** la note libre du
coach, et cette note part ensuite dans le contexte envoyé au backend de
génération (`services/aiContextHelpers.ts:45-50`).

L'écran joueur ne l'affiche jamais. **Mais ne rien afficher n'est pas une
protection** : la donnée est bien sur l'appareil, et n'importe qui inspectant le
trafic la verrait. Or l'écran coach présente ce champ comme une note de travail
(« Ex : gros match dimanche, jambes lourdes ») et le champ voisin est même
annoncé comme une « info staff » : un coach peut légitimement croire qu'il écrit
pour son staff, alors qu'il écrit pour tout le vestiaire.

_Test qui le prouve :_ `rules.weekContexts.test.ts`, test 10.
_Options :_ (a) l'assumer et **le dire au coach dans l'écran** (« visible par tes
joueurs ») ; (b) déplacer la note dans un document séparé, lisible du seul coach,
et la retirer du contexte de génération. L'option (b) change le produit : la note
ne pèserait plus sur les séances.

### Limite 3 — une semaine passée reste lisible, un document à la fois

La récolte en masse est fermée, mais une clé de semaine est une **date de lundi**,
donc devinable. Un membre du club peut encore relire le cadre d'une semaine
passée en demandant explicitement `2026-06-22`. Fermer cela demanderait de borner
la lecture à la semaine en cours — ce qui suppose que les règles sachent quelle
est la semaine en cours (calcul de date fragile, décalages de fuseau horaire à la
frontière du lundi) ou qu'on ajoute un champ de date dans le document, avec une
reprise des documents existants. **Le rapport bénéfice/risque n'a pas semblé
favorable** : la donnée concernée est le cadre d'entraînement du club dont on est
membre, pas de la donnée personnelle.

_Test qui le prouve :_ `rules.weekContexts.test.ts`, test 9.

### Limite 4 — la couche d'enveloppe des Cloud Functions n'est pas testée ici

Les tests du scénario 9 portent sur le **cœur de décision**
(`functions/src/inviteCodes.ts`), qui est le seul endroit où une autorisation est
accordée ou refusée. La fine couche qui l'entoure — celle qui prend l'identité
dans le jeton d'authentification (`functions/src/clubInvites.ts:105` et `:127`,
`functions/src/deleteAccount.ts:27`) — n'est **exercée par aucun test** :
`firebase-functions` et `firebase-admin` ne sont installés nulle part dans ce
dépôt, donc aucun test ne peut importer ces fichiers.

C'est une limite réelle, et elle est bornée : ces trois lignes ne contiennent
aucune logique métier, et **aucune callable ne lit un identifiant d'utilisateur
dans la charge utile** — ce qui se vérifie à l'œil sur trois fichiers courts.
_Question :_ installe-t-on les dépendances `functions/` sur cette machine pour
rejouer aussi les tests d'intégration émulateur (déjà écrits, jamais exécutés) ?

### Limite 5 — l'émission d'un code dit si un club existe

`issueClubInviteCode` renvoie deux erreurs **différentes** selon que le club
n'existe pas (`not-found`) ou qu'il existe mais que l'appelant n'en est pas coach
(`permission-denied`). C'est un petit oracle d'existence, en contradiction avec la
doctrine « aucun oracle » appliquée au rattachement.

**Portée réelle : faible.** Les identifiants de club sont des chaînes aléatoires
de 20 caractères générées par Firestore — on ne les devine pas. L'oracle ne sert
qu'à quelqu'un qui **possède déjà** un identifiant (un ancien membre, par exemple)
et veut savoir si le club vit encore. Aucune donnée du club ne fuit dans le
message.

_Test qui le prouve :_ `callableRights.test.ts` 9.12.
_Correctif possible, 3 lignes :_ renvoyer `permission-denied` dans les deux cas.
Effet de bord à accepter : un coach dont le club aurait disparu verrait
« Seul le coach du club peut générer un code » au lieu de « Ton club est
introuvable ».

### Limite 6 — l'émission d'un code n'est pas limitée en tentatives

Le **rattachement** compte les échecs (par compte et par origine réseau) ;
l'**émission**, non. Un compte peut donc appeler `issueClubInviteCode` en rafale.
Conséquence : une nuisance de facturation (une lecture Firestore par essai), pas
une fuite de données — chaque essai est refusé et n'écrit rien.

_Test qui le prouve :_ `callableRights.test.ts` 9.13 (50 tentatives, jamais de
blocage).

### Limite 7 — la liste des états autorisants est recopiée à la main

Les règles Firestore ne peuvent pas importer de TypeScript : la liste
`["approved", "not_required"]` existe donc **deux fois**, dans
`functions/src/coachAccess.ts:53` et dans `firestore.rules:59`. Rien ne vérifie
automatiquement qu'elles restent identiques ; ce sont deux suites de tests
exerçant les mêmes valeurs des deux côtés qui les tiennent. Oublier de reporter un
ajout ferait **refuser** la base (donc sans danger), mais en silence.

_Héritée du lot précédent, rappelée ici pour que la matrice soit complète._

---

## 6. Ce qui a changé dans ce lot

| Fichier | Nature |
|---|---|
| `firestore.rules` | `weekContexts` : `allow read` remplacé par `allow get` + `allow list: if false` (seule modification de comportement du lot) |
| `firestore-tests/rules.coachRightsMatrix.test.ts` | **nouveau** — les scénarios 1 à 8 et 10, un test par tentative |
| `firestore-tests/rules.weekContexts.test.ts` | **nouveau** — la fuite, le correctif, ce qui reste ouvert, et le témoin |
| `functions/tests/callableRights.test.ts` | **nouveau** — le scénario 9 et les deux faiblesses mesurées |
| `docs/coach-pilote-2026-07/MATRICE_DROITS_COACH.md` | **nouveau** — ce document |

Aucun test existant n'a été modifié ni affaibli. Aucun fichier applicatif n'a été
touché en dehors des règles.
