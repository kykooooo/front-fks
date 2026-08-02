# Faire cohabiter la boucle de suivi joueur et l'espace coach

**Date** : 27 juillet 2026
**Pour** : Kyllian
**Nature** : vérification de contrat + plan d'intégration. **Rien n'a été exécuté** :
aucun merge, aucun push, aucun déploiement, aucune écriture en base réelle.
**Branches concernées** :

- `claude/player-tracking-loop-559906` — la **boucle de suivi joueur** (ce que le
  joueur a réellement fait de sa séance) ;
- `feat/coach-pilot-experience` — l'**espace coach** (ce que l'entraîneur voit).

---

## En une image

La boucle de suivi, c'est **la feuille de match remplie par le joueur** : qui a
fait quoi, ce qui a été changé, ce qui a été sauté. L'espace coach, c'est
**le tableau d'affichage du vestiaire** : il recopie la feuille de match, il ne
la réécrit pas.

Ce document répond à trois questions :

1. le tableau d'affichage attend-il des cases qui existent vraiment sur la
   feuille de match ? (§1)
2. le tableau recalcule-t-il des chiffres au lieu de recopier ? (§2)
3. dans quel ordre fusionner les deux, et comment revenir en arrière ? (§3 à §5)
4. que peut réellement écrire le joueur dans son document, valeur par valeur ? (§6)

---

## 1. Contrat, champ par champ

La chaîne complète est celle-ci, et il n'y a pas d'autre chemin :

```
   TÉLÉPHONE DU JOUEUR                    SERVEUR                     TÉLÉPHONE DU COACH
   ───────────────────                    ───────                     ──────────────────
   domain/tracking/execution.ts
        computeCompletion                                      ┌─ domain/coachView/fromSummary.ts
             │                                                 │      toExecutionView
             ▼                                                 │           │
   Session.execution  ──►  users/{uid}/sessions/{id}.execution │           ▼
   (applyFeedback.ts:217)   (persistHelpers.ts:207)            │  domain/coachView/execution.ts
                                      │                        │   buildExecutionBreakdown
                                      ▼                        │           │
                        functions/src/projector.ts:211         │           ▼
                            projectExecution ────────────────► └─ CoachPlayerScreen.tsx:491
                        clubs/{id}/playerSummaries/{uid}
```

### Tableau de correspondance

| Ce que la vue coach attend | Nom EXACT côté boucle | Nom côté projection coach | Direct ou calculé ? |
|---|---|---|---|
| **Total d'exercices** | *(aucun champ)* → `execution.items` (tableau) | `execution.itemsTotal` | **CALCULÉ** : longueur du tableau, `functions/src/projector.ts:282` |
| **Statut exclusif par exercice** | `execution.items[].status` — `"done" \| "adapted" \| "skipped" \| "replaced" \| "unknown"` (`domain/tracking/types.ts:53`) | jamais projeté tel quel ; agrégé en compteurs | **CALCULÉ côté boucle**, un `switch` range chaque exercice dans UNE case (`domain/tracking/execution.ts:164`) |
| **Remplacement équivalent** | `execution.completion.replacedEquivalent` | `execution.itemsReplacedEquivalent` | **DIRECT** (`projector.ts:227`) |
| **Remplacement partiel** | `execution.completion.replacedPartial` | `execution.itemsReplacedPartial` | **DIRECT** (`projector.ts:228`) |
| Faits / adaptés / sautés | `completion.done` / `.adapted` / `.skipped` | `itemsDone` / `itemsAdapted` / `itemsSkipped` | **DIRECT** (`projector.ts:221-223`) |
| **Séance terminée ou partielle** | `completion.status` — `"full" \| "partial" \| "abandoned"` | `completionStatus` puis `complete` / `partielle` / `interrompue` | **DIRECT**, traduit dans `domain/coachView/fromSummary.ts:43` |
| Pourcentage | `completion.pct` | `completionPct` | **DIRECT**, borné 0-100 (`projector.ts:219`) |
| Raisons d'écart | `completion.mainReasons` puis repli `items[].reason` | `deviationLabels` | **CALCULÉ + FILTRÉ** (`projector.ts:303`) — voir §1.4 |
| **Prescription liée à l'exécution** | `execution.fingerprint` = `execution.snapshot.fingerprint` | **ABSENT de la projection** | **NON TRANSMIS** — voir §1.2 |
| **Version du snapshot** | `execution.version` (= `1`) | **ABSENT de la projection** | **NON TRANSMIS** — voir §1.3 |
| **Date** | `execution.startedAtISO` / `.finishedAtISO` | **ABSENT** ; le coach utilise la date de la SÉANCE (`lastDone.dateKey`) | **APPROCHÉ** — voir §1.5 |
| **Provenance** | *(rien côté boucle)* | `updatedAt` de la projection → « Mis à jour à 14:32 » | **CALCULÉ côté coach**, `domain/coachView/freshness.ts:38` |

### 1.1 Le total d'exercices : le point à connaître

**Ce que je m'attendais à trouver** : un champ `completion.total`.
**Ce qui existe** : rien. `computeCompletion` (`domain/tracking/execution.ts:164`)
produit exactement huit champs — `pct`, `done`, `adapted`, `skipped`,
`replacedEquivalent`, `replacedPartial`, `status`, `mainReasons` — et **pas de
total**.

Le projecteur le sait et retombe sur la **longueur du tableau `items`**
(`functions/src/projector.ts:276-285`). Ça marche, parce que la boucle initialise
un `items` par exercice prescrit (`initExecution`, `domain/tracking/execution.ts:27`)
et ne supprime jamais de ligne.

**Ce que ça implique concrètement** : le jour où la boucle allègerait ce qu'elle
écrit en base — par exemple en ne stockant plus `items` pour économiser de la
place — le coach perdrait **le dénominateur**, donc **tout le détail du calcul**.
Il n'afficherait plus qu'un pourcentage seul avec la mention « le nombre total
d'exercices n'a pas été transmis » (`domain/coachView/execution.ts:99`).
Dégradation honnête, mais silencieuse. C'est le premier des deux pièges que le
test de contrat (§2) surveille.

### 1.2 Le lien prescription ↔ exécution : présent en base, absent chez le coach

`SessionExecution.fingerprint` (`domain/tracking/types.ts:100`) est l'empreinte
de la prescription au moment du lancement. C'est ce qui garantit que l'exécution
décrit **cette séance-là** et pas une autre. Il est bien écrit en base.

Il **n'est pas projeté** vers le coach. Ce n'est pas un oubli défendable ou
indéfendable en soi — c'est un fait à connaître :

- côté coach, le lien prévu ↔ fait passe par **deux références séparées**,
  `lastPlanned` et `lastDone` (`functions/src/projector.ts:376-377`), qui
  coexistent volontairement pour que le coach compare
  (test : `functions/tests/projector.test.ts:429`, « les deux existent en même
  temps ») ;
- le bloc « exécution » est calculé **sur la dernière séance FAITE**
  (`projector.ts:378`), donc sur le même document que `lastDone`. Le lien est
  vrai **par construction**, pas par vérification.

**Traduction foot** : on sait que la feuille de match et le tableau parlent du
même match parce qu'on les a pris dans le même classeur, pas parce qu'on a
comparé les numéros de licence.

### 1.3 La version : écrite, jamais lue

`SessionExecution.version` vaut `1` (`domain/tracking/types.ts:98`). La boucle
elle-même la vérifie avant de relire une exécution
(`state/orchestrators/trackingShadow.ts`, `castSessionExecution` : `version !== 1` → `null`).

