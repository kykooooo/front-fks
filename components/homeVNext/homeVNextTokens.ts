// components/homeVNext/homeVNextTokens.ts
// =============================================================================
// PROTOTYPE Home vNext — ECHELLE LOCALE
// =============================================================================
//
// Contexte : `theme.typography` existe dans `constants/theme.ts` et n'est utilise
// par AUCUN fichier du depot (verifie par recherche sur `theme.typography` et
// `typography.` dans tout le projet : zero occurrence). Consigne du fondateur :
// ne pas l'imposer pour cocher une case, et ne pas introduire une 5e direction
// graphique.
//
// Donc : une PETITE echelle locale au prototype, calee sur les ecrans les plus
// aboutis du depot. Chaque palier indique d'ou il vient. Rien n'est invente.
//
// Ce qui est REUTILISE TEL QUEL, sans copie ni variante :
//   - `theme.colors`  : la palette du projet.
//   - `theme.radius`  : les rayons du projet (uniquement `lg` et `pill`).
//   - `theme.spacing` : le rythme du projet.
//
// Ce qui est PROPOSE ici et doit etre valide avant toute reprise en production :
//   - `couleurs.action` : un orange assombri, pour passer le contraste (voir plus bas).
//   Aucune valeur de `constants/theme.ts` n'est modifiee par ce fichier.
// =============================================================================

import { theme } from "../../constants/theme";

// -----------------------------------------------------------------------------
// 1. TYPOGRAPHIE — 6 paliers, pas un de plus
// -----------------------------------------------------------------------------
// Le Home de production pose 21 couples fontSize/fontWeight differents, dont un
// `12.5`. Ici : 6 paliers, chacun avec sa provenance.
// -----------------------------------------------------------------------------

export const typo = {
  /**
   * Titre d'ecran — le seul texte de niveau 1 du Home (le "Salut, X").
   * PROVENANCE : `screens/HomeScreen.tsx` > `greeting` (22 / 800 / ls -0.3).
   * Conserve tel quel : c'est deja le bon poids visuel, et le seul de son rang.
   */
  screenTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800" as const,
    letterSpacing: -0.3,
  },

  /**
   * Libelle de l'action principale — le seul aplat de l'ecran.
   * PROVENANCE : `components/ui/Button.tsx` > `labelLg` (17 / 800 / ls 0.3),
   * la taille du bouton `size="lg"`. On reprend le composant existant, donc on
   * reprend sa metrique.
   */
  actionLabel: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800" as const,
    letterSpacing: 0.3,
  },

  /**
   * Valeur mise en avant dans une carte (ex : "1 seance sur 2").
   * PROVENANCE : `screens/sessionPreview/components/HeroCard.tsx` >
   * `heroStatValue` ET `screens/RoutineScreen.tsx` > `heroStatValue` — les deux
   * ecrans les plus aboutis utilisent deja exactement 16 / 700.
   */
  metricValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700" as const,
    letterSpacing: 0,
  },

  /**
   * Corps de texte : sous-titre d'action, ligne "pourquoi", message de section.
   * PROVENANCE : `HeroCard.subtitle` (13) et
   * `screens/prebuilt/components/CategoryTile.tsx` > `tileTitle` (13 / 700).
   * Poids ramene a 600 : sur le Home ces lignes sont lues, pas scannees.
   */
  body: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600" as const,
    letterSpacing: 0,
  },

  /**
   * Texte secondaire : portee de la mesure, periode, date, note.
   * PROVENANCE : `HeroCard.progressLabel` (12) et `RoutineScreen.heroSubtitle` (12).
   */
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500" as const,
    letterSpacing: 0,
  },

  /**
   * Titre de section en capitales ("MA SEMAINE", "MA FORME").
   * PROVENANCE : `components/ui/SectionHeader.tsx` (13 / 800 / ls 1.2 / uppercase),
   * copie a l'identique — le prototype utilise directement ce composant.
   */
  overline: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
} as const;

