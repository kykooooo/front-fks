// hooks/home/useHomeVNextViewModel.ts
// =============================================================================
// LE BRANCHEMENT — LES VRAIS STORES DERRIERE LE HOME VNEXT
// =============================================================================
//
// Ce hook fait UNE chose : lire les stores et l'horloge, puis passer le tout a
// l'adaptateur PUR (`./homeVNextAdapter`) et aux deux selecteurs PURS
// (`screens/homeVNext/viewModel.ts`, `progressionViewModel.ts`). Aucune regle
// d'affichage ne vit ici — s'il fallait en ecrire une, sa place serait dans le
// selecteur, ou elle est testable sans monter React.
//
// PERSONNE NE LE CONSOMME ENCORE, ET C'EST VOLONTAIRE. Ce lot livre la chaine
// de donnees complete, verifiable, sans toucher un seul ecran de production :
// le Home actuel continue de tourner sur son propre code, a l'identique. Le
// branchement de l'ecran est le lot suivant.
//
// L'HORLOGE : `useDebugStore.devNowISO ?? todayISO()` — la meme convention que
// `usePrimaryCta` et `useTrackingProgress`. Les selecteurs ne lisent jamais
// `new Date()` eux-memes, ce qui les rend reproductibles.
// =============================================================================

import { useMemo } from "react";

import {
  buildHomeVNextViewModel,
  type HomeVNextInput,
  type HomeVNextViewModel,
} from "../../screens/homeVNext/viewModel";
import {
  buildProgressionViewModel,
  type ProgressionViewModel,
} from "../../screens/homeVNext/progressionViewModel";
import {
  construireEntreeHome,
  construireEntreeProgression,
  construireSemaineCouranteDepuisLeHome,
  type EtatStoresHome,
} from "./homeVNextAdapter";

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

export type HomeVNextViewModels = {
  /** Le ViewModel de l'ecran. */
  vm: HomeVNextViewModel;
  /** Le ViewModel de la carte progression (variante 2). */
  progression: ProgressionViewModel;
  /** L'entree exacte qui a produit les deux — utile au visualiseur et au debug. */
  etat: EtatStoresHome;
  /**
   * L'entree normalisee du selecteur d'ecran.
   *
   * Exposee pour UNE raison precise : le conteneur doit savoir SUR QUELLE
   * SEANCE le ViewModel a fonde son action, pour naviguer vers celle-la et pas
   * une autre. `HomeVNextViewModel` ne porte deliberement aucun identifiant —
   * une couche de presentation n'a pas a transporter de cle technique — et
   * re-selectionner la seance dans le conteneur ouvrirait l'ecart : entre le
   * calcul et le tap, un watcher Firestore peut changer la selection, et le
   * joueur partirait sur une seance qu'il n'a jamais vue a l'ecran.
   */
  entree: HomeVNextInput;
};

export function useHomeVNextViewModel(): HomeVNextViewModels {
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
  // LU BRUT, sans `?? 2` : le repli par defaut est resolu une seule fois, dans
  // `resoudreObjectifHebdo` (domain/resumeCanonique.ts), qui rend `null` quand
  // personne n'a rien declare. Ecrire un 2 ici le rendrait indiscernable d'un
  // objectif choisi par le joueur.
  const weeklyGoalReglage = useSettingsStore((s) => s.weeklyGoal);

  // ── Sources hors stores ──
  const { isOnline } = useNetworkStatus();
  const mainObjective = useMainObjective();
  const { entries: testsTerrain } = useTestsStorage();

  const nowISO = devNowISO ?? todayISO();
  const displayName = auth.currentUser?.displayName ?? null;

  const etat = useMemo<EtatStoresHome>(
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

  return useMemo(() => {
    const entreeHome = construireEntreeHome(etat);
    // Variante 2 et bloc de demarrage V-A : les deux decisions sont fermees.
    const vm = buildHomeVNextViewModel(entreeHome, { variante: "v2", demarrage: "A" });

    // R7 — la carte progression a besoin de savoir ce que « Ma semaine » affiche
    // DEJA sur le meme ecran, pour ne pas redire le meme chiffre. On le lui donne
    // depuis le ViewModel qui vient d'etre construit : pas de second calcul.
    // Le cablage est une fonction PURE et testee
    // (`construireSemaineCouranteDepuisLeHome`) : ecrit en ligne ici, il etait
    // vrai par construction et protege par aucun test.
    const progression = buildProgressionViewModel(
      construireEntreeProgression(etat, construireSemaineCouranteDepuisLeHome(vm))
    );

    return { vm, progression, etat, entree: entreeHome };
  }, [etat]);
}
