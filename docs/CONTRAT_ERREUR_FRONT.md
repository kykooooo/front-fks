# CONTRAT_ERREUR_FRONT.md — Échec de génération de séance, côté front

> **Nature de ce document.** `screens/newSession/echecGeneration.ts` et ses tests
> citent ce fichier par numéro de section (§2.1, §2.2, §4.3, §5.2, §5.3, §6…)
> depuis sa création — mais le fichier lui-même n'a jamais existé. Ce document
> le crée en **reconstituant** ces sections à partir du seul endroit qui fait
> foi : le code implémenté et ses tests (`screens/newSession/echecGeneration.ts`,
> `screens/newSession/__tests__/echecGeneration.test.ts`,
> `screens/newSession/__tests__/aucuneSeanceDeSecours.test.ts`). Chaque règle
> ci-dessous est vérifiable par une citation `fichier:ligne` ou un test.
> Aucune règle non implémentée n'est décrite ici.
>
> **Ce que ce document N'EST PAS** : la spécification côté backend (`fks`).
> Le repo backend a été consulté pour information et son fichier
> `src/http/workflowErrors.ts` (au 31/07/2026) répond en fait avec une forme
> `{ status, errorType, userMessage }`, différente du corps à huit champs
> attendu ici (§2.1). Réconcilier les deux est un sujet backend, **hors
> périmètre de ce document et de la mission qui l'a créé** — voir le README de
> mission. Ce fichier documente ce que **le front sait lire et affiche**,
> pas ce que le backend envoie réellement aujourd'hui.

---

## §1 — Doctrine

Une erreur technique ne devient jamais une prescription sportive. Quand la
génération échoue, il ne s'est rien passé côté joueur : aucune séance créée,
aucune ligne d'historique, aucune progression avancée. `echecGeneration.ts`
traduit un échec en état d'erreur affichable — c'est tout ce qu'il fait.

Avant le 27/07/2026, une panne déclenchait un repli automatique : une fabrique
locale composait une séance générique (cardio + mobilité, sans matériel, sans
douleur, sans cycle) et la présentait comme une vraie prescription FKS. C'est
la faute que ce module corrige (voir `docs/AUDIT-FRONT-P0.0.md`, section
« États chargement / erreur de génération », correction du 27/07/2026, et
`screens/newSession/__tests__/aucuneSeanceDeSecours.test.ts` qui verrouille
la non-régression).

---

## §2 — Corps d'erreur typé du backend

Quand le backend a pu qualifier sa propre panne, il répond avec un corps JSON
que le front sait lire (`lireCorpsContrat`,
`screens/newSession/echecGeneration.ts:213-247`). Le front ne lit ce corps que
depuis `error.message` (le point d'entrée est toujours une exception —
`BackendError` levée par `safeFetch`, `utils/errorHandler.ts:260-313` — dont
le `message` porte le corps de réponse HTTP brut).

### §2.1 — Les champs

Le corps contrat, tel que produit par les tests (`erreurContrat` /
`corpsContrat`, `screens/newSession/__tests__/echecGeneration.test.ts:33-56`),
porte huit champs :

```json
{
  "error": "SESSION_CONTRACT_FAILED",
  "code": "SESSION_CONTRACT_FAILED",
  "category": "sportif",
  "retryable": false,
  "message": "Texte à afficher au joueur, tel quel.",
  "failedStep": "verification_finale",
  "requestId": "req-0001",
  "traceId": "req-0001"
}
```

`lireCorpsContrat` (`echecGeneration.ts:213-247`) lit **sept** champs en tout :
les **cinq** ci-dessous, présents sur n'importe quel corps contrat, plus deux
qui n'existent que sur le refus de sécurité (`safety_flags` et `disclaimer`,
§2.3). Sur le corps de huit champs de cet exemple, cinq sont donc lus :

| Champ JSON | Type | Lu par le front comme |
|---|---|---|
| `code` | string, requis | `EchecGeneration.code` (identifiant opaque, jamais interprété au-delà de `missing_goal`, voir §4.3) |
| `category` | `"transitoire" \| "sportif" \| "technique"`, optionnel (`CATEGORIES`, `echecGeneration.ts:167`) | `EchecGeneration.categorie` — si absent ou hors de cette liste, déduit de `retryable` (`true` → `"transitoire"`, `false` → `"technique"`). Sur un refus de sécurité, ce champ n'est jamais consulté : la catégorie vient du `code` (§2.3) |
| `retryable` | boolean, optionnel (défaut `false`) | `EchecGeneration.retryable` |
| `message` | string, requis | `EchecGeneration.messageJoueur`, affiché **tel quel** (voir §6) |
| `requestId` | string, optionnel | `EchecGeneration.requestId`, affiché en petit dans `CarteEchecGeneration` |

