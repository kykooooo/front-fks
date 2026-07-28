# Espace coach, espace joueur : qui voit quoi, et pourquoi

_Pilote coach FKS — juillet 2026._
_Pour Kyllian : français simple. Derrière chaque promesse, le fichier qui décide
et le test qui le vérifie._

---

## 1. Le problème, en une phrase

Quand la propriété d'un club changeait de main, le nouveau propriétaire obtenait
tous les droits **côté serveur**… et continuait de voir l'application **joueur**.
Il ne pouvait pas ouvrir son effectif. Le brassard changeait de bras, le maillot
non.

Et il y avait pire, découvert en tirant le fil : l'application choisissait
l'espace à afficher en lisant un champ que **l'utilisateur écrit lui-même**
(`users/{uid}.role`). N'importe quel joueur pouvait donc s'y déclarer coach et
ouvrir l'espace coach. Il n'y trouvait rien de lisible — la base refuse tout le
reste — mais l'écran s'ouvrait, avec ses titres et ses onglets. Un écran qui
s'ouvre sur du vide est un mensonge de plus.

---

## 2. Ce qui change

**Avant** : l'application demandait à une étiquette collée sur le compte
(« je suis coach »), et la croyait sur parole.

**Maintenant** : elle regarde la **feuille de match du club** — l'appartenance,
`clubs/{club}/members/{toi}` — et lit le rôle qui y est écrit. Ce document-là,
**aucune application ne peut l'écrire** : seul le serveur y touche (rattachement
par code d'invitation, transfert de propriété, retrait d'un membre).

La règle tient en une ligne :

> **Tu vois l'espace coach si — et seulement si — ton appartenance au club dit
> « propriétaire » ou « encadrant ».**

| Ton rôle sur la feuille de match | Ce que tu vois |
|---|---|
| `owner` (propriétaire) | espace **coach** |
| `coach` (encadrant) | espace **coach** |
| `player` (joueur) | espace **joueur** |
| `removed` (retiré du club) | espace **joueur** |
| aucune appartenance / aucun club | espace **joueur** |
| appartenance illisible (panne, réseau) | espace **joueur**, le temps de la panne |

Ce n'est **pas** une synchronisation entre deux champs — deux champs tenus en
accord finissent toujours par diverger. C'est une **dérivation** : il n'y a plus
qu'une source, et c'est celle que le serveur contrôle.

_Où ça vit :_ `domain/appSpace.ts` (la règle, sans Firestore), `hooks/useAppSpace.ts`
(l'abonnement temps réel), `navigation/RootNavigator.tsx` (l'aiguillage).

---

## 3. Ce que ça donne, cas par cas

### Après un transfert de propriété

1. Le serveur écrit, dans une seule transaction : la désignation du club, le rôle
   `owner` du successeur, le rôle `coach` de l'ancien.
2. L'application du successeur est **abonnée** à sa propre appartenance. Le
   changement arrive sur son téléphone **tout seul**, comme un message.
3. L'espace coach s'ouvre. **Pas de déconnexion, pas de redémarrage, pas de
   bouton à trouver.**

L'**ancien propriétaire garde l'espace coach** : son rôle `coach` est un rôle
d'encadrement. Il perd les gestes réservés au propriétaire (modifier le club,
supprimer un cadre ou une directive, initier un nouveau transfert), il garde
l'effectif, le cadre de semaine, la note privée, la directive et le code
d'invitation.

### Au redémarrage de l'application

Rien de spécial à prévoir : l'abonnement se repose et relit la même source.
L'espace ne dépend **d'aucune mémoire locale** que l'application aurait écrite
elle-même — donc d'aucune mémoire qu'on pourrait falsifier ou oublier d'effacer.

Pendant la seconde où la réponse arrive, l'application affiche son écran de
chargement **au lieu de parier**. Sans ça, un coach verrait clignoter
l'application joueur à chaque démarrage. Cette attente ne concerne que les
comptes rattachés à un club : sans club, la réponse est immédiate.

