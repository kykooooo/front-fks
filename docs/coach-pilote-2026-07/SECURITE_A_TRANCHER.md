# Sécurité et confidentialité — 3 points à trancher

**Date** : 27 juillet 2026
**Pour** : Kyllian
**Statut** : **documenté, non corrigé.** Aucun de ces trois points n'est traité
par le chantier de refonte de l'espace coach. Ils sont d'une autre nature :
règles de base de données, conformité mineurs, et une décision produit sur la
donnée de santé. Ils demandent ta décision, pas du code.

> **Référence des numéros de ligne** : commit **`724c062`**. Chaque affirmation
> a été vérifiée dans le code ; pour retrouver une preuve à l'identique,
> `git show 724c062:<fichier>`.

---

## S1 — Les codes d'invitation sont devinables

### Ce que c'est

Quand un coach crée son club, l'app fabrique un code du type `USMA-4173`
(`repositories/clubsRepo.ts:48-55`) :

```
const base = String(clubName ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
const prefix = (base.length >= 3 ? base : randomLetters(4)).slice(0, 4);
return `${prefix}-${randomDigits(4)}`;
```

Traduction : **la première moitié du code, ce sont les 4 premières lettres du
nom du club.** "US Marolles" donne `USMA`. "FC Exemple U17" donne `FCEX`.
Seuls les 4 chiffres sont aléatoires — soit **10 000 combinaisons**.

Le tirage utilise `Math.random()` (`repositories/clubsRepo.ts:39`), qui n'est
pas un générateur cryptographique. Ce n'est pas le problème principal ici, mais
c'est à savoir.

Nuance honnête : si le nom du club fait moins de 3 lettres utilisables, le
préfixe devient 4 lettres tirées au hasard dans un alphabet de 23 lettres
(`repositories/clubsRepo.ts:41-46`), soit environ 2,8 milliards de
combinaisons. Autrement dit : **le problème n'existe que quand le nom du club
a au moins 3 lettres — c'est-à-dire quasiment toujours.**

Côté base de données, n'importe quel compte connecté peut tester un code
(`firestore.rules:153-154`) :

```
match /inviteCodes/{code} {
  allow get: if isSignedIn();
```

Il n'y a aucune limitation de débit à ce niveau, aucun verrouillage après N
essais. Essayer 10 000 codes est faisable en quelques minutes et coûte
quelques centimes de lectures Firestore.

**Et il n'existe aucune rotation de code dans le produit.** Aucun écran ne
propose "régénérer mon code". Au niveau des données, `update` et `delete` sur
l'annuaire sont interdits (`firestore.rules:160`). On pourrait techniquement
contourner (le propriétaire change `clubs/{id}.inviteCode`, puis crée une
nouvelle entrée d'annuaire — l'ancien code cesse alors d'ouvrir la porte,
parce que la preuve d'invitation compare au code **réel** du club,
`firestore.rules:67-72`), mais l'ancienne entrée resterait là pour toujours et
rien de tout ça n'existe dans l'app.

### Ce que ça permet concrètement

Un inconnu qui connaît le nom d'un club (une affiche, une page Facebook, un
maillot) peut deviner son code et **s'inscrire dans l'effectif**. Une fois
membre, il obtient :

- le nom du club, son code d'invitation, l'identifiant du propriétaire et le
  type d'équipe (`firestore.rules:82-83`) ;
- **toutes les notes hebdomadaires du coach**, semaine après semaine
  (`firestore.rules:113`) : intensité, objectif, match ce week-end, et la note
  libre du type *"gros match dimanche, jambes lourdes"* ;
- sa présence dans l'effectif : le coach le verra apparaître avec le prénom
  qu'il aura choisi.

**Et le coach n'a aucun moyen de l'expulser depuis l'app.** Les règles
autorisent bien le propriétaire du club à supprimer n'importe quel membre
(`firestore.rules:106`), mais la fonction correspondante
(`repositories/clubsRepo.ts:171-174`) n'est appelée que depuis les réglages
**du joueur**, pour qu'il quitte son propre club
(`components/settings/ClubManagementCard.tsx:143`). Il n'existe aucun bouton
côté coach. C'est, à mon avis, l'aspect le plus gênant du point S1 : ce n'est
pas tant qu'un intrus puisse entrer, c'est qu'une fois entré **on ne peut plus
le faire sortir**.

Pour un club de mineures, la formulation qui compte devant un dirigeant est
celle-ci : *un adulte inconnu peut apparaître dans l'effectif, et le coach ne
peut pas l'en retirer.*

