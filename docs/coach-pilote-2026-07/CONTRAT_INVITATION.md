# Contrat d'invitation club — ancien, nouveau, et comment on bascule

**Date** : 27 juillet 2026
**Pour** : Kyllian
**Nature** : document de référence + procédure de déploiement. **Rien n'a été
exécuté** : aucune migration, aucun déploiement, aucune écriture en production.
**Source de l'analyse de départ** : `AUDIT_CODES_CLUB.md` (même dossier).

---

## En une image

L'ancien code club était **un badge de vestiaire** : celui qui l'a entre, on ne
regarde ni qui il est, ni depuis quand il l'a, ni combien de personnes sont
déjà passées avec. Pas de caméra, pas de serrure changeable, pas de videur.

Le nouveau code est **un billet nominatif à durée limitée** : le videur (le
serveur) le vérifie lui-même, le poinçonne, refuse au-delà d'un certain nombre
d'entrées, refuse après la date, et **refuse aussi de dire pourquoi** — parce
que « ce billet n'existe pas » et « ce billet est périmé » sont deux
informations qu'un faussaire utiliserait.

---

## 1. L'ancien contrat (ce qui existait jusqu'ici)

| Élément | Ancien fonctionnement |
|---|---|
| Fabrication | `PRÉFIXE-CHIFFRES` où le préfixe = 4 premières **lettres du nom du club**. Tirage `Math.random()`. |
| Entropie réelle | **~13 bits** (10 000 combinaisons) pour qui connaît le nom du club. |
| Stockage | **En clair, deux fois** : `clubs/{clubId}.inviteCode` et l'ID du document `inviteCodes/{CODE}`. |
| Lisibilité | Le code était lisible par **n'importe quel membre du club** (donc rediffusable par n'importe quel joueur). |
| Vérification | **Côté client** : un `getDoc` sur `inviteCodes/{code}`, autorisé à tout compte connecté. |
| Oracle | **Total** : un code inexistant répondait `exists() = false` sans erreur ; un code existant livrait `clubId` + **nom du club en clair**, silencieusement. |
| Entrée dans l'effectif | Le **joueur lui-même** écrivait `clubs/{id}/members/{uid}` en y recopiant le code (les règles comparaient au code réel du club). |
| Expiration | **Aucune**. |
| Nombre d'usages | **Illimité**. |
| Révocation | **Impossible** : `update` et `delete` interdits à tous sur `inviteCodes`. |
| Limite de tentatives | **Aucune**, à aucune couche. Pas d'App Check, pas de vérification d'e-mail. |
| Trace d'un abus | **Aucune**. |
| Coût d'une attaque | 10 000 lectures Firestore ≈ **moins d'un centime**, quelques minutes. |

**La phrase qui résume le risque, devant un dirigeant de club de mineures** :
*un adulte inconnu pouvait deviner le code, apparaître dans l'effectif, lire
toutes les notes de semaine du coach — et le coach n'avait aucun moyen de l'en
retirer.*

---

## 2. Le nouveau contrat

### Vue d'ensemble

| Élément | Nouveau fonctionnement | Où c'est écrit |
|---|---|---|
| Fabrication | `crypto.randomBytes`, jamais `Math.random`. Alphabet de 31 symboles **sans caractères ambigus** (ni I, L, O, 0, 1). 10 caractères, affichés `ABCDE-FGHJK`. | `functions/src/inviteCodes.ts` |
| Entropie réelle | **~49,5 bits** (31¹⁰ ≈ 8,2 × 10¹⁴). Le nom du club n'entre plus dans le code. | idem |
| Stockage | **Uniquement l'empreinte** : le document est `inviteCodes/{sha256(code normalisé)}`. Le code en clair n'existe **nulle part** en base. | idem |
| Lisibilité | **Aucune, pour personne.** `inviteCodes`, `clubInviteMeta` et `inviteAttempts` sont fermées à tous les clients. | `firestore.rules` |
| Vérification | **100 % serveur**, par la Cloud Function `joinClubWithInviteCode`. | `functions/src/clubInvites.ts` |
| Oracle | **Supprimé.** Code inconnu, expiré, révoqué, épuisé, club disparu, saisie vide → **exactement** le même code d'erreur et le même message. | verrouillé par test |
| Entrée dans l'effectif | Écrite par le **serveur** (Admin SDK). Un client ne peut plus créer ni modifier un membership « player ». | `firestore.rules` |
| Expiration | **14 jours** (`INVITE_CODE_TTL_MS`). | `functions/src/inviteCodes.ts` |
| Nombre d'usages | **30 maximum** (`INVITE_CODE_MAX_USES`), compteur incrémenté **dans une transaction**. | idem |
| Révocation | **Émettre un nouveau code révoque le précédent**, immédiatement. | idem |
| Limite de tentatives | Fenêtre glissante de **15 min** : **5 échecs par compte**, **20 par origine réseau** → blocage **1 h**. Fail-closed. | idem |
| Trace d'un abus | Un `logger.warn` au **franchissement de seuil** : portée, uid, horodatage. **Jamais** le code tenté ni son empreinte. | `functions/src/clubInvites.ts` |
| Coût d'une attaque | Sans limite de débit, il faudrait ~8 × 10¹⁴ essais. Avec la limite : 5 essais par compte et par quart d'heure. | — |

