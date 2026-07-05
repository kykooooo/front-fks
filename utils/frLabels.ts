// utils/frLabels.ts
// Traductions FR des tokens techniques renvoyés par le backend (intensité,
// focus, lieu). Fallback : renvoie le token d'origine si inconnu — on
// n'affiche jamais undefined ni une chaîne vide inattendue.

const INTENSITY_FR: Record<string, string> = {
  easy: "Facile",
  moderate: "Modéré",
  hard: "Intense",
  recovery: "Récup",
};

const FOCUS_FR: Record<string, string> = {
  run: "Course",
  strength: "Force",
  speed: "Vitesse",
  accel: "Accélération",
  cod: "Appuis",
  plyo: "Détente",
  core: "Gainage",
  mobility: "Mobilité",
  circuit: "Circuit",
  recovery: "Récupération",
  endurance: "Endurance",
  engine: "Endurance",
  prevention: "Prévention",
  warmup: "Échauffement",
};

const LOCATION_FR: Record<string, string> = {
  gym: "Salle",
  pitch: "Terrain",
  home: "Maison",
  anywhere: "Partout",
  outdoor: "Extérieur",
};

export const frIntensity = (token?: string | null): string =>
  token ? INTENSITY_FR[token.toLowerCase()] ?? token : "";

export const frFocus = (token?: string | null): string =>
  token ? FOCUS_FR[token.toLowerCase()] ?? token : "";

export const frLocation = (token?: string | null): string =>
  token ? LOCATION_FR[token.toLowerCase()] ?? token : "";
