# Recommandations — Home Screen joueur

Classement : **P0** = trompeur, bloquant ou réellement mauvais · **P1** = à faire avant les pilotes · **P2** = finition.

---

## P0 — Le Home affirme des choses qu'il ne sait pas

Ces quatre points partagent une seule racine et doivent être traités ensemble. Tant qu'ils sont là, aucun travail de style ne rendra l'écran crédible.

### P0.1 — Ne plus présenter les constantes d'initialisation comme une mesure

`CTL0 = 15`, `ATL0 = 12` → TSB de départ +3 → « En forme — Prêt à performer ». Un compte à 0 séance affirme un état de forme.

**Règle à poser** : tant qu'il n'y a pas de charge réelle observée, le Home ne dit **pas** d'état. Il dit ce qu'il sait :
- 0 séance → *« On ne sait pas encore où tu en es. Fais ta première séance, on commencera à mesurer. »*
- < N jours de données → un état affiché avec une mention explicite du type *« estimation — 3 jours de données »*.

Ne pas inventer de nouvelle donnée : `dailyApplied` et `sessions` suffisent à savoir si l'on a mesuré quoi que ce soit.

### P0.2 — Ne plus tracer une courbe sur zéro donnée

`useLoadSeries` renvoie **toujours** 7 points, même sans historique. Et il resème `ATL0/CTL0` à J-28 alors que le libellé affiché juste au-dessus vient de `rebuildLoad`, qui resème au premier jour d'activité réel : **deux vérités contradictoires dans la même carte**.

**À faire** : une seule source de série ; pas de courbe en dessous d'un seuil de points réels ; à la place, un état vide honnête (le modèle existe déjà : `renderEmptyRoster` dans `CoachHomeScreen`, avec son aperçu explicitement étiqueté « à quoi ça ressemblera »).

### P0.3 — Ne plus compter comme « série » ce que le joueur n'a jamais confirmé

`applyAutoExternalLoads` injecte des charges club/match à partir des seules cases du setup profil. « Série 5 j » peut être affiché à quelqu'un qui n'a rien fait dans l'app.

