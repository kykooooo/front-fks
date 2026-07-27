# États réels du Home Screen — inventaire

> Établi par lecture du code (`HomeScreen.tsx`, `hooks/home/*`, stores) puis **vérifié par rendu** dans un harnais local à données fictives. Captures : [`captures/`](captures/).

---

## Point de départ : la structure ne change jamais

| # | Bloc | Conditionnel ? |
|---|---|---|
| 1 | Header | non |
| 2 | CTA principal | non |
| 3 | Chip cycle | **oui** (`homeCyclePhase != null`) |
| 4 | Ligne stats | non (seule la colonne Match est conditionnelle) |
| 5 | Carte `TON ÉTAT` + courbe | non |
| 6 | Carte `Conseil du jour` | `advice &&` — mais la règle `ready_default` a `condition: () => true`, donc **jamais null** |
| 7 | Carte Progression | non |
| 8 | Carte Prochaine séance | non |
| 9 | Chip Mode test | **oui** (`DEV_FLAGS.ENABLED`, faux en prod) |

**Il n'existe aucun état où l'écran change de forme.** Seuls les textes changent. Les deux seules variations de mise en page sont la présence du chip cycle et de la colonne Match.

---

## La cascade du CTA

`hooks/home/usePrimaryCta.ts:201-244` — ordre de priorité réel :

| Ordre | Condition | Label | Sous-titre | Ton | Destination réelle |
|---|---|---|---|---|---|
| 1 | `tsb <= -15` | Journée récup | Ton corps a besoin de souffler. Fais une séance légère. | warn | `PrebuiltSessions` |
| 2 | `isPendingToday` | C'est parti ! | *titre de la séance* | primary | `SessionLive` |
| 3 | `pendingSession` (J-2, J-1 **ou J+1**) | Ma séance est prête | *titre de la séance* | primary | `SessionLive` |
| 4 | `hasAppliedToday` | Journée off | Tu as déjà fait ta séance aujourd'hui. | disabled | *aucune* |
| 5 | défaut | Préparer ma séance | On te prépare un programme adapté en 2 min. | primary | `SessionHubScreen` **ou** `CycleModal` |

**Trois défauts d'ordonnancement, tous confirmés :**

- La branche 1 **passe avant** la branche 2 : si une séance est prête pour aujourd'hui et que le TSB est bas, le CTA l'efface au profit de « Journée récup » — pendant que la carte du bas continue d'afficher « Prête à être lancée ».
- La branche 3 englobe **J+1** : une séance planifiée pour demain s'annonce « prête », sans que rien ne dise qu'elle est pour demain.
- La cascade ne connaît **ni le calendrier** (match / club), **ni le réseau**, **ni l'hydratation**, **ni la fin de cycle**, **ni le retard de feedback**.

---

## Les 18 états

### E1 — Nouveau joueur *(P0)*
📷 [`nouveau-joueur-375.png`](captures/nouveau-joueur-375.png)

- **Conditions** : `sessions=[]`, `microcycleGoal=null` → `atl=12`, `ctl=15`, **`tsb=+3`**.
- **Affiche** : « En forme » (vert) ×2, courbe 7 j **entièrement fabriquée**, « Semaine 0/2 », « Série Nouvelle », conseil **« Mobilité oubliée »**, carte Prochaine séance « Pas de séance prévue » + doublon du CTA.
- **CTA** : « Préparer ma séance » → ouvre en réalité **`CycleModal`**, pas la génération.
- **Ce que le joueur comprend en 10 s** : *« je suis en forme, l'app a déjà mesuré quelque chose, et mon premier reproche c'est la mobilité. »*
- **Défauts** : état de forme et courbe affirmés sans aucune donnée ; le premier message est un reproche ; le sous-titre du CTA décrit une génération qui n'aura pas lieu.
- **Atteignable** : oui — c'est le premier écran après le setup.

### E2 — Séance prévue aujourd'hui *(le meilleur état)*
📷 [`seance-prevue-aujourdhui-375.png`](captures/seance-prevue-aujourdhui-375.png)

