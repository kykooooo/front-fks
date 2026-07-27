# Audit du Home Screen joueur — juillet 2026

> **Aucun fichier produit n'a été modifié par cet audit.** Seul ce dossier `docs/home-audit-2026-07/` a été créé.
> Aucun appel LLM payant, aucune génération de séance, aucun accès à la base de production.

Commit audité : `724c062` (identique à `main` au moment de l'audit).

---

## 0. Méthode

Trois sources indépendantes, croisées :

1. **Lecture du code réel** — `screens/HomeScreen.tsx`, ses 5 composants, ses 7 hooks, les 6 stores qu'il lit, la navigation, le design system, et les écrans de référence (Coach, SessionLive, Progression, SessionPreview, RoutineScreen, SessionHub).
2. **Vérification adversariale** — les constats à risque ont été renvoyés à des relecteurs chargés de les *réfuter* en rouvrant les fichiers. Résultat : 140 constats retenus, 4 en P0, 31 en P1. Une prémisse de l'audit (« le dernier bloc est écrasé par la tab bar ») a été **réfutée** par cette passe et corrigée — voir §7.3.
3. **Rendu visuel réel** — un harnais jetable (react-native-web + jsdom, dans le scratchpad, jamais dans le dépôt) monte le **vrai** `HomeScreen` avec les vrais composants, le vrai thème et le vrai domaine, en ne bouchonnant que les stores, la navigation et les SDK natifs. 72 pages ont été générées : 12 états × 4 largeurs (320 / 375 / 390 / 430) + 12 variantes à texte agrandi. Les captures sont dans [`captures/`](captures/).

**Données 100 % fictives**, marquées comme telles sur chaque rendu. Aucune lecture Firestore, aucun appel backend.

**Limites assumées du harnais** (à ne pas confondre avec des défauts produit) : les icônes Ionicons sont rendues en carrés gris de la bonne taille (métrique fidèle, dessin non fidèle) ; la police est Segoe UI et non SF Pro, donc les points de retour à la ligne sont indicatifs à quelques pourcents ; le texte ×1.3 est une simulation CSS, pas le vrai Dynamic Type iOS ; aucun scroll réel, aucune animation, aucun geste. Les **couleurs et les espacements, eux, sont exacts** (ils viennent de `constants/theme.ts`). La liste complète des limites est conservée dans le rapport du harnais.

---

## 1. Le rôle du Home : ce qu'il devrait être

### 1.1 La promesse, en une phrase

> **« Voilà où tu en es, voilà ce que tu fais aujourd'hui, et voilà pourquoi. »**

Le Home n'est ni un tableau de bord ni une page d'accueil. C'est **le point de reprise du programme**. Un joueur amateur ouvre FKS entre deux entraînements club, souvent debout, souvent moins de dix secondes, souvent après plusieurs jours d'absence. Il ne vient pas consulter des métriques : il vient savoir **quoi faire maintenant**, et être rassuré sur le fait que quelqu'un suit son fil.

### 1.2 Les sept questions du joueur — réponse actuelle

| # | Question | Le Home y répond ? | Preuve |
|---|---|---|---|
| 1 | Où j'en suis ? | **Partiellement** | `Séance N/12 · phase` est juste, mais l'état du jour est fabriqué (§3.1) |
| 2 | Quoi faire aujourd'hui ? | **Oui** | Le CTA est en position 2, à 65 px du haut — le meilleur point de l'écran |
| 3 | Quelle est ma prochaine séance ? | **Oui, deux fois** | Sous-titre du CTA + carte du bas, texte identique |
| 4 | **Pourquoi celle-ci ?** | **NON** | Zéro mot d'explication. `sessionTheme`, `coachingTips`, `playerContext` existent dans le payload mais ne sont lus que par `SessionPreviewScreen` |
| 5 | Faut-il récupérer ? | **Oui, quatre fois** | Chip + CTA + hero + conseil disent la même chose (voir capture `recuperation-375.png`) |
| 6 | Comment ma progression évolue ? | **Non** | Une courbe illisible et un lien. Rien qui montre une évolution |
| 7 | **Comment reprendre après une interruption ?** | **NON** | Après 24 jours d'arrêt, le Home affiche « Frais — bien reposé » et un cycle figé sur « Montée en puissance » (§4) |

Les deux questions auxquelles le Home ne répond pas — **« pourquoi cette séance »** et **« comment je reprends »** — sont précisément les deux qui justifient qu'une app de prépa pilotée par IA existe. Ce sont aussi les deux qui manquent le plus à un amateur sans staff.

---

## 2. Cartographie de l'existant

### 2.1 Les 9 blocs, dans l'ordre de rendu

| # | Bloc | Objectif | Source | Action | Priorité joueur | Hauteur | Si la donnée manque |
|---|---|---|---|---|---|---|---|
| 1 | Header `Salut, X` + date + chip état | Accueil + état | `auth.currentUser`, `getFootballLabel(tsb)` | aucune | 2/5 | ~45 px | affiche « joueur » et un état fabriqué |
| 2 | **CTA principal** | Action n°1 | `usePrimaryCta` | variable | **5/5** | ~70 px | jamais vide (branche par défaut) |
| 3 | Chip cycle `Séance N/12 · phase` | Repère de parcours | `microcycleSessionIndex` | → CycleModal | 4/5 | 36 px | **disparaît** (pas de cycle, ou cycle fini) |
| 4 | Ligne stats Semaine / Série / Match | Régularité | `useWeekSummary`, `useActivityStreak`, `useMatchSoon` | aucune | 2/5 | 57 px | affiche `0/2` et `Nouvelle` |
| 5 | Carte `TON ÉTAT` + courbe 7 j | État + tendance | `tsb`, `useLoadSeries` | aucune | 2/5 | ~223 px | **trace 7 points quand même** |
| 6 | Carte `Conseil du jour` | Guider | `useContextualAdvice` (14 règles) | parfois | 3/5 | 131→291 px | **jamais vide** (règle fourre-tout) |
| 7 | Carte `Progression` | Teaser | `activityStreak` | → Progression | 1/5 | 134 px | « Lance ta première séance » |
| 8 | Carte `Prochaine séance` | Redite du CTA | `usePrimaryCta` (mêmes champs) | doublon | 1/5 | 162 px | « Pas de séance prévue » |
| 9 | Chip `Mode test` | Debug | `DEV_FLAGS` | injecte des charges | — | 27 px | invisible en prod |

**Total ≈ 1086 px** de contenu, pour une fenêtre de défilement utile de **676 px** sur iPhone 15.

### 2.2 Ce que le joueur voit sans défiler

Mesuré sur les rendus, écran 812 px :

- **Visible** : header, CTA, chip cycle, ligne stats, carte `TON ÉTAT` en entier, et le **haut** de la carte Conseil.
- **Invisible** : le bouton d'action du conseil, la carte Progression, la carte Prochaine séance — soit **les deux seules cartes actionnables du bas**.

Sur un écran 667 px (iPhone SE), la ligne de flottaison coupe déjà **au milieu de la carte Conseil**.

### 2.3 Blocs sans aucune action

Sur les 8 blocs visibles en production, **4 n'offrent aucune action** : le header, la ligne de stats, la carte `TON ÉTAT` (aucun `Touchable` dans tout le composant), et la carte Conseil dans 7 de ses 13 règles — dont les deux règles de repli les plus fréquentes, qui sont justement celles qui répètent l'état du jour.

---

## 3. Les causes réelles

### 3.1 Cause n°1 — Le Home affirme des choses qu'il ne sait pas *(P0)*

C'est la cause la plus grave, et elle est invisible à l'œil : elle ne se voit qu'en remontant la donnée.

`config/trainingDefaults.ts` initialise `CTL0 = 15` et `ATL0 = 12`. Donc **TSB de départ = +3**, ce qui tombe dans la zone `OPTIMAL`.

Conséquence, sur un compte neuf, 0 séance — capture [`nouveau-joueur-375.png`](captures/nouveau-joueur-375.png) :

- chip header : **« En forme »**, pastille verte ;
- carte `TON ÉTAT` : **« En forme — Prêt à performer, c'est le moment d'envoyer. »** ;
- courbe **« Ta forme sur 7 jours »** : une ligne verte parfaitement plate, **7 points entièrement fabriqués** ;
- carte Conseil : la règle qui gagne est `no_mobility` → **« Mobilité oubliée — Jamais fait de mobilité ? Tes articulations te remercieront. »**

Le tout premier message de FKS à un nouvel utilisateur est donc : *une mesure qui n'existe pas, un graphique de rien, et un reproche.*

Trois aggravations :

- **La courbe et le libellé au-dessus ne viennent pas du même calcul.** [`useLoadSeries.ts`](hooks/home/useLoadSeries.ts) resème `ATL0/CTL0` à J-28 à chaque rendu, alors que le chiffre du header vient de `rebuildLoad` qui resème au premier jour d'activité réel. Les deux peuvent se contredire dans la même carte.
- **La « Série » et l'état intègrent des charges que le joueur n'a jamais confirmées.** `applyAutoExternalLoads` injecte automatiquement des charges club/match à partir des seules cases cochées au setup profil. Un joueur qui a coché mardi/jeudi club + samedi match, **sans une seule séance FKS**, peut voir « Série 5 j » et une flamme « 5 jours d'affilée ».
- **Il n'existe aucune branche de chargement.** `storeHydrated` est lu mais ne pilote que le déclenchement du watcher Firestore. À chaque ouverture, le Home affiche l'écran complet avec les valeurs d'usine — un joueur en surcharge peut lire « En forme, c'est le moment d'envoyer » pendant une seconde, puis voir l'écran basculer en « Charge haute ».

> Doctrine maison : *une affirmation non prouvée est un bug*. Ici, quatre affirmations non prouvées occupent le tiers de l'écran.

### 3.2 Cause n°2 — La moitié basse est une répétition de la moitié haute

C'est le motif que l'on ressent sans savoir le nommer. Sur chaque état rendu :

| Information | Nombre d'occurrences | Où |
|---|---|---|
| **État du jour** | **3** | chip header + titre de `TON ÉTAT` + titre du Conseil — souvent **mot pour mot** |
| **Série** | **2** | ligne stats « Série » + carte Progression « N jours d'affilée » (même variable, 30 lignes d'écart) |
| **Action / prochaine séance** | **2 à 3** | CTA + carte Prochaine séance + alerte de l'onglet Séance |

