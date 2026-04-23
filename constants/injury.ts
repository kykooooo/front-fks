// constants/injury.ts

import type { InjuryArea, InjuryRestrictions } from '../domain/types';

export const INJURY_AREAS: InjuryArea[] = [
  'cheville',
  'genou',
  'ischio',
  'quadriceps',
  'mollet',
  'hanche',
  'dos',
  'épaule',
  'poignet',
  'autre',
];

// Vocabulaire UI (Option A validée Jour 3) : "gêne" plutôt que "blessure".
// Les clés numériques 0..3 restent la source de vérité côté type `InjurySeverity`
// (domain/types.ts) et côté Firestore (schemas/firestoreSchemas.ts).
export const INJURY_SEVERITY_LABELS: Record<0|1|2|3, string> = {
  0: 'Pas de gêne',
  1: 'Gêne légère',
  2: 'Gêne modérée',
  3: 'Gêne forte',
};

export const INJURY_TYPES = ['aigu', 'chronique'] as const;

export const DEFAULT_RESTRICTIONS: InjuryRestrictions = {
  avoidSprint: false,
  avoidPlyo: false,
  avoidHeavyLower: false,
  avoidHeavyUpper: false,
  avoidCutsImpacts: false,
  avoidOverhead: false,
};

// Optionnel : presets rapides par zone (peuvent être affinés plus tard)
export const RESTRICTIONS_PRESETS_BY_AREA: Partial<Record<InjuryArea, InjuryRestrictions>> = {
  genou:   { ...DEFAULT_RESTRICTIONS, avoidPlyo: true, avoidCutsImpacts: true, avoidSprint: true, avoidHeavyLower: true },
  cheville:{ ...DEFAULT_RESTRICTIONS, avoidCutsImpacts: true, avoidSprint: true, avoidPlyo: true },
  ischio:  { ...DEFAULT_RESTRICTIONS, avoidSprint: true, avoidPlyo: true, avoidHeavyLower: true },
  quadriceps:{ ...DEFAULT_RESTRICTIONS, avoidPlyo: true, avoidHeavyLower: true },
  mollet:  { ...DEFAULT_RESTRICTIONS, avoidSprint: true, avoidPlyo: true },
  hanche:  { ...DEFAULT_RESTRICTIONS, avoidHeavyLower: true, avoidPlyo: true },
  dos:     { ...DEFAULT_RESTRICTIONS, avoidHeavyLower: true, avoidHeavyUpper: true },
  épaule:  { ...DEFAULT_RESTRICTIONS, avoidOverhead: true, avoidHeavyUpper: true },
  poignet: { ...DEFAULT_RESTRICTIONS, avoidHeavyUpper: true },
};
    