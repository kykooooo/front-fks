// config/features.ts
// Flags de fonctionnalité (même pattern que config/devFlags.ts).
export const FEATURES = {
  // É0 (voir domain/weekPlanning.ts) : module de règles pur, prêt mais pas
  // encore branché (aucun appelant). É1 câblera l'écran Routine v2 derrière
  // ce flag — voir C:\Users\Gamer\fks/src/dev/PLANNING_HEBDO_DESIGN.md §7.1.
  WEEK_PLAN: false,
};