### Ce que ça ne permet PAS

Il faut être précis, parce que la frontière coach-safe tient très bien ici.
L'intrus, même membre du club, **ne peut pas** :

- lire la liste des autres membres — un joueur ne lit que son propre document
  de membership (`firestore.rules:93`) ;
- lire une seule fiche joueur — réservé au coach et au propriétaire
  (`firestore.rules:133`) ;
- lire le profil, les séances ou les données de santé de qui que ce soit
  (`firestore.rules:47-61`) ;
- écrire quoi que ce soit d'autre que son propre membership : le cadre de la
  semaine est réservé au coach (`firestore.rules:114`), la fiche joueur est en
  écriture interdite pour tout le monde (`firestore.rules:135`), et le club
  n'est modifiable que par son propriétaire (`firestore.rules:85`).

Autre nuance importante : **les notes hebdomadaires du coach ne sont pas
secrètes vis-à-vis des joueurs.** Elles sont conçues pour être lues par eux —
l'app du joueur les lit pour construire sa séance
(`services/aiContext.ts:197-223`) et la note libre est même transmise au
moteur (`services/aiContextHelpers.ts:45-50`). Le problème n'est donc pas que
"les notes fuitent vers un joueur", c'est que **quelqu'un qui n'aurait jamais
dû être joueur devient joueur.**

### Options de traitement

| | Option | Ce que ça règle | Coût |
|---|---|---|---|
| **A** | **Préfixe entièrement aléatoire.** Supprimer la dérivation depuis le nom du club dans `generateInviteCode` (`repositories/clubsRepo.ts:48-55`) : on passe de 10 000 à ~2,8 milliards de combinaisons. | Ferme le devinage pour les **nouveaux** clubs. | ~3 lignes + tests. Aucun effet sur les codes déjà distribués. |
| **B** | **Bouton "Retirer du club" côté coach.** Les règles l'autorisent déjà (`firestore.rules:106`) — il ne manque que l'écran. | Rend le problème **réparable** : un intrus repéré peut être sorti. | Un écran + une confirmation, ~une demi-journée. Aucune modification de règles. |
| **C** | **Validation du coach avant l'entrée.** Le joueur qui saisit un code entre en "en attente" ; le coach valide ou refuse. | Ferme réellement le trou : un inconnu n'entre plus jamais tout seul. | Modification des règles Firestore + un écran coach + une gestion d'état côté joueur. Plusieurs jours, et ça ajoute de la friction au parcours d'inscription, qui est notre point sensible. |