### Pourquoi un SHA-256 simple et pas un bcrypt/argon2

Un « hachage lent » existe pour compenser la **faible entropie d'un mot de passe
humain**. Ici, l'entrée est un secret tiré au hasard à ~49,5 bits, jamais choisi
par un humain, jamais réutilisé ailleurs, et **qui expire en 14 jours**. Un
attaquant qui volerait la base devrait parcourir ~8 × 10¹⁴ candidats pour UN
code déjà périmé. À l'inverse, un KDF lent coûterait à **chaque tentative
légitime** (latence + facture Cloud Functions). Le vrai garde-fou ici, ce n'est
pas la lenteur du hachage : c'est l'expiration + la révocation + la limitation
de tentatives. Ce choix est commenté dans le code, à l'endroit où il s'applique.

### Ce qui change pour le coach (à dire, pas à découvrir)

1. Le code **n'est plus créé avec le club**. Il se génère à la demande, dans
   l'onglet **Semaine**.
2. Il **s'affiche une seule fois**. Il n'est plus stocké en clair, donc il n'est
   plus relisible — ni par l'app, ni par personne.
3. S'il est perdu : **en générer un nouveau**. L'écran annonce, avant comme
   après, que **l'ancien cesse de fonctionner**.
4. **Régénérer n'exclut personne** : les joueurs déjà dans l'effectif y restent.
   Leur accès repose sur l'existence de leur membership, jamais sur le code.

### Ce qui change pour le joueur

1. Le code refusé produit un message **français, actionnable**, jamais une
   phrase Firebase en anglais.
2. **Son profil est enregistré AVANT toute tentative de rattachement.** Un code
   refusé ne fait plus perdre le questionnaire d'inscription — c'était le défaut
   le plus coûteux commercialement de l'ancien parcours (`AUDIT_CODES_CLUB.md`
   §8, cas B). Il peut réessayer depuis **Profil → Mon club**, ou continuer sans
   club.
3. Le joueur **ne voit plus le code de son club** dans ses réglages : il n'avait
   aucune raison de pouvoir le rediffuser.

### Ce qui n'a PAS changé (volontairement)

- La frontière coach-safe : aucune donnée de santé, aucun commentaire libre,
  aucun RPE/TSB ne transite vers le coach.
- Un joueur peut toujours **quitter son club** lui-même ; l'owner peut toujours
  retirer un membre.
- Le coach crée toujours son club et son propre membership « coach » depuis
  l'application.
- **Le trou « on ne peut pas expulser un intrus » n'est pas refermé par ce lot** :
  les règles autorisent l'owner à supprimer n'importe quel membre, mais aucun
  écran coach ne propose encore le geste. C'est un chantier distinct, et il
  reste ouvert. Ce lot réduit énormément la probabilité qu'un intrus entre ; il
  ne fournit pas le bouton pour le sortir.

---

## 3. Durée de validité

| Paramètre | Valeur | Constante |
|---|---|---|
| Validité d'un code | **14 jours** | `INVITE_CODE_TTL_MS` |
| Usages maximum | **30** | `INVITE_CODE_MAX_USES` |
| Fenêtre d'observation des échecs | **15 minutes** | `INVITE_ATTEMPT_WINDOW_MS` |
| Échecs tolérés par compte | **5** | `INVITE_ATTEMPT_MAX_PER_USER` |
| Échecs tolérés par origine réseau | **20** | `INVITE_ATTEMPT_MAX_PER_ORIGIN` |
| Durée du blocage | **1 heure** | `INVITE_ATTEMPT_BLOCK_MS` |

**Pourquoi 14 jours et 30 usages** : c'est calibré sur le geste réel d'un coach
amateur — il colle le code dans le groupe de l'équipe, tout le monde s'inscrit
dans la quinzaine. Un effectif de club amateur dépasse rarement 30. Un code qui
traîne dans une conversation trois mois plus tard ne doit plus ouvrir la porte.
Ces valeurs sont **exportées et documentées** : les changer se fait à un seul
endroit, et les tests les lisent au lieu de les recopier.

