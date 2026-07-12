# Parcours d'inscription FKS — Design doc (design + copy, pas de code)

**Date** : 2026-07-12
**Statut** : design livré, PAS implémenté
**Branche** : `docs/onboarding-design` (front)
**Contexte produit** : dans 4-6 semaines, des joueuses de 3 équipes (U15 / U18 / D1) s'inscrivent —
la plupart avec un code club, sur recommandation du coach, souvent sur le parking après
l'entraînement. Kyllian fera aussi des démos d'inscription **en direct** devant des clubs.

**Objectif chiffré** : de l'ouverture de l'app à la **première séance générée en < 3 minutes**.

---

## 0. TL;DR

Le flow actuel (Welcome → Register → ProfileSetup **5 étapes** → Home) est solide techniquement
(validation live, shake, mapping d'erreurs FR, auto-assign du cycle) mais trop long et mal
orienté pour le cas majoritaire : le **code club est enterré** dans un champ optionnel de
l'étape 1, validé **seulement au save final** (retour à l'étape 1 en cas d'erreur), et il ne
préremplit **rien**. Deux étapes entières (29 cases de matériel) répondent à une question que
l'app repose de toute façon à chaque génération.

**Cible** : Welcome → Register (3 champs) → Setup **4 micro-étapes** (Club → Toi → Objectif →
Semaine, 100 % chips après le Register) → **écran "Ton programme est prêt"** (idée reprise de
`wip/tender-blackwell`, ré-implémentée) → première génération. Budget : **~2 min 30**.

`wip/tender-blackwell` : les **idées** sont bonnes (étapes fusionnées, écran de reco), le
**code** est inutilisable comme base (voir §3). On re-implémente sur main.

**Livrable choisi** : ce doc vit dans le **front** (`docs/onboarding-design.md`, branche
`docs/onboarding-design`) — tous les fichiers cités, le copy et les écrans sont côté front ;
`src/dev/` backend est réservé aux docs moteur.

---

## 1. État des lieux honnête du flow actuel

### 1.1 Le flow, écran par écran (main @ `c360973`)

```
Welcome (3 slides swipeables, flag AsyncStorage "fks_welcome_done")
  └─ "Commencer" → Register   |   "J'ai déjà un compte" → Login
Register (prénom optionnel, email, mdp ≥6, checkbox RGPD)
  └─ createUser + users/{uid} { profileCompleted: false } → RootNavigator bascule
ProfileSetup — 5 étapes :
  É1 Identité : prénom (re-demandé), code club (optionnel), poste ×4, catégorie ×5,
                niveau ×5, pied fort ×3, lien "staff → crée ton club"
  É2 Objectif : carte cycle (porte vers CycleModal), objectif ×4, séances FKS/sem ×4
  É3 Club     : entraînements oui/non → jours + NB AU CLAVIER, matchs/sem AU CLAVIER + jours
  É4 Salle    : accès ×3 → matériel salle (15 cases, ≥1 OBLIGATOIRE)
  É5 Matériel : oui/non → matériel maison (14 cases, ≥1 obligatoire si oui)
  Save : lookup code club (⚠️ premier feedback sur le code), auto-assign cycle reco,
         toast "Profil enregistré" → Home
Home → CTA "Préparer ma séance" → NewSession (lieu → valider contexte → générer, 25 s de barre)
```

Les "onboarding slides" post-setup du CLAUDE.md n'existent plus : Welcome les a absorbées
([WelcomeScreen.tsx:24](../screens/WelcomeScreen.tsx) — 3 slides pré-auth).

### 1.2 Ce qui est déjà bien (à conserver tel quel)

| Quoi | Où |
|---|---|
| Bouton submit désactivé tant que champs invalides + validation email live | [RegisterScreen.tsx:65](../screens/RegisterScreen.tsx), :195 |
| Shake + haptic + toast sur erreur | [RegisterScreen.tsx:67-71](../screens/RegisterScreen.tsx), [utils/animations.ts](../utils/animations.ts) |
| Mapping erreurs Firebase → messages FR clairs | [RegisterScreen.tsx:34-49](../screens/RegisterScreen.tsx), [LoginScreen.tsx:37-52](../screens/LoginScreen.tsx) |
| Jauge de force du mot de passe + œil afficher/masquer | [RegisterScreen.tsx:139-141](../screens/RegisterScreen.tsx), :215 |
| "Compte créé mais setDoc échoué" ne montre PAS un faux échec | [RegisterScreen.tsx:117-126](../screens/RegisterScreen.tsx) |
| Zéro re-login après inscription (RootNavigator bascule seul) | [RegisterScreen.tsx:111-112](../screens/RegisterScreen.tsx) |
| Consentement RGPD explicite, légal consultable AVANT compte | [RegisterScreen.tsx:242-267](../screens/RegisterScreen.tsx), [RootNavigator.tsx:285-305](../navigation/RootNavigator.tsx) |
| Back Android = étape précédente (pas quitter l'app) | [ProfileSetupScreen.tsx:304-314](../screens/ProfileSetupScreen.tsx) |
| "Changer de compte" visible pendant le setup | [ProfileSetupScreen.tsx:642-650](../screens/ProfileSetupScreen.tsx) |
| Prefill prénom avec fallback displayName (course getDoc/setDoc gérée) | [ProfileSetupScreen.tsx:173-211](../screens/ProfileSetupScreen.tsx) |
| Auto-assign du cycle recommandé au save (zéro étape morte) | [ProfileSetupScreen.tsx:335-339](../screens/ProfileSetupScreen.tsx) |
| Champs dépendants nettoyés quand le parent change | [ProfileSetupScreen.tsx:213-233](../screens/ProfileSetupScreen.tsx) |
| Défauts matériel salle à la génération ("Inclus par défaut", `gym_full`+`bodyweight` si vide) | NewSessionScreen.tsx:370-377 |

### 1.3 Les frictions (avec preuves)

**F1 — Le code club est un champ de formulaire, pas un parcours.**
Champ texte optionnel au milieu de l'étape 1 ([ProfileSetupScreen.tsx:453-461](../screens/ProfileSetupScreen.tsx)),
validé **uniquement dans `handleSave`** ([:348-359](../screens/ProfileSetupScreen.tsx)) : une
joueuse qui se trompe de code le découvre **après avoir répondu à tout**, et l'écran la renvoie
à l'étape 1 (`animateTransition(0)`, :354). Punition maximale pour le cas majoritaire.
Et le code ne préremplit rien : le doc club ne contient que `name / inviteCode / ownerUid`
([clubsRepo.ts:89-95](../repositories/clubsRepo.ts)) — ni catégorie, ni niveau, ni jours.

**F2 — 5 étapes, ~25 décisions, dont 29 cases de matériel.**
É4+É5 = 29 items ([ProfileSetupScreen.tsx:77-110](../screens/ProfileSetupScreen.tsx)) avec
**≥1 case obligatoire** (:281, :285) — bloquant si la joueuse ne connaît pas le matériel de sa
salle. Or la génération repose la question du lieu/matériel **à chaque séance** avec de bien
meilleurs défauts (salle = "Inclus par défaut", zéro coche, NewSessionScreen.tsx:370-377 ;
prefill depuis le profil via `aiContext`, newSession/hooks.ts:52-56). Le setup fait donc payer
d'avance un choix que l'app sait déjà poser au bon moment.

**F3 — Deux saisies clavier numériques en plein milieu** ("ex: 3", "ex: 1",
[ProfileSetupScreen.tsx:555](../screens/ProfileSetupScreen.tsx), :563). Ouvrir un pavé
numérique sur un parking pour taper "2" est absurde quand des chips font le job.

**F4 — Le prénom est demandé deux fois** (Register :168, puis É1 :443-451 — prérempli mais
re-présenté comme premier champ à vérifier).

**F5 — La carte cycle de l'É2 est une porte de sortie** ([ProfileSetupScreen.tsx:501-515](../screens/ProfileSetupScreen.tsx)) :
elle ouvre `CycleModal` en plein questionnaire alors que l'auto-assign existe déjà au save.
Moment de doute garanti ("je dois choisir un cycle maintenant ?").

**F6 — Le moment magique n'existe pas.** Fin du setup = toast "Profil enregistré.
Configuration terminée !" (:393) et atterrissage sur le Home. Le cycle recommandé est assigné
**en silence** (:376-390). Rien ne met en scène "l'app a compris qui tu es".

**F7 — Funnel aveugle.** Aucun event entre `login_success` et `session_generate_start` :
pas de `register_success`, rien par étape du setup (grep `trackEvent` : LoginScreen,
CycleModal, NewSession, feedback — c'est tout). L'objectif "< 3 min" n'est pas mesurable.

**F8 — Micro-incohérences.**
- `STORAGE_KEYS.ONBOARDING_DONE` (`"fks_onboarding_done"`, [constants/storage.ts:12](../constants/storage.ts))
  est **mort** — la vraie clé `"fks_welcome_done"` est codée en dur dans
  [WelcomeScreen.tsx:87](../screens/WelcomeScreen.tsx) et [RootNavigator.tsx:118](../navigation/RootNavigator.tsx).
- Placeholder code club `"Ex: FKSFC-2026"` (:456) ne ressemble pas aux codes réellement
  générés (`PREFIX-1234`, 4 lettres + 4 chiffres, [clubsRepo.ts:49-56](../repositories/clubsRepo.ts)).
- Le sous-titre du CTA Home promet "un programme adapté en 2 min"
  (hooks/home/usePrimaryCta.ts:238-244) — la promesse existe déjà, le flow ne la tient pas.

### 1.4 Budget interactions actuel (profil "joueuse avec code club")

| Segment | Interactions | Clavier | Temps réaliste |
|---|---|---|---|
| Welcome | 1 tap | — | 5-10 s |
| Register | 3 champs + checkbox + 1 tap | email + mdp (+ prénom) | 45-60 s |
| É1 Identité | prénom (vérif) + code club (saisie) + 4 chips + Suivant | code club | 40 s |
| É2 Objectif | 2 choix + Suivant (+ tentation CycleModal) | — | 20 s |
| É3 Club | 2 chips + 2-3 jours + **2 saisies pad** + Suivant | ×2 | 35 s |
| É4 Salle | 1 chip + 3-8 cases + Suivant | — | 30 s |
| É5 Matériel | 1 chip + 3-6 cases + Terminer | — | 25 s |
| Home → génération | 1 + 3 taps + attente 25 s | — | 45 s |
| **Total** | **~35-40 interactions** | **4-5 saisies** | **~4 min 30 - 5 min** |

Et le risque d'erreur de code club en toute fin ajoute potentiellement 1 minute et de la honte
devant le coach. En démo live, c'est le moment où on perd la salle.

---

## 2. Ce qu'on garde de la mécanique existante (non négociable)

- Le **gating** RootNavigator (`profileCompleted` via onSnapshot, pont local
  `onProfileCompleted`) : [RootNavigator.tsx:426-454](../navigation/RootNavigator.tsx). On ne
  touche pas à la machine à états auth.
- L'**auto-assign du cycle** au save ([ProfileSetupScreen.tsx:335-339](../screens/ProfileSetupScreen.tsx)) :
  l'écran de reco (§5) le **met en scène**, il ne le remplace pas. Si la joueuse ferme l'app
  sur l'écran de reco, elle a quand même un cycle actif.
- Le **mode édition** du ProfileSetupScreen (`isEditMode`, :133-134) : l'écran sert aussi
  d'édition depuis Profil. La refonte doit le préserver (voir garde-fous §8).
- Les **valeurs persistées sans accents** (`positions`/`levels`/`objectives`) comparées à des
  allowlists côté Cloud Functions — libellés accentués via display maps UNIQUEMENT
  (:61-75). C'est l'erreur exacte que tender-blackwell commettait.

---

## 3. Évaluation de `wip/tender-blackwell` (0ab8545)

Diff réel vs sa base : `screens/ProfileSetupScreen.tsx` uniquement (+ un fichier session
sans rapport). Contenu : fusion 5→3 étapes + écran de reco post-save.

**Idées à reprendre :**
1. **L'écran de reco de cycle post-save** ("On a un programme pour toi", carte cycle, raisons
   cochées, CTA "C'est parti !", lien "Voir tous les programmes"). C'est LE bon candidat
   moment magique — on le reprend en le renforçant (§5).
2. **La direction "moins d'étapes"** — mais sa fusion garde les 29 cases de matériel (étape 3
   "Ton matériel" = salle + maison concaténées). Nous, on **supprime** le contenu, pas juste
   les frontières d'étapes (§4.3).

**Pourquoi le code est inutilisable comme base :**

| Problème | Détail |
|---|---|
| Base git périmée (branche de fév-mars) | merge-base `1bb6d29`, antérieur au retrait du mode coach, à `ageCategory`, au `Screen` wrapper |
| Réintroduit `selectedMode` joueur/coach | supprimé de main (pivot B2C) |
| Ignore `ageCategory` | champ devenu obligatoire sur main (dosage par âge backend) |
| ⚠️ Remet les accents DANS les valeurs persistées (`"Défenseur"`, `"Régional"`, `"Être en forme..."`) | casse les allowlists Cloud Functions ET le matching `recommendMicrocycle` — main a résolu ça proprement via display maps |
| Supprime le champ code club (`clubInviteCode` gardé en variable morte) | à l'opposé du besoin : le code club est le cas majoritaire |
| Dépend de `components/auth/AuthBackground` | n'existe plus sur main |
| Écrase les fix récents de main | validation `trainings ≥ 1`, retour étape club sur code invalide, prefill race, BackHandler |

**Verdict : on récupère les 2 idées, zéro cherry-pick.** Ré-implémentation sur main
(plan §7). La branche peut rester comme archive d'inspiration.

---

## 4. Le parcours cible, écran par écran

Structure : **Welcome → Register → Setup 4 micro-étapes → Reco → Première génération.**

> **Choix "4 micro-étapes" (vs 3 denses à la tender-blackwell)** : chaque étape tient sans
> scroll et se remplit en 10-20 s — l'élan "tap-tap-Suivant" compte plus que le chiffre du
> compteur d'étapes. *Alternative écartée : 3 étapes denses — écrans à rallonge qui scrollent,
> sensation de formulaire administratif.*

### 4.0 Vue d'ensemble et budget cible

| Écran | Joueuse AVEC code club | Joueur solo | Temps cible |
|---|---|---|---|
| Welcome | 1 tap "Commencer" | idem | 5 s |
| Register | prénom + email + mdp + consentement | idem | 45-60 s |
| É1/4 Ton club | saisie code → ✓ nom du club → "Rejoindre" | 1 tap "Je m'entraîne en solo" | 15 s / 3 s |
| É2/4 Toi sur le terrain | 4 groupes de chips | idem | 15-20 s |
| É3/4 Ton objectif | 2 groupes (objectif + séances/sem) | idem | 10-15 s |
| É4/4 Ta semaine | 3-4 groupes de chips, zéro clavier | idem (souvent "Aucun" partout) | 15-25 s |
| Reco "Ton programme est prêt" | lecture + 1 tap "Lancer ma première séance" | idem | 10 s |
| NewSession | lieu (1 tap) → valider (1) → générer (1) | idem | 10 s + **25 s de barre** |
| **Total** | | | **~2 min 30** |

**~18-22 interactions, zéro clavier après le Register** (sauf le code club, court et validé
immédiatement). Contre ~35-40 aujourd'hui.

### 4.1 Welcome — inchangé structurellement

3 slides + CTA, le flag `fks_welcome_done` et le routage Register/Login restent
([RootNavigator.tsx:270-282](../navigation/RootNavigator.tsx)). Seul le copy des slides bouge (§6.1).

> *Alternative écartée : champ code club directement sur Welcome (pré-auth) — exigerait
> d'ouvrir la lecture `clubs` aux non-authentifiés (énumération de codes, élargissement des
> rules Firestore fraîchement verrouillées par P0.1). Le code arrive 60 s plus tard, post-auth,
> sans toucher aux rules.*

### 4.2 Register — 3 champs, prénom devient requis

Identique à aujourd'hui, avec deux changements :
1. **Prénom requis** (aujourd'hui optionnel) et **retiré du setup** — demandé UNE fois, là où
   le clavier est déjà ouvert. Tout le copy aval se personnalise ("Léa, ton poste ?").
   *Alternative écartée : prénom au setup (statu quo) — demandé deux fois, et l'É2 perdrait
   son statut "que des chips".*
2. Sous-titre = **la promesse** : "2 minutes et ta première séance est prête." (cohérent avec
   le CTA Home existant qui promet déjà "2 min", usePrimaryCta.ts:240).

Tout le reste est conservé : validation live, jauge mdp, consentement, mapping erreurs,
comportement "compte créé malgré erreur réseau".

### 4.3 Setup É1/4 — « Ton club » (NOUVEL écran, cœur du design)

Premier écran post-inscription. Un seul champ, deux issues.

**Comportement :**
- Saisie du code (autocapitalize, normalisation `normalizeInviteCode` existante,
  [clubsRepo.ts:33-38](../repositories/clubsRepo.ts)).
- **Validation immédiate** : `findClubByInviteCode` au tap sur "Rejoindre" (ou debounce ~600 ms
  dès que le format `XXXX-0000` est atteint). L'utilisateur est authentifié → aucune ouverture
  de rules nécessaire (le save actuel fait déjà ce lookup post-auth, :349).
- **Succès** : carte de confirmation "✓ {Nom du club}" + CTA devient "Rejoindre {nom}".
  Le rattachement (`setClubMembership`) se fait **au save final** comme aujourd'hui — l'étape
  ne fait que valider et mémoriser (pas d'écriture avant `profileCompleted`).
- **Échec** : message inline sous le champ (pas un toast) + on peut réessayer OU continuer en
  solo. **Plus jamais d'erreur de code au save final** ; si le club a disparu entre l'étape et
  le save (cas rarissime), le save n'échoue pas : toast d'info et rattachement re-tentable
  depuis Profil (§8, G9).
- **Sortie solo** : lien "Je m'entraîne en solo" → étape suivante, zéro friction.
- Le lien staff ("Tu es coach ? Crée ton club" → `CoachOnboarding`) migre ici — c'est l'écran
  "club", sa place naturelle (aujourd'hui perdu en bas de l'É1 identité, :487-494).

**Ce que le code préremplit :**
- **Aujourd'hui (P1)** : le nom du club dans tout le copy aval ("Bienvenue au {club}"),
  le rattachement, et la suppression du risque d'erreur tardive. C'est tout ce que le modèle
  de données permet ([clubsRepo.ts:24-29](../repositories/clubsRepo.ts)).
- **Demain (P2, lot 5)** : des **réglages d'équipe posés une fois par le coach** (catégorie,
  niveau, jours d'entraînement, jour de match habituel) → É2 et É4 passent en "confirme ou
  corrige" (chips présélectionnées) au lieu de "réponds". Et `teamGender` (déjà en base,
  clubsRepo.ts:305-307) permet de **féminiser les libellés de postes à l'affichage**
  (Gardienne / Défenseuse / Milieu / Attaquante) via display map — jamais les valeurs.
  Détail au §7 lot 5.

> *Alternative écartée : garder le code dans l'écran identité (statu quo) — validation tardive,
> pas de personnalisation, et le cas majoritaire reste un champ secondaire.*
> *Alternative écartée : rattacher le club immédiatement à l'étape (écriture membership avant
> la fin du setup) — créerait des memberships fantômes si la joueuse abandonne le setup.*

### 4.4 Setup É2/4 — « Toi sur le terrain »

4 groupes de chips, aucun champ texte (le prénom vient du Register ; en cas de prénom vide —
compte ancien — le champ apparaît en tête, comportement fallback).

- **Poste** ×4 (valeurs persistées inchangées : `Gardien/Defenseur/Milieu/Attaquant`).
- **Catégorie** ×5 (`U13/U15/U17/U18/Senior`, [domain/types.ts:23](../domain/types.ts)).
- **Niveau** ×5, avec un **hint** : "Le niveau de ton équipe cette saison." (une U15 R1 doit
  pouvoir répondre "Régional" sans réfléchir).
- **Pied fort** ×3.
- **Si U13 ou U15 sélectionné** : encart accord parental (voir §5bis RGPD) avec une case à
  cocher dédiée. Non affiché sinon.

Le poste passe en chips (2 colonnes) au lieu de 4 lignes `Choice` pleine largeur — densité
sans scroll. La catégorie garde ses chips actuelles.

### 4.5 Setup É3/4 — « Ton objectif »

- **Objectif principal** ×4 (cartes actuelles, display labels accentués conservés).
  C'est l'entrée du `recommendMicrocycle` ([domain/recommendMicrocycle.ts:32-44](../domain/recommendMicrocycle.ts)) —
  il alimente directement l'écran de reco qui suit.
- **Séances FKS / semaine** chips 1-4 + hint : "2 ou 3, c'est le rythme idéal pour progresser
  sans te cramer."
- **La carte cycle disparaît** (F5) : plus de porte vers CycleModal en plein setup. Le cycle
  arrive à l'écran de reco, au bon moment.

> *Alternative écartée : fusionner objectif dans l'É2 (comme tender-blackwell) — 6 groupes sur
> un écran, scroll garanti ; et l'objectif mérite son écran : c'est la question qui pilote la
> reco.*

### 4.6 Setup É4/4 — « Ta semaine »

Tout en chips, zéro pavé numérique (F3) :

- **Entraînements club / semaine** : chips `Aucun · 1 · 2 · 3 · 4+`
  (remplace oui/non + saisie ; `hasClubTrainings` et `clubTrainingsPerWeek` se déduisent :
  Aucun → `"non"`/0, sinon `"oui"`/n, `4+` → 4).
- **Quels jours ?** chips L→D (si ≥1). Multi-select existant conservé.
- **Tes jours de match** : chips L→D multi-select + chip exclusive "Pas de match en ce moment".
  `matchesPerWeek` = nombre de jours cochés (0 si "pas de match") — couvre le cas 2 matchs
  sans champ numérique. Miroir legacy `matchDay = matchDays[0]` conservé (:370).
- **Accès à une salle de muscu ?** chips `Oui, régulièrement · De temps en temps · Non`
  (conserve `hasGymAccess`, consommé par le contexte IA).
- **Les 29 cases de matériel disparaissent du setup.** Le lieu + matériel se choisissent à la
  **première génération**, là où l'app a déjà les bons défauts : salle = "Inclus par défaut"
  (zéro coche, forcé `gym_full`+`bodyweight` si vide, NewSessionScreen.tsx:370-377), maison =
  cocher ce qu'on a, terrain = switch petit matériel (EquipmentSelector.tsx:87-104). Les champs
  `gymEquipment`/`homeEquipment` du profil restent éditables en mode édition Profil et peuvent
  être alimentés en retour par les choix de génération (P3, lot 6).

> *Alternative écartée : fusionner salle+maison en une étape (tender-blackwell) — on garde les
> 29 cases au pire moment. La vraie réponse est de ne pas les montrer à l'inscription.*
> *Alternative écartée : supprimer aussi la question d'accès salle — elle coûte 1 tap et
> `hasGymAccess` nourrit le contexte IA + la reco de lieu ; la retirer changerait le payload
> backend pour zéro gain.*

**Save (bouton "Terminer")** : identique à aujourd'hui (setDoc merge + auto-assign cycle +
`profileCompleted: true`) mais :
- plus AUCUNE validation matériel (:279-286 supprimées) ;
- **sauvegarde incrémentale** : chaque "Suivant" fait un `setDoc merge` silencieux des champs
  de l'étape (sans `profileCompleted`) → une joueuse interrompue sur le parking reprend où
  elle en était (le prefill `getDoc` existant :180-206 fait déjà la moitié du travail).
  *Alternative écartée : tout garder en state local (statu quo) — un appel/étape est trivial
  et l'interruption est LE scénario parking.*

