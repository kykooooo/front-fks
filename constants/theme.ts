// constants/theme.ts

type ThemeColors = {
  bg: string;
  bgSoft: string;
  card: string;
  cardSoft: string;
  border: string;
  /** Bordure des éléments INTERACTIFS uniquement (inputs, chips, choices) — 3,04:1 sur `bg`. `border` reste réservé aux séparateurs décoratifs. */
  borderStrong: string;
  borderSoft: string;
  text: string;
  sub: string;
  muted: string;
  accent: string;
  accentSoft: string;
  /** Couleur d'action clé (CTA) + alertes — orange FKS, réservé aux boutons primaires. */
  cta: string;
  ctaSoft: string;
  /** Teinte de marque orange d'origine, conservée pour les surfaces non textuelles (hors CTA — cf. `cta` qui porte le texte). */
  brand: string;
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
// DA Polish (direction A, 2026-07) : cta/muted/border/accentSoft recalculés pour
// passer les 6 échecs de contraste WCAG mesurés sur le parcours d'inscription
// (cf. scratchpad/da-inscription/contrast*.js) — ratios exacts en commentaire
// sur chaque valeur.
const lightColors: ThemeColors = {
  bg: "#F5F7FA",
  bgSoft: "#ffffff",
  card: "#ffffff",
  cardSoft: "#F1F4F8",
  border: "#DDE3EB",
  borderStrong: "#7E90A8",
  borderSoft: "#EAEEF4",
  text: "#141A24",
  sub: "#586374",
  muted: "#5F6875",
  accent: "#2A4D8F",
  accentSoft: "#D6E0F2",
  cta: "#C85014",
  ctaSoft: "rgba(200,80,20,0.12)",
  brand: "#F2741B",
  success: "#15803D",
  warn: "#D97706",
  danger: "#DC2626",
  info: "#2A4D8F",
  background: "#F5F7FA",
  surface: "#ffffff",
  surfaceSoft: "#F1F4F8",
  textMuted: "#586374",
};

// Dark conservé comme option (Réglages). Hors périmètre DA Polish (parcours
// d'inscription en clair uniquement) — borderStrong/brand ajoutés seulement
// pour satisfaire ThemeColors, valeurs non retravaillées.
const darkColors: ThemeColors = {
  bg: "#070707",
  bgSoft: "#0b0b0e",
  card: "#111114",
  cardSoft: "#15161a",
  border: "#232327",
  borderStrong: "#3a3a42",
  borderSoft: "#2c2c33",
  text: "#f9fafb",
  sub: "#a1a1aa",
  muted: "#a1a1aa",
  accent: "#6E97E0",
  accentSoft: "rgba(110,151,224,0.18)",
  cta: "#ff7a1a",
  ctaSoft: "rgba(255,122,26,0.18)",
  brand: "#ff7a1a",
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
    // xl2 (DA Polish) : gouttière unifiée du parcours d'inscription (20px) —
    // marche intermédiaire vers le 16 du Home, cf. constants/theme.ts usages.
    xl2: 20,
    xl: 24,
    xxl: 32,
  },
  radius: {
    // DA Polish : le parcours d'inscription (Welcome/Register/Login/Setup)
    // n'utilise plus que 4 valeurs — md / lg / xxl / pill. `sm` et `xl` sont
    // CONSERVÉS ici : l'audit de direction les disait inutilisés (0 usage)
    // mais c'est faux hors périmètre — `radius.sm` et `radius.xl` sont
    // consommés par PrebuiltSessionDetailScreen, BlockCard, BatteryCard,
    // CycleTimingBanner, TestHeader, ExerciseDetailModal (7 sites, aucun dans
    // le périmètre de ce chantier). Les supprimer casserait la compilation
    // de ces écrans hors scope — non fait, corrigé par rapport au doc source.
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    pill: 999,
  },
  // Échelle typographique (DA Polish, lot 0 §1.1) — 6 tokens, plafond 700.
  // Remplace l'ancienne échelle (display/h1/h2/body/caption/micro, jusqu'à
  // 800) qui était du code mort (0 usage dans tout le dépôt) : chaque écran
  // redéclarait ses tailles à la main, jusqu'à 900. Devient obligatoire dans
  // les 4 écrans du parcours d'inscription (Welcome/Register/Login/Setup).
  typography: {
    display: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const, letterSpacing: -0.4 },
    title: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const, letterSpacing: -0.3 },
    section: { fontSize: 17, lineHeight: 22, fontWeight: "700" as const, letterSpacing: 0 },
    bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: "600" as const, letterSpacing: 0 },
    body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const, letterSpacing: 0 },
    label: {
      fontSize: 13,
      lineHeight: 16,
      fontWeight: "600" as const,
      letterSpacing: 0.4,
      textTransform: "uppercase" as const,
    },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const, letterSpacing: 0 },
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