`code` et `message` sont **obligatoires** : si l'un des deux manque ou est
vide, `lireCorpsContrat` retourne `null` et le front retombe sur la
classification client (§2.2), même si le JSON était par ailleurs valide.

Les trois champs restants (`error`, `failedStep`, `traceId`) sont
**ignorés** par le front :
- `error` fait doublon avec `code` dans les fixtures de test ; le front ne
  lit que `code`.
- `failedStep` est un détail d'implémentation backend (ex. `planner.openai`,
  `pools.token`) — jamais montré au joueur, jamais inspecté par le front
  (`requestId conserve pour le support, jamais le failedStep`, test
  `echecGeneration.test.ts:275-288`).
- `traceId` n'est actuellement lu nulle part côté front (seul `requestId`
  est utilisé pour la référence support affichée).

**Retry-After conservé même avec un corps contrat (depuis le 27/07/2026,
LOT 4c)** : un 429 peut porter à la fois un corps typé (§2.1) et un en-tête
`Retry-After` (posé par `safeFetch` sur `retryAfterS`). Le front ne les
oppose pas : `attendreS` reprend `retryAfterS` dès qu'il est numérique et
`> 0` ; sinon (absent, non numérique, ou `<= 0`) il reste `null`
(`echecGeneration.ts:465-493`). Trois tests verrouillent ce comportement
dans `echecGeneration.test.ts` : « 429 avec corps type ET Retry-After :
attendreS preserve, pas ecrase a null » (lignes 300-316), « corps type SANS
Retry-After (ex: 422 sportif) : attendreS reste null, comportement inchange »
(lignes 318-328), et « Retry-After a 0 ou negatif : traite comme absent
(jamais 'patiente 0 seconde') » (lignes 330-339).

### §2.2 — Quand la réponse NE porte PAS ce corps

Deux cas sortent délibérément du contrat et sont traités par le front lui-même,
**avant** toute tentative de lecture du corps :

1. **Authentification** (`brut.code === "AUTH_REQUIRED"` ou `brut.status === 401`,
   `echecGeneration.ts:457-459`) : ces réponses portent un jeton technique
   dans leur `message` (`missing_auth`, `invalid_id_token`…) qu'il ne faut
   surtout pas montrer. Le front écrit son propre texte
   (`echecAuthentification()`), toujours, sans essayer de parser le corps.
2. **429 sans corps exploitable** : si le JSON ne contient pas `code`/`message`
   (ex. `{"error":"rate_limited","kind":"cooldown","source":"uid"}`),
   `lireCorpsContrat` renvoie `null` et le front retombe sur
   `utils/errorHandler.ts` (`classifyError` → `ErrorType.RATE_LIMIT`), qui lit
   `retryAfterS` directement sur l'erreur (posé par `safeFetch` depuis
   l'en-tête `Retry-After`).

Dans les deux cas, le corps brut n'est **jamais** affiché au joueur — vérifié
par les tests `401 : le jeton technique du backend n'est JAMAIS affiche` et
`429 d'entree : on patiente, retry-after respecte, corps jamais affiche`.

Toute autre panne survenue avant que le backend ait pu répondre un corps
qualifié (coupure réseau, timeout, 5xx sans corps JSON lisible, erreur
inconnue) est également classifiée côté client par `echecCote()`, qui
délègue à `utils/errorHandler.ts` (`classifyError`) — **jamais une seconde
liste de codes concurrente**.

### §2.3 — Refus de sécurité (`safety_no_session`, ajouté le 01/09/2026)

Le moteur refuse de prescrire quand le joueur a déclaré une douleur récente
forte ou une blessure grave. Ce n'est **pas** une panne, et ce corps a sa
propre forme (HTTP **422**) :

```json
{
  "ok": false,
  "code": "safety_no_session",
  "error": "safety_no_session",
  "message": "Phrase de sécurité, écrite par le backend, affichée en tête.",
  "disclaimer": "Avertissement santé, optionnel.",
  "safety_flags": ["RF1_pain_recent_high"]
}
```

Deux champs de plus que §2.1, lus par le front :