### 4.7 Après le save : voir §5 (moment magique).

---

## 5. Le moment magique — « Ton programme est prêt »

Écran plein (pas un toast), affiché à la place de l'actuel `toast + Home` (F6). Reprend l'idée
tender-blackwell, avec trois différences : titre personnalisé (prénom + club), raisons
construites depuis le profil réel, et **le CTA mène à la séance, pas au Home** — le moment
magique, c'est la séance, pas l'attribution d'un cycle.

**Contenu :**
1. Icône du cycle (gradient accent existant).
2. Titre : "{Prénom}, ton programme est prêt" (+ sous-ligne "{Nom du club}" si rattachée).
3. **Carte cycle** : label + subtitle du cycle ([domain/microcycles.ts:57-147](../domain/microcycles.ts),
   ex. "Duels & puissance — Plus solide dans les duels, plus de puissance utile") + 3 raisons
   cochées ✓, construites côté front depuis le profil (pas de changement du moteur de reco) :
   - "Ton objectif : {objectif affiché}"
   - "Calé sur tes {n} séances par semaine" (+ ", autour de tes entraînements club" si club)
   - "12 séances, adaptées à ta catégorie {catégorie}"
4. **CTA primaire : "Lancer ma première séance"** → `GenerateSession` (NewSessionScreen).
   Le cycle est DÉJÀ actif (auto-assign au save conservé) : pas de gate CycleModal
   (NewSessionScreen.tsx:315-323 ne se déclenche pas).