- **Conditions** : `pendingSession` daté d'aujourd'hui, `tsb > -15`.
- **CTA** : « C'est parti ! » + titre de séance → **`SessionLive` directement** (sans aperçu).
- **Carte du bas** : badge « Prête », même titre de séance, « Voir la séance » → `SessionPreview`.
- **Défauts** : le titre de séance est écrit **deux fois** ; deux entrées différentes (live vs aperçu) sans que la différence soit dite ; l'état du jour est répété 3 fois — sur la capture, la phrase « *Un peu chargé* » et la phrase « *Adapte l'intensité* » apparaissent littéralement deux fois.

### E3 — Séance terminée aujourd'hui *(l'état mort)*
📷 [`seance-terminee-375.png`](captures/seance-terminee-375.png)

- **Conditions** : `hasAppliedToday`, plus de `pendingSession`.
- **CTA** : « Journée off » — **rectangle gris désactivé**, `onPress: undefined`.
- **Carte du bas** : badge « À créer », « Pas de séance prévue », bouton primaire **désactivé** portant le même label.
- **Défauts** : deux boutons morts, aucune reconnaissance de ce qui vient d'être accompli, aucune action restante au-dessus de la ligne de flottaison. Le toast prévu (« ajoute une activité externe ») pointe vers `ExternalLoad`, une route **injoignable** — et il est de toute façon inatteignable puisque le bouton est désactivé.

### E4 — Jour de récupération conseillé
📷 [`recuperation-375.png`](captures/recuperation-375.png)

- **Conditions** : `tsb <= -15`.
- **Affiche** : « À alléger » ×2, conseil « Journée légère » (ton danger, **rouge**), CTA « Journée récup » (**ambre**), bouton « Routine récupération » (**rouge plein**), carte du bas « Journée récup → » (**contour bleu**).
- **Défauts** : le même message écrit **4 fois** ; **3 boutons vers la même destination** `PrebuiltSessions` dans 3 couleurs ; l'écran est le plus criard le jour où le joueur est le plus fatigué. Et si une séance était prête pour aujourd'hui, la carte du bas continue d'afficher « Prête à être lancée » — contradiction directe.
- **Bonus visible sur la capture** : « **Semaine 3/2** ». Le compteur n'est pas borné à l'objectif.

### E5 — Feedback en retard *(le plus fréquent chez un amateur)*
📷 [`feedback-en-retard-375.png`](captures/feedback-en-retard-375.png)

- **Conditions** : `pendingSession` dans la fenêtre J-2..J+1 avec `pendingDateKey < todayKey`.
- **CTA** : « **Ma séance est prête** » → lance `SessionLive` avec une date **passée**.
- **Carte du bas** : « Séance en attente. Dis-nous comment ça s'est passé pour débloquer la suivante. »
- **Défauts** : (a) **contradiction frontale** — le haut dit « vas-y », le bas dit « raconte-moi » ; (b) si le joueur lance, la charge est imputée au jour passé et il pourra en refaire une le jour même ; (c) s'il tente de générer ailleurs, une `Alert.alert` l'oblige à valider d'abord — alors que la convention projet impose `showToast()`.

### E5b — Séance zombie (> J-2)

- **Conditions** : séance non validée hors fenêtre → écartée par `selectPendingSession`.
- **Affiche** : le Home redevient **exactement** celui d'un nouveau joueur.
- **Défaut** : zéro trace de l'interruption.

### E5c — Séance planifiée pour DEMAIN

- **Conditions** : `pendingSession` daté J+1.
- **CTA** : « Ma séance est prête » → la lance **aujourd'hui**, la charge se pose sur demain, `hasAppliedToday` reste faux.
- **Défaut** : rien ne dit qu'elle est pour demain. « Prête » fait croire « maintenant ».

### E6 — Reprise après interruption longue *(P0 produit)*
📷 [`reprise-apres-interruption-375.png`](captures/reprise-apres-interruption-375.png)

- **Conditions** : dernière séance il y a 24 jours, charges retombées, cycle figé à 5/12.
- **Affiche** : « **Frais — Bien reposé, comme après une coupure.** », courbe **parfaitement plate**, chip « **Séance 5/12 · Montée en puissance** », conseil « Mobilité oubliée — 23 jours sans mobilité ».
- **Défauts** : aucune détection d'interruption ; le trou de 24 jours est invisible ; la phase de cycle affirme une montée en charge qui n'a pas eu lieu ; aucune proposition de reprise progressive.

