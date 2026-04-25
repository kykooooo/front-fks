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
  white: string;
  white90: string;
  white85: string;
  white80: string;
  white70: string;
  white62: string;
  white45: string;
  white35: string;
  white30: string;
  white20: string;
  white22: string;
  white18: string;
  white16: string;
  white14: string;
  white12: string;
  white10: string;
  white08: string;
  white07: string;
  white06: string;
  white05: string;
  white04: string;
  white03: string;
  black: string;
  black15: string;
  black25: string;
  black40: string;
  black50: string;
  black55: string;
  black60: string;
  black70: string;
  black72: string;
  black88: string;
  black92: string;
  panel92: string;
  panel88: string;
  slate55: string;
  slate60: string;
  accentAlt: string;
  accentSoft12: string;
  accentSoft15: string;
  accentSoft28: string;
  accentSoft45: string;
  blue500: string;
  blue600: string;
  blue400: string;
  violet500: string;
  violet400: string;
  cyan500: string;
  cyan400: string;
  teal500: string;
  teal400: string;
  emerald500: string;
  emerald400: string;
  green500: string;
  green600: string;
  green400: string;
  amber500: string;
  amber400: string;
  orange600: string;
  red500: string;
  red600: string;
  rose400: string;
  gray500: string;
  gray400: string;
  zinc50: string;
  zinc400: string;
  slate50: string;
  rose300: string;
  lime500: string;
  orange500: string;
  steel300: string;
  purple500: string;
  pink500: string;
  ink950: string;
  ink930: string;
  ink920: string;
  ink910: string;
  ink900: string;
  ink880: string;
  ink870: string;
  neutral850: string;
  plum900: string;
  forest950: string;
  forest900: string;
  navy950: string;
  navy900: string;
  ember950: string;
  ember900: string;
  green: string;
  greenSoft08: string;
  greenSoft12: string;
  greenSoft15: string;
  greenSoft20: string;
  green500Soft10: string;
  green500Soft12: string;
  green500Soft15: string;
  green500Soft40: string;
  emerald: string;
  emeraldSoft15: string;
  amber: string;
  amberSoft06: string;
  amberSoft08: string;
  amberSoft10: string;
  amberSoft12: string;
  amberSoft14: string;
  amberSoft15: string;
  amberSoft16: string;
  amberSoft18: string;
  amberSoft50: string;
  amberSoft30: string;
  red: string;
  red600Soft10: string;
  redSoft05: string;
  redSoft06: string;
  redSoft10: string;
  redSoft12: string;
  redSoft15: string;
  redSoft18: string;
  blue: string;
  blueSoft08: string;
  blueSoft12: string;
  blueSoft15: string;
  blue500Soft08: string;
  blue500Soft15: string;
  sky: string;
  skySoft02: string;
  skySoft10: string;
  violet: string;
  violetSoft06: string;
  violetSoft08: string;
  violetSoft12: string;
  violetSoft15: string;
  cyan: string;
  infoBrightSoft08: string;
  cyanSoft15: string;
  teal: string;
  tealSoft15: string;
  gray: string;
  graySoft10: string;
  white50: string;
  black65: string;
  black08: string;
  accentSoft04: string;
  accentSoft08: string;
  accentSoft10: string;
  accentSoft24: string;
  panel80: string;
  panel88Alt: string;
  panel92Alt: string;
  neutralSoft04: string;
  slateSoft06: string;
  bronzeSoft12: string;
  bronzeSoft40: string;
  silverSoft12: string;
  silverSoft40: string;
  goldSoft14: string;
  goldSoft50: string;
};

