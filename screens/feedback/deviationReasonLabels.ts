// screens/feedback/deviationReasonLabels.ts
// Mapping FR des raisons d'ecart (DeviationReason, domain/tracking/types.ts)
// pour l'affichage du resume d'ecart en feedback (Lot 4, ExecutionSummaryCard).
//
// Fix P2-f : ce fichier portait a l'origine sa PROPRE table de libelles
// (note de convergence historique : le mapping Live n'existait pas encore
// quand ce lot a ete ecrit, Lot 2/3 en cours en parallele) -- deux sources
// FR pour la meme cle DeviationReason, avec des libelles/casse differents.
// Source canonique desormais UNIQUE : DEVIATION_REASON_LABELS
// (components/session/liveTrackingHelpers.ts, ecran Live). Ce fichier est un
// simple re-export ; l'API publique (DEVIATION_REASON_LABEL_FR) est
// conservee telle quelle pour ne rien casser cote FeedbackScreen/
// ExecutionSummaryCard.
import { DEVIATION_REASON_LABELS } from '../../components/session/liveTrackingHelpers';
import type { DeviationReason } from '../../domain/tracking/types';

export const DEVIATION_REASON_LABEL_FR: Record<DeviationReason, string> = DEVIATION_REASON_LABELS;
