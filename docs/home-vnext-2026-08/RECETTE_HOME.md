# RECETTE TÉLÉPHONE — Accueil vNext + Progression refondue

**Branche** : `feat/home-vnext-integration`, rebasée sur `origin/main` (`b50539a`, entrée coach incluse)
**Portes automatiques au moment d'écrire** : `tsc` 0 erreur · `jest` 140 suites / 3364 verts / 1 ignoré / **0 échec** · `eslint` 0 erreur sur les 55 fichiers touchés par la branche
**Ce document est la dernière porte avant merge.** Les trois portes ci-dessus ne prouvent rien de ce qui suit.

> Ce fichier vit dans le dépôt, sur la branche, à côté du code qu'il juge — comme
> `docs/coach-pilote-2026-07/CHECKLIST_TELEPHONE.md`. Il se coche dans un fork local ou sur papier ;
> ce qui compte est qu'il soit **lisible par quelqu'un qui n'a pas suivi le chantier**.

---

## Pourquoi cette recette existe, en une minute

Quatre choses ne se voient QUE sur un vrai téléphone :

1. **Les plafonds de grossissement du texte.** L'écran limite l'agrandissement sur trois rôles de texte
   (salutation ×1,2 · titre du bouton ×1,2 · petites capitales ×1,15) et **ne le limite nulle part
   ailleurs** — un chiffre, une phrase, un lien doivent grossir autant que le joueur le demande.
   Ce mécanisme (`maxFontSizeMultiplier`) **n'existe pas en web** : le visualiseur du prototype ne l'a
   jamais éprouvé. Personne au monde n'a encore vu ces plafonds fonctionner.
2. **Les vibrations.** Le nouvel accueil ne passe ni par `components/ui/Button` ni par l'ancien CTA :
   son retour haptique a dû être rebranché à la main dans le conteneur. En web, les vibrations
   n'existent pas — aucun test de rendu, aucune capture ne peut dire si le bouton « répond ».
3. **Les gestes.** L'accueil vit dans le `SwipeTabsWrapper` (glisser entre onglets). Le 01/08, ce même
   wrapper **avalait des taps** sur un autre écran. Un bouton qui ne répond pas ne se voit dans aucun test.
4. **La largeur réelle.** La courbe se mesure au montage (`onLayout`). En web elle est simulée.

**Règle de lecture** : une case cochée = « je l'ai vu de mes yeux sur le téléphone ». Une case laissée
vide n'est pas un échec, c'est « pas encore regardé ». Ce qui bloque le merge, ce sont les lignes
marquées **[BLOQUANT]**.

---

## 0. Le réglage du téléphone, avant de commencer

- [ ] Réglages > Affichage > **Taille du texte : au maximum** (iOS : Accessibilité > Affichage et taille du texte > Texte plus grand, curseur à fond)
- [ ] Réglages > Accessibilité > **Réduire les animations : ACTIVÉ**
- [ ] Réglages FKS > **vibrations activées** (sinon la section 10 ne veut rien dire)
- [ ] Faire une première passe **sans** texte agrandi ni animations réduites (état normal), puis une seconde **avec**. Les deux comptent.

**Les trois largeurs.** Tu n'as sûrement pas trois téléphones. Deux solutions, l'une ou l'autre :

- un simulateur iOS (iPhone SE = 320 pt, iPhone 13 mini = 375 pt, iPhone 15 = 390 pt) ;
- **ou** ton téléphone + le zoom d'affichage (Réglages > Affichage > Zoom : « Plus gros » rétrécit la
  largeur utile et suffit à faire apparaître les mêmes ruptures).

Si tu ne peux faire qu'**une** largeur : fais **320 px**. C'est celle qui casse.

---

## 1. Les 10 états de l'accueil — comment y arriver

L'écran choisit **un seul** bouton, selon ta situation. Voici les dix situations, dans l'ordre de
priorité du code.

> **Deux d'entre eux sont INATTEIGNABLES aujourd'hui, et c'est normal.** Les états ① et ③ dépendent de
> deux informations que l'app ne conserve pas encore (l'échec d'une génération ; une séance ouverte
> puis abandonnée). Le code qui les affiche existe et est testé, mais rien ne peut les déclencher sur
> ton téléphone. **Ne les cherche pas, tu perdrais ta soirée.** Ils sont listés pour que tu saches
> qu'ils n'ont pas été oubliés.