5. Lien discret : "Voir tous les programmes" → `CycleModal` mode select (l'écran existant
   affiche déjà "Recommandé pour ton profil" + badge, CycleModalScreen.tsx:274-296).
6. Lien encore plus discret : "Plus tard" → Home (on ne séquestre personne).

**Enchaînement génération** : NewSession tel quel — lieu (1 tap) → "Valider le contexte" (1) →
"Générer une séance pour {lieu}" (1) → barre 25 s (LoadingOverlay, étapes qui défilent toutes
les 4 s, plafonnée à 95 %, LoadingOverlay.tsx:113-232) → **SessionPreview**. La joueuse repart
du parking avec sa séance de demain sous les yeux. En démo, Kyllian termine sur une séance
concrète, pas sur un dashboard vide.

> *Alternative écartée : générer automatiquement une séance pendant l'écran de reco (zéro tap) —
> il faudrait choisir lieu/matériel à sa place ; se tromper de lieu sur la PREMIÈRE séance
> (salle alors qu'elle s'entraîne dans son salon) casserait la confiance au pire moment. Le
> choix du lieu est le seul choix qui mérite de rester.*
> *Alternative écartée : le statu quo (auto-assign silencieux + toast) — fonctionnellement
> équivalent, émotionnellement nul.*

---