Le projecteur coach, lui, **ne la lit pas**. Si la boucle passait un jour en
`version: 2` avec des compteurs renommés, le projecteur lirait des champs
absents, produirait des `null`, et le coach afficherait « détail indisponible »
**sans que rien ne signale la panne**.

C'est le deuxième piège surveillé par le test de contrat.

### 1.4 Les raisons d'écart : ce n'est pas une recopie, et c'est voulu

`deviationLabels` est le seul champ **retravaillé** par le serveur, pour une
raison de sécurité, pas de confort : les raisons `pain` et `fatigue` sont des
données de santé. Elles sont retirées **avant** la décision « mainReasons ou
repli sur items » (`functions/src/projector.ts:303-320`), sinon le vide lui-même
désignait la douleur. Sondes permanentes :
`functions/tests/sensitiveIsolation.test.ts` et
`domain/coachView/__tests__/sensitiveIsolation.test.ts`.

### 1.5 Date et provenance

Deux dates différentes, à ne pas confondre :

- **la date de la séance** (`lastDone.dateKey`), c'est celle que le coach voit
  à côté du détail ;
- **l'heure de fin réelle** (`execution.finishedAtISO`), qui n'est pas transmise.

Conséquence pratique : une séance terminée à 23 h 50 est datée du jour de la
séance, pas de l'heure de fin. Sans importance pour un coach, mais autant le
savoir.

La **provenance** au sens « ces chiffres datent de quand » est calculée côté
coach à partir de la date de mise à jour de la projection
(`domain/coachView/freshness.ts:38`), avec l'horloge du téléphone injectée, jamais
lue en plein rendu.

### 1.6 Et si un champ manque ? Le repli honnête est déjà prouvé

Aujourd'hui, **aucun joueur n'a de champ `execution`** : la boucle n'est pas
mergée. C'est le cas **nominal**, pas une panne, et c'est testé de bout en bout :

