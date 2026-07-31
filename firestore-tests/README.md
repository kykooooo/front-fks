# Firestore Rules — tests d'émulateur

Infrastructure de tests **reproductible** pour les Firestore Security Rules.

- **PR-1** a posé le harness et **documenté** le comportement de sécurité (fuites incluses)
  sans toucher `firestore.rules`.
- **PR-4** (cette itération) **ferme la frontière coach-safe** : `firestore.rules` retire
  l'accès coach aux docs bruts (`users`/`sessions`/`plannedSessions`) et ouvre la lecture de
  la projection `clubs/{clubId}/playerSummaries` au coach/owner du club. Les tests
  `CURRENT VULNERABILITY` de lecture coach sont **inversés** et les 10 tests `TARGET`
  **activés**.

## Commande unique

```bash
yarn test:rules
```

Cette commande :
1. démarre l'émulateur Firestore (`firebase emulators:exec --only firestore`) sur le projet **local** `demo-fks-rules` (préfixe `demo-` = mode hors-ligne, **jamais** de contact avec `fks-apps` prod) ;
2. exécute **uniquement** les tests `firestore-tests/**/*.test.ts` via un runner Jest dédié (`firestore-tests/jest.config.js`, environnement Node + ts-jest) — **séparé** du preset `jest-expo` de `yarn test` ;
3. arrête proprement l'émulateur et propage l'exit code.

## Prérequis

- **Java 21 (Temurin) — requis par FKS.** Accessible via `java` sur le PATH ou `JAVA_HOME`.
  L'émulateur Firestore est une application Java : **sans JDK, la commande échoue au démarrage de l'émulateur**.
  Windows : installer Eclipse Temurin JDK 21 puis vérifier `java -version`.
- **Node : cible CI = Node 22 LTS.** Node 24 est testé localement mais n'est PAS la cible
  du futur chantier Cloud Functions (qui visera Node 22 LTS).
- `node_modules` installé (`yarn install`) — ajoute `@firebase/rules-unit-testing`, `firebase-tools`, `ts-jest`.
- Port `8080` libre (configurable dans `firebase.json` → `emulators.firestore.port`).

La CI (`.github/workflows/firestore-rules.yml`) fige ces prérequis : Ubuntu, Node 22, Temurin 21,
projet `demo-fks-rules` 100 % hors ligne (aucun credential Firebase).

## Structure

| Fichier | Rôle |
|---|---|
| `jest.config.js` | Runner Jest dédié (node + ts-jest), isolé de jest-expo. `maxWorkers: 1` : les suites partagent UN émulateur, sérialisation obligatoire (sinon `clearFirestore` d'un worker écrase un autre) |
| `tsconfig.json` | tsconfig CommonJS/Node pour ts-jest (le tsconfig racine exclut ce dossier) |
| `fixtures.ts` | Identifiants + seed admin (`withSecurityRulesDisabled`). Données factices. |
| `rules.baseline.test.ts` | Tests VERTS contre les rules PR-4 (légitimes + frontière coach-safe FERMÉE) ; les 2 anciens tests « HORS SCOPE » sont INVERSÉS depuis le chantier clubs/invitation |
| `rules.target.test.ts` | 10 scénarios `TARGET` de la projection `playerSummaries` — **vraies fixtures/assertions**, désormais **actifs** (`.skip` retiré en PR-4) |
| `rules.summaryMembership.test.ts` | Mini-hardening : `isPlayerMember` (summary lisible seulement si la joueuse est ENCORE membre player), list refusée, write false, + séquence réelle `members → get summaries` du lecteur coach |
| `rules.clubsInvitation.test.ts` | Chantier clubs/invitation : énumération clubs FERMÉE (list interdite, get réservé membres/owner), annuaire `/inviteCodes/{code}` (get par code exact, list interdite, create owner-only cohérent), self-join GATÉ par la preuve d'invitation (inviteCode dans le doc member), compat membres existants |

## Ce qui est prouvé (PR-4, vert)

**Légitime** : joueuse lit son profil/ses séances ; coach lit les members de son club ;
membre lit le weekContext ; non-membre et non-authentifié sont refusés.

**Frontière coach-safe FERMÉE** (anciens `CURRENT VULNERABILITY` désormais `assertFails`) :
- coachA ne lit **plus** le **profil brut**, les **sessions brutes** ni **plannedSessions brutes** de playerA1 ;
- la lecture qui exposait `feedback.pain`, `feedback.comment`, `metrics.tsb`, `aiV2` est refusée ;
- coach/owner du même club lit la projection `clubs/{id}/playerSummaries` (sans champ interdit) ;
- coach d'un autre club, joueuse d'un autre club, non-membre et non-authentifié : refusés ;
- écriture cliente d'un summary (coach OU joueuse) : refusée (`write: if false`) ;
- la joueuse **conserve** l'accès à ses propres docs bruts.

**Anciennes vulnérabilités hors périmètre PR-4 — FERMÉES** (chantier clubs/invitation, `rules.clubsInvitation.test.ts`) :
- l'énumération des clubs est fermée : `list` interdite pour tous (y compris pagination doc par doc
  et l'ancienne query `where inviteCode ==`), `get` par ID réservé aux membres + owner ;
- la découverte d'un club passe par l'annuaire `/inviteCodes/{code}` (doc ID = code) : `get` par
  code exact pour tout connecté (le code est la capability), `list` interdite, `create` réservé à
  l'owner du club référencé avec un code cohérent, `update`/`delete` interdits ;
- le self-join exige la **preuve d'invitation** : `members` create/update `role: "player"` n'est
  autorisé que si le doc porte l'`inviteCode` EXACT du club (comparé via `get()` serveur) ;
- compat : les membres existants (docs member sans `inviteCode`, cas du pilote) conservent toutes
  leurs lectures (club, weekContext, member doc) et peuvent toujours quitter le club.

**Contrôles déjà conformes** (restent `assertFails`) :
- coachB (autre club) ne lit ni le profil ni les sessions de playerA1.