## 5bis. Quoi demander quand — progressive disclosure & RGPD

### Le principe : 3 cercles

| Cercle | Quand | Quoi |
|---|---|---|
| **Vital** (inscription) | Register + 4 étapes | email, mdp, prénom, code club (opt.), poste, catégorie, niveau, pied, objectif, séances/sem, semaine club/match, accès salle |
| **Au premier usage** | 1ʳᵉ génération | lieu du jour, matériel réel (avec défauts intelligents) |
| **Au fil de l'eau** | contexte | douleurs/blessures (génération + feedback), tests terrain, matériel détaillé (Profil), notifications (après 1ʳᵉ séance, jamais avant le login — déjà le cas) |

Tout ce qui sort du cercle vital reste accessible en mode édition Profil (l'écran actuel,
préservé).

### RGPD by design — état des lieux et mesures

**Déjà bon (à ne pas casser) :**
- **Aucune date de naissance ni âge précis collecté nulle part** (vérifié : zéro occurrence de
  `birthDate`/`dateOfBirth`/etc. dans le code). Seule une tranche sportive déclarative
  `ageCategory` — c'est de la minimisation correcte : on garde.
- Consentement explicite au Register avec liens politique/mentions consultables avant compte.
- Pas de téléphone, pas de genre individuel, pas de taille/poids à l'inscription.