| Ce qui est prouvé | Où |
|---|---|
| champ absent → `execution: null` (« c'est le cas NOMINAL ») | `functions/tests/projector.test.ts:539` |
| `execution` mal formé (chaîne, tableau, nombre) → `null`, jamais de plantage | `functions/tests/projector.test.ts:770` |
| un compteur absent ne devient jamais un `0` affiché | `functions/tests/projector.test.ts:777` |
| total inconnu → `null`, jamais `0` (dénominateur impossible) | `functions/tests/projector.test.ts:653` |
| bloc entièrement vide → `null` (« une absence n'est pas une mesure ») | `domain/coachView/__tests__/fromSummary.test.ts:203` |
| total absent → aucune formule affichée, motif nommé | `domain/coachView/__tests__/execution.test.ts:106` |
| nature des remplacements inconnue → on ne répartit pas au hasard | `domain/coachView/__tests__/execution.test.ts:121` |
| compteurs > total → catégories non exclusives → on n'affiche rien | `domain/coachView/__tests__/execution.test.ts:155` |
| à l'écran : bloc « Détail du réalisé pas encore disponible » | `screens/coach/CoachPlayerScreen.tsx:469-486` |

---

## 2. Est-ce que le coach recalcule ? Réponse franche : **non, et c'est vérifié**

C'était le point de vigilance principal. Voici l'état réel.

**La boucle est la seule à calculer.** `computeCompletion`
(`domain/tracking/execution.ts:164`) applique les poids de
`domain/tracking/config.ts:17-26` :

> un exercice **fait** vaut 1, **adapté** 1, **remplacé par un équivalent** 1,
> **remplacé en partie** 0,5, **sauté** 0, **non renseigné** 0.

- Le **projecteur serveur** ne recalcule rien : il **recopie**
  `completion.pct` en le bornant à 0-100 (`functions/src/projector.ts:219`).
- La **vue coach** ne recalcule rien non plus : elle affiche le pourcentage
  **transmis** et refait l'addition **uniquement pour la vérifier**. Si sa
  vérification ne retombe pas sur le chiffre transmis (tolérance : 1 point,
  `domain/coachView/execution.ts:149`), elle **refuse d'afficher le calcul**
  plutôt que d'en montrer un faux (`domain/coachView/execution.ts:229`).

**Le seul endroit où le même savoir existe en double**, ce sont les poids :
`TRACKING_CONFIG.completion.*` côté boucle, `COACH_EXECUTION_POIDS` côté coach
(`domain/coachView/execution.ts:62`). Le commentaire du code le dit déjà
(« MIROIR de la règle serveur »), mais **rien ne le vérifiait automatiquement**.

**Ce que j'ai ajouté** : `domain/coachView/__tests__/trackingLoopContract.test.ts`,
un test de contrat en deux parties.

1. **Toujours joué** (8 tests) : il fige la forme brute de `execution` telle que
   la boucle l'écrit, vérifie que chaque champ lu par le projecteur y est,
   qu'un exercice ne porte qu'un statut, que les deux natures de remplacement
   restent séparées, que le total est bien la longueur de `items`, et que le
   pourcentage 79 % se refait à partir des seuls champs transmis.
   Il contient aussi la **simulation de la panne redoutée** : si la boucle
   annonçait 90 % là où les compteurs donnent 79, le coach refuse le calcul.
2. **Armée au merge** : si `domain/tracking/config.ts` existe, le test compare
   **les poids réels de la boucle** à ceux affichés au coach, un par un.

Preuve que les deux moitiés fonctionnent : j'ai copié temporairement
`domain/tracking/config.ts` depuis la branche boucle, relancé, obtenu
**9 tests verts sous l'intitulé « boucle PRÉSENTE »**, puis supprimé le fichier.
Sans la boucle, la suite affiche « boucle ABSENTE, non mergée » et un test
explicite le dit — ce n'est pas un `skip` masqué.

**Ce qui reste vrai malgré ce test** : le jour où la boucle change ses poids,
le test tombe et **il faudra décider** si le coach suit. Le test ne répare rien,
il empêche la panne d'être silencieuse.

### Une nuance qui compte : `summarizeExecution` n'est PAS la source du coach

La boucle expose bien un résumé compact, `summarizeExecution`
(`domain/tracking/execution.ts:253`), attaché au feedback
(`feedback.executionSummary`, `domain/types.ts:134`). **Le projecteur ne le lit
pas**, et c'est le bon choix : ce résumé **écrase** la distinction équivalent /
partiel en un seul compteur `replaced`. Le coach ne pourrait plus refaire le
calcul. Le projecteur lit `execution.completion`, c'est-à-dire la **source**,
pas le résumé — donc pas de duplication, pas d'appauvrissement.

---

## 3. Les fichiers en intersection : ce qui va réellement se toucher

Vérifié par `git diff --name-only` sur les deux branches depuis leur base
commune `724c062`, plus les fichiers non encore commités de la branche coach.

**Un seul fichier est modifié des deux côtés : `screens/ProfileSetupScreen.tsx`.**

> **Re-vérifié le 27/07 à HEAD `7f625b2`** — l'affirmation n'a pas bougé :
> 132 fichiers touchés côté coach, 71 côté boucle, **intersection = 1**.
> ```bash
> MB=$(git merge-base HEAD claude/player-tracking-loop-559906)   # 724c062
> comm -12 <(git diff --name-only $MB HEAD | sort) \
>          <(git diff --name-only $MB claude/player-tracking-loop-559906 | sort)
> # -> screens/ProfileSetupScreen.tsx
> ```
> Les fichiers encore non commités du chantier coach au moment de cette
> re-vérification (`functions/src/clubInvites.ts`, `functions/src/inviteCodes.ts`,
> `services/clubInvites.ts`) ont été contrôlés un par un : **aucun** n'est touché
> par la boucle. L'intersection reste donc bien de un.

### Les quatre fichiers que la branche coach avait interdiction de toucher

| Fichier | Touché par la boucle | Touché par le coach | Conflit attendu |
|---|---|---|---|
| `domain/types.ts` | oui (+23 lignes) | **non** | **aucun** |
| `state/stores/persistHelpers.ts` | oui (+7) | **non** | **aucun** |
| `schemas/firestoreSchemas.ts` | oui (+7) | **non** | **aucun** |
| `state/orchestrators/applyFeedback.ts` | oui (+69) | **non** | **aucun** |

**Preuve** : `git log --oneline 724c062..HEAD -- <chaque fichier>` renvoie
**vide** pour les quatre, et aucun d'eux n'apparaît dans `git status` de la
branche coach. La consigne a été tenue.

### Le seul vrai conflit : `screens/ProfileSetupScreen.tsx`

La boucle y ajoute une question facultative (« Depuis quand n'as-tu pas eu
d'entraînement régulier ? ») en cinq endroits. Le coach y a réécrit
l'enregistrement du profil (le rattachement au club passe désormais par le
serveur).

Quatre des cinq ajouts de la boucle ne se croisent avec rien. **Le cinquième
tombe en plein dedans** : la boucle ajoute `selfReportedGapDays` juste après
`targetFksSessionsPerWeek`, ligne que le coach a **déplacée** à l'intérieur de la
nouvelle fonction `saveProfile` (`screens/ProfileSetupScreen.tsx`, bloc
`saveProfileThenAttachClub`).

**Comment le résoudre, en une phrase** : garder la version coach du bloc
d'enregistrement, et **y réinsérer les deux lignes de la boucle** juste après
`targetFksSessionsPerWeek: targetFksSessions,`.

**Le vrai danger n'est pas le conflit — c'est de le résoudre en supprimant la
ligne de la boucle.** Aucun test ne monte cet écran. Si `selfReportedGapDays`
disparaît, la question restera affichée à l'utilisateur mais **ne sera plus
enregistrée**, et le filet de reprise après coupure
(`hooks/useSelfReportedGapDays.ts`, lu par `domain/tracking/resumption.ts`)
recevra `null` pour toujours. Panne totalement silencieuse.

**Vérification obligatoire après résolution** (§4, étape 4) :

```
grep -n "selfReportedGapDays" screens/ProfileSetupScreen.tsx
```
Doit renvoyer **3 lignes** : la relecture du profil existant, l'écriture, et
(indirectement) les options. Si le résultat est vide ou incomplet, la
résolution est fausse.

### Le piège qui ne produit AUCUN conflit — **RÉSOLU le 27/07**

C'était la trouvaille la plus utile de cette analyse. Elle est maintenant traitée.

#### Le piège, rappelé

Les deux branches ajoutent, **dans deux fichiers différents**, une déclaration
de types pour `react-test-renderer` :

- boucle : `screens/feedback/__tests__/react-test-renderer.d.ts` (forme
  `export default`) ;
- coach : `types/react-test-renderer.d.ts` (forme `export =`, celle du vrai
  paquet).

Git les fusionne **sans un seul marqueur de conflit** — ce sont deux fichiers
distincts. Mais TypeScript voit deux déclarations du même module qui se
contredisent, et le style `export default` détruit l'accès aux types via
`TestRenderer.ReactTestRenderer`.

#### Ce que ça coûte, mesuré à HEAD `7f625b2`

| Vérification | Résultat avec les deux fichiers présents |
|---|---|
| `npx tsc --noEmit` (typecheck honnête) | **46 erreurs** : 35 × `TS2503 Cannot find namespace 'TestRenderer'` + 11 × `TS7006` (paramètre implicitement `any`, conséquence directe), réparties sur **10 fichiers de test** du chantier coach |
| `npx jest --config jest.coach.config.js` | **75 suites vertes, 1470 tests verts** |

**La suite de tests ne voit rien** (Jest passe par Babel, qui ignore les types).
Seul `tsc` le voit. Un merge « propre et vert » peut donc laisser 46 erreurs de
typage derrière lui.

#### La résolution : UNE seule déclaration canonique

`types/react-test-renderer.d.ts` est désormais **la déclaration canonique
unique du dépôt**, et le fichier le dit lui-même en tête (encadré
« DÉCLARATION CANONIQUE — UNE SEULE DANS LE DÉPÔT »).

Elle est un **sur-ensemble strict des deux shims** :

| Besoin | Qui l'a | Couvert par la canonique |
|---|---|---|
| `import TestRenderer, { act } from "react-test-renderer"` | **les deux branches, à l'identique** | oui — `esModuleInterop: true` (`tsconfig.json`) synthétise le `default` à partir du `export =` |
| `TestRenderer.create(element)` | boucle + coach | oui |
| `act(async () => { … })`, `act(() => { … })` | boucle + coach | oui |
| `act` avec un callback qui **renvoie** une valeur | forme générique du shim boucle | oui — signature élargie en `act<T = void>(callback: () => T \| Promise<T>): Promise<void>` |
| `TestRenderer.ReactTestRenderer`, `ReactTestRendererJSON`, `ReactTestInstance` (types nommés) | coach uniquement | oui — impossible en `export default`, d'où le choix du `export =` |
| `renderer.root`, `findAllByType`, `findByProps`, `update`, `unmount`, `toJSON` | coach uniquement | oui |
| `TestRendererInstance` (interface du shim boucle) | **personne** — déclarée mais jamais importée (vérifié : `git grep TestRendererInstance` sur la branche boucle ne remonte que sa propre déclaration) | sans objet |

**Aucune ligne des tests de la boucle n'est à modifier.** Son test
(`screens/feedback/__tests__/useFeedbackSave.test.tsx`) écrit exactement la même
forme d'import que les tests coach.

#### Le geste à faire au merge — une suppression, rien d'autre

```bash
git rm screens/feedback/__tests__/react-test-renderer.d.ts
```

À faire **dans la branche d'intégration**, pas dans les branches d'origine.

#### La preuve, par simulation locale

Trois mesures enchaînées dans ce worktree, arbre remis propre après chaque étape :

1. **État de départ** — canonique seule : `npx tsc --noEmit --typeRoots ../../../node_modules/@types` → **0 erreur**.
2. **Collision reproduite** — le shim de la boucle copié à son emplacement
   (`git show claude/player-tracking-loop-559906:screens/feedback/__tests__/react-test-renderer.d.ts`) :
   **46 erreurs**, chiffre identique à celui de l'audit initial.
3. **Résolution prouvée** — shim de la boucle retiré, et une sonde temporaire
   transcrivant **la consommation exacte du test de la boucle** (import par
   défaut + `act` nommé, `create()` dans un `act` async, `act` sur un
   `Promise.all`, `act` avec valeur de retour, `act` synchrone) ajoutée au
   projet : **0 erreur**. Sonde supprimée ensuite.

> **Point d'honnêteté** : la coexistence des deux fichiers **ne peut pas** être
> ramenée à 0 erreur. Un module ambiant ne se déclare qu'une fois avec un style
> d'export donné ; `export =` et `export default` ne fusionnent pas. Le passage
> par 0 exige la suppression de l'un des deux — c'est la suppression du shim de
> la boucle, parce qu'elle ne coûte **aucune modification de code de test**,
> alors que l'inverse en coûterait 35 (tous les sites `TestRenderer.<Type>` du
> chantier coach).
>
> La sonde de l'étape 3 **transcrit** le test de la boucle, elle ne l'exécute
> pas : le vrai fichier importe `domain/tracking/*`, `useExecutionStore` et
> `useFeedbackSave`, qui n'existent pas sur cette branche. La vérification
> définitive reste l'étape 4 du plan, après merge réel.

### Le reste : aucun croisement

- La boucle **ne touche ni `firestore.rules`, ni `functions/`** → l'invitation
  serveur et l'autorisation d'accès ne sont pas concernées par la fusion.
- Les deux ajoutent une configuration Jest, mais sous des noms différents
  (`jest.worktree.config.js` pour la boucle, `jest.coach.config.js` pour le
  coach) : aucun conflit, les deux peuvent coexister.

---

## 4. Le plan d'intégration, étape par étape

> Rappel : **c'est toi qui déclenches chaque merge et chaque déploiement.**
> Les commandes ci-dessous sont à exécuter, pas à faire exécuter par un agent.

### 4.0 L'ordre cible, imposé par Kyllian

Cet ordre n'est pas une suggestion de rédaction : c'est la décision. Il prime sur
toute autre séquence proposée ailleurs dans ce document.

1. **boucle joueur**
2. **résolution des conflits**
3. **typecheck et tests**
4. **espace Coach**
5. **tests d'intégration**
6. **validation sur téléphone réel**
7. **seulement ensuite décision de merge et de déploiement**

Ce que cet ordre verrouille, en clair :

- la boucle joueur entre **en premier** — c'est elle qui produit la donnée, le
  coach ne fait que la recopier ; l'inverse ferait entrer un lecteur avant que
  la chose à lire existe ;
- **la décision de merge et de déploiement arrive en dernier**, après la
  validation téléphone. Tant que l'étape 6 n'est pas verte, il n'y a pas de
  décision à prendre — pas de « on merge et on verra ».

Correspondance avec les étapes détaillées ci-dessous : ordre 1 → étape 1 ;
ordre 2 → étapes 2 et 3 ; ordre 3 et 5 → étape 4 ; ordre 4 → étape 3 ;
ordre 6 → étape 5 ; ordre 7 → étape 6 et §5.

### 4.0 bis Les preuves obligatoires après simulation locale de l'intégration

Exigées par Kyllian. **Toutes** doivent être produites, avec le chiffre exact,
avant qu'une décision de merge soit seulement envisagée. Une preuve manquante
vaut preuve rouge.

| # | Preuve exigée | Comment on la produit | Ce qui la rend fausse |
|---|---|---|---|
| **P1** | **Typecheck complet à zéro** | `npx tsc --noEmit` → **aucune sortie** | Toute erreur, y compris dans les tests. C'est exactement ce que le piège `react-test-renderer` rendait invisible. |
| **P2** | **Jest complet vert** | `npx jest` → 0 échec, et le nombre de suites **augmente** par rapport aux 75 de la branche coach seule | Une suite qui disparaît silencieusement (fichier perdu au merge) compte comme un échec. |
| **P3** | **Tests Functions verts** | `cd functions && yarn install && npx jest` | Un `install` sauté : les tests d'intégration émulateur n'ont **jamais** tourné dans le worktree coach. |
| **P4** | **Règles Firestore vertes** | `npm run test:rules` (émulateur, Java requis) | Un émulateur non démarré rend la suite verte par vide. Vérifier le nombre de tests. |
| **P5** | **Aucune donnée sensible ajoutée au coach** | `npx jest sensitiveIsolation` **et** `cd functions && npx jest sensitiveIsolation` | Un champ de santé (`pain`, `fatigue`) qui arriverait jusqu'à la projection — y compris **par son absence**, cf. §1.4. |
| **P6** | **Aucune donnée manquante transformée en faux zéro** | `npx jest domain/coachView/__tests__/trackingLoopContract.test.ts` → intitulé **« boucle PRÉSENTE »** et **9** tests, pas 8 ; plus `npx jest projector` côté Functions | Un `0 %` ou un `0/12` affiché là où la donnée est simplement absente. Un compteur absent doit rester `null`. |
| **P7** | **Aucune dépendance envers une validation manuelle de l'âge** | relecture ciblée : aucun écran joueur, aucune génération, aucune exécution de séance ne doit être bloquée par un état d'autorisation d'accès | Un chemin où le joueur attend une action du club pour s'entraîner. La décision produit est ferme : le club ne valide **jamais** l'âge, et rien du parcours joueur n'en dépend. L'autorisation d'accès ne gouverne **que la visibilité côté coach**. |

Deux vérifications de merge s'ajoutent à ces sept preuves :

```bash
# la question "reprise" de la boucle est toujours enregistree
grep -n "selfReportedGapDays" screens/ProfileSetupScreen.tsx   # attendu : 3 lignes

# une SEULE declaration de react-test-renderer subsiste
git ls-files | grep react-test-renderer
# attendu : types/react-test-renderer.d.ts, et rien d'autre
```

### Étape 1 — Merger la boucle de suivi joueur dans `main`

```bash
cd C:/Users/Gamer/front-fks
git checkout main
git pull
git merge --no-ff claude/player-tracking-loop-559906 -m "merge: boucle de suivi joueur"
```

**Vert exigé avant de passer à l'étape 2** (depuis le dépôt principal, pas depuis
un worktree) :