Mon avis, à trancher par toi : **A + B** sont peu coûteux et prennent le
problème par les deux bouts (plus dur d'entrer, possible de sortir). **C** est
la vraie fermeture, mais elle a un prix produit — chaque joueur pilote devra
attendre une validation, et on est en phase où on se bat pour que les gens
finissent leur inscription.

---

## S2 — Mineurs : rien ne relie la fiche coach à la preuve de consentement parental

### Ce que c'est

La catégorie d'âge (U13, U15…) est projetée vers le coach
(`functions/src/projector.ts:142`) et affichée en clair, en badge, sur la liste
d'effectif (`screens/CoachHomeScreen.tsx:595`) et sur la fiche joueur
(`screens/CoachPlayerDetailScreen.tsx:184`).

En France, sous 15 ans, le consentement au traitement des données personnelles
doit être donné par le titulaire de l'autorité parentale — et FKS collecte des
données de santé (douleurs, blessures, fatigue), ce qui en fait une catégorie
particulière au sens du RGPD. C'est écrit noir sur blanc dans le code
(`domain/parentalConsent.ts:1-16`), et une preuve horodatée est bien stockée
dans le profil quand la case est cochée (`domain/parentalConsent.ts:78-87`,
posée par `screens/ProfileSetupScreen.tsx:423-425`).

**Le problème : ce blocage n'existe que côté téléphone.** Il vit dans deux
tests de l'écran de setup (`screens/ProfileSetupScreen.tsx:294` et `707`).

Côté serveur, la fonction qui fabrique la fiche coach lit uniquement le club,
le rôle, le prénom, la catégorie d'âge, le poste, le niveau et l'indicateur de
profil complété (`functions/src/projector.ts:129-146`). **Elle ne lit jamais
`parentalConsent`.** Aucune règle Firestore ne le vérifie non plus.

Conséquence : un profil mineur **sans preuve de consentement** est projeté vers
le coach exactement comme les autres. Trois cas concrets où ça se produit :

1. un profil créé **avant** l'arrivée de la case parentale et jamais réédité
   depuis ;
2. un profil déjà enregistré en `U13` — la catégorie n'est plus proposée au
   choix (`domain/types.ts:50-52`) mais elle reste reconnue partout, y compris
   par le serveur (`functions/src/coachLabels.ts:34-41`) ;
3. plus largement, tout profil écrit par un autre chemin que l'écran de setup.

### Ce que ça permet concrètement

Le coach voit un badge "U15" sur un joueur pour lequel **rien ne prouve** qu'un
parent a consenti. On ne peut donc pas répondre, dossier en main, à la question
d'un dirigeant ou d'un contrôle : *"montrez-moi que pour ce mineur vous aviez
le consentement"*. La preuve existe pour ceux qui sont passés par l'écran ; on
n'a aucune garantie que **tous** y soient passés.

C'est un risque de conformité, pas une fuite technique. Mais c'est le risque le
plus asymétrique du lot : techniquement mineur, commercialement fatal si un
club le découvre avant nous.

### Ce que ça ne permet PAS

- Ce n'est pas une fuite de données : aucun tiers ne gagne d'accès.
- Aucune donnée de santé n'est exposée au coach par ce biais — la frontière
  coach-safe tient (`functions/src/dto.ts:66-98`).
- Le consentement, quand il est donné, est **correctement conservé** : preuve
  horodatée avec la catégorie d'âge au moment du consentement, et elle n'est
  pas réécrite à chaque édition de profil (`domain/parentalConsent.ts:78-87`).
- Les nouveaux profils passant par l'écran de setup sont bel et bien bloqués
  (`screens/ProfileSetupScreen.tsx:294`).

### Options de traitement

| | Option | Ce que ça règle | Coût |
|---|---|---|---|
| **A** | **Verrou serveur.** La fonction refuse de fabriquer la fiche si la catégorie exige un consentement et que la preuve est absente ou invalide (`functions/src/projector.ts`). Le joueur bascule alors dans le compteur "profils en cours de synchronisation" — un mécanisme qui **existe déjà** et que l'écran gère proprement (`screens/CoachHomeScreen.tsx:331-346`). | Garantie structurelle : plus jamais de mineur sans preuve dans une fiche coach. | ~10 lignes + tests. **Attention** : ça ferait disparaître de la liste des joueurs pilotes déjà inscrits — à annoncer, pas à déployer en silence. |
| **B** | **Re-validation forcée.** Au prochain lancement, un profil mineur sans preuve est renvoyé sur l'étape de consentement. | Régularise les profils actifs, sans les faire disparaître. | Front uniquement, ~une demi-journée. Ne protège pas tant que le joueur n'ouvre pas l'app. |
| **C** | **Constat sur les données réelles.** Compter en production combien de profils sont concernés, et régulariser à la main. | Aucune garantie structurelle, mais dit si le problème est théorique ou réel. | Quasi nul, et c'est la première chose à faire de toute façon. |

Mon avis : **C d'abord** (savoir de quoi on parle), puis **A + B** ensemble —
A pose le verrou, B évite de faire disparaître des joueurs sans explication.

---

## S3 — Un signal dérivé de la douleur circule DÉJÀ vers le coach

### Ce que c'est

`functions/src/coachLabels.ts:51-54` :

```
// 1) Sécurité blessure / douleur — jamais de détail médical brut.
if (low.startsWith("injury:") || low.includes("pain") || low.includes("douleur") || low.includes("blessure")) {
  return "Adaptation sécurité appliquée";
}
```

Tout marqueur interne qui parle de blessure ou de douleur est traduit en une
phrase unique, **"Adaptation sécurité appliquée"**, et cette phrase est envoyée
au coach.

Elle s'affiche :

- sur la fiche joueur, dans la section "Pourquoi cette séance", jusqu'à 4
  raisons (`screens/CoachPlayerDetailScreen.tsx:246-252`) ;
- sur la liste principale, en "Note FKS", quand c'est le premier label de la
  liste (`screens/CoachHomeScreen.tsx:504` et `538-543`).

L'intention d'origine était bonne : ne jamais laisser sortir le détail médical.
Et de fait, le filtre fonctionne — aucune valeur brute ne passe, et tout
marqueur inconnu est purement supprimé plutôt que recopié
(`functions/src/coachLabels.ts:113-114`).

**Mais le filtre a créé une phrase qui n'a qu'une seule cause possible.** Et
c'est ça le problème : quand un libellé ne peut venir que d'un endroit, sa
simple présence dit d'où il vient.

### Ce que ça permet concrètement

Un coach qui lit "Adaptation sécurité appliquée" en face d'un prénom apprend
que **cette personne nommée a déclaré un problème physique**. Il ne sait pas
quoi, ni où, ni à quel point. Mais il sait qu'il y en a un.

C'est une donnée de santé dérivée. Elle est nominative. Elle circule
aujourd'hui, en production, vers des adultes qui encadrent parfois des
mineures. Et surtout : **ce canal n'a jamais été décidé.** Il n'est documenté
nulle part comme une donnée de santé, ni dans la politique de confidentialité,
ni dans le contrat coach-safe — dont la liste d'interdits
(`functions/src/dto.ts:66-98`) bloque bien les mots `pain`, `injury`,
`fatigue`… mais ne peut évidemment rien contre une phrase française qui n'en
contient aucun.

C'est exactement le même mécanisme que celui qu'on s'apprête à fermer sur les
raisons d'écart du joueur (règle de non-inversibilité : `pain`, `fatigue`,
`other` et tout jeton inconnu doivent produire le **même** libellé, pour qu'on
ne puisse pas déduire par élimination). S3, c'est ce même problème, mais un
canal plus tôt, et il est **déjà ouvert**.

