// constants/daJoueur.ts
//
// Jetons de la direction visuelle « Accueil + Création de séance » (17/09/2026,
// SPEC_DA_ACCUEIL_SEANCE.md §1.1). Portée VOLONTAIREMENT limitée à ces deux
// écrans (+ barre d'onglets) : `constants/theme.ts` garde toutes ses valeurs
// pour que le reste de l'app (inscription, coach, tests, etc.) ne change pas
// d'aspect. Ce fichier n'est PAS un remplacement de theme.ts, c'est une
// direction locale qui s'installe à côté.
//
// ⚠️ NE JAMAIS importer ce fichier depuis la chaîne d'imports STATIQUES
// d'App.tsx (ni transitivement). App.tsx fait `setThemeMode(themeMode)` PUIS
// un `require("./navigation/RootNavigator")` tardif — c'est ce décalage qui
// garantit que tout ce qui lit `getThemeMode()` le lit APRÈS que le mode réel
// (persisté par l'utilisateur) a été posé. Si ce module s'évalue avant cet
// appel (import statique en haut d'App.tsx, ou d'un fichier qu'App.tsx importe
// statiquement), `getThemeMode()` renvoie encore le défaut `"light"` et `da`
// se fige en clair pour tout le process — jusqu'au prochain redémarrage complet
// de l'app (le changement de thème dans Réglages force déjà ce redémarrage,
// cf. `screens/SettingsScreen.tsx` `triggerReload`, exactement pour la même
// raison : les `StyleSheet.create` de module ne relisent pas une couleur qui
// change après coup). Seuls des écrans/composants chargés par la navigation
// (donc après le `require` tardif) doivent importer `da`.
//
// `da` est choisi UNE FOIS, à l'évaluation du module (comme `theme.colors` est
// mutable mais `da` ne l'est pas : c'est un objet complet, pas une palette
// mutée en place). Les tests important `daClair`/`daSombre` directement pour
// vérifier les DEUX jeux de valeurs sans dépendre de l'ordre d'exécution.

import { getThemeMode, type ThemeMode } from "./theme";

// -----------------------------------------------------------------------------
// 1. Types
// -----------------------------------------------------------------------------

export type DaColors = {
  /** Fond d'écran. */
  bg: string;
  /** Cartes, tuiles, lignes. */
  card: string;
  /** Texte principal. */
  text: string;
  /** Texte secondaire. */
  sub: string;
  /** Bordures décoratives de cartes, séparateurs. */
  border: string;
  /** Contour des contrôles NON cochés (case à cocher, tuile non sélectionnée). */
  controlBorder: string;
  /** Fond du bouton principal, bordure/coche de sélection. */
  action: string;
  /** État pressé de `action`. */
  actionPressed: string;
  /** Texte orange (liens type « Modifier »). */
  actionText: string;
  /** Fond discret d'un élément sélectionné. */
  actionSoft: string;
  /** Texte/icône posés sur `action`. */
  onAction: string;
  /** Fond d'un bouton désactivé. */
  disabledBg: string;
  /** Texte d'un bouton désactivé. */
  disabledText: string;
  /** État attention — texte. */
  warnText: string;
  /** État attention — fond. */
  warnSoft: string;
  /** État erreur — texte. */
  dangerText: string;
  /** État erreur — fond. */
  dangerSoft: string;
  /** État positif — texte. */
  successText: string;
  /** État positif — fond. */
  successSoft: string;
};

type DaTextStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: "400" | "600" | "700" | "800";
  letterSpacing: number;
  textTransform?: "uppercase";
};

export type DaTypography = {
  display: DaTextStyle;
  title: DaTextStyle;
  section: DaTextStyle;
  bodyStrong: DaTextStyle;
  body: DaTextStyle;
  secondary: DaTextStyle;
  kicker: DaTextStyle;
  button: DaTextStyle;
};

export type DaSpacing = {
  xxs: number; // 4
  xs: number; // 8
  sm: number; // 12
  md: number; // 16
  lg: number; // 20
  xl: number; // 24
  xxl: number; // 32
};

export type DaRadius = {
  card: number;
  tile: number;
  button: number;
  check: number;
  pill: number;
};

export type DaShadow = {
  card: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
};

export type DaTokens = {
  colors: DaColors;
  /** Marge horizontale d'écran. */
  gutter: number;
  spacing: DaSpacing;
  radius: DaRadius;
  shadow: DaShadow;
  typography: DaTypography;
};

// -----------------------------------------------------------------------------
// 2. Palette CLAIRE — valeurs mesurées par l'orchestrateur (spec §1.1).
//    Ratios WCAG entre parenthèses, recalculés et prouvés par
//    `constants/__tests__/daJoueurContraste.test.ts`.
// -----------------------------------------------------------------------------

