// domain/tracking/rulesEngine.ts
// Moteur de regles deterministe, versionne, premier-match-gagne. AUCUN ML,
// AUCUN LLM. Voir docs/boucle-suivi-2026-07-25/REGLES_AJUSTEMENT.md pour la
// specification EXACTE (table des 11 regles) -- toute evolution d'ordre ou
// de seuil doit s'accompagner d'un bump de rulesVersion dans config.ts.
import { TRACKING_CONFIG } from "./config";
import type { TrackingConfig } from "./config";
import type { TrackingDecision, TrackingDecisionKind, TrackingSignals } from "./types";

/**
 * Ordre d'evaluation des 11 regles (documentation vivante, cf. REGLES_AJUSTEMENT.md).
 * Les doublons sont volontaires : la regle 2/3 partagent le kind "resume_mode"
 * (severite differente, cf. explain.ts) et la regle 7 choisit entre deux kinds
 * "reduce_*" selon la completion -- ici on documente le kind "par defaut" de
 * chaque position, decideAdjustment reste la seule source de verite executable.
 */
export const RULE_ORDER: TrackingDecisionKind[] = [
  "block_increase_pain", // 1
  "resume_mode", // 2 (coupure longue)
  "resume_mode", // 3 (coupure courte)
  "standard_insufficient_data", // 4
  "prefer_replacement", // 5
  "suggest_variant", // 6
  "reduce_intensity_light", // 7 (ou reduce_volume_light selon completion)
  "keep_despite_time", // 8
  "hold_dose", // 9
  "continue_planned", // 10 (note de marge)
  "continue_planned", // 11 (defaut)
];

/**
 * Extension locale purement interne (jamais exportee dans un contrat inter-lot,
 * types.ts n'est pas modifie) : trace le numero de regle qui a matche, utile
 * pour les tests/l'observabilite. Toujours assignable a TrackingDecision.
 */
export type TrackingDecisionWithRule = TrackingDecision & { ruleIndex: number };

function buildDigest(signals: TrackingSignals): TrackingDecision["signalsDigest"] {
  return {
    completionRateAvg: signals.completionRateAvg,
    rpeDeltaAvg: signals.rpeDeltaAvg,
    painActive: signals.painSignal.active,
    gapDays: signals.gapDays,
    dataQuality: signals.dataQuality,
  };
}

/**
 * Decide de l'ajustement a partir des signaux. PUR : ne modifie jamais
 * `signals`/`config`, ne lit jamais l'horloge systeme (nowISO est un
 * parametre). `mode` vaut toujours "shadow" ici -- un appelant en aval peut
 * surcharger ce champ sur l'objet retourne (`{ ...decision, mode: "applied" }`)
 * une fois le mode Application active ; ce module ne decide jamais lui-meme
 * d'appliquer quoi que ce soit.
 */
export function decideAdjustment(
  signals: TrackingSignals,
  nowISO: string,
  config: TrackingConfig = TRACKING_CONFIG
): TrackingDecision {
  const digest = buildDigest(signals);

  const build = (
    kind: TrackingDecisionKind,
    ruleIndex: number,
    targets: string[] = []
  ): TrackingDecisionWithRule => ({
    version: 1,
    rulesVersion: config.rulesVersion,
    decidedAtISO: nowISO,
    kind,
    targets,
    explanation: "",
    signalsDigest: digest,
    mode: "shadow",
    ruleIndex,
  });

  // Regle 1 -- douleur : priorite absolue, avant tout le reste.
  if (signals.painSignal.active) {
    return build("block_increase_pain", 1);
  }

  // Regle 2/3 -- coupure d'entrainement.
  if (typeof signals.gapDays === "number") {
    if (signals.gapDays >= config.resumption.gapDaysHard) {
      return build("resume_mode", 2);
    }
    if (signals.gapDays >= config.resumption.gapDaysSoft) {
      return build("resume_mode", 3);
    }
  }

  // Regle 4 -- donnees manquantes ou incoherentes.
  if (signals.dataQuality === "insufficient" || signals.dataQuality === "inconsistent") {
    return build("standard_insufficient_data", 4);
  }

  // Regle 5 -- materiel durablement indisponible (meme exo remplace >= seuil).
  if (signals.durableEquipmentIssues.length > 0) {
    return build("prefer_replacement", 5, [...signals.durableEquipmentIssues]);
  }

  // Regle 6 -- difficulte repetee (meme exo/famille "too_difficult" >= seuil).
  if (signals.repeatedDifficulty.exerciseIds.length > 0) {
    return build("suggest_variant", 6, [...signals.repeatedDifficulty.exerciseIds]);
  }

  // Regle 7 -- effort trop eleve de facon persistante (>= minSessionsForSignal).
  if (
    signals.rpeDeltaAvg !== null &&
    signals.rpeDeltaCount >= config.rpe.minSessionsForSignal &&
    signals.rpeDeltaAvg >= config.rpe.highDelta
  ) {
    const kind: TrackingDecisionKind =
      signals.completionRateAvg !== null && signals.completionRateAvg >= config.completion.fullPct
        ? "reduce_intensity_light"
        : "reduce_volume_light";
    return build(kind, 7);
  }

  // Regle 8 -- derniere seance incomplete par manque de temps uniquement :
  // capacite physique inchangee, jamais interprete comme une incapacite.
  if (signals.timeConstrainedIncomplete) {
    return build("keep_despite_time", 8);
  }

  // Regle 9 -- la seance la plus recente casse la serie (streak == 0) pour
  // une raison qui n'est ni le temps (regle 8) ni la douleur (regle 1, deja
  // exclue plus haut) : cas isole, une seule mauvaise seance ne bouleverse rien.
  if (signals.sessionsAnalyzed > 0 && signals.streakOkSessions === 0) {
    return build("hold_dose", 9);
  }

  // Regle 10 -- marge de progression validee sur plusieurs seances : le plan
  // prevoit deja la vague de progression, on autorise le petit pas DANS les
  // caps existants (le front n'augmente jamais rien lui-meme).
  if (
    signals.rpeDeltaAvg !== null &&
    signals.rpeDeltaCount >= config.rpe.minSessionsForSignal &&
    signals.rpeDeltaAvg <= config.rpe.lowDelta &&
    signals.streakOkSessions >= config.progression.minStreakForSmallStep &&
    signals.completionRateAvg !== null &&
    signals.completionRateAvg >= config.completion.fullPct &&
    !signals.painSignal.active
  ) {
    return build("continue_planned", 10);
  }

  // Regle 11 -- defaut : seances reussies, effort proche de la cible, pas de douleur.
  return build("continue_planned", 11);
}