| # | Ce que tu dois voir | Comment y arriver |
|---|---|---|
| ① | « Réessayer » | — **inatteignable** (aucun store ne garde l'échec d'une génération) |
| ② | « Dis-nous comment ça s'est passé » | Termine une séance, reviens à l'accueil sans remplir le feedback |
| ③ | « Reprendre ma séance » | — **inatteignable** (l'app ne trace pas une séance abandonnée en cours de route) |
| ④ | « C'est parti » | Une séance est prévue pour **aujourd'hui** et n'est pas commencée |
| ⑤ | « Séance faite » | Termine la séance du jour + remplis le feedback, reviens à l'accueil |
| ⑥ | « Reprendre mon programme » | Aucune séance depuis **14 jours** (compte de test, ou profil déclarant une coupure au setup) |
| ⑦ | « Voir ma séance de demain » | Une séance est prévue pour **demain**, rien pour aujourd'hui |
| ⑧ | « Choisir mon cycle » / « Choisir mon prochain cycle » | Compte sans cycle actif — ou cycle terminé (12/12) |
| ⑨ | « Préparer ma séance » | Cas courant : cycle actif, rien de prévu aujourd'hui |
| ⑩ | Bloc **« Première mission »** | **Compte tout neuf**, zéro séance terminée |

---

## 2. LA MATRICE DE PASSAGE — le cœur de la recette

Pour **chaque état atteint**, la même vérification aux **trois largeurs**, puis **texte au maximum**,
puis **animations réduites**. Une case = un passage réellement fait sur le téléphone.

**Ce qu'on regarde à chaque case, en une phrase** : rien ne déborde, rien d'important n'est coupé, le
bouton répond au premier tap et mène au bon endroit.

| État | 320 px | 375 px | 390 px | Texte ×max | Animations réduites |
|---|---|---|---|---|---|
| ① Réessayer *(inatteignable)* | s.o. | s.o. | s.o. | s.o. | s.o. |
| ② Dis-nous comment ça s'est passé | [ ] | [ ] | [ ] | [ ] | [ ] |
| ③ Reprendre ma séance *(inatteignable)* | s.o. | s.o. | s.o. | s.o. | s.o. |
| ④ C'est parti | [ ] | [ ] | [ ] | [ ] | [ ] |
| ⑤ Séance faite | [ ] | [ ] | [ ] | [ ] | [ ] |
| ⑥ Reprendre mon programme | [ ] | [ ] | [ ] | [ ] | [ ] |
| ⑦ Voir ma séance de demain | [ ] | [ ] | [ ] | [ ] | [ ] |
| ⑧ Choisir mon cycle | [ ] | [ ] | [ ] | [ ] | [ ] |
| ⑨ Préparer ma séance | [ ] | [ ] | [ ] | [ ] | [ ] |
| ⑩ Première mission | [ ] | [ ] | [ ] | [ ] | [ ] |

**Si tu manques de temps** : les états **⑨** et **⑩** à **320 px**, texte au maximum. Ce sont l'état le
plus courant et l'état le plus riche, à la largeur qui casse. Le reste est du confort.

### Ce qu'il faut voir dans CHAQUE case ci-dessus

- [ ] **[BLOQUANT]** Le bouton **répond au tap du premier coup** (le piège `SwipeTabsWrapper` du 01/08)
- [ ] Le bouton mène au bon endroit : « C'est parti » → séance en live · « Préparer » → génération ·
      « Choisir mon cycle » → modale cycle · « Dis-nous » → feedback · « Séance faite » → détail
- [ ] **[BLOQUANT]** Le titre du bouton **ne se coupe pas** et ne déborde pas
- [ ] La phrase sous le bouton reste lisible (elle peut passer à la ligne, jamais être tronquée)
- [ ] **Il n'y a qu'UN SEUL bouton pleine largeur** sur tout l'écran (décision fermée : un seul CTA).
      Un lien discret dessous (« Voir le détail », « Revoir la séance ») est **normal** : c'est un lien,
      pas un second bouton. Ce qu'on ne veut pas, c'est deux aplats de couleur qui se disputent l'œil
- [ ] Aucune pastille d'état globale (pas de gros badge « EN FORME » / « FATIGUÉ » en haut)
- [ ] Aucun compteur « Série de N jours » nulle part

### Le bloc « Première mission » (⑩), en détail

- [ ] Il affiche une liste de premiers pas avec des coches **qui reflètent la réalité** du compte
- [ ] La coche « Ton profil » est cohérente avec ce que tu as réellement rempli
- [ ] Le « pourquoi » du cycle proposé correspond à l'objectif choisi au profil
- [ ] **[BLOQUANT]** Le bloc **disparaît** dès la 1re séance terminée (à revérifier juste après le feedback)
- [ ] Aucun chiffre inventé dans ce bloc (pas de « 0 séance sur 12 » présenté comme une progression)

---

## 3. « Ma semaine » — le compteur qui existait en triple

- [ ] Le compteur hebdo est affiché **une seule fois dans toute l'app** (accueil uniquement)
- [ ] **[BLOQUANT]** Il n'apparaît **plus** dans « Ton suivi », page Progression (c'était la 2e copie)
- [ ] Le chiffre correspond à ce que tu as réellement fait cette semaine
- [ ] La semaine commence bien le jour réglé dans les Réglages (lundi ou dimanche)
- [ ] Le chiffre est **identique** entre l'accueil et l'écran Routine (même semaine, deux écrans)

