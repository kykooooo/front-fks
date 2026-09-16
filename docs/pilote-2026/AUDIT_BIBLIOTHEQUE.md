# AUDIT DE PRÉCISION — Bibliothèque d'exercices FKS

**Date** : 11/08/2026 · **Périmètre** : ce que l'app sert réellement au joueur aujourd'hui (banque legacy, V2 non branchée) · **Étalon** : guide de tournage 63 exercices (artifact `98ac921e`) — 1 ligne de description, « Comment le faire » en 3 étapes, « Un bon geste », « À éviter ».

**Méthode** : aucun chiffre à l'impression. Les 5 fichiers moteur du front ont été transpilés et **exécutés tels quels** (les vraies fonctions `getExerciseVideoRef`, `EXERCISE_INSTRUCTIONS`, `getExerciseBenefit`), le guide étalon a été parsé en entier (63 fiches), et le catalogue V2 (`readiness3/src/catalog/`, lecture seule) a été chargé (376 fiches + 72 alias). Script de comptage reproductible : `scratchpad/count.js` de cette session.

---

## Verdict en 5 lignes

1. **Le joueur ne reçoit presque jamais le niveau du guide étalon.** L'app n'a, par construction, qu'une phrase + 3 rappels ; la rubrique « À éviter » **n'existe nulle part** (ni champ, ni écran) : 0 exercice sur 401.
2. **185 exercices visibles en bibliothèque n'ont aucune instruction** (46 %) — dont 3 du lot pilote vidéo (`str_air_squat`, `str_hip_thrust`, `speed_ankling`).
3. **Des informations fausses sont affichées** : durées inventées à partir de mètres (« Leg lowering 90/90 » → **90 min**), sprints à vitesse max décrits comme « Course modérée », 77 fiches montrent la **vidéo d'un autre exercice**.
4. **Le contenu correct existe déjà** : le catalogue V2 a 350 fiches publiées au format exact de l'étalon (étapes numérotées, bons gestes, erreurs à éviter, sécurité, matériel) et couvre **394 des 401 ids du front** (325 en direct + 69 par alias). L'étalon EST le catalogue V2 : le guide de tournage en est extrait mot pour mot.
5. Le chantier n'est donc **pas un chantier d'écriture** mais un chantier de **branchement** (+ 4 correctifs de bugs legacy immédiats).

---

## 1. COUVERTURE — les chiffres exacts

Ce que l'app peut servir aujourd'hui (flag V2 inexistant sur cette base — aucun `exerciseCatalogV2.ts`, aucun `assets/exercise-catalog-v2.json` : la bascule V2 vit sur une branche non mergée) :

| Mesure | Valeur | Sur 401 |
|---|---|---|
| Exercices servables (`EXERCISE_BANK`) | **401** | — dont ~230 écrits à la main, ~171 stubs auto-générés depuis les ids backend |
| Visibles en bibliothèque (filtre anti-ballon) | **393** | 8 masqués (`mb_*`, `swiss_ball`) |
| (a) Avec instructions pas-à-pas (`howTo`) | **212** | 53 % — et le « pas-à-pas » est **une seule phrase**, jamais des étapes numérotées |
| (a bis) Visibles SANS aucune instruction | **185** | 47 % des 393 visibles |
| (b) Avec points clés (`cues`) | **212** | même champ que howTo (3 rappels courts) |
| (b bis) Avec « erreurs à éviter » | **0** | le champ n'existe pas dans `ExerciseInstruction` (engine/exerciseInstructions.ts:1-5) ni dans l'écran (ExerciseDetailModal.tsx:138-166) |
| (c) Vidéo choisie (« vetted ») pour CET exercice | **105** | 26 % |
| (c bis) Vidéo « vetted » **d'un autre exercice** (substitution par variante) | **77** | 19 % — étiquetée « Alternative (X) pour Y » |
| (c ter) Simple lien recherche YouTube | **219** | 55 % |
| Vidéos FKS (tournées par nous) | **0** | côté front comme côté V2 (`media.video` = null sur 376/376) |
| Description générique de remplissage | **86** | ex. « Renforcement : exécution contrôlée… » |
| « Pourquoi » football (`exerciseBenefits`) | **401** | seul champ à 100 % (avec fallbacks par catégorie) |