```bash
npx jest                          # suite front complète
npx tsc --noEmit                  # doit renvoyer 0 erreur
```

**Retour arrière** : `git reset --hard ORIG_HEAD` tant que rien n'est poussé.

### Étape 2 — Créer une branche d'intégration temporaire

**Ne fusionne pas le coach directement dans `main`.** On monte un banc d'essai.

```bash
git checkout -b integration/coach-sur-boucle main
```

Le nom dit ce que c'est : jetable. Elle sert à absorber les conflits et à
prouver que l'ensemble tient, sans jamais mettre `main` en état douteux.

**Retour arrière** : `git checkout main && git branch -D integration/coach-sur-boucle`.
`main` n'a pas bougé.

### Étape 3 — Fusion mécanique de la branche coach

```bash
git merge --no-ff feat/coach-pilot-experience
```

Conflit attendu : **un seul fichier**, `screens/ProfileSetupScreen.tsx` (§3).

Résolution :
1. garder la structure coach (`saveProfileThenAttachClub`) ;
2. réinsérer `selfReportedGapDays` dans l'objet passé à `setDoc`, juste après
   `targetFksSessionsPerWeek` ;
3. garder les quatre autres ajouts de la boucle (constantes, état, relecture du
   profil, chips à l'écran) ;
4. **supprimer** `screens/feedback/__tests__/react-test-renderer.d.ts`
   (le piège sans conflit, §3).

```bash
git rm screens/feedback/__tests__/react-test-renderer.d.ts
git add screens/ProfileSetupScreen.tsx
git commit
```

**Retour arrière** : `git merge --abort` (avant le commit) ou
`git reset --hard main` (après).

### Étape 4 — Tests complets

Les quatre suites, dans cet ordre. **Aucune ne se saute.**

```bash
# 1. Front
npx jest
# attendu : au moins 75 suites, 0 échec

# 2. Typage — LA vérification que le piège react-test-renderer rend obligatoire
npx tsc --noEmit
# attendu : AUCUNE sortie

# 3. Cloud Functions
cd functions && yarn install && npx jest && cd ..
# attendu : 8 suites, 273 tests
# NB : les tests d'intégration émulateur (rebuild / backfill) ont été mis à jour
#      mais JAMAIS exécutés dans le worktree coach — c'est ICI qu'ils se jouent
#      pour la première fois.

# 4. Règles Firestore
npm run test:rules
# attendu : 4 suites, 51 tests
```

Quatre vérifications spécifiques à ce merge, en plus des suites :

```bash
# a) la question "reprise" est toujours enregistrée
grep -n "selfReportedGapDays" screens/ProfileSetupScreen.tsx

# b) le contrat boucle/coach est ARMÉ (et non plus en veille)
npx jest domain/coachView/__tests__/trackingLoopContract.test.ts
# attendu : l'intitulé "boucle PRESENTE" et 9 tests, pas 8

# c) une seule déclaration de react-test-renderer subsiste
git ls-files | grep react-test-renderer

# d) les sondes anti-fuite sont toujours vertes
npx jest sensitiveIsolation
cd functions && npx jest sensitiveIsolation && cd ..
```

**Si (b) affiche encore « boucle ABSENTE »** : le merge n'a pas apporté
`domain/tracking/` — quelque chose s'est mal passé, on ne continue pas.

**Retour arrière** : `git reset --hard main`.

### Étape 5 — Validation téléphone

C'est `docs/coach-pilote-2026-07/CHECKLIST_TELEPHONE.md`. **Sur un vrai
téléphone**, pas dans un navigateur.

Ne pas continuer tant qu'une ligne de la checklist reste rouge.

**Retour arrière** : on corrige sur la branche d'intégration et on rejoue
l'étape 4. `main` n'a toujours pas bougé.

### Étape 6 — Merge final

```bash
git checkout main
git merge --ff-only integration/coach-sur-boucle
```

`--ff-only` est volontaire : si la commande refuse, c'est que `main` a bougé
pendant ce temps et qu'il faut refaire les étapes 3 et 4. Mieux vaut un refus
qu'une fusion à l'aveugle.

```bash
git branch -d integration/coach-sur-boucle
```

**Retour arrière après push** : `git revert -m 1 <sha du merge>`. Jamais de
`push --force` sur `main`.

---

## 5. Séquence de déploiement

Deux lots partent en même temps : **l'invitation serveur** (déjà décrite dans
`CONTRAT_INVITATION.md` §6) et **l'autorisation d'accès** (`AUTORISATION_ACCES.md` §7).
Ils s'enchaînent, et l'ordre n'est pas une préférence.

