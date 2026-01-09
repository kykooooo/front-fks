# Phase Construction — Banque d’exercices (FR)

Format de chaque entrée (clé: valeur) pour un **retrieval** optimal via File Search. Les champs **lieu** et **douleurs** sont standardisés pour un filtrage rapide.

* **modality** ∈ `run | circuit | strength | plyo | core | mobility`
* **intensity** ∈ `easy | moderate | hard | max` (Construction utilise surtout `easy`/`moderate`)
* **lieu** ∈ `maison | salle | extérieur | les deux`
* **douleurs** ∈ `aucune | genou | dos | épaule | genou, dos | etc.`
* **hint**: brève consigne technique/sécurité

---

## Strength — Basique (maison / salle)

### id: squat-poids-du-corps

* name: Squat au poids du corps
* modality: strength
* intensity: easy
* lieu: les deux
* douleurs: genou
* hint: amplitude confortable, talons au sol.

### id: squat-gobelet

* name: Squat gobelet (haltère/kettlebell)
* modality: strength
* intensity: moderate
* lieu: les deux
* douleurs: genou
* hint: charge légère à modérée, focus posture.

### id: fente-avant-statique

* name: Fente avant statique
* modality: strength
* intensity: easy
* lieu: les deux
* douleurs: genou
* hint: petite amplitude si douleur.

### id: fente-arriere

* name: Fente arrière
* modality: strength
* intensity: moderate
* lieu: les deux
* douleurs: genou
* hint: trajectoire verticale du bassin.

### id: split-squat-bulgarian

* name: Split squat pied arrière surélevé (Bulgarian)
* modality: strength
* intensity: moderate
* lieu: les deux
* douleurs: genou
* hint: amplitude contrôlée.

### id: pont-de-hanches-sol

* name: Pont de hanches au sol (glute bridge)
* modality: strength
* intensity: easy
* lieu: les deux
* douleurs: dos
* hint: rétroversion légère du bassin.

### id: hip-thrust-banc

* name: Hip thrust sur banc
* modality: strength
* intensity: moderate
* lieu: salle
* douleurs: aucune
* hint: tempo contrôlé, fessiers dominants.

### id: sdt-roumain-halteres-leger

* name: Soulevé de terre roumain léger (haltères)
* modality: strength
* intensity: moderate
* lieu: les deux
* douleurs: dos
* hint: dos neutre, amplitude partielle si besoin.

### id: step-up-box-bas

* name: Step-up sur box/banc bas
* modality: strength
* intensity: easy
* lieu: les deux
* douleurs: genou
* hint: poussée talon, contrôle excentrique.

### id: rowing-penche-halteres

* name: Rowing penché (haltères)
* modality: strength
* intensity: moderate
* lieu: les deux
* douleurs: dos
* hint: tronc gainé, tirage vers hanches.

### id: tirage-elastique

* name: Tirage élastique (row assis/haut)
* modality: strength
* intensity: easy
* lieu: maison
* douleurs: aucune
* hint: alternative douce pour le dos.

### id: pompes-surelevees

* name: Pompes surélevées (mains sur support)
* modality: strength
* intensity: easy
* lieu: les deux
* douleurs: épaule
* hint: angle confortable, scapulas mobiles.

### id: pompes-classiques

* name: Pompes classiques
* modality: strength
* intensity: moderate
* lieu: les deux
* douleurs: épaule
* hint: amplitude partielle si sensible.

### id: developpe-epaules-halteres-assis

* name: Développé épaules haltères assis (léger)
* modality: strength
* intensity: moderate
* lieu: salle
* douleurs: épaule
* hint: prise neutre, éviter blocage douloureux.

### id: elevations-laterales-legeres

* name: Élévations latérales légères
* modality: strength
* intensity: easy
* lieu: salle
* douleurs: épaule
* hint: amplitude médiane si conflit.

### id: face-pull-elastique

* name: Rowing debout à l’élastique (face pull)
* modality: strength
* intensity: easy
* lieu: maison
* douleurs: aucune
* hint: arrière d’épaule, scapulas.

---

## Strength — Gym (machines/guidés)

### id: presse-cuisses-partielle

* name: Presse à cuisses amplitude partielle
* modality: strength
* intensity: easy
* lieu: salle
* douleurs: genou
* hint: charge légère, repères stables.

### id: sdt-trapbar-leger

