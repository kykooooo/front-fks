// theme/authDesignSystem.ts
// Design system premium — Nike Training Club × Strava
// Noir profond, corail chaud, minimaliste, breathing space

// ──────────────────────────────────────────
// PALETTE
// ──────────────────────────────────────────

export const ds = {
  // ── Backgrounds ──
  // Noir profond Nike TC — pas de gris, du NOIR
  bg: "#050505",
  // Surface : noir légèrement relevé (cartes, inputs, zones)
  surface: "#111111",
  // Surface surélevée (hover, focus)
  surfaceHover: "#1a1a1a",

  // ── Accent : corail chaud ──
  // Entre le rouge Strava (#FC4C02) et notre ancien orange (#ff7a1a)
  // Chaud, énergique, premium — pas "alerte"
  accent: "#E8553A", // corail profond — signature FKS
  accentHover: "#F06A50", // version plus claire au press
  accentSoft: "rgba(232,85,58,0.12)", // fond chip/card sélectionné
  accentMuted: "rgba(232,85,58,0.40)", // bordure discrète

  // ── Texte ──
  text: "#F5F5F5", // blanc cassé — plus doux que du blanc pur
  textSecondary: "#8E8E93", // gris iOS system — descriptions, placeholders
  textTertiary: "#636366", // gris sombre — hints très discrets
  textOnAccent: "#FFFFFF", // blanc pur sur fond accent

  // ── Sémantique ──
  success: "#34C759", // vert Apple/sportif — pas vert hôpital
  error: "#FF6B6B", // rouge doux — pas agressif
  warning: "#FFB84D", // ambre chaud

  // ── Borders ──
  border: "#1F1F1F", // bord de carte — à peine visible
  borderFocus: "#3A3A3A", // bord input focus
  borderAccent: "#E8553A", // bord sélectionné

  // ── Gradients ──
  // Fond hero : noir → soupçon de corail en bas (5% max)
  gradientHero: ["#050505", "#0A0505"] as const,
  // Boutons accent
  gradientAccent: ["#E8553A", "#D44A32"] as const,
  // Bouton disabled
  gradientDisabled: ["#2A2A2A", "#222222"] as const,
} as const;

// ──────────────────────────────────────────
// TYPOGRAPHIE
// ──────────────────────────────────────────

export const typo = {
  // Hero (WelcomeScreen titre principal)
  hero: {
    fontSize: 42,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
    lineHeight: 46,
  },
  // Titre d'écran (Login, Register, ProfileSetup)
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  // Sous-titre / description courte
  subtitle: {
    fontSize: 16,
    fontWeight: "400" as const,
    letterSpacing: 0,
    lineHeight: 22,
  },
  // Body / labels
  body: {
    fontSize: 15,
    fontWeight: "500" as const,
    letterSpacing: 0,
    lineHeight: 20,
  },
  // Caption / hints
  caption: {
    fontSize: 13,
    fontWeight: "500" as const,
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  // Bouton principal
  button: {
    fontSize: 17,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
    lineHeight: 22,
  },
  // Label section (uppercase)
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    lineHeight: 16,
  },
  // Brand
  brand: {
    fontSize: 48,
    fontWeight: "900" as const,
    letterSpacing: 6,
  },
} as const;

// ──────────────────────────────────────────
// SPACING — Nike breathing room
// ──────────────────────────────────────────

export const space = {
  screenH: 24, // padding horizontal écran
  sectionGap: 32, // gap entre grandes sections
  elementGap: 16, // gap entre éléments proches
  cardPadding: 20, // padding intérieur des cartes
  inputGap: 20, // gap entre inputs
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ──────────────────────────────────────────
// RADIUS
// ──────────────────────────────────────────

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

// ──────────────────────────────────────────
// ANIMATIONS
// ──────────────────────────────────────────

export const anim = {
  // Nike = smooth et lent
  fast: 200,
  medium: 350,
  slow: 500,
  // Press feedback
  pressScale: 0.97,
  pressOpacity: 0.85,
  // Sélection card/chip
  selectScale: 1.03,
  // Pulse CTA (WelcomeScreen)
  pulseScale: 1.02,
  pulseDuration: 1500,
} as const;

// ──────────────────────────────────────────
// COMPOSANTS — styles réutilisables
// ──────────────────────────────────────────

import { StyleSheet, Platform } from "react-native";

export const dsComponents = StyleSheet.create({
  // ── Bouton primary ──
  buttonPrimary: {
    height: 56,
    borderRadius: radius.md,
    overflow: "hidden" as const,
    // Pas de shadow sur iOS — plus clean
  },
  buttonPrimaryInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  buttonPrimaryText: {
    color: ds.textOnAccent,
    ...typo.button,
  },

  // ── Bouton secondary (texte seul) ──
  buttonSecondary: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonSecondaryText: {
    color: ds.textSecondary,
    ...typo.body,
    fontWeight: "600",
  },

  // ── Input field ──
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    color: ds.textSecondary,
    ...typo.sectionLabel,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    backgroundColor: ds.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ds.border,
    paddingHorizontal: 16,
  },
  inputWrapperFocus: {
    borderColor: ds.borderFocus,
  },
  inputIcon: {
    marginRight: 12,
    color: ds.textTertiary,
  },
  input: {
    flex: 1,
    color: ds.text,
    ...typo.body,
    paddingVertical: 0,
  },

  // ── Card sélection (poste, environnement) ──
  selectionCard: {
    backgroundColor: ds.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: ds.border,
    alignItems: "center",
    justifyContent: "center",
    // pas de shadow — profondeur par la couleur
  },
  selectionCardActive: {
    borderColor: ds.accent,
    backgroundColor: ds.accentSoft,
  },

  // ── Chip (niveau, pied, jours, matos) ──
  chip: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ds.border,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    borderColor: ds.accent,
    backgroundColor: ds.accentSoft,
  },
  chipText: {
    color: ds.textSecondary,
    ...typo.caption,
    fontWeight: "600",
  },
  chipTextActive: {
    color: ds.accent,
    fontWeight: "700",
  },

  // ── Day chip (rond) ──
  dayChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: ds.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  dayChipActive: {
    borderColor: ds.accent,
    backgroundColor: ds.accentSoft,
  },

  // ── Progress bar ──
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ds.border,
    overflow: "hidden" as const,
  },
  progressFill: {
    height: "100%",
    borderRadius: 1.5,
    backgroundColor: ds.accent,
  },

  // ── Dots pagination (traits Nike) ──
  dotActive: {
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ds.accent,
  },
  dotInactive: {
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ds.border,
  },

  // ── Inline error ──
  inlineError: {
    color: ds.error,
    ...typo.caption,
    marginLeft: 4,
    marginTop: 4,
  },

  // ── Signature bar (sous le logo) ──
  signatureBar: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ds.accent,
    alignSelf: "center",
  },
});