Et **avant les deux**, une mesure qui peut tout arrêter : le **préflight du
schéma d'appartenance** (étape 1). Ces lots reposent sur une hypothèse — « la
base ne contient aucune appartenance à l'ancien schéma » — qui était vraie le
21 juillet. On ne la suppose plus le jour du déploiement : on la recompte.

### La règle, en une phrase

> **Préflight du schéma d'appartenance d'abord (il peut tout arrêter), migration
> des accès ensuite (à blanc puis pour de vrai), Cloud Functions après, front en
> OTA, règles Firestore en dernier.**

### Le tableau, dans l'ordre

| # | Action | Commande | Pourquoi à cette place |
|---|---|---|---|
| **0** | **Prévenir le coach pilote** | un appel, pas une commande | Au déploiement, tous les joueurs déjà rattachés deviennent **non consultables** (champ absent → refus, `firestore.rules:56-60`). C'est voulu. Ça doit être **annoncé avant**, pas découvert. |
| **1** | **PRÉFLIGHT** : reste-t-il des appartenances à l'ancien schéma ? | `node lib/ancienSchemaPreflightCli.js --projet=<projet> --limite=500` | **Lecture seule** (aucune écriture possible : le port n'a pas de méthode d'écriture, donc ni `--apply` ni `--je-confirme`). Recompte l'hypothèse sur laquelle repose l'absence de chemin de compatibilité. **Verdict autre que `PROPRE` = on s'arrête ici** — voir ci-dessous. |
| **2** | **Simuler** la migration des accès | `node lib/coachAccessBackfillCli.js --projet=<projet> --clubId=<club> --limite=200` | N'écrit rien. On lit les compteurs, on vérifie qu'ils ressemblent à l'effectif réel, et on **note le nombre** affiché (« Le perimetre COMPLET fait N document(s) »). `--projet` et `--limite` sont **obligatoires**, sans valeur par défaut : voir `AUTORISATION_ACCES.md` §7.2. |
| **3** | **Appliquer** la migration, un club à la fois | `node lib/coachAccessBackfillCli.js --projet=<projet> --clubId=<club> --limite=200 --attendu=<N> --apply --je-confirme=<projet>` | `<N>` est le nombre lu à l'étape 2 : si le réel s'en écarte, la commande refuse **avant d'écrire**. Pose `not_required` (mode par défaut) ou `pending` (club en `approval_required`). **Jamais `approved`.** Fait AVANT le reste : sinon le coach perd tout son effectif d'un coup. Sur une cible de production, ajouter `--oui-je-vise-la-production`. Interrompue ? La reprise est décrite dans `AUTORISATION_ACCES.md` §7.2. |
| **4** | **Déployer les Functions** | `firebase deploy --only functions` | Personne ne les appelle encore : ça ne casse rien. Ça met en place les deux callables d'invitation **et** le réalignement automatique de l'accès (`functions/src/triggers.ts:95`). |
| **5** | **Publier le front** en OTA | `eas update --channel testflight` | L'ancien front continue de fonctionner tant que l'étape 6 n'est pas faite. |
| **6** | **Déployer les règles** | `firebase deploy --only firestore:rules` | **C'est l'étape qui ferme réellement les portes** : l'oracle de code club, le self-join, et la lecture des projections sans autorisation. |
| **7** | **Approuver** les mineurs, un par un | console Firebase + registre papier | Aucun écran ne le fait, délibérément (`AUTORISATION_ACCES.md` §7.3). |

### Étape 1 en détail — le préflight du schéma d'appartenance

**Ce qu'il vérifie.** Le modèle d'appartenance a été **remplacé** : l'ancien champ
unique `role` (`owner`/`coach`/`player`/`removed`) a laissé la place à deux axes,
`accessRole` et `playerStatus` (`ESPACE_ET_ROLES.md` §2). Aucun chemin de
compatibilité n'a été écrit, et cette décision repose sur **une observation datée
du 21 juillet** : « la base a été vidée, il n'existe aucun document à migrer ».

**Pourquoi on la recompte.** Cette observation peut être fausse le jour du
déploiement — un club pilote créé entre-temps par l'ancienne version aurait écrit
des appartenances à l'ancien schéma. Le nouveau code les lirait comme « aucune
permission, aucun suivi » : **fail-closed**, donc sans danger pour la sécurité,
mais **un coach perdrait son club en silence**. Ne jamais supposer que la base
sera encore vide le jour du déploiement : c'est exactement ce que cette étape
remplace par une mesure.

**Ce qu'on lit.** Des compteurs, jamais des noms — la commande n'imprime aucun
identifiant d'utilisateur (seule exception : le curseur de reprise, et uniquement
si le plafond a été atteint).

```
[preflightAncienSchema] appartenances lues         : 128
[preflightAncienSchema] ANCIEN schema (champ role) : 0     ← LE chiffre
[preflightAncienSchema] VERDICT : PROPRE
```

**Le verdict, et le code de sortie** (un enchaînement de déploiement peut s'y
arrêter sans lire la sortie) :