* name: Soulevé de terre trap bar léger
* modality: strength
* intensity: moderate
* lieu: salle
* douleurs: dos, genou
* hint: départ rehaussé si besoin.

### id: tirage-vertical-neutre

* name: Tirage vertical poulie (prise neutre)
* modality: strength
* intensity: easy
* lieu: salle
* douleurs: épaule
* hint: trajectoire verticale contrôlée.

### id: tirage-horizontal-poulie

* name: Tirage horizontal poulie (row assis)
* modality: strength
* intensity: easy
* lieu: salle
* douleurs: dos
* hint: cage ouverte, tirage bas.

### id: presse-epaules-machine

* name: Presse épaules guidée (machine) légère
* modality: strength
* intensity: easy
* lieu: salle
* douleurs: épaule
* hint: amplitude de confort.

### id: landmine-press-unilateral

* name: Landmine press unilatéral
* modality: strength
* intensity: moderate
* lieu: salle
* douleurs: épaule
* hint: plan scapulaire, trajectoire naturelle.

### id: hip-thrust-machine

* name: Hip thrust guidé (machine) léger
* modality: strength
* intensity: easy
* lieu: salle
* douleurs: aucune
* hint: verrouillage doux, contrôle.

### id: pullover-cable

* name: Pullover câble léger
* modality: strength
* intensity: easy
* lieu: salle
* douleurs: épaule
* hint: accent dorsaux/mobilité.

---

## Run — Endurance de base

### id: footing-facile-z2-exterieur

* name: Footing facile (Z2) — extérieur
* modality: run
* intensity: easy
* lieu: extérieur
* douleurs: genou
* hint: surface souple privilégiée.

### id: tapis-trot-leger

* name: Tapis de course — trot léger
* modality: run
* intensity: easy
* lieu: salle
* douleurs: genou
* hint: pente faible, cadence fluide.

### id: fartlek-leger

* name: Fartlek léger (alternances doux/modéré)
* modality: run
* intensity: moderate
* lieu: extérieur
* douleurs: genou
* hint: progressif, éviter sprints.

### id: marche-rapide-cote

* name: Marche rapide en côte
* modality: run
* intensity: easy
* lieu: extérieur
* douleurs: genou
* hint: pas courts, buste haut.

---

## Circuit — Aérobie / machines (non-run)

### id: velo-appartement-fluide

* name: Vélo d’appartement cadence fluide
* modality: circuit
* intensity: easy
* lieu: maison
* douleurs: genou
* hint: résistance basse.

### id: elliptique-continu

* name: Vélo elliptique continu
* modality: circuit
* intensity: easy
* lieu: salle
* douleurs: genou
* hint: cadence régulière.

### id: rameur-confort

* name: Rameur cadence confortable
* modality: circuit
* intensity: moderate
* lieu: salle
* douleurs: dos, épaule
* hint: dos neutre, tirage fluide.

### id: stepmill-tranquille

* name: Montée de marches (StepMill) tranquille
* modality: circuit
* intensity: moderate
* lieu: salle
* douleurs: genou
* hint: poser talon, rythme constant.

### id: skierg-constant

* name: SkiErg rythme constant
* modality: circuit
* intensity: moderate
* lieu: salle
* douleurs: épaule
* hint: tirage dans l’axe.

### id: circuit-aerobie-basique

* name: Circuit aérobie basique (bas du corps + gainage)
* modality: circuit
* intensity: moderate
* lieu: maison
* douleurs: aucune
* hint: enchaînement continu d’exos simples.

---

## Plyo — Impact faible/modéré

### id: pogo-doux

* name: Pogo sautés doux (chevilles élastiques)
* modality: plyo
* intensity: easy
* lieu: les deux
* douleurs: genou
* hint: faible amplitude, atterrissage silencieux.

### id: sauts-faible-amplitude

* name: Sauts sur place à faible amplitude
* modality: plyo
* intensity: easy
* lieu: les deux
* douleurs: genou
* hint: temps de contact court.

### id: bonds-lateraux-controles

* name: Bonds latéraux contrôlés (petite amplitude)
* modality: plyo
* intensity: moderate
* lieu: les deux
* douleurs: genou
* hint: stabilité genou/cheville.

### id: skipping-technique

* name: Skipping A/B technique
* modality: plyo
* intensity: easy
* lieu: extérieur
* douleurs: aucune
* hint: posture et cadence.

### id: montees-de-genoux-rythmees

