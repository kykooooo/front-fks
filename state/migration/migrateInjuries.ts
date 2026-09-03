// state/migration/migrateInjuries.ts
// =============================================================================
// REPRISE DES BLESSURES HISTORIQUES : dayStates.feedback.injury -> BodyInjury[]
// =============================================================================
//
// CE QU'ELLE FAIT, ET RIEN DE PLUS
// -----------------------------------------------------------------------------
// Avant « Mon corps », une blessure vivait dans `dayStates[jour].feedback.injury`
// et n'etait consideree active que pendant `INJURY_ACTIVE_WINDOW_DAYS` jours
// glissants. La reprise rejoue EXACTEMENT cette regle une derniere fois :
//   - on regarde la meme fenetre (la meme constante, pas un 7 recopie) ;
//   - par zone, la declaration la PLUS RECENTE fait foi ;
//   - une severite 0 ("OK" de l'ancien formulaire) etait une levee explicite :
//     elle ne cree aucune gene ;
//   - ce qui survit devient une `BodyInjury` `active`, source `feedback`.
//
// Une declaration hors fenetre n'est PAS reprise : elle n'agissait deja plus
// hier. La reprendre en `active` reveillerait une gene que l'app avait
// silencieusement oubliee — ce serait fabriquer une contrainte, pas la migrer.
//
// CE QU'ELLE NE FAIT PAS
// -----------------------------------------------------------------------------
// Elle n'efface rien : les `dayStates` restent en place (l'historique subjectif
// fatigue / douleur sert ailleurs). Elle ecrit une seule fois, et rejouer ne
// duplique rien (double garde, cf. `useBodyStore.appliquerMigrationFeedback`).
// =============================================================================

import type { BodyArea, BodyInjury, BodyInjurySeverity, DayState, InjuryRecord } from "../../domain/types";
import { estZoneConnue } from "../../domain/monCorps/zones";
import { lastNDates, toDateKey } from "../../utils/dateHelpers";
import { INJURY_ACTIVE_WINDOW_DAYS } from "../../services/aiContextHelpers";
import { useBodyStore } from "../stores/useBodyStore";
import { useFeedbackStore } from "../stores/useFeedbackStore";
import { useDebugStore } from "../stores/useDebugStore";

type DayStateLike = { feedback?: { injury?: InjuryRecord | null } | null } | null | undefined;

/**
 * PURE. Ne lit aucun store : recoit les `dayStates` et la cle du jour, pour
 * rester testable avec une horloge virtuelle.
 *
 * Retourne les `BodyInjury` a creer, les plus recentes en tete. Liste vide
 * quand il n'y a rien a reprendre — jamais un objet de remplissage.
 */
export function migrerDayStatesVersMonCorps(
  dayStates: Record<string, DayStateLike> | null | undefined,
  todayKey: string
): BodyInjury[] {
  if (!dayStates || !todayKey) return [];

  // `lastNDates` va du plus recent au plus ancien : la premiere declaration
  // rencontree pour une zone est la plus recente, elle fait foi.
  const fenetre = lastNDates(todayKey, INJURY_ACTIVE_WINDOW_DAYS);
  const derniereParZone = new Map<string, { jour: string; injury: InjuryRecord }>();

  for (const jour of fenetre) {
    const injury = dayStates[jour]?.feedback?.injury;
    if (!injury || typeof injury.area !== "string") continue;
    const zone = injury.area.trim().toLowerCase();
    if (!zone || derniereParZone.has(zone)) continue;
    derniereParZone.set(zone, { jour, injury });
  }

  const reprises: BodyInjury[] = [];
  for (const [zone, { jour, injury }] of derniereParZone) {
    const severite = Number(injury.severity);
    // Severite 0 = levee explicite dans l'ancien formulaire. Rien a reprendre.
    if (!Number.isFinite(severite) || severite < 1) continue;
    if (!estZoneConnue(zone)) continue;

    const gravite = Math.min(3, Math.max(1, Math.trunc(severite))) as BodyInjurySeverity;
    const horodatage = `${jour}T12:00:00.000Z`;
    reprises.push({
      // Identifiant DETERMINISTE : rejouer la reprise produit le meme id, donc
      // jamais deux lignes pour la meme declaration.
      id: `mig_${zone}_${jour}`,
      zone: zone as BodyArea,
      gravite,
      statut: "active",
      source: "feedback",
      declaredAt: horodatage,
      updatedAt: horodatage,
      ...(typeof injury.note === "string" && injury.note.trim()
        ? { note: injury.note.trim() }
        : {}),
    });
  }

  // Plus recentes en tete (meme ordre que le store).
  return reprises.sort((a, b) => (a.declaredAt < b.declaredAt ? 1 : -1));
}

/**
 * Joue la reprise sur les stores reels. Idempotente : le store refuse de
 * rejouer une fois le marqueur pose, et deduplique par zone + jour.
 */
export function lancerMigrationBlessures(): void {
  const body = useBodyStore.getState();
  if (body.migrationFeedbackAt) return;

  const nowISO = useDebugStore.getState().devNowISO ?? new Date().toISOString();
  const dayStates = useFeedbackStore.getState().dayStates as Record<string, DayState>;
  const candidats = migrerDayStatesVersMonCorps(dayStates, toDateKey(nowISO));
  body.appliquerMigrationFeedback(candidats, nowISO);
}

/**
 * Arme la reprise pour qu'elle tourne quand les DEUX stores concernes sont
 * hydrates.
 *
 * Le piege que ca evite : `useBodyStore` se rehydrate en parallele des autres.
 * Jouer la reprise trop tot lirait un `dayStates` vide et ne migrerait rien —
 * EN SILENCE, ce qui est le pire des cas (le marqueur serait pose sur du vide).
 */
export function armerMigrationBlessures(): void {
  const quandPret = () => {
    if (!useBodyStore.persist.hasHydrated()) return false;
    if (!useFeedbackStore.persist.hasHydrated()) return false;
    lancerMigrationBlessures();
    return true;
  };

  if (quandPret()) return;
  const desabonnerBody = useBodyStore.persist.onFinishHydration(() => {
    if (quandPret()) desabonnerBody?.();
  });
  const desabonnerFeedback = useFeedbackStore.persist.onFinishHydration(() => {
    if (quandPret()) desabonnerFeedback?.();
  });
}
