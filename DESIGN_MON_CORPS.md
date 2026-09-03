# Espace « Mon corps » — audit de l'existant, proposition, décisions

**Phase 0 — conception. Aucun code applicatif n'est modifié par ce document.**

Branche : `design/mon-corps` (partie de `origin/main` = `744ab47`).
Front lu : ce worktree. Backend lu en **lecture seule** : `C:\Users\Gamer\fks-worktrees\readiness3`
(branche locale `fix/materiel-maison` ; quand je cite le backend, je précise si la ligne
existe aussi sur `origin/main`).

Chaque affirmation sur l'existant porte un `fichier:ligne`. Quand je propose, j'écris
« **proposition** ». Je n'invente aucun chiffre d'usage.

---

## 1. Audit de l'existant

### 1.1 Le cycle de vie d'une blessure aujourd'hui — schéma

```
   LE JOUEUR TAPE     FeedbackScreen (modal, fin de séance)
   (une seule porte)  ├─ curseur Douleur 0-5
                      └─ toggle « Aucune » / « À préciser »
                            └─ InjuryForm : 1 zone, 1 sévérité,
                               1 type, 6 restrictions, 1 note
                                  │ useFeedbackSave.ts:190 → setInjury(jour, injury)
                                  ▼
   OÙ ÇA VIT          useFeedbackStore.dayStates[jour].feedback.injury
   (téléphone seul)   (UN seul objet par jour)
                      AsyncStorage « fks-feedback-v1 » + « fks-snapshot-v2-<uid> »
                      ⚠ JAMAIS écrit dans Firestore
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
   GÉNÉRATION               CONSEIL DU HOME          BOUCLE DE SUIVI
   fenêtre 7 j              fenêtre : LE JOUR MÊME   fenêtre 7 j
   → pains[]                → carte « Gêne … »       → painSignal
   → injury_max_severity                             → remplacements
        │
        ▼  HTTP POST /api/fks/generate
   BACKEND : filtre les exos (okByContra), plafonne l'intensité,
             et — cas non géré par le front — REFUSE la séance
```

### 1.2 Qui écrit ?

**Une seule porte d'entrée : le feedback de fin de séance.**

- Le curseur douleur 0-5 : `screens/feedback/components/PainInjuryRow.tsx:29-35`.
- Le détail blessure derrière un toggle binaire « Aucune » / « À préciser » :
  `PainInjuryRow.tsx:36-67`, puis le formulaire `PainInjuryRow.tsx:69-90`.
- Le formulaire lui-même : `components/InjuryForm.tsx`
  (zone `:71-85`, sévérité `:88-100`, type aigu/chronique `:102-115`,
  6 restrictions `:117-140`, note libre `:142-153`).
- L'enregistrement : `screens/feedback/hooks/useFeedbackSave.ts:190`
  → `setInjury(dayKeyForSession, hasPainDetails ? injury : null)`.

**Le setup profil ne demande RIEN sur les blessures.** Le seul mot voisin est un
objectif proposé, « Reprendre apres une blessure » (`screens/ProfileSetupScreen.tsx:98`).
Donc : **aucun doublon** à supprimer de ce côté. Un joueur qui s'inscrit avec une
entorse en cours n'a **aucun moyen** de le dire à l'app avant sa première séance.

### 1.3 Où c'est stocké ?

- Structure : `useFeedbackStore.dayStates[<clé jour>].feedback.injury`
  (`state/stores/useFeedbackStore.ts:132-150`). **Un seul objet blessure par jour** —
  la structure ne permet pas d'en déclarer deux le même jour.
- Type : `InjuryRecord` (`domain/types.ts:268-276`) = `area`, `severity` 0..3,
  `type`, `restrictions`, `startDate`, `lastConfirm`, `note?`.
- Persistance locale : Zustand persist, clé `fks-feedback-v1`
  (`useFeedbackStore.ts:155-163`), plus un snapshot par utilisateur
  `fks-snapshot-v2-<uid>` (`state/orchestrators/resetUser.ts:14`, `:40`, `:133`).
- **Firestore : rien.** Aucune écriture de `dayStates` nulle part
  (vérifié par recherche globale sur `dayStates`). Conséquences :
  - Changement de téléphone / réinstallation ⇒ **toutes les blessures sont perdues**.
  - En contrepartie, la donnée de santé ne quitte jamais l'appareil. C'est un bon
    point RGPD **par accident**, pas par décision écrite.
- Il existe bien un schéma Zod prêt pour Firestore
  (`schemas/firestoreSchemas.ts:193-223`, `dailyFeedbackSchema` + `injuryRecordSchema`)
  — mais **il n'est appelé nulle part**. Code mort.
- La seule trace serveur liée à la douleur aujourd'hui est un **booléen dérivé** :
  `lastTrackingDecision.signalsDigest.painActive` dans `users/{uid}`
  (contrat verrouillé par `firestore.rules:576-592` et `:665-666`). Pas de zone,
  pas de sévérité.

### 1.4 Qui lit ?

| Lecteur | Fichier | Fenêtre | Ce qu'il en fait |
|---|---|---|---|
| Génération de séance | `services/aiContextHelpers.ts:652-701`, appelé par `services/aiContext.ts:200-207` | **7 jours** (`:616`) | produit `constraints.pains[]` + `constraints.injury_max_severity` (`aiContext.ts:353-354`) |
| Conseil du Home | `hooks/home/useContextualAdvice.ts:124-127` | **le jour même seulement** | carte « Gêne … signalée » (`domain/adviceRules.ts:182-195`) |
| Boucle de suivi (shadow) | `state/orchestrators/trackingShadow.ts:67-73` | 7 jours (`domain/tracking/config.ts:56`) | `painSignal.active` → règle « ne pas augmenter » |
| Remplacements d'exos | `domain/tracking/replacements/select.ts:56-67`, `:104-107`, `:186-194` | idem | ne propose jamais un exo qui sollicite la zone |
| Progression / Profil / historique | — | — | **rien n'affiche jamais une blessure** |
| Projection coach | — | — | **rien** (voir §1.7) |
| Notifications | `services/notifications.ts` | — | **aucune notification liée aux blessures** |

