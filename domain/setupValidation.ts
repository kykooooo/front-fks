// domain/setupValidation.ts
//
// LA VALIDATION DU QUESTIONNAIRE — une seule implémentation, pure.
//
// Deux usages, même règle :
//   - `validerEtape(n, …)`  : le bouton « Suivant » d'une étape ;
//   - `validerTout(…)`      : AVANT toute écriture à la finalisation.
//
// POURQUOI `validerTout` EXISTE. La finalisation ne validait que l'étape
// AFFICHÉE. Un brouillon repris directement à l'étape 4 contournait donc les
// trois premières : un U15 pouvait enregistrer une preuve d'accord parental
// (`accepted: true`) sans que la case ait jamais été cochée dans cette session —
// et la case n'est volontairement PAS conservée dans le brouillon. Un accord ne
// se déduit ni de la catégorie d'âge, ni de l'étape sauvegardée : il se lit sur
// la case, cochée par le joueur ou pré-cochée par une preuve existante valide.

import { OBJECTIF_ENCAISSER } from "./mainObjective";
import { SELECTABLE_AGE_CATEGORIES } from "./types";
import { isParentalConsentBlocking } from "./parentalConsent";

// ⚠️ Valeurs PERSISTÉES en Firestore, comparées à des allowlists SANS accents
// côté Cloud Functions + matching substring dans recommendMicrocycle. On ne les
// modifie JAMAIS. Les libellés accentués vivent dans utils/profileDisplayLabels.
export const SETUP_POSITIONS = ["Gardien", "Defenseur", "Milieu", "Attaquant"] as const;
export const SETUP_LEVELS = ["Amateur", "Regional", "National", "Semi-pro", "Pro"] as const;
export const SETUP_DOMINANT_FEET = ["Pied droit", "Pied gauche", "Ambidextre"] as const;
export const SETUP_OBJECTIVES = [
  "Etre en forme toute la saison",
  "Gagner en vitesse / explosivite",
  // Valeur SANS accent (convention : jamais d'accent dans une valeur persistée).
  OBJECTIF_ENCAISSER,
  "Reprendre apres une blessure",
] as const;
export const SETUP_FKS_SESSIONS = ["1", "2", "3", "4"] as const;

export type ReponsesAValider = {
  firstName: string;
  position: string;
  ageCategory: string;
  level: string;
  dominantFoot: string;
  mainObjective: string;
  targetFksSessionsPerWeek: string;
  hasClubTrainings: string;
  clubTrainingDays: string[];
  hasGymAccess: string;
  geneSetup: string;
  geneZone: string | null;
  geneGravite: number | null;
  /** L'état RÉEL de la case — jamais déduit de la catégorie ni du brouillon. */
  parentalConsentChecked: boolean;
};

export type Invalidite = { ok: false; step: number; title: string; message: string };
export type Validite = { ok: true } | Invalidite;

const dans = (v: string, liste: readonly string[]) => liste.includes(v);
const ko = (step: number, title: string, message: string): Invalidite => ({ ok: false, step, title, message });

export function validerEtape(step: number, r: ReponsesAValider): Validite {
  switch (step) {
    case 0:
      if (!r.firstName.trim()) return ko(0, "Champs manquants", "Merci d'indiquer ton prénom.");
      if (!dans(r.position, SETUP_POSITIONS)) return ko(0, "Champs manquants", "Choisis ton poste.");
      // Ordre voulu : (1) catégorie sélectionnable (un profil legacy U13 échoue
      // ici → il doit repick), (2) seulement ensuite, l'accord parental.
      if (!dans(r.ageCategory, SELECTABLE_AGE_CATEGORIES as readonly string[])) {
        return ko(0, "Champs manquants", "Choisis ta catégorie.");
      }
      if (isParentalConsentBlocking(r.ageCategory, r.parentalConsentChecked)) {
        return ko(0, "Accord parental requis", "Coche la case pour confirmer l'accord de ton parent ou responsable légal.");
      }
      if (!dans(r.level, SETUP_LEVELS)) return ko(0, "Champs manquants", "Indique ton niveau.");
      if (!dans(r.dominantFoot, SETUP_DOMINANT_FEET)) return ko(0, "Champs manquants", "Choisis ton pied fort.");
      return { ok: true };
    case 1:
      if (!dans(r.mainObjective, SETUP_OBJECTIVES)) return ko(1, "Champs manquants", "Choisis ton objectif principal.");
      if (!dans(r.targetFksSessionsPerWeek, SETUP_FKS_SESSIONS)) {
        return ko(1, "Champs manquants", "Indique tes séances FKS / semaine.");
      }
      return { ok: true };
    case 2:
      if (r.hasClubTrainings !== "oui" && r.hasClubTrainings !== "non") {
        return ko(2, "Champs manquants", "Indique si tu as des entraînements collectifs.");
      }
      if (r.hasClubTrainings === "oui" && r.clubTrainingDays.length === 0) {
        return ko(2, "Champs manquants", "Précise les jours d'entraînement avec ton équipe.");
      }
      return { ok: true };
    case 3:
      if (!dans(r.hasGymAccess, ["oui", "occasionnel", "non"])) {
        return ko(3, "Champs manquants", "Indique si tu as accès à une salle.");
      }
      // La gêne reste FACULTATIVE. Mais « Oui » sans zone ni gravité était ignoré
      // en silence : la première séance ne ménageait rien.
      if (r.geneSetup === "oui" && (!r.geneZone || !r.geneGravite)) {
        return ko(3, "Gêne à préciser", "Indique où et ce que ça t'empêche de faire — ou choisis « Non, rien ».");
      }
      return { ok: true };
    default:
      return { ok: true };
  }
}

export const SETUP_STEP_COUNT = 4;

/** La PREMIÈRE étape invalide, dans l'ordre du parcours — ou `ok`. */
export function validerTout(r: ReponsesAValider): Validite {
  for (let step = 0; step < SETUP_STEP_COUNT; step += 1) {
    const res = validerEtape(step, r);
    if (!res.ok) return res;
  }
  return { ok: true };
}