---

## 4. « MA FORME » — plus jamais de courbe fabriquée

C'est le point produit le plus sensible : **des joueurs qui voyaient une courbe n'en verront plus.**
C'est voulu — l'ancienne partait d'une valeur inventée (une forme « +3 » le jour de l'inscription).

- [ ] **Compte neuf / peu de données** : pas de courbe, mais une phrase honnête (« pas encore assez »).
      **[BLOQUANT]** : aucune ligne tracée, aucun « 0 » affiché comme s'il voulait dire quelque chose
- [ ] **Compte avec un peu d'historique** (moins de 3 jours réels) : toujours pas de courbe
- [ ] **Compte fourni** (≥ 4 séances, ≥ 3 jours réels) : la courbe apparaît
- [ ] **[BLOQUANT]** La courbe **occupe la bonne largeur** — pas coupée à droite, pas d'espace vide
      (c'est la mesure `onLayout` qui n'a jamais été vue en vrai) — à vérifier **aux trois largeurs**
- [ ] Sous la courbe, la portée est écrite. Texte exact attendu :
      **« Calculé sur tes séances FKS et les charges que tu as saisies »** — suivi, si tu as déclaré
      des entraînements club au profil, de **« — tes entraînements club notés au profil n'y sont pas
      comptés. »**
- [ ] **[BLOQUANT]** Texte au maximum : cette phrase de portée **n'est pas coupée** (elle a le droit de
      passer sur deux ou trois lignes, jamais d'être tronquée par « … »). C'est la plus longue phrase
      de l'écran : c'est elle qui casse en premier à 320 px.

---

## 5. La carte Progression (accueil) et la page Progression

La carte de l'accueil et la page complète lisent **le même calcul**. Elles ne peuvent donc plus se
contredire — vérifie quand même qu'elles racontent la même chose.

### Les trois états, sur la carte comme sur la page

- [ ] **Vide** (compte neuf) : un titre, des repères, une mention — et **aucune comparaison de tests**
- [ ] **En construction** : dit ce qui manque, sans afficher de faux chiffre
- [ ] **Prête** : faits cumulés + repère de test + lien vers la page

### Aller-retour

- [ ] **[BLOQUANT]** Le lien « Voir ma progression » depuis l'accueil ouvre bien la page Progression
- [ ] Le lien n'apparaît **que** dans l'état « prête » (c'est normal qu'il soit absent sur un compte neuf)
- [ ] Retour arrière depuis la page Progression → on retombe sur l'accueil, pas ailleurs
- [ ] Les chiffres de la carte et ceux de la page **coïncident**

### La couture typographique — À TRANCHER PAR TOI

L'accueil rend l'échelle allégée que tu as demandée : **graisse maximale 700**, hiérarchie portée par
la taille plutôt que par l'épaisseur. La page Progression codait encore sept titres en 800 et une
valeur en 900 : elle vient d'être ramenée sur la même échelle (épaisseur seule ; ni taille, ni
couleur, ni espacement n'ont bougé).