**Deux fenêtres différentes pour la même donnée.** La génération considère une gêne
active 7 jours ; le conseil du Home la considère active **un seul jour**
(`useContextualAdvice.ts:124-127` lit `dayStates[aujourd'hui]` et rien d'autre).
Un joueur peut donc recevoir une séance bridée par une gêne dont l'app ne lui parle plus.

### 1.5 Le contrat backend

**Le mapping des zones est partagé et vérifié identique.**
J'ai comparé octet à octet `shared/injuryMapping.ts` (front) et
`src/shared/injuryMapping.ts` (readiness3) : **identiques**.

- 10 zones déclarables côté joueur : cheville, genou, ischio, quadriceps, mollet,
  hanche, dos, épaule, poignet, **autre** (`shared/injuryMapping.ts:31-41`).
- 9 sont traduites en un jeton backend (`:65-76`). **« autre » n'est volontairement
  pas mappé** : aucun filtre d'exercice ne peut s'appliquer, seul le plafond
  d'intensité protège (commentaire `:56-63`).
- Le backend connaît **un jeton de plus que le front n'émet** : `groin_pain`
  (aine / adducteurs), présent dans `BackendPainToken` (`:43-53`) et dans
  `Contraindication` (`src/exerciseBank.ts:38-50`), mais **sans zone française
  correspondante**. Des exercices sont annotés « contre-indiqué si douleur à l'aine »
  et **aucun joueur ne peut déclarer cette zone**. C'est une zone très fréquente au
  football (pubalgie).

**Ce que le moteur en fait :**

1. **Filtre dur** — tout exercice dont les `contraindications` croisent un jeton reçu
   est retiré de la banque (`src/fksFilters.ts:396-399`, appliqué `:412-419`).
2. **Plafond d'intensité** (`src/fksOrchestrator.ts:2424-2437`) :
   - sévérité **3** → cap forcé `easy`, même si le joueur a demandé d'ignorer le
     plafond de fatigue (« la sécurité blessure prime toujours ») ;
   - sévérité **2** → interdit `hard`, plafonne `moderate_light` ;
   - sévérité **1** → aucun effet sur la sécurité.
3. **Refus pur et simple de servir une séance** (`src/fksWorkflow.ts:5281-5331`,
   règles dans `src/amenagements.ts:482-520`) — présent sur `origin/main` :
   - **RF1** : douleur du dernier retour ≥ 7 sur l'échelle backend 0-10 ;
   - **RF2** : sévérité ≥ 3 **avec au moins une zone déclarée** ;
   - **RF3** : `constraints.pain_spike === true` — **le front n'émet jamais ce champ**
     (vérifié : aucune occurrence de `pain_spike` dans le front). Règle inerte, et le
     backend le dit lui-même (`fksWorkflow.ts:5276-5280`) ;
   - **RF4** : plus aucun bloc de travail servable.

   Le backend répond alors `{ error: "safety_no_session", message, disclaimer,
   safety_flags }` avec des phrases écrites d'avance
   (`src/shared/SAFETY_PHRASES.ts:26-33`).

### 1.6 Les trous

**T1 — (P0) Le refus de séance n'arrive jamais au joueur : il reçoit « service indisponible ».**

Le refus est renvoyé avec `output_parsed: null` (`fksWorkflow.ts:5329`). Le handler HTTP
teste `if (!v2 || v2.version !== "fks.next_session.v2")` et répond **HTTP 500
`{ ok:false, error:"invalid_version" }`** (`src/index.ts:186-196`). Ce corps ne porte
ni `code` ni `message`, donc `lireCorpsContrat` renvoie `null`
(`screens/newSession/echecGeneration.ts:160-191`) et le front retombe sur sa
classification client : `ErrorType.SERVER` → *« Le service est momentanément
indisponible… Tu peux réessayer dans quelques instants. »*
(`echecGeneration.ts:246-254`, texte `:132-133`).

Autrement dit : un joueur qui déclare une douleur forte reçoit un **message de panne
technique**, réessaie, re-reçoit une panne. Les phrases de sécurité écrites avec soin
(« Le repos est un vrai travail quand le corps en a besoin ») ne s'affichent **jamais**.

Et le déclencheur est plus large qu'on ne croit : le curseur douleur 0-5 est doublé
avant envoi (`services/aiContextHelpers.ts:343-346`, `pain × 2`). Donc **une douleur
4/5 au feedback = 8/10 côté backend = RF1**. Ce n'est pas le détail de blessure, c'est
le curseur que l'orientation prévoit de **garder** dans le feedback.

**T2 — (P0) Le cul-de-sac : une fois bloqué, aucun moyen de dire « ça va mieux ».**

Le seul écran où l'on peut modifier une douleur ou une blessure est `FeedbackScreen`,
et il exige une séance cible (`useSessionResolution`, `FeedbackScreen.tsx:103-105`) —
séance qu'on ne peut plus générer. La fenêtre de validation est de surcroît limitée à
J-2…J+1 (`FeedbackScreen.tsx:186-187`). Passé ce délai : plus rien.
Le joueur attend que la fenêtre de 7 jours expire **toute seule**, sans que rien ne le
lui dise.

**T3 — Expiration silencieuse à 7 jours.**

`INJURY_ACTIVE_WINDOW_DAYS = 7` (`aiContextHelpers.ts:616`). Au 8ᵉ jour, la contrainte
disparaît sans un mot. Un joueur qui déclare une entorse et regénère 10 jours plus tard
reçoit une séance **complètement normale**, sprints compris, sans qu'on lui ait jamais
demandé où il en est. À l'inverse, une gêne oubliée bride 7 jours de séances sans
explication visible après le premier jour (voir §1.4, deux fenêtres).

**T4 — Le formulaire fait remplir des champs qui ne servent à rien.**

Écrits par le formulaire, **lus par personne** (vérifié par recherche globale) :
les 6 **`restrictions`** — éviter sprint, sauts, charges lourdes… (`InjuryForm.tsx:117-140`) ;
le **`type`** aigu/chronique (`:102-115`) ; **`startDate`** et **`lastConfirm`**
(`:26-28`, `:37` — le commentaire du type dit « pour decay/hysteresis », ce decay
n'existe pas) ; la **`note`**, écrite et jamais réaffichée. Hors du formulaire, ces
champs n'apparaissent que dans la définition du type (`domain/types.ts:258-276`) et
dans le schéma mort (`firestoreSchemas.ts:202-213`).

Le joueur remplit donc, en fin de séance, six interrupteurs qui ne changent strictement
rien à sa séance suivante. Ce n'est pas du gaspillage : c'est une promesse non tenue.

**T5 — Deux blessures simultanées : impossible le même jour.**

`dayStates[jour].feedback.injury` est **un objet, pas une liste**
(`domain/types.ts:287`). Deux zones ne coexistent que si elles ont été déclarées **des
jours différents** — `collectActivePainConstraints` déduplique alors par zone, la plus
récente faisant foi (`aiContextHelpers.ts:660-673`). Un joueur qui a mal au genou **et**
au mollet le même soir doit choisir.

**T6 — La zone « autre » ne protège presque rien.**

Elle n'émet aucun jeton (`shared/injuryMapping.ts:75`) : **aucun exercice n'est filtré**,
seul le plafond d'intensité s'applique. Une gêne « autre » de sévérité 1 ne change donc
**rien du tout**. Et l'aine n'est pas déclarable du tout (§1.5).

**T7 — La levée d'une blessure passe par un libellé incompréhensible.**

Le seul moyen de dire « c'est passé » est de rouvrir le feedback et de choisir la
sévérité **« OK »** (valeur 0, `constants/injury.ts:18-23`) — un mot qui, dans une liste
« OK / Gêne / Modérée / Forte », ressemble à « aucune donnée » plutôt qu'à « guéri ».
Le code en fait pourtant une levée explicite (`aiContextHelpers.ts:688-691`).

**T8 — Le toggle efface la blessure sans prévenir.**

`onTogglePainDetails(false)` fait `setInjuryLocal(null)` (`FeedbackScreen.tsx:284-287`)
et `useFeedbackSave.ts:190` écrit alors `null` pour ce jour. Une mauvaise manipulation
supprime la déclaration, sans confirmation ni annulation.

**T9 — Le fichier partagé `SAFETY_PHRASES.ts` n'existe pas côté front.**

`src/shared/SAFETY_PHRASES.ts:6-12` déclare : *« Les deux repos FKS ont leur propre
copie de ce fichier … Frontend : C:/Users/Gamer/front-fks/shared/SAFETY_PHRASES.ts »*.
Le dossier `shared/` du front ne contient que `injuryMapping.ts` et `__tests__/`.
La copie front **n'a jamais été créée**.

**T10 — Une charte produit complète existe côté backend et n'est pas implémentée.**

`INJURY_IA_CHARTER.md` (présent sur `origin/main` du backend) décrit 7 règles et une UX
qui n'existe nulle part dans le front : bandeau d'explication quand une séance est
aménagée (règle 2), carte de réévaluation « ta gêne est en baisse » (règle 4), carte
rouge non-dismissable en cas d'aggravation (règle 5), bouton « Je préfère me reposer
aujourd'hui » (règle 6), disclaimer en bas de séance (règle 7). La charte parle d'un
champ **`activeInjuries`** — qui **n'existe pas dans le front** (recherche globale :
une seule occurrence, dans un commentaire de `shared/injuryMapping.ts:18`).

Autrement dit : le modèle de données que « Mon corps » doit créer était déjà nommé
il y a des mois, dans le repo d'en face, et n'a jamais été construit ici.

**T11 — Dette de socle visuel sur l'écran d'accueil de l'onglet Séance.**

`screens/SessionHubScreen.tsx:224` utilise `<SafeAreaView>` en direct, alors que la
règle d'or du projet impose `<Screen>` (`components/ui/Screen.tsx:39-52`, CLAUDE.md
règle 13). À traiter au passage si on touche cet écran.