### E7 — Progression disponible

- **Affiche** : « Série N j » **et** « N jours d'affilée » — même variable, ~30 lignes d'écart, aucune information supplémentaire.
- **Défaut** : doublon pur, et la valeur peut être composée à 100 % de charges club/match auto-injectées.

### E8 — Progression indisponible
📷 [`progression-indisponible-375.png`](captures/progression-indisponible-375.png)

- **Affiche** : « Série Nouvelle » + « Lance ta première séance » + le lien « Voir ma progression » **toujours actif** → `ProgressScreen` avec ses 6 accomplissements tous verrouillés.
- **Défaut** : **il n'existe pas d'état « progression indisponible »**. Rien n'est masqué, rien n'est adapté — le lien mène juste à un écran vide de sens.

### E9 — Hors-ligne
📷 [`hors-ligne-erreur-375.png`](captures/hors-ligne-erreur-375.png)

- **Conditions** : `NetInfo` détecte la perte. **Le Home lui-même ne lit jamais le réseau.**
- **Affiche** : la bannière **globale** (montée dans `App.tsx`, pas dans le Home) « Hors-ligne — synchronisation au retour », superposée en absolu — elle **recouvre le header** « Salut, X » + date + chip état.
- **CTA** : inchangé, plein tarif → la génération appellera le backend et échouera plus loin.
- **Défaut** : aucune dégradation honnête, aucun « chiffres peut-être désynchronisés », et perte visuelle du header.

### E10 — Chargement
📷 [`chargement-375.png`](captures/chargement-375.png)

- **Conditions** : `storeHydrated === false` — passe à vrai quand les 6 stores ont répondu, ou après un filet de sécurité de **10 s**.
- **Affiche** : **l'écran complet avec les valeurs d'usine** — « En forme » vert, courbe fabriquée, « Semaine 0/2 », « Série Nouvelle ».
- **Défaut** : c'est l'état « le Home ment » le plus pur. Un joueur en surcharge peut lire « En forme, c'est le moment d'envoyer » puis voir l'écran basculer en « Charge haute ». **Il n'existe aucune branche de chargement** : `storeHydrated` ne pilote que le watcher Firestore.
- **Atteignable** : oui, **à chaque ouverture de l'app**.

### E11 — Contenu très long
📷 [`contenu-tres-long-320.png`](captures/contenu-tres-long-320.png)

| Élément | Borné ? |
|---|---|
| Prénom | oui (`numberOfLines={1}`) — tronque à « Salut, Jean-Ba… » |
| Chip état | oui + `maxWidth: 150` |
| Chip cycle | oui — tronque « Montée en puissan… » |
| **Sous-titre du CTA** | **NON** — 3 lignes, le bouton grandit et pousse tout l'écran |
| **Titre de la carte Prochaine séance** | **NON** — la **même chaîne de 3 lignes** s'affiche deux fois sur l'écran |
| Bouton « Voir la séance » à 320 px | **déborde visiblement de sa pilule** (`width: 140` fixe sur le secondaire) |

### E12 — Match imminent
📷 [`match-imminent-375.png`](captures/match-imminent-375.png)

- **Affiche** : colonne « Match : Proche » en orange, **sans date**, non cliquable. Conseil « Jour de match — Pas de séance FKS aujourd'hui » ou « Match demain ».
- **CTA** : **inchangé** → « Préparer ma séance » ou « C'est parti ! ». **Contradiction directe** avec le conseil, et le CTA est au-dessus, plus gros, en orange, avec une animation de pulsation.
- **Note** : `matchDays` étant des **jours de semaine récurrents** issus du profil, pas des matchs réels, cet état revient chaque semaine à vie.

### E13 — Jour d'entraînement club

- **Affiche** : conseil « Entraînement club — garde-la courte et légère ».
- **CTA** : inchangé (aucune notion de club). Même contradiction que E12, en plus doux.

### E14 — Cycle actif, phase visible

- **Affiche** : chip cliquable « Séance N/12 · Fondations | Montée en puissance | Pic de forme | Relâche » → `CycleModal`.
- **Bon point** : phase dérivée proprement, jamais le champ interne « Playlist ».