// -----------------------------------------------------------------------------
// 2. RAYONS — 2 valeurs, pas 7
// -----------------------------------------------------------------------------
// Le Home de production utilise 7 rayons, dont 22 et 26 qui n'existent dans
// aucune echelle. Ici : deux valeurs, toutes deux prises dans `theme.radius`.
// Les rayons 20 / 22 / 24 / 26 sont BANNIS du prototype.
// -----------------------------------------------------------------------------

export const rayons = {
  /** Toutes les surfaces : bloc d'action, cartes de section. `theme.radius.lg` = 16. */
  carte: theme.radius.lg,
  /** Chips, pastilles, boutons pilule. `theme.radius.pill` = 999. */
  pilule: theme.radius.pill,
} as const;

// -----------------------------------------------------------------------------
// 3. ESPACEMENT — un seul rythme vertical
// -----------------------------------------------------------------------------
// Le Home de production melange trois rythmes (14 / 16 / 10). Ici, tout vient
// de `theme.spacing`.
// -----------------------------------------------------------------------------

export const espacement = {
  /** Marge laterale de l'ecran. */
  ecranX: theme.spacing.lg, // 16
  /** Entre deux sections. */
  entreSections: theme.spacing.lg, // 16
  /** Padding interieur d'une carte. */
  carte: theme.spacing.lg, // 16
  /** Entre deux lignes d'une meme carte. */
  interne: theme.spacing.md, // 12
  /** Collage serre (libelle + valeur, pastille + texte). */
  serre: theme.spacing.sm, // 8
  /**
   * Respiration finale, avant la tab bar. Le Home de production laisse 70 px de
   * vide en fin de scroll ; l'ecran doit finir tot et net (doctrine 9).
   */
  finDEcran: theme.spacing.xl, // 24
} as const;

// -----------------------------------------------------------------------------
// 4. COULEURS
// -----------------------------------------------------------------------------

/**
 * ORANGE D'ACTION — PROPOSITION A VALIDER.
 *
 * Probleme mesure dans l'audit (P1.17) : le CTA actuel est du blanc sur
 * `theme.colors.cta` = `#F2741B`, soit **2.88:1**. Le seuil WCAG AA pour du
 * texte est 4.5:1. Le sous-titre, en blanc semi-transparent, tombe a 2.60:1.
 *
 * Proposition : `#B4530C`.
 *   - Teinte : 25.4 degres. L'orange FKS actuel est a 24.8 degres — c'est
 *     litteralement le meme orange, simplement assombri. L'identite tient.
 *   - Contraste avec du blanc plein : **5.02:1** (calcul WCAG 2.1, luminance
 *     relative : L = 0.2126 R + 0.7152 V + 0.0722 B apres linearisation
 *     sRGB ; L(#B4530C) = 0.1592 ; ratio = 1.05 / (0.1592 + 0.05) = 5.02).
 *     Marge confortable au-dessus de 4.5:1.
 *   - Ce meme ton passe aussi en TEXTE sur fond blanc (5.02:1) et sur le fond
 *     d'ecran `#F5F7FA` (4.68:1) : il peut donc servir de couleur de lien
 *     d'accent sans creer une seconde teinte.
 *
 * Candidats mesures et ecartes : `#F2741B` 2.88 · `#E2670F` 3.40 ·
 * `#D65F0B` 3.82 · `#C85A0C` 4.27 (tous sous le seuil) ; `#9A3412` 7.31
 * (conforme mais vire au brun, l'identite se perd).
 *
 * `constants/theme.ts` N'EST PAS MODIFIE. Cette valeur vit ici, dans le
 * prototype, et attend la validation du fondateur.
 */
const ACTION_ORANGE = "#B4530C";

/**
 * REGLE DE TEXTE SUR L'APLAT D'ACTION.
 *
 * Sur `#B4530C`, du blanc a 90 % d'opacite ne donne que **4.39:1** — encore
 * sous le seuil. Donc : **tout le texte pose sur l'aplat est du blanc plein**.
 * La hierarchie entre le libelle et son sous-titre se fait par la taille et la
 * graisse (`typo.actionLabel` vs `typo.body`), jamais par la transparence.
 * C'est la regle qui remplace le blanc a 82 % du Home actuel.
 */
export const TEXTE_SUR_ACTION = "#FFFFFF";