| Champ | Type | Lu comme |
|---|---|---|
| `safety_flags` | string[], optionnel (`lireDrapeauxSecurite`, `echecGeneration.ts:202-205`) | Choisit l'explication affichée : un drapeau commençant par `RF1` → phrase « douleur », par `RF2` → phrase « blessure » (`messageRefusSecurite`, `echecGeneration.ts:299-315`). Un drapeau inconnu est ignoré ; les identifiants eux-mêmes ne sont **jamais** affichés |
| `disclaimer` | string, optionnel | Remplace l'avertissement santé écrit par le front (`TEXTES_SECURITE`, `echecGeneration.ts:257-285`) |

Quatre différences de traitement, verrouillées par les tests
(`echecGeneration.test.ts`, section « refus de securite ») :

1. **Catégorie dédiée** `securite` — déduite du `code`, pas d'un champ
   `category` (le backend n'en envoie pas ici). Ni `transitoire` ni
   `technique` : le joueur ne doit jamais lire « le service est
   indisponible » alors que le service a parfaitement fonctionné.
2. **Aucun ré-essai, mais une vraie sortie nommée (round 2, 03/09/2026)** :
   `retryable` est forcé à `false` même si le corps dit l'inverse, `attendreS`
   reste `null`, `actions` vaut exactement
   `["ouvrir_mon_corps", "retour_accueil"]` (`ACTIONS_REFUS_SECURITE`,
   `echecGeneration.ts:53`), et `decisionApresEchec` n'ajoute pas
   `reprendre_seance` (« Le repos est la séance du jour » et un bouton
   « Reprendre ma séance » se contrediraient). Avant round 2, la seule sortie
   était `retour_accueil` : le joueur bloqué n'avait aucun chemin nommé vers
   l'endroit qui peut faire bouger le refus.
3. **Message composé, pas remplacé** : le `message` backend reste en tête,
   suivi de l'explication tirée des drapeaux, de la voie de sortie, et de
   l'avertissement santé. Le front n'affiche **aucun nombre de jours** : la
   fenêtre appliquée est une décision du moteur, le front ne la connaît pas et
   ne l'invente pas (règle 12 du CLAUDE.md).
4. **La voie de sortie dépend du drapeau (round 2, erratum 1 du design
   `DESIGN_MON_CORPS.md` §6)** — `RF1` et `RF2` ne se lèvent PAS de la même
   façon, et le texte le dit désormais correctement (`TEXTES_SECURITE.sortieRf1`
   / `.sortieRf2`, `echecGeneration.ts:266,274,283`) :
   - **RF1 seul** (douleur du feedback) : *« Le repos est la séance du jour.
     Cette prudence s'applique tant que ta dernière déclaration est
     récente. »* — formule volontairement neutre : RF1 lit
     `recentSessions[0].feedback.pain` **sans aucune fenêtre côté backend**
     (erratum 1 du design), donc rien ne garantit qu'elle s'efface toute
     seule ; le front ne le sait pas et n'invente pas de délai.
   - **RF2 présent** (seul ou avec RF1) : *« Le repos est la séance du jour.
     Cette prudence s'applique tant que tu n'as pas mis à jour cette gêne
     dans Mon corps. »* — c'est la phrase qui sort, **même si RF1 est aussi
     présent** (RF2 est la plus exigeante : rien ne bouge sans un geste
     explicite du joueur). Contrairement à RF1, il existe ici une vraie
     action nommée : baisser la gravité ou changer le statut d'une gêne dans
     « Mon corps » (décision D12 — une gêne `active` de gravité 3 y porte
     désormais elle-même la ligne d'aide *« Pas de séance tant que cette gêne
     reste à ce niveau. »*, `screens/MonCorpsScreen.tsx`).
   - **Aucun drapeau reconnu** : repli sur la formule RF1 (la plus prudente,
     puisque le front ne sait pas lequel des deux mécanismes a motivé le
     refus).

**Corps abîmé** : si `code` vaut `safety_no_session` mais que `message`
manque, le front ne retombe **pas** sur la classification client — qui
dirait « modifie ton lieu ou ton matériel, puis réessaie », c'est-à-dire
pousserait un joueur douloureux à retaper contre un mur. Il écrit sa propre
phrase de tête et garde tout le reste du traitement de sécurité
(`lireRefusSecuriteDegrade`, `echecGeneration.ts:323-343`).

**Avant ce correctif (P0 vivant en prod le 01/09/2026)** : ce refus sortait
en `500 {"ok":false,"error":"invalid_version"}`. Sans `code` ni `message`,
`lireCorpsContrat` rendait `null`, le front classait `ErrorType.SERVER` et
affichait « Le service est momentanément indisponible… réessaie ». Le joueur
croyait à une panne et relançait, sans jamais apprendre que c'était sa propre
déclaration de douleur qui bloquait. Un test de non-régression garde la
frontière : un vrai 500 sans contrat reste une panne « indisponible » — c'est
le 422 typé, et lui seul, qui déclenche le message de sécurité.

---

## §3 — Taxonomie

### §3.1 — Catégories

Quatre catégories (`CategorieEchec`, `echecGeneration.ts:29`). Trois sont
déclarables par le backend dans son champ `category` (`CATEGORIES`,
`echecGeneration.ts:167`) ; la quatrième, `securite`, est déduite du code
(`CODE_REFUS_SECURITE`, `echecGeneration.ts:32`) et ne peut pas être
déclarée :

| Catégorie | Signification | Effet sur les actions (§4.3) |
|---|---|---|
| `transitoire` | Panne probablement passagère (réseau, timeout, serveur surchargé, rate limit, 5xx contrat retryable) | Action principale : `reessayer` |
| `sportif` | Le backend n'a pas pu construire une séance sûre/utile avec les contraintes actuelles (matériel, douleurs, temps, objectif) | Action principale : `modifier_contraintes` |
| `technique` | Panne interne non retryable en l'état (ex. budget de génération dépassé) | Action principale : `reessayer` (le joueur reste libre d'essayer, mais rien ne garantit que ça change) |
| `securite` | Pas une panne : refus délibéré du moteur sur déclaration de douleur/blessure (§2.3) | `ouvrir_mon_corps` puis `retour_accueil` — **jamais** de ré-essai, jamais de reprise |

