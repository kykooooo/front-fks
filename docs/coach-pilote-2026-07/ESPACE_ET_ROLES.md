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
`clubs/{club}/members/{toi}` — et lit ce qui y est écrit. Ce document-là,
**aucune application ne peut l'écrire** : seul le serveur y touche (rattachement
par code d'invitation, transfert de propriété, retrait d'un membre).

### Deux colonnes sur la feuille de match, pas une

Depuis juillet 2026, l'appartenance porte **deux informations séparées**, parce
que ce sont deux questions différentes :

| Colonne | Ce qu'elle dit | Valeurs |
|---|---|---|
| `accessRole` | **est-ce que j'encadre ?** | `owner`, `coach`, ou rien |
| `playerStatus` | **est-ce que je m'entraîne ici ?** | `active`, `inactive`, ou rien |

**Les deux peuvent être remplies en même temps.** C'est le cas de
l'entraîneur-joueur — le plus courant en club amateur. Avant, une seule case
existait : écrire « coach » dedans **effaçait** « joueur ». Le brassard mangeait
le maillot.

La règle tient maintenant en deux lignes :

> **Tu vois l'espace coach si ton appartenance dit « propriétaire » ou
> « encadrant ».**
> **Tu vois l'espace joueur si tu n'encadres pas, ou si tu as un suivi sportif
> actif dans ce club.**

| Ta feuille de match | Ce que tu vois |
|---|---|
| `accessRole: owner` (sans suivi) | espace **coach** |
| `accessRole: coach` (sans suivi) | espace **coach** |
| aucun `accessRole`, `playerStatus: active` | espace **joueur** |
| `accessRole: coach` **+** `playerStatus: active` | **les deux**, avec un sélecteur |
| `accessRole: owner` **+** `playerStatus: active` | **les deux**, avec un sélecteur |
| pierre tombale (retiré : les deux fermés) | espace **joueur** |
| aucune appartenance / aucun club | espace **joueur** |
| appartenance illisible (panne, réseau) | espace **joueur**, le temps de la panne |

Ce n'est **pas** une synchronisation entre deux champs — deux champs tenus en
accord finissent toujours par diverger. Ce sont deux **axes indépendants**, dont
chacun répond à une seule question, et l'espace est **dérivé** des deux.

_Où ça vit :_ `domain/appSpace.ts` (la règle, sans Firestore), `hooks/useAppSpace.ts`
(l'abonnement temps réel), `navigation/RootNavigator.tsx` (l'aiguillage).

### Ce qui a été remplacé, et pourquoi sans migration

L'ancien champ unique `role` (quatre valeurs : `owner`/`coach`/`player`/`removed`)
**n'existe plus**. Il a été remplacé, pas doublé : le garder aurait laissé
« player » dans la colonne des permissions, donc gardé la moitié du piège.

**Aucun chemin de compatibilité n'a été écrit**, et c'est vérifiable plutôt que
supposé : la base de production a été vidée le 21 juillet (clubs et comptes
supprimés — voir `AUDIT_COACH.md`). Il n'existe aucun document à migrer. Un
document qui porterait encore l'ancien champ serait lu comme « aucune permission,
aucun suivi » : fermé, jamais deviné.

#### ⚠️ Cette phrase était vraie le 21 juillet. Elle se **recompte** avant chaque déploiement

« Il n'existe aucun document à migrer » est une **observation datée**, pas une
propriété du code. Elle peut être fausse le jour du déploiement : un club pilote
créé entre-temps par l'ancienne version aurait écrit des appartenances à l'ancien
schéma. Elles seraient lues fermées — donc sans danger pour la sécurité, mais
**un coach pilote perdrait son club sans qu'aucun message ne le dise**. « Sans
danger » et « sans conséquence » ne sont pas la même chose.

Cette page **ne suffit donc pas** à autoriser un déploiement. Ce qui l'autorise,
c'est un **préflight** qui recompte l'hypothèse à l'instant :

```bash
node lib/ancienSchemaPreflightCli.js --projet=<projectId> --limite=500
```

Lecture seule, aucune écriture possible, aucun identifiant en sortie. Verdict à
trois états et **code de sortie** : `PROPRE` (0) = l'hypothèse est vérifiée, on
peut déployer ; `RESIDU` (2) et `INCERTAIN` (3) = **on ne déploie pas**. Le mode
d'emploi complet, et ce qu'on fait quand le compte n'est pas zéro, sont dans
`INTEGRATION_BOUCLE.md` §5 (étape 1). Détail important : **la migration
correspondante n'existe pas** — elle reste à écrire.

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

