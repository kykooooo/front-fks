// screens/feedback/hooks/useReadinessScore.ts
import { useMemo } from 'react';
import { clamp } from '../feedbackScales';

export function useReadinessScore(fatigue: number, pain: number, recovery: number) {
  const readiness = useMemo(() => {
    const fatigueScore = (5 - (fatigue - 1)) / 4;
    const painScore = (5 - pain) / 5;
    const recScore = (recovery - 1) / 4;
    const raw = (fatigueScore + painScore + recScore) / 3;
    return Math.round(clamp(raw, 0, 1) * 100);
  }, [fatigue, pain, recovery]);

  const readinessLabel = useMemo(() => {
    if (readiness >= 80) return 'Prêt à performer';
    if (readiness >= 60) return 'OK pour pousser';
    if (readiness >= 40) return 'Effort modéré';
    return 'Focus gestion / récup';
  }, [readiness]);

  return { readiness, readinessLabel };
}
