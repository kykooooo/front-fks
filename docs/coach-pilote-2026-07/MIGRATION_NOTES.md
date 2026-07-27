# Migration des anciennes notes de coach

_Pilote coach FKS — 27 juillet 2026._
_Pour Kyllian : français simple, analogies foot, et rien à deviner._

> **⚠️ CET OUTIL N'A JAMAIS ÉTÉ EXÉCUTÉ.** Ni en production, ni sur une base
> réelle, ni sur un export, ni même en simulation sur un projet réel. Il est
> écrit, relu et testé uniquement sur des données inventées. Le lancer est une
> décision humaine — la tienne.

---

## 1. À quoi ça sert, en une image

Avant, la note que le coach écrivait pour lui-même était rangée **dans le même
document que le cadre de la semaine**. Or ce document, **tous les joueurs du club
peuvent le lire**.

> C'est comme si le carnet du coach était punaisé au vestiaire. L'application ne
> l'affichait pas aux joueurs — mais le carnet était bien là, sur le mur, et
> n'importe qui pouvait le lire en tendant la main.

Depuis le 26 juillet, deux choses ont changé :

- **plus aucune nouvelle note** ne peut être écrite là (la base la refuse) ;
- quand le coach **réenregistre** une semaine, sa note ancienne est déplacée
  automatiquement vers le carnet privé.

**Ce qui reste à régler**, et c'est l'objet de cette page : les semaines que
personne ne rouvrira jamais. Leur note est toujours punaisée au vestiaire.
Attendre que chaque coach rouvre chaque semaine passée, **ce n'est pas une
protection, c'est un espoir**. D'où cette commande.

**Ce qu'elle fait, dans l'ordre :**

1. elle regarde chaque semaine de chaque club ;
2. elle **recopie** les textes trouvés dans le carnet privé du coach (là où aucun
   joueur ne peut lire) ;
3. elle **efface** ces textes du document public ;
4. les étapes 2 et 3 sont faites **ensemble ou pas du tout** : jamais une note
   effacée sans avoir été mise à l'abri.

---

## 2. Ce qu'elle cherche : tout, pas seulement le champ `note`

Un ancien build a pu écrire la note sous un autre nom (`notes`, `coachNote`,
`commentaire`, dans un sous-objet…). Chercher une **liste de noms interdits**
laisserait passer celui auquel personne n'a pensé.

On fait donc l'inverse. On connaît **exactement** ce qu'un cadre de semaine a le
droit de contenir :

```
weekKey · clubId · createdBy · trainingIntensity · weekGoal ·
matchThisWeekend · createdAt · updatedAt
```

**Tout le reste qui contient du texte est traité comme une note** et déplacé.

> Analogie : plutôt que de lister les objets interdits dans le sac (impossible,
> on en oublie), on liste les 8 objets autorisés. Tout ce qui dépasse sort.

Ce choix se trompe **du bon côté** : au pire, on déplace un champ qui n'était pas
vraiment une note — vers un endroit privé, sans rien perdre.

---

## 3. Avant de lancer quoi que ce soit

1. **Ne lance rien un jour de match.** Ce n'est pas urgent : la fuite est
   ancienne, une journée de plus ne change rien.
2. **Sauvegarde Firestore** (export). Cette commande ne détruit rien en principe
   — mais on ne lance pas une écriture en masse sans filet.
3. **Lance d'abord la vérification** (§6) pour savoir ce qu'il y a à faire :

```bash
node lib/weekContextNoteAuditCli.js
```

4. **Lance ensuite la simulation** (§4) et **relis les compteurs**.

---

## 4. La commande de SIMULATION (celle qui n'écrit rien)

C'est le mode **par défaut**. Il n'y a rien à taper pour l'obtenir : sans les
deux mots magiques, aucune écriture n'est possible — le morceau de code qui écrit
est **remplacé**, pas simplement mis en pause.

```bash
# Tous les clubs
node lib/weekContextNoteMigrationCli.js

# Un seul club (recommandé pour le premier essai)
node lib/weekContextNoteMigrationCli.js --clubId=LE_CLUB
```

Elle affiche exactement ce qu'elle **ferait**, sans le faire.

