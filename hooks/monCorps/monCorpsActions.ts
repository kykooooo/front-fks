// hooks/monCorps/monCorpsActions.ts
//
// LES GESTES DU JOUEUR SUR « MON CORPS », EN UN SEUL ENDROIT.
//
// L'ecran ne lit ni n'ecrit le store lui-meme (CLAUDE.md regle 10) : il appelle
// ces fonctions. La passerelle du feedback aussi. Toutes prennent l'horloge du
// mode dev en compte (`devNowISO`) pour rester testables et coherentes avec le
// reste de l'app.
//
// Aucune de ces fonctions ne decide a la place du joueur : il n'existe ici
// aucun passage automatique en « guerie », aucun decompte, aucune expiration.
// C'est la regle 3 de la charte INJURY_IA_CHARTER : « jamais modifier le statut
// de blessure sans consentement joueur ».

import type { BodyArea, BodyInjury, BodyInjurySeverity, BodyInjuryStatus, BodyInjurySource } from "../../domain/types";
import { useBodyStore } from "../../state/stores/useBodyStore";
import { useDebugStore } from "../../state/stores/useDebugStore";

function maintenant(): string {
  return useDebugStore.getState().devNowISO ?? new Date().toISOString();
}

export function ajouterGene(input: {
  zone: BodyArea;
  gravite: BodyInjurySeverity;
  source: BodyInjurySource;
  note?: string;
}): BodyInjury {
  return useBodyStore.getState().ajouterBlessure({ ...input, nowISO: maintenant() });
}

export function changerStatutBlessure(id: string, statut: BodyInjuryStatus): void {
  useBodyStore.getState().changerStatut(id, statut, maintenant());
}

export function changerGraviteBlessure(id: string, gravite: BodyInjurySeverity): void {
  useBodyStore.getState().changerGravite(id, gravite, maintenant());
}

/**
 * Suppression DEFINITIVE. Distincte de « c'est guéri » : marquer guerie garde
 * la trace dans l'historique, supprimer efface. C'est le droit d'effacement du
 * joueur (RGPD, art. 17), et il n'existait tout simplement pas avant.
 */
export function supprimerGene(id: string): void {
  useBodyStore.getState().supprimerBlessure(id);
}