### 1.7 Ce qui est envoyé au club — clarification demandée

**La ligne `domain/clubDataDisclosure.ts:69` est bien la liste de ce qui n'est JAMAIS
transmis.** Le tableau `CLUB_DISCLOSURE_NEVER` (`:64-73`) est titré « Ton coach ne voit
jamais » (`:81`). Aucune ambiguïté dans le code — l'ambiguïté était dans la lecture.

Ce qui la garde vraie :

- `domain/coachView/__tests__/sensitiveIsolation.test.ts:85-133` : on fabrique un
  payload saturé de sentinelles (`painZones`, `injuries`, commentaire
  « SENTINEL_COMMENT_mal_au_genou ») et on exige une sortie **strictement identique**
  au payload propre, plus l'absence de tout mot sensible dans le JSON final.
- Côté serveur, une liste de clés interdites au parsing
  (`functions/src/dto.ts:165-169`, `:216-218` : `pain`, `painzone`, `injury`, `injur`…).
- Nuance déjà assumée et écrite : une raison d'écart « douleur » ressort au coach en
  « Autre raison » (`clubDataDisclosure.ts:83-91`).

**Conclusion pour « Mon corps » : la frontière tient parce que la blessure ne quitte
pas le téléphone.** Si un jour on synchronise « Mon corps » vers Firestore, cette
garantie repose alors entièrement sur la projection serveur — c'est un changement de
nature du risque, pas un simple détail technique.

---

## 2. Proposition de design

### 2.1 Emplacement

**Proposition retenue : une carte d'entrée en haut de `SessionHubScreen`, au-dessus de
« Créer une séance », qui ouvre un écran plein `MonCorps` en route stack.**

1. Dans `screens/SessionHubScreen.tsx`, une carte insérée **avant** `HUB_OPTIONS`
   (`:302-311`), sous les puces de stats — donc au-dessus du gros bouton orange
   « Créer une séance » (`:40-49`). Elle dit l'état en une ligne : *« Mon corps — rien
   de signalé »* ou *« Mon corps — genou, ça gêne »*.
2. Un tap ouvre `MonCorps`, écran plein déclaré dans `AppNavigator`
   (`navigation/RootNavigator.tsx`, à côté de `Tests` `:247`),
   `headerShown: true, title: "Mon corps"`.

**Pourquoi une carte + un écran, et pas un formulaire déplié dans le hub :** le hub est
un **menu** (4 tuiles + une alerte conditionnelle) qui doit se lire en trois secondes,
et le formulaire doit aussi être atteignable depuis le feedback (§2.4) et depuis le
conseil du Home. Un seul écran, plusieurs portes.

**Pourquoi l'onglet Séance et pas Profil :** l'information sert à **fabriquer la séance
suivante**. Juste au-dessus du bouton qui la fabrique, elle devient un réflexe
d'avant-match — *je regarde mon corps, puis je lance*. Dans Profil, elle serait rangée
avec l'état civil : consultée une fois à l'inscription, jamais rouverte. Un lien
secondaire depuis Profil reste possible (**proposition**, coût quasi nul).

**Alternative écartée : un 4ᵉ onglet.** La tab bar est volontairement à 3 (CLAUDE.md,
`RootNavigator.tsx:133`) ; un onglet donnerait le poids visuel de l'accueil à un écran
ouvert quelques fois par mois.

### 2.2 Contenu de l'écran « Mon corps »

**État à vide (le cas le plus fréquent).** Une phrase, pas un zéro :

> **Rien de signalé.**
> Si une gêne apparaît, dis-le ici : FKS adaptera tes séances.
> [ Signaler une gêne ]

Pas de compteur « 0 blessure », pas de silhouette vide, pas de jauge à zéro
(CLAUDE.md règle 12).

**Liste des gênes actives.** Une carte par zone :

```
  Genou droit                          [ Mettre à jour ]
  Gêne modérée · signalée il y a 4 jours · depuis le feedback
  « ça tire à la descente »
```

**Ajouter / mettre à jour** — un formulaire court :

1. **Zone** — les 10 valeurs de `INJURY_AREAS` (`constants/injury.ts:5-16`), **même
   référentiel que le backend** (`shared/injuryMapping.ts:31-41`).
   **Proposition d'ajout : « aine / adducteurs »** → `groin_pain`, déjà connu du backend
   (§1.5). **Proposition : un avertissement honnête sur « autre »** — *« FKS pourra
   alléger ta séance, mais ne pourra pas éviter des exercices précis »* (c'est la
   vérité, §T6).
2. **Gravité, en mots de joueur** — 3 niveaux, plus de « OK » :

   | Valeur envoyée | Libellé proposé | Sous-titre |
   |---|---|---|
   | 1 | **Ça tire** | Je peux jouer, ça se sent |
   | 2 | **Ça gêne** | Je m'adapte pendant l'effort |
   | 3 | **Ça m'empêche** | Je ne peux pas forcer dessus |

   La valeur 0 disparaît de l'écran : « c'est passé » se dit par le **statut** (§T7).
3. **Depuis quand** — aujourd'hui / cette semaine / plus ancien. Sert au texte affiché,
   pas au calcul.
4. **Note libre**, optionnelle, courte, **réaffichée** dans la liste.

Ce qu'on **retire** : les 6 restrictions et le type aigu/chronique (§T4 — champs morts).
On ne fait pas remplir ce qu'on ne lit pas.

**Statut** — sur chaque carte : `[ Toujours là ]` `[ En reprise ]` `[ C'est passé ]`.

**Historique replié** — `[ Voir les gênes passées ]` déplie la liste des `healed` (zone
+ dates). Ni graphique, ni « nombre de blessures cette saison » : ce chiffre-là, on ne
saurait pas le rendre juste.

**Ce que l'écran ne fait JAMAIS** (`INJURY_IA_CHARTER.md`) : nommer une pathologie,
estimer un délai de retour, dire si c'est grave, comparer à d'autres joueurs. Le pied
d'écran porte `GENERAL_DISCLAIMER` (`src/shared/SAFETY_PHRASES.ts:27`).

### 2.3 Modèle de données cible

**Proposition** — nouveau store dédié `state/stores/useBodyStore.ts`, clé de
persistance `fks-body-v1` :

```ts
export type BodyInjuryStatus = "active" | "recovering" | "healed";

export type BodyInjury = {
  id: string;                    // stable, généré à la création
  area: InjuryArea;              // MÊME référentiel que shared/injuryMapping.ts
  severity: 1 | 2 | 3;           // 0 n'existe plus : "passé" = status healed
  status: BodyInjuryStatus;
  declaredAt: string;            // clé jour (toDateKey), pas un ISO horodaté
  updatedAt: string;             // clé jour
  source: "feedback" | "manual" | "migration";
  note?: string;
};
```

