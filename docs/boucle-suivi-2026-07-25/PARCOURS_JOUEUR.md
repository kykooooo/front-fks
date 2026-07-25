# PARCOURS_JOUEUR — La boucle vécue par le joueur (25/07/2026)

## Vue d'ensemble

```
Générer → Preview → SÉANCE LIVE → Résumé → Feedback → Décision (shadow) → Progression
              (photographie figée)  (vrai réalisé)  (enrichi auto)   (expliquée)    (visible)
```

## 1. Lancement de séance (SessionLive)

Au lancement, l'app **fige la photographie** de ce qui est prescrit (exercices, séries, reps, durées, RPE cible, phase du cycle, contexte match) avec une empreinte. Un changement ultérieur du catalogue ne réécrira jamais cet historique.

Pendant la séance, **rien ne change pour le parcours du bonheur** : le joueur coche ses séries comme avant, les timers/circuits/repos automatiques sont intacts.

### Si un exercice pose problème
Bouton discret « ⋯ » sur chaque exercice :
- **Adapté** → raison (manque de temps, matériel, trop difficile, fatigue, douleur, technique, place, partenaire, autre) → valeurs réelles **facultatives**, adaptées au type d'exercice (kg+reps pour un exo chargé, reps pour du poids du corps, distance pour un sprint, durée pour un chrono). Jamais de saisie série par série.
- **Sauté** → raison, c'est tout.
- **« Je ne peux pas faire cet exercice »** → raison → l'app propose immédiatement un remplacement validé :
  - nom + explication courte (« Même travail unilatéral des jambes, sans matériel. ») + prescription adaptée ;
  - badge honnête « Adaptation partielle » si l'équivalence n'est pas totale ;
  - « Voir une autre option » seulement si une 2e alternative validée existe (2 max, jamais de boucle) ;
  - « Passer l'exercice » toujours disponible ;
  - **douleur** : seules les alternatives explicitement sûres sont proposées ; sinon l'app recommande de passer, sans inventer.
  - La carte affiche ensuite le remplacement (nom, prescription, note) — plus jamais la consigne de l'original.

### Fin de séance
- Aucun écart marqué → question unique : **« Tout s'est passé comme prévu ? »** → 1 geste et c'est validé.
- Options honnêtes : « Je précise d'abord » (toast qui guide vers ⋯) ou « Terminer sans préciser » (les items non marqués restent « inconnus », jamais gonflés).

## 2. Résumé (SessionSummary)

Affiche le **vrai réalisé** : « Séance réalisée à N % », compteurs (faits / adaptés / remplacés-équivalents / adaptés-sans-équivalence / sautés), liste courte des écarts « Original → Remplacement — raison ». Sans données de suivi (vieux parcours) : affichage historique inchangé.

## 3. Feedback (inchangé + enrichi)

RPE / durée / fatigue / douleur / récupération / blessure : **identiques à avant**. S'ajoute automatiquement une carte résumé (« Séance réalisée à 88 % », « RPE prévu 7 — ressenti 8 », « 1 exercice adapté (matériel indisponible) ») — zéro saisie en plus. La durée est pré-remplie avec le chrono réel.

Soumission blindée : double-clic, reprise réseau, rejeu offline → **jamais deux exécutions pour une même validation**.

## 4. Décision (shadow)

Après le feedback, le moteur calcule sa recommandation (11 règles, sécurité d'abord), la **stocke avec son explication** — et ne change RIEN à la prochaine séance (mode Application OFF au pilote).

## 5. Progression (« Ton suivi »)

Le joueur répond à ses 3 questions :
1. **Où j'en suis ?** — cycle actif, « Séance N/12 », phase.
2. **Est-ce que je progresse comme prévu ?** — complétion moyenne, régularité, effort ressenti vs prévu, évolution des charges/reps (même exercice uniquement), qualités travaillées.
3. **Pourquoi ma prochaine séance est maintenue/adaptée ?** — dernière décision en badge + explication complète en français simple (« Tu as raccourci la séance par manque de temps, sans difficulté physique. Ta progression reste inchangée. »).

Si les données manquent : l'app le dit (« Pas encore assez de données ») — jamais de chiffre inventé.

## 6. Reprise après coupure

- Détection depuis les séances réellement terminées (14 j = reprise douce, 28 j = recommandation fondations — seuils en config documentée).
- Nouvel utilisateur : question optionnelle au setup (« Depuis quand n'as-tu pas eu d'entraînement régulier ? »), skippable, intégrée à une étape existante.
- Jamais de bascule de cycle silencieuse : la recommandation est expliquée, le joueur choisit.