**À ajouter (P1) :**
- **Mineures de moins de 15 ans** (seuil français, art. 45 loi Informatique et Libertés) :
  si `U13` ou `U15` est sélectionné à l'É2, encart + case dédiée : accord d'un parent requis
  (copy §6.4). Case obligatoire pour terminer le setup dans ce cas.
  **Honnêteté** : une case déclarative n'est pas une *vérification* parentale. C'est la mesure
  proportionnée pour un pilote où l'app arrive via le club (les clubs ont les autorisations
  parentales par ailleurs) ; une vérification réelle (email parent) est à prévoir avant une
  ouverture publique hors clubs (lot 6). *Alternative écartée : email parental avec lien de
  validation dès maintenant — friction létale sur le parking, et hors de proportion pour un
  pilote fermé.*
- U17/U18 : 15 ans révolus ou presque — consentement propre valide en France, pas de case
  supplémentaire. On n'infantilise pas une joueuse de 17 ans.
- **Formulation données santé** : les douleurs/blessures ne sont PAS collectées à
  l'inscription (rien à changer dans le flow), mais la politique de confidentialité doit
  mentionner explicitement la catégorie "données de santé" (douleurs déclarées en feedback).
  → point de vérification légal pour Kyllian, hors code ([utils/legalContent.ts](../utils/legalContent.ts)).