Ce qui **disparaît** par rapport à `InjuryRecord` : `restrictions`, `type`,
`lastConfirm` (remplacé par `updatedAt`), `startDate` (remplacé par `declaredAt`).
`InjuryRecord` **reste** dans `domain/types.ts` tant que `dayStates` historiques
existent, mais plus rien de neuf ne l'écrit.

**Migration des données existantes** — au premier montage de `useBodyStore`, une
fonction pure `migrerDayStatesVersMonCorps(dayStates, todayKey)` :

- rejoue **exactement** la règle actuelle : 7 jours glissants, la déclaration la plus
  récente par zone fait foi, sévérité 0 = levée
  (`aiContextHelpers.ts:660-698`) ;
- crée une `BodyInjury` par zone survivante, `status: "active"`,
  `source: "migration"`, `declaredAt` = le jour de la déclaration ;
- **idempotente** : un drapeau `migratedAt` dans le store, plus une clé de dédoublonnage
  `area + declaredAt`. Rejouer la migration ne crée jamais de doublon.
- Les `dayStates` ne sont **pas** effacés (l'historique subjectif fatigue/douleur reste
  utile) ; simplement, plus personne ne lit `.feedback.injury` après la migration.

**Une seule lecture des blessures actives.** `collectActivePainConstraints` reste le
nom et le lieu, mais change de source :

```
AVANT : collectActivePainConstraints(dayStates, todayKey)
APRÈS : collectActivePainConstraints(injuries: BodyInjury[], todayKey)
```

Elle reste **pure** (aucun store lu à l'intérieur) et garde ses tests existants
(`services/__tests__/painConstraints.test.ts`) réécrits sur le nouveau type.
Plus de fenêtre glissante : on lit les statuts. Le champ « legacy `pains` / `painZones` »
(`aiContextHelpers.ts:675-685`) peut être supprimé — rien ne l'écrit, et un test le dit
déjà (`painConstraints.test.ts:171`).

Les trois autres lecteurs (conseil du Home, boucle de suivi, remplacements) branchent
sur **la même liste**, ce qui supprime au passage l'incohérence des deux fenêtres (§1.4).

**Ce qui part au backend, lot 1 — inchangé :**

| Statut | `pains[]` | `injury_max_severity` |
|---|---|---|
| `active` | jeton de la zone | sévérité déclarée |
| `recovering` | **jeton de la zone** | **sévérité déclarée** |
| `healed` | rien | rien |

**Je recommande de ne PAS réduire la sévérité en « en reprise » au lot 1.** Diviser ou
décrémenter une sévérité que le joueur n'a pas rebaissée lui-même serait exactement une
valeur inventée (CLAUDE.md règle 12) — et le geste va dans le sens du risque, pas de la
sécurité. Au lot 1, « en reprise » est une information **d'écran** : elle change ce que
le joueur lit et quand on le relance, pas ce que le moteur reçoit.

### 2.4 Passerelle depuis le feedback

**Le curseur douleur 0-5 reste où il est**, inchangé : il alimente le score de readiness
(`screens/feedback/hooks/useReadinessScore.ts:5-12`) et la charge
(`utils/feedbackFactor.ts`).

**Ce qui sort du feedback** : le toggle « Aucune / À préciser » et le formulaire
`InjuryForm` (`PainInjuryRow.tsx:36-90`). Le feedback redevient quatre curseurs et une
durée.

**Ce qui le remplace** — après l'enregistrement réussi du feedback, **jamais avant** :

- Seuil proposé : **douleur ≥ 3 sur 5**. Pas un chiffre neuf :
  `TRACKING_CONFIG.pain.feedbackThreshold = 3` (`domain/tracking/config.ts:54-55`),
  commenté « ≥ 3 = douleur réelle, pas une gêne mineure ». **Un seuil = une
  implémentation** : on importe la constante, on n'en écrit pas une deuxième.
- Le feedback est **sauvegardé d'abord**. La proposition ne bloque rien, ne désactive
  aucun bouton, et son refus n'a aucune conséquence.
- Deux cas : **aucune gêne active** → *« Tu as noté une douleur marquée. Tu veux dire
  où ? »* `[ Oui, la situer ]` / `[ Plus tard ]` ; **une gêne active existe** →
  *« Ta gêne au genou est toujours là ? »* `[ Toujours là ]` / `[ En reprise ]` /
  `[ Ouvrir Mon corps ]`.
- Réponse « Plus tard » : **rien n'est écrit**. Une douleur non située reste non située —
  on ne fabrique pas une blessure « zone : autre » à la place du joueur.

**Ce que la passerelle NE fait pas** : modifier un statut toute seule
(`INJURY_IA_CHARTER.md`, règle 3 : *« Jamais modifier le statut de blessure sans
consentement joueur »*).

### 2.5 Relance

**Lot 1 — au moment de générer, pas à l'ouverture de l'app.** Quand une gêne `active`
ou `recovering` a un `updatedAt` de plus de **7 jours**, la carte « Mon corps » du hub
passe en mode question, et le même encart s'affiche en tête de l'écran de génération :

> **Ta gêne au genou date de 9 jours.** Où en es-tu ?
> `[ Toujours là ]` `[ En reprise ]` `[ C'est passé ]`

- Fréquence : au plus **une relance par jour et par gêne**.
- **Sans réponse, la gêne reste active.** Jamais d'expiration automatique. C'est le
  cœur du changement par rapport à aujourd'hui (§T3).
- Pourquoi 7 jours : c'est la valeur déjà en place partout
  (`aiContextHelpers.ts:616`, `domain/tracking/config.ts:56`) — on ne change pas un
  chiffre pour le plaisir, on change ce qu'il **déclenche** (une question au lieu d'un
  oubli).

**Lot 2 — notification locale.** `services/notifications.ts` a déjà le pattern
(`scheduleSessionReminder`, `scheduleStreakReminder`…) et un réglage par canal dans
Settings. Une notification liée à la santé mérite son propre interrupteur et son propre
texte, non alarmiste : *« Petit point : où en est ta gêne au genou ? »*. Hors périmètre
du lot 1.

### 2.6 Impact sur la génération

**Lot 1 : rien ne change côté backend.** Mêmes `pains[]`, même `injury_max_severity`,
même point d'appel (`services/aiContext.ts:200-207`, `:353-354`). Seule la **source**
change. Un test de non-régression doit le prouver noir sur blanc (§4).

**Lot 1, correctif à embarquer quand même — T1.** Livrer un espace qui invite à déclarer
une gêne forte tout en sachant que cette déclaration produit un écran de panne, c'est
construire le piège. **Proposition minimale, front** : traiter une réponse portant
`safety_flags` comme une catégorie d'échec à part et afficher le `message` du backend tel
quel, avec pour seules sorties `[ Voir Mon corps ]` et `[ Retour ]`. Cela suppose que le
backend fasse remonter le corps de sécurité au lieu de l'écraser en 500 — **c'est un
correctif backend**, hors de ce worktree, à ouvrir en parallèle (décision D10).

**Lot 2 : « en reprise » devient une information distincte.** Un champ
`constraints.injury_status` (ou un `pains_recovering[]` séparé) permettrait au moteur de
faire ce qu'un préparateur fait vraiment : garder l'exclusion de la zone mais rouvrir
progressivement le volume. Aller-retour de contrat front↔back + mesure — **hors
périmètre du lot 1**, et à ne pas anticiper au-delà du champ `status` déjà prévu.

### 2.7 Frontière coach-safe

Le nouveau stockage `fks-body-v1` est **local au téléphone**, exactement comme
`fks-feedback-v1` aujourd'hui (§1.3). Aucune écriture Firestore au lot 1 — **contrainte
de conception, pas effet de bord** : à écrire en tête du fichier du store.

