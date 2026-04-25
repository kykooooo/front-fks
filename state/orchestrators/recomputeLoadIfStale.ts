// state/orchestrators/recomputeLoadIfStale.ts
//
// Helper centralisé qui force la décroissance ATL/CTL/TSB jusqu'à aujourd'hui
// si les métriques persistées datent d'un jour antérieur.
//
// Problème métier (audit) : `rebuildLoad()` n'est appelé qu'au cold start de
// l'app via `rehydrateFromStorage()`. Si l'utilisateur reste 30 jours sans
// activité ET ne force-quit pas l'app, le jour change sans que les métriques
// soient recalculées → TSB figé sur la valeur "fatigué" du jour 0.
//
// Cette fonction doit être appelée :
//   - avant `buildAIPromptContext()` (sécurité génération séance)
//   - sur `useFocusEffect` HomeScreen (changement de jour visible UI)
//   - avant tout rendu de métrique de charge "fraîche"
//
// Idempotente : ne fait rien si la métrique est déjà à jour.

import { todayISO } from "../../utils/virtualClock";
import { toDateKey } from "../../utils/dateHelpers";
import { useLoadStore } from "../stores/useLoadStore";
import { useDebugStore } from "../stores/useDebugStore";
import { rebuildLoad } from "./rebuildLoad";

/**
 * Recalcule ATL/CTL/TSB jusqu'à `today` si les métriques sont en retard.
 *
 * @param today ISO ou DateKey optionnel (utile pour tests + virtual clock).
 *              Si omis, utilise debugStore.devNowISO ou Date.now().
 * @returns `true` si un recalcul a eu lieu, `false` si déjà à jour.
 */
export function recomputeLoadIfStale(today?: string): boolean {
  const debugState = useDebugStore.getState();
  const nowISO = today ?? debugState.devNowISO ?? todayISO();
  const nowKey = toDateKey(nowISO);

  const loadState = useLoadStore.getState();
  const lastKey = loadState.lastLoadDayKey ?? null;

  // Si jamais calculé OU si jour différent → recalcule
  // (lastKey peut être null après un reset/login)
  if (!lastKey || lastKey !== nowKey) {
    rebuildLoad({ decayToNow: true });
    return true;
  }
  return false;
}