Le cas du CTA est le plus net. Sans séance en attente, la comparaison ligne à ligne donne :

| propriété | `HomePrimaryCTA` | bouton primaire de `HomeNextSessionCard` | identique ? |
|---|---|---|---|
| label | `primaryCta.label` | `pendingSession ? "Voir la séance" : primaryCta.label` | **oui** |
| onPress | `primaryCta.onPress` | `pendingSession ? viewPendingSession : primaryCta.onPress` | **oui** |
| disabled | `primaryCta.disabled` | `!pendingSession && primaryCta.disabled` | **oui** |

C'est **littéralement le même bouton rendu deux fois**, à 900 px d'écart.

Le pire cas est l'état « récupération » — capture [`recuperation-375.png`](captures/recuperation-375.png) : le même message est écrit **4 fois** (chip, CTA, hero, conseil) et **3 boutons mènent à la même destination** `PrebuiltSessions`, dans **3 couleurs différentes** (ambre, rouge, contour bleu).

### 3.3 Cause n°3 — La hiérarchie visuelle est inversée

Visible immédiatement sur n'importe quelle capture :

- La carte `TON ÉTAT` — **passive, sans action** — est en **blanc pur** (`Card variant="surface"`), avec le plus grand rayon de l'écran (26 px) et la plus grande hauteur (223 px). Elle attire l'œil.
- Les cartes **Progression** et **Prochaine séance** — les deux seules actionnables du bas — sont en `cardSoft` `#F1F4F8` **sur un fond** `#F5F7FA`. Écart de 4/3/2 par canal : **elles se fondent dans l'arrière-plan.**