* name: Montées de genoux rythmées
* modality: plyo
* intensity: easy
* lieu: extérieur
* douleurs: genou
* hint: impact maîtrisé.

### id: foulees-bondissantes-legeres

* name: Foulées bondissantes légères
* modality: plyo
* intensity: moderate
* lieu: extérieur
* douleurs: genou
* hint: amplitude modérée.

### id: box-jump-bas

* name: Box jump bas (atterrissage silencieux)
* modality: plyo
* intensity: moderate
* lieu: salle
* douleurs: genou
* hint: hauteur faible, réception contrôlée.

### id: drop-squat-faible-hauteur

* name: Drop squat de faible hauteur
* modality: plyo
* intensity: moderate
* lieu: salle
* douleurs: genou
* hint: focus technique.

---

## Core — Gainage & stabilité

### id: planche-bras-tendus

* name: Planche ventrale (bras tendus)
* modality: core
* intensity: easy
* lieu: les deux
* douleurs: dos
* hint: gainage neutre, respiration calme.

### id: planche-laterale-progression

* name: Planche latérale genoux puis pieds
* modality: core
* intensity: easy
* lieu: les deux
* douleurs: épaule
* hint: progression selon confort.

### id: dead-bug

* name: Dead bug (contrôle lombaire)
* modality: core
* intensity: easy
* lieu: les deux
* douleurs: dos
* hint: contrôle bassin.

### id: bird-dog-lent

* name: Bird dog lent
* modality: core
* intensity: easy
* lieu: les deux
* douleurs: dos
* hint: stabilité anti-rotation.

### id: hollow-hold-partiel

* name: Hollow hold (amplitude partielle)
* modality: core
* intensity: moderate
* lieu: les deux
* douleurs: dos
* hint: amplitude réduite si besoin.

### id: glute-bridge-march

* name: Glute bridge march (alterné)
* modality: core
* intensity: moderate
* lieu: les deux
* douleurs: aucune
* hint: stabilité bassin.

### id: planche-anti-rotation-bras-leve

* name: Planche avec élévation d’un bras (anti-rotation)
* modality: core
* intensity: moderate
* lieu: les deux
* douleurs: épaule
* hint: amplitude petite.

### id: crunch-inverse-controle

* name: Crunch inversé contrôlé
* modality: core
* intensity: easy
* lieu: les deux
* douleurs: dos
* hint: contrôle excentrique.

### id: pallof-press

* name: Pallof press à l’élastique/câble
* modality: core
* intensity: easy
* lieu: les deux
* douleurs: aucune
* hint: anti-rotation douce.

### id: farmer-carry-leger

* name: Farmer carry léger (haltères/kettlebells)
* modality: core
* intensity: moderate
* lieu: salle
* douleurs: épaule, dos
* hint: colonnes neutres, distance courte.

### id: cable-chop-leger

* name: Cable chop (bois) léger
* modality: core
* intensity: moderate
* lieu: salle
* douleurs: dos
* hint: rotation contrôlée.

### id: gainage-swiss-ball

* name: Gainage sur Swiss ball (stabilité)
* modality: core
* intensity: moderate
* lieu: salle
* douleurs: épaule
* hint: faible amplitude.

---

## Mobility — Contrôle actif & étirements

### id: cars-hanches

* name: CARS hanches (contrôles articulaires)
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: aucune
* hint: amplitude douce contrôlée.

### id: 90-90-hanches

* name: 90/90 hanches (rotation interne/externe)
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: genou
* hint: support coussin si besoin.

### id: etirement-psoas-fente-basse

* name: Étirement psoas fente basse
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: genou, dos
* hint: bassin neutre.

### id: ischios-bande-serviette

* name: Étirement ischios chaîne postérieure (bande/serviette)
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: dos
* hint: genou légèrement fléchi.

### id: mobilite-cheville-genou-mur

* name: Mobilité cheville — genou au mur
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: genou
* hint: progression douce.

### id: ouverture-thoracique-rotation-t

* name: Ouverture thoracique (rotation colonne T)
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: dos
* hint: respiration latérale.

### id: cat-cow

* name: Chat-vache (cat-cow)
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: dos
* hint: fluidifier la colonne.

### id: frog-stretch

* name: Adducteurs “frog stretch”
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: genou
* hint: coussin sous genoux si sensible.

### id: etirement-mollets

