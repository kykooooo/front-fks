// screens/newSession/soloGuard.ts
//
// GARDE « JOUEUR SEUL » de la mise en forme (GO Kyllian 11/08/2026,
// RAPPORT_NON_SOLO.md §4) : un exercice minPlayers>=2 reçu du serveur
// n'atteint JAMAIS l'écran nu.
//   - équivalent solo fiable disponible → remplacement, tracé dans les notes ;
//   - sinon → nom marqué « (à 2) » + consigne vers la raison d'écart
//     « Partenaire indisponible » qui existe déjà en séance.
// L'équivalence est décidée par LE moteur de remplacement de la boucle de
// suivi (selectReplacement, raison "no_partner") — une seule implémentation,
// règle CLAUDE.md n°11 — avec les mêmes sources de contexte que
// SessionLiveScreen (équipement lu depuis la séance v2, âge depuis le store
// via l'écran). Un contexte inconnu (âge null, matériel vide) ne produit
// jamais un swap non garanti : le moteur refuse, on marque.
// Le dosage prescrit (sets/reps/durée/repos) est CONSERVÉ tel quel : même
// famille de mouvement, la charge du moteur n'est pas réinventée ici.

import type { Exercise } from "../../domain/types";
import { EXERCISE_BY_ID } from "../../engine/exerciseBank";
import { estExerciceNonSolo } from "../../engine/nonSoloExercises";
import { selectReplacement } from "../../domain/tracking/replacements";

export type ContexteGardeSolo = {
  equipmentAvailable: string[];
  ageCategory: string | null;
};

const joindreNotes = (...parts: Array<string | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export function garantirSeanceSolo(
  exercises: Exercise[],
  contexte: ContexteGardeSolo
): Exercise[] {
  // Ids déjà présents dans la séance : un remplacement ne doit jamais créer
  // le doublon que le refus typé de transform.ts vient d'interdire.
  const idsServis = new Set(exercises.map((e) => String(e.id)));

  return exercises.map((ex) => {
    const id = String(ex.id);
    if (!estExerciceNonSolo(id)) return ex;

    const proposition = selectReplacement({
      exerciseId: id,
      reason: "no_partner",
      context: {
        equipmentAvailable: contexte.equipmentAvailable,
        ageCategory: contexte.ageCategory,
        activePains: [],
        matchSoon: false,
        highFatigue: false,
        solo: true,
        excludeIds: [...idsServis],
      },
    });

    if (proposition) {
      idsServis.add(proposition.exerciseId);
      const alt = EXERCISE_BY_ID[proposition.exerciseId];
      return {
        ...ex,
        id: proposition.exerciseId,
        name: alt?.name ?? proposition.name,
        notes: joindreNotes(
          `Servi à la place de « ${ex.name} » (exercice à 2 — app joueur seul).`,
          proposition.prescription.note ?? proposition.shortWhy,
          ex.notes
        ),
      } as Exercise;
    }

    return {
      ...ex,
      name: `${ex.name} (à 2)`,
      notes: joindreNotes(
        "Exercice à 2 joueurs, sans équivalent solo fiable — prévois un partenaire, ou remplace-le en séance (« Partenaire indisponible »).",
        ex.notes
      ),
    } as Exercise;
  });
}
