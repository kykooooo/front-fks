// domain/setupPrefill.ts
//
// D'OÙ VIENNENT LES VALEURS DU QUESTIONNAIRE, ET QUI GAGNE — pur, testé.
//
// Trois sources arrivent à des moments différents :
//   1. ce que le joueur est EN TRAIN de saisir (immédiat) ;
//   2. le brouillon local de son compte (lecture chiffrée, asynchrone) ;
//   3. le document Firestore `users/{uid}` (réseau, asynchrone, parfois lent).
//
// LA RÈGLE, champ par champ :
//   - un champ que le joueur a TOUCHÉ n'est plus jamais réécrit par une source
//     tardive (le préremplissage qui arrivait après le début de la saisie
//     écrasait ce qu'il venait de taper) ;
//   - sinon le brouillon l'emporte sur le serveur — pendant l'inscription
//     initiale, c'est la saisie la plus récente du joueur. ABSENT ≠ VIDÉ : une
//     clé PRÉSENTE dans le brouillon gagne même si elle est vide ("" ou []) —
//     le joueur a décoché ses jours de match, l'ancien profil ne les ramène pas ;
//   - sinon la valeur du serveur ;
//   - sinon rien : jamais de valeur inventée.
//
// ET UNE RÈGLE AU-DESSUS DE TOUTES : si le profil distant est DÉJÀ complet, le
// brouillon est ignoré (et l'appelant le supprime). Un vieux brouillon resté
// sur un téléphone n'écrase pas un profil finalisé ou modifié depuis.
// En ÉDITION d'un profil existant, le brouillon n'est ni lu ni écrit.

import { isPlayerProfileComplete } from "./playerProfile";
import { normalizeMainObjective } from "./mainObjective";
import type { SetupDraftAnswers } from "../services/setupDraft";

export type SetupAnswers = SetupDraftAnswers;
export type SetupField = keyof SetupAnswers;

export const SETUP_GAP_OPTIONS = [
  { id: "lt2w", days: 0 },
  { id: "2to4w", days: 21 },
  { id: "1to3m", days: 60 },
  { id: "gt3m", days: 120 },
] as const;

const chaine = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

/** Le document `users/{uid}` lu comme des RÉPONSES de questionnaire. Pur. */
export function answersFromProfileDoc(
  d: Record<string, unknown> | null | undefined,
  fallbackFirstName?: string | null,
): SetupAnswers {
  const out: SetupAnswers = {};
  const prenom = chaine(d?.firstName)?.trim() || chaine(fallbackFirstName)?.trim();
  if (prenom) out.firstName = prenom;
  if (!d) return out;
  if (chaine(d.position)) out.position = d.position as string;
  if (chaine(d.ageCategory)) out.ageCategory = d.ageCategory as string;
  if (chaine(d.level)) out.level = d.level as string;
  if (chaine(d.dominantFoot)) out.dominantFoot = d.dominantFoot as string;
  // Normalisé à la LECTURE : un profil d'avant le 05/09 porte la forme accentuée.
  const objectif = typeof d.mainObjective === "string" ? normalizeMainObjective(d.mainObjective) : null;
  if (objectif) out.mainObjective = objectif;
  if (d.targetFksSessionsPerWeek != null) {
    const n = String(d.targetFksSessionsPerWeek);
    if (["1", "2", "3", "4"].includes(n)) out.targetFksSessionsPerWeek = n;
  }
  if (typeof d.selfReportedGapDays === "number") {
    const option = SETUP_GAP_OPTIONS.find((o) => o.days === d.selfReportedGapDays);
    if (option) out.selfReportedGapOption = option.id;
  }
  if (d.hasClubTrainings === "oui" || d.hasClubTrainings === "non") out.hasClubTrainings = d.hasClubTrainings;
  if (Array.isArray(d.clubTrainingDays)) out.clubTrainingDays = d.clubTrainingDays.filter((j) => typeof j === "string");
  if (Array.isArray(d.matchDays) && d.matchDays.length > 0) {
    out.matchDays = d.matchDays.filter((j) => typeof j === "string");
  } else if (typeof d.matchDay === "string" && d.matchDay) {
    out.matchDays = [d.matchDay];
  }
  if (typeof d.hasGymAccess === "string") {
    out.hasGymAccess = d.hasGymAccess === "regular" ? "oui" : d.hasGymAccess === "occasional" ? "occasionnel" : "non";
  }
  return out;
}

/** Le profil distant est-il déjà FINALISÉ ? Alors aucun brouillon ne s'applique. */
export function profilDejaFinalise(d: Record<string, unknown> | null | undefined): boolean {
  return Boolean(d && d.profileCompleted === true && isPlayerProfileComplete(d));
}

