# RAPPORT DE CHANTIER — Correction de la bibliothèque d'exercices

**Date** : 11/08/2026, complété le 12/08 (v2 : purge structurelle `rsa_ssg_*` après décision) · **Branche** : `fix/bibliotheque-precision` (poussée en sauvegarde, **RIEN mergé**) · **Base** : `6574882` (v1.1.0 RC pilote) · **Fondation** : AUDIT_BIBLIOTHEQUE.md (exécution des lots A et B2 du plan).

**~~8~~ 9 commits atomiques** : A1 durées → A2 intensités → A3 vidéos → A4 ballon → A5 typos → B2-1 générateur+données+branchement → B2-2 UI fiche → B2-3 garde-fous → **purge `rsa_ssg_*` (`b0a28c0`, v2)**.
**Suites du repo : 148 suites / 3 475 tests verts** (lancées depuis le worktree avec `npx jest --testPathIgnorePatterns="/node_modules/" --modulePathIgnorePatterns="/functions/"` — comptage vérifié > 0, piège worktree contourné). Zéro appel API payant, zéro paquet installé, catalogue V2 (readiness3) strictement en lecture seule.

---

## 1. Les compteurs AVANT → APRÈS (mesurés en exécutant les deux versions du code)

Script : `mesure_avant_apres.js` (scratchpad de session) — transpile et exécute le code du commit de base ET le code corrigé, mêmes prédicats des deux côtés.

| Compteur (sur la bibliothèque visible) | AVANT | APRÈS |
|---|---|---|
| Exercices **sans aucune instruction** | **185** | **12** |
| Fiches avec rubrique **« À éviter »** | **0** | **372** |
| **Durées fausses** affichées (ids métriques : mètres/secondes/angles) | **13** | **0** |
| Fiches « avec vidéo » qui montrent en réalité **un autre exercice** | **77** (présentées comme « Voir vidéo » + badge) | **0** mensongères (77 reclassées `variant` : bouton « Voir un exercice proche », **hors** badge et filtre « avec vidéo ») |
| Noms-artefacts auto-générés (« Rsa Runs 20 20 2x8 », « Maxv 30 60 »…) | **90** | **31** |
| Descriptions génériques de remplissage | **84** | **13** |
| Exercices visibles | 393 | 392 (« Stir the pot swissball » enfin masqué) |

**Mise à jour v2 (12/08, après la purge `rsa_ssg_*`)** : banque totale 401 → **394**, visibles 392 → **385**, sans instruction 12 → **5** (`circuit_mix`, `rsa_circuit_kb_swings_shuttle`, `rsa_sled_push_15m_repeat`, `core_stir_pot`, `generic_breathing_nasal`), recherches vidéo 219 → 212 (7 fantômes en moins). Suite complète re-vérifiée : 148 suites / 3 476 tests verts.

Précisions d'honnêteté :
- L'audit annonçait « ~40 » noms franglais (échantillon à l'œil) et « 10 » durées fausses ; la mesure au prédicat strict donne **90** noms-artefacts et **13** durées fausses (les 11 cités par l'audit + 2 formats d'intervalles `12x60_60` / `10x40_20` découverts en corrigeant). L'audit sous-comptait — corrigé ici, rien à retirer sur le fond.
- L'audit comptait 86 descriptions génériques **sur 401** ; le tableau ci-dessus compte sur les visibles (84). Mêmes données, dénominateur différent.
- Vidéos : la répartition 105 dédiées / 77 empruntées / 219 recherches ne change pas (aucune vidéo n'a été ajoutée — il n'en existe pas encore côté FKS) ; ce qui change est que l'app **ne ment plus** sur les 77.

## 2. Les P0 de l'audit : avant → après (cités)

