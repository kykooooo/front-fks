// constants/theme.ts

type ThemeColors = {
  bg: string;
  bgSoft: string;
  card: string;
  cardSoft: string;
  border: string;
  borderSoft: string;
  text: string;
  sub: string;
  muted: string;
  accent: string;
  accentSoft: string;
  /** Couleur d'action clé (CTA) + alertes — orange FKS, réservé aux boutons primaires. */
  cta: string;
  ctaSoft: string;
  success: string;
  warn: string;
  danger: string;
  info: string;
  background: string;
  surface: string;
  surfaceSoft: string;
  textMuted: string;
};

// DA claire premium (par défaut) : blanc/gris froid très léger (fini le beige),
// accent bleu profond pour l'ambient (états actifs, liens, highlights),
// orange réservé aux CTA/alertes via `cta`.
const lightColors: ThemeColors = {
  bg: "#F5F7FA",
  bgSoft: "#ffffff",
  card: "#ffffff",
  cardSoft: "#F1F4F8",
  border: "#E2E7EE",
  borderSoft: "#EAEEF4",
  text: "#141A24",
  sub: "#586374",
  muted: "#8A93A1",
  accent: "#2A4D8F",
  accentSoft: "#E9EEF7",
  cta: "#F2741B",
  ctaSoft: "rgba(242,116,27,0.14)",
  success: "#15803D",
  warn: "#D97706",
  danger: "#DC2626",
  info: "#2A4D8F",
  background: "#F5F7FA",
  surface: "#ffffff",
  surfaceSoft: "#F1F4F8",
  textMuted: "#586374",
};

// Dark conservé comme option. Accent bleu clair (cohérence brand), CTA orange.
const darkColors: ThemeColors = {
  bg: "#070707",
  bgSoft: "#0b0b0e",
  card: "#111114",
  cardSoft: "#15161a",
  border: "#232327",
  borderSoft: "#2c2c33",
  text: "#f9fafb",
  sub: "#a1a1aa",
  muted: "#a1a1aa",
  accent: "#6E97E0",
  accentSoft: "rgba(110,151,224,0.18)",
  cta: "#ff7a1a",
  ctaSoft: "rgba(255,122,26,0.18)",
  success: "#f5b942",
  warn: "#fbbf24",
  danger: "#fb7185",
  info: "#60a5fa",
  background: "#070707",
  surface: "#111114",
  surfaceSoft: "#15161a",
  textMuted: "#a1a1aa",
};

type ThemeShadow = {
  soft: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
  accent: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
};

const lightShadow: ThemeShadow = {
  soft: {
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  accent: {
    shadowColor: "#ff7a1a",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

const darkShadow: ThemeShadow = {
  soft: {
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  accent: {
    shadowColor: "#ff7a1a",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
};

export type ThemeMode = "light" | "dark";

export let theme = {
  colors: { ...lightColors },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    pill: 999,
  },
  typography: {
    display: { fontSize: 28, lineHeight: 32, fontWeight: "800" as const },
    h1: { fontSize: 22, lineHeight: 28, fontWeight: "800" as const },
    h2: { fontSize: 18, lineHeight: 24, fontWeight: "700" as const },
    body: { fontSize: 14, lineHeight: 20, fontWeight: "500" as const },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
    micro: { fontSize: 10, lineHeight: 14, fontWeight: "600" as const },
  },
  shadow: { ...lightShadow },
};

export function setThemeMode(mode: ThemeMode) {
  const nextColors = mode === "dark" ? darkColors : lightColors;
  const nextShadow = mode === "dark" ? darkShadow : lightShadow;
  Object.assign(theme.colors, nextColors);
  Object.assign(theme.shadow.soft, nextShadow.soft);
  Object.assign(theme.shadow.accent, nextShadow.accent);
}