| Verdict | Code | Ce qu'on fait |
|---|---|---|
| `PROPRE` | **0** | L'hypothèse est vérifiée **à l'instant**. On passe à l'étape 2. |
| `RESIDU` | **2** | **STOP.** Il reste des documents à l'ancien schéma. Voir ci-dessous. |
| `INCERTAIN` | **3** | **STOP.** Rien trouvé, mais **tout n'a pas été lu** (plafond atteint, ou document illisible). « Rien trouvé » n'est pas « rien à trouver » : on termine le parcours avant de conclure. |
| refus | **1** | Cible absente / différente de l'environnement, plafond absent, options contradictoires. **Rien n'a été lu, aucun verdict n'a été prononcé.** |

**Le plafond est obligatoire** (`--limite=<n>`, sans valeur par défaut) et le
parcours se reprend par curseur, comme les autres outils administrateur :

```bash
# si la sortie dit ARRET SUR PLAFOND, elle donne le point exact :
node lib/ancienSchemaPreflightCli.js --projet=<projet> --limite=500 \
  --reprendre-apres=<clubId>/<uid>
```

⚠️ Le déploiement n'est autorisé que si **toutes** les tranches disent `PROPRE`.
Une seule tranche `INCERTAIN` suffit à ne pas déployer.

#### Si le compte n'est pas zéro : ce qu'on fait, et ce qui n'existe pas

Il faut le dire franchement plutôt que de laisser croire qu'il suffirait de
lancer quelque chose :

> **La migration de l'ancien schéma vers les deux axes N'EXISTE PAS. Elle reste
> à écrire.** Il n'y a aucune commande à lancer, aucun script à réveiller.

Dans ce cas :

1. **On ne déploie pas.** Ni les Functions, ni les règles, ni le front. L'ancien
   code continue de fonctionner sur l'ancien schéma ; c'est la seule situation
   cohérente tant que la migration n'est pas écrite.
2. **On ne bricole pas les documents à la main** dans la console Firebase. À la
   main, on oublie un axe : écrire `accessRole` sans `playerStatus` retire son
   suivi à un entraîneur-joueur, et c'est précisément le défaut que le nouveau
   modèle ferme.
3. **On décide** entre deux chemins, avec les chiffres du préflight sous les yeux
   (`ANCIEN schema`, `dont mixtes`) :
   - **écrire la migration** (un outil sur le modèle de `coachAccessBackfill.ts` :
     cible obligatoire, simulation par défaut, plafond, curseur, compteur attendu,
     confirmation nominative) — le chemin normal dès qu'il y a de vrais clubs ;
   - **repartir d'une base vide**, si et seulement si le compte est petit, connu,
     et que les clubs concernés sont des essais internes — donc reproduire
     l'opération du 21 juillet, en connaissance de cause, puis **relancer le
     préflight** pour le vérifier.
4. **On relance le préflight** après coup. Un `PROPRE` obtenu après action vaut
   mieux qu'un `PROPRE` supposé avant.

### Pourquoi les règles en dernier — et jamais avant le front

Un OTA n'atteint un téléphone **qu'à l'ouverture de l'application**. Un joueur
qui n'ouvre pas FKS pendant trois jours garde l'ancienne version trois jours.