const colorsClair: DaColors = {
  bg: "#F7F7F3",
  card: "#FFFFFF",
  text: "#18211E", // 15,3:1 sur bg
  sub: "#56605B", // 6,1:1 sur bg ; 6,5:1 sur card ; 5,7:1 sur actionSoft
  border: "#E3E3DB",
  controlBorder: "#7B847F", // 3,9:1 sur card
  action: "#C44820",
  actionPressed: "#A93C19",
  actionText: "#B03F1A", // 5,5:1 sur bg ; 5,2:1 sur actionSoft
  actionSoft: "#FBEEE8",
  onAction: "#FFFFFF", // 4,9:1 sur action
  disabledBg: "#ECECE6",
  disabledText: "#56605B",
  warnText: "#92400E", // 6,4:1 sur warnSoft
  warnSoft: "#FDF3E1",
  dangerText: "#B42318", // 5,8:1 sur dangerSoft
  dangerSoft: "#FDECEA",
  successText: "#166534",
  successSoft: "#EAF6EE",
};

// -----------------------------------------------------------------------------
// 3. Palette SOMBRE — dérivée par l'agent SOCLE sur la même structure (spec :
//    fond ~#0E1110, carte ~#171B19, texte ~#F3F5F2, sub ~#A3ACA6, bordure
//    ~#262B28, action inchangé). Chaque valeur est prouvée ≥ 4,5:1 (texte) ou
//    ≥ 3:1 (contour de contrôle) par le test de contraste — ratios exacts
//    rappelés en commentaire, recalculés à chaque run (pas de confiance
//    aveugle dans un chiffre en commentaire, cf. doctrine mesure honnête).
// -----------------------------------------------------------------------------

const colorsSombre: DaColors = {
  bg: "#0E1110",
  card: "#171B19",
  text: "#F3F5F2", // 17,3:1 sur bg
  sub: "#A3ACA6", // 8,1:1 sur bg ; 7,5:1 sur card
  border: "#262B28",
  controlBorder: "#6E7873", // 4,2:1 sur bg ; 3,8:1 sur card
  action: "#C44820", // inchangé (identité de marque)
  actionPressed: "#DE5A2C",
  actionText: "#FF9466", // orange clair — 8,8:1 sur bg ; 8,0:1 sur card
  actionSoft: "#3A2018", // brun-orangé sombre opaque
  onAction: "#FFFFFF", // 4,9:1 sur action (même paire que le clair)
  disabledBg: "#23272A",
  disabledText: "#8B948E", // 4,8:1 sur disabledBg
  warnText: "#FBBF77", // 10,6:1 sur card
  warnSoft: "#3A2A12",
  dangerText: "#FF8A80", // 7,6:1 sur card
  dangerSoft: "#3A1614",
  successText: "#7FE0A0", // 10,8:1 sur card
  successSoft: "#163625",
};

// -----------------------------------------------------------------------------
// 4. Typographie — police système, aucune police ajoutée (spec §1.1).
//    Identique claire/sombre (la typo ne dépend pas du mode).
// -----------------------------------------------------------------------------

const typography: DaTypography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "800", letterSpacing: -0.3 },
  section: { fontSize: 20, lineHeight: 26, fontWeight: "800", letterSpacing: 0 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "700", letterSpacing: 0 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400", letterSpacing: 0 },
  secondary: { fontSize: 14, lineHeight: 20, fontWeight: "400", letterSpacing: 0 },
  kicker: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  button: { fontSize: 17, lineHeight: 22, fontWeight: "700", letterSpacing: 0 },
};

// -----------------------------------------------------------------------------
// 5. Espacement, rayons, ombre — identiques claire/sombre (spec §1.1).
// -----------------------------------------------------------------------------

const spacing: DaSpacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 };

const radius: DaRadius = { card: 20, tile: 16, button: 16, check: 6, pill: 999 };

/**
 * Ombre très discrète, commune aux deux modes (la spec ne distingue pas de
 * variante sombre ; une ombre noire à 0,05 d'opacité reste imperceptible sur
 * fond sombre, ce qui est cohérent avec « très discrète »).
 */
const shadowCard: DaShadow["card"] = {
  shadowColor: "#000000",
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
};

// -----------------------------------------------------------------------------
// 6. Assemblage des deux jeux complets — exportés TOUS LES DEUX pour que les
//    tests de contraste vérifient chacun sans dépendre du mode courant.
// -----------------------------------------------------------------------------

export const daClair: DaTokens = {
  colors: colorsClair,
  gutter: 20,
  spacing,
  radius,
  shadow: { card: shadowCard },
  typography,
};

export const daSombre: DaTokens = {
  colors: colorsSombre,
  gutter: 20,
  spacing,
  radius,
  shadow: { card: shadowCard },
  typography,
};

function resoudre(mode: ThemeMode): DaTokens {
  return mode === "dark" ? daSombre : daClair;
}

/**
 * Le jeu de jetons à consommer par les écrans/composants Accueil + Création
 * de séance. Figé à l'évaluation du module (voir avertissement en tête de
 * fichier) — pas un getter réactif.
 */
export const da: DaTokens = resoudre(getThemeMode());

// -----------------------------------------------------------------------------
// 7. Constantes d'accessibilité (spec §1.1)
// -----------------------------------------------------------------------------

/** Plafond `maxFontSizeMultiplier` pour display/title/section/button. */
export const PLAFOND_TITRE = 1.3;

/** Plafond `maxFontSizeMultiplier` pour body/secondary/kicker. */
export const PLAFOND_TEXTE = 1.6;

/** Zone tactile minimale (largeur/hauteur), en points. */
export const TOUCHE_MIN = 44;