**Deux options, au choix, mais il faut trancher** : (a) exclure les charges auto du calcul de série et ne compter que ce qui est confirmé ; (b) les garder mais **nommer honnêtement** le compteur (« Jours actifs » plutôt que « Série », et dire d'où ça vient). L'option (a) est plus simple et plus honnête.

### P0.4 — Ne plus afficher un écran d'usine pendant l'hydratation

`storeHydrated` existe et n'est **pas utilisé pour l'affichage**. Filet de sécurité à 10 s : un joueur en surcharge peut lire « En forme, c'est le moment d'envoyer » avant bascule.

**À faire** : tant que `storeHydrated === false`, afficher des squelettes sur les blocs dépendants de la charge (état, courbe, compteurs). Le CTA et le chip cycle peuvent rester.

---

## P1 — Avant les pilotes

### Contradictions et navigation

| # | Problème | Correction |
|---|---|---|
| P1.1 | Le CTA « Préparer ma séance — programme adapté en 2 min » ouvre **l'onglet Séance** (un menu), pas la génération ; et parfois `CycleModal` | Pointer sur `GenerateSession` ; adapter le libellé quand la vraie destination est le choix de cycle |
| P1.2 | `tsb <= -15` **efface** la séance déjà prête pour aujourd'hui, pendant que la carte du bas dit « Prête à être lancée » | Réordonner : la séance du jour passe avant la bascule récup, ou fusionner (« Ta séance du jour, allégée ») |
| P1.3 | Feedback en retard : le CTA dit « Ma séance est prête » et lance `SessionLive` sur une date passée, pendant que la carte dit « Dis-nous comment ça s'est passé » | Une seule voix : quand un feedback est dû, **c'est ça l'action n°1** |
| P1.4 | Séance datée J+1 annoncée « prête » sans dire qu'elle est pour demain | Dater explicitement |
| P1.5 | Jour de match / club : le CTA propose de générer **au-dessus** d'un conseil qui dit de ne pas le faire | Le calendrier doit entrer dans la cascade du CTA |
| P1.6 | Les 6 conseils actionnables pointent **tous** vers `PrebuiltSessions` sans paramètre, avec 6 libellés différents (« Routine pré-match », « Flow Mobilité »…) | Passer les paramètres, ou aligner le libellé sur la destination réelle |
| P1.7 | `Alert.alert` à 3 boutons dans `usePrimaryCta` — contraire à la convention `showToast()`, et no-op sur web | Reprendre le pattern inline de `SessionHubScreen` (`alertCard`) |
| P1.8 | Routes mortes : `ExternalLoad` et `Routine` déclarées, jamais appelées — et un toast du Home promet l'ajout d'activité externe | Rebrancher ou retirer la promesse |
| P1.9 | Le cycle est numéroté différemment sur le Home (séance à venir) et sur l'onglet Séance (séances faites) | Une seule numérotation |
| P1.10 | `weeklyGoal` par défaut à 2 alors que le joueur a déclaré son objectif au setup | Lire l'objectif déclaré |
| P1.11 | « Semaine 3/2 » — le compteur n'est pas borné | Borner, et changer de formulation au-delà de l'objectif |

### Doublons à supprimer

| # | Doublon | Décision |
|---|---|---|
| P1.12 | Le bouton primaire de la carte Prochaine séance = **le même bouton** que le CTA (label, `onPress` et `disabled` identiques sans séance en attente) | **Supprimer** `HomeNextSessionCard` |
| P1.13 | Série affichée 2× (ligne stats + carte Progression) | **Supprimer** l'occurrence de la carte Progression |
| P1.14 | État du jour affiché 3× (chip + hero + conseil), parfois mot pour mot | **Une seule fois.** Garder le chip du header ; le hero ne garde que la tendance ; le conseil ne répète plus l'état |
| P1.15 | Titre de séance affiché 2× (sous-titre du CTA + carte du bas) | Résolu par P1.12 |
| P1.16 | Bouton « Historique » sur le Home alors que l'onglet Séance a déjà une tuile Historique | **Déplacer** vers l'onglet Séance |

### Accessibilité — bloquants

| # | Problème | Correction |
|---|---|---|
| P1.17 | **CTA principal à 2.88:1** (blanc sur `#F2741B`), sous-titre à **2.60:1** | Assombrir l'orange en usage texte, ou passer le label sur un fond conforme. Seuil : 4.5:1 |
| P1.18 | **CTA « Journée récup » à 2.65:1** | Idem |
| P1.19 | **Zéro prop d'accessibilité** sur tout le Home | `accessibilityRole` / `Label` / `State` sur les 7 éléments interactifs ; regrouper label+valeur des stats ; description du SVG ; masquer les pastilles décoratives |
| P1.20 | 8 zones tactiles sur 8 sous 44 pt (chip feedback à 24-28 px) | Passer par `components/ui/Button` (`minHeight` 48/52/56) ou ajouter `hitSlop` |
| P1.21 | Contenu backend sans `numberOfLines` (sous-titre CTA, titre carte séance) | Borner — violation directe de la règle d'or |
| P1.22 | À 320 px, « Voir la séance » déborde de sa pilule (`width: 140` fixe sur le secondaire) | Largeurs en `flex`, pas en `px` |
| P1.23 | À ×1.3, le chip d'état tronque en « Un peu cha… » | `minHeight` + repli sur 2 lignes plutôt que `maxWidth` fixe |

### Produit

| # | Manque | Correction |
|---|---|---|
| P1.24 | **Aucune détection d'interruption.** Après 24 jours : « Frais — bien reposé », courbe plate, cycle figé sur « Montée en puissance » | Une règle déterministe sur `daysSinceLastSession` : accueil de reprise, proposition de reprise progressive, repère de cycle honnête |
| P1.25 | **Le « pourquoi cette séance » est absent.** `sessionTheme`, `coachingTips`, `playerContext`, `rationale` **existent** dans le payload et ne sont lus que par `SessionPreviewScreen` | Afficher **une ligne** de justification sous le CTA. Donnée déjà disponible — rien à inventer |
| P1.26 | Le moment de la réussite n'est pas récompensé : deux boutons gris et aucune mention de la séance faite | Retourner l'état : ce qui vient d'être accompli, l'effet sur la semaine, et la prochaine échéance |
| P1.27 | « Match : Proche » est déduit d'un **jour de semaine récurrent** du profil, sans date, sans lien | Dire lequel et quand, ou retirer |
| P1.28 | `weekSummary.message` (« Encore 2 séances pour atteindre ton objectif ») est **calculé puis jeté** au profit d'un « 1/2 » | Afficher la phrase |
| P1.29 | Aucun état vide conçu, nulle part | Reprendre le pattern `renderEmptyRoster` de l'espace Coach |
| P1.30 | **Le bandeau hors-ligne recouvre le prénom** (19 px de recouvrement mesuré). Et rien ne marque les chiffres affichés comme potentiellement périmés | Décaler le contenu sous le bandeau plutôt que le superposer ; marquer les données comme datées quand la sync est perdue |
| P1.31 | **Feedback en retard : l'action qui débloque tout est le dernier élément de la page**, le plus petit, en gris, à 93 % de la hauteur | Quand un feedback est dû, il devient l'action n°1, en haut (recoupe P1.3) |
| P1.32 | Le badge vert **« Prête » contredit le texte de sa propre carte** (« Séance en attente… pour débloquer la suivante »), 38 px plus bas | Un seul statut par carte |

---

## P2 — Finition

| # | Point |
|---|---|
| P2.1 | **Passer le Home sous `<Screen>`** (règle d'or). Supprime au passage les 34 px d'inset bas parasites et les 70 px de vide en fin de scroll |
| P2.2 | Adopter `theme.radius` : les rayons **22** et **26** n'existent pas dans l'échelle. Viser 2 rayons, pas 7 |
| P2.3 | Adopter `theme.spacing` : un seul rythme vertical, pas trois (14 / 16 / 10) |
| P2.4 | **Créer et utiliser une échelle typographique.** `theme.typography` existe et n'est utilisé **par aucun fichier du dépôt**. Le Home pose 21 couples fontSize/fontWeight, dont un `12.5` |
| P2.5 | Réduire de 4 palettes à 1 : aligner `FOOTBALL_LABELS` et les tons de `HomeAdviceCard` sur `theme.colors` (ratios actuels : conseil `warn` 2.76:1, `success` 2.88:1, micro-tip `warn` 2.46:1) |
| P2.6 | Remplacer les 10 `TouchableOpacity` maison par `components/ui/Button` |
| P2.7 | Supprimer les repères **« 0 » et « -10 »** de la courbe — du TSB brut affiché au joueur, contraire à la doctrine, et à **2.15:1**, le pire ratio de l'écran |
| P2.8 | Bordures invisibles : `borderSoft` sur `cardSoft` = 1.06:1 |
| P2.9 | `paddingTop: 8` hors grille (les autres écrans sont à 16) |
| P2.10 | Nettoyer `useWeekDays` : calcule 7 jours × 5 statuts pour ne servir que de fournisseur de clés de dates depuis le retrait du calendrier |
| P2.11 | Renommer `HomeCarouselCard` — il n'y a plus de carrousel |
| P2.12 | Supprimer le commentaire mort `// Recommandations du coach` |
| P2.13 | Composants legacy à supprimer : `HomeCycleHero`, `HomeDashboardCard`, `HomeReadinessCard`, `HomeNextSessionCard` (après P1.12) |
| P2.14 | `SessionHubScreen` importe `Badge` sans l'utiliser |

---

# Les trois scénarios

## Option A — Finition légère

Garder la structure, corriger le style : tokens de rayon et d'espacement, échelle typographique, `<Screen>`, `Button`, contrastes, `numberOfLines`, props d'accessibilité, suppression des repères « 0 / -10 ».

- **Gain** : l'écran devient propre et cohérent avec le reste de l'app. Les bloquants d'accessibilité tombent.
- **Limite, et elle est rédhibitoire** : **aucun des quatre P0 n'est traité.** L'écran dira toujours trois fois la même chose, le CTA sera toujours dupliqué en bas, la reprise ne sera toujours pas gérée, et un compte neuf lira toujours « En forme — prêt à performer » sur une courbe fabriquée. On obtient un écran plus joli qui ment toujours.
- **Coût** : moyen. **Verdict : insuffisant seul.** Utile uniquement comme sous-ensemble du lot 3 de l'option B.

## Option B — Restructuration *(recommandée)*

Réorganiser le Home autour d'une seule question : **qu'est-ce que je fais aujourd'hui, et pourquoi**.

### Ordre cible

| # | Section | Rôle | Notes |
|---|---|---|---|
| 1 | **Header compact** — `Salut, X` · date · chip état | Contexte | Le chip état devient la **seule** mention de l'état. Squelette tant que non hydraté, mention explicite si l'estimation est faible |
| 2 | **Bloc d'action** — CTA + **une ligne de justification** + repère de cycle | **Le cœur** | Fusionne le CTA actuel, le chip cycle et la ligne « pourquoi » (issue de `sessionTheme` / `playerContext`, déjà disponibles). Une seule action, une seule fois |
| 3 | **Ma semaine** — `N/objectif` + la phrase de `weekSummary.message` + série | Régularité | Remplace la ligne de stats muette. Série affichée **une seule fois** dans toute l'app |
| 4 | **Ma forme** — chip d'état + tendance | Tendance | Le hero perd son titre et son message (déjà dans le header). Pas de courbe sans données réelles. Sans repères numériques bruts |
| 5 | **Le conseil**, seulement s'il apporte quelque chose | Guidage | Supprimer la règle fourre-tout : pas de conseil vaut mieux qu'un conseil creux. Style ramené à celui d'une note, pas d'une alerte pleine largeur |
| 6 | **Fin de page** — une ligne de sortie discrète vers Progression | Conclusion | Voir §« bas de l'écran » |

### Blocs supprimés / déplacés

- **`HomeNextSessionCard` : supprimée.** C'est le même bouton que le CTA. Son seul apport unique (« Voir la séance » → aperçu) devient une action secondaire du bloc 2.
- **Carte Progression : supprimée**, son streak est un doublon et son lien devient la ligne de sortie du bloc 6.
- **Bouton « Historique » : déplacé** vers l'onglet Séance, qui a déjà sa tuile.

### Ce que ça donne

Le Home passe de **~1086 px et 8 blocs (dont 4 sans action et 3 redites)** à **~600-650 px et 5 sections**, chacune répondant à une question distincte. **Tout tient au-dessus de la ligne de flottaison sur un écran 812.** Le défilement devient facultatif — c'est le bon signe pour un écran consulté dix secondes.

- **Coût** : moyen à important, mais découpé en lots indépendants livrables séparément.
- **Risque** : faible. Aucune donnée nouvelle n'est requise ; on retire plus qu'on n'ajoute ; les hooks existants sont conservés.
- **Verdict : c'est la recommandation.**

## Option C — Home adaptatif

Faire varier la **structure** selon la situation, pas seulement les textes. Un sélecteur déterministe (une fonction pure, testable, aucun appel IA) choisit un `mode` parmi : `seance_a_faire`, `seance_terminee`, `recuperation`, `reprise`, `sans_programme`, `donnees_insuffisantes`, `feedback_du`. Chaque mode définit l'ordre des sections, le CTA et le ton.

- **Bénéfices** : c'est la seule option qui répond vraiment à la reprise après interruption et au moment de la réussite. Elle supprime structurellement les contradictions, puisqu'un seul mode parle à la fois.
- **Coût** : important. Il faut le sélecteur, ses tests, et une variante de rendu par mode.
- **Risques** : combinatoire d'états à tester ; tentation d'ajouter des modes ; régressions visuelles si le sélecteur bascule trop souvent.
- **Contrainte à tenir** : déterministe et explicable, **sans appel IA à chaque ouverture**. Toutes les entrées nécessaires (`daysSinceLastSession`, `pendingSession`, `hasAppliedToday`, `tsb`, `microcycleSessionIndex`, `matchDays`) sont déjà en mémoire.

**Recommandation : viser B maintenant, en écrivant le sélecteur de B de façon à ce qu'il devienne celui de C.** L'option B *est* le premier étage de C : une fois les sections découplées et la cascade du CTA assainie, ajouter un mode ne coûte plus qu'une variante d'ordre.

---

## Le bas de l'écran, concrètement

Le bas est faible parce que le milieu a déjà tout dit. Une fois les doublons retirés, il reste peu — et c'est très bien. Traitement recommandé :

1. **Ne pas le remplir.** Ne surtout pas ajouter de blocs pour compenser. L'écran doit finir plus tôt.
2. **Une seule ligne de sortie**, discrète, textuelle, alignée à gauche : *« Voir ma progression → »*. Pas une carte, pas un bouton plein largeur.
3. **Terminer par une respiration nette** : un espace calme, cohérent (via `<Screen>`, qui supprime les 34 px d'inset parasites), sans le mur de 70 px de vide actuel.
4. **Rien de coloré en bas.** Aujourd'hui le bouton du conseil (aplat saturé pleine largeur) est le deuxième élément le plus fort de l'écran, pour une suggestion secondaire. Le seul aplat coloré doit être le CTA.
5. **Aucune métrique décorative sous la ligne de flottaison.** Si une information mérite d'être vue, elle remonte ; sinon elle sort de l'écran.
