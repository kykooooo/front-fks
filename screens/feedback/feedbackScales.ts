// screens/feedback/feedbackScales.ts
// Constantes et helpers partagés pour le feedback

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const getRpeColor = (value: number): string => {
  if (value <= 3) return '#16a34a';
  if (value <= 5) return '#84cc16';
  if (value <= 7) return '#f59e0b';
  if (value <= 8) return '#f97316';
  return '#ef4444';
};

export const RPE_LABELS: Record<number, string> = {
  1: 'Repos',
  2: 'Très léger',
  3: 'Léger',
  4: 'Modéré',
  5: 'Contrôlé',
  6: 'Soutenu',
  7: 'Difficile',
  8: 'Très dur',
  9: 'Extrême',
  10: 'Maximum',
};

export type SegmentedOption = { value: number; label: string };

export const FATIGUE_SCALE: SegmentedOption[] = [
  { value: 1, label: 'Très frais' },
  { value: 2, label: 'Plutôt bien' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Fatigué' },
  { value: 5, label: 'Très fatigué' },
];

// Échelle EVA 0-10 (norme médicale), remappée sur 6 segments UI pour
// préserver la simplicité mobile. Les valeurs sont 0/2/4/6/8/10.
// Seuils clés :
//   - value >= 6 : PAIN_THRESHOLDS.smallEffectFrom → petite réduction charge
//   - value >= 7 : déclenche la règle injury_pain_spike (carte Home CRITIQUE)
export const PAIN_SCALE: SegmentedOption[] = [
  { value: 0, label: 'Aucune gêne' },
  { value: 2, label: 'Très légère' },
  { value: 4, label: 'Présente' },
  { value: 6, label: 'Gênante' },
  { value: 8, label: 'Importante' },
  { value: 10, label: 'Limitante' },
];

export const RECOVERY_SCALE: SegmentedOption[] = [
  { value: 1, label: 'Très mal' },
  { value: 2, label: 'Moyen' },
  { value: 3, label: 'Correct' },
  { value: 4, label: 'Bien' },
  { value: 5, label: 'Excellent' },
];
