# Plan d'implémentation — Home Screen (option B)

Estimations relatives : **petit** / **moyen** / **important**. Pas d'heures : ce sont des ordres de grandeur.

Les lots sont **indépendants** et livrables séparément, dans l'ordre proposé. Chacun peut partir sur sa propre branche et être validé au téléphone avant le suivant.

---

## Lot 0 — Vérifications téléphone préalables *(petit)*

À faire **avant** d'écrire une ligne de code. Trois points que ni la lecture de code ni le harnais ne peuvent trancher seuls.

| # | À vérifier | Pourquoi |
|---|---|---|
| 0.1 | Le bas du Home sur iPhone récent : **70 px de vide** en fin de défilement, ou **boutons coupés** ? | Les deux méthodes d'audit se contredisent (voir `AUDIT_HOME.md` §7.3). La lecture de la bibliothèque tranche pour « 70 px de vide », mais ça reste un raisonnement, pas une mesure |
| 0.2 | Le **bandeau hors-ligne recouvre-t-il le prénom** ? Mesuré à 19 px de recouvrement sur le rendu | Décide si c'est un P0 ou un artefact de position absolue |
| 0.3 | Rendu du CTA orange au soleil, et du texte blanc dessus (2.88:1) | Décide de l'ampleur du lot 1 |

**Livrable** : 3 réponses oui/non de Kyllian, captures téléphone à l'appui.

---

## Lot 1 — Arrêter de mentir *(moyen)* — **P0**

Le lot le plus important. Il ne touche presque pas au visuel : il change ce que l'écran a le droit d'affirmer.

1. Introduire une notion unique de **« a-t-on assez de données pour parler de forme ? »** (fonction pure, testable, dérivée de `sessions` et `dailyApplied`).
2. Conditionner à ce prédicat : le chip d'état du header, le titre/message de `TON ÉTAT`, la courbe 7 j, la « Série ».
3. Remplacer les cas négatifs par des états vides honnêtes (pattern `renderEmptyRoster` de `CoachHomeScreen`).
4. Unifier la source de la série de charge : `useLoadSeries` et `rebuildLoad` ne doivent plus resémer à deux dates différentes.
5. Brancher `storeHydrated` sur l'affichage → squelettes pendant l'hydratation.
6. Trancher sur les charges auto : les exclure de la « Série », ou renommer honnêtement le compteur.

**Attention** : la « Série » est aussi consommée par les accomplissements de `ProgressScreen` et le badge « Régularité » du Profil, avec **trois définitions différentes** dans l'app. Décider de la définition unique fait partie du lot.

**Risque** : moyen — touche au moteur de charge, à border de tests.
**Test d'acceptation** : sur un compte neuf, aucun chiffre de forme, aucune courbe, aucun « En forme ».

---

## Lot 2 — Supprimer les doublons *(petit à moyen)* — **P1**

Le meilleur rapport effort/effet de tout le plan. C'est surtout de la suppression.

1. **Supprimer `HomeNextSessionCard`** — c'est le même bouton que le CTA. Déplacer son seul apport unique (« Voir la séance » → aperçu) en action secondaire sous le CTA.
2. **Supprimer la carte Progression** — son streak est un doublon ; son lien devient la ligne de sortie de fin de page.
3. **Déplacer « Historique »** vers l'onglet Séance (qui a déjà sa tuile).
4. **Une seule mention de l'état du jour** : garder le chip du header ; `TON ÉTAT` perd titre et message et ne garde que la tendance ; le conseil ne répète plus l'état.
5. **Supprimer la règle fourre-tout** `ready_default` : pas de conseil vaut mieux qu'un conseil creux. Réexaminer `no_mobility`, qui se déclenche sur une **absence** de données et devient le premier message d'un compte neuf.

**Effet mesuré attendu** : de ~1086 px à ~650 px, de 8 blocs à 5, de 3 redites à 0.
**Risque** : faible. Suppression pure, aucune donnée nouvelle.

---

## Lot 3 — Remettre le Home sur le socle *(moyen)* — **P1 / P2**

