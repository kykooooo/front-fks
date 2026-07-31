# Migration des anciennes notes de coach

_Pilote coach FKS — mis à jour le 28 juillet 2026._
_Pour Kyllian : français simple, analogies foot, et rien à deviner._

> ## ⚠️ CET OUTIL N'A JAMAIS ÉTÉ EXÉCUTÉ
>
> **Ni en production, ni sur une base réelle, ni sur un export, ni même en
> simulation sur un projet réel.** Il est écrit, relu et testé uniquement sur des
> données inventées, en mémoire, sans base et sans réseau.
>
> Aucun chiffre de cette page ne décrit ta base : les exemples de compteurs sont
> **inventés pour l'illustration**. Le nombre réel de documents concernés,
> personne ne le connaît encore — c'est justement l'objet de l'**étape 2**.
>
> Le lancer est une décision humaine. La tienne.

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
matchThisWeekend · updatedAt
```

**Tout le reste qui contient du texte est traité comme une note** et déplacé.

> Analogie : plutôt que de lister les objets interdits dans le sac (impossible,
> on en oublie), on liste les 7 objets autorisés. Tout ce qui dépasse sort.

> `createdAt` a été retiré de cette liste le 2026-07-31 : le champ n'était
> jamais écrit par `saveClubWeekContext` (front), il n'aurait donc jamais dû
> figurer dans le contrat. Un test verrouille désormais mécaniquement cette
> liste contre le code réel (cf. `weekContextNoteMigration.ts`).

Ce choix se trompe **du bon côté** : au pire, on déplace un champ qui n'était pas
vraiment une note — vers un endroit privé, sans rien perdre.

---

## 3. Les cinq verrous de la commande

Avant la procédure, voilà **ce qui t'empêche de faire une bêtise**. Ce ne sont pas
des recommandations : ce sont des refus, prononcés par le programme.

| # | Verrou | Ce que ça veut dire concrètement |
|---|---|---|
| 1 | **Cible obligatoire** | sans `--projet=<nom du projet>`, la commande **ne fait rien** et ne se connecte même pas. On ne devine pas la base sur laquelle on travaille |
| 2 | **Cible vérifiée** | le nom que tu tapes doit correspondre au projet vers lequel pointe réellement ton terminal. Si tu tapes `demo-fks` alors que la machine est branchée sur `fks-apps` : **refus**. C'est le verrou qui rattrape le terminal ouvert la veille |
| 3 | **Simulation par défaut** | sans `--apply`, le morceau de code qui écrit est **remplacé** par un morceau qui n'écrit rien. Ce n'est pas un « si » qu'on pourrait oublier : il n'y a physiquement pas de quoi écrire |
| 4 | **Confirmation qui nomme la cible** | `--apply` exige `--je-confirme=<le même nom de projet>`. Un `--je-confirme` tout court est **refusé** : ça se copie-colle sans réfléchir. Et si la cible ressemble à de la production, il faut **en plus** `--oui-je-vise-la-production` |
| 5 | **Sortie muette** | aucun contenu de note, aucun identifiant de compte n'apparaît jamais dans ce que la commande affiche. Uniquement des compteurs et des **noms de champs** |

**Ce que « ressemble à de la production » veut dire.** Par défaut : **tout**. Un
projet n'échappe à cette présomption que s'il porte un marqueur clair de bac à
sable (`demo-`, `test`, `staging`, `preprod`, `sandbox`, `local`, `dev`) ou si tu
tournes sur un émulateur local. `fks-apps` **est** traité comme la production —
c'est voulu.

> Analogie : on ne demande pas au joueur s'il est titulaire. Tant qu'il n'a pas
> montré sa chasuble de remplaçant, on le considère titulaire. Se tromper dans ce
> sens-là ne coûte qu'une option à taper ; dans l'autre sens, ça coûte une base.

---

## 4. La procédure, en 8 étapes

Elle se lit **dans l'ordre**. Chaque étape dit : la **commande exacte**, ce qu'on
**lit pour passer à la suivante**, et ce qui doit faire **ARRÊTER**.

### Avant de commencer (5 minutes, une seule fois)

```bash
cd functions
npm run build