### §3.2 — Codes observés

Le front **ne maintient pas** de catalogue fermé de codes — un code inconnu
est lu et affiché sans plantage ni traitement spécial (test `code inconnu du
front : lu quand meme, sans plantage ni invention`). Seul `missing_goal` est
spécial-casé (§4.3). Les codes suivants apparaissent dans les tests comme
exemples réels de ce que le backend peut renvoyer — cette liste est
**illustrative, pas exhaustive** :

| Code | Statut HTTP typique | Catégorie | `retryable` |
|---|---|---|---|
| `SESSION_GENERATION_FAILED` | 503 | `transitoire` | `true` |
| `NO_VALID_PRESCRIPTION` | 422 | `sportif` | `false` |
| `SESSION_CONTRACT_FAILED` | 422 | `sportif` | `false` |
| `SESSION_CONSTRAINTS_UNRESOLVED` | 422 | `sportif` | `false` |
| `SESSION_SCHEMA_INVALID` | 422 | `technique` | `false` |
| `missing_goal` | 400 / 422 | `technique` (le corps ne porte pas de `category`) | `false` |
| `safety_no_session` | 422 | `securite` (§2.3) | `false`, toujours |
| `generation_budget_exceeded` | 503 | `technique` | `false` |

---

## §4 — Actions proposées au joueur

`ActionEchec` (`echecGeneration.ts:35-43`) : `reessayer`,
`reessayer_enregistrement`, `modifier_contraintes`, `choisir_cycle`,
`se_reconnecter`, `reprendre_seance`, `ouvrir_mon_corps`, `retour_accueil`. La
première action du tableau `EchecGeneration.actions` est la principale
(bouton mis en avant dans `CarteEchecGeneration`). `ouvrir_mon_corps`
(round 2, 03/09/2026) navigue vers l'écran « Mon corps »
(`screens/NewSessionScreen.tsx`, gestionnaire `onOuvrirMonCorps` de
`CarteEchecGeneration`) — la seule action qui **n'est jamais proposée** en
dehors d'un refus de sécurité (§2.3).

### §4.3 — Règle de sélection (chemin contrat)

`actionsDuContrat()` (`echecGeneration.ts:350-363`) :

0. `categorie === "securite"` (§2.3) → `ACTIONS_REFUS_SECURITE`
   (`echecGeneration.ts:53`) = `["ouvrir_mon_corps", "retour_accueil"]`, et
   rien d'autre. Ni `reessayer` (le refus ne bougera pas), ni
   `modifier_contraintes` (changer de matériel ne lève pas une douleur
   déclarée). Même constante réutilisée par `lireRefusSecuriteDegrade()`
   (§2.3, corps abîmé) : un refus de sécurité reste un refus de sécurité, que
   le backend ait ou non réussi à joindre un `message`.