1. **Durées inventées** (audit §E1). Avant : « Leg lowering 90/90 » affichait « **90 min** » (ce sont les angles hanche/genou), « Maxv 30 60 » affichait « 45 min » (30-60 m). Après : plus aucune durée sur les 13 ids métriques (`inferDefaultDurationMin` ne déduit des minutes que du cardio continu z2/tempo/easy/jog/walk/fartlek/recovery, gardes mètres/secondes/formats en tête). Testé id par id + cas légitimes conservés (`run_engine_z2_30_40` → 35 min ✓).
2. **Sprints vitesse max en « Modéré »** (audit §E2). Avant : `spd_maxv_30_60` = « Modéré » + « Course modérée : rythme stable, respiration contrôlée, relâchement. » Après : intensité **Élevé** + fiche V2 « Sprints max sur 30-60 m, récupérer pleinement, garde les épaules détendues. » Cause corrigée : `inferIntensity` matche des segments d'id entiers (« hi » ne matche plus « hip »/« machine », « hold » ne matche plus « threshold »), `maxv`/`vma` en haute intensité.
3. **Ankling décrit comme une course modérée** (audit §2-10). Avant : description générique fausse + vidéo falling start présentée comme sa vidéo. Après : fiche V2 « Petits pas rapides, cheville active… » + 3 étapes + « À éviter : Allonger les pas · Contact talon », et le bouton dit « **Voir un exercice proche** ».
4. **Matériel contradictoire** (audit §3). Avant : Copenhagen et Hip thrust affichaient « Poids du corps ». Après : matériel EXACT du catalogue V2 — Copenhagen : « Banc / Box » ; Hip thrust : « Barre + Banc » (15 nouvelles clés matériel affichables, puces de filtre inchangées).

## 3. Ce qui a été livré