# Windows PowerShell — on NOMME la base sur laquelle on travaille
$env:GCLOUD_PROJECT = "fks-apps"

# macOS / Linux
export GCLOUD_PROJECT=fks-apps
```

Deux règles de bon sens avant tout le reste :

- **ne lance rien un jour de match.** Ce n'est pas urgent : la fuite est
  ancienne, une journée de plus ne change rien ;
- **fais l'export Firestore** (console Firebase → Firestore → Exporter). Cette
  commande ne détruit rien en principe, mais on ne lance pas une écriture en
  masse sans filet. Note l'heure de l'export : elle sert à l'**étape 8**.

---

### Étape 1 — SIMULATION (la commande ne peut pas écrire)

```bash
node lib/weekContextNoteMigrationCli.js --projet=fks-apps
```

**Ce que tu lis pour passer à la suite :** la première ligne doit dire
`mode=SIMULATION` et `projet=fks-apps`. La dernière ligne récapitule ce qui
**serait** fait.

**Ce qui doit faire ARRÊTER :**

- un `REFUS` — lis-le, il dit exactement ce qui manque, et **rien n'a été lu** ;
- `mode=APPLY` alors que tu n'as pas tapé `--apply` : impossible en principe, et
  si ça arrive, **stop, appelle un développeur** ;
- un projet affiché qui n'est pas celui que tu visais.

---

### Étape 2 — COMBIEN DE DOCUMENTS SONT CONCERNÉS

C'est la même commande qu'à l'étape 1 : on ne relance rien, **on lit la sortie**.

```
[migrationNotes] termine {"scannes":132,"detectes":9,"migres":9,"dejaMigres":0,
"sansNote":123,"disparus":0,"conflits":1,"erreurs":0,"champsDetectes":{"note":8,"notes":1}}
[migrationNotes] controle de somme : migres+dejaMigres+sansNote+disparus+erreurs=132 doit valoir scannes=132
```

_(chiffres inventés — les tiens seront différents)_

**Le nombre à retenir, c'est `detectes`** : le nombre de semaines qui portent
encore une note lisible par les joueurs. C'est **le** chiffre de la décision.

| Compteur | Ce que ça veut dire |
|---|---|
| `scannes` | semaines regardées, tous clubs confondus |
| `detectes` | **semaines concernées** : au moins un texte à déplacer |
| `migres` | semaines traitées (en simulation : qui le **seraient**) |
| `dejaMigres` | semaines déjà passées lors d'un lancement précédent — normal si tu relances |
| `sansNote` | semaines propres, elles n'ont jamais rien eu à cacher |
| `disparus` | la semaine a été supprimée pendant que la commande tournait — sans gravité |
| `conflits` | le coach avait **déjà** une note privée **différente** : les deux textes sont conservés (§5) |
| `erreurs` | semaines qui ont échoué. **Pour celles-là, rien n'a été écrit du tout** |
| `champsDetectes` | dans **quel champ** les textes étaient rangés, et combien de fois |

**Ce que tu lis pour passer à la suite :**

- la ligne `controle de somme` : les deux nombres doivent être **égaux**. Chaque
  semaine tombe dans une seule case ;
- `detectes` = 0 → **il n'y a rien à faire**. Va directement à l'étape 5 pour le
  confirmer, et arrête-toi là ;
- `erreurs` = 0.

**Ce qui doit faire ARRÊTER :**

- les deux nombres du contrôle de somme diffèrent → le compte est faux, **on ne
  lance pas une écriture sur un inventaire faux** ;
- `erreurs` > 0 dès la simulation → la base répond mal, ce n'est pas le jour ;
- `detectes` **énorme** au regard de ce que tu attends (par exemple des milliers
  alors que le pilote compte quelques clubs) → quelque chose n'est pas compris,
  demande une relecture avant d'écrire ;
- `champsDetectes` contient un champ **légitime** que quelqu'un aurait ajouté au
  cadre de semaine sans l'ajouter à la liste des 8 → voir §7, limite 7.

---

### Étape 3 — VALIDATION HUMAINE

Aucune commande. C'est un temps d'arrêt, et il compte autant que les autres.

Tu écris quelque part (message à Marvin, note perso, peu importe) :

- la date et l'heure de l'export Firestore ;
- le projet visé : `fks-apps` ;
- `scannes` et `detectes` relevés à l'étape 2 ;
- `conflits` relevé à l'étape 2 ;
- ta phrase : « je lance la migration des anciennes notes ».

**Ce que tu lis pour passer à la suite :** rien à lire — tu dois pouvoir répondre
« oui » aux trois questions : *l'export est fait ? le projet est le bon ? le
nombre de documents me paraît normal ?*

**Ce qui doit faire ARRÊTER :** un « je crois que oui » sur l'une des trois.

---

### Étape 4 — EXÉCUTION EXPLICITE

**D'abord un seul club.** Toujours.

```bash
node lib/weekContextNoteMigrationCli.js --projet=fks-apps --clubId=LE_CLUB \
  --apply --je-confirme=fks-apps --oui-je-vise-la-production
