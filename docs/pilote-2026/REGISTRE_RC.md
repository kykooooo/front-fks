# REGISTRE DE FERMETURE — RC PILOTE FKS

> Établi le 03/08/2026, **mis à jour le 04/08 : RC FRONT COMPLÈTE** (`origin/main` = `55aed5a`, 7 merges vérifiés au git). Chaque état est **vérifié** (git, prod live, harnais rejoués) — pas recopié de mémoire.
> Légende : ✅ FERMÉ PROUVÉ · 📦 LIVRÉ PAS INTÉGRÉ · 🔶 OUVERT · 🛑 BLOQUANT PILOTE
>
> **Répartition des rôles (actée 03/08)** : l'**exécution** des merges et des lots = session **copilote** (elle a les dossiers et les postes de merge) · **Kyllian** = les gestes (push backend, Render, EAS, console Firebase, recette pouces) · **cette session** = registre, calendrier, pitch, préparation des E-steps et vérifications indépendantes. Personne d'autre ne merge.

## 0. État de référence vérifié (03/08 soir)

| Quoi | État vérifié |
|---|---|
| Front `origin/main` | **`55aed5a` = LA RC FRONT COMPLÈTE** — chaîne des 7 merges vérifiée au git : boucle (`f0da824`), coach (`30183dc`), da-polish (`da9f929`), accessibilité (`4e24739`), **contrat d'erreurs (`fd24eeb` — le P0 fausse séance est MORT sur main)**, entrée coach (`b50539a`), Home VNext (`55aed5a`, décision finale « écran normal jour 1 »). **Zéro dépendance changée depuis 4e24739** (vérifié) → toujours 0 natif vs beta-1, OTA permis |
| Backend `origin/main` | `ca3126f` = exactement le commit prod (`GET /ready` le confirme) |
| Backend `feat/vague-85` | Tip distant avancé à `9cc1f3b` (la session route-vers-7 continue) — **le gel à `a30ec3f4bf30dd1fb06592cac9b1c7a134414a89` tient et reste fast-forward pur (re-vérifié 04/08)** : les commits post-gel restent hors RC, exactement le rôle du gel |
| Recettes téléphone | Inscription / coach / Home : **passées, rapporté par le copilote 04/08** (pouces Kyllian) — feuilles de score à consigner au rapport final. La recette COMPLÈTE sur le binaire TestFlight (E8, §2.4) reste due |
| ⚠️ Prérequis build restant | **Bump 1.1.0 PAS FAIT** (vérifié : `app.json` = `"version": "1.0.0"` sur `55aed5a`, arbitré OUI pourtant) + le checkout principal est sur une branche dryrun (`main` retenu par le worktree merge-main, qui n'a pas de node_modules) → 2 min de prépa copilote avant la carte 2 |
| Flag catalogue V2 | **Volonté Kyllian = ON** (config mesurée 6,72) → **vérification faite, double GO** (§2.2b) |
| Clubs fantômes prod | 2 clubs sans membre + 2 comptes test + 4 docs — inventaire §2.5 inchangé |

---

## 1. Les 10 critères du GOAL — état prouvé

| # | Critère | État | Preuve / Reste |
|---|---|---|---|
| 1 | Branches sauvegardées | ✅ | Tout le périmètre : local = origin vérifié |
| 2 | Boucle joueur validée puis intégrée | ✅ | Merge `f0da824`+`971c37c`, recette avant merge |
| 3 | Coach fusionné après la boucle | ✅ *(code)* / 🔶 *(recette)* | Merge `30183dc`, CI verte, rules alignées. Recette coach **rapportée passée 04/08** (copilote) — feuille de score à consigner ; reste le rejeu sur binaire (E8) |
| 4 | Home VNext source canonique | ✅ | **MERGÉ** (`55aed5a`, « écran normal jour 1, résumé canonique ») — recette Home rapportée passée ; rejeu sur binaire en E8 |
| 5 | Train release + natifs identifiés | ✅ | 0 natif ajouté depuis beta-1 (re-vérifié sur `55aed5a`) ; binaire beta-1 **expiré** (90 j) → build obligatoire ; OTA permis sur la RC |
| 6 | Aucune fausse séance possible | ✅ | **MERGÉ** (`fd24eeb`) — le P0 est mort sur main ; le parcours d'échec réseau se rejoue sur binaire (§2.4-C2) |
| 7 | P0 sécurité (auth puis rotation) | 🔶 | §2.1 — séquence actée, gestes Kyllian. Clé en dur = clé **backend FKS**, pas OpenAI |
| 8 | Tests + parcours téléphone | 🔶 🛑 | Recettes partielles passées (rapportées) ; **reste LA recette complète sur le binaire TestFlight** (§2.4) |
| 9 | UNE branche/RC cohérente | ✅ | **RC = `origin/main` `55aed5a`** — l'ensemble cohérent pilote tient dans une seule branche |
| 10 | Rapport final | 🔶 | Ce registre, complété à la fermeture |

---

## 2. Les points nommés

### 2.1 P0 sécurité backend — la clé à faire tourner

Faits vérifiés (03/08) : la clé en dur d'origin/main = **clé backend FKS** (`x-fks-api-key`/`FKS_API_KEY`, 3 scripts dev), 0 littéral `sk-` sur l'arbre ; assainie sur vague-85 (env-only) ; métrique `firebase-compat` uniquement sur vague-85 (arrive avec E6) ; usages clé statique déjà logués `[LEGACY_AUTH]` en prod ; `FKS_ENFORCE_FIREBASE_AUTH` défaut = transition ; Firebase Admin **non prouvé** en prod (`/ready` ne teste que la clé OpenAI).

**Séquence actée (chaque flèche = go Kyllian)** : métrique déployée (E6) → preuve Firebase Admin sur Render (`FIREBASE_SERVICE_ACCOUNT_JSON` + test) → observation (métrique + `[LEGACY_AUTH]` ≈ 0) → `FKS_ENFORCE_FIREBASE_AUTH=true` → rotation `FKS_API_KEY`. Fenêtre idéale : avant distribution (zéro utilisateur à casser).

### 2.2 Merge backend + deploy Render (arbitré : figé `a30ec3f`)

Fast-forward pur re-vérifié après fetch. Ce que la session « route vers 7 » poussera après `a30ec3f` reste hors RC. Carte de geste : §3bis, carte 1.

### 2.2b Flag `FKS_CATALOG_V2=ON` — VÉRIFIÉ, DOUBLE GO (03/08 soir)

Arbitrage Kyllian : ON (les textes curés — la config mesurée 6,72) ; voix/vidéos de toute façon absentes de la RC front (catalog-v2-signal OUT). Vérification exécutée sur pièces :

- **Backend, arbre RC exact `a30ec3f`** (worktree jetable, harnais sans LLM, 0 appel payant) : `catalog:parity` = **0 error / 60 warns** (tous `equipment_added` = restrictions sûres) ; 9 suites vitest catalogue = **107/107 verts** ; **masstest flag ON : 1 392 séances, 0 violation dure, 0 profil cassé/444** (douleur, matériel, ballon, solo à zéro) ; chaque item du payload porte `name` + description inline (indépendants de l'ID) ; `catalog_version` étampé flag ON, payload byte-identique flag OFF.
- **Front RC** (main `4e24739` + version mission-r3 des fichiers concernés) : **aucun chemin ne crashe sur un ID V2 inconnu** — Preview/Live/Summary/Historique rendent depuis le payload (`item.name`), détail d'exercice = toast propre + catalogue (pas d'écran vide), instructions/vidéos = repli propre (recherche YouTube), remplacement de la boucle = dégradé honnête (zéro proposition), aucune validation par liste d'IDs à la réception, refus typés mission-r3 agnostiques à l'ID.
- **Dégradations acceptées, à dire honnêtement** : sur ~28 IDs V2 nouveaux, pas de fiche détaillée locale ni de proposition de remplacement (le nom, les consignes inline et la séance restent complets). Points de vigilance non bloquants consignés : doublon d'ID = refus en bloc (couvert par l'invariant backend #40, 0 violation au masstest) ; `allowed_exercises` envoie encore la banque V1, ignorée par le chemin V2.

**Verdict : GO flag ON.** Ajout d'un point de recette dédié (§2.4-C5). Repli documenté si la recette téléphone contredit : remettre `FKS_CATALOG_V2=false` sur Render (retour instantané, payload byte-identique prouvé) et le dire.

### 2.3 Le nouveau binaire

Binaire beta-1 (26/04) **expiré** → build obligatoire. 0 natif ajouté depuis (Sentry 7.2→8.1 réaligné par le build). **Bump `1.1.0` arbitré OUI** (isole le runtime). OTA ensuite autorisé pour les correctifs (0 natif dans la RC). Config EAS en place (profils `testflight` build + submit). Carte de geste : §3bis, carte 2.

### 2.4 La recette téléphone COMPLÈTE (le vérificateur final)

Sur le **binaire TestFlight**, pas Expo Go :

**A. Joueur** — `docs/boucle-suivi-2026-07-25/RELEASE_BOUCLE.md` § Parcours manuel (5 points).
**B. Coach** — `docs/coach-pilote-2026-07/CHECKLIST_TELEPHONE.md` (A-F, ~25 min, « une seule case rouge suffit à ne pas déployer ») = le « Temps 2 » jamais déroulé, sur prod avec de vraies actions. Dossier fusionné 118 Ko hors dépôt (scratchpad session 3de282a6) à récupérer/committer, sinon la checklist committée fait foi.
**C. Points additionnels sans couverture test :**
1. `selfReportedGapDays` écrit en base (21/60/120 ; 0 et null déjà prouvés en prod ; 0 ≠ null).
2. Parcours d'échec réseau (contrat d'erreurs IN) : mode avion pendant génération → carte honnête, **aucune séance fabriquée**, rien compté en charge.
3. Bug 3 latence ~15 s post-setup : re-mesurer sur binaire release ; décision selon mesure.
4. Entrée « Je suis coach » : Welcome → création club + retour arrière.
5. **NOUVEAU — flag V2 ON** : générer 1 séance réelle, vérifier l'affichage complet, ouvrir le détail d'un exercice nouveau (toast possible = attendu, pas un bug), tester « Modifier » → si zéro proposition de remplacement sur un exo V2, c'est le dégradé documenté.

