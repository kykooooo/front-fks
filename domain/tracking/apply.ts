// domain/tracking/apply.ts
// Mode Application (OFF par defaut au pilote, cf. modes.ts) : mappe une
// TrackingDecision vers les leviers de contexte backend EXISTANTS uniquement.
// PUR : retourne toujours une COPIE de FKS_AiContext, jamais de mutation de
// l'original. Voir docs/boucle-suivi-2026-07-25/REGLES_AJUSTEMENT.md section
// "Mode Application". FKS_AiContext (services/aiContext.ts) est lu en LECTURE
// SEULE ici -- jamais modifie.
import { TRACKING_CONFIG } from "./config";
import type { TrackingConfig } from "./config";
import type { TrackingDecision } from "./types";
import type { FKS_AiContext } from "../../services/aiContext";

/** Contexte ajuste + trace des ajustements reellement appliques (audit/observabilite). */
export type AppliedContextResult = {
  context: FKS_AiContext;
  applied: string[];
};

/**
 * Historique des decisions PRECEDENTES (le plus recent seulement compte pour
 * la persistance "reduce_intensity_light" >= 2 fenetres), optionnel. Aucune
 * dependance de stockage ici -- l'appelant fournit ce qu'il a deja (ex. la
 * derniere TrackingDecision stockee pour ce joueur).
 * Convention : `previousDecisions[0]` = la decision la PLUS RECENTE avant
 * celle en cours (ordre desc), le reste est ignore.
 */
export type ApplyHistory = {
  previousDecisions?: TrackingDecision[];
};

/** La decision precedente compte comme "meme tendance" pour reduce_intensity_light. */
function isPersistentHighEffortTrend(kind: TrackingDecision["kind"]): boolean {
  return kind === "reduce_intensity_light" || kind === "reduce_volume_light";
}

function cloneContext(context: FKS_AiContext): FKS_AiContext {
  return {
    ...context,
    profile: { ...context.profile },
    constraints: context.constraints
      ? {
          ...context.constraints,
          equipment: context.constraints.equipment ? [...context.constraints.equipment] : context.constraints.equipment,
          pains: context.constraints.pains ? [...context.constraints.pains] : context.constraints.pains,
        }
      : context.constraints,
    metrics: { ...context.metrics },
    equipment_available: [...context.equipment_available],
  };
}

/**
 * Applique une TrackingDecision au contexte de generation. Retourne toujours
 * une copie + la liste des ajustements reellement effectues. INVARIANT
 * (neverIncreaseBeyondPlan, teste) : ne produit jamais un available_time_min
 * plus grand que le plan, ne retire jamais de pains, ne touche jamais
 * phase/goal/metrics -- le front ne demande jamais plus que ce que le plan
 * backend prevoit deja.
 *
 * `unavailableEquipment` est optionnel : liste des ids de materiel
 * durablement indisponibles a retirer des contraintes/materiel disponible
 * quand la decision est `prefer_replacement` (decision.targets porte des
 * exerciseIds, pas des ids de materiel -- d'ou ce parametre dedie).
 *
 * `history` est optionnel : `previousDecisions[0]` (la plus recente) sert a
 * detecter la persistance de `reduce_intensity_light` sur >= 2 fenetres (cf.
 * REGLES_AJUSTEMENT.md section "Mode Application"). Sans historique fourni,
 * `reduce_intensity_light` reste un no-op trace (comportement premier
 * declenchement).
 */
export function applyDecisionToContext(
  context: FKS_AiContext,
  decision: TrackingDecision,
  config: TrackingConfig = TRACKING_CONFIG,
  unavailableEquipment: string[] = [],
  history: ApplyHistory = {}
): AppliedContextResult {
  const next = cloneContext(context);
  const applied: string[] = [];

  /** Reduit available_time_min du facteur configure si present (jamais d'invention de valeur). Retourne true si applique. */
  const reduceAvailableTime = (): boolean => {
    const current = next.available_time_min;
    if (typeof current === "number" && Number.isFinite(current)) {
      next.available_time_min = Math.round(current * config.apply.volumeReductionFactor);
      return true;
    }
    return false;
  };

  switch (decision.kind) {
    case "reduce_volume_light": {
      if (reduceAvailableTime()) applied.push("reduce_volume_light");
      break;
    }

    case "reduce_intensity_light": {
      // Le cap RPE backend converge deja seul au PREMIER declenchement :
      // aucun changement de contexte, seulement une trace pour
      // observabilite. Si la decision precedente la PLUS RECENTE est deja
      // reduce_intensity_light OU reduce_volume_light (meme tendance
      // persistant sur >= 2 fenetres), on reduit la duree une seule fois
      // (jamais de cumul de facteurs au-dela d'un appel).
      const previous = history.previousDecisions?.[0];
      if (previous && isPersistentHighEffortTrend(previous.kind)) {
        if (reduceAvailableTime()) applied.push("reduce_intensity_persistent_time_reduced");
      } else {
        applied.push("reduce_intensity_light_noted");
      }
      break;
    }

    case "resume_mode": {
      // Severite lue depuis signalsDigest.gapDays (jamais devinee) :
      // - gapDays >= gapDaysHard (regle 2) : recommandation declarative de
      //   cycle fondations (jamais de switch silencieux -- l'UI de choix de
      //   cycle s'en sert pour proposer le changement au joueur) + duree
      //   reduite.
      // - gapDays < gapDaysHard (regle 3, reprise douce) : cycle CONSERVE
      //   (pas de recommend_fondation), seulement la duree est reduite.
      // - gapDays absent (null) : pass-through prudent, aucun ajustement --
      //   on ne devine jamais la severite d'une reprise sans donnee.
      const gapDays = decision.signalsDigest.gapDays;
      if (typeof gapDays !== "number") break;

      if (gapDays >= config.resumption.gapDaysHard) {
        applied.push("recommend_fondation");
        if (reduceAvailableTime()) applied.push("resume_hard_time_reduced");
      } else {
        if (reduceAvailableTime()) applied.push("resume_soft_time_reduced");
      }
      break;
    }

    case "prefer_replacement": {
      if (unavailableEquipment.length > 0) {
        const toRemove = new Set(unavailableEquipment);
        let changed = false;

        const equipment = next.constraints?.equipment;
        if (Array.isArray(equipment) && next.constraints) {
          const filtered = equipment.filter((item) => !toRemove.has(item));
          if (filtered.length !== equipment.length) {
            next.constraints = { ...next.constraints, equipment: filtered };
            changed = true;
          }
        }

        const beforeLen = next.equipment_available.length;
        next.equipment_available = next.equipment_available.filter((item) => !toRemove.has(item));
        if (next.equipment_available.length !== beforeLen) changed = true;

        if (changed) applied.push("prefer_replacement");
      }
      break;
    }

    case "block_increase_pain": {
      // Les pains[]/injury_max_severity partent deja via
      // collectActivePainConstraints -- on ne les modifie JAMAIS ici,
      // seulement une trace de verification.
      applied.push("pain_guard_checked");
      if (!next.constraints?.pains || next.constraints.pains.length === 0) {
        applied.push("pain_guard_missing_pains");
      }
      break;
    }

    case "continue_planned":
    case "hold_dose":
    case "keep_despite_time":
    case "suggest_variant":
    case "standard_insufficient_data":
    default:
      // Pass-through strict : copie identique, aucun ajustement.
      break;
  }

  return { context: next, applied };
}
