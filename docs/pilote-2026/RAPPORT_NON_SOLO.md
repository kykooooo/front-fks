# RAPPORT — Exercices NON-SOLO & situations spéciales (vérification du 11/08/2026)

**Mission** : vérifier comment FKS (app 100 % joueur seul) gère les exercices à 2+ joueurs et les situations spéciales (Signal, partenaire, portes/plots), et construire le filet de tests qui n'existait pas.
**Méthode** : lecture seule partout (front `main` + branches, catalogue V2 backend `readiness3`, backend `origin/main`). Aucun commit, aucun push, aucune installation, aucun appel payant. Tous les chiffres ci-dessous sont lus sur pièces, avec référence fichier:ligne.
~~**Livrables dans ce worktree (NON commités)** : ce rapport + 4 fichiers de tests + 1 config jest d'outillage (liste en §6).~~

> **MISE À JOUR v2 — 11/08, après vérification du copilote + GO Kyllian.**
> Deux corrections intégrées (texte d'origine barré, jamais effacé) : le P1-4 « voix m4a non poussées » était **FAUX** (§4), et le remède du P0 devient « déploiement orchestré, hors périmètre » (§4). Les trois remèdes P1 sont **IMPLÉMENTÉS, testés et poussés** sur la branche dédiée `fix/non-solo-front` (4 commits, AUCUN merge) : garde solo en génération, badge « À deux » + matériel honnête en bibliothèque, purge des stubs fantômes. Compteurs avant/après en §5-bis, checklist téléphone **rejouée** en §6.

---

## 0. L'essentiel en 6 lignes

1. **P0 — La fermeture backend n'est PAS en production.** Le lot A2 (10/08, commit `bf1ec76`) qui empêche le moteur de servir un exo partenaire à un joueur seul vit sur la branche du worktree `readiness3` — le `main` backend (= Render) date du 07/08 et ne l'a pas. Mesure du moteur SANS ce lot : `str_eccentric_nordic_3s` (nordic à 2) servi **1 090 à 1 171 fois sur 44 550 profils solo** par graine, dont ~59 % à des U15.
2. **Le front n'a aucune défense** : si le serveur envoie un exo à 2, il est affiché tel quel, sans mention partenaire (prouvé par test).
3. **La bibliothèque expose 12 fiches non-solo** (5 partenaire + 7 jeux réduits collectifs en stubs absurdes), et n'écrit **nulle part « à 2 »** — le détail affiche même « Sans matériel » pour un nordic à 2.
4. **Le Signal n'existe pas dans le binaire RC** (main) : tout vit sur le train `feat/catalog-v2-signal` ~~+ 1 commit local **non poussé** (`cd98a4a`, les voix m4a du fondateur)~~ **[CORRIGÉ v2 : `cd98a4a` est poussé — contenu dans `origin/feat/catalog-v2-signal`, preuve en §4 P1-4]**. Flag OFF = invisible proprement ; flag ON = flux complet correct (vérifié sur pièces + 17 tests moteur verts).
5. **Le filet est posé** : ~~16 tests front écrits et verts dans ce worktree (dont 4 `test.failing` qui encodent l'état souhaité sans changer le comportement).~~ **[v2 : 19 tests verts, commités — les remèdes étant implémentés, les paires `test.failing` ont été retournées en tests du comportement réel, §5.]**
6. Bonne nouvelle structurelle : le catalogue V2 backend est propre (participation déclarée sur 376 fiches, garde `isCatalogSoloSafe` sur les deux portes) — il ne manque que **le déploiement**.

---

## 1. Inventaire exact (chiffré)

### 1.1 Catalogue V2 backend (`fks-worktrees/readiness3/src/catalog/data/`) — 376 fiches, 14 non-solo

| Fiche (id) | Famille | minPlayers | Coach requis | Statut |
|---|---|---|---|---|
| `nordic_curl_partner` (« Nordic curl (partenaire) ») | force | 2 | non | draft |
| `str_eccentric_nordic_3s` (« Nordic excentrique 3 s (partenaire) ») | force | 2 | non | draft |
| `str_razor_curl` (« Razor curl ») | force | 2 | non | draft |
| `rsa_reaction_sprint_10m` (« RSA sprints 10 m sur signal externe ») | protocols-tests | 2 | non | draft |
| `rsa_ssg_2v2` → `rsa_ssg_6v6` (7 jeux réduits) | protocols-tests | 4 → 12 | **oui** | draft |
| `fks_controlled_contact_reaccel` (« Contact contrôlé et réaccélération ») | situations | 2 | non | draft |
| `fks_scan_and_go` (« Scan et déclenchement ») | situations | 2 | non | draft |
| `fks_shuffle_close` (« Déplacement latéral et fermeture ») | situations | 2 | non | draft |

Alias V2 importants : `str_nordic` → `nordic_curl_partner`, `str_nordic_hamstring_eccentric` → `nordic_curl_partner` (aliases.json). Les 14 sont tous `soloEligible=false` et tous en `draft` (donc jamais dans le pool published).

### 1.2 Les 11 « situations FKS » (situations.json)

- **8 published, solo (minPlayers=1)** : `fks_backpedal_signal_sprint`, `fks_curve_exit_sprint`, `fks_jockey_turn_sprint`, `fks_jump_land_accel`, `fks_late_gate_choice`, `fks_lateral_bound_cut_sprint`, `fks_pogo_to_accel`, `fks_sprint_brake_reaccel`.
- **Dont 3 avec `smartphone` dans l'équipement = les 3 situations Signal** : `fks_backpedal_signal_sprint`, `fks_jockey_turn_sprint`, `fks_late_gate_choice` — exactement la liste `SIGNAL_COMPATIBLE_SITUATIONS` du front train (`engine/signal/signalConfig.ts`).
- **3 draft, partenaire (minPlayers=2, equipment contient `partner`)** : `fks_scan_and_go`, `fks_shuffle_close`, `fks_controlled_contact_reaccel`.

### 1.3 Front `main` (= binaire RC 1.1.0) — 12 ids non-solo présents, surface par surface

Mécanisme clé découvert : `EXERCISE_BANK` complète la banque rédigée par un **stub auto-généré pour CHAQUE id backend absent localement** (`engine/exerciseBank.ts:912-924`, « si un id est manquant localement, on génère un stub »). Résultat :

| id | Bibliothèque | Fiche rédigée ? | Envoyé dans `allowed_exercises` ? | Consignes (« Comment faire ») | Mention « à 2 » ? |
|---|---|---|---|---|---|
| `str_nordic` (« Nordic hamstrings ») | ✅ visible | oui | ✅ | oui (« remonte avec assistance ») | **non, nulle part** |
| `str_eccentric_nordic_3s` (« Nordic excentrique 3s ») | ✅ | oui | ✅ | oui | **non** |
| `str_nordic_hamstring_eccentric` (« Nordic excentrique ischios ») | ✅ | oui | ✅ | oui (« chevilles bloquées » — par quoi ? non dit) | **non** |
| `str_razor_curl` (« Razor curl ») | ✅ | oui | ✅ | oui | **non** |
| `rsa_reaction_sprint_10m` | ✅ **en stub** | non (nom fabriqué depuis l'id) | ✅ | aucune | **non** |
| `rsa_ssg_2v2` … `rsa_ssg_6v6` (7) | ✅ **en stubs** (« Rsa Ssg 2v2 »…) | non | ✅ | aucune | **non** |

Et les 4 ids V2 non-solo restants (`nordic_curl_partner`, `fks_scan_and_go`, `fks_shuffle_close`, `fks_controlled_contact_reaccel`) n'ont **aucune existence front** (ni banque, ni instructions, ni liste backend) — verrouillé par test sentinelle.

Où chaque id peut apparaître aujourd'hui :
- **Génération** : le front envoie les 12 dans `allowed_exercises` (`screens/newSession/api.ts:17-28`) ; le serveur décide. Voir §2 pour l'état réel de la protection.
- **Bibliothèque** (`VideoLibraryScreen`, seule entrée : lien « Fiche » depuis l'aperçu/la séance — route `ExerciseDetail`, `navigation/RootNavigator.tsx:248`) : les 12 sont visibles (seul le filtre **ballon** existe, `isBallExercise` — aucun filtre ni badge partenaire).
- **Détail d'exo** (`ExerciseDetailModal`) : nom, description, consignes, puce Matériel « Sans matériel » (`inferEquipment` retombe sur `bodyweight`, `screens/videoLibrary/videoLibraryConfig.ts:143`).
- **Aperçu de séance** : si servi, `BlockCard` affiche même le bénéfice (`exerciseBenefits.ts:85` : « Ajoute la composante réactive au RSA. » pour `rsa_reaction_sprint_10m`).
- **Boucle de suivi (séance live)** : la raison d'écart « Partenaire indisponible » (`no_partner`) existe (`components/session/liveTrackingHelpers.ts:39`) et le registre de remplacement propose `str_nordic` → `str_nordic_assisted_band` (solo) — le produit avait donc DÉJÀ anticipé qu'un exo à 2 puisse atteindre un joueur seul.
- **Tests terrain, routines, échauffements** : aucun id non-solo (vérifié par grep).
- **Signal** : rien sur `main` (aucun code, aucun asset, aucun id `fks_*` connu du front).

---

## 2. Le joueur seul est-il protégé partout ? — NON, et voici précisément où ça casse

### 2.1 Génération, côté serveur : la bonne garde existe… mais n'est pas en prod (P0)

- La garde est propre et partagée : `isCatalogSoloSafe` = `participation.soloEligible === true && minPlayers <= 1`, appliquée aux **deux** portes de génération (whitelist par token + construction d'EXERCISE_BANK) — `readiness3/src/catalog/catalogSafety.ts:49-61`. Le moteur est solo par défaut (« participants_available absent ⇒ 1 »).
- Le **lot A2 (10/08/2026, commit backend `bf1ec76`)** a fermé le trou restant : les 12 fiches legacy partenaire portent désormais `solo_eligible`/`min_players` lus du V2, et la porte de la **réparation** (`fksPost.okByConstraints`) lit enfin la participation (`shared/participationGuard.ts`). Mesure publiée dans `legacyBankGuard.ts:40-50` : `str_eccentric_nordic_3s` servie **0 fois** sur 44 550 profils × 2 graines après le lot.
- **MAIS** : `git cat-file -e origin/main:src/shared/participationGuard.ts` → **ABSENT**. Le `main` backend (déployé sur Render) s'arrête au 07/08 (`5c62405`). Le lot A2 vit sur la branche du worktree `readiness3` (lignée vague-85), qui a en plus **4 commits locaux non poussés**.
- Ce que ça veut dire en clair : **la prod d'aujourd'hui est l'état « AVANT »**, mesuré dans le même fichier (`legacyBankGuard.ts:60-70`) : `str_eccentric_nordic_3s` servi **1 090 (graine G5-) / 1 171 (Z5-) fois sur 44 550 profils tous SEULS**, dont **641/645 à des U15**, via les tokens `posterior_prehab`, `foundation_a_prevent`, `explo_ankle_stiffness`, `lower_support`. (`str_nordic`, `str_razor_curl` : 0 servi, mais par **accident** — aucun preset matériel ne déclare `partner` ; les jeux réduits `rsa_ssg_*` étaient déjà exclus par un cas spécial.)

### 2.2 Génération, côté front : aucune défense (P1 — prouvé par test)

- `v2ToLocalSession` (`screens/newSession/transform.ts`) a des refus typés pour : item sans charge, exercice dupliqué, blocs vides — **rien sur la participation**. Un item `exerciseId: "str_eccentric_nordic_3s"` traverse et s'affiche. Test vert de constat : `nonSoloGarde.test.ts` « CONSTAT (P1 ouvert) : v2ToLocalSession sert un exo minPlayers=2 tel quel ».
- Le schéma Zod (`schemas/sessionSchema.ts`) valide la structure, pas les ids.
- Pire : le front **invite** le backend à utiliser ces exos — `buildAllowedExercisesPayload()` envoie les 12 ids non-solo dans `allowed_exercises` (prouvé par test), en strippant en plus l'équipement (`equipment: []`, `api.ts:25`), donc même l'indice `partner` disparaît du payload.
- À noter aussi : des **séances planifiées/historiques Firestore générées avant le fix** peuvent déjà contenir ces ids chez de vrais comptes — une garde à la génération ne nettoiera pas ça, seul un **marquage à l'affichage** le couvre.

### 2.3 Bibliothèque : elle PEUT montrer ces exos, mais ne dit jamais « à 2 » (P1 — prouvé par test)

Ce qui s'affiche réellement (cité) :
- Carte liste : « **Nordic hamstrings** » + badge intensité + « Renfo » — rien d'autre (`ExerciseListCard.tsx:51-60`).
- Détail : description « **Excentrique ischios, prévention.** » (`exerciseBank.ts:792`) ; « Comment faire » : « **Genoux au sol, descends en controle vers lavant, remonte avec assistance.** » (`exerciseInstructions.ts:177`) — l'« assistance », c'est le partenaire qu'on ne nomme pas ; Matériel : puce « **Sans matériel** » (fallback `inferEquipment`), alors que la fiche V2 déclare `equipment: ["bodyweight","partner"]`.
- Les 7 jeux réduits apparaissent en stubs : « **Rsa Ssg 2v2** », modalité **Renforcement**, description générique « Renforcement : exécution contrôlée… », « Sans matériel » — pour un 2 contre 2 à 4 joueurs minimum avec coach. Fiches fantômes, trompeuses et inutilisables.
- Comparaison train : sur `feat/catalog-v2-signal`, si un jour `FKS_CATALOG_V2=true` avec fiches publiées, la bibliothèque **masque** les non-solo (`selectVisibleBank` filtre `participation.soloEligible`, `engine/exerciseCatalogV2.ts:345`) — le problème est donc un problème de `main`/flag OFF, pas du futur catalogue.

### 2.4 Là où le produit est déjà bon

- Raison d'écart « Partenaire indisponible » en séance + registre de remplacement `str_nordic` → `str_nordic_assisted_band` (solo), avec refus honnête (`null`) quand rien ne préserve la qualité — `domain/tracking/replacements/registry.ts:272-276`.
- Tests terrain : la batterie ne contient aucun test à 2.
- Zéro id `fks_*` côté front `main` : les situations ne peuvent pas y apparaître par la bibliothèque ; et comme `FKS_CATALOG_V2` est OFF en prod backend pour la génération published, elles ne sont pas servies non plus aujourd'hui.

---

## 3. Les situations Signal — état exact

### 3.1 Aujourd'hui, dans le binaire RC (main)
**Le Signal n'existe pas** : aucun composant, aucun flag, aucun asset audio, aucun id `fks_*` (grep exhaustif). Si un backend en servait un quand même, l'app afficherait le nom prettifié — le préfixe `fks_` n'est pas retiré par `prettifyName` (`helpers.ts:40`), donc « **Fks late gate choice** » — sans consigne, sans vidéo, sans son. Personne ne peut « tomber sur » une situation Signal aujourd'hui.

### 3.2 Sur le train (`feat/catalog-v2-signal`, ~~+ commit local~~ **[v2 : `cd98a4a` inclus, poussé]**), flag OFF (état par défaut)
- `app.json` du train : `"FKS_CATALOG_V2": false, "FKS_SIGNAL_V1": false` (vérifié). Le flag se lit via `EXPO_PUBLIC_FKS_SIGNAL_V1` ou `extra.FKS_SIGNAL_V1` (`config/features.ts`).
- `SignalEntry` (monté dans `SessionLiveScreen.tsx:486`, sous chaque item) : **flag OFF ⇒ `return null`** — strictement invisible, aucune UI dégradée. Cascade de gardes documentée dans le fichier : exercice non compatible ⇒ rien ; `signalConfig` backend absent/invalide ⇒ rien ; assets absents ⇒ pastille passive « Signal FKS bientôt disponible (consignes vocales à venir) » ; tout OK ⇒ bouton.

### 3.3 Flag ON (train) — le flux complet marche-t-il ? OUI, sur pièces :
1. La situation doit être une des 3 compatibles (`SIGNAL_COMPATIBLE_SITUATIONS`) ET porter un `signalConfig` backend valide : mode `voice_direction`, cues ⊆ {gauche, droite}, délais cohérents ≥ 500 ms (`validateSignalConfig`).
2. Les voix sont **bundlées** : `SIGNAL_AUDIO_REGISTRY_FR = { gauche: require(...gauche.m4a), droite: require(...droite.m4a) }` — fichiers présents dans l'arbre git à `cd98a4a` (**gauche.m4a : 19 243 octets, droite.m4a : 18 867 octets**), 100 % hors-ligne, aucun TTS réseau.
3. Bouton « **Lancer Signal FKS** » → overlay : checklist « **Téléphone posé et sécurisé / Espace dégagé autour de toi / Volume monté et audible** » → « Démarrer la séquence » → décompte 5 s (« Prépare-toi ») → par répétition : attente aléatoire (bornes backend) → **voix + affichage GAUCHE/DROITE** (700 ms) → récupération 20 s (« Reviens en marchant ») → 6 répétitions par défaut (surchargées par les reps de l'item), jamais 3 fois le même côté (`maxConsecutiveSame: 2`) → « Séquence terminée ». Pause/Reprendre/Arrêter présents ; aucun score ni temps de réaction affiché (honnête) ; analytics started/completed/abandoned/error.
4. **Vérifié exécutable** : les 2 suites pures du moteur passent ici (**17/17** : `signalConfig.test.ts` + `signalEngine.test.ts`, lancées dans un worktree temporaire détaché sur `cd98a4a`, supprimé après). Les 4 suites audio/UI (`signalAudio`, `SignalEntry` ×2, `useSignalController`) existent et sont à jour (le test dit bien « les fichiers vocaux FR gauche/droite sont bundlés ») mais **ne peuvent pas tourner sur ce PC** : `expo-audio` n'est pas dans le `node_modules` du dépôt (dépendance du train, `npm install` interdit pendant cette mission). À relancer après install sur le train — commande en §6.

**Je n'ai basculé aucun flag nulle part** ; l'état des fichiers est intact (`git status` propre hors livrables listés en §6).

---

## 4. Constats P0 / P1 / P2

| # | Sévérité | Constat | Preuve | Remède proposé (RIEN n'a été appliqué) |
|---|---|---|---|---|
| P0-1 | **P0** | La fermeture « exo partenaire → joueur seul » n'est pas en prod : `participationGuard.ts` absent de `origin/main` backend (07/08) ; lot A2 (`bf1ec76`, 10/08) sur la branche du worktree readiness3, avec 4 commits locaux non poussés. Prod = l'état mesuré à 1 090–1 171 services de `str_eccentric_nordic_3s` / 44 550 profils solo (~2,4 %), dont ~59 % à des U15 | `git cat-file -e origin/main:src/shared/participationGuard.ts` → absent ; `legacyBankGuard.ts:60-70` (mesure) | ~~Déployer le lot A2 (geste Kyllian : merge/push backend → Render, vérifier `GET /ready`).~~ **[v2 : constat réel mais pris en charge à l'étage au-dessus — la prod est volontairement gelée sur l'état mesuré de la RC ; le déploiement de la branche porteuse sera orchestré par Kyllian sur signal du copilote. HORS PÉRIMÈTRE de ce chantier front — rien à faire ici.]** La garde front (P1-1, corrigée) reste la ceinture en plus, pas à la place |
| P1-1 | P1 | Aucune défense front en génération : `v2ToLocalSession` accepte tout id ; refus typés existants (charge, doublon, blocs vides) mais rien sur la participation ; et les vieilles séances Firestore d'avant le fix ne seront jamais nettoyées par une garde à la génération | test vert « CONSTAT » + `test.failing` « SOUHAITÉ » dans `nonSoloGarde.test.ts` | ~~Refus typé `SESSION_SCHEMA_INVALID` … OU marquage « à 2 » à l'affichage. Décision à prendre avant d'implémenter~~ **✅ CORRIGÉ v2 (commit `d17489e`)** : garde `soloGuard.ts` dans `v2ToLocalSession` — équivalent solo via LE moteur de remplacement (raison `no_partner`, tracé en notes, dosage moteur conservé), sinon nom marqué « (à 2) » + consigne « Partenaire indisponible ». Arbitrage du GO : remplacement/marquage, pas de refus |
| P1-2 | P1 | Bibliothèque muette sur le partenaire : 5 fiches à 2 affichées sans aucune mention, puce « Sans matériel », consignes qui parlent d'« assistance » sans dire laquelle | §2.3, tests `nonSoloBibliotheque.test.ts` | **✅ CORRIGÉ v2 (commit `fd1fb6f`)** : badge « À deux » (tone warn) sur la carte liste ET le détail + `inferEquipment` ajoute « Partenaire » (plus jamais « Sans matériel » seul). Les TEXTES des fiches (description/consignes) restent volontairement au chantier parallèle `fix/bibliotheque-precision` |
| P1-3 | P1 | 7 jeux réduits collectifs (4→12 joueurs, coach requis) présents en **stubs absurdes** dans la bibliothèque et le payload (« Rsa Ssg 2v2 », Renforcement, Sans matériel) | test vert « stubs mal catégorisés » (`nonSoloVerrou.test.ts`) | **✅ CORRIGÉ v2 (commit `d5bf735`)** : l'assemblage d'`EXERCISE_BANK` ne stub-e plus aucun id non-solo — les 7 `rsa_ssg_*` ET `rsa_reaction_sprint_10m` disparaissent de la bibliothèque. `BACKEND_EXERCISE_IDS` reste intact (contrat d'ids connus, déjà filtré du payload par P2-1) |
| P1-4 | ~~P1~~ **✖ ANNULÉ v2 — constat FAUX** | ~~Les voix Signal du fondateur (`cd98a4a`, 2 m4a + câblage complet) n'existent QUE sur ce disque : branche `work/signal-audio-integration` en avance de 1 commit sur son upstream `origin/feat/catalog-v2-signal`~~ Mon erreur de méthode : j'avais compté l'avance sur la branche **locale** `feat/catalog-v2-signal` (elle-même en retard sur son remote), pas sur le remote | Contre-preuve (11/08) : `git branch --all --contains cd98a4a` → `origin/feat/catalog-v2-signal` (+ `origin/release/train-front-2026-07-24`) | Aucun geste requis — les voix sont sur GitHub |
| P2-1 | P2 | Le front propose les 12 exos non-solo au backend dans `allowed_exercises` (équipement strippé au passage, `api.ts:25`) — inoffensif une fois A2 déployé, mais c'est une invitation permanente | test « CONSTAT (P2 ouvert) » + `test.failing` | **✅ CORRIGÉ v2 (commit `d17489e`)** : `buildAllowedExercisesPayload` filtre `estExerciceNonSolo` — 0 id non-solo proposé. Bonus plausible côté prod pré-A2 : le moteur matche ses pools sur cette liste cliente, donc les binaires à jour cessent aussi de l'y inviter (non garanti — le backend a ses propres pools) |
| P2-2 | P2 | `foundationExerciseBank.ts` / `exploExerciseBank.ts` : code mort sur `main` (aucun importeur), avec des picks nordic dedans | grep importeurs = 0 | Purge à faire un jour sur branche dédiée (déjà noté en mémoire projet) |

---

## 5. Les tests écrits (le filet) — ~~16/16 verts~~ **[v2 : 19/19 verts, COMMITÉS et poussés sur `fix/non-solo-front`]**

**[v2]** Les remèdes étant implémentés, chaque paire CONSTAT/`test.failing` a été **retournée dans le commit du remède correspondant** (le commit dit lequel et pourquoi — zéro assertion relâchée en silence : les tests sont devenus PLUS exigeants, ils vérifient id, nom, notes, dosage, badge rendu). Un 5e fichier s'ajoute : `screens/videoLibrary/__tests__/nonSoloBadge.test.tsx` (preuve de rendu react-test-renderer : le badge « À deux » apparaît sur chaque fiche partenaire, jamais sur une fiche solo). La fixture ré-exporte désormais la liste depuis le module d'app `engine/nonSoloExercises.ts` — une seule implémentation, consommée par la garde, la bibliothèque ET le payload.

Fichiers d'origine (description du filet v1, conservée) :

1. **`engine/__tests__/nonSoloIds.fixture.ts`** — la vérité figée : 5 ids partenaire + 7 ids jeux réduits + 4 ids backend-only + le marqueur regex « à deux ». Snapshot du catalogue V2 du 11/08/2026, avec la règle de mise à jour écrite dedans (relire la fiche V2 AVANT de toucher au snapshot).
2. **`engine/__tests__/nonSoloVerrou.test.ts`** (6 tests) — verrou d'inventaire : les 12 en bibliothèque (ni plus ni moins), les stubs prouvés stubs (nom fabriqué, zéro consigne, `rsa_ssg_*` mal catégorisés `strength`), les 12 dans `BACKEND_EXERCISE_IDS`, la **sentinelle** (aucun `fks_*` partenaire / `nordic_curl_partner` ne doit entrer côté front — c'est elle qui m'a fait découvrir les stubs SSG), et le chemin `no_partner` (raison libellée + remplacement jamais lui-même à 2).
3. **`screens/newSession/__tests__/nonSoloGarde.test.ts`** (4 tests) — la génération : CONSTAT vert « le front sert un exo à 2 tel quel » + `test.failing` SOUHAITÉ « refus typé » ; CONSTAT vert « le payload propose les 12 » + `test.failing` SOUHAITÉ « n'en propose plus aucun ».
4. **`screens/videoLibrary/__tests__/nonSoloBibliotheque.test.ts`** (5 tests) — la bibliothèque : les 12 passent le filtre ballon ; aucune mention partenaire sur les 5 (CONSTAT) ; « Sans matériel » sur les 12 (CONSTAT) ; `test.failing` « badge à deux sur les 5 » ; `test.failing` « plus aucun jeu réduit en bibliothèque ».

**La mécanique des paires** (aucun comportement modifié, comme demandé) : chaque trou a un test **CONSTAT vert** qui fige l'état actuel, et un **`test.failing`** qui décrit l'état voulu. Le jour où quelqu'un corrige : le CONSTAT casse (à supprimer) et le `.failing` vire au rouge (à dé-marquer) — impossible de corriger sans mettre le filet à jour, impossible de régresser sans le savoir.

**Résultat d'exécution** ~~(ce jour, sur ce worktree) : `Test Suites: 3 passed / Tests: 16 passed, 16 total`~~ **[v2 : filet = `4 suites / 19 tests` verts ; régression complète des zones touchées = `25 suites / 399 tests` verts (engine, newSession, videoLibrary, tracking, feedback)]**.
Sur le train Signal (worktree temporaire, supprimé après) : `signalConfig` + `signalEngine` **17/17 verts** ; 4 suites audio/UI non exécutables ici (`expo-audio` non installé — interdiction d'installer), à relancer après `npm install` sur le train.

**⚠️ Pour relancer depuis CE worktree** (le jest du projet ignore `.claude/worktrees/` : un `npx jest` nu = 0 test = faux vert) :

```bash
node ../../../node_modules/jest/bin/jest.js --config jest.worktree.config.js --runTestsByPath engine/__tests__/nonSoloVerrou.test.ts screens/newSession/__tests__/nonSoloGarde.test.ts screens/videoLibrary/__tests__/nonSoloBibliotheque.test.ts
```

(`jest.worktree.config.js` existe DÉJÀ, committé dans le dépôt — c'est l'outillage maison pour ce piège. Si les fichiers de tests sont un jour mergés dans `main`, ils tournent avec le jest normal du projet, sans config spéciale.)

---

## 5-bis. [v2] Remèdes appliqués — compteurs avant/après MESURÉS

Branche `fix/non-solo-front`, 4 commits poussés, AUCUN merge :
`38f1639` (filet v1 tel quel, l'état d'avant préservé dans l'historique) → `d17489e` (garde solo + payload) → `fd1fb6f` (badge + matériel honnête) → `d5bf735` (purge des stubs).

| Compteur (mesuré par les tests cités) | AVANT (v1, commit `38f1639`) | APRÈS (v2, commit `d5bf735`) |
|---|---|---|
| Exo à 2 dans une séance générée | affiché **nu** (aucune garde — constat `nonSoloGarde`) | **remplacé** par l'équivalent solo (`str_nordic` → « Nordic assisté élastique », note « Servi à la place de… », dosage conservé) ou **marqué « (à 2) »** + consigne « Partenaire indisponible » (`nonSoloGarde`, 6 tests) |
| Ids non-solo proposés au backend (`allowed_exercises`) | **12** | **0** (`nonSoloGarde` payload) |
| Fiches non-solo visibles en bibliothèque | **12** (dont 8 stubs fantômes) | **4** (nordic ×3 + razor, rédigées) — toutes **badgées « À deux »** (`nonSoloVerrou`, `nonSoloBadge`) |
| Stubs fantômes (« Rsa Ssg 2v2 »…, sprint signal) | **8** | **0** (`nonSoloVerrou` purge) |
| Ligne matériel des fiches à 2 | « **Sans matériel** » (mensonge) | « **Partenaire** », jamais « Sans matériel » seul (`nonSoloBibliotheque`) |
| Badge « À deux » (carte + détail) | inexistant | rendu prouvé (`nonSoloBadge.test.tsx`) |

Garde-fous de contexte (voulus, testés) : âge inconnu ⇒ jamais de swap à seuil d'âge (l'alternative élastique exige U15+ au registre) ⇒ marquage ; matériel absent ⇒ pas de swap élastique ⇒ marquage ; un remplacement ne crée jamais de doublon d'id dans la séance.

**⚠️ Risque de merge assumé (coordination)** : le chantier parallèle `fix/bibliotheque-precision` réécrit massivement `exerciseBank`/`exerciseInstructions`/`ExerciseDetailModal` ~~(et avait noté « décision rsa_ssg_* » dans ses restes — décision désormais prise ici : purge)~~. Mes touches dans ces trois fichiers sont d'une chirurgie minimale (1 ligne d'assemblage + 1 import dans `exerciseBank.ts` ; 1 badge + 2 imports dans le modal) pour limiter les conflits — l'ordre de merge des deux branches reste un arbitrage Kyllian.

**[v2.1 — décision Kyllian 11/08 sur les `rsa_ssg_*` : ON MASQUE, rôles répartis.]** Double motif indépendant : **ballon par nature** (doctrine zéro ballon — les fiches V2 déclarent `football` dans l'équipement) **ET non faisables seul** (2v2 → 6v6, minPlayers 4-12). Répartition actée pour que le merge ne fasse pas le travail deux fois :
- **Ici (`fix/non-solo-front`)** : le **masquage MINIMAL d'affichage** — la ligne unique de l'assemblage d'`EXERCISE_BANK` (commit `d5bf735`, portée par `estExerciceNonSolo`), qui les retire de la bibliothèque et du payload. Je ne l'étends pas.
- **`fix/bibliotheque-precision`** : la **purge structurelle** des fiches à la source (leur générateur/catalogue) — c'est là que la décision s'applique en profondeur.
- Au merge : si la purge structurelle atterrit, mon filtre devient une ceinture inoffensive (le simplifier ou le garder = arbitrage du merge) ; en attendant, c'est lui qui protège l'affichage. Le double motif est gravé en commentaire dans `engine/nonSoloExercises.ts` et dans l'assemblage de la banque.

---

## 6. Recette téléphone — 10 gestes max

### 6.A — Sur le binaire RC actuel (`main`, SANS les remèdes) : la liste v1 reste la vérité

Le binaire RC 1.1.0 n'embarque pas la branche `fix/non-solo-front` : tant qu'elle n'est pas mergée + livrée, tu verras encore l'état d'AVANT (fiches muettes, stubs « Rsa Ssg »). La liste ci-dessous sert à constater les trous sur le binaire actuel.

But : voir de tes yeux les constats, et vérifier qu'aucun exo à 2 ne sort en génération.

1. **Séance → Générer** (cycle actif, lieu Maison, aucun matériel coché). Dans l'aperçu, lis le nom de CHAQUE exercice : tu ne dois voir ni « Nordic », ni « Razor », ni « Rsa/2v2/5v5 », ni « réaction ». *Si tu en vois un → c'est le P0-1 en direct : photo + note l'heure, ça prouve que le lot A2 doit partir en prod.*
2. **Regénère 2 fois** (nouvelle séance / variante) et refais la même lecture. Trois séances propres = bon signal (pas une preuve — le moteur ne sert la fiche qu'à ~2,4 % des profils).
3. Dans l'aperçu, touche un exo de renfo → **« Fiche »** : la bibliothèque s'ouvre. Dans la recherche, tape **« nordic »** → ouvre « Nordic hamstrings ».
4. Regarde la fiche : nulle part il n'est écrit « à 2 » ou « partenaire », et Matériel affiche « **Sans matériel** ». *C'est le P1-2 que tu valides de tes yeux.*
5. Recherche **« razor »** → même constat sur « Razor curl ».
6. Recherche **« rsa »** → tu dois voir « **Rsa Ssg 2v2** », « Rsa Ssg 5v5 »… ouvre-en une : catégorie Renforcement, « Sans matériel », aucune consigne. *C'est le P1-3 (fiches fantômes collectives).*
7. **Lance une séance** (Démarrer), sur un exercice ouvre l'option d'écart/adaptation : la liste des raisons doit contenir « **Partenaire indisponible** ». *Le chemin no_partner est câblé — c'est la partie déjà saine.*
8. *(Après merge du train + nouveau binaire, flag OFF)* : génère une séance Explosivité avec une situation `fks_*` → **aucun** bouton ni pastille « Signal » ne doit apparaître.
9. *(Train, flag ON en local : `EXPO_PUBLIC_FKS_SIGNAL_V1=1`)* : la situation montre « **Lancer Signal FKS** » → checklist « Téléphone posé » → Démarrer → pose le téléphone au sol à 5-10 m, volume fort : décompte, puis voix « gauche »/« droite » clairement audibles, ~6 répétitions, jamais 3 fois le même côté, écran « Séquence terminée ». Mets l'app en pause pendant une répétition et reprends : la séquence ne doit pas devenir folle.
10. C'est tout — le reste est couvert par les tests.

### 6.B — [v2] REJOUÉE sur l'état corrigé (build de `fix/non-solo-front`, ex. Expo Go sur la branche) : ce que tu dois voir MAINTENANT

1. **Séance → Générer** (Maison, rien coché) : toujours aucun nom nordic/razor/« Rsa » dans l'aperçu. **Nouveau** : si une vieille séance planifiée (d'avant les fixes) contenait un exo à 2, tu le verras soit en « **Nordic assisté élastique** » avec la note « *Servi à la place de « … » (exercice à 2 — app joueur seul)* », soit avec « **(à 2)** » collé au nom + la consigne de remplacement en note. Plus jamais nu.
2. Aperçu → touche un exo de renfo → **« Fiche »** → dans la recherche tape **« nordic »** : chaque carte nordic porte maintenant le **badge orange « À deux »** à côté du badge d'intensité.
3. Ouvre « Nordic hamstrings » : le badge « À deux » est aussi dans le détail, et la section **Matériel dit « Partenaire »** — plus jamais « Sans matériel ». (Les textes description/« Comment faire » ne parlent pas encore du partenaire : c'est le chantier bibliothèque parallèle — le badge porte l'info en attendant.)
4. Recherche **« razor »** : « Razor curl » badgé « À deux », Matériel « Partenaire ».
5. Recherche **« rsa »** puis **« ssg »** : **plus AUCUNE fiche « Rsa Ssg 2v2 »…« 6v6 » ni sprint à signal** — les 8 fiches fantômes ont disparu de la bibliothèque.
6. Ouvre les **Filtres** de la bibliothèque : une puce matériel « **Partenaire** » existe désormais (elle permet d'isoler ces fiches).
7. En séance live, sur un exercice : la raison d'écart « **Partenaire indisponible** » est toujours là (inchangée — c'est elle que cite la note des exos marqués « (à 2) »).
8. *(Inchangé, après merge du train Signal)* : situation `fks_*` flag OFF → aucun bouton Signal.
9. *(Inchangé, train + flag ON local)* : « Lancer Signal FKS » → checklist téléphone posé → voix gauche/droite → « Séquence terminée ».
10. C'est tout — chaque point ci-dessus a son test committé qui le verrouille.

---

## 7. Limites honnêtes de cette vérification

- Je n'ai **pas exécuté** l'app ni le backend : tout est lu sur pièces + tests unitaires. La recette téléphone (§6) est le complément volontaire.
- Les 4 suites audio/UI du Signal n'ont pas tourné ici (`expo-audio` absent, installation interdite) — moteur pur vérifié, couche audio vérifiée sur pièces seulement.
- Le chiffre « 1 090–1 171 / 44 550 » est la mesure publiée par le backend dans `legacyBankGuard.ts` (balayage 2 graines) — je ne l'ai pas re-mesuré.
- `str_nordic_assisted_band` n'est PAS classé non-solo (c'est l'alternative solo officielle du registre) — si un avis sportif juge qu'un nordic à l'élastique exige aussi un ancrage/partenaire, la fixture est le seul endroit à mettre à jour.

## 8. Fichiers de cette mission

~~AUCUN commit fait — à toi de décider du commit.~~ **[v2 : GO reçu — tout est committé et poussé sur `fix/non-solo-front` (AUCUN merge), sauf ce rapport qui reste non commité.]**

Sur la branche `fix/non-solo-front` (4 commits : `38f1639`, `d17489e`, `fd1fb6f`, `d5bf735`) :
- Tests : `engine/__tests__/nonSoloIds.fixture.ts` · `engine/__tests__/nonSoloVerrou.test.ts` · `screens/newSession/__tests__/nonSoloGarde.test.ts` · `screens/videoLibrary/__tests__/nonSoloBibliotheque.test.ts` · `screens/videoLibrary/__tests__/nonSoloBadge.test.tsx`
- Code (remèdes) : `engine/nonSoloExercises.ts` (nouveau, source unique des ids) · `screens/newSession/soloGuard.ts` (nouveau, la garde) · retouches chirurgicales dans `transform.ts`, `orchestrator.ts`, `api.ts`, `NewSessionScreen.tsx`, `videoLibraryConfig.ts`, `ExerciseListCard.tsx`, `ExerciseDetailModal.tsx`, `exerciseBank.ts`
- Lint : 0 erreur nouvelle (les 3 erreurs eslint restantes préexistent, prouvé par diff — `BackendCtx`/`EquipmentKey` inutilisés + un setState-in-effect, aucun dans mes lignes)

Hors branche : `RAPPORT_NON_SOLO.md` (ce rapport — non commité, dans le worktree `fks-non-solo-verification-50504d`).

Nettoyage fait : worktree temporaire Signal supprimé (`git worktree list` propre), aucun flag basculé, `readiness3` intouché (lecture seule stricte), `jest.worktree.config.js` restauré à sa version committée (je l'avais écrasé par une version équivalente avant de découvrir qu'il existait déjà).