Le test qui garde la frontière, `domain/coachView/__tests__/sensitiveIsolation.test.ts:85-133`,
porte sur la **projection** et non sur le stockage : il continue de passer sans
modification. **Proposition d'extension malgré tout** : ajouter une clé `bodyInjuries`
aux sentinelles du payload sale et le mot `"bodyinjuries"` à la liste `:130`. Coût nul,
et ça arme le test **avant** qu'un lot de synchronisation existe, plutôt qu'après.

**À dire clairement :** si « Mon corps » est un jour synchronisé vers Firestore (pour ne
plus perdre les données au changement de téléphone), la protection coach ne reposera
plus sur « la donnée n'existe pas côté serveur » mais uniquement sur la liste
d'exclusion serveur (`functions/src/dto.ts:165-169`) et les règles Firestore. Faisable,
déjà outillé — mais **décision à part entière**, pas détail d'implémentation.

### 2.8 RGPD — inventaire honnête (ce n'est pas un avis juridique)

Les blessures sont des **données de santé**, catégorie particulière au sens de
l'article 9 du RGPD. Le projet le sait déjà et l'a écrit :
`domain/parentalConsent.ts:1-13` dit explicitement *« FKS collecte des données de santé
(douleurs, blessures, fatigue) → catégorie spéciale RGPD »*.

**Déjà en place :** la politique liste *« Données de santé : blessures, douleurs,
fatigue (RPE) »* (`utils/legalContent.ts:51`) avec finalité (`:59-60`), base légale
« consentement explicite » (`:66-68`), durée de conservation (`:70-75`) et section
mineurs de moins de 15 ans (`:92-99`) ; le consentement parental est **bloquant** au
setup pour U13/U15, avec preuve horodatée (`domain/parentalConsent.ts:19-25`, `:27-45`) ;
le partage au club exclut douleurs et zones, sous test (`domain/clubDataDisclosure.ts:68-73`).

**Ce qu'un écran dédié change — et ce qu'il faut mettre à jour :**

1. **La visibilité et la durée de la collecte.** Aujourd'hui la donnée de santé est
   saisie au détour d'un formulaire de fin de séance et cesse d'agir au bout de 7 jours ;
   demain elle a un écran à son nom, des statuts et un historique. Ce n'est pas une
   nouvelle catégorie de données, mais c'est une conservation plus longue. → **La
   politique doit dire que ces données sont conservées jusqu'à ce que le joueur les
   supprime.**
2. **Le droit d'effacement, concrètement.** L'écran doit permettre de **supprimer** une
   gêne (pas seulement la marquer guérie) et de vider l'historique. Aujourd'hui aucun
   geste de suppression n'existe : c'est un manque, pas une nuance.
3. **Le stockage local.** Écrire dans la politique que ces données **restent sur
   l'appareil** tant qu'aucune synchronisation n'existe : c'est vrai, c'est un argument
   de confiance, et ça oblige à rouvrir la politique le jour où ça changera.
4. **Une phrase sur l'écran lui-même**, pas seulement dans la politique enfouie :
   *« Ces informations restent sur ton téléphone. Ton coach ne les voit pas. »* —
   vraie aujourd'hui (§2.7) et vérifiable par test.
5. **Mineurs.** Rien de neuf n'est requis **si** le stockage reste local et si l'écran
   n'ajoute aucune finalité. Si le lot 2 introduit des notifications de santé,
   l'interrupteur correspondant devra être distinct des autres rappels.
6. **Ce que je ne tranche pas :** faut-il un consentement **spécifique** à la collecte
   de santé, distinct de la case générale de l'inscription ? L'article 9 demande un
   consentement « explicite » ; la case actuelle (`legalContent.ts:66-68`) couvre le
   traitement en bloc. Question pour un juriste — à poser **avant** le pilote clubs.