1. `code === "missing_goal"` → `["choisir_cycle", "reessayer", "retour_accueil"]`
   (relancer à l'identique sans cycle choisi ne sert à rien : l'action utile
   est de choisir un cycle d'abord).
2. sinon, `categorie === "sportif"` → `["modifier_contraintes", "reessayer", "retour_accueil"]`.
3. sinon → `["reessayer", "retour_accueil"]`.

Les pannes hors contrat (§2.2, `echecCote()`) suivent la même logique par
type d'erreur : `VALIDATION` → `modifier_contraintes` en tête ; `AUTH` →
`se_reconnecter` en tête ; les autres → `reessayer` en tête. Toutes se
terminent par `retour_accueil`.

`decisionApresEchec()` (`echecGeneration.ts:616-644`) ajoute ensuite
`reprendre_seance` en **deuxième position** (juste après l'action principale, jamais devant) quand une vraie
séance déjà persistée peut être rouverte (§5.3) — **sauf** sur un refus de
sécurité, où aucune séance n'est proposée à la réouverture (§2.3).

---

## §5 — Ré-essai et reprise

### §5.2 — Budget de ré-essai automatique côté écran : zéro

`REESSAIS_AUTOMATIQUES_ECRAN = 0` (`echecGeneration.ts:146`), sans exception.
Le seul ré-essai automatique du parcours est déjà dépensé **avant** que ce
module intervienne : `fetchV2` (`screens/newSession/api.ts:227-243`) retente
une fois un `Failed to fetch`/timeout, pour couvrir le réveil (cold start)
du serveur Render. Une fois cet essai unique épuisé, plus aucune relance
n'est automatique — chaque nouvelle tentative est un geste explicite du
joueur, parce qu'une génération coûte un appel payant (jusqu'à quatre appels
selon la complexité).

### §5.3 — Reprise d'une vraie séance déjà persistée

`chercherRepriseSeance()` (`echecGeneration.ts:542-588`) est distinct d'un
ré-essai : il ne relance rien, il cherche si une séance **déjà prescrite,
validée et persistée** peut simplement être rouverte plutôt que perdue à
cause d'une panne réseau/affichage qui a suivi. Refusée si :

| Motif (`MotifRefusReprise`) | Condition |
|---|---|
| `aucune_seance` | Rien à rouvrir pour ce joueur, aujourd'hui/J-1/J-2/demain |
| `seance_artificielle` | La séance porte les marqueurs de l'ancienne fabrique de secours (`utils/sessionHelpers.ts:estSeanceArtificielle`) — jamais rouverte, même en dernier recours |
| `autre_joueur` | La séance appartient à un autre `uid` |
| `snapshot_invalide` | Pas de prescription réellement servie (`aiV2` absent ou sans bloc/exercice) |
| `seance_remplacee` | Marquée `replacedBy`/`invalidatedAt`/`invalidated` |

Une reprise n'est **jamais** un repli : rien de neuf n'est fabriqué, la
séance existait déjà avant la panne.

---

## §6 — Le message est affiché tel quel

Quand le contrat backend est présent (§2), son champ `message` est montré au
joueur **sans modification** (`EchecGeneration.messageJoueur = corps.message`,
`echecGeneration.ts:465-493`) — c'est le backend qui rédige le texte définitif
dans ce cas. `CarteEchecGeneration` l'affiche dans un seul bloc de texte,
jamais tronqué au-delà de 6 lignes
(`screens/newSession/ui/CarteEchecGeneration.tsx:81`).

**Seule exception, le refus de sécurité (§2.3)** : le `message` backend n'est
pas remplacé, il est mis **en tête** d'un texte composé (explication + voie de
sortie + avertissement santé). Ce texte étant plus long, la même ligne 81 lui
accorde 16 lignes, sur un encadré teinté — un message de coach, pas un état
d'erreur : titre « Pas de séance aujourd'hui » au lieu de « On n'a pas pu
préparer ta séance » (`CarteEchecGeneration.tsx:74`), et pas de référence
support (`:110`, rien n'est cassé, il n'y a pas d'incident à faire remonter).
La carte propose deux sorties, `ouvrir_mon_corps` puis `retour_accueil`
(§4.3) — jamais de bouton de relance.

Quand il n'y a **pas** de corps contrat (§2.2), le front rédige lui-même le
texte (`MESSAGES`, `echecGeneration.ts:152-165`) — toujours sur le même
principe : dire ce qui s'est passé, redire qu'aucune séance n'a été
enregistrée (sauf §7, où ce serait faux), et indiquer l'action utile.

---

## §7 — Panne après une génération payée (persistance / affichage)

*(Ajouté le 27/07/2026 — pas cité par un numéro dans le code d'origine, mais
fait partie du même module et suit la même doctrine : ne jamais mentir sur ce
qui a été enregistré.)*

`orchestrator.ts` (`processV2`) enchaîne, une fois la génération obtenue :
`persistPlanned(payload)` **puis** `pushSession` / `setLastAiSessionV2` /
`navigate`. Une panne à ce stade n'est **pas** une panne de génération — le
backend a déjà répondu, l'appel est payé. `persisterEtAfficher()`
distingue deux étapes et lève `EchecPostGeneration` avec l'étape réelle :

| Étape | Ce qui a échoué | Ce qui est déjà vrai | Message |
|---|---|---|---|
| `"persistance"` | `persistPlanned(payload)` a levé | Rien n'est encore en base | « Ta séance a bien été générée, mais elle n'a pas encore pu être enregistrée. » |
| `"affichage"` | `pushSession`/`setLastAiSessionV2`/`navigate` a levé | `persistPlanned` a **réussi** — Firestore a la séance | « Ta séance a été générée et déjà enregistrée. On n'a pas réussi à te l'afficher. » |

Dans les deux cas, l'action proposée est `reessayer_enregistrement` — jamais
`reessayer` seul — et son gestionnaire (`orchestrator.rejouerApresEchecPostGeneration`)
rejoue **uniquement** l'étape ratée à partir de la séance déjà générée
(même payload, même id) : jamais de second appel de génération, jamais de
double écriture Firestore quand la première a déjà réussi.

`DecisionApresEchec.postGeneration` porte cette information (`{ etape,
seance }` ou `null`) pour que l'écran puisse câbler ce rejeu sans que
`echecGeneration.ts` lui-même n'écrive quoi que ce soit — le module reste pur.

---

## §8 — Verrou anti-double-clic

Une génération coûte de l'argent : deux appuis ne doivent jamais produire
deux requêtes concurrentes. `creerVerrouGeneration()`
(`echecGeneration.ts:658-671`) fournit un verrou **synchrone** (pas un état
React, qui serait périmé dans le même tick) : `prendre()` renvoie `false` si
le verrou est déjà tenu, `rendre()` le libère une fois la requête réellement
retombée (bloc `finally`). Dix appuis rapides ne produisent qu'une seule
requête entrante (test `dix appuis rapides = une seule requete`).

---

## Ce que ce document ne couvre pas

- La forme exacte que le backend `fks` envoie aujourd'hui (voir l'avertissement
  en tête de fichier) — sujet backend, hors périmètre.