### 2.5 Nettoyage prod (gestes Kyllian, console Firebase `fks-apps`) — inchangé

4 docs Firestore + 2 comptes Auth, rien d'autre (vérifié : 0 membre, 0 sous-collection, 0 inviteCode) :
1. Firestore `clubs` → supprimer `R5cgVox7Y5cNla05R3Yc` (« Tg ») et `o6sKylrS7GI56wbO0xj1` (« J'dis Bi »).
2. Firestore `users` → supprimer `sUevKklO3yYdrOP0d8dMZcNhI152` (Bejej) et `wDPG2P0sM4dgJadDyK6rEyaJrS63` (Borjbf).
3. Authentication → supprimer `bdjdk@gmail.com` et `bfkdkdi@gmail.com`.
Moment : juste avant les invitations TestFlight (les comptes peuvent encore servir à la recette).

---

## 3. Plan d'exécution (statuts + propriétaires)

| # | Étape | Propriétaire | Statut |
|---|---|---|---|
| E1 | Arbitrages de périmètre | Kyllian | ✅ RENDUS 03/08 (contrat d'erreurs IN, Home parallèle, backend `a30ec3f`, flag ON, 1.1.0, tarif) |
| E2 | Merge `da-polish` | Copilote | ✅ FAIT — `da9f929` poussé, vérifié |
| E3 | Merge `cta-reduce-motion` | Copilote | ✅ FAIT — `4e24739` poussé, vérifié (annoncé « en cours », déjà terminé) |
| E4 | Merge contrat d'erreurs | Copilote | ✅ FAIT — `fd24eeb`, vérifié ancêtre de main |
| E5 | Entrée « Je suis coach » + Home VNext | Copilote + Kyllian (recettes) | ✅ FAIT — `b50539a` + `55aed5a`, recettes rapportées passées |
| E6 | Push backend + /ready + flag V2 | **Kyllian** | 🟢 **DÉPLOYÉ EN PROD (04/08 22:52)** : push `5c62405` fait par Kyllian, `/ready` = `"commit":"5c62405..."` vérifié en continu (bascule observée à 22:52:36). Le moteur RC (gel `a30ec3f` + fix build `5c62405`) remplace le moteur de juillet. Au passage : la métrique `firebase-compat` est désormais déployée (E9 devient observable). *Incident consigné : le deploy initial d'`a30ec3f` échouait — tests compilés par le build de prod + fixtures mesureB non versionnées ; fix 3 fichiers prouvé sur archive git propre.* **Reste : flag `FKS_CATALOG_V2=true` sur Render** (double GO §2.2b) puis re-vérifier `/ready` |
| E6b | Vérification flag V2 vs front RC | Cette session | ✅ FAIT — double GO (§2.2b) |
| E7 | Build + submit | **Kyllian** | 🟡 **Prépa ✅ (04/08 soir)** : checkout principal remis sur `main`, bump 1.1.0 poussé par le copilote (`6574882` = **nouveau tip RC front** = `55aed5a` + bump, vérifié aligné local/distant). **Reste : `eas build --platform ios --profile testflight` puis `eas submit --platform ios --profile testflight --latest`** depuis `C:\Users\Gamer\front-fks` |
| E8 | Recette RC complète (§2.4) | Kyllian (pouces) + moi (support, checklists) | 🔶 ; correctifs → « go OTA » |
| E9 | Sécurité — observation | Kyllian (lecture) ; je prépare la commande métrique | 🔶 après E6 |
| E10 | Sécurité — Admin prouvé → enforce → rotation | Kyllian (Render) | 🔶 avant distribution |
| E11 | Nettoyage prod + invitations TestFlight | Kyllian | 🔶 |
| E12 | Rapport final | Cette session | 🔶 |

## 3bis. Cartes de geste (prêtes à déclencher)

### Carte 1 — E6 : backend `a30ec3f` → prod + flag V2

> ⚠️ Toutes les cartes sont en syntaxe **PowerShell** (le terminal de Kyllian) : une commande par ligne, jamais de `&&`, chemins en `C:\`.

```powershell
git -C C:\Users\Gamer\fks push origin 5c6240588f521d4787fa84e2613fd67041f1f82b:main
```

(= le gel `a30ec3f` + le fix de build `5c62405`, fast-forward pur vérifié.) Render déploie seul (2-5 min). Vérifier (ou ouvrir l'URL dans le navigateur) :

```powershell
curl -UseBasicParsing https://fks-backend-xmnb.onrender.com/ready
```

Attendu : `{"ok":true,...,"commit":"5c6240588f521d4787fa84e2613fd67041f1f82b"}`.

Puis dashboard Render → service backend → **Environment** :
- `FKS_CATALOG_V2` = `true` (double GO §2.2b) → Render redéploie → re-vérifier `/ready`.
- **Ne PAS toucher** `FKS_DOCTRINE_MODE` (reste shadow par défaut) ni `FKS_ENFORCE_FIREBASE_AUTH` (séquence E9-E10).
Smoke depuis ton téléphone (optionnel mais recommandé, 1 génération) : séance complète affichée, détail d'un exercice ouvert — un toast « exercice inconnu » sur un exo nouveau est le dégradé documenté, pas un bug.
Repli si problème : `FKS_CATALOG_V2` = `false` (retour instantané, payload byte-identique prouvé) — et on le dit.

### Carte 2 — E7 : binaire TestFlight 1.1.0

**Prépa d'abord (vérifiée encore nécessaire le 04/08)** : le bump 1.1.0 n'est pas fait (`app.json` = 1.0.0 sur `55aed5a`) et le checkout principal est sur une branche dryrun pendant que `main` est retenu par le worktree merge-main (sans node_modules — or `app.config.js` impose de builder là où node_modules existe, donc au principal). Séquence PowerShell, une commande à la fois :

```powershell
cd C:\Users\Gamer\front-fks
git -C .claude\worktrees\merge-main checkout --detach
git checkout main
git pull origin main
notepad app.json
```

Dans le Bloc-notes : ligne `"version": "1.0.0"` → remplacer par `"version": "1.1.0"`, enregistrer, fermer. Puis :

```powershell
git add app.json
git commit -m "chore(release): version 1.1.0 pour le binaire RC pilote"
git push origin main
```

⚠️ Ne committer QUE app.json — `git status` montrera des yarn.lock modifiés : les laisser tels quels, à trier plus tard. Si `git checkout main` bloque sur un fichier, s'arrêter et me le dire — ne rien forcer.

Puis les gestes Kyllian, l'un après l'autre (toujours depuis `C:\Users\Gamer\front-fks`) :

```powershell
eas build --platform ios --profile testflight
```

Puis, quand le build est terminé :

```powershell
eas submit --platform ios --profile testflight --latest
```

Notes : `npm install --legacy-peer-deps` si l'install est demandée sur ce PC ; le buildNumber s'auto-incrémente (config EAS) ; traitement Apple = quelques heures. Après ce binaire, les correctifs de recette partent en OTA : `eas update --channel testflight` (autorisé : 0 natif dans la RC).

---

## 4. Calendrier (mis à jour 03/08 soir — E2/E3 déjà faits, ~1 jour gagné)

> 🔑 = geste Kyllian. Objectif : **J+7 ouvrés**. La voie Home VNext court en parallèle SANS bloquer.

| Jour | Voie RC (chemin critique) | 🔑 Gestes |
|---|---|---|
| **J0** (fait) | E1 arbitrages ✅ · E2/E3 mergés ✅ · vérif flag V2 ✅ · pitch + registre à jour | — |
| **J1** (04/08) | E4 ✅ + E5 ✅ + recettes partielles ✅ (copilote/Kyllian) — **RC front complète `55aed5a`** · reste aujourd'hui : E6 (carte 1) + prépa copilote (bump) + E7 (carte 2) | 🔑 carte 1 puis carte 2 |
| **J3** | Attente Apple · préparation recette (checklists, comptes démo) · appels clubs avec le pitch | 🔑 appels clubs (Marvin) |
| **J4-J5** | E8 recette RC complète sur binaire (joueur + coach Temps 2 + points C dont flag ON) · correctifs → OTA | 🔑 pouces ; go OTA éventuel |
| **J5-J6** | E9-E10 séquence sécurité (observation → Admin → enforce → rotation) | 🔑 gestes Render |
| **J6-J7** | E11 nettoyage prod + invitations TestFlight + doc d'accueil club | 🔑 console + TestFlight |
| parallèle | Home VNext (copilote, V-A actée) : embarque dans le binaire SEULEMENT si GO recette comprise avant E7 ; sinon OTA pendant le pilote | 🔑 recette Home si prête |

**Chemin critique** : E7 (traitement Apple) et E8 (dispo pouces). E6 est déclenchable **aujourd'hui** sans attendre le front.

---

## 5. Hors RC — noté pour ne pas perdre

- **Home VNext** : en intégration côté copilote (V-A actée). S'il rate le binaire : OTA pilote (0 natif). Décisions restantes de son dossier : teinte `#B4530C`, seuils L4, accomplissements L5.
- **Catalogue V2 front (signal)** : voix/vidéos — binaire 1.2.0 dédié post-pilote, interdiction d'OTA armée à SON merge seulement.
- **Planning hebdo É1/É1.5** : post-pilote (rebase 45 commits + re-préservation 3 fixes).
- **Bug 3 latence 15 s** : décision après mesure E8.
- Divers dépôt : en-tête périmé RELEASE_BOUCLE.md ; lot A/B post-merge coach ; dossier fusionné 118 Ko à committer ; nettoyage worktrees.
- **À relayer à la session route-vers-7 (backend)** : reprendre le fix de build `5c62405` (tsconfig.build.json + .dockerignore) dans `feat/vague-85` — sinon leur prochain deploy re-cassera pareil ; et leurs 3 tests vague85-r1a reposent sur des fixtures non versionnées (mesureB) : à committer ou à sortir du dépôt de tests.
