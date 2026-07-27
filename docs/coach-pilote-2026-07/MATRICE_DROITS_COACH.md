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
| `clubs/{sonClub}` | ✅ par identifiant | ✅ owner seulement, **sauf `ownerUid` : fermé à tous** | `firestore.rules` (`allow get` / `allow update` + `changesOwnerUid`) | `rules.clubsInvitation.test.ts`, `rules.clubOwnershipTransfer.test.ts` §A |
| `clubs/{sonClub}` — **liste de tous les clubs** | ❌ | ❌ | `firestore.rules:95` (`allow list: if false`) | matrice, scénario 10 |
| `clubs/{sonClub}/members` (l'effectif) | ✅ liste complète | ❌ sauf son propre doc coach | `firestore.rules:109` / `:131` | matrice, scénarios 2 et 10 |
| `clubs/{sonClub}/playerSummaries/{joueur}` (la fiche préparée) | ✅ **seulement** si le joueur est encore membre `player` **et** que son accès est autorisé | ❌ pour tout le monde | `firestore.rules:199-202` | matrice, scénarios 4, 5, 7 |
| `clubs/{sonClub}/playerSummaries` — **liste** | ❌ (aucune forme) | ❌ | la règle dépend de l'identifiant du document : illisible en liste | matrice, scénario 10 |
| `clubs/{sonClub}/weekContexts/{semaine}` (son cadre) | ✅ par clé de semaine | ✅ création/mise à jour | `firestore.rules:174` / `:176` | `rules.weekContexts.test.ts` |
| `clubs/{sonClub}/weekContexts` — **liste** | ❌ (fermé en juillet 2026, voir §4) | — | `firestore.rules:175` | `rules.weekContexts.test.ts` |
| `clubs/{autreClub}/…` (tout) | ❌ | ❌ | `isClubStaff` / `isClubOwner` portent sur le clubId du **chemin** | matrice, scénario 1 |
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
| `removeClubMember` | l'**encadrement** du club (owner ou coach) | coach d'un autre club, joueur, inconnu, membre absent, et **le propriétaire** (échec typé `OWNER_TRANSFER_REQUIRED`) | `functions/tests/clubMembers.test.ts` |
| `transferClubOwnership` | le **propriétaire actuel**, et lui seul | coach du club, joueur, propriétaire d'un autre club, inconnu, club inexistant, autorité incohérente — **tous avec le même message**. Cible non membre / retirée / soi-même : refus parlants et typés | `functions/tests/clubOwnership.test.ts` |

> L'outil administrateur du transfert (`functions/src/clubOwnershipCli.ts`) n'est
> **pas** une callable : il saute la vérification d'autorité de l'appelant, parce
> qu'il sert précisément les clubs où personne n'est autorisé. Il n'est exporté
> nulle part dans `index.ts`, et un test le vérifie. Procédure :
> `docs/coach-pilote-2026-07/TRANSFERT_PROPRIETE.md`.

---

## 3. Les 10 tentatives hostiles, et leur résultat

Toutes ces tentatives sont jouées **contre les vraies règles**, par l'émulateur
Firestore (elles ne sont pas simulées avec un faux). Fichiers :
`firestore-tests/rules.coachRightsMatrix.test.ts` (scénarios 1 à 8 et 10),
`firestore-tests/rules.weekContexts.test.ts` (la fuite fermée),
`functions/tests/callableRights.test.ts` (scénario 9).

| # | La tentative | Résultat | Ce qui l'arrête |
|---|---|---|---|
| 1 | **Coach d'un autre club** : coachB lit le club A (club, effectif, fiches, cadre de semaine) | ❌ tout refusé | `isClubStaff`/`isClubOwner` portent sur le clubId **du chemin**, jamais sur un clubId fourni par le client |
| 2 | **Utilisateur sans rôle Coach** : un joueur du club lit l'effectif et la fiche d'un coéquipier | ❌ tout refusé, y compris **sa propre** fiche coach | `firestore.rules:109` et `:199`. Se déclarer `role: "coach"` dans son propre profil n'ouvre rien : les règles club ne lisent jamais ce champ |
| 3 | **Ancien coach retiré du club** : son membership est supprimé | ❌ perd tout, immédiatement, y compris les fiches déjà écrites | l'autorisation est relue à chaque requête, il n'y a rien à « expirer » — **mais voir §5, limite 1 (l'owner)** |
| 4 | **Membre révoqué** (`coachAccess: "revoked"`) | ❌ fiche refusée, alors qu'elle existe en base | `isCoachAccessGranted` (`firestore.rules:56`), couche 2 dans `functions/src/projector.ts:341` |
| 5 | **Mineur en attente** (`pending`, ou champ absent sur un vieux membership) | ❌ fiche refusée ; le joueur reste **visible dans l'effectif** | même règle. Être dans l'effectif et être consultable sont deux choses différentes |
| 6 | **Identifiant de club deviné** : un inconnu connaît l'identifiant du club A | ❌ tout refusé, et **aucune différence** entre « ce club existe » et « ce club n'existe pas » | `isActiveMember` exige un document de membership réel, avec un rôle actif. Écrire `clubId: clubA` dans son propre profil ne rattache à rien |
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
allow get:  if isActiveMember(clubId);
allow list: if false;
```

> `isActiveMember` a remplacé `isClubMember` en juillet 2026 : « le document de
> membre existe » ne suffit plus, il faut un rôle d'appartenance **actif**. Une
> pierre tombale de retrait (`role: "removed"`) existe aussi, et elle ne doit
> rien ouvrir.

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

### Limite 1 — FERMÉE (2026-07) : le prédicat d'autorité partagé

**Le défaut, tel qu'il était écrit ici.** `isClubOwner` ne regardait pas le
membership, mais le seul champ `ownerUid` du document club. Un fondateur écarté
gardait **tout accès** tant que `ownerUid` n'avait pas changé, fiches des joueurs
comprises — et il n'existait aucune procédure de retrait autre que modifier
`ownerUid` à la main dans la console.

**Ce qui a été fait.** L'invariant posé par Kyllian : _« un propriétaire est
autorisé uniquement si `ownerUid` le désigne ET s'il possède encore une
appartenance active avec le rôle propriétaire »_. Deux sources, jamais une seule ;
et quand elles se contredisent, on **refuse** au lieu de choisir arbitrairement
laquelle des deux ment.

Conséquences traitées dans le même lot :

1. **Un rôle propriétaire est né.** `members/{uid}.role` ne connaissait que
   "coach" et "player", et le créateur du club s'écrivait lui-même en "coach" :
   sous l'invariant, **tout club existant** aurait été incohérent. La création de
   club écrit désormais `role: "owner"` dans le même mouvement que `ownerUid`
   (`repositories/clubsRepo.createClubAsCoach`). Coût en production : **nul**, la
   base a été vidée le 21/07.
2. **Le propriétaire est de fait encadrant.** `isClubStaff` accepte "owner" ET
   "coach". Sans ça, poser le rôle propriétaire lui aurait retiré l'écriture du
   cadre de semaine et de la directive — un trou ouvert en en fermant un autre.
3. **L'amorçage est circulaire, et c'est la SEULE exception.** À la création, le
   document de membre propriétaire n'existe pas encore : la règle qui autorise à
   s'écrire "owner" se fonde sur `clubOwnerUid(clubId)` lu dans le document club,
   pas sur le prédicat complet. Elle est bornée à « j'écris mon propre document,
   avec le rôle owner, dans un club qui me désigne déjà ». Le cas hostile
   (s'écrire propriétaire ailleurs) est testé explicitement, depuis un inconnu,
   depuis un joueur du club, et depuis un coach du club.
4. **Source unique, duplication assumée.** Le prédicat vit une fois côté serveur
   (`functions/src/clubAuthority.ts`, module pur) et une fois dans
   `firestore.rules` (les règles ne peuvent pas importer de TypeScript). Aucun
   verrou automatique ne les maintient égales : ce qui les tient, ce sont deux
   suites qui exercent les **mêmes cas** — exactement la situation, et le même
   remède, que pour `COACH_ACCESS_GRANTING_STATES`.
5. **Signalement d'incohérence.** Un état où `ownerUid` désigne quelqu'un sans
   appartenance propriétaire (ou l'inverse) **refuse** l'accès et laisse une trace
   serveur (`logger.error`, identifiants + nature de l'écart, rien d'autre). Il
   n'est pas non plus transformé en disparition muette : le **document club reste
   lisible** par son `ownerUid`, ce qui permet à l'application de nommer l'état
   (`useCoachClub.ownerAuthority` → bandeau « Club à réparer »).

_Ce qui reste ouvert :_ la création d'un **second coach** — aucun chemin client,
aucun chemin serveur. (Le **transfert de propriété**, lui, n'est plus une limite :
voir la limite 1 ter ci-dessous.)

_Tests qui le prouvent :_ `functions/tests/clubAuthority.test.ts`,
`firestore-tests/rules.clubAuthority.test.ts`, et scénario 3 de cette matrice
(« LIMITE FERMÉE »).

### Limite 1 bis — FERMÉE (2026-07) : retirer réellement un membre

**Le défaut.** Révoquer un code d'invitation n'expulsait personne : l'accès repose
sur l'**existence** de `clubs/{clubId}/members/{uid}`. Aucun écran coach ne
permettait de retirer quelqu'un.

**Ce qui a été fait.** Une Cloud Function `removeClubMember` (cœur pur dans
`functions/src/clubMembers.ts`) qui, dans **une transaction** : vérifie l'identité
et le rôle du demandeur **avant** de toucher à la cible, vérifie que la cible
appartient réellement à **ce** club, pose une **pierre tombale**
(`role: "removed"`, `coachAccess: "revoked"`, `removedAt`, `removedBy`), supprime
la projection déjà produite, et remet `users/{uid}.clubId` à `null` — uniquement
s'il pointait encore vers ce club.

Pourquoi une pierre tombale plutôt qu'une suppression : le refus doit venir de
l'**état**, pas d'une course. Un joueur retiré continue de s'entraîner, donc les
triggers de reprojection tournent ; ils relisent le rôle "removed", renvoient
`null`, et **suppriment** au lieu de recréer. Et même si une reprojection en vol
réécrivait la projection, les règles la rendent illisible par **deux** verrous
indépendants (`isPlayerMember` et `isCoachAccessGranted`).

L'action vit sur la fiche joueur, derrière une confirmation qui distingue en
toutes lettres le retrait du club et la suppression de compte : _« Le retrait du
club ne supprime JAMAIS le compte FKS du joueur. »_

_Tests qui le prouvent :_ `functions/tests/clubMembers.test.ts` (coach autorisé ·
coach d'un autre club · joueur ordinaire · membre absent · double retrait · accès
coach après retrait · projection existante · trigger exécuté après retrait ·
tentative de retrait du propriétaire), section G de
`firestore-tests/rules.clubAuthority.test.ts`, et
`screens/coach/__tests__/CoachPlayerScreen.test.tsx`.

### Limite 1 ter — FERMÉE (2026-07) : transférer la propriété du club

**Le défaut.** Le lot précédent s'arrêtait net sur le propriétaire : le retirer
aurait fabriqué exactement l'état interdit (un `ownerUid` qui désigne un
non-membre), donc le retrait échouait avec `OWNER_TRANSFER_REQUIRED` — en
demandant un geste **qui n'existait pas**. Un fondateur qui quittait le club
laissait le club coincé.

**Et un trou qu'on n'avait pas encore vu.** `allow update` sur le document club
autorisait le propriétaire à écrire n'importe quel champ, **`ownerUid` compris**.
Une seule requête cliente suffisait donc à désigner quelqu'un d'autre sans
toucher aux rôles : les DEUX incohérences que l'invariant refuse, fabriquées à la
main. La règle refuse désormais toute écriture cliente qui **change** `ownerUid`
(la condition porte sur le résultat, pas sur les clés touchées : effacer le champ
est refusé aussi). Renommer le club ou changer sa politique d'accès continue de
marcher.

**Ce qui a été fait.** Une Cloud Function `transferClubOwnership` (cœur pur dans
`functions/src/clubOwnership.ts`) qui écrit, dans **une seule transaction** : la
désignation, le rôle `owner` du nouveau, et un rôle **explicite** (`coach`) pour
l'ancien. Plus deux nettoyages : la fiche coach du nouveau propriétaire est
supprimée et son accès révoqué — un propriétaire n'est pas un joueur suivi.

Quatre décisions, et leurs raisons :

1. **L'ancien devient `coach`, pas `player`.** Le passer en joueur ferait
   apparaître son propre suivi d'entraînement dans l'effectif. Céder un club
   n'est pas consentir à être suivi. En `coach`, il garde l'encadrement complet,
   perd exactement les gestes du propriétaire, et peut ensuite être retiré
   **normalement** — la séquence complète est testée.
2. **Un joueur peut recevoir la propriété.** Aujourd'hui aucun chemin ne crée un
   second coach : exiger un coach rendrait le transfert inutilisable dans la
   seule situation où il sert.
3. **Le refus de cible est parlant, les refus d'autorité ne le sont pas.**
   L'autorité est vérifiée **avant** toute lecture de la cible : seul le
   propriétaire de ce club atteint « cette personne n'est pas dans l'effectif
   actif », à propos d'un uid qu'il lit déjà dans son propre effectif. Il
   n'apprend rien. Même raisonnement qu'au retrait, refait et non recopié.
4. **Le rejeu est traité explicitement** — c'est le piège du lot. Après un
   transfert, l'ancien propriétaire n'est plus autorisé à initier : un double
   appui tomberait sur un refus alors que le geste a **réussi**. Une fenêtre de
   rejeu très étroite (le club désigne déjà la cible demandée, la cible porte
   déjà le rôle, l'appelant est exactement le sortant enregistré, et il est
   encore membre actif) renvoie un succès **sans écrire une seule ligne**.

**L'outil administrateur.** Un club dont l'autorité est incohérente n'a
**personne** d'autorisé : le chemin normal ne peut rien y réparer. Un script
one-shot (`clubOwnershipCli.ts`, simulation par défaut, deux mots à taper pour
écrire) saute la vérification d'autorité et **rien d'autre**. Il n'est exporté
nulle part dans `index.ts` — un test le vérifie, parce qu'un chemin sans
vérification d'autorité ne doit avoir aucune route réseau.

_Ce qui reste ouvert :_ **l'écran**. Le serveur est prêt, l'écran de choix du
successeur n'existe pas, et surtout le nouveau propriétaire n'obtient pas l'espace
coach tout seul (`users/{uid}.role` n'est jamais touché par le transfert — le
basculer retirerait à un joueur actif sa propre app d'entraînement). Détail
complet, procédure et avertissements :
`docs/coach-pilote-2026-07/TRANSFERT_PROPRIETE.md`.

_Tests qui le prouvent :_ `functions/tests/clubOwnership.test.ts` (47 tests :
matrice des appelants · incohérences · admissibilité de la cible · rejeu ·
atomicité · concurrence à deux cibles · transfert pendant un retrait et
l'inverse · transfert pendant l'émission d'un code · séquence transfert puis
retrait · sobriété de l'audit · mode administrateur · cloisonnement),
`firestore-tests/rules.clubOwnershipTransfer.test.ts` (23 tests contre les vraies
règles), `domain/__tests__/clubRoles.test.ts` (ce que l'écran dit).

### Limite 2 — TRANCHÉE (2026-07) : note privée et directive sont séparées

**Le défaut.** Une règle Firestore autorise ou refuse **un document entier** ; elle
ne masque pas un champ. Le joueur lisait donc le cadre de la semaine **avec** la
note libre du coach, et cette note repartait dans le contexte envoyé au backend
de génération. L'écran joueur ne l'affichait jamais — **mais ne rien afficher
n'est pas une protection** : la donnée était bien sur l'appareil.

**Ce qui a été fait.** L'option (b) a été retenue, et complétée par le concept qui
manquait. Deux objets distincts, dans deux collections distinctes :

| | Note privée | Directive d'entraînement |
|---|---|---|
| Document | `clubs/{clubId}/coachNotes/{weekKey}` | `clubs/{clubId}/directives/current` |
| Lecture joueur | **refusée** (`get` et `list`) | **autorisée** (`get`) |
| Lecture coach / owner | oui | oui |
| Écriture | coach seul | coach seul |
| Envoyée au backend | **jamais** | oui, si active et dans sa fenêtre |
| Contenu | texte libre, 200 car. | catégorie fermée + consigne 160 car. + `validFrom`/`validUntil` + statut |

Le champ `note` est en outre **banni du cadre de semaine** : la règle refuse toute
écriture cliente dont le résultat le contiendrait. La contrainte porte sur le
RÉSULTAT (`request.resource.data`), pas sur les clés touchées — un merge qui
laisserait une note ancienne en place est refusé lui aussi.

_Tests qui le prouvent :_ `rules.coachPrivacy.test.ts` (13 tests + 1 témoin :
même joueur, même seconde, refus sur la note et succès sur la directive) et
`rules.weekContexts.test.ts`, tests 11 à 14.

**Résidu — OUTILLÉ (27/07).** Un document écrit AVANT ce changement porte encore
sa note et reste lisible par les membres du club : aucune règle ne peut effacer
rétroactivement un champ. L'écran coach déplace ce texte vers la note privée au
premier enregistrement du cadre (sauvetage AVANT suppression, testé) — mais
compter sur la réouverture manuelle de chaque semaine n'est pas une protection,
c'est un espoir. Une **commande administrateur** existe désormais pour solder
l'historique, avec sa commande de vérification :
`docs/coach-pilote-2026-07/MIGRATION_NOTES.md`. Elle n'a **jamais été exécutée**.
_Test qui le prouve (côté règles) :_ `rules.weekContexts.test.ts`, test 10.
_Tests de la migration :_ `functions/tests/weekContextNoteMigration.test.ts`.

**Effet produit assumé.** La note ne pèse plus sur les séances — c'était le but.
C'est la directive qui reprend ce rôle, avec une visibilité joueur affichée au
coach **avant** la saisie, et l'avertissement de n'y mettre aucune donnée de
santé. Aucune note n'est jamais convertie en directive : ni automatiquement, ni
par suggestion.

**⚠️ La directive n'est PAS encore appliquée aux séances (27/07).** Elle est bien
transmise au backend, mais le moteur de génération **ne la lit pas**. Aucun texte
affiché ne prétend le contraire : le coach comme le joueur lisent « Fonction en
préparation — cette directive n'est pas encore appliquée aux séances ». La
création vit derrière une capacité explicite (`config/coachFeatures.ts`,
`DIRECTIVE_CREATION`, activée par défaut) : la couper retire le bloc entier de
l'écran. _Tests :_ `domain/__tests__/clubDirectivePromesse.test.ts` (balayage
anti-promesse de toutes les constantes exportées) et
`screens/coach/__tests__/CoachWeekScreen.test.tsx` (balayage du rendu + capacité
coupée).

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

### Lot « transfert de propriété » (juillet 2026)

| Fichier | Nature |
|---|---|
| `functions/src/clubOwnership.ts` | **nouveau** — le cœur pur du transfert (aucune décision ailleurs) |
| `functions/src/clubOwnershipApi.ts` | **nouveau** — l'enveloppe appelable, sans aucune décision |
| `functions/src/clubOwnershipCli.ts` | **nouveau** — l'outil administrateur, jamais déployé, jamais exporté |
| `functions/src/clubMembersApi.ts` | le journal d'incohérence devient partagé (`logClubAuthorityInconsistency`) |
| `functions/src/index.ts` | export de la seule callable `transferClubOwnership` |
| `firestore.rules` | `ownerUid` n'est plus écrivable par aucun client (`changesOwnerUid`) — seule modification de comportement |
| `functions/tests/clubOwnership.test.ts` | **nouveau** — 47 tests |
| `firestore-tests/rules.clubOwnershipTransfer.test.ts` | **nouveau** — 23 tests contre les vraies règles |
| `domain/clubRoles.ts` | `clubMembershipCopy` : ce que l'écran dit d'une appartenance (n'accorde aucun droit) |
| `components/settings/ClubManagementCard.tsx` | ne propose plus « Quitter le club » à un propriétaire |
| `docs/coach-pilote-2026-07/TRANSFERT_PROPRIETE.md` | **nouveau** — usage, procédure administrateur, ce qui reste à faire |

Aucun test existant n'a été modifié ni affaibli.

### Lot précédent (matrice des droits)

| Fichier | Nature |
|---|---|
| `firestore.rules` | `weekContexts` : `allow read` remplacé par `allow get` + `allow list: if false` (seule modification de comportement du lot) |
| `firestore-tests/rules.coachRightsMatrix.test.ts` | **nouveau** — les scénarios 1 à 8 et 10, un test par tentative |
| `firestore-tests/rules.weekContexts.test.ts` | **nouveau** — la fuite, le correctif, ce qui reste ouvert, et le témoin |
| `functions/tests/callableRights.test.ts` | **nouveau** — le scénario 9 et les deux faiblesses mesurées |
| `docs/coach-pilote-2026-07/MATRICE_DROITS_COACH.md` | **nouveau** — ce document |

Aucun test existant n'a été modifié ni affaibli. Aucun fichier applicatif n'a été
touché en dehors des règles.