1. `<Screen>` à la place du `SafeAreaView` brut (règle d'or) — supprime au passage l'inset bas parasite.
2. `components/ui/Button` à la place des 10 `TouchableOpacity` maison — **règle mécaniquement les 8 zones tactiles sous 44 pt** grâce au `minHeight` du composant.
3. `theme.radius` : de 7 rayons à 2. Les valeurs 22 et 26 n'existent pas dans l'échelle.
4. `theme.spacing` : un seul rythme vertical.
5. **Créer une échelle typographique et l'appliquer.** `theme.typography` existe et n'est utilisé par **aucun fichier du dépôt** — décider si on l'adopte ou si on le remplace, mais ne pas laisser 21 couples à la main dont un `12.5`.
6. `SectionHeader` pour toutes les sections, ou pour aucune. Aujourd'hui : 4 conventions de titrage pour 4 blocs consécutifs.
7. Corriger les contrastes : CTA 2.88:1 → ≥ 4.5:1, CTA warn 2.65:1, tons du conseil (2.46 à 2.88:1).
8. Ajouter les props d'accessibilité sur les éléments interactifs, grouper label+valeur des stats, décrire ou masquer le SVG.
9. `numberOfLines` sur le contenu backend ; largeurs en `flex` et non en `px` fixes (le `width: 140` du bouton secondaire casse le primaire à 320 px et à ×1.3).
10. Aligner les palettes : `FOOTBALL_LABELS` et les tons du conseil sur `theme.colors`.
11. Retirer les repères **« 0 » et « -10 »** de la courbe (TSB brut, contraire à la doctrine, et pire ratio de l'écran à 2.15:1).

**Risque** : faible techniquement, **moyen visuellement** — c'est le lot qui change le plus l'apparence. À valider écran par écran au téléphone.

---

## Lot 4 — Assainir la cascade du CTA *(moyen)* — **P1**

Le CTA est le cœur du Home et sa logique porte cinq défauts.

1. **Corriger la destination** : `nav.navigate("NewSession")` ouvre l'onglet (un menu), pas la génération → pointer sur `GenerateSession`, et adapter le libellé quand la vraie cible est `CycleModal`.
2. **Réordonner** : la séance prête d'aujourd'hui ne doit plus être effacée par la bascule récup.
3. **Feedback dû = action n°1** : supprimer la contradiction « Ma séance est prête » / « Dis-nous comment ça s'est passé ».
4. **Faire entrer le calendrier** dans la cascade : plus de CTA « prépare une séance » au-dessus d'un conseil qui dit de ne pas en faire.
5. **Dater les séances J+1** au lieu de les annoncer « prêtes ».
6. Remplacer l'`Alert.alert` à 3 boutons par le pattern inline de `SessionHubScreen` (convention `showToast`, et `Alert` est un no-op sur web).

**Risque** : moyen — c'est de la logique métier, bien couverte par les états de [`ETATS_HOME.md`](ETATS_HOME.md), qui servent de plan de test.

---

## Lot 5 — Répondre au « pourquoi » et à la reprise *(moyen)* — **P1**

Le lot qui apporte quelque chose de nouveau au joueur, plutôt que d'en retirer.

1. **Ligne « Pourquoi cette séance »** sous le CTA, alimentée par `sessionTheme` / `playerContext` / `rationale` — **déjà présents dans le payload**, aujourd'hui lus uniquement par `SessionPreviewScreen`. Rien à inventer, rien à demander au backend.
2. **Détection d'interruption** : une règle déterministe sur `daysSinceLastSession` → accueil de reprise, reprise progressive, et repère de cycle honnête (ne plus afficher « Montée en puissance » après 24 jours d'arrêt).
3. **Moment de la réussite** : à la place du bouton gris « Journée off », un accusé de réception de ce qui vient d'être fait et de son effet sur la semaine.
4. Afficher `weekSummary.message`, aujourd'hui calculé puis jeté.
5. Rebrancher l'objectif hebdo déclaré au setup et borner le compteur (« Semaine 3/2 » est visible sur les rendus).

**Risque** : faible. Aucune donnée nouvelle, aucun appel supplémentaire.

---

## Lot 6 — Dette relevée en chemin *(petit)* — **P2**

À traiter séparément, hors chemin critique :

- Routes mortes `ExternalLoad` et `Routine` : rebrancher ou retirer (le Home promet l'ajout d'activité externe dans un toast, vers une route injoignable).
- Les 6 conseils actionnables pointent tous vers `PrebuiltSessions` sans paramètre, avec 6 libellés différents.
- Numérotation du cycle divergente entre le Home (séance à venir) et l'onglet Séance (séances faites).
- Nettoyer `useWeekDays`, qui calcule 7 jours × 5 statuts pour ne servir que de fournisseur de clés de dates.
- Supprimer les composants legacy `HomeCycleHero`, `HomeDashboardCard`, `HomeReadinessCard`.
- Renommer `HomeCarouselCard` (il n'y a plus de carrousel) ; supprimer le commentaire mort `// Recommandations du coach`.
- Le disque décoratif de `HomeNextSessionCard` (`nextGlow`, 160 px, `rgba(20,20,20,0.04)`) présente une **couture verticale visible** et passe derrière le bouton « Historique ». Disparaît avec le lot 2.
- `SessionHubScreen` importe `Badge` sans l'utiliser.
- Le commentaire d'en-tête de `components/coach/coachUi.tsx` est périmé (il justifie sa palette locale par un thème joueur « dark » qui est clair depuis la refonte DA). Instruire la convergence des deux palettes — **hors périmètre de cet audit**.

---

## Ordre recommandé et dépendances

```
Lot 0 (vérifs téléphone)
   │
   ├──> Lot 1  Arrêter de mentir        P0   moyen      ← à faire en premier
   │
   ├──> Lot 2  Supprimer les doublons   P1   petit/moyen ← meilleur rapport effet/effort
   │       │
   │       └──> Lot 3  Socle & DA       P1/P2 moyen      (dépend de 2 : inutile de styler
   │                                                       des blocs qu'on va supprimer)
   ├──> Lot 4  Cascade du CTA           P1   moyen       (indépendant)
   │
   └──> Lot 5  Pourquoi + reprise       P1   moyen       (dépend de 1 pour la reprise)

Lot 6  Dette                            P2   petit       (à tout moment)
```

**Si un seul lot devait être fait** : le lot 2. Il retire un tiers de la hauteur de l'écran, supprime les trois redites, et ne demande aucune donnée nouvelle.

**Si deux** : lots 1 + 2. Ensemble, ils traitent les deux causes profondes — l'écran ne ment plus et ne se répète plus. Le reste est de la finition.

---

## Risques du plan

| Risque | Portée | Atténuation |
|---|---|---|
| Le lot 1 touche le moteur de charge | Le calcul ATL/CTL/TSB alimente aussi la génération et l'écran Progression | Le lot ne doit changer **que l'affichage**, jamais le calcul. Aucun seuil moteur ne bouge |
| La définition de « Série » diverge dans 3 écrans | Home, Progression, Profil comptent trois choses différentes sous des noms proches | Trancher la définition **avant** de coder, la documenter |
| Le lot 3 change beaucoup l'apparence d'un coup | Perception | Le livrer après le lot 2, et le valider au téléphone état par état |
| Supprimer la carte Prochaine séance retire une entrée vers l'aperçu | Un chemin de navigation disparaît | Conserver « Voir la séance » comme action secondaire sous le CTA |
| Retirer le conseil fourre-tout peut vider l'écran certains jours | Perception de « moins riche » | C'est l'objectif. Un écran qui ne dit rien quand il n'a rien à dire est plus crédible qu'un écran qui meuble |
| Le harnais de rendu n'est pas le téléphone | Toutes les mesures visuelles | Chaque lot se valide sur l'appareil de Kyllian avant commit |

---

## Contrôles de non-régression

- Les 18 états de [`ETATS_HOME.md`](ETATS_HOME.md) servent de plan de test manuel.
- Le harnais de rendu est reproductible : il vit dans le scratchpad, hors du dépôt, et régénère les 72 pages à la demande. Il peut être relancé après chaque lot pour comparer avant/après à largeur et état identiques.
- ⚠️ Rappel connu du projet : `npx jest` depuis un worktree liste **0 test** et sort en succès (`testPathIgnorePatterns` exclut `.claude/worktrees/`). Utiliser une configuration dédiée pour toute vérification de tests sur ces lots.