export const TYPE = {
  hero: { fontSize: 28, fontWeight: "800" as const, letterSpacing: 1.5 },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: 0.5 },
  subtitle: { fontSize: 18, fontWeight: "600" as const, letterSpacing: 0.3 },
  body: { fontSize: 15, fontWeight: "400" as const },
  bodyBold: { fontSize: 15, fontWeight: "600" as const },
  caption: { fontSize: 12, fontWeight: "500" as const, letterSpacing: 0.2 },
  micro: {
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  display: {
    sm: { fontSize: 32, fontWeight: "800" as const, letterSpacing: 0.4 },
    xl: { fontSize: 48, fontWeight: "800" as const, letterSpacing: 0.1 },
    md: { fontSize: 42, fontWeight: "800" as const, letterSpacing: 0.2 },
    lg: { fontSize: 64, fontWeight: "800" as const, letterSpacing: 0 },
  },
} as const;

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

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
  white: "#ffffff",
  white90: "rgba(255,255,255,0.9)",
  white85: "rgba(255,255,255,0.85)",
  white80: "rgba(255,255,255,0.8)",
  white70: "rgba(255,255,255,0.7)",
  white62: "rgba(255,255,255,0.62)",
  white45: "rgba(255,255,255,0.45)",
  white35: "rgba(255,255,255,0.35)",
  white30: "rgba(255,255,255,0.3)",
  white20: "rgba(255,255,255,0.2)",
  white22: "rgba(255,255,255,0.22)",
  white18: "rgba(255,255,255,0.18)",
  white16: "rgba(255,255,255,0.16)",
  white14: "rgba(255,255,255,0.14)",
  white12: "rgba(255,255,255,0.12)",
  white10: "rgba(255,255,255,0.10)",
  white08: "rgba(255,255,255,0.08)",
  white07: "rgba(255,255,255,0.07)",
  white06: "rgba(255,255,255,0.06)",
  white05: "rgba(255,255,255,0.05)",
  white04: "rgba(255,255,255,0.04)",
  white03: "rgba(255,255,255,0.03)",
  black: "#000000",
  black15: "rgba(0,0,0,0.15)",
  black25: "rgba(0,0,0,0.25)",
  black40: "rgba(0,0,0,0.4)",
  black50: "rgba(0,0,0,0.5)",
  black55: "rgba(0,0,0,0.55)",
  black60: "rgba(0,0,0,0.6)",
  black70: "rgba(0,0,0,0.7)",
  black72: "rgba(7,7,9,0.72)",
  black88: "rgba(0,0,0,0.88)",
  black92: "rgba(0,0,0,0.92)",
  panel92: "rgba(14,15,19,0.92)",
  panel88: "rgba(7,7,7,0.88)",
  slate55: "rgba(9, 11, 16, 0.55)",
  slate60: "rgba(31, 36, 48, 0.6)",
  accentAlt: "#ff9a4a",
  accentSoft12: "rgba(255,122,26,0.12)",
  accentSoft15: "rgba(255,122,26,0.15)",
  accentSoft28: "rgba(255,122,26,0.28)",
  accentSoft45: "rgba(255,122,26,0.45)",
  blue500: "#3b82f6",
  blue600: "#2563eb",
  blue400: "#60a5fa",
  violet500: "#8b5cf6",
  violet400: "#a78bfa",
  cyan500: "#06b6d4",
  cyan400: "#22d3ee",
  teal500: "#14b8a6",
  teal400: "#2dd4bf",
  emerald500: "#10b981",
  emerald400: "#34d399",
  green500: "#22c55e",
  green600: "#16a34a",
  green400: "#4ade80",
  amber500: "#f59e0b",
  amber400: "#fbbf24",
  orange600: "#d97706",
  red500: "#ef4444",
  red600: "#dc2626",
  rose400: "#fb7185",
  gray500: "#6b7280",
  gray400: "#9ca3af",
  zinc50: "#f9fafb",
  zinc400: "#a1a1aa",
  slate50: "#f8fafc",
  rose300: "#f87171",
  lime500: "#84cc16",
  orange500: "#f97316",
  steel300: "#9fb0c8",
  purple500: "#a855f7",
  pink500: "#ec4899",
  ink950: "#050507",
  ink930: "#0b0d12",
  ink920: "#12161d",
  ink910: "#0d0d10",
  ink900: "#131316",
  ink880: "#0f0f17",
  ink870: "#0f0f0f",
  neutral850: "#1a1a1a",
  plum900: "#1a1a2a",
  forest950: "#0f170f",
  forest900: "#1a2a1a",
  navy950: "#0a0f17",
  navy900: "#0f1a2a",
  ember950: "#170f0a",
  ember900: "#2a1a0f",
  green: "#22c55e",
  greenSoft08: "rgba(22, 163, 74, 0.08)",
  greenSoft12: "rgba(22,163,74,0.12)",
  greenSoft15: "rgba(22, 163, 74, 0.15)",
  greenSoft20: "rgba(34, 197, 94, 0.2)",
  green500Soft10: "rgba(34, 197, 94, 0.1)",
  green500Soft12: "rgba(34, 197, 94, 0.12)",
  green500Soft15: "rgba(34, 197, 94, 0.15)",
  green500Soft40: "rgba(34, 197, 94, 0.4)",
  emerald: "#10b981",
  emeraldSoft15: "rgba(20, 184, 166, 0.15)",
  amber: "#f59e0b",
  amberSoft06: "rgba(245, 158, 11, 0.06)",
  amberSoft08: "rgba(245, 158, 11, 0.08)",
  amberSoft10: "rgba(245, 158, 11, 0.10)",
  amberSoft12: "rgba(245, 158, 11, 0.12)",
  amberSoft14: "rgba(245,158,11,0.14)",
  amberSoft15: "rgba(245, 158, 11, 0.15)",
  amberSoft16: "rgba(245,158,11,0.16)",
  amberSoft18: "rgba(245, 158, 11, 0.18)",
  amberSoft50: "rgba(245,158,11,0.5)",
  amberSoft30: "rgba(245, 158, 11, 0.3)",
  red: "#ef4444",
  red600Soft10: "rgba(220, 38, 38, 0.10)",
  redSoft05: "rgba(239, 68, 68, 0.05)",
  redSoft06: "rgba(239,68,68,0.06)",
  redSoft10: "rgba(239, 68, 68, 0.10)",
  redSoft12: "rgba(239,68,68,0.12)",
  redSoft15: "rgba(239, 68, 68, 0.15)",
  redSoft18: "rgba(239, 68, 68, 0.18)",
  blue: "#2563eb",
  blueSoft08: "rgba(37, 99, 235, 0.08)",
  blueSoft12: "rgba(37, 99, 235, 0.12)",
  blueSoft15: "rgba(37, 99, 235, 0.15)",
  blue500Soft08: "rgba(59, 130, 246, 0.08)",
  blue500Soft15: "rgba(59, 130, 246, 0.15)",
  sky: "#60a5fa",
  skySoft02: "rgba(96,165,250,0.02)",
  skySoft10: "rgba(96,165,250,0.10)",
  violet: "#8b5cf6",
  violetSoft06: "rgba(139, 92, 246, 0.06)",
  violetSoft08: "rgba(139, 92, 246, 0.08)",
  violetSoft12: "rgba(139, 92, 246, 0.12)",
  violetSoft15: "rgba(139, 92, 246, 0.15)",
  cyan: "#06b6d4",
  infoBrightSoft08: "rgba(14,165,233,0.08)",
  cyanSoft15: "rgba(6,182,212,0.15)",
  teal: "#14b8a6",
  tealSoft15: "rgba(20, 184, 166, 0.15)",
  gray: "#6b7280",
  graySoft10: "rgba(161,161,170,0.10)",
  white50: "rgba(255,255,255,0.5)",
  black65: "rgba(0,0,0,0.65)",
  black08: "rgba(0,0,0,0.08)",
  accentSoft04: "rgba(255,122,26,0.04)",
  accentSoft08: "rgba(255,122,26,0.08)",
  accentSoft10: "rgba(255,122,26,0.10)",
  accentSoft24: "rgba(255,122,26,0.24)",
  panel80: "rgba(5,5,9,0.8)",
  panel88Alt: "rgba(5,7,12,0.88)",
  panel92Alt: "rgba(17,20,28,0.92)",
  neutralSoft04: "rgba(20,20,20,0.04)",
  slateSoft06: "rgba(15,23,42,0.06)",
  bronzeSoft12: "rgba(205,127,50,0.12)",
  bronzeSoft40: "rgba(205,127,50,0.4)",
  silverSoft12: "rgba(192,192,192,0.12)",
  silverSoft40: "rgba(192,192,192,0.4)",
  goldSoft14: "rgba(255,193,37,0.14)",
  goldSoft50: "rgba(255,193,37,0.5)",
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
  white: "#ffffff",
  white90: "rgba(255,255,255,0.9)",
  white85: "rgba(255,255,255,0.85)",
  white80: "rgba(255,255,255,0.8)",
  white70: "rgba(255,255,255,0.7)",
  white62: "rgba(255,255,255,0.62)",
  white45: "rgba(255,255,255,0.45)",
  white35: "rgba(255,255,255,0.35)",
  white30: "rgba(255,255,255,0.3)",
  white20: "rgba(255,255,255,0.2)",
  white22: "rgba(255,255,255,0.22)",
  white18: "rgba(255,255,255,0.18)",
  white16: "rgba(255,255,255,0.16)",
  white14: "rgba(255,255,255,0.14)",
  white12: "rgba(255,255,255,0.12)",
  white10: "rgba(255,255,255,0.10)",
  white08: "rgba(255,255,255,0.08)",
  white07: "rgba(255,255,255,0.07)",
  white06: "rgba(255,255,255,0.06)",
  white05: "rgba(255,255,255,0.05)",
  white04: "rgba(255,255,255,0.04)",
  white03: "rgba(255,255,255,0.03)",
  black: "#000000",
  black15: "rgba(0,0,0,0.15)",
  black25: "rgba(0,0,0,0.25)",
  black40: "rgba(0,0,0,0.4)",
  black50: "rgba(0,0,0,0.5)",
  black55: "rgba(0,0,0,0.55)",
  black60: "rgba(0,0,0,0.6)",
  black70: "rgba(0,0,0,0.7)",
  black72: "rgba(7,7,9,0.72)",
  black88: "rgba(0,0,0,0.88)",
  black92: "rgba(0,0,0,0.92)",
  panel92: "rgba(14,15,19,0.92)",
  panel88: "rgba(7,7,7,0.88)",
  slate55: "rgba(9, 11, 16, 0.55)",
  slate60: "rgba(31, 36, 48, 0.6)",
  accentAlt: "#ff9a4a",
  accentSoft12: "rgba(255,122,26,0.12)",
  accentSoft15: "rgba(255,122,26,0.15)",
  accentSoft28: "rgba(255,122,26,0.28)",
  accentSoft45: "rgba(255,122,26,0.45)",
  blue500: "#3b82f6",
  blue600: "#2563eb",
  blue400: "#60a5fa",
  violet500: "#8b5cf6",
  violet400: "#a78bfa",
  cyan500: "#06b6d4",
  cyan400: "#22d3ee",
  teal500: "#14b8a6",
  teal400: "#2dd4bf",
  emerald500: "#10b981",
  emerald400: "#34d399",
  green500: "#22c55e",
  green600: "#16a34a",
  green400: "#4ade80",
  amber500: "#f59e0b",
  amber400: "#fbbf24",
  orange600: "#d97706",
  red500: "#ef4444",
  red600: "#dc2626",
  rose400: "#fb7185",
  gray500: "#6b7280",
  gray400: "#9ca3af",
  zinc50: "#f9fafb",
  zinc400: "#a1a1aa",
  slate50: "#f8fafc",
  rose300: "#f87171",
  lime500: "#84cc16",
  orange500: "#f97316",
  steel300: "#9fb0c8",
  purple500: "#a855f7",
  pink500: "#ec4899",
  ink950: "#050507",
  ink930: "#0b0d12",
  ink920: "#12161d",
  ink910: "#0d0d10",
  ink900: "#131316",
  ink880: "#0f0f17",
  ink870: "#0f0f0f",
  neutral850: "#1a1a1a",
  plum900: "#1a1a2a",
  forest950: "#0f170f",
  forest900: "#1a2a1a",
  navy950: "#0a0f17",
  navy900: "#0f1a2a",
  ember950: "#170f0a",
  ember900: "#2a1a0f",
  green: "#22c55e",
  greenSoft08: "rgba(22, 163, 74, 0.08)",
  greenSoft12: "rgba(22,163,74,0.12)",
  greenSoft15: "rgba(22, 163, 74, 0.15)",
  greenSoft20: "rgba(34, 197, 94, 0.2)",
  green500Soft10: "rgba(34, 197, 94, 0.1)",
  green500Soft12: "rgba(34, 197, 94, 0.12)",
  green500Soft15: "rgba(34, 197, 94, 0.15)",
  green500Soft40: "rgba(34, 197, 94, 0.4)",
  emerald: "#10b981",
  emeraldSoft15: "rgba(20, 184, 166, 0.15)",
  amber: "#f59e0b",
  amberSoft06: "rgba(245, 158, 11, 0.06)",
  amberSoft08: "rgba(245, 158, 11, 0.08)",
  amberSoft10: "rgba(245, 158, 11, 0.10)",
  amberSoft12: "rgba(245, 158, 11, 0.12)",
  amberSoft14: "rgba(245,158,11,0.14)",
  amberSoft15: "rgba(245, 158, 11, 0.15)",
  amberSoft16: "rgba(245,158,11,0.16)",
  amberSoft18: "rgba(245, 158, 11, 0.18)",
  amberSoft50: "rgba(245,158,11,0.5)",
  amberSoft30: "rgba(245, 158, 11, 0.3)",
  red: "#ef4444",
  red600Soft10: "rgba(220, 38, 38, 0.10)",
  redSoft05: "rgba(239, 68, 68, 0.05)",
  redSoft06: "rgba(239,68,68,0.06)",
  redSoft10: "rgba(239, 68, 68, 0.10)",
  redSoft12: "rgba(239,68,68,0.12)",
  redSoft15: "rgba(239, 68, 68, 0.15)",
  redSoft18: "rgba(239, 68, 68, 0.18)",
  blue: "#2563eb",
  blueSoft08: "rgba(37, 99, 235, 0.08)",
  blueSoft12: "rgba(37, 99, 235, 0.12)",
  blueSoft15: "rgba(37, 99, 235, 0.15)",
  blue500Soft08: "rgba(59, 130, 246, 0.08)",
  blue500Soft15: "rgba(59, 130, 246, 0.15)",
  sky: "#60a5fa",
  skySoft02: "rgba(96,165,250,0.02)",
  skySoft10: "rgba(96,165,250,0.10)",
  violet: "#8b5cf6",
  violetSoft06: "rgba(139, 92, 246, 0.06)",
  violetSoft08: "rgba(139, 92, 246, 0.08)",
  violetSoft12: "rgba(139, 92, 246, 0.12)",
  violetSoft15: "rgba(139, 92, 246, 0.15)",
  cyan: "#06b6d4",
  infoBrightSoft08: "rgba(14,165,233,0.08)",
  cyanSoft15: "rgba(6,182,212,0.15)",
  teal: "#14b8a6",
  tealSoft15: "rgba(20, 184, 166, 0.15)",
  gray: "#6b7280",
  graySoft10: "rgba(161,161,170,0.10)",
  white50: "rgba(255,255,255,0.5)",
  black65: "rgba(0,0,0,0.65)",
  black08: "rgba(0,0,0,0.08)",
  accentSoft04: "rgba(255,122,26,0.04)",
  accentSoft08: "rgba(255,122,26,0.08)",
  accentSoft10: "rgba(255,122,26,0.10)",
  accentSoft24: "rgba(255,122,26,0.24)",
  panel80: "rgba(5,5,9,0.8)",
  panel88Alt: "rgba(5,7,12,0.88)",
  panel92Alt: "rgba(17,20,28,0.92)",
  neutralSoft04: "rgba(20,20,20,0.04)",
  slateSoft06: "rgba(15,23,42,0.06)",
  bronzeSoft12: "rgba(205,127,50,0.12)",
  bronzeSoft40: "rgba(205,127,50,0.4)",
  silverSoft12: "rgba(192,192,192,0.12)",
  silverSoft40: "rgba(192,192,192,0.4)",
  goldSoft14: "rgba(255,193,37,0.14)",
  goldSoft50: "rgba(255,193,37,0.5)",
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
  type: TYPE,
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    ...RADIUS,
    xxl: RADIUS.xl,
  },
  typography: {
    display: { ...TYPE.hero, lineHeight: 32 },
    h1: { ...TYPE.title, lineHeight: 28 },
    h2: { ...TYPE.subtitle, lineHeight: 24 },
    body: { ...TYPE.body, lineHeight: 20 },
    bodyBold: { ...TYPE.bodyBold, lineHeight: 20 },
    caption: { ...TYPE.caption, lineHeight: 16 },
    micro: { ...TYPE.micro, lineHeight: 14 },
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