**Le coach voit-il l'expiration ?** Oui, à l'émission : la date est écrite sous
le code. Il n'y a **pas** de notification d'expiration — assumé : le coach
constate qu'un joueur n'arrive pas à entrer, et régénère. Ajouter une alerte
supposerait de savoir quand il consulte, ce qu'on ne sait pas.

---

## 4. Procédure de révocation

### Cas 1 — le coach a perdu son code, ou il a fuité

Onglet **Semaine** → **« Générer un nouveau code »**.
Effet immédiat, en une transaction :

1. l'empreinte du code précédent reçoit `revokedAt` → il est refusé dès l'appel
   suivant ;
2. une nouvelle empreinte est créée ;
3. le pointeur `clubInviteMeta/{clubId}.activeCodeHash` est mis à jour.

**Un seul code vivant par club, à tout instant.**

### Cas 2 — un intrus est déjà entré

Régénérer **ne suffit pas** : son accès ne dépend plus du code. Il faut
**supprimer son document de membership** (`clubs/{clubId}/members/{uid}`). Les
règles l'autorisent à l'owner du club — mais **aucun écran ne le propose
encore**. Aujourd'hui, cela se fait en console Firebase. C'est le chantier
« retirer un joueur de l'effectif », à ouvrir.

### Cas 3 — révocation en urgence, sans passer par l'app

En console Firebase : poser `revokedAt` (horodatage en millisecondes) sur le
document `inviteCodes/{empreinte}` du club. Comme l'empreinte n'est pas
réversible, on identifie le bon document par `clubId`, ou via
`clubInviteMeta/{clubId}.activeCodeHash`.

---

## 5. Stratégie de migration

### Le fait qui rend tout facile — et qui ne durera pas

**Il n'y a AUCUN code en circulation.** La production a été entièrement vidée
le 21/07 (collections `clubs` et `users` supprimées, comptes pilotes supprimés).
Donc :

- **aucun club à migrer**,
- **aucun joueur à prévenir**,
- **aucun code à honorer pendant une période de transition**,
- **aucun script de bascule à écrire**.

> **Cette fenêtre se referme au premier club pilote inscrit.** Après, il faudra
> une double lecture temporaire (accepter l'ancien contrat ET le nouveau), un
> script de conversion, et prévenir des coachs que leur code change. Le coût
> passe de **zéro** à **plusieurs jours de travail plus un message gênant à
> envoyer**. La bonne date, c'est maintenant.

### Ce que la bascule implique concrètement

| Étape | Nature | Statut |
|---|---|---|
| Déployer les 2 Cloud Functions (`issueClubInviteCode`, `joinClubWithInviteCode`) en `europe-west4` | serveur | à faire par Kyllian |
| Publier la mise à jour front (OTA) | client | à faire par Kyllian |
| Déployer `firestore.rules` | serveur | à faire par Kyllian, **après ou avec** le front |
| Convertir des codes existants | — | **sans objet : il n'y en a pas** |
| Nettoyer d'anciens documents `inviteCodes` | — | **sans objet : la collection est vide** |

### Vérification après bascule (à faire en vrai, sur un club de test)

1. Créer un club → le toast dit « Génère ton code depuis l'onglet Semaine ».
2. Générer un code → il s'affiche, avec sa date de validité et son quota.
3. Rejoindre avec ce code depuis un second compte → l'effectif se remplit.
4. Régénérer → l'ancien code est refusé, le joueur déjà entré est toujours là.
5. Saisir un code au hasard 6 fois de suite → la 6ᵉ tentative annonce « trop de
   tentatives », **même avec le bon code**.

---

## 6. SÉQUENCE DE DÉPLOIEMENT — l'ordre n'est pas négociable

### La règle

> **Les Cloud Functions d'abord. Le front ensuite. Les règles Firestore en
> dernier — ou en même temps que le front, JAMAIS avant.**

### Pourquoi

Le front part en **OTA** (`eas update`), donc sans passer par les stores. Mais
un OTA n'atteint un téléphone **qu'à l'ouverture de l'application**. Un joueur
qui n'ouvre pas FKS pendant trois jours garde l'ancienne version pendant trois
jours.

Or l'ancienne version fait exactement deux choses que les nouvelles règles
interdisent : un `getDoc` sur `inviteCodes/{code}`, et l'écriture directe de son
propre membership « player ». Si les règles partent **avant** le front :

- à l'inscription, l'erreur remonte au `catch` global de l'écran de profil,
  qui affiche « **Impossible d'enregistrer le profil** » — un message **faux**,
  et **le questionnaire est perdu** ;
- depuis les réglages, le joueur lit une phrase **en anglais** du type
  *« Missing or insufficient permissions »*.

Ces deux défauts sont corrigés **dans le nouveau front**. Les déployer dans le
bon ordre, c'est la différence entre « personne ne remarque rien » et « les
premiers testeurs perdent leur inscription ».

Inversement, déployer les Functions **en premier** ne casse rien : personne ne
les appelle encore.

### La séquence, pas à pas

| # | Action | Commande / geste | Effet si on l'oublie |
|---|---|---|---|
| 1 | Déployer les Functions | `firebase deploy --only functions:issueClubInviteCode,functions:joinClubWithInviteCode` | Le nouveau front appelle une fonction absente → `functions/not-found` → message « réessaie », profil sauvegardé quand même. |
| 2 | Publier le front | `eas update --channel testflight` | Les téléphones gardent l'ancien parcours ; il fonctionne encore tant que l'étape 3 n'est pas faite. |
| 3 | Déployer les règles | `firebase deploy --only firestore:rules` | **Tant que ce n'est pas fait, l'ancien contrat reste ouvert** : l'oracle et le self-join sont encore exploitables. C'est l'étape qui ferme réellement le trou. |

**Fenêtre entre 2 et 3** : garder courte (quelques heures suffisent pour vérifier
que le nouveau parcours fonctionne). Pendant cette fenêtre, les deux mondes
coexistent sans se gêner.

**Aucun fichier natif n'est touché par ce lot** → pas de rebuild EAS nécessaire,
l'OTA suffit.

### Compatibilité des anciennes versions, cas par cas

Reprise des cas A à E de l'audit, mis à jour avec ce qui est réellement livré :

| Cas | Ce qui se passe pour un téléphone resté sur l'ancienne version |
|---|---|
| **A** — code plus aléatoire | **Rien ne casse.** L'ancien nettoyage de saisie accepte lettres, chiffres et tirets ; il n'y a pas de longueur maximale bloquante à l'inscription. |
| **B** — lecture de `inviteCodes` fermée | **Casse le rattachement**, avec les deux messages défaillants décrits plus haut. **C'est le cas qui impose la séquence.** |
| **C** — expiration / quota ajoutés | **Sans danger ici** : l'expiration et le quota ne sont PAS évalués côté client, mais dans la Function, et l'écriture cliente du membership est fermée par les règles. Le piège de l'audit (« une vieille version contourne l'expiration ») est fermé par la règle, pas seulement par le document. |
| **D** — champ `name` retiré de l'annuaire | **Sans objet** : l'annuaire n'est plus lisible du tout. |
| **E** — usage unique par suppression du document | **Non retenu** : on ne supprime pas, on borne (`maxUses`) et on révoque (`revokedAt`) — un document conservé permet de dire « épuisé » sans jamais l'avouer au client. |

