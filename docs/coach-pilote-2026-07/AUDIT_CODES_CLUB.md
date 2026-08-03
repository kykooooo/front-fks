# Audit du système de codes club — lecture seule

**Date** : 27 juillet 2026
**Pour** : Kyllian
**Nature** : audit, **aucun fichier de code n'a été modifié**. Un autre lot implémentera.
**Référence des numéros de ligne** : commit **`012b49a`** (branche `feat/coach-pilot-experience`).
Pour retrouver une preuve à l'identique : `git show 012b49a:<fichier>`.

---

## Le parcours actuel, en une image

Aujourd'hui, le code club marche comme **un badge d'accès au vestiaire** : celui qui
a le badge entre, sans qu'on regarde qui il est. Il n'y a ni caméra à l'entrée, ni
serrure qu'on peut changer, ni videur qui puisse faire sortir quelqu'un.

Le parcours complet, poste par poste :

| Étape | Où ça se passe | Preuve |
|---|---|---|
| Création du code | `generateInviteCode` | `repositories/clubsRepo.ts:48-55` |
| Écriture dans le club | `clubs/{clubId}.inviteCode` | `repositories/clubsRepo.ts:96-106` |
| Écriture dans l'annuaire | `inviteCodes/{CODE}` (l'ID du document **est** le code) | `repositories/clubsRepo.ts:115-119` |
| Affichage au coach | toast à la création, puis onglets Aujourd'hui / Semaine | `screens/CoachOnboardingScreen.tsx:71-77`, `screens/coach/CoachTodayScreen.tsx:368-372`, `screens/coach/CoachWeekScreen.tsx:915-937` |
| Partage | bouton Partager (message texte libre) | `screens/coach/CoachWeekScreen.tsx:417-425` |
| Saisie joueur (inscription) | champ « Code club (optionnel) » | `screens/ProfileSetupScreen.tsx:513-521` |
| Saisie joueur (réglages) | carte « Mon club » | `components/settings/ClubManagementCard.tsx:94-126` |
| Nettoyage de la saisie | `normalizeInviteCode` | `repositories/clubsRepo.ts:32-37` |
| Vérification | un `get` sur `inviteCodes/{CODE}` | `repositories/clubsRepo.ts:64-80` |
| Rattachement | écriture de `clubs/{clubId}/members/{uid}` avec le code dedans | `repositories/clubsRepo.ts:136-155` |
| Contrôle serveur du rattachement | `providesClubInviteCode` | `firestore.rules:67-72` puis `firestore.rules:101-104` |
| Révocation | **n'existe pas** | voir §5 |

Deux points à retenir tout de suite :

1. **Le code n'est pas une simple étiquette, c'est la clé.** Les règles serveur
   n'acceptent la création d'un membership « joueur » que si le document envoyé
   contient le code **exact** du club, comparé au vrai club côté serveur
   (`firestore.rules:67-72`). Connaître le code = pouvoir entrer. Rien d'autre
   n'est demandé.
2. **L'annuaire est ouvert en lecture à tout compte connecté**
   (`firestore.rules:154` : `allow get: if isSignedIn();`). C'est volontaire — sinon
   personne ne pourrait résoudre un code — mais c'est ce qui rend le devinage
   possible.

---

## 1. L'entropie réelle d'un code

### Le générateur

```
// repositories/clubsRepo.ts:48-55
const base = String(clubName ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
const prefix = (base.length >= 3 ? base : randomLetters(4)).slice(0, 4);
return `${prefix}-${randomDigits(4)}`;
```

Il y a **deux régimes**, et la bascule se joue sur une seule condition :
`base.length >= 3` (`repositories/clubsRepo.ts:53`). `base`, c'est la suite des
**lettres** du nom du club, mises en majuscules, ponctuation et chiffres retirés,
coupée à 4 (`repositories/clubsRepo.ts:49-52`).

### Régime 1 — le nom du club a au moins 3 lettres : **10 000 combinaisons**

Le préfixe est **entièrement déterminé par le nom du club**. « US Marolles » donne
`USMA`. « FC Exemple U17 » donne `FCEX`. Il ne reste d'aléatoire que les 4 chiffres
(`repositories/clubsRepo.ts:39`) : **10 000 possibilités**, soit environ **13 bits**.

C'est l'équivalent d'un code de carte bleue à 4 chiffres — sauf qu'ici il n'y a
personne pour avaler la carte au troisième essai (voir §4).

### Régime 2 — le nom du club a 2 lettres ou moins : **environ 2,8 milliards**

