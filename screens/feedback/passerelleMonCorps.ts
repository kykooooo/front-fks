// screens/feedback/passerelleMonCorps.ts
//
// LA DECISION DE PROPOSER « MON CORPS » APRES UN FEEDBACK (decision D3).
//
// Isolee ici, pure, pour etre verifiable sans monter d'ecran : c'est la SEULE
// regle qui decide, et elle ne connait qu'un seuil — celui qui existait deja.

import { TRACKING_CONFIG } from "../../domain/tracking/config";

/**
 * Le seuil, importe et non recopie.
 *
 * `TRACKING_CONFIG.pain.feedbackThreshold` vaut 3 sur l'echelle 0-5 de l'app et
 * porte deja sa justification ecrite : « >= 3 = douleur reelle, pas une gene
 * mineure ». Un seuil = une implementation (CLAUDE.md regle 11) : ecrire un 3
 * de plus ici creerait un deuxieme endroit ou le changer.
 */
export const SEUIL_DOULEUR_PASSERELLE = TRACKING_CONFIG.pain.feedbackThreshold;

/**
 * `true` si, APRES l'enregistrement du feedback, on propose au joueur de situer
 * sa douleur dans « Mon corps ».
 *
 * Ce que cette fonction n'a PAS le droit d'etre : bloquante. Elle est appelee
 * une fois le feedback deja applique et la charge deja mise a jour. Repondre
 * « Plus tard » n'ecrit rien du tout.
 */
export function doitProposerMonCorps(douleur0a5: number | null | undefined): boolean {
  if (typeof douleur0a5 !== "number" || !Number.isFinite(douleur0a5)) return false;
  return douleur0a5 >= SEUIL_DOULEUR_PASSERELLE;
}