## 4. LE CAS RÉGLÉ : un propriétaire (ou un coach) qui est aussi joueur

Ce paragraphe décrivait une limite. Il décrit maintenant la solution.

### Ce qui se passait avant

Un club n'a le plus souvent qu'un seul encadrant : le fondateur. Le jour où il
part, le seul successeur possible est **un joueur**. Le transfert le nommait
propriétaire — et, à la même seconde, lui **retirait sa propre application
d'entraînement** : ses séances, son cycle, sa progression, ses tests. Rien
n'était supprimé, mais plus rien n'était accessible. Il sortait aussi de
l'effectif suivi, et le club perdait un joueur.

La cause n'était pas une décision produit : c'était **une seule case pour deux
informations**. Écrire « propriétaire » écrasait « joueur », mécaniquement.

### Ce qui se passe maintenant

Les deux informations vivent dans **deux colonnes séparées** (§2). Le transfert de
propriété **ne touche que la colonne des permissions** :

- le nouveau propriétaire **garde son statut de joueur**, donc son suivi, donc sa
  fiche dans l'effectif, donc son application d'entraînement ;
- son autorisation d'accès (`coachAccess`) n'est **ni ouverte ni fermée** — le
  transfert ne parle pas de suivi, il ne décide donc rien à ce sujet ;
- l'ancien propriétaire, lui aussi, garde ce qu'il avait des deux côtés.

C'est vérifié de bout en bout par la séquence **joueur → propriétaire → retiré**
(`functions/tests/clubOwnership.test.ts`), qui contrôle le suivi **à chaque
étape**, pas seulement à l'arrivée.

### Le sélecteur Joueur / Coach

Quand une personne a **réellement** les deux espaces, l'application propose un
sélecteur et **mémorise localement** son dernier choix.

- Il apparaît **uniquement** dans ce cas. Un coach qui ne joue pas ne le voit pas ;
  un joueur qui n'encadre pas non plus. Un réglage qui ne sert à personne n'est
  pas affiché.
- Il est présent **dans les deux espaces** : réglages côté joueur, onglet
  « Semaine » côté coach. On ne peut pas s'enfermer dans l'un des deux.
- Par défaut, sans choix mémorisé, l'application ouvre **l'espace coach** : le
  joueur qui vient d'obtenir le brassard doit **voir** ce qu'il a gagné. Un geste
  suffit pour revenir à son entraînement, et ce geste est retenu.
- **Ce choix n'ouvre RIEN.** Il tranche entre deux espaces que le serveur a déjà
  autorisés. Un compte qui perd l'encadrement bascule vers l'espace joueur *même
  si* sa préférence dit « coach » ; un encadrant sans suivi reste côté coach
  *même si* elle dit « joueur ». Les deux pièges sont testés.
- La préférence est **par compte** (téléphone partagé) et **effacée avec le
  compte** (suppression de compte).

