// hooks/useWeeklyGoal.ts
//
// É1.5 — résout le doublon `settingsStore.weeklyGoal` (local, AsyncStorage
// uniquement) / `useExternalStore.targetFksSessionsPerWeek` (profil,
// synchronisé Firestore) trouvé par le design "Planning hebdo". Les deux
// champs représentaient le même concept ("combien de séances FKS je veux par
// semaine") mais seul `targetFksSessionsPerWeek` est réellement consommé par
// le moteur (`domain/weekPlanning.computeTargetFks`, souhait joueur) et
// envoyé au backend (`services/aiContext.ts` -> target_fks_sessions_per_week).
// `settingsStore.weeklyGoal` ne pilotait donc rien : le régler dans Réglages
// changeait l'affichage du Home ("Semaine X/N") sans jamais toucher le plan
// réellement généré.
//
// Source de vérité unique retenue : `targetFksSessionsPerWeek`. Migration
// douce : `setWeeklyGoal` écrit désormais les DEUX champs à chaque
// changement (jamais un seul), pour qu'ils ne puissent plus diverger à partir
// de maintenant, sans migration de données rétroactive ni écriture
// Firestore surprise en arrière-plan. `settingsStore.weeklyGoal` reste lu par
// le Home actuel (flag WEEK_PLAN OFF) exactement comme avant — voir
// hooks/home usages — donc rien ne change tant que le flag est OFF.
import { useCallback, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { useExternalStore } from "../state/stores/useExternalStore";
import { useSettingsStore } from "../state/settingsStore";
import { showToast } from "../utils/toast";
import { WEEKLY_GOAL_MIN, WEEKLY_GOAL_MAX } from "../domain/weekPlanning";

export { WEEKLY_GOAL_MIN, WEEKLY_GOAL_MAX };

export function useWeeklyGoal() {
  const targetFksSessionsPerWeek = useExternalStore((s) => s.targetFksSessionsPerWeek);
  // Repli legacy : anciens utilisateurs/état de test où seul settingsStore.weeklyGoal existe.
  const legacyWeeklyGoal = useSettingsStore((s) => s.weeklyGoal);
  const value = targetFksSessionsPerWeek ?? legacyWeeklyGoal ?? 2;
  const [saving, setSaving] = useState(false);

  const setWeeklyGoal = useCallback(async (next: number) => {
    const clamped = Math.max(WEEKLY_GOAL_MIN, Math.min(WEEKLY_GOAL_MAX, Math.round(next)));

    const previous = useExternalStore.getState().targetFksSessionsPerWeek;
    useExternalStore.setState({ targetFksSessionsPerWeek: clamped });
    useSettingsStore.getState().updateSettings({ weeklyGoal: clamped });

    const uid = auth.currentUser?.uid ?? null;
    if (!uid) return;

    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", uid),
        { targetFksSessionsPerWeek: clamped, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      useExternalStore.setState({ targetFksSessionsPerWeek: previous });
      if (__DEV__) console.warn("[useWeeklyGoal] setDoc failed", e);
      showToast({
        type: "error",
        title: "Objectif non enregistré",
        message: "Vérifie ta connexion et réessaie.",
      });
    } finally {
      setSaving(false);
    }
  }, []);

  return { value, setWeeklyGoal, saving };
}
