// components/coach/coachUi.tsx
//
// FAÇADE HISTORIQUE du design system coach.
// Les tokens (couleurs, rayons, espacements, typographie, statuts) ont déménagé
// dans `coachTheme.ts`, qui est désormais la seule source de vérité. Ce fichier
// ne garde qu'un ré-export de `coachColors` / `coachRadius` pour ne RIEN casser
// dans `CoachOnboardingScreen`, le seul écran qui les importe encore d'ici.
//
// `CoachBadge` a été retiré (juillet 2026) : sa seule consommation était les
// deux écrans coach hérités (`CoachHomeScreen`, `CoachPlayerDetailScreen`),
// supprimés du dépôt car non routés depuis la refonte `screens/coach/`.
//
// Pour tout nouveau code : importer depuis `coachTheme.ts`, et préférer
// `CoachStatusPill` à un badge générique dès qu'il s'agit d'un STATUT.

import { coachColors, coachRadius } from "./coachTheme";

export { coachColors, coachRadius };
