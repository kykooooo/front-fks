// components/home/homeUi.ts
// Design system LOCAL du Home joueur (DA "Nike" — hero plein écran noir),
// indépendant du thème global (theme.colors, clair par défaut / bascule
// possible en Réglages). Même principe que coachColors dans
// components/coach/coachUi.tsx : on ne touche jamais `theme.colors`. Le Home
// garde toujours son identité sombre, quel que soit le themeMode choisi
// ailleurs dans l'app (voir App.tsx > FORCED_LIGHT_STATUS_BAR_ROUTES pour le
// pendant StatusBar).

export const homeColors = {
  bg: "#000000",
  bgElevated: "#0A0A0B",
  heroFrom: "#111113",
  heroTo: "#000000",
  card: "#141416",
  cardSoft: "#1B1B1E",
  border: "#28282C",
  borderSoft: "#232326",
  text: "#FFFFFF",
  sub: "#A1A1AA",
  muted: "#71717A",
  accent: "#7DA2E8",
  accentSoft: "rgba(125,162,232,0.16)",
  cta: "#FF7A1A",
  ctaSoft: "rgba(255,122,26,0.16)",
  success: "#34D399",
  warn: "#FBBF24",
  danger: "#FB7185",
};

export const homeRadius = { card: 20, chip: 12, pill: 999 };