---

## 7. Ce qui reste ouvert (honnêteté)

1. **Retirer un joueur de l'effectif** : les règles l'autorisent à l'owner,
   aucun écran ne le propose. Chantier distinct, réellement nécessaire.
2. **App Check** : toujours absent. Ce lot le compense par la limitation de
   tentatives côté serveur, ce qui est suffisant pour l'usage visé, mais App
   Check reste le garde-fou qui empêcherait d'appeler les callables hors de
   l'application.
3. **Vérification d'e-mail à l'inscription** : toujours absente. Créer un compte
   reste gratuit ; c'est pourquoi la limitation par **origine réseau** existe en
   plus de celle par compte.
4. **Lecture en bloc des notes de semaine par un membre** : signalé par l'audit
   (§3), non traité ici. Le lot réduit la probabilité qu'un inconnu devienne
   membre ; il ne change pas ce qu'un membre peut lire.
5. **Expiration silencieuse** : le coach n'est pas prévenu quand son code
   expire. Assumé.

---

## 8. Où c'est écrit dans le code

| Sujet | Fichier |
|---|---|
| Cœur métier (génération, hachage, expiration, révocation, quota, fenêtre de tentatives) | `functions/src/inviteCodes.ts` |
| Callables + adaptateur Firestore + journalisation | `functions/src/clubInvites.ts` |
| Export des fonctions déployées | `functions/src/index.ts` |
| Fermeture des trois collections + membership « player » serveur-seul | `firestore.rules` |
| Appels front + messages français | `services/clubInvites.ts` |
| Ordre profil → club à l'inscription | `screens/profileSetup/attachClub.ts` |
| Émission côté coach (mémoire d'écran uniquement) | `hooks/coach/useClubInviteCode.ts` |
| Tests du contrat serveur (dont l'égalité stricte des refus et la concurrence) | `functions/tests/inviteCodes.test.ts` |
| Tests des règles (émulateur) | `firestore-tests/rules.clubsInvitation.test.ts` |
| Tests du parcours d'inscription | `screens/profileSetup/__tests__/attachClub.test.ts` |
| Tests des messages front | `services/__tests__/clubInvites.test.ts` |
