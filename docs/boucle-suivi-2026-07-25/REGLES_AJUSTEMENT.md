# REGLES_AJUSTEMENT — Moteur déterministe versionné (tracking-rules/1.0.0)

## Doctrine
- La progression planifiée par le moteur backend (vagues, phases, caps) **reste la référence**. Ce moteur ne fait que corriger la trajectoire sur écart répété, jamais accélérer agressivement.
- Sécurité d'abord : douleur > coupure > données insuffisantes > tout le reste.
- Une seule mauvaise séance ne change rien (sauf signal de sécurité).
- Aucun diagnostic médical. Aucun ML. Déterministe, testé, expliqué.
- Cohérence backend : le moteur backend applique déjà ±2 RPE sur ≥3 séances et le garde-fou douleur récurrente. Le moteur front utilise les MÊMES seuils d'écart RPE pour rester cohérent, et ses décisions shadow notent quand le backend aurait convergé seul.

## Seuils (tous dans `domain/tracking/config.ts`, aucune valeur magique ailleurs)

```ts
export const TRACKING_CONFIG = {
  rulesVersion: "tracking-rules/1.0.0",
  window: { sessions: 5, days: 28 },        // fenêtre d'analyse
  completion: {
    fullPct: 90,          // ≥ → séance "full"
    partialPct: 40,       // ≥ → "partial", sinon "abandoned"
    doneWeight: 1, adaptedWeight: 1, replacedEquivalentWeight: 1,
    replacedPartialWeight: 0.5, skippedWeight: 0,
  },
  rpe: {
    minSessionsForSignal: 3,   // aligné backend (≥3 deltas)
    highDelta: 2,              // moyenne ≥ +2 → trop dur
    lowDelta: -2,              // moyenne ≤ −2 → marge
  },
  progression: { minStreakForSmallStep: 2 }, // séances comparables réussies avant d'autoriser un petit pas
  difficulty: { repeatThreshold: 2 },        // même exercice/famille "too_difficult" ≥ 2 → variante
  equipment: { durableThreshold: 2 },        // même exercice remplacé "equipment" ≥ 2 → préférence durable
  pain: {
    feedbackThreshold: 3,      // échelle app 0-5 (≥3 = douleur réelle)
    windowDays: 7,             // aligné collectActivePainConstraints
  },
  resumption: {
    gapDaysSoft: 14,           // ≥ → reprise prudente (réduction de dose)
    gapDaysHard: 28,           // ≥ → recommandation fondations/reprise temporaire
    minCompletionForLastSession: 40,  // une séance "abandoned" ne compte pas comme reprise d'activité
  },
  apply: {   // bornes du mode Application (jamais dépassées)
    volumeReductionFactor: 0.9,     // "légère" réduction volume → available_time_min × 0.9
    neverIncreaseBeyondPlan: true,  // le front ne demande JAMAIS plus que le plan
  },
} as const;
```

## Décisions — ordre d'évaluation (premier match gagne)

