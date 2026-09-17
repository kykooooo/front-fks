// services/finalizeSetup.ts
//
// LA FINALISATION DU QUESTIONNAIRE — ce que l'écran appelle quand on tape
// « Terminer », sorti de l'écran pour être exécuté en test.
//
// ORDRE, ET IL EST LA GARANTIE :
//   1. validation de TOUTES les étapes (domain/setupValidation) — un brouillon
//      repris à l'étape 4 ne contourne plus les trois premières ;
//   2. seulement ensuite, la gêne dans « Mon corps » (écriture locale, une fois) ;
//   3. l'écriture du profil distant ;
//   4. la suppression coordonnée du brouillon.
// Invalide → `status: "invalid"` avec l'étape à rouvrir, et RIEN n'a été écrit :
// ni gêne, ni profil, ni preuve d'accord parental.
//
// Une écriture de profil qui échoue ou dépasse son délai JETTE : l'écran garde
// la saisie et le brouillon, et dit que le compte existe.

import { buildParentalConsent, requiresParentalConsent, type ParentalConsent } from "../domain/parentalConsent";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT } from "../domain/microcycles";
import { profilSportifDepuisReponses } from "../domain/setupPrefill";
import { validerTout, type Invalidite, type ReponsesAValider } from "../domain/setupValidation";

export type FinalizeInput = {
  uid: string;
  reponses: ReponsesAValider & {
    selfReportedGapOption: string;
    matchDays: string[];
  };
  /** Preuve d'accord déjà en base (réutilisée telle quelle si elle vaut pour cette catégorie). */
  storedParentalConsent: ParentalConsent | null;
  /** Repassés sans modification (aucune UI ici pour les changer). */
  passthrough: { gymEquipment: string[]; hasHomeEquipment: boolean; homeEquipment: string[] };
  /** Cycle recommandé à activer, ou `null` si un cycle est déjà actif. */
  autoCycleId: string | null;
  /** La gêne de CE questionnaire a déjà été écrite (nouvel essai après un échec réseau). */
  geneDejaEcrite: boolean;
};

export type FinalizeDeps = {
  ecrireGene: (gene: { zone: string; gravite: number }) => void;
  /** Appelé dès que la gêne est écrite — avant l'écriture distante, qui peut échouer. */
  onGeneEcrite: () => void;
  ecrireProfil: (uid: string, data: Record<string, unknown>) => Promise<void>;
  effacerBrouillon: (uid: string) => Promise<void>;
  serverTimestamp: () => unknown;
};

export type FinalizeOutcome =
  | ({ status: "invalid" } & Omit<Invalidite, "ok">)
  | { status: "saved" };

export async function finaliserQuestionnaire(deps: FinalizeDeps, input: FinalizeInput): Promise<FinalizeOutcome> {
  const r = input.reponses;

  // 1. TOUT valider avant la moindre écriture, locale ou distante.
  const verdict = validerTout(r);
  if (!verdict.ok) {
    return { status: "invalid", step: verdict.step, title: verdict.title, message: verdict.message };
  }

  // 2. Gêne déclarée → « Mon corps », source `setup`. Locale et instantanée ;
  //    la garde évite le doublon quand « Terminer » est retapé après un échec.
  if (r.geneSetup === "oui" && r.geneZone && r.geneGravite && !input.geneDejaEcrite) {
    deps.ecrireGene({ zone: r.geneZone, gravite: r.geneGravite });
    deps.onGeneEcrite();
  }

  // 3. Profil distant. La preuve d'accord n'est construite QUE si la catégorie
  //    l'exige — et on n'arrive ici que si la case était réellement cochée.
  await deps.ecrireProfil(input.uid, {
    uid: input.uid,
    // `clubId` n'est JAMAIS écrit : un rattachement historique reste intact (merge).
    ...profilSportifDepuisReponses(r),
    gymEquipment: input.passthrough.gymEquipment,
    hasHomeEquipment: input.passthrough.hasHomeEquipment,
    homeEquipment: input.passthrough.homeEquipment,
    ...(requiresParentalConsent(r.ageCategory)
      ? { parentalConsent: buildParentalConsent(r.ageCategory, input.storedParentalConsent) }
      : {}),
    profileCompleted: true,
    ...(input.autoCycleId
      ? {
          microcycleGoal: input.autoCycleId,
          goal: input.autoCycleId,
          programGoal: input.autoCycleId,
          microcycleStatus: "active",
          microcycleTotalSessions: MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
          microcycleSessionIndex: 0,
          microcycleStartedAt: deps.serverTimestamp(),
        }
      : {}),
    updatedAt: deps.serverTimestamp(),
  });

  // 4. Finalisé : le brouillon n'a plus d'objet (suppression coordonnée — elle
  //    passe après toute sauvegarde encore en vol).
  await deps.effacerBrouillon(input.uid);
  return { status: "saved" };
}