const vide = (v: unknown): boolean =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

export type ResolutionPrefill = {
  /** Champs à poser dans le formulaire (jamais un champ touché). */
  patch: SetupAnswers;
  /** Étape à restaurer, ou `null` (pas de brouillon applicable, ou le joueur a déjà bougé). */
  step: number | null;
  /** Le brouillon doit être supprimé (profil déjà finalisé). */
  supprimerBrouillon: boolean;
  /** Le prénom affiché vient d'une source (inscription/brouillon), pas d'une frappe. */
  prenomDepuisSource: boolean;
};

export function resoudrePrefill(params: {
  /** `true` : écran ouvert en édition depuis l'app — le brouillon n'existe pas pour lui. */
  edition: boolean;
  serverDoc: Record<string, unknown> | null | undefined;
  fallbackFirstName?: string | null;
  draft: { step: number; answers: SetupAnswers } | null;
  touched: ReadonlySet<string>;
  /** Le joueur a déjà changé d'étape lui-même : on ne le téléporte pas. */
  aNavigue: boolean;
}): ResolutionPrefill {
  const serveur = answersFromProfileDoc(params.serverDoc, params.fallbackFirstName);
  const finalise = profilDejaFinalise(params.serverDoc);
  const brouillonApplicable = !params.edition && !finalise && params.draft ? params.draft : null;

  const patch: SetupAnswers = {};
  const champs = new Set<SetupField>([
    ...(Object.keys(serveur) as SetupField[]),
    ...(brouillonApplicable ? (Object.keys(brouillonApplicable.answers) as SetupField[]) : []),
  ]);
  for (const champ of champs) {
    if (params.touched.has(champ)) continue;
    const dansLeBrouillon =
      brouillonApplicable !== null && Object.prototype.hasOwnProperty.call(brouillonApplicable.answers, champ);
    if (dansLeBrouillon) {
      // Présent = voulu, y compris vide : un effacement volontaire est une réponse.
      (patch as Record<string, unknown>)[champ] = brouillonApplicable.answers[champ];
      continue;
    }
    const duServeur = serveur[champ];
    if (!vide(duServeur)) (patch as Record<string, unknown>)[champ] = duServeur;
  }

  return {
    patch,
    step: brouillonApplicable && !params.aNavigue && params.touched.size === 0 ? brouillonApplicable.step : null,
    supprimerBrouillon: !params.edition && finalise && params.draft !== null,
    prenomDepuisSource: !params.touched.has("firstName") && !vide(patch.firstName),
  };
}

/**
 * LES CHAMPS SPORTIFS DU PROFIL, tels qu'ils sont ÉCRITS à la finalisation.
 * Pur : c'est la même fonction que l'écran utilise et que les tests vérifient
 * (profil complet pour le portillon, lisible par le schéma du contexte IA).
 * `clubTrainingsPerWeek` / `matchesPerWeek` sont DÉRIVÉS des jours cochés —
 * jamais une saisie séparée. Les jours d'entraînement ne comptent que si le
 * joueur a répondu « oui ».
 */
export function profilSportifDepuisReponses(a: {
  firstName: string;
  position: string;
  ageCategory: string;
  level: string;
  dominantFoot: string;
  mainObjective: string;
  targetFksSessionsPerWeek: string;
  selfReportedGapOption: string;
  hasClubTrainings: string;
  clubTrainingDays: string[];
  matchDays: string[];
  hasGymAccess: string;
}) {
  const joursCollectifs = a.hasClubTrainings === "oui" ? a.clubTrainingDays : [];
  const option = SETUP_GAP_OPTIONS.find((o) => o.id === a.selfReportedGapOption);
  return {
    firstName: a.firstName.trim(),
    position: a.position,
    ageCategory: a.ageCategory,
    level: a.level,
    dominantFoot: a.dominantFoot,
    mainObjective: a.mainObjective,
    targetFksSessionsPerWeek: Number(a.targetFksSessionsPerWeek),
    // Reprise (facultatif) — null tant que non répondu, jamais de valeur inventée.
    selfReportedGapDays: option ? option.days : null,
    clubTrainingsPerWeek: joursCollectifs.length,
    matchesPerWeek: a.matchDays.length,
    hasClubTrainings: a.hasClubTrainings,
    clubTrainingDays: joursCollectifs,
    matchDay: a.matchDays[0] ?? null,
    matchDays: a.matchDays,
    hasGymAccess: a.hasGymAccess === "oui" ? "regular" : a.hasGymAccess === "occasionnel" ? "occasional" : "none",
  };
}