| # | Condition (signaux) | Décision | Note |
|---|---|---|---|
| 1 | `painSignal.active` (feedback pain ≥3/5 dans la fenêtre 7 j, OU blessure déclarée, OU remplacement/skip raison douleur) | `block_increase_pain` | Aucune augmentation. Le contexte de génération porte déjà `pains[]`/`injury_max_severity` (garde-fou backend existant) — la décision l'explicite au joueur. |
| 2 | `gapDays ≥ 28` | `resume_mode` | Fondations/reprise temporaire, dose réduite. |
| 3 | `gapDays ≥ 14` | `resume_mode` (variante douce) | Réduction prudente de dose, cycle conservé. |
| 4 | `dataQuality ∈ {insufficient, inconsistent}` (0 exécution exploitable, ou incohérences : pct hors bornes, durées aberrantes, doublons) | `standard_insufficient_data` | Progression standard, on le dit honnêtement. |
| 5 | `durableEquipmentIssues` non vide (même exo remplacé ≥2× pour matériel) | `prefer_replacement` | La variante compatible devient la préférence pour les prochaines séances (targets = exerciseIds). Ne modifie PAS la progression physique. |
| 6 | `repeatedDifficulty` non vide (même exo/famille "too_difficult" ≥2×) | `suggest_variant` | Régression accessible ciblée, dose maintenue ailleurs. |
| 7 | `rpeDeltaAvg ≥ +2` sur ≥3 séances | `reduce_intensity_light` (si complétion OK) ou `reduce_volume_light` (si complétion < fullPct) | Maintien/réduction prudente. Note : le backend converge déjà (cap easy) — l'explication le dit. |
| 8 | Dernière séance incomplète MAIS `timeConstrainedIncomplete` (raison dominante = time, pas de difficulté physique) | `keep_despite_time` | Capacité estimée inchangée — jamais interprété comme incapacité. |
| 9 | Dernière séance incomplète pour raison non-temps, non-douleur (1 seule occurrence) | `hold_dose` | Une seule mauvaise séance ne bouleverse rien. |
| 10 | `rpeDeltaAvg ≤ −2` sur ≥3 séances ET `streakOkSessions ≥ 2` ET complétion ≥ fullPct ET pas de douleur | `continue_planned` **avec note de marge** | Le plan prévoit déjà la vague de progression ; la décision autorise le petit pas DANS les caps existants (le front n'augmente rien lui-même : `neverIncreaseBeyondPlan`). |
| 11 | défaut : séances réussies, RPE proche cible, pas de douleur | `continue_planned` | |

## Interaction remplacements → décision suivante
- `equipment` ponctuel (1×) → aucune influence.
- `equipment` ≥2× même exo → règle 5 (`prefer_replacement`).
- `too_difficult` ≥2× → règle 6 (`suggest_variant`).
- `pain` → règle 1 immédiate (dès 1 occurrence).
- `no_partner` répété → préférence d'alternatives `soloOk` (portée par `prefer_replacement`).
- `space` répété → préférence `compactSpaceOk`.

## Explications (`explain.ts`)
Une phrase-type par décision, TOUJOURS instanciée avec les données réelles (jamais de raison inventée) :
- `continue_planned` : « Tes N dernières séances ont été réalisées comme prévu, avec un effort proche de la cible et sans douleur. La progression prévue continue. »
- `keep_despite_time` : « Tu as raccourci la séance par manque de temps, sans difficulté physique. Ta progression reste inchangée. »
- `reduce_*` : « La dernière séance a été plus difficile que prévu (effort X vs cible Y). La charge reste stable pour consolider avant d'augmenter. »
- `block_increase_pain` : « Une gêne a été signalée. L'application n'augmente pas la charge et adapte la suite avec prudence. »
- `resume_mode` : « Ta dernière séance terminée remonte à N jours. Reprise en douceur recommandée avant de retrouver ton niveau. »
- `standard_insufficient_data` : « Pas encore assez de données sur tes dernières séances : programme standard, en toute transparence. »
- `prefer_replacement` : « Tu as remplacé {exercice} N fois faute de matériel. La prochaine séance utilisera directement la variante compatible. »

## Mode Application (`apply.ts`, OFF au pilote)
Mapping décision → leviers de contexte backend EXISTANTS uniquement :
- `reduce_volume_light` → `constraints.available_time_min × 0.9` (borne config).
- `reduce_intensity_light` → `weekly_flags.deload = true` seulement si l'écart persiste ≥2 fenêtres (sinon rien : le cap RPE backend converge seul).
- `resume_mode` (hard) → recommandation de cycle `fondation` (via l'UI de choix de cycle, jamais de switch silencieux) + durée réduite.
- `prefer_replacement` → retire du `constraints.equipment[]` le matériel durablement indisponible (le filtre matériel backend fait le reste).
- `block_increase_pain` → s'assure que `pains[]`/`injury_max_severity` partent bien (déjà le cas) ; n'ajoute rien.
- `continue_planned`/`hold_dose`/`keep_despite_time`/`standard_insufficient_data` → pass-through strict.
- Option documentée (non activée) : envoyer `blocks[].items[].exercise_id` des séances réalisées dans `recent_fks_sessions` pour rendre la mémoire anti-répétition backend « voyante » — à revalider après merge vague 8,5.

## Versionnage
- `rulesVersion` embarqué dans chaque décision stockée.
- Tout changement de seuil ou d'ordre = bump de version + entrée dans ce document.