Le préfixe devient 4 lettres tirées au hasard dans un alphabet de 23 lettres
(I, L et O sont retirés pour la lisibilité — `repositories/clubsRepo.ts:41-46`).
23 × 23 × 23 × 23 = 279 841, multiplié par les 10 000 chiffres =
**2 798 410 000 combinaisons**, soit environ **31 bits**. Là, deviner devient
irréaliste.

### La bascule en clair

Le régime 2 ne se déclenche que pour un nom de club contenant **moins de 3
lettres**. L'écran de création impose déjà 2 caractères minimum
(`screens/CoachOnboardingScreen.tsx:38`), donc en pratique seul un club nommé
littéralement « FC », « AS » ou « US » y tomberait. **Autrement dit : le bon
régime est celui qu'on n'a quasiment jamais.** Tous les vrais clubs sont à
10 000 combinaisons.

### Deux nuances honnêtes

- Le tirage utilise `Math.random()` (`repositories/clubsRepo.ts:39` et `:44`),
  qui n'est pas un générateur cryptographique. Ce n'est pas le problème principal
  — quand l'espace ne fait que 10 000 cases, la qualité du dé n'a plus beaucoup
  d'importance — mais c'est à corriger dans le même geste.
- **Deux clubs qui commencent pareil partagent le même espace de 10 000.**
  « US Marolles » et « US Maubeuge » donnent tous les deux `USMA-????`. Le
  contrôle d'unicité existe (`repositories/clubsRepo.ts:90-94`, 5 tentatives), donc
  pas de doublon réel, mais la surface de devinage se concentre.

---

## 2. Peut-on savoir qu'un club existe sans le rejoindre ?

**Oui, et c'est un oracle net.** « Oracle » veut dire : une réponse du serveur qui
dit clairement *oui, ce code existe* ou *non*.

### L'appel exact

```
getDoc(doc(db, "inviteCodes", "USMA-4173"))
```

C'est exactement ce que fait l'app (`repositories/clubsRepo.ts:68`), et la règle
serveur l'autorise à **tout compte connecté**, sans autre condition
(`firestore.rules:153-154`).

- Code qui existe → le document est renvoyé avec `clubId` et `name`
  (écrits à la création, `repositories/clubsRepo.ts:115-119`).
  **Preuve** : `firestore-tests/rules.clubsInvitation.test.ts:154-157` — un
  utilisateur totalement étranger au club lit le document et récupère le `clubId`.
- Code qui n'existe pas → l'appel **réussit quand même**, avec un document vide.
  **Preuve** : `firestore-tests/rules.clubsInvitation.test.ts:159-162`, un test qui
  vérifie explicitement que ce cas est **autorisé** (`assertSucceeds`, `exists()`
  vaut `false`).

Les deux réponses sont donc parfaitement distinguables. Et ce test n'est pas un
oubli : ce `get` sur un code inexistant est **nécessaire** au contrôle d'unicité
de la création de club (`repositories/clubsRepo.ts:91`).

### Ce que ça donne, concrètement

Un simple `get` réussi révèle, **sans jamais rejoindre le club** :

- l'identifiant technique du club (`clubId`) ;
- **le nom du club en clair** (`repositories/clubsRepo.ts:76`).

Et cette opération est **totalement silencieuse** : rien n'est écrit, le coach ne
voit rien, aucune trace n'apparaît dans l'app.

### Le prérequis, et sa faiblesse

Il faut un compte connecté — un visiteur anonyme est refusé
(`firestore.rules:154`, preuve : `firestore-tests/rules.clubsInvitation.test.ts:164-166`).
Mais créer un compte prend dix secondes, avec n'importe quelle adresse mail, et
**rien ne vérifie l'adresse** : l'inscription appelle directement
`createUserWithEmailAndPassword` (`screens/RegisterScreen.tsx:97`) et aucun appel à
`sendEmailVerification` n'existe dans le projet. Le prérequis « compte connecté »
n'est donc pas une barrière, c'est une formalité.

### Le seul endroit où il n'y a PAS d'oracle

Sur le document du club lui-même (`clubs/{clubId}`), la lecture est refusée à tout
non-membre, **que le club existe ou non** (`firestore.rules:82-83`) : le message
d'erreur est le même dans les deux cas. Sur ce chemin-là, rien ne fuite
(preuve : `firestore-tests/rules.clubsInvitation.test.ts:145-149`). C'est bien fait.

---

## 3. Ce que gagne exactement celui qui devine un code

Il y a **deux paliers**, et il est important de ne pas les confondre.

### Palier 0 — il devine, il ne fait rien d'autre

Il obtient `clubId` + nom du club (§2). C'est tout. Et personne ne le sait.

### Palier 1 — il s'inscrit lui-même dans l'effectif