### Lot A — les bugs legacy (commits 1-5)
- **A1** `engine/exerciseBank.ts` : réécriture de `inferDefaultDurationMin` (garde `m$`/`s$`/`NxYY` AVANT toute capture — l'ancien garde était du code mort) + 20 tests.
- **A2** `engine/exerciseBank.ts` : `idHasSegment` (mots entiers, chiffre collé au mot accepté : `flying20`) ; bonus corrigés en passant : seuil (`threshold`) n'est plus étiqueté « Faible », VMA longue passe « Élevé » ; noms/descriptions de filet pour maxv/a_run + 18 tests.
- **A3** `engine/exerciseVideos.ts` + modal : nouveau kind `variant` — par construction, tout emprunt à une variante sort du « vetted » (aucune liste de 77 à maintenir) ; libellé honnête sur la fiche + 9 tests (dont répartition 105/77/219 verrouillée).
- **A4** filtre `swissball` bouché + 3 textes ballon nettoyés (stir the pot au sol, coussin/serviette pour l'adductor squeeze) + test-filet qui scanne TOUTE la banque visible.
- **A5** : les 3 typos citées (« controllee », « Cou nu long », « Sequence jambe- bras »).

### Lot B2 — le pont éditorial V2 → joueur (commits 6-8)
- **Générateur committé** : `scripts/generateExerciseContent.js` (node pur, zéro dépendance). Lit les fiches + alias du catalogue V2 (chemin par défaut readiness3, surchargable `--catalog` / `FKS_CATALOG_DIR`), écrit `engine/generated/exerciseContentV2.ts`. **Déterministe et idempotent** (prouvé : 2 relances → zéro diff ; mode `--check` pour la CI). En-tête : « GÉNÉRÉ — ne pas éditer » + hash du contenu source (`c8fe99617a68`) + date la plus récente présente dans les données.
- **375 fiches générées** : nom français V2 (sauf collisions), description, mise en place, étapes numérotées, bons gestes, **À éviter**, matériel exact, sécurité V2 (`safetyExclude` **générée mais PAS affichée** — décision produit en attente, branchement futur trivial).
- **Garde-fous du générateur**, tous listés dans sa sortie :
  - 36 groupes de **collisions d'alias** → le nom front est conservé (« Accélération 10m » ≠ « Accélération 20m », pas de doublons de noms) ;
  - **doctrine zéro ballon** : 16 fiches exclues (7 jeux réduits `rsa_ssg_*`, medball, swiss ball), négation « sans ballon » tolérée, 1 nettoyage déclaré (« haltère léger ou medball » → « haltère léger ») ;
  - 3 fiches V2 encore marquées `_A_VALIDER` exclues (repli legacy) ;
  - **notes éditoriales internes jamais montrées** : 18 puces de curation retirées (« Côté gauche/droit = paramètre (une seule fiche) »), 6 descriptions jargon non émises (« Canonique paramétrable… presets legacy »), annotations « legacy » nettoyées EN GARDANT les chiffres (« Volume : 10 répétitions ») ;
  - 2 mots désaccentués trouvés DANS une fiche V2 source (`rsa_reaction_sprint_10m` : « recuperation », « reaction ») → réparés mécaniquement (table `ACCENT_REPAIRS` déclarée) — **à corriger à la source côté chantier catalogue**.
- **Branchement** : overlay nom/description dans `EXERCISE_BANK` ; `engine/exerciseContent.ts` = point d'entrée unique (V2 d'abord, repli legacy) ; `inferEquipment` préfère le matériel V2 ; recherche bibliothèque indexée sur le nouveau contenu (étapes + à éviter cherchables).
- **UI fiche** (`ExerciseDetailModal`) : « Comment faire » = mise en place + étapes **numérotées** ; « Un bon geste » ; « **À éviter** » en rouge du thème (sobre) ; repli legacy inchangé (une étape, pas de section À éviter). Pas de `height` fixe, `numberOfLines` sur la ligne de source vidéo.
- **21 tests garde-fous données** : volumétrie exacte (375), zéro mot désaccentué (liste fermée de 32 mots), zéro ballon, zéro jargon interne, lot pilote 12/12 complet, liste d'orphelins verrouillée, repli legacy intact.

## 4. Le lot pilote : avant → après (relu fiche par fiche)

| Exercice | Le joueur lisait (audit, verbatim) | Le joueur lit maintenant |
|---|---|---|
| str_air_squat | description seule, **aucune instruction**, vidéo Front squat barre | « Squat poids du corps » : setup + 3 étapes numérotées + « À éviter : Genoux qui rentrent · Talons qui décollent » ; vidéo étiquetée « exercice proche » |
| str_goblet_squat | « Charge contre la poitrine, descends en ouvrant les hanches, remonte en poussant. » | Setup (kettlebell/haltère contre la poitrine, coudes dessous) + 3 étapes + « Charge qui s'éloigne · Talons qui décollent » |
| str_forward_lunge | « **Avance un pied**, descends puis reviens. » (induisait le pas trop court) | « Fais un **GRAND** pas en avant… » + « À éviter : **Pas trop court** · Genou avant qui rentre » |
| str_reverse_lunge | « Recule un pied, descends puis reviens. » | « Recule d'un **grand** pas… » + « Pas arrière trop court · Buste qui plonge » |
| str_hip_thrust | **aucune instruction**, matériel « Poids du corps » | Fiche V2 complète (pad conseillé, menton rentré) + matériel **Barre + Banc** + « Hyper-étendre le bas du dos · Pousser sur les pointes » |
| str_glute_bridge | « Allonge, pieds au sol, monte le bassin puis redescends. » | « Pont fessier au sol » : 3 étapes + « Pousser avec le bas du dos · Amplitude incomplète » |
| str_copenhagen | 1 phrase, matériel « Poids du corps » (contradiction même écran) | Setup banc + 3 étapes + matériel **Banc/Box** + « Bassin qui s'affaisse · Rotation du buste » |
| str_slider_leg_curl | 1 phrase correcte | Setup (sliders **ou serviette**, sol lisse) + 3 étapes + « Bassin qui tombe · Aller trop vite » |
| run_strides | 1 phrase ; vidéo = sprint lancé (le piège n°1 de l'étalon !) | Fiche V2 (« du trot à ~85 % Vmax… ») + « Transformer le stride en sprint · Enchaîner sans récupérer » ; vidéo = « exercice proche » |
| speed_ankling | « **Course modérée**… » (faux) + vidéo falling start « vetted » | Fiche V2 ankling complète + « Allonger les pas · Contact talon » + bouton « Voir un exercice proche » |
| sprint_falling_start_10m | « Penche-toi puis accelere des que tu pars. » | 3 étapes V2 (« incline TOUT le corps sans plier la hanche… ») + « Casser la hanche au lieu de tomber… » ; vidéo dédiée conservée |
| sprint_accel_10m | « Sprint court en acceleration maximale. » (partagé ×4) | Fiche V2 « Accélération » (3 étapes, récup complète) + « Se redresser trop tôt · Freiner brutalement » ; nom « Accélération 10m » conservé (collision gérée) |

`mob_hip_flexor_dynamic` (la meilleure fiche legacy) : contenu V2 équivalent-ou-mieux (3 étapes + 2 à éviter), et la note interne « une seule fiche » est filtrée — non-régression testée.

## 5. Ce qui reste (lot C et décisions)

1. ~~**12 exercices visibles encore sans instruction** : les 7 jeux réduits `rsa_ssg_*` (fiches V2 = ballon par nature — **décision à prendre** : les masquer de la bibliothèque comme les medball, ou assumer des fiches « jeu avec ballon » ?)~~ **[TRANCHÉ 11/08 et LIVRÉ 12/08 (`b0a28c0`) : décision Kyllian = ON MASQUE, double motif (ballon par nature + non faisables seul). Répartition actée entre branches : `fix/non-solo-front` porte le masquage minimal d'affichage (`engine/nonSoloExercises.ts`), CETTE branche porte la purge structurelle — les 7 ids sortent de `BACKEND_EXERCISE_IDS`, plus aucun stub fabriqué, verrou de test posé. Le merge des deux ne fait pas le travail deux fois.]** Restent sans instruction (5) : `circuit_mix` + `rsa_circuit_kb_swings_shuttle` + `rsa_sled_push_15m_repeat` (fiches V2 encore marquées `_A_VALIDER` côté catalogue), `core_stir_pot` (sa fiche V2 est la version swissball, exclue), `generic_breathing_nasal` (orphelin, 1 fiche à écrire).
2. **31 noms encore auto-générés** (« Rsa Runs 20 20 2x10 », « Plyo Countermovement Jump »…) : presque tous membres de collisions d'alias ou d'exclusions — à régler par des noms front écrits à la main (1 ligne chacun) ou des fiches V2 dédiées.
3. **6 orphelins V2 avec repli legacy** (`run_tempo_2x8`, `str_deadlift_heavy`, `mob_shoulder`, `circuit_low/mod/hi`) : fiches V2 à créer côté catalogue.
4. **Vidéos : toujours 0 vidéo FKS** — le plan de tournage 63 clips reste le chemin ; l'app ne ment plus en attendant.
5. **À remonter au chantier catalogue V2** (source, readiness3) : les mots désaccentués de `rsa_reaction_sprint_10m` ; la note interne « Côté gauche/droit = paramètre (une seule fiche) » présente dans ~18 fiches ; les 3 fiches `_A_VALIDER` ; le jargon « legacy » dans les textes joueur.
6. **`safetyExclude` généré mais non affiché** — quand tu veux montrer « À éviter si douleur genou/ischio » sur la fiche, c'est ~15 lignes d'UI.
7. Constat de recette : 3 suites (dont CoachPlayerScreen) ont échoué UNE fois sous charge parallèle puis passé en isolation ET sur les 2 runs complets suivants — flakiness préexistante au chantier, pas touchée.

## 6. CHECKLIST TÉLÉPHONE (10 gestes, ~5 minutes)

Depuis l'app (Metro/OTA sur la branche `fix/bibliotheque-precision`) :

1. **Séance → Preview d'une séance → « Fiche » sur un exo de force** : la fiche s'ouvre, « Comment faire » = **étapes numérotées 1. 2. 3.** (plus une phrase unique).
2. Sur la même fiche : section « **À éviter** » en rouge, sous « Un bon geste ».
3. Dans la bibliothèque, cherche **ankling** : la description dit « Petits pas rapides, cheville active… » (plus jamais « Course modérée »).
4. Ouvre la fiche ankling : le bouton vidéo dit « **Voir un exercice proche** » et la phrase explique qu'il n'y a pas encore de vidéo dédiée.
5. Cherche **descente de jambes** (leg lowering 90/90) : l'en-tête n'affiche **plus « 90 min »**.
6. Cherche **hip thrust** : Matériel = **Barre + Banc** (plus « Sans matériel »).
7. Cherche **copenhagen** : Matériel = **Banc** ; « À éviter : Bassin qui s'affaisse ».
8. Cherche **stir** : « Stir the pot swissball » n'apparaît **plus** dans la liste.
9. Cherche **vitesse max** : badge intensité « **Élevé** » (plus « Modéré »).
10. Cherche **falling start** : bouton « **Voir vidéo** » + « Source : Falling start tutorial » (les vraies vidéos n'ont pas bougé).

**Ajout v2** — cherche **rsa** : plus aucun « Rsa Ssg 2v2/3v3/…/6v6 » dans la liste (purgés) ; cherche **nordic** : la fiche dit désormais « un PARTENAIRE maintient fermement les chevilles » + matériel « Partenaire » (le badge « À deux » sur les cartes, lui, vit sur la branche `fix/non-solo-front`).

## 7. Reproduire les preuves

```bash
node scripts/generateExerciseContent.js --check
```

```bash
npx jest --testPathIgnorePatterns="/node_modules/" --modulePathIgnorePatterns="/functions/" --testPathPattern="(exerciseBank|exerciseVideos|exerciseContentV2|ballFilter|ExerciseDetailModal)"
```

*Rapport non commité. Branche poussée en sauvegarde : `fix/bibliotheque-precision`. Merge = décision Kyllian.*