_Où ça vit :_ `hooks/useAppSpacePreference.ts` (la mémoire),
`state/appSpaceGate.ts` (le relais depuis la racine),
`components/AppSpaceSwitch.tsx` (l'écran).

### Comment un encadrant obtient un suivi sportif

En rejoignant l'effectif **comme tout le monde** : il saisit un code d'invitation
de son club. Le rattachement pose son statut de joueur **sans toucher à ses
permissions**.

C'est volontaire, et c'est la contrepartie honnête de tout le reste : **devenir
encadrant n'a jamais valu consentement à être suivi**, et ce lot ne change pas
ça. Ce qu'il change, c'est l'inverse — devenir encadrant ne **retire** plus le
suivi de quelqu'un qui l'avait déjà.

Conséquence à connaître : **le fondateur d'un club n'a pas de suivi dans son
propre club à la création**. S'il veut en avoir un, il utilise son propre code
d'invitation. C'est un geste de plus, explicite, et personne ne peut le faire à
sa place.

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
2. **Le fondateur d'un club n'a pas de suivi sportif dans son club** tant qu'il
   n'a pas utilisé son propre code d'invitation (§4). Aucun écran ne le lui
   propose aujourd'hui : il faut le savoir, ou le lire ici.
3. **Le champ `users/{uid}.role` reste écrivable** par son titulaire. Il ne
   décide plus de rien côté application ; plus personne ne l'écrit non plus
   (la création de club a cessé de le poser). Les comptes créés avant ce lot le
   portent encore : c'est un résidu sans effet. Le projecteur serveur, qui le
   lisait encore pour exclure les profils marqués « coach », **ne le lit plus** —
   il excluait à tort les entraîneurs-joueurs, et il ne protégeait rien puisque
   son titulaire l'écrit lui-même.
4. **Une seule écriture administrateur touche encore ce champ** :
   `adminTransferClubOwnership` avec l'option `grantCoachSpace`. Elle est sans
   effet depuis que l'espace est dérivé de l'appartenance ; elle est conservée et
   documentée dans `functions/src/clubOwnership.ts` (écriture 6), à solder par un
   lot dédié.
5. **Un compte peut avoir les deux espaces, jamais deux clubs.**
   `resolveClubPointer` refuse explicitement un pointeur ambigu plutôt que de
   choisir le premier de la liste (`domain/coachAuthority.ts`). Le jour où
   l'appartenance multiple arrivera, il faudra un vrai sélecteur de club — et un
   test tombera pour le rappeler.
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
| `functions/src/clubAuthority.ts` | **les deux axes**, côté serveur : `accessRole`, `playerStatus`, et le prédicat propriétaire |
| `functions/src/clubOwnership.ts` | le transfert — **un seul axe bouge** |
| `functions/src/clubMembers.ts` | le retrait — **les deux axes se ferment**, dans la même écriture |
| `functions/src/projector.ts` | qui entre dans l'effectif suivi : le **statut de joueur**, jamais les permissions |
| `functions/src/inviteCodes.ts` | le rattachement : il pose le statut de joueur, sans toucher aux permissions |
| `domain/appSpace.ts` | **la règle** : quels espaces sont ouverts, et lequel s'affiche. Aucune dépendance |
| `hooks/useAppSpace.ts` | l'abonnement temps réel à sa propre appartenance (pose, nettoyage, changement de compte) |
| `hooks/useAppSpacePreference.ts` | la mémoire locale du dernier espace choisi — **par compte**, et sans autorité |
| `state/appSpaceGate.ts` | le relais depuis la racine vers les deux écrans qui affichent le sélecteur |
| `components/AppSpaceSwitch.tsx` | le sélecteur Joueur / Coach (rend `null` sans droit aux deux) |
| `navigation/RootNavigator.tsx` | l'aiguillage, l'attente avant d'afficher, et **l'unique** publication du sélecteur |
| `domain/clubRoles.ts` | le miroir d'affichage des deux axes — jamais un second prédicat |
| `firestore.rules` | ce qui rend tout ça possible : chacun lit sa propre appartenance, personne ne l'écrit |
| `domain/__tests__/appSpace.test.ts` | la règle, axe par axe, préférence comprise |
| `hooks/__tests__/useAppSpace.test.tsx` | la bascule après transfert, le démarrage à froid, le nettoyage de l'abonnement |
| `hooks/__tests__/useAppSpacePreference.test.tsx` | la mémoire : par compte, résiliente, sans autorité |
| `components/__tests__/appSpaceSwitch.test.tsx` | le sélecteur : quand il apparaît, quand il disparaît |
| `navigation/__tests__/appSpaceSwitchWiring.test.ts` | un seul émetteur, et le sélecteur présent dans les deux espaces |
| `navigation/__tests__/rootNavigatorSpaceWiring.test.ts` | la preuve que le navigateur est bien branché là-dessus, et plus sur l'ancien champ |
| `functions/src/ancienSchemaPreflight.ts` | le **préflight** : recompte les appartenances à l'ancien schéma. Dernier endroit du code qui connaît encore le vocabulaire `role` — pour compter, jamais pour décider d'un droit |
| `functions/src/ancienSchemaPreflightCli.ts` | la commande à lancer avant de déployer (lecture seule, verdict + code de sortie) |
| `functions/tests/ancienSchemaPreflight.test.ts` | le compte exact, le verdict `INCERTAIN` sur lecture tronquée, la reprise sans trou ni doublon, l'absence de fuite |
| `functions/tests/clubOwnership.test.ts` | la séquence **joueur → propriétaire → retiré**, suivi vérifié à chaque étape |
| `firestore-tests/rules.appSpace.test.ts` | les vraies règles, jouées par l'émulateur (dont `playerStatus` interdit aux clients) |
