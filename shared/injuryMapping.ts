// shared/injuryMapping.ts
//
// ══════════════════════════════════════════════════════════════════════════
// ⚠️  FICHIER PARTAGÉ FRONT ↔ BACK — DOIT RESTER STRICTEMENT IDENTIQUE
// ══════════════════════════════════════════════════════════════════════════
//
// Les deux repos FKS ont leur propre copie de ce fichier :
//   • Frontend  : C:/Users/Gamer/front-fks/shared/injuryMapping.ts
//   • Backend   : C:/Users/Gamer/fks/src/shared/injuryMapping.ts
//
// Ces deux copies DOIVENT être identiques byte à byte.
// /sync-check point #6 : vérifier l'égalité avant tout déploiement.
//
// Source de vérité = zones fr (UI joueur, InjuryArea côté front)
// Cible            = contraindications backend (fksFilters.ts / exerciseBank.ts)
//
// Responsabilité :
//   - Le frontend sérialise `profile.activeInjuries` + fallback
//     `dayStates.injury` vers `constraints.pains: string[]` via ce mapping.
//   - Le backend filtre les exos via `ex.contraindications.includes(pain)`.
//
// Ajout d'une nouvelle zone (ex: "aine") :
//   1. Ajouter la valeur dans `InjuryAreaFR` ci-dessous.
//   2. Ajouter la contraindication dans `BackendPainToken` (et côté back,
//      aussi mettre à jour `type Contraindication` dans `exerciseBank.ts`).
//   3. Ajouter l'entrée dans `INJURY_AREA_TO_BACKEND_PAIN`.
//   4. Synchroniser ce fichier front + back (byte à byte).
//   5. Annoter les exos concernés côté back (`exerciseBank.ts`).
// ══════════════════════════════════════════════════════════════════════════

export type InjuryAreaFR =
  | "cheville"
  | "genou"
  | "ischio"
  | "quadriceps"
  | "mollet"
  | "hanche"
  | "dos"
  | "épaule"
  | "poignet"
  | "autre";

export type BackendPainToken =
  | "ankle_pain"
  | "knee_pain"
  | "hamstring_acute"
  | "quad_pain"
  | "calf_pain"
  | "hip_pain"
  | "back_pain"
  | "shoulder_pain"
  | "wrist_pain"
  | "groin_pain";

/**
 * Mapping officiel zone (UI fr) → contraindication backend.
 *
 * Cas "autre" : non mappé. Le cap de sécurité (severity >= 3 → cap easy)
 * + blocage du "hard" côté orchestrateur (painSet.size === 0) couvrent
 * quand même le joueur à ce niveau de risque.
 *
 * Cas "groin_pain" : pas de zone UI fr correspondante en MVP (adducteurs).
 * Déjà présent côté back pour annotation d'exos, mais non émis côté front.
 */
export const INJURY_AREA_TO_BACKEND_PAIN: Partial<Record<InjuryAreaFR, BackendPainToken>> = {
  cheville: "ankle_pain",
  genou: "knee_pain",
  ischio: "hamstring_acute",
  quadriceps: "quad_pain",
  mollet: "calf_pain",
  hanche: "hip_pain",
  dos: "back_pain",
  "épaule": "shoulder_pain",
  poignet: "wrist_pain",
  // "autre" : intentionnellement absent (non filtrable sans zone précise).
};

/**
 * Conversion tolérante (string brut → token backend).
 * Utilisable côté front depuis `aiContext.ts` et côté back depuis tout
 * module qui veut normaliser une zone venue de Firestore ou d'un contexte
 * externe.
 *
 * Retourne `null` si la zone n'est pas mappable (zone inconnue ou "autre").
 */
export function mapAreaToPain(area: string | null | undefined): BackendPainToken | null {
  if (!area) return null;
  const key = String(area).trim().toLowerCase() as InjuryAreaFR;
  return INJURY_AREA_TO_BACKEND_PAIN[key] ?? null;
}