- [ ] Enchaîne **accueil → Voir ma progression → retour**, trois fois d'affilée. Les deux écrans
      donnent-ils l'impression d'appartenir à la même app ?
- [ ] Sur la page Progression, les titres de section te paraissent-ils **assez** affirmés à 700 ?
      Si tu les trouves mous, dis-le : c'est un réglage d'une ligne, mais c'est **ton** appel, pas le mien

### Sur la page Progression, ce qui a disparu — et doit rester disparu

- [ ] **[BLOQUANT]** Plus de gros bloc « TA FORME » en haut avec une valeur inventée
- [ ] Plus de « Record de série »
- [ ] Plus d'accomplissements/badges déduits automatiquement
- [ ] **« Ton suivi » est toujours là**, empilé **sous** le résumé, avec le bandeau de reprise en haut
- [ ] Les deux compteurs de séances portent des **libellés différents** et compréhensibles :
      « séances **suivies** » (les 28 derniers jours) ≠ « séances **terminées** » (depuis le début)
- [ ] **[BLOQUANT]** Ces deux chiffres peuvent être différents — vérifie que ça ne **ressemble pas** à
      une erreur : si à la lecture tu te dis « il y a un bug », c'est un problème de libellé à corriger

### Comparaisons de tests terrain

- [ ] Deux tests faits **le même jour** ne produisent **pas** de comparaison
- [ ] Un test fait **après 23 h** reste daté du **jour où tu l'as fait**, pas du lendemain
- [ ] Un écart nul s'affiche comme « identique », pas comme une régression en rouge

---

## 6. Les trois largeurs — la passe qui casse

En plus de la matrice, ces six points sur les **deux ou trois états les plus riches** que tu peux atteindre.

| | 320 px | 375 px | 390 px |
|---|---|---|---|
| Rien ne déborde horizontalement (aucun scroll latéral) | [ ] | [ ] | [ ] |
| Aucun texte coupé par « … » à un endroit qui le rend incompréhensible | [ ] | [ ] | [ ] |
| Le bouton principal tient sur une largeur confortable | [ ] | [ ] | [ ] |
| La courbe est à la bonne largeur | [ ] | [ ] | [ ] |
| Les blocs ne se chevauchent pas | [ ] | [ ] | [ ] |
| Le bas de page n'est pas mangé par la barre d'onglets | [ ] | [ ] | [ ] |

---

## 7. Texte agrandi — LE point que rien n'a jamais testé

Texte au **maximum**, sur au moins **320 px** et une largeur confortable.

- [ ] **[BLOQUANT]** « Salut, {prénom} » grossit **un peu, puis s'arrête** (plafond ×1,2)
- [ ] **[BLOQUANT]** Le titre du bouton grossit **un peu, puis s'arrête** (plafond ×1,2)
- [ ] **[BLOQUANT]** Les titres de section en petites capitales — **« MA SEMAINE »**, **« MA FORME »**,
      **« MA PROGRESSION »** — grossissent **très peu** (plafond ×1,15)
- [ ] **[BLOQUANT]** À l'inverse : les **chiffres**, les **phrases** et les **liens** grossissent
      **autant que le réglage le demande** — s'ils s'arrêtent aussi, un plafond a été posé au mauvais
      endroit et **une information devient illisible pour qui a besoin de gros texte**
