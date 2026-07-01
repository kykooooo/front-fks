# Firestore Rules — tests d'émulateur (PR-1)

Infrastructure de tests **reproductible** pour les Firestore Security Rules.
Cette PR **ne modifie pas** `firestore.rules` : elle **documente** le comportement
de sécurité actuel (y compris les fuites) avant la PR de fermeture (PR-4).

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
| `jest.config.js` | Runner Jest dédié (node + ts-jest), isolé de jest-expo |
| `tsconfig.json` | tsconfig CommonJS/Node pour ts-jest (le tsconfig racine exclut ce dossier) |
| `fixtures.ts` | Identifiants + seed admin (`withSecurityRulesDisabled`). Données factices. |
| `rules.baseline.test.ts` | Tests VERTS contre les rules actuelles (légitimes + `CURRENT VULNERABILITY`) |
| `rules.target.test.ts` | 10 scénarios `TARGET` de la future projection `playerSummaries` — **vraies fixtures/assertions**, en `test.skip` (activés en PR-4 en retirant `.skip`) |

## Ce qui est prouvé (baseline, vert aujourd'hui)

**Légitime** : joueuse lit son profil/ses séances ; coach lit les members de son club ;
membre lit le weekContext ; non-membre et non-authentifié sont refusés.

**`CURRENT VULNERABILITY`** (comportement dangereux réel, à inverser en PR-4) :
- coachA lit le **profil brut**, les **sessions brutes** et **plannedSessions brutes** de playerA1 ;
- coachA récupère `feedback.pain`, `feedback.comment`, `metrics.tsb`, `aiV2` depuis le doc brut ;
- tout connecté lit `clubs/{id}` → `inviteCode` exposé ;
- un connecté crée son membership `player` **sans code d'invitation**.

**Contrôles déjà conformes** (resteront `assertFails` après PR-4) :
- coachB (autre club) ne lit ni le profil ni les sessions de playerA1.

## Tests qui seront INVERSÉS en PR-4

Tous les tests du bloc `CURRENT VULNERABILITY` passant en `assertSucceeds`
deviendront `assertFails` une fois les rules fermées et la projection
`clubs/{clubId}/playerSummaries` en place. Voir `rules.target.test.ts`.