```

Relis les compteurs de ce club, puis, et seulement si tout est net :

```bash
node lib/weekContextNoteMigrationCli.js --projet=fks-apps \
  --apply --je-confirme=fks-apps --oui-je-vise-la-production
```

Sur un bac à sable (`demo-…`) ou un émulateur, `--oui-je-vise-la-production` est
inutile — et refusé nulle part, simplement pas exigé.

**Ce que tu lis pour passer à la suite :**

- première ligne : `mode=APPLY projet=fks-apps` ;
- `migres` proche de `detectes` de l'étape 2 (l'écart normal, c'est une semaine
  supprimée entre-temps → `disparus`) ;
- `erreurs` = 0 ;
- le contrôle de somme, encore.

**Ce qui doit faire ARRÊTER :**

- `erreurs` > 0 → **ne relance pas trois fois de suite**. Va lire l'étape 7 :
  pour ces semaines-là **rien n'a été écrit**, elles sont intactes, et la reprise
  est prévue ;
- la commande a été coupée (fenêtre fermée, réseau, ordinateur en veille) →
  étape 7 également, c'est exactement le cas prévu.

---

### Étape 5 — VÉRIFICATION FINALE

Commande à part entière. Elle **ne fait que lire** : aucun risque à la lancer,
autant de fois que tu veux.

```bash
node lib/weekContextNoteAuditCli.js --projet=fks-apps
node lib/weekContextNoteAuditCli.js --projet=fks-apps --clubId=LE_CLUB
```

| Verdict | Ce que ça veut dire | Quoi faire |
|---|---|---|
| `PROPRE` | plus **aucune** note dans un document lisible par un joueur, et **tout** a été lu | c'est fini, passe à l'étape 6 |
| `RESIDU` | il reste au moins une note punaisée au vestiaire | relancer l'étape 4 |
| `INCERTAIN` | rien trouvé, **mais** un document n'a pas pu être lu | relancer cette vérification ; **ne pas conclure « propre »** |

> `INCERTAIN` existe pour une raison précise : **« je n'ai rien trouvé » et « je
> n'ai pas tout regardé » ne sont pas la même phrase.** Un outil qui confond les
> deux ment.

**Ce qui doit faire ARRÊTER :** `INCERTAIN` deux fois de suite. La base ne se
laisse pas lire entièrement ; tant que c'est le cas, **personne ne peut affirmer
que c'est propre**, et il ne faut pas l'écrire dans un compte rendu.

---

### Étape 6 — LA PREUVE QU'AUCUN ANCIEN CHAMP NOTE N'EST PLUS ACCESSIBLE AU JOUEUR

Le verdict `PROPRE` de l'étape 5 est **la preuve principale** : il relit
**chaque** cadre de semaine de **chaque** club et vérifie qu'il ne reste **aucun
texte hors des 8 champs autorisés**. Pas « aucun champ nommé `note` » : **aucun
texte**, quel que soit son nom. Et il refuse de dire `PROPRE` s'il n'a pas tout
lu.

Trois preuves s'empilent, et il faut les trois :

| Preuve | Comment on l'obtient | Ce qu'elle vaut |
|---|---|---|
| **A. La base est propre** | verdict `PROPRE` (étape 5) | l'historique est soldé, à l'instant de la lecture |
| **B. La porte est fermée** | la règle Firestore refuse toute écriture qui laisserait un champ `note` dans un cadre de semaine (`firestore.rules`, section `weekContexts`) — et cette règle est **testée** dans `npm run test:rules` | aucune **nouvelle** note ne peut réapparaître par l'application |
| **C. Le joueur ne peut pas lire le carnet privé** | la règle sur `coachNotes` réserve la lecture à l'encadrement (`isClubStaff`), `list` fermée à tous, et **aucun chemin de génération de séance ne lit ce document** | ce qu'on a déplacé n'est pas devenu lisible ailleurs |

Contre-vérification manuelle, si tu veux la faire toi-même (2 minutes, console
Firebase) : ouvre `clubs/<un club>/weekContexts/<une semaine ancienne>`. Tu dois
y voir **uniquement** les 8 champs autorisés. Ouvre ensuite
`clubs/<le même club>/coachNotes/<la même semaine>` : le texte est là.

**Ce qui doit faire ARRÊTER :** un champ inattendu qui traîne encore dans un
cadre de semaine alors que la vérification dit `PROPRE` → les deux se
contredisent, **ne conclus rien** et fais relire le code.

**Ce que cette preuve NE dit PAS**, et il faut le dire aussi : elle ne dit rien de
ce qui a **déjà été lu** avant aujourd'hui. La commande ferme la porte, elle ne
remonte pas le temps.

---

### Étape 7 — REPRISE, si ça s'est interrompu

**Le bon réflexe tient en une phrase : relance exactement la même commande.**

Pourquoi c'est sans danger :

- chaque semaine est traitée **seule**, dans **une transaction**. Une semaine est
  soit entièrement traitée, soit pas touchée du tout. Il n'y a pas de « moitié de
  semaine » ;
- une semaine déjà traitée est **reconnue** au passage suivant : elle tombe dans
  `dejaMigres`, et rien n'est réécrit ;
- une semaine en échec n'a **rien** eu d'écrit : ni copie, ni suppression. Elle
  est exactement comme avant.

| Ce qui s'est passé | Ce que tu vois | Ce que tu fais |
|---|---|---|
| Fenêtre fermée / ordinateur en veille au milieu | rien, la commande s'est arrêtée sans récapitulatif | relance l'étape 4 à l'identique, puis l'étape 5 |
| `erreurs` > 0 à la fin | le compteur `erreurs` | relance l'étape 4 à l'identique. Les semaines déjà faites passeront en `dejaMigres`, les échouées seront reprises |
| Deuxième passage : `erreurs` toujours > 0, sur le même nombre | `erreurs` ne descend pas | **ARRÊTE**. Ce n'est pas un accident de réseau, c'est un problème sur ces documents. Note le nombre et fais regarder le code |
| Tu ne sais plus où ça s'est arrêté | — | c'est prévu : la commande ne mémorise rien et n'en a pas besoin. Elle re-regarde tout, à chaque fois |

**Ce qu'il ne faut PAS faire :** relancer avec des options différentes « pour
voir », ou passer directement à la base entière après un échec sur un club.

---

### Étape 8 — RETOUR EN ARRIÈRE, si la copie a réussi mais pas le nettoyage

**Vérifié dans le code, pas supposé.** Dans `weekContextNoteMigration.migrerUnCadre`,
la copie (`tx.merge` vers le carnet privé) et l'effacement
(`tx.deleteFields` sur le cadre de semaine) sont **dans la même transaction**, et
le branchement Firestore (`weekContextNoteStore.ts`) les envoie dans **une seule**
`db.runTransaction` : Firestore valide les deux écritures ensemble ou aucune.

> Analogie : ce n'est pas « je sors le carnet du vestiaire, puis je le range dans
> le bureau ». C'est un seul geste : ou le carnet est dans le bureau et plus au
> vestiaire, ou il n'a pas bougé.

Un test le prouve dans les deux sens (`weekContextNoteMigration.test.ts`, cas
n°9) : quand on force l'effacement à échouer, **la copie n'est pas conservée non
plus**.

**Donc le cas « copie réussie, nettoyage échoué » ne devrait pas exister.** Voilà
quand même les quatre situations qui en approchent, et ce qu'on fait pour chacune.

#### Cas A — La transaction abandonne après ses tentatives

Firestore réessaie une transaction jusqu'à **5 fois** (valeur par défaut du SDK)
si un autre écrivain touche le même document. Au-delà, elle abandonne.

- **Ce que tu vois :** `erreurs` augmente de 1. Rien d'autre.
- **Ce qui s'est passé dans la base :** **rien**. Aucune des deux écritures n'a
  été validée.
- **Retour en arrière :** il n'y a rien à annuler. Relance (étape 7).

#### Cas B — Interruption entre deux semaines

- **Ce que tu vois :** une commande sans récapitulatif, ou un `migres` inférieur
  à `detectes`.
- **Ce qui s'est passé :** N semaines traitées **complètement**, les autres pas du
  tout. État mixte, mais **cohérent semaine par semaine**.
- **Retour en arrière :** aucun n'est nécessaire, et aucun n'est souhaitable —
  les semaines déjà traitées sont **mieux** qu'avant. On avance, on ne recule
  pas : relance (étape 7).

#### Cas C — Conflit : le coach avait déjà une note privée différente

C'est le seul cas où quelque chose devient **moins accessible** qu'avant.

- **Ce que tu vois :** le compteur `conflits` > 0.
- **Ce qui s'est passé :** la note récente du coach est **conservée** comme note
  visible ; l'ancien texte est rangé **à côté**, dans `legacyImport`, et le
  document public est nettoyé. **Rien n'est perdu** — mais `legacyImport` n'est
  affiché par **aucun écran** de l'application.
- **Retour en arrière :** il n'est **pas automatique**, et il n'y a pas de
  commande pour ça. La marche à suivre, si un coach réclame son ancien texte :
  ouvrir `clubs/<club>/coachNotes/<semaine>` dans la console Firebase, lire
  `legacyImport.champs`, et **recopier à la main** dans sa note privée. C'est
  manuel, c'est assumé : le prix de la règle « on n'écrase jamais ».
- **Si `conflits` est élevé** (disons plus d'une dizaine), dis-le : ça
  justifierait d'afficher `legacyImport` dans l'écran coach. C'est le seul cas
  qui le justifierait.

#### Cas D — Un vrai état incohérent, malgré tout

Symptôme : la vérification dit `RESIDU` **et** le carnet privé de la même semaine
contient déjà un `legacyImport`. C'est-à-dire : copié, mais pas nettoyé.

- **Ce que ça veut dire :** ce n'est pas la commande telle qu'elle est écrite qui
  a produit ça (elle ne le peut pas). C'est soit une écriture faite à la main
  dans la console, soit une version modifiée du script.
- **Ce qu'on fait :** **surtout pas** un retour en arrière. On **relance la
  migration** : la copie est idempotente (elle réécrit les mêmes valeurs), le
  nettoyage se fait, et on revérifie (étape 5).
- **Retour en arrière :** inutile ici, le contenu est déjà en sécurité **des deux
  côtés**.

#### Et le vrai retour en arrière — celui qu'on ne fera pas

**Restaurer l'export Firestore de l'étape 0 remet les anciennes notes dans les
documents publics.** C'est techniquement possible, et c'est **rouvrir la fuite
qu'on vient de fermer**. Si tu dois le faire pour une autre raison (une bêtise
sans rapport le même jour), alors **la migration doit être relancée juste après**,
étapes 1 → 5 comprises.

Et le retour en arrière ciblé — « remettre cette note-là dans le cadre de
semaine » — **n'existe pas et n'existera pas** :

- la règle Firestore le refuse à l'application (c'est le point B de l'étape 6) ;
- il faudrait un script administrateur écrit exprès pour contourner cette règle ;
- et son unique effet serait de rendre une note de coach lisible par les joueurs.

**Dit franchement : pour ce cas-là, le retour en arrière est impossible côté
application, et dangereux côté administrateur. On ne l'écrira pas.** Ce que la
procédure garantit, ce n'est pas « on peut tout défaire » — c'est **« on ne perd
aucun contenu »**. Ce n'est pas la même promesse, et c'est la seule qui tienne.

---

## 5. Le cas délicat : « le coach avait déjà une note »

Il peut arriver qu'une semaine ait **deux** textes : l'ancien (public) et un
nouveau que le coach a écrit depuis dans son carnet privé.

La commande **n'écrase jamais** le texte récent. Elle :

- **garde** la note privée récente comme note visible du coach ;
- **range** l'ancienne à côté, dans `legacyImport`, avec l'indication du champ
  d'où elle vient ;
- **compte** le cas dans `conflits`.

Rien n'est perdu, rien ne reste exposé. Si `conflits` est à zéro, il n'y a rien
de particulier à regarder. Sinon : cas C de l'étape 8.

---

## 6. Où ça atterrit exactement

| | Avant | Après |
|---|---|---|
| Document | `clubs/{club}/weekContexts/{semaine}` | `clubs/{club}/coachNotes/{semaine}` |
| Qui peut lire | **tout membre du club**, joueurs compris | **coach et propriétaire seulement** (la base le refuse aux joueurs) |
| Envoyé au moteur de séance | oui (c'était le problème) | **jamais** |

Les métadonnées conservées : la semaine concernée, le champ d'origine, le compte
qui avait écrit le cadre, et la date du déplacement. Rien de plus.

**Ce que tu ne verras jamais dans la sortie de la commande** : le contenu d'une
note, un nom de joueur, un identifiant de compte. Un journal de migration rempli
de notes de coach serait exactement ce qu'on est en train de protéger. Un test le
vérifie en cherchant les mots des notes de test dans la sortie complète.

---

## 7. Ce que cette commande NE fait PAS

- elle **ne convertit aucune note en directive**. Une note privée reste une note
  privée : c'est le coach qui décide de ce qu'il dit à ses joueurs, jamais le
  code ;
- elle **ne supprime rien d'autre** que les textes hors contrat ;
- elle **ne touche pas** aux séances, aux joueurs, aux autorisations d'accès ;
- elle **ne répare pas** les notes qui auraient déjà été lues.

---

## 8. Où c'est vérifié

`functions/tests/weekContextNoteMigration.test.ts` et
`functions/tests/weekContextNoteMigrationCible.test.ts` (fixtures en mémoire,
aucune base, aucun émulateur) :

| Ce qui est prouvé | Comment |
|---|---|
| détection de **toutes** les variantes de note | `note`, `notes`, `coachNote`, `commentaire`, sous-objet, tableau |
| aucun champ du contrat pris pour une note | témoin : le contrat contient bien des champs textuels |
| copie + suppression **dans la même transaction** | si la suppression échoue, la copie n'est pas conservée non plus (base de l'étape 8) |
| simulation par défaut | la base est identique après passage, octet pour octet |
| idempotence | deux passages complets = état final identique, `migres` retombe à 0 |
| reprise après interruption | un document échoue, les autres passent, la relance solde |
| compteurs exacts | la somme des catégories est égale au nombre de documents lus |
| aucun contenu dans la sortie | sonde hostile : les mots des notes de test sont introuvables |
| conflit | les deux textes survivent, le récent reste la note visible |
| vérification finale | l'audit dit `RESIDU` avant, `PROPRE` après, `INCERTAIN` si une lecture échoue |
| aucune route réseau | les deux commandes ne sont exportées par aucune Cloud Function |
| **zéro écriture sans autorisation explicite** | **par comptage** : le magasin est instrumenté, chaque écriture incrémente un compteur. 12 scénarios de refus (aucune option, `--apply` seul, cible absente, cible vide, cible mal formée, club mal formé, environnement muet, cible différente de l'environnement, confirmation nue, confirmation qui nomme un autre projet, production non assumée) → **0 écriture, 0 lecture, magasin jamais construit, code de sortie non nul** |
| le compteur sait compter | témoin positif : avec les bonnes options, le même compteur voit bien les écritures. Sans ce témoin, tous les zéros ci-dessus ne prouveraient rien |

> Pourquoi compter plutôt que comparer ? Parce qu'« après, la base est pareille »
> ne prouve rien : un programme qui n'écrit pas et un programme qui écrit puis
> annule sont indiscernables après coup. On compte les gestes, pas le résultat.

---

## 9. Limites, dites franchement

1. **Jamais exécutée.** Tout ce qui précède décrit un comportement **testé**, pas
   un comportement **observé sur une vraie base**.
2. **Elle ne peut pas savoir ce qui a déjà été lu** par un joueur. Elle ferme la
   fuite, elle ne l'annule pas.
3. **Un champ hors contrat qui ne contient pas de texte** (un nombre, un
   booléen) n'est **pas** déplacé. Il est seulement signalé par la vérification.
   C'est volontaire : ce n'est pas une note, et déplacer au hasard serait pire.
4. **Le déplacement est unidirectionnel** — voir la fin de l'étape 8. Ce n'est
   pas un oubli, c'est une décision.
5. **La règle Firestore ne change rien à l'historique.** C'est justement pourquoi
   cette commande existe.
6. **Le texte rangé dans `legacyImport` n'est affiché par aucun écran.** Sans
   conflit, l'ancienne note devient la note privée visible du coach : il la
   retrouve normalement. En cas de conflit, il faut la console Firebase (cas C de
   l'étape 8).
7. **La liste des 7 champs autorisés est recopiée à la main** depuis l'écriture
   du cadre de semaine côté application (`repositories/clubsRepo.ts`). Si un jour
   un champ légitime est ajouté au cadre sans être ajouté à cette liste, la
   commande le prendrait pour une note et le déplacerait. Ce n'est pas
   destructeur (rien n'est perdu), mais c'est à savoir : **ajouter un champ au
   cadre = l'ajouter aussi à `WEEK_CONTEXT_CONTRACT_FIELDS`**. Depuis le
   2026-07-31, un test (`weekContextNoteMigration.test.ts`, section VERROU) lit
   le source de `clubsRepo.ts` et compare mécaniquement les deux listes : la
   dérive silencieuse (un champ ajouté d'un seul côté) fait rougir la suite au
   lieu d'attendre qu'un humain la remarque.
8. **Le verrou de cible protège des accidents, pas d'une volonté.** Il rattrape le
   mauvais terminal, la commande copiée-collée, le `--apply` tapé trop vite. Il
   n'empêche pas quelqu'un de décider sciemment de viser la production : c'est
   même exactement ce que fait l'étape 4. Ce n'est pas un mot de passe.
9. **Le faux magasin des tests fusionne moins finement que Firestore.** Dans le
   seul sens qui compte ici — rejouer la même migration — les deux donnent le
   même résultat, et c'est ce que vérifie le test d'idempotence. Mais un test qui
   passe sur une imitation reste un test sur une imitation.
