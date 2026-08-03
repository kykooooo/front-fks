// components/coach/coachTheme.ts
//
// SOURCE UNIQUE DE VÉRITÉ du design system COACH (DA "outil staff" claire),
// volontairement distincte du thème joueur (`constants/theme.ts`, sombre).
// On ne crée PAS une troisième identité : ce fichier reprend la palette locale
// déjà utilisée par les écrans coach (anciennement `coachUi.tsx`), la corrige
// pour l'accessibilité, et ajoute les tokens qui manquaient (espacements,
// typographie nommée, échelle de statut, largeurs d'écran).
//
// POURQUOI cette correction de palette.
// L'audit a mesuré des ratios de contraste sous le seuil WCAG AA sur la palette
// d'origine : `muted` (#8C8F99) tombait à 3,23:1 sur carte et 2,76:1 sur surface
// secondaire, et le texte du badge "Faite" (#2E7D52 sur #E8F1EB) à 4,37:1.
// Un coach lit ces écrans dehors, au bord du terrain, en plein soleil, souvent
// sur un téléphone dont la luminosité est déjà au maximum : sous 4,5:1 le texte
// secondaire devient illisible. Chaque couleur corrigée porte son ratio calculé.
//
// Règles d'accessibilité appliquées ici :
//   - texte normal (< 18,66 px gras / < 24 px)           -> >= 4,5:1
//   - gros texte (>= 24 px, ou >= 18,66 px en gras)      -> >= 3:1
//   - bordure PORTEUSE DE SENS (contour d'un statut)     -> >= 3:1
//   - hairline purement décorative (séparation de carte) -> aucun seuil
//
// Module PUR : aucune dépendance React ni Firestore, aucun style RN.

import type React from "react";
import type { Ionicons } from "@expo/vector-icons";

/** Nom d'icône Ionicons (import de TYPE uniquement : zéro dépendance runtime). */
export type CoachIconName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Couleurs ───────────────────────────────────────────────────────────────
// Les clés reprennent celles de `theme.colors` utilisées par les écrans coach
// (drop-in), avec des valeurs claires. Ratios calculés contre les deux fonds
// réels de l'espace coach : `card` (#FFFFFF) et `bg` (#F6F5F2), plus `cardAlt`
// (#EFEDE8) quand la couleur y est employée.
export const coachColors = {
  // ── Surfaces (fonds, jamais du texte) ──
  bg: "#F6F5F2", // fond application : blanc cassé / gris chaud très léger
  card: "#FFFFFF", // cartes
  cardAlt: "#EFEDE8", // surface secondaire chaude (piste du segmenté, squelettes)

  // ── Bordures décoratives (hairlines de carte : AUCUN sens porté) ──
  border: "#E7E4DD", // 1,48:1 sur card — décoratif assumé
  borderSoft: "#ECEAE3", // 1,30:1 sur card — décoratif assumé

  // ── Bordure PORTEUSE DE SENS (séparateur qui structure la lecture) ──
  // AJOUTÉE : tout était décoratif jusqu'ici, y compris les contours qui
  // disaient quelque chose. 3,52:1 sur card / 3,23:1 sur bg / 3,01:1 sur
  // cardAlt -> AA composant graphique (3:1) partout.
  borderStrong: "#8F8879",

  // ── Textes ──
  text: "#1C2433", // 15,56:1 sur card / 14,27:1 sur bg — AAA
  sub: "#5A6275", // 6,11:1 sur card / 5,60:1 sur bg — AA
  // CORRIGÉ : #8C8F99 -> #616677. Ancien = 3,23:1 sur card, 2,96:1 sur bg,
  // 2,76:1 sur cardAlt (échec AA sur les 5 styles de texte tertiaire relevés
  // par l'audit). Nouveau = 5,71:1 sur card / 5,24:1 sur bg / 4,88:1 sur cardAlt.
  muted: "#616677",

  // ── Accent (actions, état actif) ──
  accent: "#2A4D8F", // 8,21:1 sur card / 7,53:1 sur bg / 7,05:1 sur accentSoft — AA
  accentSoft: "#E9EEF6", // remplissage doux bleu (surface)
  accentBorder: "#5D80B4", // 3,46:1 sur accentSoft / 4,03:1 sur card — AA composant

  // ── Vert terrain (séance faite, "rien à signaler") ──
  // CORRIGÉ : #2E7D52 -> #1F6B43. Ancien = 4,37:1 sur successSoft (le badge
  // "Faite" passait donc SOUS le seuil). Nouveau = 5,62:1 sur successSoft,
  // 6,48:1 sur card, 5,94:1 sur bg.
  success: "#1F6B43",
  successSoft: "#E8F1EB", // surface
  successBorder: "#528C6A", // 3,42:1 sur successSoft / 3,95:1 sur card — AA composant

  // ── Orange brûlé (à surveiller) ──
  // CORRIGÉ : #C2410C -> #9A3412. Ancien = 4,54:1 sur warnSoft (marge nulle,
  // et sous le seuil dès que le fond dérive). Nouveau = 6,41:1 sur warnSoft,
  // 7,31:1 sur card, 6,80:1 sur warnFaint.
  warn: "#9A3412",
  warnSoft: "#FAEEE5", // surface
  warnFaint: "#FBF6F0", // fond de ligne très léger
  warnBorder: "#B07242", // 3,46:1 sur warnSoft / 3,94:1 sur card — AA composant

  // ── Brique (à vérifier : lecture humaine nécessaire, JAMAIS une alarme) ──
  // CORRIGÉ : #B3261E -> #A11B14. Ancien = 5,54:1 sur dangerSoft (déjà AA),
  // aligné ici sur la même marge que les autres tons. Nouveau = 6,64:1 sur
  // dangerSoft / 7,83:1 sur card.
  danger: "#A11B14",
  dangerSoft: "#F8E9E8", // surface
  dangerBorder: "#B0655F", // 3,66:1 sur dangerSoft / 4,31:1 sur card — AA composant

  // ── Neutre marqué (statut indisponible, badges sans ton) ──
  neutralSoft: "#F0EEE9", // surface
  neutralBorder: "#8B8475", // 3,20:1 sur neutralSoft / 3,71:1 sur card — AA composant
  neutralText: "#3B4152", // 8,78:1 sur neutralSoft — AA
} as const;

