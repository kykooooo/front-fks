// domain/tracking/explain.ts
// Explications FR (texte utilisateur -- AVEC accents, contrairement au code) :
// toujours instanciees depuis les signaux reels, jamais de raison inventee.
// Si une donnee manque, la phrase le dit simplement. Gabarits alignes sur
// docs/boucle-suivi-2026-07-25/REGLES_AJUSTEMENT.md section "Explications" ;
// deux gabarits (suggest_variant, hold_dose) n'y figurent pas explicitement
// et sont ecrits ici dans le meme ton (langage joueur amateur, <= 2 phrases,
// jamais de jargon TSB/ATL).
import { TRACKING_CONFIG } from "./config";
import type { TrackingDecision, TrackingSignals } from "./types";

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

function fmtDelta(n: number): string {
  return n > 0 ? `+${fmtNum(n)}` : fmtNum(n);
}

/** Determine si continue_planned correspond a la regle 10 (marge/petit pas) plutot qu'a la regle 11 (defaut). */
function isMarginDecision(signals: TrackingSignals): boolean {
  return (
    signals.rpeDeltaAvg !== null &&
    signals.rpeDeltaCount >= TRACKING_CONFIG.rpe.minSessionsForSignal &&
    signals.rpeDeltaAvg <= TRACKING_CONFIG.rpe.lowDelta &&
    signals.streakOkSessions >= TRACKING_CONFIG.progression.minStreakForSmallStep &&
    signals.completionRateAvg !== null &&
    signals.completionRateAvg >= TRACKING_CONFIG.completion.fullPct &&
    !signals.painSignal.active
  );
}

/** Determine la severite d'un resume_mode (regle 2 = dur, regle 3 = doux) depuis les signaux reels. */
function isHardResume(signals: TrackingSignals): boolean {
  return typeof signals.gapDays === "number" && signals.gapDays >= TRACKING_CONFIG.resumption.gapDaysHard;
}

/**
 * Construit l'explication FR d'une decision, instanciee avec les donnees
 * reelles des signaux. Ne lit QUE `signals` (jamais decision.targets comme
 * source de verite numerique) pour rester honnete sur ce qui est reellement
 * mesure.
 */
export function buildDecisionExplanation(decision: TrackingDecision, signals: TrackingSignals): string {
  switch (decision.kind) {
    case "continue_planned": {
      if (isMarginDecision(signals)) {
        return (
          `Tes ${signals.sessionsAnalyzed} dernières séances ont été plus faciles que prévu ` +
          `(effort moyen ${fmtDelta(signals.rpeDeltaAvg as number)} par rapport à la cible), sans douleur. ` +
          `Le programme prévu peut avancer d'un petit pas, toujours dans ses limites.`
        );
      }
      if (signals.sessionsAnalyzed > 0) {
        return (
          `Tes ${signals.sessionsAnalyzed} dernières séances ont été réalisées comme prévu, ` +
          `avec un effort proche de la cible et sans douleur. La progression prévue continue.`
        );
      }
      return "La progression prévue continue.";
    }

    case "hold_dose":
      return (
        "Ta dernière séance ne s'est pas déroulée comme prévu, mais c'est un cas isolé. " +
        "La charge ne change pas, on continue comme prévu."
      );

    case "reduce_volume_light":
    case "reduce_intensity_light": {
      const delta = signals.rpeDeltaAvg;
      const effort =
        delta !== null
          ? `un effort en moyenne ${fmtDelta(delta)} point(s) au-dessus de la cible sur tes ${signals.rpeDeltaCount} dernières séances`
          : "un effort au-dessus de la cible sur tes dernières séances";
      return `Tu as ressenti ${effort}. La charge reste stable pour consolider avant d'augmenter.`;
    }

    case "suggest_variant": {
      const ids = signals.repeatedDifficulty.exerciseIds;
      const label = ids.length > 0 ? ids.join(", ") : "un exercice récent";
      return (
        `Tu as trouvé ${label} trop difficile au moins ${TRACKING_CONFIG.difficulty.repeatThreshold} fois. ` +
        `La prochaine séance proposera une variante plus accessible, sans réduire le reste du programme.`
      );
    }

    case "prefer_replacement": {
      const ids = signals.durableEquipmentIssues;
      const label = ids.length > 0 ? ids.join(", ") : "un exercice récent";
      return (
        `Tu as remplacé ${label} au moins ${TRACKING_CONFIG.equipment.durableThreshold} fois faute de matériel. ` +
        `La prochaine séance utilisera directement une variante compatible.`
      );
    }

    case "resume_mode": {
      const gapPhrase = typeof signals.gapDays === "number" ? `${signals.gapDays} jours` : "un moment";
      if (isHardResume(signals)) {
        return (
          `Ta dernière séance terminée remonte à ${gapPhrase}. ` +
          `On repart en douceur avec les fondations avant de retrouver ton niveau.`
        );
      }
      return (
        `Ta dernière séance terminée remonte à ${gapPhrase}. ` +
        `Reprise en douceur recommandée avant de retrouver ton niveau.`
      );
    }

    case "keep_despite_time":
      return (
        "Tu as raccourci la séance par manque de temps, sans difficulté physique. " +
        "Ta progression reste inchangée."
      );

    case "block_increase_pain": {
      const occ = signals.painSignal.occurrences;
      const occPhrase = occ > 0 ? ` (signalée ${occ} fois récemment)` : "";
      return (
        `Une gêne a été signalée${occPhrase}. ` +
        `L'application n'augmente pas la charge et adapte la suite avec prudence.`
      );
    }

    case "standard_insufficient_data": {
      if (signals.dataQuality === "inconsistent") {
        return (
          "Certaines données de tes dernières séances semblent incohérentes : " +
          "programme standard, en toute transparence, le temps d'y voir plus clair."
        );
      }
      return "Pas encore assez de données sur tes dernières séances : programme standard, en toute transparence.";
    }

    default:
      return "";
  }
}

/** Retourne la decision avec son explication FR remplie -- c'est ce que l'appelant utilise/stocke. */
export function decorateDecision(decision: TrackingDecision, signals: TrackingSignals): TrackingDecision {
  return { ...decision, explanation: buildDecisionExplanation(decision, signals) };
}