Le bloc le plus visible est celui qui ne sert à rien ; les blocs actionnables sont les plus discrets et sous la ligne de flottaison.

Même inversion à l'intérieur de la carte du bas : le bouton primaire « Voir la séance » est un **contour** transparent, le bouton secondaire « Historique » est **plein blanc** — le secondaire pèse plus lourd que le primaire.

Et sur les états à conseil actionnable, le bouton du conseil (`Flow Mobilité`, `Routine récup`) est un **aplat pleine largeur saturé** — le deuxième élément le plus fort de l'écran, pour une suggestion secondaire, en concurrence directe avec le CTA orange.

### 3.4 Cause n°4 — Le Home est le seul écran resté hors du socle

C'est la cause du « ça ne fait pas la même app ».

| Point | Home | Écrans récents |
|---|---|---|
| `<Screen>` (règle d'or, safe area) | **non** — `SafeAreaView` brut ([`HomeScreen.tsx:238`](screens/HomeScreen.tsx#L238)) | oui : ProgressScreen, RoutineScreen, SessionLive, TestsScreen… (11 écrans) |
| `components/ui/Button` | **0 usage** — 10 `TouchableOpacity` maison | utilisé partout |
| `theme.radius` | **0 usage** — 7 rayons en littéraux : 26, 22, 20, 16, 14, 12, 999 | ProgressScreen : 24 partout ; espace Coach : `coachRadius = {card:10, chip:8, pill:999}` |
| `theme.spacing` | **0 usage** | — |
| `theme.typography` | **0 usage** — *et 0 dans tout le dépôt* | — |
| `SectionHeader` | 1 usage (dans une sous-carte) | systématique |
| Palettes en présence | **4** : `theme.colors`, `FOOTBALL_LABELS` (Tailwind), tons de `HomeAdviceCard` (encore une autre), littéraux rgba | `theme.colors` + `cycleTheme` |
| États vides conçus | **0** | 4 sur les écrans Coach |
| `numberOfLines` sur contenu backend | **2 manquants** | appliqué (`CategoryTile`, `HeroCard`) |

Deux valeurs sont **hors de l'échelle du thème** : les rayons 22 (CTA) et 26 (hero) n'existent pas dans `theme.radius`. Et `fontSize: 12.5` est une valeur non entière unique au Home.

L'espace Coach paraît plus abouti pour une raison simple et vérifiable : il s'est doté d'un jeu de tokens nommés (`coachRadius`, `coachColors`) et l'applique **uniformément**. Le Home, lui, pose 21 couples fontSize/fontWeight distincts et 7 rayons à la main.

> À noter : le commentaire d'en-tête de `components/coach/coachUi.tsx` justifie sa palette locale par « le thème global (dark) qui sert les écrans joueur ». Ce commentaire est **périmé** — le thème joueur est clair depuis la refonte DA, et les deux palettes partagent déjà exactement le même accent `#2A4D8F`. Il y a là une convergence à instruire, hors périmètre de cet audit.

### 3.5 Cause n°5 — Le CTA principal ment sur sa destination

`usePrimaryCta.ts:186` fait `nav.navigate("NewSession")`. Ce nom est celui de **l'onglet**, pas de l'écran de génération. L'onglet `NewSession` rend `SessionHubScreen`, c'est-à-dire **un menu de 4 tuiles**.

Donc « **Préparer ma séance — On te prépare un programme adapté en 2 min.** » ouvre un menu où il faut encore choisir « Créer une séance ». Le sous-titre décrit une génération qui ne démarre pas.

Et sur un compte neuf ou un cycle terminé, le même bouton avec le même sous-titre ouvre en réalité **`CycleModal`** (choix de cycle). Trois destinations différentes derrière un libellé et un sous-titre qui n'en décrivent qu'une.

---

## 4. Le cas critique : la reprise après interruption

Capture [`reprise-apres-interruption-375.png`](captures/reprise-apres-interruption-375.png) — joueur revenu après **24 jours** sans rien.

Ce que le Home affiche :

- chip et hero : **« Frais — Bien reposé, comme après une coupure. »**
- courbe : une ligne **parfaitement plate**. Les 24 jours de trou sont invisibles.
- chip cycle : **« Séance 5/12 · Montée en puissance »** — le cycle est figé où il était il y a 24 jours, et la phase affirme une montée en charge qui n'a pas eu lieu.
- conseil : « Mobilité oubliée — 23 jours sans mobilité. »
- CTA : « Préparer ma séance ».

Nulle part le Home ne dit *« ça fait 24 jours »*, ne propose de reprendre en douceur, ni n'ajuste le repère de cycle. C'est l'état le plus fréquent chez un amateur, et c'est le moins bien traité de l'écran.

Variante voisine — la **séance zombie** : une séance non validée au-delà de J-2 est écartée par `selectPendingSession`, et le Home redevient **exactement** celui d'un nouveau joueur. Zéro trace de l'interruption.

---

## 5. Le moment de la réussite n'est pas récompensé

Capture [`seance-terminee-375.png`](captures/seance-terminee-375.png) — le joueur vient de finir sa séance et son feedback.

- Le CTA — l'emplacement le plus précieux de l'écran — devient un **rectangle gris désactivé** : « Journée off / Tu as déjà fait ta séance aujourd'hui. »
- La carte du bas répète ce bouton gris désactivé.
- Rien ne mentionne ce qui vient d'être accompli. Seul le chip cycle est passé de 4/12 à 5/12.
- Le seul bouton fort restant est celui du conseil (« Routine récup ») — sous la ligne de flottaison.

Le jour où le joueur a fait ce qu'on lui demandait, l'écran s'éteint.

*(À signaler comme dette, hors périmètre : le toast associé promet « ajoute une activité externe », or la route `ExternalLoad` n'est appelée depuis nulle part dans le dépôt — l'écran existe mais est injoignable. Idem pour `Routine`.)*

---

## 6. Audit produit — notes

| Axe | Note | Justification |
|---|---|---|
| Clarté en moins de 10 s | 6/10 | Le haut est bon ; l'œil est ensuite noyé par 3 redites |
| Action principale évidente | 7/10 | Bien placée et bien contrastée en forme… mais elle n'ouvre pas ce qu'elle annonce |
| Motivation sans infantilisation | 4/10 | Premier message = un reproche sur la mobilité ; flamme + série + « Bonne semaine ! » |
| Utilité pour un amateur autonome | 5/10 | Il obtient une séance, mais aucune explication ni aide à la reprise |
| Utilité pour un semi-pro | 3/10 | Aucune donnée qu'il ne connaît pas déjà mieux que l'app |
| Crédibilité sportive | 4/10 | Une courbe graduée « 0 / -10 » sans unité ni légende décrédibilise le reste |
| Sentiment de suivi réel | 3/10 | Le Home ne montre jamais qu'il a **lu** ce que le joueur a fait |
| Personnalisation honnête | **2/10** | Valeurs d'usine et charges auto présentées comme des mesures |
| Charge mentale | 5/10 | 8 blocs, 3 redites, 4 sans action |
| Reprise après 2-3 semaines | **1/10** | Aucune détection d'interruption |
| Absence de faux chiffres | **2/10** | Voir §3.1 |
| Cohérence prescription → exécution → feedback → adaptation | 4/10 | Le « pourquoi » manque au départ, le « bravo » manque à l'arrivée |
| Cohérence sans club | **8/10** | Bon point réel : le Home ne dépend d'aucun suivi club |

### Gamification : ce qu'il faut retirer, ce qu'il faut garder

- **À retirer** : la flamme + « N jours d'affilée » de la carte Progression (doublon pur de la ligne de stats, et la valeur peut être composée à 100 % de charges auto non confirmées).
- **À garder** : le compteur `Séance N/12 · phase`. Ce n'est pas de la gamification — c'est un repère de programme, il est calculé proprement (`getMicrocyclePhase`, jamais le champ interne « Playlist »), et c'est le seul bloc du haut à la fois informatif **et** tapable.
- **Ne pas ajouter** de badges ni de scores. L'écran n'a pas besoin d'être rempli, il a besoin d'être vidé.

---

## 7. Accessibilité et ergonomie

### 7.1 Bloquants

1. **Contraste du CTA principal : 2.88:1.** Blanc sur `#F2741B`, label 16 px/900. Seuil requis : 4.5:1. Le sous-titre (`rgba(255,255,255,0.9)`) tombe à **2.60:1**. C'est le bouton n°1 de l'application.
2. **CTA « Journée récup » : 2.65:1.** L'écran est le moins lisible le jour où le joueur est le plus fatigué.
3. **Zéro propriété d'accessibilité sur tout le Home.** Aucun `accessibilityRole`, `accessibilityLabel`, `accessibilityHint`, `accessibilityState` dans `HomeScreen.tsx` ni dans aucun des 5 composants `components/home/`. Les 7 éléments interactifs sont muets ; le bouton désactivé n'annonce pas son état ; les 3 colonnes de stats sont lues comme 6 nœuds séparés ; le SVG n'a aucune description.

### 7.2 Importants

- **8 zones tactiles sur 8 sont sous 44 pt**, sauf le CTA (68 px) : chip cycle 36-38, lien Progression 26-31, bouton primaire de la carte séance 36-41, « Historique » 35-40, chip feedback **24-28**. Aucun `hitSlop` sur l'écran. Cause racine : `components/ui/Button.tsx` impose `minHeight 48/52/56` — et n'est importé par **aucun** fichier du Home.
- **Texte agrandi (×1.3)** : le chip d'état tronque en « Un peu cha… » — l'information n°1 du header devient illisible (`maxWidth: 150` + `numberOfLines={1}`). Le chip cycle tronque en « Montée en puissan… ». Le bouton « Voir la séance » déborde de sa pilule.
- **320 px** : « Voir la séance » passe sur 2 lignes et **déborde visiblement de son contour**, parce que le bouton secondaire a une `width: 140` fixe qui écrase le primaire.
- **Contenu backend non borné** : `subLabel` du CTA et `upcomingLabel` de la carte n'ont pas de `numberOfLines`. Avec un titre de séance long, le CTA prend 3 lignes et pousse tout l'écran — et la **même chaîne de 3 lignes est affichée deux fois** sur le même écran (visible sur [`contenu-tres-long-320.png`](captures/contenu-tres-long-320.png)).
- **Ratios sous le seuil sur la carte Conseil** : ton `warn` 2.76:1, ton `success` 2.88:1, micro-tip `warn` **2.46:1**, et les repères « 0 » / « -10 » de la courbe à **2.15:1** — le pire ratio de l'écran.

### 7.3 Le bas de l'écran — un désaccord entre méthodes, tranché

C'est le seul point où les trois sources de l'audit se sont contredites. Il est rapporté tel quel plutôt qu'arbitré en silence.

- **Les trois lectures visuelles** rapportent, chacune indépendamment et en P0 : *« la dernière rangée de boutons est coupée par la tab bar en fin de défilement »*, avec des mesures DOM concordantes (18 à 33 px masqués selon l'état).
- **La lecture du code** conclut l'inverse : pas de masquage, mais un **excès** de 70 px de vide.

**Arbitrage, par lecture de la bibliothèque** (`@react-navigation/bottom-tabs@7.8.6`) :

1. `BottomTabView` rend le conteneur d'écrans avec `styles.screens = { flex: 1 }` et la tab bar comme **frère suivant** dans une colonne flex. Le contenu est donc au-dessus de la barre, jamais derrière.
2. `BottomTabView` **ne fournit pas** de `SafeAreaInsetsContext.Provider` modifié aux écrans — il ne fait que *consommer* le contexte pour la barre elle-même. `SafeAreaProviderCompat` ne crée pas de provider imbriqué quand il en existe déjà un, et `App.tsx` en fournit un.
3. Donc le `SafeAreaView` du Home lit les insets **racine** et applique bien `paddingBottom: 34`.

**Conclusion** : `24 (paddingBottom) + 12 (bottomSpacer) + 34 (inset) = 70 px de vide` sous la dernière carte, et **34 px de fenêtre de défilement perdus en permanence** (~4 % de la hauteur écran). **Pas de masquage.**

**Pourquoi les rendus disaient le contraire** : le harnais a bouchonné `SafeAreaView` avec `paddingBottom: 0`, en supposant que la tab bar consommait déjà l'inset. Ce choix, honnête et documenté par son auteur comme « raisonné, pas mesuré », raccourcit la page de 34 px et fait chevaucher la tab bar dessinée. **C'est un artefact du harnais, pas un défaut du produit.**

> À confirmer sur l'appareil de Kyllian (lot 0 du plan). Les deux versions restent des raisonnements sur du code ; aucune n'est une mesure sur téléphone. Dans les deux cas il y a un défaut réel à corriger — soit 70 px de vide, soit 33 px de boutons masqués — et `<Screen>` le règle dans les deux hypothèses.

**Ce qui reste vrai quelle que soit l'issue** : sur les 12 états rendus, **41 à 44 % du contenu est sous la ligne de flottaison**, et la dernière rangée d'actions se trouve au bas d'un défilement de ~1100 à 1500 px.

### 7.4 Autres finitions
- `paddingTop: 8` hors grille (tous les autres écrans sont à 16).
- Bordures quasi invisibles : `borderSoft` sur `cardSoft` = **1.06:1** — le séparateur de la ligne de stats et les diviseurs de la carte séance ne se voient pratiquement pas.
- 14 styles de texte sous 13 px, dont 4 à 10 px, dont 3 en capitales avec `letterSpacing`.
- **Correct, à préserver** : une seule `StatusBar` globale ; `reduceMotion` respecté avant le stagger d'entrée ; `minHeight` et jamais `height` sur les blocs de texte ; le swipe inter-onglets n'entre pas en conflit avec le scroll (armé seulement à moins de 24 px des bords).

### 7.5 Défauts visibles uniquement au rendu

Relevés sur les captures, invisibles à la lecture du code :

- **Le bandeau hors-ligne recouvre le prénom du joueur** — mesuré à **19 px de recouvrement**, soit environ la moitié de la hauteur de capitale du titre. Le bandeau est en position absolue dans `App.tsx` et ne suit pas le défilement.
- **Feedback en retard : l'action qui débloque tout est le dernier élément de la page.** Le chip « Comment ça s'est passé ? » est le plus petit élément de l'écran, en gris, à **93 % de la hauteur de page**. C'est l'action la plus importante de cet état, placée à l'endroit le moins visible.
- **Le badge vert « Prête » contredit le texte de sa propre carte** : pastille verte, puis 38 px plus bas la phrase de blocage « Séance en attente. Dis-nous comment ça s'est passé pour débloquer la suivante. »
- **Un seul bloc de la page porte une ombre — et c'est la carte Conseil** (`0 2px 8px rgba(0,0,0,.06)`). Le bloc le plus secondaire est le seul en relief.
- **Le rail de texte gauche flotte** : sept points de départ différents en descendant (16 / 27 / 31 / 33 / 37 / 58 / 98 px). Les titres ne s'alignent pas d'une carte à la suivante — écart mesuré de ~6 px entre le Conseil et la carte Progression.
- **À 430 px, la largeur gagnée part en vide** : la rangée de boutons utilise 313 px sur 366 disponibles, et la carte Progression laisse ~60 % de sa largeur déserte.
- **Un disque décoratif gris** (`nextGlow`, 160 px, `rgba(20,20,20,0.04)`) présente une **couture verticale nette** au zoom et passe derrière le bouton « Historique ». Ça se lit comme un bug d'affichage.
- **Le graphique est à moitié vide** : carte de 232 px dont ~110 px de blanc, pour une courbe dont l'amplitude verticale mesurée sur l'état « reprise » est de **0,7 px sur 90**.
- **Le conseil contient une carte dans la carte** : un encadré en italique ton sur ton qui paraphrase le paragraphe situé 20 px au-dessus (« Un peu de fatigue et pas de récup récente » → « La récup, c'est pas du temps perdu »).

---

## 8. Le problème vient-il vraiment du bas ?

**Non. Il commence en haut et ne devient visible qu'en descendant.**

Le haut du Home est bon : le CTA est en position 2, à 65 px, bien dimensionné, avec un sous-titre utile. Le problème est que **les 521 px suivants sont deux blocs passifs** (`TON ÉTAT` 223 px + `Conseil` jusqu'à 291 px) qui, ensemble :

1. repoussent tout ce qui est actionnable sous la ligne de flottaison ;
2. répètent trois fois une information que le chip du header a déjà donnée ;
3. captent l'attention visuelle avec le blanc le plus pur et le plus grand rayon de l'écran.

Quand on arrive enfin en bas, il ne reste plus rien à dire — d'où la sensation de cartes molles, de doublons et de fin abrupte. **Le bas est faible parce que le milieu a déjà tout dit, deux fois.**

---

## 9. Ce qu'il faut préserver

1. **La position du CTA** — en n°2, à 65 px du haut. C'est le meilleur choix de l'écran, il ne faut pas y toucher.
2. **Le vocabulaire joueur** — aucun ATL/CTL/TSB brut. `getFootballLabel` produit des mots de footballeur (« En forme », « On lève le pied aujourd'hui »). Seule exception à corriger : les repères « 0 » et « -10 » de la courbe.
3. **L'indépendance vis-à-vis du club** — `clubTrainingDays` vide, `matchDays` vide : tout se dégrade proprement. La doctrine est tenue, il ne faut pas la casser en ajoutant une directive club obligatoire.
4. **L'architecture des hooks** — toute la logique métier est dans `hooks/home/`, `HomeScreen.tsx` reste un fichier de rendu, les composants sont mémoïsés, les callbacks stabilisés avec une garde anti double-tap. La refonte doit se faire **dans cette structure**, pas contre elle.
5. **Le chip `Séance N/12 · phase`** — phase dérivée proprement, jamais le champ interne ; informatif et tapable ; mène au bon endroit. C'est le modèle à généraliser.

---

## 10. Verdict

**Le Home paraît moins abouti pour trois raisons, dans cet ordre :**

1. **Structure produit (le plus grave).** Il répète trois fois la même information, duplique son propre bouton principal, et n'a aucune réponse aux deux questions qui comptent : *pourquoi cette séance* et *comment je reprends*. La moitié basse n'a rien à dire parce que le milieu l'a déjà dit.
2. **Honnêteté des données.** Un tiers de l'écran affiche des constantes d'initialisation et des charges auto-injectées comme si c'étaient des mesures. C'est ce qui, inconsciemment, fait sonner l'écran creux : il parle beaucoup et ne prouve rien.
3. **Design system.** C'est le seul écran resté hors du socle — pas de `<Screen>`, pas de `Button`, pas de tokens, 7 rayons, 4 palettes. C'est le plus visible et, paradoxalement, le plus facile à réparer.

**Le problème est donc « les deux », mais pas à parts égales : c'est d'abord un problème de structure produit, que le déficit de design system rend visible.** Refaire uniquement le style produirait un écran plus joli qui dirait toujours trois fois la même chose.

→ Suite : [`ETATS_HOME.md`](ETATS_HOME.md), [`RECOMMANDATIONS_HOME.md`](RECOMMANDATIONS_HOME.md), [`WIREFRAMES_HOME.md`](WIREFRAMES_HOME.md), [`PLAN_IMPLEMENTATION_HOME.md`](PLAN_IMPLEMENTATION_HOME.md).