// ─── Rayons ─────────────────────────────────────────────────────────────────
// `card`, `chip` et `pill` gardent EXACTEMENT leurs valeurs d'origine : les
// écrans coach existants les consomment déjà, on ne provoque pas de dérive
// visuelle gratuite en passant par ce fichier.
export const coachRadius = {
  xs: 6,
  chip: 8,
  card: 10,
  lg: 14,
  pill: 999,
} as const;

// ─── Espacements (échelle 4 / 8 / 12 / 16 / 20 / 24 / 32) ───────────────────
// Une seule échelle : tout écart hors de cette liste est un accident.
export const coachSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

// ─── Typographie nommée ─────────────────────────────────────────────────────
// On nomme les RÔLES, pas les tailles : un écran ne choisit plus "15 gras",
// il choisit `corpsFort`. `lineHeight` est toujours fourni — un bloc de texte
// serveur peut passer sur deux lignes, la hauteur doit rester prévisible
// (cf. CLAUDE.md règle d'or : minHeight, jamais height).
type CoachTextStyle = {
  fontSize: number;
  fontWeight: "400" | "500" | "600" | "700" | "800";
  lineHeight: number;
  letterSpacing?: number;
};

export const coachType: Record<
  "titreEcran" | "titreSection" | "corps" | "corpsFort" | "legende" | "micro",
  CoachTextStyle
> = {
  titreEcran: { fontSize: 24, fontWeight: "800", lineHeight: 30, letterSpacing: -0.3 },
  titreSection: { fontSize: 17, fontWeight: "700", lineHeight: 22, letterSpacing: -0.2 },
  corps: { fontSize: 15, fontWeight: "400", lineHeight: 21 },
  corpsFort: { fontSize: 15, fontWeight: "600", lineHeight: 21 },
  legende: { fontSize: 13, fontWeight: "500", lineHeight: 18 },
  micro: { fontSize: 11, fontWeight: "600", lineHeight: 15, letterSpacing: 0.2 },
};

// ─── Layout (tablette / web large / zone tactile) ───────────────────────────
// POURQUOI : l'espace coach n'avait AUCUNE largeur maximale. Sur un iPad ou un
// navigateur, une ligne d'effectif s'étirait sur 1200 px : l'œil perd la ligne
// entre le prénom (à gauche) et le statut (à l'extrême droite). On plafonne.
export const coachLayout = {
  /** Largeur max du contenu en une colonne (confort de lecture). */
  maxContentWidth: 720,
  /** Largeur max quand deux colonnes sont affichées. */
  maxContentWidthWide: 1040,
  /** Au-delà de cette largeur de fenêtre, deux colonnes deviennent lisibles. */
  twoColumnMinWidth: 900,
  /** Zone tactile minimale (WCAG 2.5.5 / HIG) : chips, liens, segmenté. */
  minTouchSize: 44,
  /** Hauteur minimale d'une ligne d'effectif (>= minTouchSize + respiration). */
  rowMinHeight: 56,
  /** En dessous, on considère l'écran "étroit" (iPhone SE = 320 pt). */
  narrowWidth: 340,
} as const;

