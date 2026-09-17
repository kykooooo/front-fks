import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SettingsState = {
  /**
   * PRÉFÉRENCE du joueur (pas la permission du téléphone) : veut-il des
   * notifications ? La permission OS et la programmation effective des
   * rappels vivent dans services/notifications.ts — les trois sont distincts.
   */
  notificationsEnabled: boolean;
  sessionReminders: boolean;
  /**
   * @deprecated Jamais appliqué par le service (le rappel de séance est
   * quotidien à heure fixe, cf. SESSION_REMINDER_TIME). Plus aucun écran ne
   * l'affiche ni ne l'écrit depuis 2026-09 ; conservé pour ne pas casser la
   * persistance des joueurs déjà installés.
   */
  reminderStrategy: "prev_evening" | "same_morning" | "two_hours";
  /** Sons de séance : n'existent QUE sur le web (AudioContext). Réglage masqué en natif. */
  soundsEnabled: boolean;
  hapticsEnabled: boolean;
  autoFeedbackEnabled: boolean;
  /**
   * « Statistiques d'utilisation » : collecte Amplitude ON/OFF. Appliquée par
   * services/analytics.ts (opt-out du SDK). PRÉSERVÉE par `resetSettings` :
   * une collecte refusée ne se réactive jamais en silence.
   */
  privacyAnalytics: boolean;
  /** @deprecated Sans consommateur (rien ne masque quoi que ce soit). Masqué de l'UI en 2026-09, valeur conservée. */
  privateMode: boolean;
  /** @deprecated Aucune conversion implémentée. Masqué de l'UI en 2026-09, valeur conservée. */
  distanceUnit: "km" | "mi";
  /** @deprecated Aucune conversion implémentée. Masqué de l'UI en 2026-09, valeur conservée. */
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

/**
 * Ce que « Réinitialiser les préférences de l'appareil » ne touche PAS :
 *  - `privacyAnalytics` : un refus de collecte est un consentement retiré, pas
 *    une préférence de confort. Le remettre à `true` par un bouton de reset
 *    réactiverait la collecte sans que le joueur l'ait demandé ;
 *  - `weeklyGoal` : repli historique de l'objectif hebdo (voir plus haut), jamais
 *    un réglage de l'appareil.
 */
export const RESET_PRESERVED_KEYS = ["privacyAnalytics", "weeklyGoal"] as const;

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
          // Ordre important : « activer le rappel rallume les notifications »
          // doit passer AVANT « notifications coupées = rappel coupé », sinon
          // le rappel qu'on vient d'activer est éteint dans le même geste.
          if (patch.sessionReminders && !state.notificationsEnabled && patch.notificationsEnabled !== false) {
            next.notificationsEnabled = true;
          }
          if (!next.notificationsEnabled) {
            next.sessionReminders = false;
          }
          return next;
        }),
      resetSettings: () =>
        set((state) => {
          const preserved: Partial<SettingsState> = {};
          for (const key of RESET_PRESERVED_KEYS) {
            (preserved as Record<string, unknown>)[key] = state[key];
          }
          return { ...DEFAULT_SETTINGS, ...preserved, _hydrated: true };
        }),
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
