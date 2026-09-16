# CHECKLIST TÉLÉPHONE — recette de la branche `fix/preparation-clubs`

**15 gestes, ~20 minutes, dans la peau d'un coach de club.** À dérouler sur la branche (Metro ou OTA), avec un COMPTE NEUF. Les gestes 4, 12, 13 demandent le mode avion. Chaque geste dit ce que tu DOIS voir — si tu vois autre chose, c'est un échec de recette.

**Fichier non commité. Aucun merge sans ton verdict.**

---

## À l'installation (compte neuf)

**1. Ouvre l'app.** Sur l'écran d'accueil, le lien « Passer » (en haut à droite) est NET, sous la barre de statut, pas mélangé à l'heure/batterie — et il répond au tap. *(P0-1 — c'était LE premier pixel faux de l'app.)*

**2. Inscris-toi SANS remplir le prénom.** À l'étape 1 du setup, le champ Prénom doit être VIDE (jamais un bout de ton adresse email genre « kyky76700 »). Remplis-le pour continuer.

**3. À l'étape Objectif, choisis « Être en forme toute la saison ».** Termine le setup. Sur l'Accueil, la ligne de cycle doit parler de **Fondation** (« poser tes bases ») — pas de « rester frais pour les matchs ».

**4. Refais un setup (édition profil) et coupe le réseau AVANT de taper « Terminer ».** L'overlay tourne ~15 s puis : toast « Tes réponses sont conservées — réessaie dans un instant », l'écran reste rempli. Réactive le réseau, retape Terminer → ça passe. *(Avant : gel éternel, force-kill = tout perdu.)*

## Jour 1 dans l'app

**5. Ouvre l'onglet Profil.** Puce ÉTAT = « — » et carte « Ta forme » = « Pas encore de données — Ta forme se calcule sur tes séances validées. » **PLUS JAMAIS** « En forme — Prêt à performer » ni 7 barres vertes identiques sur un compte de 2 minutes. *(P0-3/P0-4 — le mensonge que 15 joueurs neufs auraient vu en même temps.)*

**6. Va sur l'onglet Séance.** AUCUN bouton « Jour OFF (+1j) » (outil dev, retiré du binaire club). Génère une séance → dans la Preview, les badges des blocs sont en FRANÇAIS (« Intense », « Modéré », « Facile » — plus de « hard »).

**7. Lance la séance, termine-la. Le feedback s'ouvre : swipe-le vers le bas, puis choisis « Rester ».** LA FEUILLE DOIT REVENIR À SA PLACE, tout re-tappable. *(P0-2 — avant : fond flouté vide, seule issue = tuer l'app.)*

**8. Sur le même feedback :** en-tête « État du jour » + date en français (« ven. 15 août », pas 2026-08-15) ; tape le champ Durée → la valeur se SÉLECTIONNE (elle n'est pas effacée) ; vide-la → une ligne dit « Vide : on garde la durée prévue (X min) » ; tous les curseurs et boutons répondent au doigt.

**9. Valide le feedback.** Retour Accueil : « Ma semaine » passe à 1 immédiatement.

**10. Fais une batterie de tests terrain (ou un seul test rapide), puis reviens à l'Accueil et au Profil SANS tuer l'app.** Les deux se mettent à jour tout de suite — et au Profil, « Tests ce mois : 1 » compte ton VRAI test (plus les footings).

## Pendant la semaine

**11. Génère une séance et ne l'ouvre pas. Le lendemain,** le Home propose ton retour → ouvre le feedback → lien « Je ne l'ai pas faite » sous Valider → confirme. Toast « Séance archivée », le Home et la génération se libèrent aussitôt, l'historique montre « Pas faite · archivée sans charge ». Ta forme (ATL/CTL) n'a pas bougé. *(Ta décision ① — plus besoin de mentir.)*

**12. Tue l'app, passe en mode avion, relance.** Splash « Hors connexion — ton profil ne peut pas être chargé. L'app reprendra dès que le réseau revient. » — **JAMAIS** le questionnaire de profil vierge. Réactive le réseau : l'app entre toute seule.

**13. Toujours en mode avion : ouvre le choix de cycle et tape « Démarrer ce cycle ».** Le bouton passe à « Enregistrement… » puis toast « Pas de connexion — … réessaie ». Plus de bouton mort silencieux.

**14. Sur un compte fraîchement inscrit :** la popup de permission notifications APPARAÎT pendant la première session (après connexion). Refuse-la → Réglages affiche « Notifs désactivées » (il ne ment plus).

## Côté coach

**15. Depuis Welcome, « Je suis coach » → crée un club.** AVANT la création : dialog « Tu crées un espace ENTRAÎNEUR pour gérer des joueurs. Cette action est définitive sur ce compte. » avec « Annuler » mis en avant. *(Ta décision ③.)* Bonus mode avion : « Créer mon club » → toast « Ta saisie est conservée » après ~15 s, plus d'overlay infini.

---

## Ce que cette recette NE couvre pas (déjà couvert ailleurs)

- Les fiches d'exercices et le badge « À deux » → recette de `recette/bibliotheque-non-solo` (à faire passer AVANT ou avec cette branche).
- La recette Home vNext complète (320/375/390 px × texte ×1,3) → `docs/home-vnext-2026-08/RECETTE_HOME.md`.
- Les 30 autres problèmes du Profil (P1/P2 de AUDIT_PROFIL.md) → chantier refonte Profil, en attente de ton go.
