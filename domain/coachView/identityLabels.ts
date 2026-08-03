// domain/coachView/identityLabels.ts
//
// ACCENTS À L'ÉCRAN, VALEURS BRUTES INTACTES.
//
// LE DÉFAUT CORRIGÉ. Le coach lisait « Regional » et « Defenseur », sans accent.
//
// POURQUOI ON NE CORRIGE PAS LA DONNÉE. La valeur STOCKÉE est bien « Regional »
// sans accent, et elle est comparée à une allowlist serveur
// (`functions/src/coachLabels.ts`, constantes POSITIONS / LEVELS). Ajouter
// l'accent à la source casserait la projection coach, les règles Firestore et le
// matching de `recommendMicrocycle`. C'est exactement la raison pour laquelle
// `screens/ProfileSetupScreen.tsx` possède déjà, côté joueur, une table
// d'affichage qui ne touche jamais la valeur persistée.
//
// CE MODULE EST LE MÊME OUTIL, CÔTÉ COACH. Une table d'AFFICHAGE, et rien
// d'autre :
//  - elle n'est jamais utilisée pour comparer, filtrer, trier ou écrire ;
//  - une valeur inconnue de la table ressort TELLE QUELLE (on n'invente pas un
//    libellé, on ne masque pas une valeur qu'on ne connaît pas) ;
//  - `null` reste `null` : une absence ne devient pas une chaîne vide.
//
// La recherche de l'effectif (`roster.matchesCoachSearch`) continue de porter sur
// la valeur BRUTE, et `normalizeSearchText` retire les accents de la requête :
// taper « régional » ou « regional » trouve le même joueur, quoi qu'il arrive.
//
// Module PUR : ni React, ni Firestore, ni horloge.

import type { AgeCategory } from "../types";

/**
 * Niveaux : seul « Regional » manque un accent. Les quatre autres valeurs de
 * l'allowlist serveur (Amateur, National, Semi-pro, Pro) s'écrivent déjà comme
 * on les lit — on ne crée pas d'entrée pour rien.
 */
export const COACH_LEVEL_DISPLAY: Readonly<Record<string, string>> = {
  Regional: "Régional",
};

/** Postes : seul « Defenseur » manque un accent (Gardien, Milieu, Attaquant sont corrects). */
export const COACH_POSITION_DISPLAY: Readonly<Record<string, string>> = {
  Defenseur: "Défenseur",
};

/**
 * Catégories d'âge : U13 / U15 / U17 / U18 / Senior. Aucune n'a besoin d'accent.
 * La table existe quand même, pour que les trois libellés d'identité passent par
 * le même chemin — le jour où une catégorie accentuée apparaît, il n'y aura
 * qu'une ligne à ajouter, pas un appel oublié à retrouver.
 */
export const COACH_AGE_CATEGORY_DISPLAY: Readonly<Record<string, string>> = {};

/** Applique une table d'affichage. Valeur inconnue ou vide → rendue telle quelle. */
function display(
  table: Readonly<Record<string, string>>,
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const brut = value.trim();
  if (!brut) return null;
  return table[brut] ?? brut;
}

/** Niveau tel qu'il doit être LU. Ne modifie jamais la valeur persistée. */
export function coachLevelLabel(level: string | null | undefined): string | null {
  return display(COACH_LEVEL_DISPLAY, level);
}

/** Poste tel qu'il doit être LU. Ne modifie jamais la valeur persistée. */
export function coachPositionLabel(position: string | null | undefined): string | null {
  return display(COACH_POSITION_DISPLAY, position);
}

/** Catégorie d'âge telle qu'elle doit être LUE. Ne modifie jamais la valeur persistée. */
export function coachAgeCategoryLabel(
  category: AgeCategory | string | null | undefined,
): string | null {
  return display(COACH_AGE_CATEGORY_DISPLAY, category);
}

/**
 * Contexte d'identité prêt à afficher : poste · niveau · catégorie, accentués,
 * dans l'ordre demandé par l'appelant. Les valeurs absentes sont simplement
 * omises — on ne remplit pas les trous par des tirets.
 */
export function coachIdentityLine(
  parts: ReadonlyArray<string | null | undefined>,
  separator = " · ",
): string {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter((part) => part.length > 0)
    .join(separator);
}