**Côté V2 (readiness3, la source de vérité éditoriale)** : 376 fiches — **350 published**, 25 draft, 1 deprecated. Chaque fiche a : nom français, description 1 ligne, `setup.instructions`, `execution.steps` (3 étapes numérotées), `execution.cues`, `execution.commonMistakes`, matériel, sécurité (`excludeWhenReported`), dosage avec bornes. **394/401 ids du front sont couverts** (325 direct + 69 via `aliases.json`). Les 7 orphelins : `run_tempo_2x8`, `str_deadlift_heavy`, `mob_shoulder`, `circuit_low_bodyweight`, `circuit_mod_mix`, `circuit_hi`, `generic_breathing_nasal`.

**Où le joueur voit ça** : en séance (Preview/Live), il lit le texte généré par le backend pour la séance + un bouton « Fiche » qui ouvre la bibliothèque (`ExerciseDetailModal`). La fiche statique auditée ici est donc SON filet de sécurité quand il ne sait pas faire le geste — et c'est là que ça manque.

---

## 2. PROFONDEUR — 20 exercices, verbatim : ce que le joueur lit vs l'étalon

Rappel du format étalon (identique aux fiches V2) : *description 1 ligne + 3 étapes numérotées + 2-3 bons gestes + 2-3 pièges*.

### Les 12 du lot pilote

**1. `str_air_squat` — le joueur lit :** nom « Air squat », description « Squat poids du corps. Amplitude contrôlée, genoux alignés. » — **c'est tout** (aucune instruction). Vidéo proposée : « Alternative (Front squat) pour Air squat — Squat University - Front Squat » → une vidéo de squat **avec barre** pour un exo au poids du corps.
**La V2 dit :** « Descends en poussant les hanches en arrière et en pliant les genoux. / Amplitude contrôlée, talons au sol. / Remonte en poussant le sol, extension complète. » + à éviter « Genoux qui rentrent · Talons qui décollent ».

**2. `str_goblet_squat` — le joueur lit :** « Charge contre la poitrine, descends en ouvrant les hanches, remonte en poussant. » + « Coude entre les genoux · Tronc gaine · Amplitude controlee » (sans accents). Vidéo : recherche YouTube « Goblet squat exercise technique ».
**La V2 dit :** setup (« Kettlebell ou haltère tenu verticalement contre la poitrine, coudes sous la charge ») + 3 étapes + à éviter « Charge qui s'éloigne · Talons qui décollent ». Cohérent sur le fond, mais l'app n'a ni setup, ni étapes, ni pièges.

**3. `str_forward_lunge` — le joueur lit :** « **Avance un pied, descends puis reviens.** » (7 mots).
**La V2 dit :** « **Fais un GRAND pas en avant** / Descends en contrôle, genou arrière vers le sol / Repousse le sol pour revenir debout » — et son premier piège est précisément « **Pas trop court** ». La consigne du front (« avance un pied ») pousse vers l'erreur que la V2 interdit.

**4. `str_reverse_lunge` — le joueur lit :** « Recule un pied, descends puis reviens. » Même problème : V2 exige « Recule d'un **grand** pas », piège « Pas arrière trop court ».

**5. `str_hip_thrust` — le joueur lit :** description seule (« Extension hanches. Pause en haut, bassin neutre. »), **aucune instruction**, matériel affiché « **Poids du corps** ». Vidéo : « Alternative (Glute bridge) pour Hip thrust ».
**La V2 dit :** matériel **barre + banc**, setup « protège les hanches avec un pad si chargé », sécurité `hip_pain, back_pain`, piège « Hyper-étendre le bas du dos ». Le front contredit la V2 sur le matériel et n'affiche aucune des consignes de sécurité.

**6. `str_glute_bridge` — le joueur lit :** « Allonge, pieds au sol, monte le bassin puis redescends. » Vidéo correcte (Jeff Nippard) mais étiquetée « Hip Thrust ».
**La V2 dit :** nom français « Pont fessier au sol », piège « Pousser avec le bas du dos · Amplitude incomplète » — absent du front.

