// hooks/useTrackingProgress.ts
// Hook de la section "Ton suivi" (ProgressScreen, Lot 6) : branche les stores
// (lecture seule) + Firestore (selfReportedGapDays) sur la fonction PURE
// buildTrackingProgress (hooks/trackingProgress/buildTrackingProgress.ts,
// testée sans mock -- voir hooks/__tests__/useTrackingProgress.test.ts).
//
// Isolée dans son propre fichier (pas de React/trackEvent dans le module pur) :
// services/analytics.ts entraîne @amplitude/analytics-react-native, qui embarque
// sa PROPRE copie imbriquée de @react-native-async-storage/async-storage —
// jest.setup.js ne peut pas la mocker (mock résolu depuis la racine, pas depuis
// le sous-module imbriqué). Importer trackEvent dans le module pur casserait
// donc les tests de logique sans rapport avec l'analytics.
import { useEffect, useMemo, useRef } from "react";

import { buildTrackingProgress, type TrackingProgressViewModel } from "./trackingProgress/buildTrackingProgress";
import { todayISO } from "../utils/virtualClock";
import { trackEvent } from "../services/analytics";

import { useExecutionStore } from "../state/stores/useExecutionStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useExternalStore } from "../state/stores/useExternalStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import { useSelfReportedGapDays } from "./useSelfReportedGapDays";

export type { TrackingProgressViewModel } from "./trackingProgress/buildTrackingProgress";

export function useTrackingProgress(): TrackingProgressViewModel {
  const executionHistory = useExecutionStore((s) => s.history);
  const lastDecision = useExecutionStore((s) => s.lastDecision);
  const sessions = useSessionsStore((s) => s.sessions ?? []);
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);
  const targetFksSessionsPerWeek = useExternalStore((s) => s.targetFksSessionsPerWeek);
  const devNowISO = useDebugStore((s) => s.devNowISO);
  const selfReportedGapDays = useSelfReportedGapDays();

  const nowISO = devNowISO ?? todayISO();

  const viewModel = useMemo(
    () =>
      buildTrackingProgress({
        nowISO,
        executionHistory,
        sessions,
        lastDecision,
        microcycleGoal,
        microcycleSessionIndex,
        targetFksSessionsPerWeek,
        selfReportedGapDays,
      }),
    [
      nowISO,
      executionHistory,
      sessions,
      lastDecision,
      microcycleGoal,
      microcycleSessionIndex,
      targetFksSessionsPerWeek,
      selfReportedGapDays,
    ]
  );

  // Observabilité : resumption_detected, une seule fois par mount (cf. brief Lot 6).
  const trackedRef = useRef(false);
  useEffect(() => {
    if (trackedRef.current || !viewModel.resumption) return;
    trackedRef.current = true;
    trackEvent("resumption_detected", {
      level: viewModel.resumption.level,
      source: viewModel.resumption.source,
    });
  }, [viewModel.resumption]);

  return viewModel;
}