- Le détail interne de `screens/newSession/transform.ts` (mise en forme de la
  séance une fois générée avec succès) n'est pas documenté champ par champ
  ici. Depuis le 31/07/2026, il n'y fabrique plus rien : un exercise_id
  dupliqué, un item sans aucune donnée de charge, ou un `blocks` vide après
  réduction (atteignable via un variant de reset) lèvent le même corps typé
  `code: "SESSION_SCHEMA_INVALID"` que `api.ts` (juste au-dessus), lu par
  `lireEchecGeneration` (§2) sans code dédié dans `echecGeneration.ts`.
- La navigation de `se_reconnecter` et l'idempotence de requête côté backend.
- **Où** est détectée une réparation silencieuse de schéma Zod (les
  sentinelles, le seuil `SEUIL_SENTINELLES_REPARATION`) : ça vit dans
  `schemas/sessionSchema.ts`, documenté par ses propres commentaires et tests
  (`schemas/__tests__/sessionSchema.test.ts`), pas ici. **Une fois détectée**,
  en revanche, `screens/newSession/api.ts` la fait entrer dans CE contrat en
  levant un corps typé `code: "SESSION_SCHEMA_INVALID"` (forme §2.1) — donc
  `lireEchecGeneration` (§2) la traite exactement comme n'importe quel autre
  échec du contrat, sans code dédié dans `echecGeneration.ts`.