### Quand quelqu'un est retiré du club

Même chemin, en sens inverse : son appartenance devient une pierre tombale, et
son espace coach se referme aussi vite qu'il s'était ouvert.

### Quand un joueur triche

Il peut toujours écrire `role: "coach"` dans son propre profil — les règles
l'autorisent à écrire son document, et le restreindre champ par champ serait un
autre chantier. **Ça ne lui donne plus rien** : ce champ n'est plus lu par la
navigation. C'est écrit noir sur blanc, et testé contre les vraies règles
(`firestore-tests/rules.appSpace.test.ts`, section C).

---

## 4. LE CAS QU'IL FAUT REGARDER EN FACE : un propriétaire qui est aussi joueur

C'est la conséquence directe du transfert, et elle n'est **pas** réglée par ce
lot. Elle est décrite ici pour ne pas être découverte sur le terrain.

### Ce qui se passe concrètement

Un club n'a le plus souvent qu'un seul encadrant : le fondateur. Le jour où il
part, le seul successeur possible est **un joueur**. Le transfert le nomme
propriétaire — c'est prévu et assumé.

À la seconde où il devient propriétaire :

- il **gagne** l'espace coach (c'est ce que ce lot répare) ;
- il **perd l'accès à sa propre application d'entraînement** : ses séances, son
  cycle, sa progression, ses tests. Rien n'est supprimé — tout dort dans son
  compte — mais **il ne peut plus y accéder depuis l'application**, parce qu'un
  compte affiche un espace, jamais les deux ;
- il **sort de l'effectif suivi** : sa fiche est supprimée du tableau de bord des
  encadrants et son autorisation d'accès passe à « révoquée ». C'est voulu —
  céder la propriété d'un club n'est pas accepter d'être suivi par ses
  coéquipiers — mais ça veut dire que **le club perd un joueur suivi**.

### Est-ce que ce lot rend ce cas plus gênant ? Oui, et il faut le dire

Avant, le successeur ne changeait pas d'espace : il gardait son application
joueur, et son espace coach était simplement… absent. Le problème était visible,
bloquant, et il ne mangeait rien.

Maintenant la bascule est **automatique et immédiate**. C'est ce qu'on voulait —
et c'est aussi ce qui rend la perte réelle : le joueur qui accepte le brassard
perd son entraînement du jour au lendemain, sans écran pour le prévenir.

**Le garde-fou existant, à connaître :** le transfert est initié **par le
propriétaire sortant**, jamais subi. Aujourd'hui il n'existe aucun écran pour le
faire depuis l'application — le geste passe par l'outil administrateur, donc par
toi. Autrement dit : **personne ne peut se retrouver basculé par surprise sans
que tu aies lancé la commande.** Quand l'écran de transfert sera construit, il
devra porter cet avertissement — c'est la première ligne de son cahier des
charges.

### Les trois options possibles, aucune n'est implémentée

| Option | En clair | Ce que ça coûte |
|---|---|---|
| **A. Bascule d'espace** | un interrupteur « Voir mon espace joueur / mon espace coach » dans les réglages | le moins cher, et suffisant pour un club amateur. La dérivation actuelle donne déjà le **droit** aux deux : il ne manque qu'un choix affiché. **Recommandé.** |
| **B. Double accès permanent** | un onglet coach dans l'application joueur | plus confortable, beaucoup plus lourd : deux univers visuels dans une seule barre d'onglets, et toutes les questions de « qui voit quoi » à reposer écran par écran |
| **C. Rôle dédié « joueur-encadrant »** | un vrai rôle, avec ses règles | le plus propre sur le papier, le plus coûteux en vrai : ça touche le prédicat d'autorité partagé par les Functions, les règles et l'application. À ne faire que si le terrain le réclame |

> **Ce lot ne tranche pas.** Il ferme le contrat (le nouveau propriétaire obtient
> réellement son espace) et laisse cette décision entière — c'est une décision
> produit, pas une conséquence technique.

