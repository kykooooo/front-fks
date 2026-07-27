# Transfert de propriété d'un club — mode d'emploi

_Pilote coach FKS — juillet 2026._
_Pour Kyllian : français simple. Derrière chaque promesse, le fichier qui décide
et le test qui le vérifie._

---

## 1. À quoi ça sert, et quand s'en servir

Un club FKS a **un propriétaire**, et un seul. C'est le compte qui a créé le
club. Il peut tout faire : régler le club, générer un code d'invitation,
supprimer un cadre de semaine ou une directive, et retirer un membre.

Le transfert de propriété sert à **passer le brassard de capitaine** — sans que
personne ne le porte deux fois, et sans qu'il tombe par terre entre les deux.

Trois situations réelles :

1. **Un fondateur quitte le club.** C'est le cas principal. Tant que la propriété
   n'a pas changé de main, on ne peut pas le retirer de l'effectif : le serveur
   refuse avec un message explicite (« transfère d'abord la propriété »). C'était
   une impasse jusqu'à ce lot — le geste demandé n'existait pas.
2. **Le compte du propriétaire est perdu** (il a quitté le club amateur, ou son
   compte est inutilisable). Voir §6, la procédure de réparation.
3. **Le club change de responsable en interne**, sans que personne ne parte.

> **Ce que ce n'est PAS.** Le transfert ne supprime aucun compte, ne touche à
> aucun historique d'entraînement, et ne fait sortir personne du club. Il change
> qui commande, pas qui joue.

---

## 2. Ce qui se passe exactement, en une seule fois

Le transfert écrit **trois choses dans une seule transaction** — c'est-à-dire :
soit les trois passent, soit aucune. Il n'existe aucun instant, même d'un
millième de seconde, où le club n'aurait pas de propriétaire, ou en aurait deux.

| # | Ce qui est écrit | Pourquoi |
|---|---|---|
| 1 | `clubs/{clubId}.ownerUid` → le nouveau | la désignation |
| 2 | l'appartenance du **nouveau** → rôle `owner` | l'autorité exige les **deux** sources |
| 3 | l'appartenance de l'**ancien** → rôle `coach` | un rôle **explicite**, jamais un trou |

Et deux nettoyages, dans la même transaction :

- la **fiche coach** (projection) du nouveau propriétaire est supprimée, et son
  autorisation d'accès passe à « révoquée ». Un propriétaire n'est pas un joueur
  suivi : son entraînement personnel cesse d'apparaître dans l'effectif ;
- l'audit : le club retient **quand** le transfert a eu lieu, **depuis qui**, et
  **par quel chemin** (propriétaire, ou outil administrateur). Rien d'autre.

### Pourquoi l'ancien propriétaire devient « coach » et pas « joueur »

Parce que le passer en joueur ferait apparaître **son propre suivi
d'entraînement** dans l'effectif consulté par les encadrants. Céder la propriété
d'un club n'est pas accepter d'être suivi.

En `coach`, il garde exactement ce qui fait un encadrant : l'effectif, le cadre
de semaine, la note privée, la directive, le code d'invitation, le retrait d'un
membre. Il perd exactement ce qui appartient au propriétaire : modifier le
document du club, supprimer un cadre ou une directive, et initier un nouveau
transfert. Et il peut, **à partir de là**, être retiré du club normalement.

### Qui peut recevoir la propriété

Une personne qui est **déjà membre actif de ce club** — joueur ou coach.

- un **joueur** peut devenir propriétaire : c'est même le cas courant, puisque
  aujourd'hui aucun chemin, ni dans l'app ni côté serveur, ne crée un second
  coach. Exiger un coach rendrait le transfert inutilisable ;
- un membre **retiré** (pierre tombale) ne le peut pas ;
- un compte qui **n'a jamais rejoint** le club ne le peut pas ;
- **soi-même** : refusé, avec un message qui le dit (« ce club vous appartient
  déjà »).

---

## 3. Ce qui est garanti — et ce qui ne l'est pas

### Garanti, et prouvé par des tests

| Promesse | Le test qui la vérifie |
|---|---|
| Seul le propriétaire peut initier (coach, joueur, propriétaire d'un autre club, inconnu : tous refusés, **avec le même message**) | `functions/tests/clubOwnership.test.ts` §2 |
| Un club dont l'autorité est **incohérente** ne peut pas changer de main par ce chemin, et l'anomalie est **signalée** | §3 |
| La cible doit être un membre **actif** de ce club | §4 |
| **Idempotence** : rejouer le même geste renvoie un succès et **n'écrit rien**, pas même un horodatage | §5 |
| **Jamais zéro ni deux propriétaires**, y compris pendant la transaction | §6 (l'invariant est vérifié à **chaque lecture**) |
| **Double soumission** : deux appels identiques en même temps → un seul transfert, deux succès | §6 |
| **Deux cibles différentes en même temps** → une seule gagne, l'autre est refusée | §6 |
| Transfert **pendant** un retrait, et retrait **pendant** un transfert : les deux ordres finissent dans un état cohérent | §6 |
| Transfert **pendant** l'émission d'un code : le code sort quand même (l'ancien reste encadrant) | §6 |
| **Transférer puis retirer l'ancien** : la séquence complète passe, sans cas particulier | §7 |
| L'audit ne contient **ni nom de club, ni donnée de joueur, ni secret** | §8 |
| Aucun client ne peut écrire `ownerUid`, ni promouvoir quelqu'un d'autre | `firestore-tests/rules.clubOwnershipTransfer.test.ts` §A et §B |
| Après transfert : l'ancien perd les droits du propriétaire **immédiatement**, garde ceux de l'encadrant ; le nouveau les gagne | §C |
| Un `ownerUid` resté seul (orphelin) n'ouvre **rien** | §D |

### Non garanti — écrit noir sur blanc

1. **L'écran n'existe pas encore.** C'est une fonction serveur, appelable par
   l'application, mais aucun écran ne permet aujourd'hui de choisir un
   successeur. Voir §5.
2. **Le nouveau propriétaire n'obtient pas l'espace coach tout seul.** Voir §5,
   c'est le point le plus important de ce qui reste.
3. **La couche d'enveloppe des Cloud Functions n'est pas testée** — comme pour
   toutes les autres callables : `firebase-functions` et `firebase-admin` ne sont
   installés nulle part dans ce dépôt. Les fichiers `clubOwnershipApi.ts` et
   `clubOwnershipCli.ts` ne sont donc ni exécutés ni même vérifiés par le
   compilateur ici. Ils ne contiennent aucune décision : l'identité vient du
   jeton d'authentification, jamais de la charge utile, et tout ce qui décide vit
   dans `clubOwnership.ts`, testé intégralement.
4. **Une appartenance propriétaire orpheline que personne ne nomme reste en
   place.** Elle n'accorde aucun droit de propriétaire (il faut les deux
   sources), mais elle reste un état à réparer. L'outil administrateur sait la
   rétrograder **si on lui donne l'identifiant** — il ne sait pas la chercher
   tout seul.

---

## 4. La procédure administrateur, pas à pas

> À n'utiliser que quand le chemin normal ne peut pas fonctionner : compte du
> propriétaire perdu, ou club dont l'autorité est incohérente (§6).

### Avant de lancer quoi que ce soit — les trois vérifications

Dans la console Firebase (Firestore), noter :

1. **L'identifiant du club** — `clubs/{clubId}` ;
2. **Le propriétaire actuel** — le champ `ownerUid` du document club, ET le rôle
   porté par `clubs/{clubId}/members/{ownerUid}`. **Les deux.** S'ils ne
   concordent pas, c'est le cas §6 ;
3. **Le successeur** — vérifier que `clubs/{clubId}/members/{successeur}` existe
   et porte un rôle actif (`owner`, `coach` ou `player`). Un rôle `removed` ne
   passera pas.

### La commande

Depuis le dossier `functions/`, une fois les dépendances installées et le
compte de service configuré :

```bash
# 1. SIMULATION (par défaut) — ne modifie RIEN, affiche ce qui serait écrit
node lib/clubOwnershipCli.js --clubId=LE_CLUB --nouveauProprietaire=LE_SUCCESSEUR

# 2. POUR DE VRAI — les deux mots sont obligatoires
node lib/clubOwnershipCli.js --clubId=LE_CLUB --nouveauProprietaire=LE_SUCCESSEUR --apply --je-confirme
```

Options supplémentaires :

| Option | Ce qu'elle fait | Quand s'en servir |
|---|---|---|
| `--retrograde=UID` | rétrograde en `coach` une appartenance qui porte le rôle `owner` **sans être désignée** | réparation §6, cas 2 |
| `--espace-coach` | met `users/{successeur}.role = "coach"`, ce qui fait basculer son application sur l'espace coach | **⚠️ lire l'avertissement ci-dessous** |

> **⚠️ `--espace-coach` retire au successeur son application joueur.**
> Dans FKS, un compte voit soit l'espace joueur, soit l'espace coach — jamais les
> deux. Basculer un joueur qui s'entraîne encore lui enlève **son propre
> entraînement**. Ne l'utilise que si le successeur ne se sert plus de l'app
> joueur, et **préviens-le avant**. C'est précisément pour ça que le transfert
> normal n'y touche jamais tout seul (voir §5).

### Les garde-fous

1. sans `--apply`, **aucune écriture n'est possible** — le magasin d'écriture est
   remplacé, pas conditionné : on ne peut pas « oublier un si » ;
2. `--apply` seul ne suffit pas, il faut aussi `--je-confirme` ;
3. la sortie n'affiche que des identifiants, des rôles et des dates. Aucun nom de
   club, aucun prénom, aucune donnée d'entraînement.

### Après — les trois vérifications de sortie

Toujours dans la console Firestore :

1. `clubs/{clubId}.ownerUid` vaut bien **le successeur** ;
2. `clubs/{clubId}/members/{successeur}.role` vaut **`owner`** ;
3. `clubs/{clubId}/members/{ancien}.role` vaut **`coach`** (et **plus** `owner`).

Ces trois lignes ensemble, c'est la définition d'« un seul propriétaire ». Si
l'une des trois manque, quelque chose n'a pas été appliqué : ne pas relancer à
l'aveugle, relire d'abord.

Bonus, si tu veux la trace : le document club porte `ownershipTransferredAt`,
`ownershipTransferredFrom` et `ownershipTransferredMode` (`owner` ou `admin`).

---

## 5. Ce qui reste à faire côté interface

C'est la partie honnête du document. **Le serveur est prêt, l'écran n'existe
pas.** Voilà exactement ce qui manque, par ordre d'importance.

### 5.1 — L'espace coach du successeur (le vrai manque)

Aujourd'hui, `users/{uid}.role` décide de l'espace affiché par l'application :
`"coach"` → espace coach, sinon → espace joueur. **Le transfert n'y touche
jamais.** Conséquence concrète : un joueur qui reçoit la propriété a tous les
droits côté serveur, mais **continue de voir l'application joueur**. Il ne peut
pas ouvrir son effectif.

C'est un choix, pas un oubli : basculer son espace automatiquement lui retirerait
sa propre app d'entraînement, sans qu'il ait rien demandé.

**Ce qu'il faut construire :** un écran où le successeur **confirme**, en sachant
qu'il changera d'espace. En attendant, l'administrateur le fait avec
`--espace-coach`, après l'avoir prévenu.

### 5.2 — L'écran de choix du successeur

Le propriétaire devrait pouvoir, depuis l'effectif : choisir un membre, lire un
avertissement clair (« tu ne seras plus propriétaire ; tu resteras encadrant »),
et confirmer. La Cloud Function `transferClubOwnership` est déjà là et attend
`{ clubId, newOwnerUid }`.

Deux messages sont déjà rédigés côté serveur et prêts à être affichés tels quels :

- cible non admissible → « Cette personne ne fait pas partie de l'effectif actif
  de ce club… » (jeton `TRANSFER_TARGET_INELIGIBLE`) ;
- cible = soi-même → « Ce club vous appartient déjà… » (jeton
  `TRANSFER_TARGET_IS_SELF`).

### 5.3 — Déjà fait dans ce lot

La carte « Mon club » des réglages **ne propose plus « Quitter le club » à un
propriétaire**. Elle proposait ce bouton à tout le monde ; pour un propriétaire,
il échouait toujours, avec un « Réessaie » qui ne marchera jamais. Elle affiche
maintenant son rôle réel et, pour le propriétaire, la raison et le geste à faire.
_Fichiers :_ `domain/clubRoles.clubMembershipCopy`,
`components/settings/ClubManagementCard.tsx`.

---

## 6. Le club « à réparer » : incohérence héritée

### De quoi il s'agit

L'autorité d'un propriétaire repose sur **deux** sources : la désignation
(`ownerUid`) **et** son appartenance (`role: "owner"`). Quand les deux se
contredisent, FKS **refuse** au lieu de choisir laquelle des deux ment. Le coach
voit alors un bandeau « Club à réparer ».

Deux formes :

| Cas | Ce qu'on voit | Ce qui est fermé |
|---|---|---|
| **1. Désigné sans appartenance** | `ownerUid` = A, mais A n'a pas (ou plus) le rôle `owner` | A ne peut plus rien écrire sur le club. Il peut encore **lire** le document club — c'est ce qui rend l'anomalie visible plutôt que muette |
| **2. Appartenance sans désignation** | B porte le rôle `owner`, mais `ownerUid` désigne quelqu'un d'autre | B n'a **aucun** droit de propriétaire. Il reste encadrant, parce que `owner` est un rôle d'encadrement — c'est la limite exacte de ce que l'anomalie laisse ouvert |

### Pourquoi seul l'outil administrateur peut réparer

Dans cet état, **personne n'est autorisé** — pas même celui que `ownerUid`
désigne. Le chemin normal ne peut donc, par construction, rien débloquer : il
refuse, et il **signale** l'anomalie dans les journaux serveur (identifiants et
nature de l'écart, rien d'autre). C'est exactement pour ce cas que l'outil
administrateur existe.

### La réparation

**Cas 1 — désigné sans appartenance.** Choisir un membre actif du club et lui
transférer la propriété :

```bash
node lib/clubOwnershipCli.js --clubId=LE_CLUB --nouveauProprietaire=UN_MEMBRE_ACTIF --apply --je-confirme
```

L'ancien désigné n'a rien à rétrograder (il ne portait pas le rôle) : l'outil ne
lui écrit rien. Le champ `previousOwnerRole` sort à `null`, et c'est normal.

**Cas 2 — appartenance orpheline.** Même commande, en **nommant** l'appartenance
à rétrograder :

```bash
node lib/clubOwnershipCli.js --clubId=LE_CLUB --nouveauProprietaire=UN_MEMBRE_ACTIF --retrograde=LE_ROLE_ORPHELIN --apply --je-confirme
```

L'appartenance nommée repasse en `coach`. Elle n'accordait **aucun** droit de
propriétaire de toute façon — cette rétrogradation est de l'hygiène, pas une
fermeture de faille.

**Après :** refaire les trois vérifications de sortie du §4. Le bandeau « Club à
réparer » disparaît de lui-même au prochain chargement de l'espace coach.

### Comment on en arrive là

Aujourd'hui, **aucun chemin client ne peut produire cet état** :

- écrire `ownerUid` depuis un client est refusé par les règles (c'était possible
  avant ce lot — c'est le trou fermé ici) ;
- se promouvoir, ou promouvoir quelqu'un d'autre, au rôle `owner` est refusé ;
- le propriétaire ne peut pas supprimer sa propre appartenance.

Il reste donc **une seule origine possible : une intervention manuelle dans la
console Firebase.** C'est une bonne raison de passer par la commande plutôt que
par la console.

---

## 7. Où vivent les choses

| Fichier | Rôle |
|---|---|
| `functions/src/clubOwnership.ts` | **le cœur** : toute la décision, module pur, testable sans émulateur |
| `functions/src/clubOwnershipApi.ts` | l'enveloppe appelable (identité depuis le jeton, journal, traduction d'erreur) |
| `functions/src/clubOwnershipCli.ts` | **l'outil administrateur**, jamais déployé, jamais exporté dans `index.ts` |
| `functions/src/clubAuthority.ts` | **le prédicat partagé** — consommé, jamais dupliqué |
| `functions/src/clubMembers.ts` | le retrait ; le transfert lui emprunte ses chemins, son port de stockage et son type d'erreur |
| `firestore.rules` | ferme l'écriture cliente de `ownerUid` et du rôle propriétaire d'autrui |
| `domain/clubRoles.ts` | ce que l'écran **dit** (n'accorde aucun droit) |
| `functions/tests/clubOwnership.test.ts` | le cœur, interrogé comme par un attaquant et par un réseau qui bafouille |
| `firestore-tests/rules.clubOwnershipTransfer.test.ts` | les vraies règles, jouées par l'émulateur |

> **Une règle de maintenance, la même que pour le reste du prédicat :** le mode
> administrateur ne doit **jamais** être exporté depuis `index.ts`. Un test le
> vérifie (`functions/tests/clubOwnership.test.ts`, §10) — il saute la
> vérification d'autorité, donc il ne doit avoir aucune route réseau.