**Fichiers à mettre à jour** : `utils/legalContent.ts` (durée de conservation,
localité du stockage, mention de l'espace dédié) et `docs/appstore/privacy.html`
(qui contient déjà des mentions douleur/blessure et doit rester cohérent).

### 2.9 Accessibilité et socle visuel

`MonCorps` utilise `<Screen>` (`components/ui/Screen.tsx:39-52`) — seule source de vérité
de la safe area, header-aware ; jamais de `SafeAreaView edges`, jamais de `<StatusBar>`
locale, jamais de `paddingTop` magique (CLAUDE.md règle 13). Puisqu'on touche
`SessionHubScreen` pour y poser la carte d'entrée, on corrige sa dette au passage (§T11).
Textes : `maxFontSizeMultiplier` par rôle (modèle `components/homeVNext/homeVNextTypo.ts`),
cartes en **`minHeight` jamais `height`**, `numberOfLines` sur la note libre (contenu
saisi, longueur non maîtrisée). Animations conditionnées à `hooks/useReduceMotion.ts`,
pas de stagger d'entrée. Haptique via `useHaptics()` uniquement — et **rien de festif sur
un geste de santé** : `impactLight` sur un changement de statut, jamais `success()`.
Retours via `showToast()`, jamais `Alert.alert`. Chaque bouton de statut porte un
`accessibilityLabel` complet (« Marquer la gêne au genou comme passée »), pas
« C'est passé ».

---

## 3. Décisions à trancher par Kyllian

### D1 — Nom de l'espace
A. **« Mon corps »** · B. « Mon état » (plus large, donc plus flou) ·
C. « Gênes & blessures » (froid, et le mot « blessure » fait peur pour une gêne).

→ **A.** C'est le vocabulaire d'un joueur, et ça laisse la porte ouverte à y ranger un
jour d'autres signaux du corps.

### D2 — Emplacement précis
A. **Carte en haut de `SessionHubScreen` + écran plein en route stack** ·
B. Section dépliable dans le hub, sans écran séparé · C. Dans Profil.

→ **A** (§2.1). B alourdit un menu qui doit se lire en trois secondes ; C enterre
l'information loin du geste qu'elle sert.

### D3 — Seuil de la passerelle depuis le feedback
A. **Douleur ≥ 3/5** (réutilise `TRACKING_CONFIG.pain.feedbackThreshold`) ·
B. ≥ 2/5, propose beaucoup plus souvent · C. Jamais automatique, juste un lien permanent.

→ **A.** Un seuil qui existe déjà dans le code, avec sa justification écrite. C reste
vrai **en plus** de A : le lien « Signaler une gêne » existe toujours, la proposition ne
fait que s'y ajouter au-dessus du seuil.

### D4 — Cycle de statut : 2 ou 3 états
A. 2 états (active / guérie) · B. **3 états** (active / en reprise / guérie).

→ **B.** « En reprise » est le seul état qui décrit ce qui se passe entre « je ne peux
pas » et « c'est fini », et c'est celui qui rendra le lot 2 utile. Au lot 1 il ne change
rien au moteur (§2.3) : on l'installe maintenant pour ne pas migrer deux fois.

### D5 — Délai et canal de relance
A. **7 jours, dans l'app, au moment de générer** (notification au lot 2) ·
B. 7 jours, notification locale dès le lot 1 · C. 3 jours, dans l'app.

→ **A.** 7 jours parce que c'est le chiffre déjà partout dans le code. Dans l'app
d'abord parce qu'une notification de santé mal calibrée est difficile à rattraper, et
qu'on n'a aucune donnée d'usage pour la calibrer.

### D6 — Garder la question blessure du setup profil ?
**Il n'y en a pas** (§1.2). La vraie question : faut-il en ajouter une ?
A. Non · B. **Oui, une seule question en fin de setup** (« Une gêne en ce moment ? » →
Oui, ouvre Mon corps / Non) · C. Un formulaire complet dans le setup.

→ **B.** Un joueur qui s'inscrit en revenant de blessure — cas explicite, puisqu'un
objectif s'appelle « Reprendre apres une blessure » (`ProfileSetupScreen.tsx:98`) —
reçoit aujourd'hui une première séance qui ignore complètement son état. C est trop
lourd pour un setup qui doit rester sous 3 minutes.

### D7 — Échelle de gravité (les mots)
A. Garder Gêne / Modérée / Forte (`constants/injury.ts:18-23`) ·
B. **Ça tire / Ça gêne / Ça m'empêche** (§2.2) · C. Une échelle 1-10.

→ **B.** « Modérée » ne veut rien dire pour un joueur de R2 le dimanche soir ; « ça
m'empêche de forcer dessus », si. **Les valeurs envoyées au backend restent 1/2/3** — on
change les mots, pas les chiffres. C est à écarter : une deuxième échelle numérique à
côté du curseur 0-5 garantit la confusion.

### D8 — Blessures multiples simultanées
A. Une seule à la fois (limite actuelle, §T5) · B. **Autant que déclarées** ·
C. Maximum 2 ou 3.

→ **B.** Techniquement gratuit (le backend reçoit déjà une **liste** `pains[]`) et c'est
la réalité du terrain. Le cas « trop de zones, plus rien de servable » est déjà prévu
côté backend (RF4) — encore faut-il que ce refus s'affiche (D10).

### D9 — Historique visible ?
A. Non · B. **Oui, replié en bas**, liste simple zone + dates ·
C. Oui avec des chiffres (« 4 gênes cette saison »).

→ **B.** Voir que la gêne au genou revient tous les deux mois a une vraie valeur. C est
à écarter : un compteur sur des données saisies au doigt mouillé, c'est un chiffre faux
qui a l'air vrai.

### D10 — Traitement du refus de séance (T1) : lot 1 ou lot 2 ?
A. Lot 1 front seul (ne plus dire « réessaie » quand `safety_flags` est présent) —
utile seulement si le backend fait remonter le corps de sécurité ·
B. **Lot 1, front + correctif backend minimal** (que le refus sorte en erreur typée avec
`code` + `message` au lieu d'être écrasé en 500 `invalid_version`,
`src/index.ts:186-196`) · C. Lot 2, on livre Mon corps d'abord.

→ **B.** Livrer un écran qui encourage à déclarer une douleur forte, en sachant que
cette déclaration produit un écran de panne, c'est construire le piège et l'inaugurer.
Le correctif backend est petit et localisé. Si le calendrier ne le permet pas : **C avec
un contournement explicite** — plafonner ce que « Mon corps » émet en sévérité 3 tant
que le refus n'est pas affichable. Solution que je n'aime pas (elle ment au moteur),
mais moins pire que l'écran de panne.

### D11 — Ajouter la zone « aine / adducteurs » ?
A. **Oui, au lot 1** (le jeton `groin_pain` existe déjà côté backend, §1.5) ·
B. Plus tard.

→ **A.** Zone très commune au football, travail backend déjà fait, coût front de 4
lignes dans un fichier partagé.

---

## 4. Plan d'exécution

### Lot 1 — le minimum livrable (l'espace existe et sert vraiment)

| # | Travail | Fichiers |
|---|---|---|
| 1.1 | Modèle + store | `state/stores/useBodyStore.ts` (nouveau), `state/stores/types.ts`, `domain/types.ts` (ajout `BodyInjury`) |
| 1.2 | Migration `dayStates` → `BodyInjury[]` | `state/migration/migrateInjuries.ts` (nouveau, pur) |
| 1.3 | Reset / snapshot par utilisateur | `state/orchestrators/resetUser.ts` (8ᵉ store) |
| 1.4 | Écran + hook | `screens/MonCorpsScreen.tsx`, `hooks/monCorps/useMonCorpsViewModel.ts`, `hooks/monCorps/monCorpsActions.ts` (l'écran ne lit aucun store) |
| 1.5 | Entrée dans le hub + route | `screens/SessionHubScreen.tsx`, `navigation/RootNavigator.tsx`, `navigation/types.ts` |
| 1.6 | Branchement de la génération | `services/aiContextHelpers.ts` (`collectActivePainConstraints` change de source), `services/aiContext.ts` |
| 1.7 | Alignement des 3 autres lecteurs | `hooks/home/useContextualAdvice.ts`, `state/orchestrators/trackingShadow.ts`, `domain/tracking/replacements/select.ts` (via le contexte) |
| 1.8 | Sortie du détail blessure hors du feedback + passerelle | `screens/FeedbackScreen.tsx`, `screens/feedback/components/PainInjuryRow.tsx`, `screens/feedback/hooks/useFeedbackSave.ts` |
| 1.9 | Zone « aine » (si D11 = A) | `shared/injuryMapping.ts` (**+ copie backend, byte à byte**), `constants/injury.ts` |
| 1.10 | Nettoyage | suppression de `components/InjuryForm.tsx`, des restrictions de `constants/injury.ts`, du schéma mort `schemas/firestoreSchemas.ts:193-223` |
| 1.11 | Dette socle visuel | `screens/SessionHubScreen.tsx` → `<Screen>` |

**Tests à écrire (sentinelles) :**

1. **Une seule lecture des blessures actives** — sur le modèle de
   `domain/__tests__/resumeCanoniqueUnicite.test.ts` : le test lit les sources et
   échoue si un écran ou un hook lit `useBodyStore` directement au lieu de passer par
   `collectActivePainConstraints`. Interdit aussi toute nouvelle lecture de
   `dayStates[...].feedback.injury` hors du module de migration.
2. **Non-régression du payload** — mêmes `pains[]` et même `injury_max_severity` en
   sortie qu'aujourd'hui pour un jeu de cas identique. C'est le test qui prouve que le
   lot 1 ne change rien au moteur. Réutilise les cas de
   `services/__tests__/painConstraints.test.ts`.
3. **Migration idempotente** — la rejouer 3 fois produit exactement la même liste ;
   `dayStates` vide produit une liste vide (et pas un objet de remplissage) ; une
   sévérité 0 historique ne crée aucune gêne.
4. **Frontière coach-safe** — extension de
   `domain/coachView/__tests__/sensitiveIsolation.test.ts` avec une sentinelle
   `bodyInjuries`.
5. **État vide honnête** — le ViewModel renvoie un état « rien de signalé » distinct,
   jamais un compteur à 0 ni une liste factice.
6. **La passerelle ne bloque pas le feedback** — au-dessus du seuil, le feedback est
   enregistré et la charge appliquée **avant** toute proposition ; refuser la
   proposition n'écrit rien.
7. **Pas d'expiration silencieuse** — une gêne de 30 jours sans réponse est **toujours**
   dans `pains[]`.
8. **Parité du fichier partagé** — le test existant
   `shared/__tests__/injuryMapping.parity.test.ts` doit continuer de passer après
   l'ajout de l'aine.

**Estimation lot 1 : 14 à 20 heures-agent**, réparties à peu près ainsi :
modèle + migration + tests 4-5 h ; écran + hooks 4-6 h ; passerelle feedback 2-3 h ;
branchement des 4 lecteurs 2-3 h ; nettoyage + dette visuelle + recette 2-3 h.
Hors correctif backend de D10 (à chiffrer sur l'autre repo).

### Lot 2 — la suite

- Relance par notification locale (`services/notifications.ts` + interrupteur dédié
  dans Settings, avec rollback UI comme les autres).
- « En reprise » transmis au moteur comme information distincte (contrat front↔back,
  mesure, puis activation).
- Textes RGPD : `utils/legalContent.ts` + `docs/appstore/privacy.html` (§2.8), et la
  question du consentement spécifique santé.
- Application de la charte `INJURY_IA_CHARTER.md` restée lettre morte : bandeau
  d'explication quand une séance est aménagée (règle 2), bouton « Je préfère me reposer
  aujourd'hui » (règle 6), disclaimer de bas de séance (règle 7).
- Création de la copie front de `shared/SAFETY_PHRASES.ts` (§T9), prérequis des trois
  points précédents.

### Risques

| Risque | Pourquoi | Parade |
|---|---|---|
| **Migration Zustand persist** | Un nouveau store se réhydrate en parallèle des autres ; la migration doit tourner **après** que `useFeedbackStore` soit hydraté, sinon elle lit un `dayStates` vide et ne migre rien — en silence | Brancher sur `onStoreHydrated` (`state/orchestrators/rehydrate.ts`, déjà utilisé par `useFeedbackStore.ts:160`), drapeau `migratedAt`, et un test qui exécute la migration sur un store non hydraté puis hydraté |
| **Changement d'utilisateur** | `resetUser.ts` liste les stores un par un (`:31-51`, `:131-136`). Oublier le nouveau = les blessures d'un joueur suivent le compte suivant sur le même téléphone. **Fuite de donnée de santé.** | Ajout explicite dans `AllStoresSnapshot` + un test dédié dans `state/orchestrators/__tests__/resetUser.test.ts` |
| **Feedback obligatoire** | Le feedback bloque la génération suivante ; toucher `useFeedbackSave.ts` peut casser ce verrou ou la file hors-ligne (`:289-305`) | Ne rien changer au chemin de sauvegarde : la passerelle vit **après** `onSave`, en pur affichage |
| **Watchers Firestore** | Aucun watcher ne touche `dayStates` aujourd'hui ; le lot 1 n'en ajoute aucun | Écrire la contrainte « aucune écriture Firestore » en tête du store, et l'armer par le test sentinelle n°4 |
| **Fichier partagé front↔back** | `shared/injuryMapping.ts` doit rester identique byte à byte ; l'ajout de l'aine se fait **des deux côtés ou d'aucun** | Ne pas livrer 1.9 sans la PR backend jumelle ; `shared/__tests__/injuryMapping.parity.test.ts` |
| **Jest depuis un worktree** | `npx jest` liste 0 test et sort en SUCCÈS (`testPathIgnorePatterns` exclut `.claude/worktrees/`) — un « tout vert » qui mesure le vide | Config Jest dédiée pour l'exécution ; idem eslint avec le cwd **dans** le worktree |

---

## 5. Ce que je n'ai PAS pu vérifier

1. **Ce qui tourne réellement sur Render.** J'ai lu `origin/main` du backend depuis le
   worktree `readiness3` ; je n'ai pas interrogé la production et ne peux pas affirmer
   que le commit déployé contient le bloc red-flag de `src/fksWorkflow.ts:5281-5331`.
2. **Le trajet du refus RF1/RF2 sur un vrai téléphone.** J'ai suivi le code
   (`output_parsed: null` → `src/index.ts:191-196` → HTTP 500 `invalid_version`) mais
   **je n'ai lancé aucune génération réelle** avec une blessure sévérité 3. Lecture de
   code très probable, non observée.
3. **`recent_fks_sessions[0]` quand une séance est en attente de feedback.** Le store
   empile les plus récentes en tête (`useSessionsStore.ts:38`) et le backend lit
   `recentSessions[0]`, mais je n'ai pas énuméré tous les cas de filtrage
   (`estSeanceArtificielle`, séances `notDone`).
4. **`docs/appstore/privacy.html`** : je sais qu'il mentionne douleurs et blessures,
   je ne l'ai pas lu ligne à ligne.
5. **Le volume réel de données à migrer** chez un joueur existant : je n'ai regardé
   aucun `dayStates` de production (la donnée n'est pas dans Firestore).
6. **Je n'ai lancé ni tests, ni lint, ni TypeScript** — aucun fichier de code n'a été
   modifié, mais je n'ai pas non plus mesuré l'état vert actuel de la suite.
7. **La question juridique du consentement spécifique santé** (§2.8, point 6) : je la
   pose, je ne la tranche pas.
8. **Aucune donnée d'usage.** Je ne sais pas combien de joueurs déclarent une blessure
   ni à quelle fréquence. Tout ci-dessus vient du code et de la logique du terrain,
   jamais de chiffres que je n'ai pas.

---

## 6. ERRATA — contre-vérification adversariale du 01/09/2026

Le document ci-dessus a été contre-vérifié ligne à ligne par un second agent (≈40 citations
échantillonnées, toutes exactes à trois numéros de ligne près ; les 9 « surprises » du §1
confirmées). Le point 1 du §5 est LEVÉ : la production Render tourne sur `b2c3351`
(`/ready` vérifié le 01/09 au soir), qui contient le bloc red-flag. Le point 2 du §5 est
LEVÉ aussi : le refus a été rejoué avec les fonctions réelles du backend (sans appel
payant) — curseur 4/5 → 8/10 → `RF1_pain_recent_high`. **T1 est un bug de production
actif.** Quatre corrections de fond s'imposent ; l'ancien texte reste lisible plus haut,
il n'est pas effacé.

**Erratum 1 — T2/T3 : le blocage RF1 est DÉFINITIF, pas « 7 jours ».**
~~La fenêtre de 7 jours finit par libérer le joueur.~~ C'est vrai pour `pains[]` /
`injury_max_severity` (RF2, fenêtre `INJURY_ACTIVE_WINDOW_DAYS = 7`,
`services/aiContextHelpers.ts:616`), **faux pour RF1** : le backend lit
`recentSessions[0].feedback.pain` (`src/fksWorkflow.ts:5283-5292`) **sans aucune borne de
temps**, et cette valeur ne peut jamais être rebaissée — `applyFeedback` refuse toute
séance déjà complétée (`state/orchestrators/applyFeedback.ts:54`), les séances ne se créent
que par la génération (bloquée), les charges externes n'en créent pas, et `feedback.pain`
est synchronisé dans Firestore donc survit à une réinstallation
(`state/stores/persistHelpers.ts:175`). Un joueur qui a mis 4/5 ou 5/5 à son dernier
feedback ne génère plus jamais de séance, et lit « service indisponible » à chaque essai.

**Erratum 2 — D10 : l'option C est RETIRÉE.**
~~C avec un contournement explicite — plafonner ce que « Mon corps » émet en sévérité 3.~~
Ce contournement n'agit que sur RF2 (sévérité). Le déclencheur mesuré est **RF1**, produit
par le curseur douleur du feedback — que le §2.4 laisse volontairement en place, hors de
« Mon corps ». Il n'y a donc **pas de filet** derrière C. **B est la seule option
défendable**, et elle doit passer AVANT tout écran « Mon corps ». Argument supplémentaire
en faveur de B : le même écrasement en 500 frappe `missing_goal`
(`src/fksWorkflow.ts:5270-5275`), pour lequel le front porte déjà une branche morte
(`screens/newSession/echecGeneration.ts:199`) — le correctif backend répare deux chemins.
Le correctif doit venir avec un **test de transport HTTP** du refus (`safety_no_session`
n'apparaît qu'une fois dans tout le backend, `fksWorkflow.ts:5322`, et aucun test ne garde
la réponse HTTP — c'est le seul test qui aurait attrapé ce bug).

**Erratum 3 — §1.3 et §2.8 point 3 : la douleur QUITTE l'appareil.**
~~« La donnée de santé ne quitte jamais l'appareil » / « écrire dans la politique que ces
données restent sur l'appareil ».~~ Vrai pour la blessure détaillée (`dayStates.injury`,
jamais écrite dans Firestore), **faux pour la douleur par séance** : `feedback.pain` part
vers `users/{uid}/sessions` (`persistHelpers.ts:175` → `useSyncStore.ts:135-137` →
`repositories/sessionsRepo.ts:143-157`), et la politique de confidentialité la liste déjà
comme donnée de santé (`utils/legalContent.ts:51`). **Ne pas écrire** « reste sur
l'appareil » dans la politique : ce serait une inexactitude opposable. La frontière
coach-safe, elle, ne repose pas sur cette phrase mais sur la projection serveur
(`functions/src/dto.ts`, rules, `sensitiveIsolation.test.ts:126-133`) — elle reste étanche.

**Erratum 4 — §2.3 vs §2.6 : contradiction à trancher (tests #2 et #7 du §4).**
Le §2.6 promet « rien ne change côté backend, mêmes `pains[]` » (sentinelle #2) ; le §2.3
promet « plus de fenêtre glissante, on lit les statuts » et la sentinelle #7 exige qu'une
gêne de 30 jours sans réponse soit **toujours** dans `pains[]`. Aujourd'hui elle n'y est
pas. **Les deux ne peuvent pas être verts en même temps.** Décision à ajouter (D12) : le
lot 1 conserve-t-il le payload à l'identique (alors #7 saute et la relance à 7 jours n'a
pas d'effet moteur) ou change-t-il le payload (alors #2 saute et il faut mesurer l'effet
sur les pools) ? Risque associé, non listé dans le doc : supprimer l'expiration à 7 jours
**élargit** la population sous RF2 permanent — donc sous l'écran de panne — tant que T1
n'est pas corrigé. Raison de plus pour que B (erratum 2) précède tout.

**Erratum mineur — §2.4 :** l'audit (§1.6) identifie le curseur douleur comme le
déclencheur du refus ; la proposition le laisse en place sans avertissement joueur ni
lien vers le refus. À traiter dans le lot 1 de B : quand le refus s'affiche, dire
franchement « c'est ta douleur du dernier feedback qui déclenche le repos », et offrir la
voie de sortie (mise à jour de l'état → « Mon corps », ou en attendant : une action
« mon état a changé » explicite).

**Vétilles de numéros de ligne** (sans effet) : `schemas/firestoreSchemas.ts:193-223` →
réel `198-223` ; `useContextualAdvice.ts:124-127` → réel `125-128` ;
`firestore.rules:665-666` → réel `~658`. L'estimation « 14 à 20 heures-agent » du §4 n'a
pas de méthode déclarée : la lire comme un ordre de grandeur, pas comme un chiffre.

---

## 7. DÉCISIONS PRISES — 01/09/2026 (délégation explicite de Kyllian à l'orchestrateur : « prends les meilleures pour FKS »)

| # | Décision | Choix retenu | Pourquoi |
|---|---|---|---|
| D1 | Nom de l'espace | **« Mon corps »** | Mot de joueur, pas de jargon médical ; dit ce que c'est sans promettre un diagnostic. |
| D2 | Emplacement | **Onglet Séance** : carte en haut de `SessionHubScreen`, au-dessus du bouton de génération, + écran plein en route stack | Rituel d'avant-séance (« je vérifie mon état, puis je génère »). Profil = identité stable, pas l'état du jour. |
| D3 | Seuil de la passerelle feedback | **3/5** (= `TRACKING_CONFIG.pain.feedbackThreshold` existant) | Un chiffre = une implémentation ; ≥3 = douleur réelle d'après la constante déjà commentée. |
| D4 | Cycle de statut | **3 états : active / en reprise / guérie** | Éviter une seconde migration ; « en reprise » est l'état réel d'un footballeur amateur les 2/3 du temps. |
| D5 | Relance | **In-app à 7 jours** (carte question « toujours gênant ? » sur le hub Séance et avant génération) ; **sans réponse la gêne reste active** ; notification locale = lot 2 | Jamais d'expiration silencieuse. Le push est un canal fragile (permissions), l'in-app est certain. |
| D6 | Question blessure du setup profil | **Le setup écrit dans Mon corps** (une seule source), formulaire séparé supprimé | Règle « un chiffre = une implémentation » appliquée aux blessures. |
| D7 | Échelle de gravité (mots joueur) | **1 « Gêne légère — je peux jouer » · 2 « Douleur nette — je m'adapte » · 3 « Blessure — je ne peux pas jouer »** | Chaque cran dit ce qu'il déclenche ; le 3 annonce honnêtement qu'il n'y aura pas de séance (RF2). |
| D8 | Blessures multiples | **Oui, liste** | Le backend accepte déjà `pains[]` ; l'objet unique était une limite front, pas produit. |
| D9 | Historique | **Visible, replié** (guéries en bas, dépliable) | Utile au joueur et au futur « Mon corps » coach-safe ; coût nul si replié. |
| D10 | Refus de séance | **B — FAIT le 01/09** (`fix/refus-securite-transport` 2a68aa0 + `fix/refus-securite-front` ddee2e9, mis en prod le même soir) | Voir erratum 2 : seule option défendable. |
| D11 | Zone aine / adducteurs | **Oui, lot 1** (`groin_pain`) | Pubalgie = blessure n°1 du footballeur amateur ; backend prêt, 4 lignes front. |
| D12 | Le lot 1 change-t-il le payload ? | **OUI** : `pains[]` est piloté par le STATUT, plus par la fenêtre 7 jours. Active → envoyée avec sa gravité ; en reprise → envoyée en gravité 1 (zone à ménager) ; guérie → absente. Sentinelle #7 conservée, #2 remplacée par « le payload reflète le statut ». Effet sur les pools à MESURER avant merge (masstest côté backend non requis : format inchangé, seule la population des zones change). | Le filet de sécurité existe désormais : le refus est honnête (D10) ET le joueur a une porte de sortie (baisser sa gravité dans Mon corps). Sans D12, la relance de D5 n'aurait aucun effet moteur. |
| RGPD | Textes | **Lot 1 = politique de confidentialité recalée honnêtement** (`utils/legalContent.ts`) : douleur par séance synchronisée sur nos serveurs, détail des blessures stocké sur l'appareil uniquement ; **aucune phrase « reste sur l'appareil » globale**. Consentement spécifique santé + mineurs = question juridique hors app, lot 2. | Erratum 3. On n'écrit rien de faux, on n'invente pas un dispositif juridique dans un écran. |
| Sync | Firestore | **Lot 1 = local uniquement** (`bodyInjuries` hors Firestore), test `sensitiveIsolation` étendu | Frontière coach-safe intacte par construction ; la perte au changement de téléphone est acceptée et DITE dans l'écran (une ligne). |

**Périmètre lot 1 (front uniquement, aucune modification backend)** : modèle `BodyInjury` + slice de store persistée + migration idempotente des `dayStates.injury` (7 derniers jours → statut active) ; écran « Mon corps » + carte hub ; passerelle feedback ≥3/5 (non bloquante) ; `collectActivePainConstraints` réécrit sur le statut (SEULE lecture) ; relance in-app 7 j ; zone aine ; setup profil branché sur la même source ; suppression de `InjuryForm.tsx` et des constantes orphelines ; politique de confidentialité recalée ; sentinelles : une seule lecture des blessures actives, frontière coach-safe, migration idempotente, état vide honnête, payload = statut, aucun chiffre inventé.