* name: Étirement mollets (mur/pente)
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: aucune
* hint: tenue tranquille.

### id: auto-massage-fessiers-balle

* name: Auto-massage fessiers/IT band (balle)
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: genou
* hint: pression modérée.

### id: cars-epaules-baton

* name: CARS épaules (bâton/anneau)
* modality: mobility
* intensity: easy
* lieu: salle
* douleurs: épaule
* hint: contrôle sans douleur.

### id: glide-scapulaire-mur

* name: Glide scapulaire au mur
* modality: mobility
* intensity: easy
* lieu: salle
* douleurs: épaule
* hint: rythme lent.

### id: etirement-pectoraux-porte

* name: Étirement pectoraux au cadre de porte
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: épaule
* hint: angle de bras confortable.

### id: good-morning-baton-court

* name: Good morning bâton (amplitude courte)
* modality: mobility
* intensity: easy
* lieu: salle
* douleurs: dos
* hint: charnière hanche douce.

### id: respiration-90-90-supine

* name: Respiration 90/90 supine
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: aucune
* hint: "ribs down", déverrouillage diaphragme.

---

## Variants supplémentaires (Construction‑friendly)

### id: squat-box-bas

* name: Squat boîte (box squat) bas
* modality: strength
* intensity: easy
* lieu: les deux
* douleurs: genou, dos
* hint: repère de profondeur, contrôle.

### id: fente-laterale-courte

* name: Fente latérale courte amplitude
* modality: strength
* intensity: easy
* lieu: les deux
* douleurs: genou
* hint: pas court, hanche en arrière.

### id: pont-fessier-pieds-sureleves

* name: Pont fessier pieds surélevés
* modality: strength
* intensity: moderate
* lieu: les deux
* douleurs: aucune
* hint: tempo 2-1-1 recommandé.

### id: pompes-murales

* name: Pompes murales
* modality: strength
* intensity: easy
* lieu: les deux
* douleurs: épaule
* hint: angle ouvert sécurisé.

### id: rowing-unilateral-appuye

* name: Rowing unilatéral appuyé (haltère léger)
* modality: strength
* intensity: easy
* lieu: les deux
* douleurs: dos
* hint: appui banc pour protéger lombaires.

### id: curl-biceps-leger

* name: Curl biceps léger
* modality: strength
* intensity: easy
* lieu: salle
* douleurs: aucune
* hint: prévention coude.

### id: extension-triceps-elastique

* name: Extension triceps à l’élastique (au‑dessus de la tête)
* modality: strength
* intensity: easy
* lieu: maison
* douleurs: épaule
* hint: amplitude de confort.

### id: marche-vallonnee

* name: Marche en terrain vallonné (durée continue)
* modality: run
* intensity: easy
* lieu: extérieur
* douleurs: genou
* hint: choisir pente modérée.

### id: tapis-marche-inclinee

* name: Tapis marche inclinée (rythme constant)
* modality: circuit
* intensity: easy
* lieu: salle
* douleurs: genou
* hint: inclinaison faible à moyenne.

### id: airbike-doux

* name: AirBike effort doux (bras+jambes)
* modality: circuit
* intensity: easy
* lieu: salle
* douleurs: épaule
* hint: résistance légère.

### id: corde-saut-simple-alterne

* name: Corde à sauter simple appui alterné
* modality: plyo
* intensity: moderate
* lieu: les deux
* douleurs: genou
* hint: impacts faibles, chaussures amortissantes.

### id: rebonds-box-controles

* name: Petits rebonds sur box (montée/descente contrôlée)
* modality: plyo
* intensity: moderate
* lieu: salle
* douleurs: genou
* hint: hauteur très basse.

### id: planche-laterale-abduction

* name: Planche latérale avec abduction hanche
* modality: core
* intensity: moderate
* lieu: les deux
* douleurs: épaule
* hint: petite amplitude.

### id: rotation-russe-legere

* name: Rotation russe légère
* modality: core
* intensity: easy
* lieu: les deux
* douleurs: dos
* hint: sans charge lourde.

### id: glisses-hanches-sol

* name: Glissés fessiers (hip slides) au sol
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: aucune
* hint: contrôle actif.

### id: mobilite-cheville-chargee

* name: Mobilité cheville en charge (split squat genou‑orteils)
* modality: mobility
* intensity: easy
* lieu: les deux
* douleurs: genou
* hint: genou suit orteils.