---

## 5. La commande d'EXÉCUTION (celle qui écrit)

Il faut **deux** mots, pas un :

```bash
# Un seul club d'abord, toujours
node lib/weekContextNoteMigrationCli.js --clubId=LE_CLUB --apply --je-confirme

# Puis, si tout va bien, toute la base
node lib/weekContextNoteMigrationCli.js --apply --je-confirme
```

`--apply` **tout seul est refusé** : la commande s'arrête et ne touche à rien.

---

## 6. La commande de VÉRIFICATION (à lancer après, et à relire)

C'est une commande **à part entière**, pas une case à cocher dans un test. Elle
ne fait que **lire** : il n'y a aucun risque à la lancer, autant de fois qu'on
veut.

```bash
node lib/weekContextNoteAuditCli.js
node lib/weekContextNoteAuditCli.js --clubId=LE_CLUB
```

Elle répond par un **verdict** :

| Verdict | Ce que ça veut dire | Quoi faire |
|---|---|---|
| `PROPRE` | plus **aucune** note dans un document lisible par un joueur, et tout a été lu | rien, c'est fini |
| `RESIDU` | il reste au moins une note punaisée au vestiaire | relancer la migration (§5) |
| `INCERTAIN` | rien trouvé, **mais** un document n'a pas pu être lu | relancer la vérification ; ne pas conclure « propre » |

> `INCERTAIN` existe pour une raison précise : **« je n'ai rien trouvé » et « je
> n'ai pas tout regardé » ne sont pas la même phrase.** Un outil qui confond les
> deux ment.

---

## 7. Comment lire les compteurs

La migration termine par une ligne de ce genre :

```
[migrationNotes] termine {"scannes":132,"detectes":9,"migres":9,"dejaMigres":0,
"sansNote":123,"disparus":0,"conflits":1,"erreurs":0,"champsDetectes":{"note":8,"notes":1}}
```

| Compteur | Ce que ça veut dire |
|---|---|
| `scannes` | semaines regardées, tous clubs confondus |
| `detectes` | semaines qui portaient au moins un texte à déplacer |
| `migres` | semaines traitées (en **simulation** : qui le seraient) |
| `dejaMigres` | semaines déjà passées lors d'un lancement précédent — normal si tu relances |
| `sansNote` | semaines propres, elles n'ont jamais rien eu à cacher |
| `disparus` | la semaine a été supprimée pendant que la commande tournait — sans gravité |
| `conflits` | le coach avait **déjà** une note privée **différente** pour cette semaine : les deux textes sont conservés (§8) |
| `erreurs` | semaines qui ont échoué. **Pour celles-là, rien n'a été écrit du tout** — relance la commande, elle les reprendra |
| `champsDetectes` | dans **quel champ** les textes étaient rangés, et combien de fois |

**Règle d'or de lecture :** `migres + dejaMigres + sansNote + disparus + erreurs`
doit être égal à `scannes`. Chaque semaine tombe dans **une seule** case.

**Ce que tu ne verras jamais dans cette sortie** : le contenu d'une note, un nom
de joueur, un identifiant de club, un identifiant de compte. Un journal de
migration rempli de notes de coach serait exactement ce qu'on est en train de
protéger. Un test le vérifie en cherchant les mots des notes de test dans la
sortie complète.

---

## 8. Le cas délicat : « le coach avait déjà une note »

Il peut arriver qu'une semaine ait **deux** textes : l'ancien (public) et un
nouveau que le coach a écrit depuis dans son carnet privé.

La commande **n'écrase jamais** le texte récent. Elle :

- **garde** la note privée récente comme note visible du coach ;
- **range** l'ancienne à côté, dans `legacyImport`, avec l'indication du champ
  d'où elle vient ;
- **compte** le cas dans `conflits`.

Rien n'est perdu, rien ne reste exposé. Si `conflits` est à zéro, il n'y a rien
de particulier à regarder.

---

## 9. Où ça atterrit exactement