- [ ] Rien ne devient illisible, rien ne disparaît sous un autre bloc
- [ ] Les boutons restent tapables (la zone de tap n'a pas rétréci)

---

## 8. Animations réduites

Réglage « Réduire les animations » **activé**.

- [ ] **[BLOQUANT]** Le bouton principal **ne pulse plus** (aucun battement, aucun grossissement en boucle)
- [ ] Aucune animation en boucle nulle part sur l'accueil
- [ ] L'écran de chargement (voile) ne tourne pas en boucle
- [ ] **[BLOQUANT]** Plus **aucune vibration** non plus (le réglage coupe les deux — voir section 9)
- [ ] **Bascule le réglage pendant que l'app est ouverte** : l'accueil doit s'adapter **sans redémarrage**
- [ ] Au tout premier affichage, si une pulsation démarre puis s'arrête en une fraction de seconde :
      le noter, ce n'est pas bloquant mais c'est connu

---

## 9. Les vibrations — rebranchées à la main, jamais vues

Le nouvel accueil n'utilise ni `components/ui/Button` ni l'ancien CTA : son retour au doigt a dû être
recâblé dans le conteneur. **Réglages FKS : vibrations activées, animations NON réduites.**

- [ ] **[BLOQUANT]** Le bouton principal **vibre** au tap (impulsion légère, comme l'ancien accueil)
- [ ] Le lien secondaire sous le bouton vibre pareil
- [ ] Le pied « Voir ma progression » vibre pareil
- [ ] Si une action est indisponible (bandeau d'avertissement au lieu d'une navigation) : la vibration
      est **différente** — un avertissement, pas une impulsion. Tu dois sentir que tu as bien tapé
- [ ] Une seule vibration par tap (pas deux secousses coup sur coup)
- [ ] **[BLOQUANT]** Réglages FKS > vibrations **coupées** : plus **rien** ne vibre sur l'accueil
- [ ] **[BLOQUANT]** « Réduire les animations » **activé** : plus rien ne vibre non plus

---

## 10. Les cas moches

- [ ] **Mode avion** : un bandeau apparaît, texte exact **« Tu es hors connexion : ce que tu vois ici
      peut dater de ta dernière synchro. »** Aucun chiffre n'est effacé, aucun « 0 » n'apparaît à la
      place d'une vraie valeur
- [ ] **Retour du réseau** : le bandeau disparaît tout seul
- [ ] **Au lancement de l'app** : on voit un squelette gris, **jamais** des textes ou des chiffres qui
      changent sous les yeux une demi-seconde après
- [ ] **[BLOQUANT]** Depuis l'accueil, glisser vers l'onglet Séance et revenir : l'accueil est intact
      et **les taps fonctionnent encore**
- [ ] Verrouiller / déverrouiller le téléphone, revenir sur l'accueil : rien de cassé
- [ ] Faire pivoter le téléphone si la rotation est permise

---

## 11. Non-régression — le reste de l'app

L'accueil a changé, pas le reste. Rapide passe pour s'en assurer.

- [ ] Générer une séance de bout en bout : génération → aperçu → live → feedback
- [ ] Le feedback met bien à jour l'accueil (l'état ⑤ « Séance faite » apparaît)
- [ ] Écran Séance, écran Profil, Réglages : rien de cassé
- [ ] Tests terrain : saisir un test, le retrouver dans les comparaisons
- [ ] Inscription d'un compte neuf de bout en bout → on arrive bien sur l'accueil (état ⑩)
- [ ] Le bouton « Je suis coach » de l'écran d'accueil marche toujours (lot fusionné juste avant celui-ci)

---

## 12. Le verdict

- [ ] **Aucune ligne [BLOQUANT] en échec** → le merge peut avoir lieu
- [ ] Si une ligne [BLOQUANT] échoue : ne pas merger, **et ne pas non plus basculer l'interrupteur** —
      corriger. L'interrupteur (`config/homeFeatures.ts`, `VNEXT: false`) est le filet d'**après** le
      merge, pour un problème découvert en production, pas une façon de faire passer une recette ratée.

**Ce que la recette valide aussi, implicitement — à confirmer d'un mot :**

- [ ] Les seuils d'affichage de la carte progression te conviennent : **4 séances**, **3 points**,
      **3 jours réellement observés**, **2 jours distincts** par test. Ils étaient marqués
      « À VALIDER PAR LE FONDATEUR » depuis le prototype. **Sans un mot de ta part, ils deviennent la
      règle par défaut.**
- [ ] Tu assumes d'**annoncer** aux joueurs pilotes que la courbe de forme peut disparaître au profit
      d'un « pas encore assez de données » : l'ancienne était fabriquée, la nouvelle est honnête, mais
      le joueur, lui, voit surtout qu'on lui a retiré quelque chose.
- [ ] La graisse 700 sur la page Progression te va (section 5, « la couture typographique »).

---

## Notes pour qui corrigera

- Un bug trouvé ici est **un vrai bug** : ni tsc, ni jest, ni eslint ne pouvaient le voir.
- Après correction, **relancer la ligne échouée à la même largeur et avec les mêmes réglages** — pas la
  recette entière.
- Réflexe du 01/08 : après une édition en direct, **relire le fichier réellement modifié** (grep), pas
  celui qu'on croit avoir modifié.
