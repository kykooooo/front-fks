// hooks/home/useEtatStoresHome.ts
// =============================================================================
// LA SEULE LECTURE DES STORES DERRIERE LE HOME ET LA PROGRESSION
// =============================================================================
//
// Ce hook fait UNE chose : lire les stores et l'horloge, et rendre l'etat brut
// que les adaptateurs PURS (`./homeVNextAdapter`) savent normaliser. Aucune
// regle d'affichage ne vit ici — s'il fallait en ecrire une, sa place serait
// dans un selecteur, ou elle est testable sans monter React.
//
// POURQUOI IL EST SORTI DE `useHomeVNextViewModel` : depuis le lot L5, DEUX
// ecrans veulent les memes chiffres — l'accueil et la page Progression. Ils ne
// veulent pas le meme ViewModel (la page n'a pas de bloc « Ma semaine »), mais
// ils doivent partir du MEME etat. Recopier ces quinze lectures dans un second
// hook, c'etait accepter qu'un jour l'un lise `weeklyGoal` avec un `?? 2` et
// l'autre sans — exactement le defaut « deux numerateurs, deux denominateurs »
// que ce chantier supprime.
//
// L'HORLOGE : `useDebugStore.devNowISO ?? todayISO()` — la meme convention que
// `usePrimaryCta` et `useTrackingProgress`. Les selecteurs ne lisent jamais
// `new Date()` eux-memes, ce qui les rend reproductibles.
// =============================================================================

import { useMemo } from "react";

import type { EtatStoresHome } from "./homeVNextAdapter";

import { auth } from "../../services/firebase";
import { todayISO } from "../../utils/virtualClock";
import { useDebugStore } from "../../state/stores/useDebugStore";
import { useExternalStore } from "../../state/stores/useExternalStore";
import { useLoadStore } from "../../state/stores/useLoadStore";
import { useSessionsStore } from "../../state/stores/useSessionsStore";
import { useSyncStore } from "../../state/stores/useSyncStore";
import { useSettingsStore } from "../../state/settingsStore";
import { useNetworkStatus } from "../useNetworkStatus";
import { useMainObjective } from "../useMainObjective";
import { useTestsStorage } from "../../screens/tests/hooks/useTestsStorage";

/** Reference stable : un tableau litteral dans le corps du hook relancerait les memos a chaque rendu. */
const VIDE_STRING: string[] = [];

export function useEtatStoresHome(): EtatStoresHome {
  // ── Horloge ──
  const devNowISO = useDebugStore((s) => s.devNowISO);

  // ── Seances & cycle ──
  const sessions = useSessionsStore((s) => s.sessions);
  const lastAiSessionV2 = useSessionsStore((s) => s.lastAiSessionV2);
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);

  // ── Charges ──
  const dailyApplied = useLoadStore((s) => s.dailyApplied);
  const lastAppliedDate = useLoadStore((s) => s.lastAppliedDate);
  const chargesExternes = useExternalStore((s) => s.externalLoads);
  const matchDays = useExternalStore((s) => s.matchDays);
  const targetFksSessionsPerWeek = useExternalStore((s) => s.targetFksSessionsPerWeek);

  // ── Reglages & synchro ──
  const storeHydrated = useSyncStore((s) => s.storeHydrated);
  const debutDeSemaine = useSettingsStore((s) => s.weekStart);
  // LU BRUT, sans `?? 2` : la resolution se fait une seule fois, dans
  // `resoudreObjectifHebdo` (domain/resumeCanonique.ts). Ce champ est le REPLI
  // DEPRECIE — plus aucun ecran ne l'ecrit depuis que les Reglages editent le
  // champ canonique (`services/objectifHebdo.ts`) ; il ne sert plus qu'aux
  // comptes anciens depourvus de `targetFksSessionsPerWeek`.
  //
  // HONNETETE SUR LA PORTEE DU `null` : `state/settingsStore.ts` pose
  // `weeklyGoal: 2` par defaut, donc cette lecture rend TOUJOURS un nombre et
  // `resoudreObjectifHebdo` ne peut pas rendre `null` sur un compte reel. Le
  // « 0 sur 2 » qu'on veut eviter est ecarte ailleurs, par le garde
  // `nbSeancesTerminees > 0` du ViewModel : c'est ce garde qui protege le compte
  // neuf, pas ce `null`.
  const weeklyGoalReglage = useSettingsStore((s) => s.weeklyGoal);

  // ── Sources hors stores ──
  const { isOnline } = useNetworkStatus();
  const mainObjective = useMainObjective();
  const { entries: testsTerrain } = useTestsStorage();

  const nowISO = devNowISO ?? todayISO();
  const displayName = auth.currentUser?.displayName ?? null;

  return useMemo<EtatStoresHome>(
    () => ({
      displayName,
      nowISO,
      storeHydrated: storeHydrated ?? true,
      sessions: sessions ?? [],
      chargesExternes: chargesExternes ?? [],
      dailyApplied,
      lastAppliedDate,
      lastAiSessionV2: (lastAiSessionV2 ?? null) as Record<string, unknown> | null,
      microcycleGoal: microcycleGoal ?? null,
      microcycleSessionIndex: microcycleSessionIndex ?? 0,
      targetFksSessionsPerWeek: targetFksSessionsPerWeek ?? null,
      weeklyGoalReglage: typeof weeklyGoalReglage === "number" ? weeklyGoalReglage : null,
      debutDeSemaine: debutDeSemaine === "sun" ? "sun" : "mon",
      matchDays: matchDays ?? VIDE_STRING,
      enLigne: isOnline,
      testsTerrain,
      mainObjective,
    }),
    [
      displayName,
      nowISO,
      storeHydrated,
      sessions,
      chargesExternes,
      dailyApplied,
      lastAppliedDate,
      lastAiSessionV2,
      microcycleGoal,
      microcycleSessionIndex,
      targetFksSessionsPerWeek,
      weeklyGoalReglage,
      debutDeSemaine,
      matchDays,
      isOnline,
      testsTerrain,
      mainObjective,
    ]
  );
}