### Ce que ça ne permet PAS

- Aucune valeur brute ne sort : ni zone, ni intensité, ni commentaire, ni date.
  Le verrou anti-fuite tient (`functions/src/dto.ts:108-121`, appelé avant
  chaque écriture en `functions/src/rebuild.ts:74`).
- Le coach ne peut pas remonter à la séance ni au ressenti d'origine : il ne
  lit que la projection (`firestore.rules:132-136`).
- Sur la liste principale, un seul label est affiché — le premier
  (`screens/CoachHomeScreen.tsx:504`). Le signal est donc parfois masqué par un
  autre. Ce n'est pas une protection, c'est un hasard.

### Options de traitement

| | Option | Ce que ça règle | Coût |
|---|---|---|---|
| **A** | **Fusionner dans un libellé partagé, non inversible.** Faire renvoyer aux marqueurs blessure/douleur **exactement la même phrase** que plusieurs causes anodines (fatigue de charge, plafonnement de durée, prudence…), par exemple *"Séance ajustée par FKS"*. La présence du libellé ne dit alors plus rien, parce que beaucoup de causes bénignes le produisent aussi. | Ferme la déduction, **et** garde une explication pour le coach. | ~10 lignes + un test qui **prouve** que plusieurs causes distinctes produisent une chaîne identique. Cohérent avec la règle déjà retenue pour les raisons d'écart. |
| **B** | **Supprimer le libellé.** Renvoyer `null` pour ces marqueurs : invisible pour le coach. | Ferme la déduction, radicalement. | 1 ligne. Mais le coach voit alors *"Séance standard, aucun ajustement particulier"* (`screens/CoachPlayerDetailScreen.tsx:256`) alors qu'il **y a eu** un ajustement. On remplace une fuite par un petit mensonge — et notre doctrine dit qu'on préfère "je ne sais pas" à une affirmation fausse. |
| **C** | **Assumer et déclarer.** Nommer ce signal dans la politique de confidentialité comme une donnée de santé dérivée transmise au coach, avec la base juridique correspondante. | Rend le canal légal et explicite. | Travail juridique réel, et devant un club de mineures, "votre coach est informé quand votre fille signale une douleur" est une phrase difficile à faire accepter — alors qu'on n'en a pas besoin pour la valeur produit. |

Mon avis : **A**. C'est peu de code, ça préserve l'utilité pour le coach ("FKS
a ajusté, voilà pourquoi la séance est plus légère"), et ça applique le même
principe que celui qu'on a déjà décidé ailleurs — un principe qui doit être
**prouvé par un test**, pas seulement écrit dans un commentaire.

---

## Récapitulatif pour décision

| | Nature | Gravité | Effort de la piste recommandée | Décision |
|---|---|---|---|---|
| **S1** | Accès non autorisé à un club | Élevée pour un club de mineurs — surtout parce que c'est **irréversible** aujourd'hui | Faible (A + B) | à trancher |
| **S2** | Conformité RGPD mineurs | Faible techniquement, élevée commercialement | Faible, mais effet visible sur les pilotes | à trancher |
| **S3** | Donnée de santé dérivée, **déjà en production** | Moyenne, et non décidée | Faible (A) | à trancher |

Aucun de ces trois points n'est corrigé par le chantier de refonte coach.
Ils attendent ta décision.