---

## 6. Le copy complet (livrable)

Ton : direct, football, tutoiement, zéro corporate. Public immédiat = joueuses → formulations
**épicènes** (pas de point médian, pas de masculin marqué quand évitable). Les libellés
féminisés de postes viendront de `teamGender` côté club (P2) — à l'affichage uniquement.

### 6.1 Welcome (3 slides)

| Élément | Copy |
|---|---|
| Slide 1 titre | `Ta prépa physique,\nton avantage` |
| Slide 1 sous-titre | `Des séances adaptées à ton poste, ton niveau et ta semaine.` |
| Slide 2 titre | `Progresse à\nchaque séance` |
| Slide 2 sous-titre | `Force, vitesse, endurance : un programme qui monte avec toi, séance après séance.` |
| Slide 3 titre | `Du jus le jour\ndu match` |
| Slide 3 sous-titre | `FKS gère ta charge d'entraînement pour arriver au match avec des jambes.` |
| CTA primaire | `Commencer` |
| Lien secondaire | `J'ai déjà un compte` |

*(Slide 3 actuel "Prêt le jour du match / que tu arrives frais et performant" — masculin
marqué ×2, remplacé.)*

### 6.2 Register

| Élément | Copy |
|---|---|
| Titre | `Crée ton compte` |
| Sous-titre | `2 minutes et ta première séance est prête.` |
| Placeholder prénom | `Prénom` |
| Placeholder email | `Email` |
| Placeholder mdp | `Mot de passe (6 caractères min.)` |
| Jauge mdp | `Faible` / `Moyen` / `Fort` (inchangé) |
| Consentement | `J'accepte la politique de confidentialité et les mentions légales.` (inchangé, liens inchangés) |
| CTA | `Continuer` |
| Footer | `Déjà un compte ?` + `Connecte-toi` |
| Erreur inline email | `Format email invalide` |
| Toast succès | `Compte créé` / `On configure ton profil.` |
| Toast succès dégradé (setDoc KO) | `Compte créé` / `Petit souci réseau — complète ton profil pour finaliser.` (inchangé) |

Erreurs Firebase (mapping existant conservé, RegisterScreen.tsx:34-49) :
`Email invalide.` · `Cet email est déjà utilisé.` · `Mot de passe trop faible (minimum 6
caractères).` · `Problème réseau. Vérifie ta connexion.` · `Trop de tentatives. Réessaie dans
quelques minutes.` · défaut `Vérifie tes infos et réessaie.`
Titres de toast : `Champs manquants` / `Email invalide` / `Mot de passe trop court` /
`Consentement requis` / `Inscription échouée` (inchangés).

### 6.3 Setup É1/4 — Ton club

