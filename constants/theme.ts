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
  success: string;
  warn: string;
  danger: string;
  info: string;
  background: string;
  surface: string;
  surfaceSoft: string;
  textMuted: string;
};

const lightColors: ThemeColors = {
  bg: "#f7f5f1",
  bgSoft: "#ffffff",
  card: "#ffffff",
  cardSoft: "#f1ede6",
  border: "#e6e1d9",
  borderSoft: "#ede8df",
  text: "#141414",
  sub: "#6b6b6b",
  muted: "#8b8b8b",
  accent: "#ff7a1a",
  accentSoft: "rgba(255,122,26,0.14)",
  success: "#16a34a",
  warn: "#f59e0b",
  danger: "#ef4444",
  info: "#2563eb",
  background: "#f7f5f1",
  surface: "#ffffff",
  surfaceSoft: "#f1ede6",
  textMuted: "#6b6b6b",
};

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
  accent: "#ff7a1a",
  accentSoft: "rgba(255,122,26,0.18)",
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