**7. `str_copenhagen` — le joueur lit :** « Gainage lateral avec jambe en appui sur banc. » + matériel affiché « **Poids du corps** » — contradiction **dans le même écran** (le howTo parle d'un banc, la puce Matériel dit poids du corps). Vidéo correcte (Physiotutors).
**La V2 dit :** matériel `bench, box_plyo`, sécurité `groin_pain, shoulder_pain`, pièges « Bassin qui s'affaisse · Rotation du buste ».

**8. `str_slider_leg_curl` — le joueur lit :** « Talons sur sliders, monte le bassin et tire les talons vers toi. » — l'un des moins mauvais. Manquent : l'alternative serviette/sol lisse (V2), le piège « Aller trop vite », la sécurité `hamstring_acute`. Vidéo : recherche YouTube.

**9. `run_strides` — le joueur lit :** « Accelerations progressives courtes, retour au calme. » Vidéo : « Alternative (Flying 10m)… Flying sprints ».
**L'étalon dit :** « du trot à ~85 % Vmax… sans sprint max », piège n° 1 « **Transformer le stride en sprint** ». L'app illustre les strides… par une vidéo de sprint lancé à vitesse max — exactement le piège que l'étalon interdit.

**10. `speed_ankling` — le joueur lit :** description « **Course modérée : rythme stable, respiration contrôlée, relâchement.** » (texte générique faux : l'ankling n'est pas une course), **aucune instruction**, vidéo « Alternative (Falling start 10m) » → un tuto de départ incliné pour un drill de cheville. Seul le « pourquoi » est juste (« Développe la rigidité de cheville… ») — et il contredit la description deux lignes plus haut.
**L'étalon dit :** « Petits pas rapides, cheville active, posture haute. Objectif : contact court. » + « Allonger les pas · Contact talon » à éviter.

**11. `sprint_falling_start_10m` — le joueur lit :** « Penche-toi puis accelere des que tu pars. » + « Inclinaison **controllee** » (faute) . Vidéo correcte (Falling start tutorial). L'étalon détaille « incline TOUT le corps sans plier la hanche… au point de déséquilibre… » + piège « Casser la hanche au lieu de tomber » — c'est le cœur technique du geste, absent du front.

**12. `sprint_acceleration` (id V2 ; côté front = `sprint_accel_10m` via alias) — le joueur lit :** « Sprint court en acceleration maximale. » — le même texte est partagé par les 4 fiches 5/10/15/20 m. Vidéo correcte (Acceleration drills). L'étalon donne les 3 étapes (départ gainé, poussées longues, buste qui monte progressivement) + « Se redresser trop tôt · Freiner brutalement ».

### Les 8 autres (variété)

**13. `cod_45_cut_tech`** : front correct dans l'esprit (« Sprint puis coupe a 45 deg en controle » + « Appui externe · Bassin bas · Regard haut ») mais 1 phrase vs 3 étapes, et pas de pièges (« Buste trop haut à la coupe · Pas trop longs avant de couper »). Vidéo correcte.
**14. `cod_l_drill`** : nom « **COD L Drill** » (franglais brut), description générique COD, **aucune instruction**, vidéo « Alternative (Coupe 45°) ». La V2 a la fiche complète avec le setup 3 plots.
**15. `plyo_pogo_hops`** : front honnête (« Petits rebonds rapides sur l avant du pied ») + vidéo ALTIS correcte — un des rares au niveau, hors « À éviter » manquant.
**16. `core_plank`** : « Corps droit, appui sur avant-bras, tiens la position. » — correct mais sans le piège V2 « Retenir sa respiration ».
**17. `core_copenhagen_side_plank`** : **aucune instruction**, vidéo « Alternative (Gainage planche) » → une vidéo de **planche classique** pour un exo d'adducteurs. La V2 l'aliase proprement vers `str_copenhagen` (fiche complète).
**18. `mob_hip_flexor_dynamic`** : le meilleur du lot (ajout récent, accentué, précis : « …Tu dois sentir l'ouverture à l'avant de la hanche arrière », « Ne creuse pas le dos »). Preuve que le format legacy PEUT être bon — c'est le stock ancien qui est pauvre.
**19. `str_nordic`** : « Genoux au sol, descends en controle vers lavant, remonte avec assistance. » + vidéo E3 Rehab correcte. Manque le piège « casser la hanche » et le tempo. (V2 : fiche `nordic_curl_partner` via alias.)
**20. `speed_high_knees`** : nom anglais « High knees », **aucune instruction**, vidéo famille A-skip (correcte mais pas dédiée). L'étalon a la fiche complète (« Montées de genoux (technique) », piège « Chercher l'essoufflement »).

**Bilan profondeur** : sur 20 exercices, **0 atteint le niveau de l'étalon** (à cause du « À éviter » structurellement absent) ; 6 n'ont aucune instruction ; 3 affichent une info fausse ou contradictoire ; 5 ont une vidéo qui montre un autre exercice.