---

## 5. Quand l'interface refuse de proposer un geste

Il existe un état anormal, appelé **« club à réparer »** : la désignation du
propriétaire et son appartenance se contredisent (voir `TRANSFERT_PROPRIETE.md`
§6). Dans cet état, le serveur **refuse** les gestes d'encadrement — générer un
code, retirer un membre, transférer — et il a raison : on ne laisse pas un club
dont l'autorité est douteuse changer de main.

Le principe appliqué ici : **l'interface ne propose pas un geste que le serveur
refusera.**

- l'écran **Effectif** affiche déjà le bandeau « Club à réparer » et le geste à
  faire ;
- l'écran **Semaine** ferme maintenant la génération de code d'invitation, et
  **dit pourquoi**. Avant, le bouton était proposé, le coach appuyait, et
  récoltait un refus qu'aucun geste de sa part ne pouvait lever ;
- le **retrait d'un membre**, lui, reste proposé — c'est une décision prise au
  lot précédent et conservée volontairement : l'écran n'anticipe pas le verdict,
  le serveur répond un refus **typé**, et l'écran l'affiche tel quel (« transfère
  d'abord la propriété »). Masquer ce bouton aurait demandé de recopier le
  prédicat d'autorité dans l'écran, donc de le laisser dériver.

La ligne de partage, en une phrase : **on ferme un geste quand aucune action de
l'utilisateur ne peut le débloquer ; on le laisse quand le refus du serveur lui
apprend quoi faire.**

---

## 6. Ce qui n'est pas garanti — écrit noir sur blanc

1. **Aucun écran de transfert.** Le geste reste en ligne de commande
   (`TRANSFERT_PROPRIETE.md` §4). Ce lot ferme le contrat fonctionnel, pas
   l'interface.
2. **Le cas « propriétaire aussi joueur » n'est pas résolu**, seulement décrit
   (§4).
3. **Le champ `users/{uid}.role` reste écrivable** par son titulaire. Il ne
   décide plus de rien côté application ; plus personne ne l'écrit non plus
   (la création de club a cessé de le poser). Les comptes créés avant ce lot le
   portent encore : c'est un résidu sans effet.
4. **Une panne de lecture ferme l'espace coach le temps de la panne.** C'est
   volontaire (on n'ouvre pas un espace sur une question sans réponse), c'est
   réversible tout seul, et c'est théorique : sa propre appartenance est toujours
   lisible par son titulaire, donc un échec ici est un incident réseau.
5. **Un compte rattaché à un club attend une réponse de plus au démarrage** —
   l'écran de chargement dure le temps d'une lecture de document. Sans club, rien
   ne change.

---

## 7. Où vivent les choses

| Fichier | Rôle |
|---|---|
| `domain/appSpace.ts` | **la règle** : quel espace, à partir de quel rôle. Aucune dépendance, entièrement testable |
| `hooks/useAppSpace.ts` | l'abonnement temps réel à sa propre appartenance (pose, nettoyage, changement de compte) |
| `navigation/RootNavigator.tsx` | l'aiguillage, et l'attente avant d'afficher |
| `domain/clubRoles.ts` | la liste des rôles d'encadrement — **miroir** de `functions/src/clubAuthority.ts` et de `firestore.rules`, jamais un second prédicat |
| `firestore.rules` | ce qui rend tout ça possible : chacun lit sa propre appartenance, personne ne l'écrit |
| `domain/__tests__/appSpace.test.ts` | la règle, rôle par rôle |
| `hooks/__tests__/useAppSpace.test.tsx` | la bascule après transfert, le démarrage à froid, le nettoyage de l'abonnement |
| `navigation/__tests__/rootNavigatorSpaceWiring.test.ts` | la preuve que le navigateur est bien branché là-dessus, et plus sur l'ancien champ |
| `firestore-tests/rules.appSpace.test.ts` | les vraies règles, jouées par l'émulateur |