| Élément | Copy |
|---|---|
| Barre de progression | `Étape 1/4` · `TON CLUB` |
| Titre | `T'as un code club ?` |
| Sous-titre | `Ton coach te l'a donné ? Entre-le : FKS se règle pour ton équipe.` |
| Placeholder | `Ex : ROUE-4821` |
| CTA (champ vide ou code non vérifié) | `Vérifier le code` |
| Carte succès | `✓ {Nom du club}` + `Tu vas rejoindre ton équipe sur FKS.` |
| CTA (code validé) | `Rejoindre {Nom du club}` |
| Lien secondaire | `Je m'entraîne en solo` |
| Erreur code inconnu (inline) | `Ce code ne correspond à aucun club. Vérifie avec ton coach — ou continue en solo.` |
| Erreur réseau (inline) | `Impossible de vérifier le code. Réessaie, ou continue en solo : tu pourras l'ajouter plus tard dans Profil.` |
| Lien staff (bas d'écran) | `Tu es coach ? Crée ton club` |

### 6.4 Setup É2/4 — Toi sur le terrain

| Élément | Copy |
|---|---|
| Barre | `Étape 2/4` · `TOI` |
| Titre | `Toi sur le terrain` |
| Sous-titre (si club) | `{Prénom}, ta prépa {Nom du club} part de là.` |
| Sous-titre (solo) | `{Prénom}, ta prépa part de là.` |
| Label poste | `Ton poste` |
| Chips poste (affichage) | `Gardien` · `Défenseur` · `Milieu` · `Attaquant` *(valeurs persistées sans accents inchangées)* |
| Label catégorie | `Ta catégorie` |
| Chips | `U13` · `U15` · `U17` · `U18` · `Senior` |
| Label niveau | `Le niveau de ton équipe` |
| Hint niveau | `Cette saison. Dans le doute : Amateur.` |
| Chips niveau (affichage) | `Amateur` · `Régional` · `National` · `Semi-pro` · `Pro` |
| Label pied | `Ton pied fort` |
| Chips | `Pied droit` · `Pied gauche` · `Ambidextre` |
| **Encart parental (si U13/U15)** | `Moins de 15 ans ? Il faut l'accord d'un parent (ou responsable) pour utiliser FKS.` |
| Case parentale | `Un parent est au courant et d'accord.` |
| Erreur case manquante | `Accord parental requis` / `Coche la case : un parent doit être d'accord.` |
| CTA | `Suivant` |

### 6.5 Setup É3/4 — Ton objectif

| Élément | Copy |
|---|---|
| Barre | `Étape 3/4` · `OBJECTIF` |
| Titre | `Ton objectif` |
| Sous-titre | `Ton programme se construit autour de ça.` |
| Label | `Ton objectif principal` |
| Choix (affichage) | `Être en forme toute la saison` · `Gagner en vitesse / explosivité` · `Mieux encaisser les entraînements et les matchs` · `Reprendre après une blessure` *(valeurs persistées inchangées)* |
| Label séances | `Tes séances FKS par semaine` |
| Hint | `En plus du club. 2 ou 3, c'est le rythme idéal pour progresser sans te cramer.` |
| Chips | `1` · `2` · `3` · `4` |
| CTA | `Suivant` |

### 6.6 Setup É4/4 — Ta semaine

| Élément | Copy |
|---|---|
| Barre | `Étape 4/4` · `TA SEMAINE` |
| Titre | `Ta semaine type` |
| Sous-titre | `Pour placer tes séances aux bons moments — jamais la veille d'un match.` |
| Label entraînements | `Entraînements club par semaine` |
| Chips | `Aucun` · `1` · `2` · `3` · `4+` |
| Label jours (si ≥1) | `Quels jours ?` |
| Chips | `Lun` … `Dim` |
| Label match | `Tes jours de match` |
| Chips | `Lun` … `Dim` + `Pas de match en ce moment` |
| Label salle | `Accès à une salle de muscu ?` |
| Chips | `Oui, régulièrement` · `De temps en temps` · `Non` |
| Hint salle | `Le matériel exact, tu le choisiras au moment de ta séance.` |
| CTA | `Terminer` |
| Loading save | `Enregistrement de ton profil...` / `On prépare ton programme.` |
| Erreurs | `Champs manquants` + messages actuels conservés (jours club / jours de match) |

### 6.7 Écran reco — Ton programme est prêt

| Élément | Copy |
|---|---|
| Titre | `{Prénom}, ton programme est prêt` |
| Sous-ligne (si club) | `{Nom du club}` |
| Carte | `{label du cycle}` + `{subtitle du cycle}` (depuis `MICROCYCLES`, ex. `Duels & puissance` / `Plus solide dans les duels, plus de puissance utile`) |
| Raison 1 | `✓ Ton objectif : {objectif affiché}` |
| Raison 2 | `✓ Calé sur tes {n} séances par semaine` (+ `, autour de tes entraînements club` si club ≥1) |
| Raison 3 | `✓ 12 séances, adaptées à ta catégorie {catégorie}` |
| CTA primaire | `Lancer ma première séance` |
| Lien 1 | `Voir tous les programmes` |
| Lien 2 (discret) | `Plus tard` |

### 6.8 Première génération (écrans existants, copy inchangé sauf mention)

- CTA Home : `Préparer ma séance` / `On te prépare un programme adapté en 2 min.` (existant,
  cohérent — inchangé).
- LoadingOverlay 5 étapes existantes conservées (`Analyse de ton profil et ta charge...` →
  `Vérification et finalisation...`). **Option lot 4** : variante première fois, étape 1 =
  `On analyse ton profil, {Prénom}...` et étape finale = `Ta première séance arrive...` —
  cosmétique, à ne faire que si trivial.

### 6.9 Login (copy pass léger)

| Élément | Copy |
|---|---|
| Titre | `Te revoilà` *(remplace "Content de te revoir" — masculin marqué)* |
| Sous-titre | `Connecte-toi pour reprendre ta progression.` (inchangé) |
| Reste | inchangé (erreurs, reset mdp, footer) |

---

## 7. Plan d'exécution pour Sonnet — lots mergeables

Tous les lots sont **100 % JS → OTA-compatibles** (aucun fichier natif). Règle d'or héritée du
Home : **aucune refonte visuelle mergée sans validation de Kyllian sur son téléphone** —
et pour les nouveaux écrans, maquette validée AVANT d'écrire le code.

| Lot | Contenu | Fichiers principaux | Validation requise | Mergeable seul |
|---|---|---|---|---|
| **0 — Funnel analytics** | `register_success`, `profile_step_completed {step}`, `club_code_checked {valid}`, `profile_completed {durationSec}`, `cycle_reco_shown/accepted/changed`, `first_session_generated {minutesSinceRegister}`. Timestamp de départ posé au Register (AsyncStorage) pour mesurer le bout-en-bout réel. + nettoyage clé morte `ONBOARDING_DONE` → pointer `WELCOME_KEY` vers `constants/storage.ts` | RegisterScreen, ProfileSetupScreen, NewSessionScreen, constants/storage.ts | aucune (pas d'UI) | ✅ immédiatement |
| **1 — Copy pass** | Textes §6.1, §6.2, §6.9 sur les écrans EXISTANTS (Welcome/Register/Login), zéro layout. Prénom requis au Register. | WelcomeScreen, RegisterScreen, LoginScreen | relecture du copy par Kyllian (ce doc suffit, pas de maquette) | ✅ |
| **2 — Étape Club** | Nouvel écran É1 (code club + validation immédiate + états succès/erreur/solo + lien coach), retrait du champ code et du lien coach de l'écran identité, suppression du renvoi-étape-0 au save (G9) | ProfileSetupScreen (+ éventuel sous-composant `setup/ClubCodeStep`) | **maquette AVANT code** + téléphone Kyllian avant merge | ✅ (le reste du setup inchangé) |
| **3 — Setup 4 étapes** | Restructuration É2/É3/É4 (§4.4-4.6) : chips partout, suppression étapes matériel + validations associées, prénom retiré (fallback si vide), encart parental U13/U15, save incrémental par étape | ProfileSetupScreen | **maquette AVANT code** + téléphone Kyllian (vérifier AUSSI le mode édition Profil) | ✅ |
| **4 — Moment magique** | Écran "Ton programme est prêt" post-save + navigation vers GenerateSession + (option) copy première génération | ProfileSetupScreen ou écran dédié + RootNavigator (route dans le stack setup) | **maquette AVANT code** + téléphone Kyllian | ✅ |
| **5 — P2 : réglages d'équipe côté club** | Le coach pose une fois : catégorie, niveau, jours d'entraînement, jour de match (+ `teamGender` déjà en base) → doc club. Côté joueuse : É2/É4 préremplies "confirme ou corrige" + libellés de postes féminisés à l'affichage si équipe féminine | clubsRepo, CoachHomeScreen (ou CoachOnboarding), ProfileSetupScreen, **firestore.rules** | validation Kyllian + **revue sécurité rules** (lecture des defaults par les membres, écriture coach only) | ✅ mais après 2-4 |
| **6 — P3 : plus tard** | QR code / deep link `join` (rebuild EAS requis — universal links = natif), write-back du matériel de 1ʳᵉ génération vers le profil, vérification parentale réelle (email parent) avant ouverture publique | — | — | — |

**Ordre recommandé** : 0 → 1 (semaine 1, sans risque) → maquettes 2/3/4 groupées pour UNE
session de validation Kyllian → 2 → 3 → 4 (semaines 2-3) → 5 si le temps le permet avant
l'arrivée des équipes. Les lots 2-4 peuvent partager une branche `feat/onboarding-v2` avec
merges intermédiaires, mais chaque lot doit laisser le flow fonctionnel de bout en bout.

**Critère de done global** : sur un téléphone réel en 4G, compte neuf avec code club →
séance en preview en < 3 min chrono, et le funnel Amplitude le prouve (lot 0 posé en premier
exprès : on mesure AVANT/APRÈS la refonte).

### Garde-fous techniques pour l'implémentation (à lire avant chaque lot)

- **G1** — Valeurs persistées `positions`/`levels`/`objectives` SANS accents, display maps
  uniquement ([ProfileSetupScreen.tsx:61-75](../screens/ProfileSetupScreen.tsx)). Ne JAMAIS
  toucher aux valeurs : allowlists Cloud Functions + matching `recommendMicrocycle`.
- **G2** — `isEditMode` (:133-134) : l'écran sert d'édition depuis Profil. En édition, garder
  l'accès à TOUS les champs (y compris matériel salle/maison qui sortent du setup) — soit en
  conservant les étapes matériel en mode édition seulement, soit via une section dédiée.
- **G3** — Ne pas toucher au gating RootNavigator (`profileCompleted`, pont
  `onProfileCompleted`, [RootNavigator.tsx:426-454](../navigation/RootNavigator.tsx)).
- **G4** — Miroir legacy `matchDay = matchDays[0] ?? null` au save (:370).
- **G5** — Mapping `hasGymAccess` UI→persist : `oui→regular`, `occasionnel→occasional`,
  `non→none` (:371).
- **G6** — Prefill : conserver le fallback `displayName` (course getDoc/setDoc, :177-184).
- **G7** — Socle visuel : `<Screen>`, toasts via `showToast`, haptics via `useHaptics`,
  `minHeight` sur les blocs texte (règles CLAUDE.md).
- **G8** — Suppression des étapes matériel : retirer les validations :279-286 ; vérifier
  qu'un profil sans `gymEquipment`/`homeEquipment` traverse la génération (défauts salle
  NewSessionScreen.tsx:370-377 ; maison → cases cochées à la génération). `hasHomeEquipment`
  peut rester `false`/absent sans casser `aiContext`.
- **G9** — Code club : la validation vit à l'É1, mais le save **re-résout** le code
  (le club peut avoir disparu) SANS bloquer ni renvoyer à l'étape 1 : rattachement raté →
  toast `Club non rattaché — tu pourras réessayer depuis Profil.` et le save aboutit.
- **G10** — Chips `4+` entraînements : persister `4` (nombre), ne pas inventer de nouvelle
  valeur de champ.
- **G11** — Écran reco : le cycle est déjà auto-assigné au save — l'écran est une mise en
  scène + un raccourci, pas une transaction. "Voir tous les programmes" → CycleModal existant
  qui gère déjà le changement.

---

## 8. Checklist démo live (pour Kyllian)

Le happy path à dérouler devant un club, une fois les lots 1-4 mergés :

1. **Avant** : créer un club de démo ("FKS FC" → code type `FKSF-XXXX`), avoir l'email jetable
   prêt, vérifier le réseau du lieu, mode avion OFF, luminosité max.
2. Welcome → "Commencer" (montrer les 3 slides d'un swipe rapide si le public accroche).
3. Register : prénom + email + mdp — **annoncer la promesse à voix haute** ("2 minutes,
   chrono en main").
4. É1 : taper le code du club → la carte `✓ FKS FC` s'affiche → "Rejoindre FKS FC".
   *(C'est LE moment de la démo : l'app reconnaît le club.)*
5. É2-É4 : tap-tap-tap, commenter les hints ("le matériel, elle le choisira à la séance").
6. Écran reco : lire les 3 raisons à voix haute → "Lancer ma première séance".
7. Lieu "Maison" (le plus parlant pour des parents) → valider → générer → pendant la barre de
   25 s : expliquer ce que fait le moteur (les étapes qui défilent font le job).
8. SessionPreview : dérouler les blocs. Fin de démo sur la séance, pas sur le Home.

Si le réseau du gymnase est pourri : le retry timeout existe (90 s + 1 retry,
newSession/api.ts:186-196) mais la démo doit prévoir un partage de connexion en secours.

---

## 9. Ce que ce doc ne couvre pas (explicitement hors scope)

- Le **planning hebdo** (placement des séances dans la semaine) : design doc séparé du 12/07,
  invariants #29-#31 réservés — l'É4 "Ta semaine" collecte déjà tout ce qu'il lui faut.
- L'**onboarding coach** (CoachOnboardingScreen) : seul le point d'entrée bouge (lien sur É1).
- La refonte du **NewSessionScreen** : il fait déjà le job (4 taps, bons défauts) ; seul le
  copy première-fois est optionnellement touché (lot 4).
- Auth sociale (Apple/Google Sign-In) : natif → rebuild EAS, et Apple exige Sign in with Apple
  dès qu'on propose un social login. À réévaluer après le pilote, pas avant.