### E15 — Cycle terminé (12/12)
📷 [`cycle-termine-375.png`](captures/cycle-termine-375.png)

- **Affiche** : le chip cycle **disparaît**. Le Home devient identique à E1.
- **Défaut** : aucun signal de fin de cycle, aucune reconnaissance des 12 séances, et un sous-titre qui décrit une génération qui n'aura pas lieu (le tap ouvre `CycleModal`).

### E16 — Séance en attente sans contenu

- **Conditions** : document planifié Firestore sans champ `ai`.
- **Comportement** : repli sur `lastAiSessionV2?.v2` → **le joueur lance le contenu d'une AUTRE séance** sous le titre de celle-ci. Si le repli est vide : toast « Séance indisponible… Relance une génération » — or relancer est bloqué par l'`Alert` de feedback tant que la séance est en attente. **Cul-de-sac de 3 jours.**
- **Atteignable** : probable — dépend des documents Firestore réels, non vérifiable ici (accès production interdit).

### E17 — Directive club active / E18 — Aucun suivi club

Recherche `club|coach|directive|clubId|membership` dans `HomeScreen.tsx` : **4 occurrences**, dont un commentaire mort `// Recommandations du coach`.

**Le Home joueur n'affiche rien d'un club ni d'un coach.** Le `weekContext` écrit par le coach est lu uniquement dans `services/aiContext.ts` pour le payload backend, et affiché uniquement dans `CoachHomeScreen`.

- **Conforme à la doctrine** : le Home ne dépend pas d'un suivi club. À préserver.
- **Contrepartie** : un joueur affilié voit exactement le même écran qu'un joueur solo, et son activité club n'apparaît dans aucun compteur visible (« Semaine 0/2 »).
- **Seule différence visible entre E17 et E18** : la disparition de la colonne « Match ».
- **Données calculées puis jetées** : `useWeekDays` calcule `hasFks/hasExt/hasClub/hasMatch/hasPlanned` pour 7 jours, mais ne sert plus qu'à fournir des clés de dates. `weekSummary.message` (« *Encore 2 séances pour atteindre ton objectif* ») et `weekSummary.extCount` sont **calculés et jamais affichés** — une phrase actionnable est jetée au profit d'un « 1/2 » décoratif.

### E-NA — « Repos programmé » *(non atteignable)*

`nextAllowedDateISO` / `restUntil` existent encore dans le store mais **plus aucun déclencheur UI** ; la migration v2 purge même les verrous hérités. Code mort assumé et commenté.

---

## Récapitulatif transversal

| Symptôme | États concernés |
|---|---|
| **Chiffre par défaut présenté comme mesure** | E1, E10, + charges club auto sur **tous** les états |
| **Deux blocs qui se contredisent** | E5 (CTA vs feedback), E4 + séance prête, E12 / E13 (CTA vs conseil) |
| **Deux blocs qui disent la même chose** | E7 (série ×2), E1 / E3 (CTA dupliqué), E4 (4 redites, 3 boutons identiques), E2 (titre de séance ×2) |
| **Aucune action claire** | E3 (0 action), E16 (cul-de-sac) |
| **Reprise après interruption non gérée** | E5b, E6, E15 |
| **Écran quasi vide** | **aucun** — la structure ne change jamais, seuls les textes changent |

## États demandés mais non produisibles — dit plutôt que maquillé

- **« Progression indisponible » avec historique court** : inatteignable. `useLoadSeries` renvoie **toujours** 7 points. L'état a été rendu autrement (charges journalières quasi vides → courbe presque plate).
- **« Label de CTA long » et « libellé de phase long »** : impossibles à produire — ces chaînes sont **en dur dans le code produit**, pas pilotées par la donnée. Seuls le prénom, le sous-titre du CTA et la zone de gêne du conseil ont pu être rallongés.
- **« Cycle terminé » avec CTA invitant à choisir un nouveau cycle** : le code réel garde le libellé « Préparer ma séance » et ne change que la cible du `onPress`. Rendu tel quel — c'est un constat d'audit, pas un raté du harnais.
- **Thème sombre, mode paysage, largeurs tablette au-delà de 430 px** : non couverts.
