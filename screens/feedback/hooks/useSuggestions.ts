// screens/feedback/hooks/useSuggestions.ts
import { useMemo } from 'react';
import type { Session } from '../../../domain/types';

export type FeedbackSuggestion = {
  rpe: number;
  fatigue: number;
  recovery: number;
  pain: number;
  intensityLabel: string;
};

export function useSuggestions(
  prefillRpe: number | undefined,
  targetSession: Session | null | undefined,
): FeedbackSuggestion {
  return useMemo(() => {
    const intensityRaw =
      targetSession?.aiV2?.intensity ??
      targetSession?.intensity ??
      '';
    const intensity = String(intensityRaw).toLowerCase();
    const rpeTarget = (targetSession?.aiV2?.rpeTarget ?? targetSession?.aiV2?.rpe_target) as number | undefined;
    const suggestedRpe =
      prefillRpe ??
      (typeof rpeTarget === 'number'
        ? Math.max(1, Math.min(10, Math.round(rpeTarget)))
        : intensity.includes('hard')
        ? 8
        : intensity.includes('easy')
        ? 4
        : 6);
    return {
      rpe: suggestedRpe,
      fatigue: intensity.includes('hard') ? 4 : intensity.includes('easy') ? 2 : 3,
      recovery: intensity.includes('hard') ? 3 : intensity.includes('easy') ? 4 : 3,
      pain: 0,
      intensityLabel: intensity,
    };
  }, [prefillRpe, targetSession]);
}
