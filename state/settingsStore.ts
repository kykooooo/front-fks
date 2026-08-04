import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SettingsState = {
  notificationsEnabled: boolean;
  sessionReminders: boolean;
  reminderStrategy: "prev_evening" | "same_morning" | "two_hours";
  soundsEnabled: boolean;
  hapticsEnabled: boolean;
  autoFeedbackEnabled: boolean;
  privacyAnalytics: boolean;
  privateMode: boolean;
  distanceUnit: "km" | "mi";
  weightUnit: "kg" | "lb";
  weekStart: "mon" | "sun";
  themeMode: "light" | "dark";
  /**
   * @deprecated REPLI SEULEMENT — l'objectif hebdo canonique est
   * `users/{uid}.targetFksSessionsPerWeek` (miroir local :
   * `useExternalStore.targetFksSessionsPerWeek`), pose au setup profil et edite
   * par les Reglages via `services/objectifHebdo.ts`.
   *
   * PLUS AUCUN ECRAN N'ECRIT CE CHAMP. Il n'est plus lu qu'a travers
   * `resoudreObjectifHebdo` (domain/resumeCanonique.ts), et seulement quand le
   * champ canonique est absent — un compte ancien, jamais passe par le setup
   * dans sa forme actuelle. Il n'a PAS ete supprime parce qu'il est persiste
   * chez des joueurs deja installes : le retirer effacerait leur objectif au
   * lieu de le migrer.
   *
   * Le defaut a 2 ci-dessous est un choix historique assume, et c'est lui qui
   * empeche `resoudreObjectifHebdo` de rendre `null` en conditions reelles : un
   * objectif jamais declare y est indiscernable d'un 2 choisi. Sa portee est
   * aujourd'hui nulle en pratique — le setup impose le champ canonique — mais
   * ce n'est pas une garantie de type, c'est un fait de parcours.
   */
  weeklyGoal: number;
};

export const DEFAULT_SETTINGS: SettingsState = {
  notificationsEnabled: true,
  sessionReminders: true,
  reminderStrategy: "prev_evening",
  soundsEnabled: true,
  hapticsEnabled: true,
  autoFeedbackEnabled: true,
  privacyAnalytics: true,
  privateMode: false,
  distanceUnit: "km",
  weightUnit: "kg",
  weekStart: "mon",
  themeMode: "light",
  weeklyGoal: 2,
};

type SettingsStore = SettingsState & {
  _hydrated: boolean;
  updateSettings: (patch: Partial<SettingsState>) => void;
  resetSettings: () => void;
};

const clampWeeklyGoal = (value: number) =>
  Math.max(1, Math.min(6, Math.round(value)));

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      _hydrated: false,
      updateSettings: (patch) =>
        set((state) => {
          const next = { ...state, ...patch };
          if (typeof patch.weeklyGoal === "number") {
            next.weeklyGoal = clampWeeklyGoal(patch.weeklyGoal);
          }
          if (!next.notificationsEnabled) {
            next.sessionReminders = false;
          }
          if (patch.sessionReminders && !state.notificationsEnabled) {
            next.notificationsEnabled = true;
          }
          return next;
        }),
      resetSettings: () => set({ ...DEFAULT_SETTINGS, _hydrated: true }),
    }),
    {
      name: "fks_settings_v1",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ _hydrated: true });
      },
    }
  )
);
