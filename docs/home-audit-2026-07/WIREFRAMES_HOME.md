# Wireframes — option B (restructuration recommandée)

Référence : **375 px de large**, écran 812 px. Le trait `═══ LIGNE DE FLOTTAISON ═══` marque la fin de la zone visible sans défiler.

Toutes les données affichées existent déjà dans l'app. Aucun de ces écrans ne suppose une donnée à créer, un nouvel appel backend ou un suivi club actif. Correspondance des sources en fin de document.

**Conventions de lecture** : `▓▓▓` = aplat plein (le seul de l'écran, le CTA) · `┌─┐` = carte · `···` = texte secondaire · `→` = lien discret.

---

## 1. Séance prévue aujourd'hui

```
┌───────────────────────────────────────────────┐
│  Salut, Yanis                  ● Un peu chargé│   header
│  Jeu. 30 juil.                                │
│                                               │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓ C'est parti !                          (→) ▓│   ACTION
│ ▓ Force bas du corps · 45 min                ▓│
│ ▓ ─────────────────────────────────────────  ▓│
│ ▓ Pourquoi : tu as deux jours de charge dans ▓│   ← NOUVEAU
│ ▓ les jambes, on garde le volume mais on     ▓│     (sessionTheme /
│ ▓ baisse l'intensité.                        ▓│      playerContext)
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│    Séance 4/12 · Fondations              →    │   repère de cycle
│                                               │   (sous le CTA, discret)
│  ┌─────────────────────────────────────────┐  │
│  │ MA SEMAINE                              │  │
│  │ 1 séance sur 2                          │  │
│  │ ··· Plus qu'une séance pour atteindre   │  │   ← weekSummary.message
│  │     ton objectif.                       │  │     (aujourd'hui jeté)
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ MA FORME              ● Un peu chargé   │  │
│  │  ╭╮   ╭──╮                              │  │   tendance seule,
│  │ ─╯╰───╯  ╰──╮   ╭─────                  │  │   sans "0"/"-10"
│  │             ╰───╯                       │  │
│  │ ··· 7 derniers jours                    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  Voir ma progression  →                       │   sortie discrète
│                                               │
│═══════ LIGNE DE FLOTTAISON (812) ═════════════│   ← tout tient au-dessus
│                                               │
└───────────────────────────────────────────────┘
[  Accueil  ][  Séance  ][  Profil  ]              tab bar
```

- **Avant défilement** : tout. L'écran n'a plus besoin de scroll dans son état nominal.
- **Action principale** : le CTA, aplat unique de l'écran.
- **Secondaire** : semaine, forme, cycle — informatifs, non concurrents.
- **Bas de page** : une ligne texte, pas une carte.
- **Avant la tab bar** : une respiration nette, sans les 70 px de vide actuels.
- **Pas de carte « Prochaine séance »** : elle disait la même chose que le CTA. « Voir la séance » devient une action secondaire du bloc d'action (lien texte sous le CTA, non représenté ici pour ne pas charger le schéma).

---

## 2. Séance terminée aujourd'hui

Le CTA cesse d'être un rectangle gris mort et devient un accusé de réception.

```
┌───────────────────────────────────────────────┐
│  Salut, Yanis                  ● Un peu chargé│
│  Jeu. 30 juil.                                │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ ✓  Séance faite                         │  │   ← ton "réussite",
│  │    Force bas du corps · 45 min · RPE 7  │  │     pas un bouton gris
│  │                                         │  │
│  │    Objectif de la semaine atteint (2/2) │  │
│  │    Prochaine séance : à partir de demain│  │
│  └─────────────────────────────────────────┘  │
│    Séance 5/12 · Montée en puissance     →    │   ← le cycle a avancé
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ MA FORME              ● Un peu chargé   │  │
│  │  ╭╮   ╭──╮       ╭──                    │  │
│  │ ─╯╰───╯  ╰───────╯                      │  │
│  │ ··· 7 derniers jours                    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ··· Envie de plus ?                          │
│  Routine récupération  →                      │   ← lien, pas un aplat
│                                               │
│  Voir ma progression  →                       │
│                                               │
│═══════ LIGNE DE FLOTTAISON (812) ═════════════│
└───────────────────────────────────────────────┘
[  Accueil  ][  Séance  ][  Profil  ]
```

- **Action principale** : aucune — et c'est volontaire. La journée est faite.
- Les seules propositions (récup, progression) sont des **liens**, jamais des aplats.
- **Rien n'est désactivé.** Un bouton grisé occupe de la place sans rien offrir ; ici l'espace sert à confirmer ce qui a été accompli.

---

## 3. Jour sans séance prévue

```
┌───────────────────────────────────────────────┐
│  Salut, Yanis                      ● En forme │
│  Jeu. 30 juil.                                │
│                                               │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓ Créer ma séance du jour                (→) ▓│   ← libellé aligné sur
│ ▓ 2 minutes, adaptée à ton contexte          ▓│     la vraie destination
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│    Séance 6/12 · Montée en puissance     →    │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ MA SEMAINE                              │  │
│  │ 1 séance sur 2                          │  │
│  │ ··· Plus qu'une séance pour atteindre   │  │
│  │     ton objectif.                       │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ MA FORME                  ● En forme    │  │
│  │      ╭───╮      ╭──────                 │  │
│  │ ─────╯   ╰──────╯                       │  │
│  │ ··· 7 derniers jours                    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  Voir ma progression  →                       │
│                                               │
│═══════ LIGNE DE FLOTTAISON (812) ═════════════│
└───────────────────────────────────────────────┘
```

- Pas de ligne « pourquoi » : la séance n'existe pas encore, donc il n'y a rien d'honnête à dire. **Le bloc apparaît seulement quand la donnée existe.**
- Jour de match ou d'entraînement club : le libellé du CTA change (« Match demain — garde-la légère ») **au lieu** d'un conseil qui contredit le CTA depuis le bas de l'écran.

---

## 4. Reprise après interruption

L'état aujourd'hui le plus mal traité, et le plus fréquent chez un amateur.

```
┌───────────────────────────────────────────────┐
│  Salut, Yanis                                 │
│  Jeu. 30 juil.                                │   ← pas de chip d'état :
│                                               │     24 j sans données,
│  ┌─────────────────────────────────────────┐  │     on ne l'invente pas
│  │ Content de te revoir.                   │  │
│  │ ··· Ta dernière séance date de 24 jours.│  │   ← daysSinceLastSession
│  │     On reprend progressivement.         │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓ Reprendre en douceur                   (→) ▓│
│ ▓ Une séance courte pour se remettre dedans  ▓│
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ TON CYCLE                               │  │
│  │ Force — en pause depuis 24 jours        │  │   ← honnête : la phase
│  │ Tu en étais à la séance 5 sur 12.       │  │     n'affirme plus une
│  │                                         │  │     montée en charge
│  │ [ Reprendre le cycle ] [ Repartir de 0 ]│  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ··· Ta forme sera de nouveau mesurée après   │   ← pas de courbe :
│      ta première séance.                      │     pas de données
│                                               │
│═══════ LIGNE DE FLOTTAISON (812) ═════════════│
└───────────────────────────────────────────────┘
```

- **Aucune courbe, aucun état de forme affirmé.** Après 24 jours, l'app ne sait pas — elle le dit.
- Le repère de cycle devient une **décision** (reprendre ou repartir), pas un chiffre figé.
- Aucune donnée nouvelle : `daysSinceLastSession` se déduit de `sessions`, déjà en mémoire.

---

## 5. Nouveau joueur

```
┌───────────────────────────────────────────────┐
│  Salut, Yanis                                 │
│  Jeu. 30 juil.                                │   ← pas de chip d'état
│                                               │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓ Choisir mon cycle                      (→) ▓│   ← dit la vraie
│ ▓ 4 cycles, 12 séances chacun                ▓│     destination
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ ON COMMENCE PAR LÀ                      │  │
│  │ 1 ─ Choisis ton cycle                   │  │   ← une vraie première
│  │ 2 ─ Fais ta première séance             │  │     étape, pas un
│  │ 3 ─ Dis-nous comment ça s'est passé     │  │     reproche
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐  │
│  │ MA FORME                                │  │   ← aperçu explicitement
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░               │  │     étiqueté, jamais
│  │  ░░░░░░░░░░░░░░                         │  │     présenté comme réel
│  │ ··· Aperçu — ta forme apparaîtra ici    │  │
│  │     après tes premières séances.        │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘  │
│                                               │
│═══════ LIGNE DE FLOTTAISON (812) ═════════════│
└───────────────────────────────────────────────┘
```

- **Zéro chiffre inventé.** Ni « En forme », ni courbe, ni « Semaine 0/2 », ni « Série Nouvelle ».
- **Pas de conseil.** Le fourre-tout « Mobilité oubliée » disparaît : la règle `no_mobility` ne doit pas se déclencher sur une absence de données.
- Le pattern d'aperçu grisé et étiqueté existe déjà dans le projet (`renderEmptyRoster`, `CoachHomeScreen`).

---

## 6. Progression / forme indisponible (données insuffisantes)

Cas du joueur qui a 1 ou 2 séances : assez pour agir, pas assez pour mesurer.

```
┌───────────────────────────────────────────────┐
│  Salut, Yanis                                 │
│  Jeu. 30 juil.                                │
│                                               │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓ Créer ma séance du jour                (→) ▓│
│ ▓ 2 minutes, adaptée à ton contexte          ▓│
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│    Séance 2/12 · Fondations              →    │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ MA SEMAINE                              │  │
│  │ 1 séance sur 2                          │  │
│  │ ··· Plus qu'une séance pour atteindre   │  │
│  │     ton objectif.                       │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │ MA FORME                                │  │
│  │ ··· Encore 2 séances et on pourra te    │  │   ← dit ce qui manque
│  │     montrer ta tendance.                │  │     et quand ça viendra
│  │     1 séance enregistrée.               │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  Voir ma progression  →                       │
│                                               │
│═══════ LIGNE DE FLOTTAISON (812) ═════════════│
└───────────────────────────────────────────────┘
```

- **Pas de courbe, pas de pastille d'état.** Aujourd'hui `useLoadSeries` renvoie **toujours** 7 points : c'est précisément ce qu'il faut cesser de faire.
- La carte reste, mais elle dit **ce qu'il manque et quand ce sera disponible**.

---

## Compatibilité technique

Tout est réalisable avec l'existant, sans nouvelle dépendance :

| Élément du wireframe | Comment |
|---|---|
| Aplat CTA + sous-titre + ligne « pourquoi » | `HomePrimaryCTA` étendu, ou `components/ui/Button` + `Card` |
| Cartes de section | `components/ui/Card` (`surface` / `soft`), rayon depuis `theme.radius` |
| Titres `MA SEMAINE` / `MA FORME` | `components/ui/SectionHeader` (utilisé une seule fois aujourd'hui) |
| Aperçu grisé étiqueté | pattern `renderEmptyRoster` de `CoachHomeScreen` |
| Courbe | `HomeReadinessHero` **allégé** : on retire titre, message et repères numériques |
| Boutons du bloc reprise | `components/ui/Button` (`minHeight` 48 → règle les zones tactiles) |
| Liens de sortie | `Text` + `accessibilityRole="link"` |
| Safe area et respiration finale | `<Screen>` — supprime les 34 px d'inset parasites |

## Origine des données affichées

| Affichage | Source existante | Statut |
|---|---|---|
| Prénom, date | `auth.currentUser`, `Intl` | existant |
| Chip d'état | `getFootballLabel(tsb)` | existant — **à conditionner** à des données réelles |
| Label / sous-titre du CTA | `usePrimaryCta` | existant — cascade à réordonner |
| **Ligne « Pourquoi »** | `sessionTheme`, `playerContext`, `coachingTips`, `rationale` du payload v2 | **existant, jamais affiché sur le Home** |
| Séance N/12 · phase | `getMicrocyclePhase` | existant |
| « 1 séance sur 2 » | `useWeekSummary.fksCount` + objectif déclaré | existant — objectif à rebrancher |
| Phrase de semaine | `useWeekSummary.message` | **existant, calculé puis jeté** |
| Courbe 7 j | `useLoadSeries` | existant — **une seule source à retenir** |
| « 24 jours » | dérivé de `sessions` | dérivable, aucun nouveau champ |
| Récap de séance faite | `Session` (durée, RPE, titre) | existant |

**Rien dans ces wireframes ne dépend d'un club, d'un coach ou d'un suivi actif.** Un joueur amateur seul obtient exactement le même écran, complet.