---

## 3. COHÉRENCE front ↔ catalogue V2 — divergences ligne à ligne

Sur les 20 échantillonnés, aucun cas où le front dit l'INVERSE de la V2 sur le geste lui-même (les textes courts du front sont des sous-ensembles compatibles), **sauf** :

| Exercice | Le front affiche | La V2 dit | Nature |
|---|---|---|---|
| `speed_ankling` | « Course modérée : rythme stable, respiration contrôlée, relâchement » | « Petits pas rapides, cheville active… contact court » | **Contradiction franche** (description fausse) |
| `str_hip_thrust` | Matériel : « Poids du corps » | `barbell, bench` + pad conseillé | **Contradiction matériel** |
| `str_copenhagen` | Matériel : « Poids du corps » (mais howTo parle du banc) | `bench, box_plyo` | **Contradiction matériel**, incohérence interne au même écran |
| `str_forward_lunge` / `str_reverse_lunge` | « Avance/Recule un pied » | « GRAND pas » + piège « pas trop court » | Le front **induit** l'erreur que la V2 interdit |
| `run_strides` | Vidéo de sprint lancé (Flying) | Piège n° 1 : « Transformer le stride en sprint » | La vidéo **contredit** la consigne |
| `str_glute_bridge` | Nom « Glute bridge » | « Pont fessier au sol » | Nommage (l'app parle anglais, la V2 français) |
| Tous | Sécurité : rien | `excludeWhenReported` (douleur genou/ischio/aine…) par fiche | **Toute la couche sécurité V2 est invisible au joueur** (elle n'existe que dans le filtrage backend) |

À noter : les textes du guide étalon et de la V2 sont **identiques mot pour mot** sur les fiches vérifiées (`cod_45_cut_tech`, `speed_high_knees`, `speed_ankling`, `sprint_falling_start_10m`, `run_strides`) — l'étalon est bien un export du catalogue V2.

---

## 4. EXACTITUDE — erreurs prouvées (tout est cité, rien d'interprété)

### E1 — Durées inventées à partir de distances/secondes (affichées « X min » dans l'en-tête de fiche)
Cause : `inferDefaultDurationMin` (engine/exerciseBank.ts:169-192) déduit des minutes de tout id finissant en `_XX_YY` ; le garde-fou « ne rien déduire si l'id finit en m » (l. 184-185) est **mort** car la regex précédente (l. 177, `[a-z]?$`) capture déjà `_10_20m`. Fiches fausses affichées (`ExerciseDetailModal.tsx:89-92` via `formatDefaults`) :

- `core_leg_lowering_90_90` → « **90 min** » (90/90 = angles hanche/genou !)
- `spd_maxv_30_60` → « **45 min** » (30-60 mètres)
- `run_build_up_30_40m` → « 35 min » (30-40 m) · `spd_accel_10_20_30` → « 25 min » (10-20-30 m)
- `speed_sled_push_light_fast_10_20m` / `_heavy_10_20m` → « 15 min » (10-20 m) · `speed_sled_backward_drag_15_30m` → « 23 min »
- `cod_shuttle_10_20` → « 15 min » (10-20 m) · `treadmill_maxv_10_15s` → « 13 min » (10-15 **secondes**)
- `rsa_row_sprints_20_40` / `rsa_bike_sprints_15_45` → « 30 min » (formats travail/repos en secondes)

### E2 — Intensités et descriptions fausses par inférence de sous-chaîne
Cause : `inferIntensity` (engine/exerciseBank.ts:141-149) teste `k.includes("hi")` — « hi » matche `hip` et `machine` ; et « maxv » n'est pas dans la liste haute.

- `spd_maxv_30_60` et `treadmill_maxv_10_15s` (vitesse **maximale**) → intensité « Modéré » + description « **Course modérée : rythme stable, respiration contrôlée, relâchement.** » — faux, et le seul cas de l'audit où la fausse info touche un contenu à risque (le travail Vmax est le plus exigeant pour les ischios).
- `str_hip_thrust`, `str_hip_abductor_machine`, `str_hip_adductor_machine`, `str_leg_extension_machine` → « Intense » / « Renforcement intense : charge/effort élevé… » pour des exos de renfo standard/machine.
- Même famille : `spd_a_run` (drill technique) → « Course modérée : rythme stable… ».

### E3 — La vidéo montre un autre exercice (77 fiches)
Cause : fallback par variante dans `getExerciseVideoRef` (engine/exerciseVideos.ts:444-465). Le libellé dit « Alternative (X) pour Y » mais le bouton dit « Voir vidéo » et le badge « vidéo » de la liste compte ces 77 comme couvertes. Cas les plus trompeurs :

- `speed_ankling` → tuto **Falling start** · `str_air_squat` (poids du corps) → **Front squat barre** · `core_copenhagen_side_plank` (adducteurs) → **Planche classique** — comme 16 autres exos core (hanging knee raise, hollow rocks, reverse crunch… tous → la même vidéo de planche) · 14 exos COD (L-drill, pivot 180°, navettes, zigzag…) → tous la vidéo **Coupe 45°** · 8 drills vitesse (A-march, hill sprints, maxv, sled…) → tous **Falling start**.

### E4 — Fautes dans le texte affiché
- « Inclinaison **controllee** » (`fallingStart`, exerciseInstructions.ts:696) · « **Cou nu long** » (probablement « cou long », l. 325) · « Sequence jambe- bras » (l. 679).
- **160 des 212 instructions s'affichent sans aucun accent** (« controle », « gaine », « epaules », « jusqua »…) — texte visible tel quel dans la fiche.

### E5 — Doctrine « zéro ballon » trouée dans la bibliothèque
`isBallExercise` (videoLibraryConfig.ts:147-157) filtre `swiss_ball` mais pas `swissball` : **`core_stir_the_pot_swissball` est visible**, nom « Stir the pot swissball », instruction « Avant-bras sur **ballon**, fais de petits cercles. » ; `core_stir_pot` propose aussi « Version au sol ou swissball ». Contradiction avec la contrainte globale (CLAUDE.md « Zero ballon »).

### E6 — Noms auto-générés illisibles (franglais technique exposé au joueur)
« Rsa Row Sprints 20 40 », « Maxv 30 60 », « COD Shuttle 10 20 », « Flying20 », « Tapis Maxv 10 15s », « Sled Push Heavy 10 20m », « COD L Drill », « Core Deadbug Iso Hold »… (~40 fiches stub). La V2 a les noms français propres (« Montées de genoux (technique) », « Pont fessier au sol »).

---

## 5. CLASSEMENT P0 / P1 / P2

**P0 — le joueur reçoit une info fausse (ou à risque)**
1. Sprints vitesse max affichés « Modéré » + « Course modérée : rythme stable, respiration contrôlée » (`spd_maxv_30_60`, `treadmill_maxv_10_15s`) — E2.
2. Durées inventées depuis des mètres/secondes — 10 fiches dont « 90 min » (E1).
3. `speed_ankling` décrit comme une course modérée + vidéo d'un autre exercice (E2+E3).
4. Matériel contradictoire sur le même écran : `str_copenhagen` et `str_hip_thrust` affichés « Poids du corps » alors que le geste exige un banc (± barre) — un joueur qui tente un Copenhagen sans support ne peut pas faire l'exercice ; la V2 liste en plus des exclusions douleur jamais montrées.

**P1 — info absente ou si pauvre que l'exo est inutilisable sans vidéo**
5. **185 exercices visibles sans aucune instruction** (46 % de la bibliothèque), dont `str_air_squat` et `str_hip_thrust` du lot pilote.
6. **« À éviter » : 0/401** — la moitié du standard étalon n'a pas de place dans le produit (ni champ, ni UI).
7. **77 fiches « avec vidéo » montrent un autre exercice** (dont 17 core → planche, 14 COD → coupe 45°) ; le filtre « avec vidéo » les compte comme couvertes.
8. Instructions à 1 phrase qui induisent l'erreur interdite (`str_forward_lunge` / `str_reverse_lunge` : « avance un pied » vs « grand pas » ; `run_strides` illustré par du sprint max).
9. 86 descriptions génériques de remplissage + ~40 noms franglais auto-générés (« COD L Drill », « Maxv 30 60 »).

**P2 — poli**
10. 160/212 instructions sans accents ; 3 fautes citées (E4).
11. Trou `swissball` dans le filtre anti-ballon + textes qui proposent le ballon (E5).
12. Vidéos « famille » acceptables mais non dédiées (ex. high knees → compilation A-march/A-skip) ; libellé « Source : Alternative… » peu clair.
13. Code mort : `foundationExerciseBank.ts` / `exploExerciseBank.ts` (importés nulle part), dossier `engine/exercise Bank/` (brouillon 2025 avec espace dans le nom).

---

## 6. PLAN DE CORRECTION CHIFFRÉ

**Le point clé : il n'y a presque rien à écrire.** 394/401 ids ont déjà leur fiche V2 complète, publiée, au format étalon. Le travail est un branchement + 4 correctifs.

### Lot A — Correctifs legacy immédiats (indépendants de tout, ~1 jour dev + recette)
| # | Correctif | Où | Effort |
|---|---|---|---|
| A1 | Durées : ne jamais déduire de minutes d'un id métrique (réordonner le garde-fou, exclure `s`/`m`/patterns connus) | `engine/exerciseBank.ts:169-192` | 1 h + test |
| A2 | Intensité : matcher des mots entiers (`hi` → `hill`/`hiit` explicites ; ajouter `maxv` en haute) | `engine/exerciseBank.ts:141-149` | 1 h |
| A3 | Vidéos : ne plus servir une vidéo de variante quand elle vient d'un **autre geste** (a minima : bouton « Voir un exercice proche » au lieu de « Voir vidéo », et exclure ces 77 du filtre « avec vidéo ») | `engine/exerciseVideos.ts:444-465` + modal | 2-3 h |
| A4 | Filtre ballon : ajouter `swissball` ; retirer « swissball » des 2 textes | `videoLibraryConfig.ts:151-155`, `exerciseInstructions.ts` | 30 min |
| A5 | 3 typos citées (E4) | `exerciseInstructions.ts` | 15 min |

### Lot B — Le vrai chantier : servir le contenu V2 au joueur
Deux chemins possibles, à ton arbitrage :

- **B1 — Bascule catalogue V2 complète** (la branche front « étape 4 » existe, non mergée). C'est la cible, mais elle est accrochée au train release (contrainte connue : pas d'OTA avant le nouveau binaire à cause d'expo-audio). Effort restant = merge + recette, pas d'écriture.
- **B2 — Pont éditorial minimal, sans toucher au train release** : un script (dans le repo backend/catalogue) qui **génère** `exerciseInstructions.ts` (et les descriptions/noms) depuis les fiches V2 + alias : `description` ← V2, `howTo` ← `setup` + `execution.steps` (numérotées), `cues` ← `execution.cues`, **nouveau champ `avoid`** ← `commonMistakes`, matériel ← `equipment` (remplace l'inférence par id). Côté UI : ajouter la section « À éviter » dans `ExerciseDetailModal` (~30 lignes). Chiffrage : **~385 fiches enrichies d'un coup** ; 1 j script + 0,5 j UI + 0,5-1 j revue/recette téléphone = **2-3 jours**, livrable en OTA-compatible (pur TS/JS, pas de module natif).

### Lot C — Les manques de contenu réels (écriture)
- **7 fiches V2 à créer ou à aliaser** (`run_tempo_2x8`, `str_deadlift_heavy`, `mob_shoulder`, 3 `circuit_*`, `generic_breathing_nasal`) — 1-2 h chacune au format étalon.
- **Vidéos : 0 partout.** Le guide de tournage couvre 63 clips prioritaires (7 séances) ; c'est le seul chemin vers des vidéos FKS. En attendant, corriger A3 pour que YouTube ne mente pas.

### Ordre recommandé
1. **Lot A** tout de suite (c'est du bug, pas du contenu — et A1/A2 corrigent les infos fausses P0).
2. **Décision B1 vs B2** : si le binaire RC part vite, B1 ; sinon B2 donne 385 fiches au niveau étalon en 2-3 jours sans dépendre du binaire.
3. Lot C au fil de l'eau (7 fiches), tournage selon le guide.

---

## Annexe — reproduire les comptages
Script : `count.js` (scratchpad de la session d'audit) — transpile `engine/{backendExerciseIds,exerciseBank,exerciseInstructions,exerciseVideos,exerciseBenefits}.ts` avec le TypeScript du repo et exécute les vraies fonctions. Listes complètes disponibles dans la sortie du script : 185 ids sans instruction, 77 substitutions vidéo, 10 durées fausses, 160 ids sans accents.

*Audit en lecture seule : aucun fichier du front ni du catalogue V2 modifié ; ce rapport est le seul fichier créé, non commité.*
