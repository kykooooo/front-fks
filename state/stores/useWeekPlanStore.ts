// state/stores/useWeekPlanStore.ts
//
// É1 (voir C:\Users\Gamer\fks/src/dev/PLANNING_HEBDO_DESIGN.md §3 P8, §7.3) :
// déplacements manuels de la joueuse sur le plan hebdo (domain/weekPlanning.ts).
//
// LOCAL UNIQUEMENT — la sync Firestore `users/{uid}.plannedWeek` est réservée
// à É2 (design §4.2 : le champ additif n'existe pas encore ; §7.3 : "É1 ...
// tout derrière FEATURES.WEEK_PLAN", aucune écriture Firestore avant É2).
// Comme `plannedFksDays` (useSyncStore) avant lui, ce store persiste en
// AsyncStorage sur l'appareil, pas plus.
//
// Portée = UNE semaine (weekKey = lundi, `weekKeyOf`). Changer de semaine
// invalide les déplacements précédents (pas de dette, principe 2.2.4 du
// design) : `moveSession` écrase silencieusement les overrides d'une
// ancienne semaine dès qu'un nouveau déplacement arrive sur la semaine
// courante ; `days` (hooks/routine/useWeekPlan.ts) ignore de toute façon
// tout override dont `weekKey` ne correspond pas à la semaine affichée.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createMigratedStorage } from "./storage";
import type { DowKey } from "../../domain/weekPlanning";

export type WeekPlanMove = { from: DowKey; to: DowKey };

export type WeekPlanOverrideState = {
  weekKey: string | null;
  moves: WeekPlanMove[];

  /** P8 — déplace la séance prescrite du jour `from` vers `to`. Le refus/étiquette sont décidés en amont par `evaluateManualMove` ; ce store se contente d'enregistrer un déplacement déjà validé. */
  moveSession: (weekKey: string, from: DowKey, to: DowKey) => void;
  /** Annule le déplacement dont l'origine est `from` (la séance redevient placée sur son jour d'origine). */
  cancelMove: (weekKey: string, from: DowKey) => void;
  resetWeekPlanOverrides: () => void;
};

const baseWeekPlanState = () => ({
  weekKey: null as string | null,
  moves: [] as WeekPlanMove[],
});

export const useWeekPlanStore = create<WeekPlanOverrideState>()(
  persist(
    (set) => ({
      ...baseWeekPlanState(),

      moveSession: (weekKey, from, to) =>
        set((s) => {
          // Semaine différente de celle en mémoire -> les overrides précédents ne s'appliquent plus.
          const carried = s.weekKey === weekKey ? s.moves : [];
          // Un jour d'origine ne porte qu'un déplacement actif ; un jour cible ne reçoit qu'une séance.
          const next = carried.filter((m) => m.from !== from && m.to !== to);
          next.push({ from, to });
          return { weekKey, moves: next };
        }),

      cancelMove: (weekKey, from) =>
        set((s) => {
          if (s.weekKey !== weekKey) return {};
          return { moves: s.moves.filter((m) => m.from !== from) };
        }),

      resetWeekPlanOverrides: () => set(baseWeekPlanState()),
    }),
    {
      name: "fks-weekplan-v1",
      version: 1,
      storage: createMigratedStorage(),
    }
  )
);

export const getWeekPlanDefaults = baseWeekPlanState;