Il lui suffit d'écrire son propre document de membership en y mettant le code
(`repositories/clubsRepo.ts:136-155`). Les règles l'acceptent
(`firestore.rules:101-104`, avec le contrôle du code en `firestore.rules:67-72`).
**Preuve que ça marche de bout en bout** :
`firestore-tests/rules.clubsInvitation.test.ts:208-216` — un parfait étranger crée
son membership avec le bon code, puis lit le club et le cadre de la semaine.

#### Ce qu'il peut alors LIRE

| Document | Contenu | Règle qui l'autorise |
|---|---|---|
| `clubs/{clubId}` | nom, **code d'invitation**, identifiant du propriétaire, type d'équipe (féminine/masculine) | `firestore.rules:82` via `firestore.rules:24-27` — preuve : test `:214` |
| `clubs/{clubId}/weekContexts/{semaine}` | intensité de la semaine, objectif, match ce week-end, **la note libre du coach** (jusqu'à 200 caractères, `repositories/clubsRepo.ts:417`), et l'identifiant du coach qui l'a écrite | `firestore.rules:113` — preuve : test `:215` |
| son propre document de membership | ses infos à lui | `firestore.rules:93` — preuve : test `:281` |

**Précision importante et non couverte par un test** : la règle des notes de
semaine (`firestore.rules:113`) ne dépend **ni du contenu du document, ni de la
semaine demandée**. En langage Firestore, cela signifie qu'une lecture de **toute
la collection** est autorisée à un membre. Concrètement : l'intrus ne récupère pas
une note de semaine, **il peut les aspirer toutes d'un coup**, y compris les
semaines passées. Ce point mérite d'être confirmé par un test dans le lot
d'implémentation — c'est une déduction de lecture de règle, pas une observation.

#### Ce qu'il ne peut PAS lire

| Ce qui reste fermé | Règle qui bloque |
|---|---|
| La liste des autres membres du club | `firestore.rules:93` : lecture réservée au membre lui-même, au coach, ou au propriétaire. Un joueur ne lit que sa propre ligne. |
| La moindre fiche joueur (projection coach) | `firestore.rules:133` : réservé coach + propriétaire, **et** uniquement pour un joueur encore membre actif |
| Le profil de qui que ce soit | `firestore.rules:48` : propriétaire uniquement |
| Les séances faites | `firestore.rules:53` : propriétaire uniquement |
| Les séances planifiées | `firestore.rules:58` : propriétaire uniquement |
| Toute donnée de santé (douleurs, RPE, fatigue) | jamais projetée, `functions/src/dto.ts` + `firestore.rules:48-60` |

#### Ce qu'il ne peut PAS écrire

| Tentative | Règle qui bloque | Preuve |
|---|---|---|
| Écrire le cadre de la semaine | `firestore.rules:114` (coach uniquement) | — |
| Toucher une fiche joueur | `firestore.rules:135` (`write: if false`, même pour le coach) | — |
| Modifier ou supprimer le club | `firestore.rules:85-86` | — |
| Créer le membership de quelqu'un d'autre | `firestore.rules:101` | test `:243-247` |
| Se promouvoir coach | `firestore.rules:103` | test `:249-257` |
| Écraser ou supprimer une entrée d'annuaire | `firestore.rules:160` | test `:198-202` |

**La frontière coach-safe tient parfaitement.** Le problème n'est pas ce que
l'intrus peut voir des joueurs — c'est **qu'il devient joueur**.

### Et le pire : on ne peut pas le faire sortir

Les règles autorisent bien le propriétaire du club à supprimer n'importe quel
membre (`firestore.rules:106`). Mais la fonction correspondante
(`repositories/clubsRepo.ts:171-174`) n'est appelée **que depuis les réglages du
joueur**, pour qu'il quitte lui-même son club
(`components/settings/ClubManagementCard.tsx:143`). C'est son unique point d'appel
dans tout le projet — vérifié par recherche globale. **Aucun écran coach ne
propose de retirer quelqu'un.**

Côté visibilité : l'intrus apparaît dans l'effectif du coach. S'il a rempli un
profil, il s'affiche avec le prénom qu'il a choisi ; s'il ne l'a pas fait, la
projection serveur le rejette (`functions/src/projector.ts:318` exige que le club
du profil corresponde) et il devient un « profil en cours de synchronisation »
anonyme. Dans les deux cas, il est là, et il y reste.

La phrase qui compte devant un dirigeant de club de mineures : *un adulte inconnu
peut apparaître dans l'effectif, lire toutes les notes du coach, et le coach ne
peut pas l'en retirer.*

---

## 4. Y a-t-il une limite de tentatives ?

**Non. Nulle part.** Voici la preuve, couche par couche.

| Couche | Vérification | Conclusion |
|---|---|---|
| Règles Firestore | fichier `firestore.rules` lu en entier (163 lignes) : seules des conditions d'authentification et d'appartenance, aucun compteur | Aucune limite. Techniquement, les règles Firestore **ne peuvent pas** compter les tentatives : elles sont sans mémoire. |
| Cloud Functions | `functions/src/index.ts:7-14` n'exporte que 4 déclencheurs de projection + `deleteAccount`. Aucune fonction ne touche aux codes (recherche `inviteCode` dans `functions/src/` : zéro résultat) | Aucune limite, et aucun endroit où en poser aujourd'hui. |
| App Check | `services/firebase.ts` (fichier entier) initialise l'app, l'authentification et Firestore. **Aucun appel à `initializeAppCheck`.** Recherche globale `appcheck` / `app-check` : zéro résultat de code | Absent. N'importe quel script hors de l'app peut donc taper directement, avec un simple compte. |
| Client (inscription) | `screens/ProfileSetupScreen.tsx:388-401` : une résolution par enregistrement de profil, aucun compteur | Aucune limite. |
| Client (réglages) | `components/settings/ClubManagementCard.tsx:94-126` : contrôle de longueur minimale (4 caractères, ligne 98), aucun compteur | Aucune limite. |

Et de toute façon, **une limite côté client ne protégerait de rien** : l'attaquant
n'utilise pas l'app, il appelle Firestore directement avec le SDK.

La seule limitation de débit qui existe dans le projet concerne le backend Render
qui génère les séances (mentionné en `utils/errorHandler.ts:116`). Elle n'a rien à
voir avec les codes club.

### Le coût réel d'une attaque

10 000 lectures Firestore ≈ **moins d'un centime**, et quelques minutes en
parallélisant. Un code de club à 10 000 combinaisons, sans limite de tentatives,
sans App Check, c'est **un cadenas à 4 chiffres qu'on peut essayer aussi vite
qu'on veut, gratuitement, sans que personne ne l'entende.**

---

## 5. Peut-on révoquer ou changer un code ?

**Non, pas dans le produit. Et à moitié seulement dans la base.**

### Dans l'app : rien

Recherche globale : le code est **uniquement lu, affiché et partagé**. Aucun écran,
aucun bouton, aucune fonction ne le régénère.
- lecture : `hooks/coach/useCoachClub.ts:174`, `components/settings/ClubManagementCard.tsx:73`
- affichage : `screens/coach/CoachWeekScreen.tsx:915-937`, `screens/coach/CoachTodayScreen.tsx:368-372`
- partage : `screens/coach/CoachWeekScreen.tsx:417-425`, `screens/coach/CoachTodayScreen.tsx:216-224`

### Dans la base : l'annuaire est gravé dans le marbre

`firestore.rules:160` : `allow update, delete: if false;` — **personne** ne peut
modifier ni supprimer une entrée d'annuaire, pas même le propriétaire du club.
Preuve : `firestore-tests/rules.clubsInvitation.test.ts:198-202`.

### Le contournement théorique, et pourquoi il ne suffit pas

Un propriétaire pourrait, techniquement : modifier `clubs/{id}.inviteCode`
(autorisé, `firestore.rules:85`), puis créer une **nouvelle** entrée d'annuaire pour
le nouveau code (autorisé si cohérent, `firestore.rules:156-159`). L'ancien code
cesserait alors d'ouvrir la porte, puisque la preuve d'invitation compare au code
**réel** du club (`firestore.rules:67-72`).

Mais trois problèmes, et le troisième est le pire :

1. **Rien de tout ça n'existe dans l'app.** C'est une manipulation console.
2. **L'ancienne entrée d'annuaire reste là pour toujours** (`firestore.rules:160`),
   et continue de livrer `clubId` + nom du club à quiconque connaît l'ancien code.
3. **Changer le code n'expulse personne.** Un intrus déjà entré garde son document
   de membership, et tous ses accès en lecture reposent uniquement sur l'**existence**
   de ce document (`firestore.rules:24-27`), jamais sur le code. Autrement dit :
   changer la serrure n'éjecte pas celui qui est déjà dans le vestiaire.

**Conclusion : la révocation n'existe pas aujourd'hui, ni comme fonctionnalité, ni
comme manipulation fiable.**

---

## 6. Combien de codes existent, et sous quel format ?

### Format exact

`PRÉFIXE-CHIFFRES`, soit en expression régulière **`^[A-Z]{3,4}-\d{4}$`** :
- préfixe de 3 ou 4 lettres majuscules (3 seulement si le nom du club n'a que 3
  lettres exploitables ; l'alphabet du tirage aléatoire exclut I, L et O —
  `repositories/clubsRepo.ts:42`) ;
- un tiret ;
- 4 chiffres.

Exemples réels de la suite de tests : `CLBA-1234`, `CLBB-9999`
(`firestore-tests/fixtures.ts:23` et `:37`).

**Petit écart à signaler** : le test qui garde ce format accepte de 1 à 4 lettres
(`repositories/__tests__/clubsRepo.test.ts:115`, `/^[A-Z]{1,4}-\d{4}$/`) alors que
le générateur n'en produit jamais moins de 3. Le test est plus permissif que la
réalité : il ne détecterait pas une régression vers des préfixes trop courts.

**Un piège de saisie à corriger** : la fonction qui nettoie ce que tape le joueur
(`repositories/clubsRepo.ts:32-37`) supprime les espaces mais **garde le tiret**.
Un joueur qui tape `USMA 4173` (espace au lieu du tiret) obtient `USMA4173`, qui ne
correspond à aucun document — et il lit « **Code club invalide** »
(`screens/ProfileSetupScreen.tsx:392`) alors que son code est bon. À traiter dans le
lot d'implémentation.

### Combien en circulation ?

**Zéro.** C'est le fait le plus important de tout ce document.

D'après la mémoire du projet (`audit-mode-coach-2026-07.md`, clôture du 21/07) : lors
du grand ménage de production, tu as **supprimé entièrement la collection `clubs`**
(y compris le club pilote fictif `pilot-u15f-r1`, code `U15F-2026`, et les deux
clubs de test), **vidé entièrement la collection `users`**, et supprimé les 7 comptes
`@fkspilot.app`. La note conclut explicitement : « plus AUCUN doc inviteCodes à
créer ».

Les seuls codes qui apparaissent encore dans le dépôt sont des **fixtures de test**
tournant sur l'émulateur (`firestore-tests/fixtures.ts:186-189`) — jamais en
production.

> **Conséquence directe pour le lot d'implémentation** : il n'y a **aucun code
> distribué à préserver, aucun club à migrer, aucun joueur à prévenir**. On a les
> mains totalement libres pour changer le contrat. C'est une fenêtre qui se
> refermera au premier club pilote inscrit.

*(Conformément à la consigne, ce constat s'appuie sur la mémoire du projet et les
documents, pas sur une lecture de la base de production.)*

---

## 7. Ce qui casserait si le contrat de code changeait

Liste exhaustive des points de contact, obtenue par recherche globale sur
`inviteCode`, `generateInviteCode`, `normalizeInviteCode`, `findClubByInviteCode`
et `setClubMembership`.

### Fabrication du code

| Fichier:ligne | Rôle |
|---|---|
| `repositories/clubsRepo.ts:39` | tirage des 4 chiffres |
| `repositories/clubsRepo.ts:41-46` | tirage des 4 lettres de secours |
| `repositories/clubsRepo.ts:48-55` | **le générateur** — cœur du sujet |
| `repositories/clubsRepo.ts:82-128` | `createClub` : contrôle d'unicité (`:91`), écriture du club (`:96-106`), écriture de l'annuaire (`:115-119`), régénération en cas de collision (`:123-124`) |
| `repositories/clubsRepo.ts:184-207` | `createClubAsCoach` — appelle `createClub` en `:189` |
| `screens/CoachOnboardingScreen.tsx:65-77` | **unique point d'entrée utilisateur** de la création ; affiche le code dans un toast (`:74`) |

### Résolution d'un code saisi

| Fichier:ligne | Rôle |
|---|---|
| `repositories/clubsRepo.ts:32-37` | `normalizeInviteCode` — nettoyage de la saisie |
| `repositories/clubsRepo.ts:64-80` | `findClubByInviteCode` — le `get` sur l'annuaire |
| `screens/ProfileSetupScreen.tsx:31` | import |
| `screens/ProfileSetupScreen.tsx:373` | normalisation de la saisie |
| `screens/ProfileSetupScreen.tsx:389` | résolution |
| `screens/ProfileSetupScreen.tsx:390` | événement analytics `club_code_checked` (seul point de mesure du taux d'échec) |
| `screens/ProfileSetupScreen.tsx:392-396` | message d'erreur + retour à l'étape 1 |
| `screens/ProfileSetupScreen.tsx:513-521` | le champ de saisie |
| `components/settings/ClubManagementCard.tsx:14-17` | imports |
| `components/settings/ClubManagementCard.tsx:97-101` | normalisation + contrôle de longueur |
| `components/settings/ClubManagementCard.tsx:105-110` | résolution + message « Club introuvable » |

### Rattachement au club

| Fichier:ligne | Rôle |
|---|---|
| `repositories/clubsRepo.ts:136-155` | `setClubMembership` — pose le code comme preuve (`:149`) |
| `screens/ProfileSetupScreen.tsx:400` | appel à l'inscription |
| `components/settings/ClubManagementCard.tsx:113` | appel depuis les réglages |
| `repositories/clubsRepo.ts:190` | appel pour le coach (rôle coach, **sans** code) |
| `repositories/clubsRepo.ts:171-174` | `removeClubMembership` — quitter le club |

### Côté serveur (règles)

| Fichier:ligne | Rôle |
|---|---|
| `firestore.rules:67-72` | `providesClubInviteCode` — **le contrôle qui fait foi** |
| `firestore.rules:101-104` | création/modification d'un membership |
| `firestore.rules:82-83` | lecture du club (réservée membres + propriétaire) |
| `firestore.rules:153-161` | l'annuaire complet : lecture par code, liste interdite, création cohérente, modification et suppression interdites |

**Cloud Functions : aucun point de contact.** La recherche `inviteCode` dans
`functions/src/` ne renvoie rien. Les fonctions déployées
(`functions/src/index.ts:7-14`) ne connaissent pas les codes. **Tout le contrat de
code vit donc dans le front et dans les règles** — c'est la contrainte de conception
majeure du lot d'implémentation : sans Cloud Function, on ne peut ni compter les
tentatives, ni cacher l'oracle, ni faire un code à usage unique.

### Affichage et partage (impactés cosmétiquement)

| Fichier:ligne | Rôle |
|---|---|
| `hooks/coach/useCoachClub.ts:48, 73, 161, 174, 199` | lecture du code depuis le club |
| `screens/coach/CoachWeekScreen.tsx:417-425, 577, 915-937` | affichage + bouton Partager |
| `screens/coach/CoachTodayScreen.tsx:216-224, 368-372` | affichage + partage |
| `components/settings/ClubManagementCard.tsx:73, 179` | affichage côté joueur |
| `screens/CoachHomeScreen.tsx:96, 151, 235-239, 354-359` | **écran hérité, plus branché sur aucune route** (`navigation/CoachTabs.tsx:36-38` ne monte que les écrans `screens/coach/`). À ne pas oublier si on renomme quelque chose — il compile encore. |

### Tests à mettre à jour

`repositories/__tests__/clubsRepo.test.ts:95-152` (format, normalisation,
résolution) · `firestore-tests/rules.clubsInvitation.test.ts` (fichier entier) ·
`firestore-tests/fixtures.ts:172-191` (données de départ) ·
`firestore-tests/rules.baseline.test.ts:121` ·
`firestore-tests/rules.summaryMembership.test.ts:213`.

---

## 8. Une vieille version installée sur un téléphone survivrait-elle ?

La réponse dépend **entièrement** de la nature du changement. Voici les cas, du
plus inoffensif au plus cassant.

### Rappel de contexte

Les versions antérieures à la mise à jour du 21/07 sont **déjà cassées** : elles
cherchaient le club par une requête sur la collection `clubs`, que les règles
actuelles refusent. C'était un choix assumé et documenté
(`firestore-tests/rules.clubsInvitation.test.ts:105-114` : *« Casse les VIEUX builds
tant que l'OTA n'est pas adopté — assumé »*). Le parc de référence est donc celui
d'après cette mise à jour.

### Cas A — on rend le code aléatoire (10 000 → 2,8 milliards) : **rien ne casse**

Les vieilles versions continuent de fonctionner à l'identique. Le nettoyage de
saisie accepte n'importe quelle combinaison de lettres, chiffres et tirets
(`repositories/clubsRepo.ts:36`), et la résolution se fait par identifiant exact
(`repositories/clubsRepo.ts:68`). Un code plus long ou plus aléatoire passe sans
rien changer. **C'est le changement le moins risqué.**

Réserve : si le nouveau format devient beaucoup plus long, le champ de saisie
(`screens/ProfileSetupScreen.tsx:514-521`) n'a pas de longueur maximale, donc pas
de blocage — mais le contrôle « au moins 4 caractères » des réglages
(`components/settings/ClubManagementCard.tsx:98`) reste valable.

### Cas B — on ferme la lecture de l'annuaire pour passer par une Cloud Function : **tout casse, et mal**

Si `firestore.rules:154` passe à `if false`, **chaque version installée échoue au
rattachement**. `findClubByInviteCode` ne renvoie plus `null`, elle **lève une
erreur** (`repositories/clubsRepo.ts:68`, aucun `try` autour). Ce que voit
l'utilisateur, exactement :

- **À l'inscription** : l'erreur remonte au `catch` global de l'enregistrement de
  profil (`screens/ProfileSetupScreen.tsx:463-467`) qui affiche
  « **Erreur — Impossible d'enregistrer le profil.** ». C'est un **message
  trompeur** : le profil n'est pas en cause, c'est le code. Et le joueur reste
  bloqué à la dernière étape, sans savoir quoi corriger. Pire encore : **son profil
  n'est pas enregistré du tout**, parce que la résolution du code se fait *avant*
  l'écriture du profil (`:389` avant `:403`). Un joueur qui saisit un code cassé
  perd tout son questionnaire.
- **Depuis les réglages** : le `catch` affiche le message brut de Firebase
  (`components/settings/ClubManagementCard.tsx:121-122`, `e?.message`), c'est-à-dire
  **une phrase en anglais** du type *« Missing or insufficient permissions »*, dans
  un toast, à un joueur français.

Ces deux messages sont à corriger **de toute façon**, indépendamment du chantier
sécurité.

### Cas C — on ajoute une date d'expiration ou un compteur d'usages dans l'annuaire : **piège**

Une vieille version ignore purement et simplement les nouveaux champs
(`repositories/clubsRepo.ts:70-79` ne lit que `clubId` et `name`). Elle acceptera
donc un code expiré, et le rattachement **passera** — parce que le seul contrôle
serveur compare le code au champ `clubs/{id}.inviteCode` (`firestore.rules:67-72`)
et ne regarde jamais l'annuaire.

> **Règle de conception à retenir** : toute notion d'expiration ou d'usage unique
> doit être appliquée **dans la règle qui autorise la création du membership**, pas
> seulement dans l'annuaire. Sinon les vieilles versions la contournent sans même le
> savoir.

### Cas D — on retire le champ `name` de l'annuaire : **dégradation cosmétique**

Les vieilles versions affichent alors « Club » à la place du nom
(valeur par défaut, `repositories/clubsRepo.ts:76`), donc un message du type
« Tu as rejoint le club "Club" » (`components/settings/ClubManagementCard.tsx:119`).
Moche, pas cassant.

### Cas E — on rend les codes à usage unique en supprimant l'entrée d'annuaire

Les règles interdisent aujourd'hui la suppression aux clients
(`firestore.rules:160`), il faudrait donc une Cloud Function. Les vieilles versions
recevraient un document absent → `null` → « **Code club invalide** »
(`screens/ProfileSetupScreen.tsx:392`). Message correct cette fois, mais qui ne dit
pas *pourquoi* — le joueur croit s'être trompé alors que le code a déjà servi.

### Le levier qui limite les dégâts

Les corrections front partent en mise à jour à distance (OTA), sans passer par les
stores, tant qu'aucun fichier natif n'est touché. Le parc converge donc vite. Mais
un téléphone qui n'ouvre pas l'app garde son ancienne version : **il faut donc que
la nouvelle règle serveur soit déployée après, ou en même temps, que la nouvelle
version front — jamais avant.**

---

## Ce qu'il faut décider

Ce ne sont pas des questions techniques : ce sont des arbitrages produit que le
nouveau système va imposer. Ils doivent être tranchés **avant** d'écrire la moindre
ligne, parce que chacun change la forme de la solution.

### 1. Un code doit-il avoir une durée de validité ?

- **Illimité** (aujourd'hui) : le coach donne le code une fois, il sert toute la
  saison, y compris aux nouveaux arrivants de janvier. Simple. Mais un code qui a
  circulé sur un groupe WhatsApp reste valable pour toujours.
- **Limité dans le temps** (ex. 7 ou 30 jours) : réduit énormément la fenêtre de
  tir. Mais impose un bouton « régénérer » au coach, et un joueur qui s'inscrit en
  retard tombe sur un code mort.
- **À décider aussi** : que voit le coach quand son code expire ? Faut-il le
  prévenir ?

### 2. Combien d'usages par code ?

- **Usage illimité** (aujourd'hui) : un code pour toute l'équipe. C'est le geste
  naturel du coach : il colle le code dans le groupe.
- **Usage unique par joueur** : c'est la vraie fermeture, mais ça oblige le coach à
  générer 18 codes et à les distribuer un par un. Beaucoup de friction, et on est
  en phase où on se bat pour que les gens **finissent** leur inscription.
- **Compromis à évaluer** : un plafond (ex. 30 usages) + un compteur visible pour le
  coach. Ça ne ferme pas le devinage mais ça borne les dégâts.
- **Attention** : sans Cloud Function, un compteur d'usages est difficile à faire
  proprement (voir §7). Ce choix décide s'il faut ou non écrire du serveur.

### 3. Que fait-on des codes existants ?

**Bonne nouvelle : il n'y en a aucun** (§6). Aucune migration, aucun joueur à
prévenir, aucun club à rattraper. **La seule décision est celle du calendrier :
faire le changement maintenant, ou après le premier club pilote — auquel cas il
faudra gérer une transition.** Mon avis : maintenant.

### 4. Que voit un joueur qui se trompe de code ?

Aujourd'hui, il lit « Code club invalide — Aucun club ne correspond à ce code »
(`screens/ProfileSetupScreen.tsx:392`), ou une phrase en anglais depuis les réglages
(§8, cas B). Trois questions à trancher :

- **Faut-il distinguer** « ce code n'existe pas » de « ce code a expiré / est déjà
  utilisé » ? Plus honnête pour le joueur, mais chaque distinction enrichit l'oracle
  décrit au §2.
- **Faut-il un plafond de tentatives dans l'app** avec un message explicite
  (« trop d'essais, réessaie dans une heure ») ? Ça n'arrête pas un attaquant, mais
  ça donne un vrai signal et ça permet de mesurer.
- **Faut-il laisser terminer l'inscription sans le code** ? Aujourd'hui, un code
  refusé fait **perdre tout le questionnaire** (§8, cas B). C'est un bug de parcours
  indépendant du sujet sécurité, et le plus coûteux commercialement.

### 5. Le code suffit-il encore à entrer, ou faut-il une validation du coach ?

C'est **la** question de fond. Trois positions :

- **Le code suffit** (aujourd'hui) : zéro friction, mais un inconnu qui devine entre
  tout seul.
- **Le code suffit, mais le coach peut expulser** : il faut un bouton « retirer du
  club » côté coach — les règles l'autorisent déjà (`firestore.rules:106`), il ne
  manque que l'écran. Le problème devient **réparable**.
- **Le coach valide chaque entrée** : le joueur qui saisit un code passe « en
  attente ». Ferme réellement le trou, mais ajoute une attente au moment précis où
  le joueur est le plus susceptible d'abandonner.

### 6. Le nom du club doit-il rester lisible avant d'entrer ?

Aujourd'hui, un code deviné révèle le nom du club sans rejoindre (§2). C'est utile
au parcours (« Tu as rejoint le club X », `components/settings/ClubManagementCard.tsx:119`)
mais c'est aussi ce qui rend une attaque **confirmable**. Faut-il garder cette
confirmation, ou n'afficher le nom qu'**après** le rattachement effectif ?

### 7. Veut-on savoir quand quelqu'un essaie ?

Aujourd'hui, un devinage ne laisse **aucune trace** (§2). Le seul événement mesuré
est `club_code_checked` (`screens/ProfileSetupScreen.tsx:390`), et il n'existe que
dans l'app — un attaquant qui appelle Firestore directement ne le déclenche jamais.
Décider si on veut une détection (ce qui implique du serveur) ou si on assume
l'aveuglement.

---

## Résumé en une page

| Question | Réponse | Preuve principale |
|---|---|---|
| Entropie réelle | **10 000** combinaisons dans quasiment tous les cas ; 2,8 milliards seulement pour un club nommé en 2 lettres | `repositories/clubsRepo.ts:48-55` |
| Peut-on tester l'existence d'un club sans le rejoindre ? | **Oui**, par `getDoc(inviteCodes/{code})`, ouvert à tout compte connecté ; la réponse distingue clairement code connu / inconnu | `firestore.rules:154` + test `:159-162` |
| Gain d'un code deviné | nom + identifiant du club sans rien faire ; puis, en s'inscrivant : le club, **toutes les notes de semaine du coach**, sa propre ligne d'effectif | `firestore.rules:82`, `:113`, test `:208-216` |
| Ce qui reste fermé | liste des membres, fiches joueurs, profils, séances, toute donnée de santé | `firestore.rules:93`, `:133`, `:48-60` |
| Limite de tentatives | **aucune**, à aucune couche ; App Check absent | `services/firebase.ts`, `functions/src/index.ts:7-14` |
| Révocation / rotation | **impossible** dans l'app ; l'annuaire est immuable ; et changer le code **n'expulse pas** un intrus déjà entré | `firestore.rules:160`, `:24-27` |
| Codes en circulation | **zéro** — les mains sont libres | mémoire projet, clôture 21/07 |
| Format | `^[A-Z]{3,4}-\d{4}$` | `repositories/clubsRepo.ts:48-55` |
| Cloud Functions concernées | **aucune** — tout vit dans le front et les règles | `functions/src/` |
| Compatibilité anciennes versions | intacte si on rend le code aléatoire ; cassée si on ferme la lecture de l'annuaire, avec **deux messages d'erreur défaillants** (un trompeur, un en anglais) et **perte du questionnaire** | `screens/ProfileSetupScreen.tsx:463-467`, `components/settings/ClubManagementCard.tsx:121-122` |
