// config/features.ts
// Flags de fonctionnalité (même pattern que config/devFlags.ts).
export const FEATURES = {
  // É1 (voir domain/weekPlanning.ts + hooks/routine/, screens/RoutineScreen.tsx) :
  // carte "Ta semaine" (SessionHubScreen) + écran Routine v2 + déplacement
  // manuel. OFF par défaut = strictement invisible (aucun autre point d'entrée
  // ne navigue vers "Routine"). É2 ajoutera notifications/CTA Home/sync
  // Firestore plan-aware derrière ce même flag — voir
  // C:\Users\Gamer\fks/src/dev/PLANNING_HEBDO_DESIGN.md §7.1.
  WEEK_PLAN: false,
};