| | Avant | Après |
|---|---|---|
| Document | `clubs/{club}/weekContexts/{semaine}` | `clubs/{club}/coachNotes/{semaine}` |
| Qui peut lire | **tout membre du club**, joueurs compris | **coach et propriétaire seulement** (la base le refuse aux joueurs) |
| Envoyé au moteur de séance | oui (c'était le problème) | **jamais** |

Les métadonnées conservées : la semaine concernée, le champ d'origine, le compte
qui avait écrit le cadre, et la date du déplacement. Rien de plus.

---

## 10. Ce que cette commande NE fait PAS

- elle **ne convertit aucune note en directive**. Une note privée reste une note
  privée : c'est le coach qui décide de ce qu'il dit à ses joueurs, jamais le
  code ;
- elle **ne supprime rien d'autre** que les textes hors contrat ;
- elle **ne touche pas** aux séances, aux joueurs, aux autorisations d'accès ;
- elle **ne répare pas** les notes qui auraient déjà été lues. Ce qui a été vu a
  été vu — cette commande ferme la porte, elle ne remonte pas le temps.

---

## 11. Où c'est vérifié

`functions/tests/weekContextNoteMigration.test.ts` (fixtures en mémoire, aucune
base, aucun émulateur) :

| Ce qui est prouvé | Comment |
|---|---|
| détection de **toutes** les variantes de note | `note`, `notes`, `coachNote`, `commentaire`, sous-objet, tableau |
| aucun champ du contrat pris pour une note | témoin : le contrat contient bien des champs textuels |
| copie + suppression **dans la même transaction** | si la suppression échoue, la copie n'est pas conservée non plus |
| simulation par défaut | la base est identique après passage, octet pour octet |
| idempotence | deux passages complets = état final identique, `migres` retombe à 0 |
| reprise après interruption | un document échoue, les autres passent, la relance solde |
| compteurs exacts | la somme des catégories est égale au nombre de documents lus |
| aucun contenu dans la sortie | sonde hostile : les mots des notes de test sont introuvables |
| conflit | les deux textes survivent, le récent reste la note visible |
| vérification finale | l'audit dit `RESIDU` avant, `PROPRE` après, `INCERTAIN` si une lecture échoue |
| aucune route réseau | les deux commandes ne sont exportées par aucune Cloud Function |

---

## 12. Limites, dites franchement

1. **Jamais exécutée.** Tout ce qui précède décrit un comportement **testé**, pas
   un comportement **observé sur une vraie base**.
2. **Elle ne peut pas savoir ce qui a déjà été lu** par un joueur. Elle ferme la
   fuite, elle ne l'annule pas.
3. **Un champ hors contrat qui ne contient pas de texte** (un nombre, un
   booléen) n'est **pas** déplacé. Il est seulement signalé par la vérification.
   C'est volontaire : ce n'est pas une note, et déplacer au hasard serait pire.
4. **Le déplacement est unidirectionnel.** Il n'y a pas de commande pour remettre
   une note dans le document public — et il n'en faut pas.
5. **La règle Firestore, elle, ne change rien à l'historique.** C'est justement
   pourquoi cette commande existe : une règle empêche les nouvelles expositions,
   elle n'efface pas les anciennes.
6. **Le texte rangé dans `legacyImport` n'est affiché par aucun écran.** Quand il
   n'y a pas de conflit, la note ancienne devient la note privée visible du
   coach : il la retrouve normalement. **En cas de conflit** (le coach avait déjà
   une note différente pour cette semaine), l'ancien texte est conservé à côté,
   dans la base, mais il faudra la console Firebase pour le relire. C'est le prix
   de la règle « on n'écrase jamais » : mieux vaut un texte conservé et peu
   accessible qu'un texte écrasé. Si `conflits` est élevé, dis-le — c'est
   l'unique cas qui justifierait de l'afficher dans l'écran coach.
7. **La liste des champs autorisés est recopiée à la main** depuis l'écriture du
   cadre de semaine côté application (`repositories/clubsRepo.ts`). Si un jour un
   champ légitime est ajouté au cadre sans être ajouté à cette liste, la
   commande le prendrait pour une note et le déplacerait. Ce n'est pas
   destructeur (rien n'est perdu), mais c'est à savoir : **ajouter un champ au
   cadre = l'ajouter aussi à `WEEK_CONTEXT_CONTRACT_FIELDS`**.