export const couleurs = {
  /** Fond d'ecran. `theme.colors.bg`. */
  fond: theme.colors.bg,
  /** Surface de carte. `theme.colors.card`. */
  carte: theme.colors.card,
  /** Bordure de carte. `theme.colors.border`. */
  bordure: theme.colors.border,
  /** Texte principal — 17.46:1 sur blanc. `theme.colors.text`. */
  texte: theme.colors.text,
  /** Texte secondaire — 6.08:1 sur blanc, 5.67:1 sur le fond d'ecran. `theme.colors.sub`. */
  texteSecondaire: theme.colors.sub,
  /** Le SEUL aplat colore de l'ecran. Proposition, voir ci-dessus. */
  action: ACTION_ORANGE,
  /** Texte pose sur l'aplat d'action : blanc plein, jamais transparent. */
  texteSurAction: TEXTE_SUR_ACTION,
  /**
   * Couleur des liens et actions secondaires. `theme.colors.accent` = `#2A4D8F`,
   * mesure a 8.21:1 sur blanc et 7.65:1 sur le fond d'ecran. Conforme tel quel,
   * rien a proposer.
   */
  lien: theme.colors.accent,
} as const;

/**
 * Contrastes mesures, pour affichage par le visualiseur du prototype.
 * Ratios calcules avec la formule WCAG 2.1 (luminance relative).
 */
export const CONTRASTES_MESURES = [
  {
    usage: "Libelle et sous-titre de l'action (blanc plein sur l'aplat)",
    avant: { couleur: "#FFFFFF sur #F2741B", ratio: 2.88, conforme: false },
    apres: { couleur: "#FFFFFF sur #B4530C", ratio: 5.02, conforme: true },
  },
  {
    usage: "Texte principal sur carte",
    avant: { couleur: "#141A24 sur #FFFFFF", ratio: 17.46, conforme: true },
    apres: { couleur: "#141A24 sur #FFFFFF", ratio: 17.46, conforme: true },
  },
  {
    usage: "Texte secondaire sur carte",
    avant: { couleur: "#586374 sur #FFFFFF", ratio: 6.08, conforme: true },
    apres: { couleur: "#586374 sur #FFFFFF", ratio: 6.08, conforme: true },
  },
  {
    usage: "Lien de sortie sur le fond d'ecran",
    avant: { couleur: "#2A4D8F sur #F5F7FA", ratio: 7.65, conforme: true },
    apres: { couleur: "#2A4D8F sur #F5F7FA", ratio: 7.65, conforme: true },
  },
] as const;

/** Seuil WCAG AA retenu pour tout texte du prototype. */
export const SEUIL_CONTRASTE_AA = 4.5;

// -----------------------------------------------------------------------------
// 5. ZONES TACTILES
// -----------------------------------------------------------------------------
// L'audit (P1.20) releve 8 zones tactiles sur 8 sous 44 pt, dont un chip a
// 24-28 px. `components/ui/Button` impose deja des `minHeight` corrects
// (48 / 52 / 56) : le prototype passe par ce composant, et fixe un plancher
// pour tout element tactile qui ne serait pas un Button.
// -----------------------------------------------------------------------------

export const TAILLE_TACTILE_MIN = 44;

/**
 * Regles de rendu que les composants du prototype doivent respecter.
 * Reprises telles quelles depuis la regle d'or du projet (CLAUDE.md) et de
 * l'audit — listees ici pour qu'elles soient sous les yeux au moment de coder.
 */
export const REGLES_DE_RENDU = [
  "Ecran monte dans <Screen> : aucune SafeAreaView locale, aucun paddingTop magique, aucune StatusBar locale.",
  "Sur un bloc de texte : minHeight, jamais height.",
  "Tout contenu venant du backend est borne par numberOfLines.",
  "Largeurs en flex, jamais en px fixes (une pilule a width: 140 deborde a 320 px).",
  "Un seul aplat colore sur tout l'ecran : l'action. Le reste est carte ou texte.",
  "Aucun element interactif sous 44 pt : passer par components/ui/Button, ou ajouter un hitSlop.",
  "Aucun repere numerique brut sur la courbe de tendance.",
] as const;
