// components/session/liveTrackingHelpers.ts
// Helpers PURS (aucune dependance React/Firebase/navigation) pour la capture
// en seance (SessionLiveScreen) et le remplacement d'exercice. Extraits ici
// pour rester testables sans monter l'ecran RN complet.
import { dayKeyToDow, toDateKey } from "../../utils/dateHelpers";
import { MAX_PROPOSALS_PER_ITEM, selectReplacement } from "../../domain/tracking/replacements";
import type {
  DeviationReason,
  ItemExecution,
  PrescribedSnapshot,
  ReplacementProposal,
  ReplacementRequest,
} from "../../domain/tracking/types";

// ----------------------------------------------------------------------------
// Raisons d'ecart (FR) — ordre d'affichage dans les feuilles d'options
// ----------------------------------------------------------------------------

export const DEVIATION_REASON_ORDER: DeviationReason[] = [
  "time",
  "equipment",
  "too_difficult",
  "fatigue",
  "pain",
  "technical",
  "space",
  "no_partner",
  "other",
];

export const DEVIATION_REASON_LABELS: Record<DeviationReason, string> = {
  time: "Manque de temps",
  equipment: "Matériel indisponible",
  too_difficult: "Trop difficile",
  fatigue: "Fatigue",
  pain: "Douleur ou gêne",
  technical: "Problème technique",
  space: "Manque de place",
  no_partner: "Partenaire indisponible",
  other: "Autre",
};

// ----------------------------------------------------------------------------
// Type de saisie "reel" adapte a l'exercice (feuille d'options "Adapte")
// ----------------------------------------------------------------------------

export type ActualFieldsConfig = {
  loadKg: boolean;
  reps: boolean;
  distanceM: boolean;
  durationS: boolean;
};

export type ActualFieldsSource = {
  notes?: string | null;
  name?: string | null;
  modality?: string | null;
  workS?: number | null;
  durationMin?: number | null;
  reps?: number | string | null;
};

const NONE_FIELDS: ActualFieldsConfig = {
  loadKg: false,
  reps: false,
  distanceM: false,
  durationS: false,
};

/**
 * Deduit quels champs de saisie "reel" proposer pour un item, a partir de sa
 * prescription (jamais de serie par serie, toujours facultatif) :
 * - notes/nom contenant "kg" ou "charge" -> charge + repetitions
 * - modalite course/sprint -> repetitions + distance (l'un ou l'autre)
 * - duree de travail/bloc connue SANS repetitions -> duree
 * - sinon -> repetitions
 */
export function deriveActualFieldsConfig(item: ActualFieldsSource): ActualFieldsConfig {
  const haystack = `${item.notes ?? ""} ${item.name ?? ""}`.toLowerCase();
  const looksLoaded = /\bkg\b|charge/.test(haystack);
  if (looksLoaded) {
    return { ...NONE_FIELDS, loadKg: true, reps: true };
  }

  const modality = (item.modality ?? "").toLowerCase();
  const looksRun = modality === "run" || modality.includes("sprint") || haystack.includes("sprint");
  if (looksRun) {
    return { ...NONE_FIELDS, reps: true, distanceM: true };
  }

  const hasTiming =
    (typeof item.workS === "number" && item.workS > 0) ||
    (typeof item.durationMin === "number" && item.durationMin > 0);
  const hasReps = item.reps !== null && item.reps !== undefined && item.reps !== "";
  if (hasTiming && !hasReps) {
    return { ...NONE_FIELDS, durationS: true };
  }

  return { ...NONE_FIELDS, reps: true };
}

// ----------------------------------------------------------------------------
// Contexte match proche — deduit des jours de match (jour de semaine, meme
// format que useMatchSoon/isClubDay : "mon".."sun") vs la date de lancement.
// ----------------------------------------------------------------------------

function offsetDateKey(todayKey: string, offsetDays: number): string {
  const d = new Date(`${todayKey}T12:00:00`);
  d.setDate(d.getDate() + offsetDays);
  return toDateKey(d);
}

export function deriveMatchContext(
  matchDays: string[] | null | undefined,
  nowISO: string
): PrescribedSnapshot["matchContext"] {
  const list = Array.isArray(matchDays) ? matchDays.filter((d): d is string => typeof d === "string" && d.length > 0) : [];
  if (list.length === 0) return "none";

  const todayKey = toDateKey(nowISO);
  if (!todayKey) return "unknown";

  const isMatchOnOffset = (offset: number) => list.includes(dayKeyToDow(offsetDateKey(todayKey, offset)));

  if (isMatchOnOffset(0)) return "match_today";
  if (isMatchOnOffset(1)) return "match_tomorrow";
  if (isMatchOnOffset(2)) return "match_in_two_days";
  if (isMatchOnOffset(-1)) return "match_yesterday";
  return "none";
}

// ----------------------------------------------------------------------------
// Statuts explicites — utilise par finishAction pour decider d'afficher ou
// non la question rapide "Tout comme prevu ?" (aucun statut explicite pose).
// ----------------------------------------------------------------------------

export function hasExplicitItemStatus(items: ItemExecution[]): boolean {
  return items.some(
    (item) => item.status === "adapted" || item.status === "skipped" || item.status === "replaced"
  );
}

// ----------------------------------------------------------------------------
// Chaine de remplacements — au plus MAX_PROPOSALS_PER_ITEM propositions,
// deterministe (selectReplacement est pur). Chaque proposition exclut la/les
// precedente(s) : "Voir une autre option" n'est jamais affiche pour un 3e
// appel, et jamais affiche si le 2e appel ne renvoie rien.
// ----------------------------------------------------------------------------

export function buildReplacementChain(
  request: ReplacementRequest,
  maxProposals: number = MAX_PROPOSALS_PER_ITEM
): ReplacementProposal[] {
  const chain: ReplacementProposal[] = [];
  let excludeIds = Array.isArray(request.context.excludeIds) ? [...request.context.excludeIds] : [];

  for (let i = 0; i < maxProposals; i++) {
    const proposal = selectReplacement({
      ...request,
      context: { ...request.context, excludeIds },
    });
    if (!proposal) break;
    chain.push(proposal);
    excludeIds = [...excludeIds, proposal.exerciseId];
  }

  return chain;
}