// ─── Échelle de statut (4 niveaux, STABLE) ──────────────────────────────────
// Hiérarchie volontairement courte et bornée. Il n'existe PAS de niveau
// "critique" : l'espace coach ne pose aucun diagnostic, il signale une lecture
// humaine à faire. Un seul indicateur isolé ne doit jamais suffire à monter
// d'un cran — cette règle-là vit dans domain/coachView, pas ici.
export const COACH_STATUS_LEVELS = ["normal", "watch", "check", "unknown"] as const;
export type CoachStatusLevel = (typeof COACH_STATUS_LEVELS)[number];

export type CoachStatusTone = {
  /** Fond de la pastille / de la ligne. */
  fond: string;
  /** Contour : PORTEUR DE SENS, donc >= 3:1 contre le fond et contre la surface. */
  bordure: string;
  /** Couleur du libellé : >= 4,5:1 contre `fond`. */
  texte: string;
  /** Nom Ionicons — la couleur n'est JAMAIS seule à porter le sens. */
  icone: CoachIconName;
  /** Libellé français, figé : c'est le vocabulaire du coach. */
  libelle: string;
};

const STATUS_TONES: Record<CoachStatusLevel, CoachStatusTone> = {
  // Calme et positif. Vert terrain, jamais criard.
  normal: {
    fond: coachColors.successSoft,
    bordure: coachColors.successBorder, // 3,42:1
    texte: coachColors.success, // 5,62:1
    icone: "checkmark-circle-outline",
    libelle: "Rien à signaler",
  },
  // Signal léger OU données incomplètes : on attire l'œil, on n'alarme pas.
  watch: {
    fond: coachColors.warnSoft,
    bordure: coachColors.warnBorder, // 3,46:1
    texte: coachColors.warn, // 6,41:1
    icone: "alert-circle-outline",
    libelle: "À surveiller",
  },
  // Signal clair : le coach doit REGARDER, pas paniquer. D'où l'œil plutôt
  // qu'un triangle d'alerte — on demande une lecture humaine, pas une urgence.
  check: {
    fond: coachColors.dangerSoft,
    bordure: coachColors.dangerBorder, // 3,66:1
    texte: coachColors.danger, // 6,64:1
    icone: "eye-outline",
    libelle: "À vérifier",
  },
  // Aucune donnée ne permet de conclure. État HONNÊTE, jamais confondu avec
  // "tout va bien" ni avec un zéro.
  unknown: {
    fond: coachColors.neutralSoft,
    bordure: coachColors.neutralBorder, // 3,20:1
    texte: coachColors.neutralText, // 8,78:1
    icone: "help-circle-outline",
    libelle: "Indisponible",
  },
};

/**
 * Rendu visuel d'un niveau de statut. Un niveau inattendu (donnée serveur
 * inconnue) retombe sur `unknown` : on ne devine jamais un statut rassurant.
 */
export function statusTone(level: CoachStatusLevel): CoachStatusTone {
  return STATUS_TONES[level] ?? STATUS_TONES.unknown;
}

// ─── Provenance d'une information ───────────────────────────────────────────
// RÈGLE PRODUIT : le coach doit toujours savoir D'OÙ vient ce qu'il lit. Une
// estimation ne se présente jamais comme une mesure. Cinq origines, pas plus.
export const COACH_PROVENANCES = [
  "player", // le joueur l'a déclaré lui-même
  "execution", // relevé pendant la séance (prescrit vs réalisé)
  "fks", // règle automatique du moteur FKS
  "computed", // calculé par l'app à partir des dates
  "missing", // aucune donnée : on le dit
] as const;
export type CoachProvenance = (typeof COACH_PROVENANCES)[number];

export type CoachProvenanceTone = {
  libelle: string;
  icone: CoachIconName;
};

const PROVENANCE_TONES: Record<CoachProvenance, CoachProvenanceTone> = {
  player: { libelle: "Déclaré par le joueur", icone: "person-outline" },
  execution: { libelle: "Relevé pendant la séance", icone: "checkbox-outline" },
  fks: { libelle: "Règle FKS", icone: "shield-checkmark-outline" },
  computed: { libelle: "Calculé par l'app", icone: "calculator-outline" },
  missing: { libelle: "Donnée absente", icone: "remove-circle-outline" },
};

/** Libellé + icône de provenance. Origine inconnue -> "Donnée absente". */
export function provenanceTone(provenance: CoachProvenance): CoachProvenanceTone {
  return PROVENANCE_TONES[provenance] ?? PROVENANCE_TONES.missing;
}

/** Placeholder unique d'une valeur INDISPONIBLE (à ne jamais confondre avec 0). */
export const COACH_VALUE_UNAVAILABLE = "—";