Or l'ancienne version fait deux choses que les nouvelles règles interdisent :
lire `inviteCodes/{code}` et écrire son propre membership. Si les règles partent
en premier, à l'inscription **le questionnaire est perdu** avec un message faux
(« Impossible d'enregistrer le profil »). C'est exactement ce que le nouveau
front corrige. D'où l'ordre.

### Pourquoi la migration des accès avant les Functions

Le refus d'accès existe à **quatre endroits** : les règles
(`firestore.rules:56-60`), le projecteur (`functions/src/projector.ts:341`), le
réalignement automatique (`functions/src/triggers.ts:95`) et la lecture côté app
(`repositories/clubsRepo.ts`). Le projecteur va **plus loin** que les règles : un
refus **supprime la projection déjà en base** (`functions/src/rebuild.ts:93`).

Donc si on déploie les Functions avant d'avoir posé les états, la première
écriture sur un joueur efface sa projection, et le coach voit son effectif
disparaître **avant** qu'on ait pu poser `not_required` sur les majeurs. En
inversant, la perte de visibilité se limite aux mineurs — ce qui est précisément
le but.

### Pourquoi le préflight avant même la migration des accès

Parce que la migration des accès **ne verrait pas le problème**. Elle ne parcourt
que les appartenances portant `playerStatus == "active"` — un champ du **nouveau**
modèle. Une appartenance restée à l'ancien schéma ne le porte pas : elle est
donc **invisible** pour elle, et le serait aussi pour ses compteurs. Elle
passerait, en annonçant un effectif traité qui n'est pas l'effectif réel.

C'est la raison pour laquelle le préflight fait son propre parcours, **sans
aucun filtre** (`functions/src/ancienSchemaPreflightCli.ts`) : filtrer sur un
champ du nouveau modèle reviendrait à prononcer `PROPRE` précisément sur les
documents qu'on cherche.

### Rebuild natif nécessaire ?

**Non.** Aucun fichier natif touché par ces lots (ni `app.json`, ni la partie
native de `package.json`, ni `eas.json`, ni `ios/`, ni `android/`). L'OTA suffit.

⚠️ Rappel indépendant de ce chantier, toujours valable : après un merge de
`feat/catalog-v2-signal`, **aucun `eas update` avant un nouveau binaire**
(`expo-audio` natif).

---

## 6. Les deux champs que la boucle écrit dans `users/{uid}` — contrat de VALEURS

> Ajouté le 28 juillet 2026. **Inventorier un champ ne signifie pas autoriser
> n'importe quelle valeur pour ce champ.** Le lot du 27 juillet (`23b7579`) a posé
> une liste blanche de **noms de champs** sur `users/{uid}`. Elle laissait
> `selfReportedGapDays` et `lastTrackingDecision` accepter **n'importe quoi**.
> C'est maintenant fermé, et voici avec quoi exactement.

### 6.1 Pourquoi ces deux-là ne se traitent pas pareil

| | `selfReportedGapDays` | `lastTrackingDecision` |
|---|---|---|
| Nature | **Signal déclaré par le joueur** — « depuis quand n'as-tu pas eu d'entraînement régulier ? » | **Décision dérivée** par le moteur de règles du téléphone, destinée à influencer la suite |
| Écrit par | `screens/ProfileSetupScreen.tsx` (setup profil) | `state/orchestrators/applyFeedback.ts` (après chaque feedback) |
| Ce qu'on valide | **type, bornes, suppression** — pas la véracité | **contrat fermé** : structure versionnée, énumérations closes |
| Règle | `validSelfReportedGapDays()` | `validTrackingDecisionMap()` + `validTrackingDigest()` |

### 6.2 Le danger de ce lot, et comment il est neutralisé

Ces deux écritures sont **« best-effort »** : un refus de règle est avalé par un
`catch` et **ne produit aucun message pour le joueur**. Un contrat trop strict
n'aurait donc pas cassé bruyamment — il aurait fait **disparaître la donnée en
silence**, après le merge, en production.

D'où la méthode : **le contrat est recopié de la structure réelle**, jamais
inventé, et un test le **rejoue à l'identique** contre l'émulateur
(`firestore-tests/rules.userDocument.test.ts`, section J : les onze positions de
`RULE_ORDER`, plus l'objet complet du setup profil).

**Preuve que ce filet est portant** — deux mutations volontaires jouées puis
annulées :

| Mutation | Résultat |
|---|---|
| `ruleIndex` retiré des clés tolérées (le piège du §6.4) | **27 tests rouges**, dont **la section J entière** |
| contrat remplacé par `return true` (permissif) | **74 tests rouges** |

Les deux sens mordent. Un contrat qui refuserait tout, comme un contrat qui
accepterait tout, se voit ici.

### 6.3 `selfReportedGapDays` — ce qui est accepté, et ce qui ne l'est pas

- **Accepté** : un **entier** de **0 à 3650** jours, ou **`null`** (« je n'ai pas
  répondu » — la valeur réellement écrite quand la question est passée).
- **Refusé** : chaîne, flottant, booléen, map, liste, négatif, au-delà de 3650.
- **Suppression (`deleteField()`) : PERMISE.** C'est une décision, pas un oubli.
  Le joueur écrit déjà `null`, et le lecteur (`hooks/useSelfReportedGapDays.ts`)
  traite « absent » et « null » de la même façon : refuser la suppression tout en
  acceptant `null` serait une distinction sans différence — **zéro protection
  gagnée**, et un futur chemin de réinitialisation cassé en silence. Retirer une
  déclaration qu'on a faite soi-même est par ailleurs légitime.
- **Pourquoi un intervalle et pas la liste des quatre options de l'écran**
  (0 / 21 / 60 / 120) : cette liste appartient à l'UI et changera. Une liste close
  ici ferait disparaître la réponse **le jour où une cinquième option apparaît** —
  exactement la panne qu'on cherche à empêcher. Un test vérifie tout de même que
  **toutes** les options de l'écran tombent dans les bornes (armé au merge).

### 6.4 `lastTrackingDecision` — le contrat fermé, champ par champ

| Champ | Contrainte |
|---|---|
| `version` | littéralement `1` |
| `rulesVersion` | forme `tracking-rules/X.Y.Z` — **la forme, jamais un numéro figé** : le moteur bumpe cette valeur à chaque changement de seuil (`domain/tracking/config.ts`) |
| `decidedAtISO` | forme ISO 8601 (`AAAA-MM-JJ`, partie heure facultative) |
| `kind` | **liste fermée de 10 valeurs** = `TrackingDecisionKind` |
| `targets` | liste, taille ≤ 50 |
| `explanation` | chaîne, ≤ 1000 caractères — **voir §6.5** |
| `signalsDigest` | map à **exactement** 5 clés (`completionRateAvg`, `rpeDeltaAvg`, `painActive`, `gapDays`, `dataQuality`), chacune typée, `dataQuality` en liste fermée de 3 |
| `mode` | `"shadow"` ou `"applied"` — **les deux valeurs du type**, pas seulement celle que le pilote produit |
| `ruleIndex` | facultatif, entier 1 à 99 |

Les **huit premiers champs sont EXIGÉS** (un objet vide ou amputé est refusé) et
**aucune autre clé** n'est tolérée.

#### Le piège trouvé en lisant le code — `ruleIndex`

`ruleIndex` **n'est pas dans le type `TrackingDecision`**, et il **arrive pourtant
en base**. `decideAdjustment` (`domain/tracking/rulesEngine.ts`) construit un
`TrackingDecisionWithRule` — le numéro de la règle qui a matché, 1 à 11 — et le
retourne derrière une signature annotée `TrackingDecision` : **l'annotation
efface le champ pour le compilateur, pas à l'exécution**. `decorateDecision` fait
ensuite `{ ...decision, explanation }`, et l'objet part tel quel dans `setDoc`.

Un contrat écrit depuis le **type** (huit clés) aurait donc refusé **chaque
décision réelle**, sans un message. C'est exactement la panne que ce lot devait
éviter, et elle n'a été vue qu'en lisant la branche.

#### Pourquoi `mode: "applied"` est accepté alors que le pilote n'écrit que `"shadow"`

La liste fermée est **celle du type**, pas le sous-ensemble produit aujourd'hui.
Fermer sur `"shadow"` seul ferait disparaître les décisions **le jour où le mode
Application s'active** — et ce champ **ne donne aucun droit** : le véritable
interrupteur est `trackingConfig`, gelé côté serveur (§6.6).

#### Pourquoi les deux moyennes du digest ne sont PAS bornées

`completionRateAvg` et `rpeDeltaAvg` sont recopiées **sans écrêtage** par la
boucle : quand une valeur source sort de son échelle, elle est **signalée**
(`dataQuality: "inconsistent"`) et **non corrigée** (`domain/tracking/signals.ts`).
Les borner à 0-100 et ±10 refuserait précisément les décisions qui **portent
l'anomalie** — donc effacerait la trace de l'anomalie. On valide le **type**, et
la borne manquante est **nommée** ci-dessous comme un reste.

#### La suppression du miroir est permise

`lastTrackingDecision` est un **miroir multi-appareil**, pas la source : la vérité
vit dans les séances et l'exécution locale. L'effacer ne retire aucun droit à
personne et n'en donne aucun. Suppression **testée**.

### 6.5 ⚠️ ARBITRAGE À RENDRE — « aucun texte libre » vs `explanation`

**L'exigence produit dit « AUCUN TEXTE LIBRE ». La structure réelle en porte un.**

`explanation` est une **phrase en français**, construite par
`domain/tracking/explain.ts` à partir de gabarits dans lesquels sont interpolés
des nombres et des identifiants d'exercices. Exemple réellement écrit en base :

> « Tu as trouvé split_squat_bulgare trop difficile au moins 2 fois. La prochaine
> séance proposera une variante plus accessible, sans réduire le reste du
> programme. »

Une règle Firestore **ne peut pas** vérifier qu'une phrase sort bien d'un gabarit.
Trois options, et une seule est appliquée aujourd'hui :

| Option | Ce que ça donne | Coût |
|---|---|---|
| **A. Interdire le sous-champ** | honore l'exigence à la lettre | **fait tomber CHAQUE décision réelle, en silence**. Inapplicable en l'état |
| **B. Le BORNER** *(appliqué)* | chaîne, ≤ 1000 caractères | la porte n'est plus un espace de stockage libre, mais **elle n'est pas fermée** |
| **C. Que la boucle cesse de l'écrire** | honore l'exigence **et** ne casse rien : l'explication se **reconstruit à la lecture** depuis `kind` + `signalsDigest`, qui sont déjà validés | touche `state/orchestrators/applyFeedback.ts` — **fichier réservé à la branche boucle**, donc **lot post-merge** |

**Ce lot a retenu B pour ne rien casser, et ne tranche pas.** La décision est à
Kyllian. Si c'est C, le passage se fait en deux gestes dans la même fenêtre :
retirer `explanation` de l'objet écrit par la boucle, et retirer le sous-champ
des clés exigées/tolérées des règles.

### 6.6 Ce qu'une règle Firestore ne sait PAS vérifier — les restes, nommés

Ce qui suit n'est **pas** couvert. C'est écrit ici pour que personne ne le
découvre en le cherchant.

1. **Le contenu d'une liste.** `targets` est vérifié comme *liste de taille ≤ 50*.
   Une règle ne sait pas boucler : **les éléments ne sont pas typés**. Un
   `targets: [42, {}, null]` passe.
2. **La validité d'une date.** `decidedAtISO` est vérifié comme *forme* ISO.
   `2026-02-31` passe. Rien ne garantit non plus que la date soit **récente** ni
   cohérente avec `request.time`.
3. **Les deux moyennes du digest** (§6.4) : type seulement, pas de borne — choix
   délibéré, pas un oubli.
4. **Le contenu d'`explanation`** (§6.5) : longueur seulement.
5. **La véracité du signal déclaré.** `selfReportedGapDays` reste une
   **déclaration** : rien ne dit qu'elle est vraie, et ce n'est pas le rôle d'une
   règle.
6. **Une valeur non conforme déposée par l'Admin SDK** resterait en base. La
   validation porte sur les clés **touchées** par le client (et non sur le
   résultat) : c'est ce qui évite de rendre **inécrivable** un document portant
   déjà une valeur non conforme — le titulaire ne pourrait plus jamais modifier
   son profil, et **ça ne casserait qu'en production**. Ce qui est fermé ici,
   c'est qu'un **client** en introduise une. Deux tests le prouvent dans les deux
   sens.
7. **Aucun champ d'autorité ne passe au passage** : une décision parfaitement
   valide accompagnée de `role: "coach"` ou de `trackingConfig` est refusée —
   c'est la liste blanche du lot précédent qui s'en charge, et c'est **testé
   explicitement** ici pour que le couplage soit visible.

### 6.7 HORS PÉRIMÈTRE de ce lot — le volet à faire APRÈS le merge de la boucle

Kyllian a aussi demandé que **ces écritures cessent d'être silencieusement
best-effort**. **Ce n'est pas fait, et c'est délibéré** : ce volet vit dans
`state/orchestrators/applyFeedback.ts`, l'un des quatre fichiers **réservés à la
branche boucle** (§3). Le faire ici créerait un conflit sur exactement le fichier
qu'on protège depuis le début du chantier coach.

**Ce que le lot post-merge devra faire — à ne pas perdre :**

| # | À faire | Pourquoi |
|---|---|---|
| 1 | **Conserver localement en « non synchronisé »** quand l'écriture est refusée | aujourd'hui la décision est simplement perdue |
| 2 | **Reprendre via la queue hors-ligne existante** (`utils/offlineQueue.ts`) | le mécanisme existe déjà pour le feedback ; il n'est pas branché ici |
| 3 | **Ne pas prétendre que la prochaine adaptation utilisera la décision** si elle n'a pas été enregistrée | honnêteté d'affichage |
| 4 | **Journaliser sans donnée sensible** | aujourd'hui : un `console.warn` en dev, **rien** en production |

**Quelles écritures deviennent refusables** (elles ne l'étaient pas avant ce lot,
puisque n'importe quelle valeur passait) :

- `setDoc(users/{uid}, { lastTrackingDecision }, { merge: true })`
  (`applyFeedback.ts`, bloc « 8bis ») — refusée si la décision ne satisfait pas
  le contrat §6.4 ;
- `setDoc(users/{uid}, { …profil, selfReportedGapDays }, { merge: true })`
  (`ProfileSetupScreen.tsx`) — refusée si la valeur sort du §6.3. **Celle-ci
  emporte tout l'enregistrement du profil**, pas seulement le champ : c'est le
  cas le plus visible, et il est déjà couvert par le message d'erreur de l'écran.

**Pourquoi leur échec est aujourd'hui invisible** : le bloc « 8bis » de
`applyFeedback.ts` est entouré d'un `try/catch` global qui avale tout, et
l'écriture elle-même passe par `retryWithBackoff(...).catch(...)` avec un
`console.warn` **conditionné à `__DEV__`**. En production : **aucune trace,
aucun message, aucune donnée**.

**Tant que ce volet n'est pas fait**, le filet reste la suite de tests : si le
contrat et la boucle divergent, c'est le rejeu (section J) qui rougit — au merge,
sur un poste de dev, et pas sur le téléphone d'un joueur.

### 6.8 Verrous ajoutés à la suite de règles

- les trois énumérations des règles (`trackingDecisionKinds`,
  `trackingDataQualities`, `trackingDecisionRequiredKeys`) sont **comparées à
  l'inventaire tenu dans le test** — elles ne peuvent plus dériver en silence ;
- **armé au merge** : dès que `domain/tracking/types.ts` et
  `domain/tracking/config.ts` existent, deux tests comparent la liste des `kind`
  et la forme de `rulesVersion` **au code réel**. Tant que la boucle n'est pas
  mergée, un test l'**annonce** (« la boucle est ABSENTE (non mergée) ») — ce
  n'est pas un `skip` masqué.


---

## 7. Ce que ce document ne garantit pas

1. **Je n'ai pas exécuté le merge.** Les conflits décrits sont déduits de la
   comparaison des diffs (`git diff --name-only`, positions de hunks). Le seul
   fichier en intersection est certain ; la position exacte du conflit est très
   probable, pas prouvée par une fusion réelle.
2. **La collision `react-test-renderer` est RÉSOLUE, et la résolution est
   mesurée** (§3) : 46 erreurs `tsc` avec les deux fichiers, suite Jest verte
   malgré tout, **0 erreur** avec la seule déclaration canonique et la
   consommation de la boucle transcrite. Ce qui reste non prouvé ici : la
   sonde transcrit le test de la boucle, elle ne l'exécute pas — le vrai
   fichier ne peut pas compiler sur cette branche (il importe
   `domain/tracking/*`, absent). La preuve définitive est P1 à l'étape 4.
3. **Les tests d'intégration émulateur des Functions n'ont jamais été joués** ici
   (`functions/node_modules` absent de ce worktree). Ils sont à l'étape 4.
4. **Le script de migration des accès n'a jamais été exécuté.** Aucune donnée
   réelle lue ou modifiée. Son exécution est une décision humaine.
5. **Le préflight du schéma d'appartenance n'a jamais été exécuté non plus.**
   Il est écrit et testé uniquement sur des données inventées
   (`functions/tests/ancienSchemaPreflight.test.ts`). Ce qu'il prouve à ce stade :
   qu'il compte juste, qu'il refuse de conclure sur une lecture tronquée, et
   qu'il ne peut pas écrire. Ce qu'il ne dit pas encore : l'état réel de la base
   — c'est justement ce que l'étape 1 va chercher, le jour du déploiement.
   **Et la migration correspondante n'existe pas** : si le préflight trouve
   quelque chose, il n'y a rien à lancer, il y a quelque chose à écrire.
6. **Le test de contrat ne répare rien.** Il fait du bruit quand la boucle change
   de forme. La décision reste humaine.
7. **Les poids restent recopiés à deux endroits** (boucle et coach) et, pour les
   règles, une **troisième fois à la main** dans `firestore.rules` pour la liste
   des états autorisants. Ce sont des tests qui tiennent ces accords, pas le
   compilateur.
8. **Le contrat de valeurs du §6 a été écrit et testé contre une branche NON
   MERGÉE.** Il est dérivé de la lecture de `claude/player-tracking-loop-559906`
   à son état du 28 juillet, et rejoué contre l'émulateur — mais **la boucle
   elle-même n'a jamais tourné contre ces règles**. La preuve définitive est le
   passage téléphone après merge : ouvrir une séance, la terminer, remplir le
   feedback, puis vérifier dans la console Firebase que
   `users/{uid}.lastTrackingDecision` **existe et est à jour**. S'il est absent,
   le contrat est trop strict — et il n'y aura **aucun message** pour le dire.
9. **Le volet « ne plus être silencieusement best-effort » n'est PAS fait**
   (§6.7). Il est décrit, pas exécuté, et il attend le merge de la boucle parce
   qu'il touche un fichier réservé. Tant qu'il n'est pas fait, une décision
   refusée reste **perdue sans trace en production**.
