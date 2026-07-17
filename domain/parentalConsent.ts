// domain/parentalConsent.ts
// Consentement parental RGPD pour les mineurs de moins de 15 ans.
// En France (art. 45 loi Informatique et Libertés), sous 15 ans le consentement
// au traitement des données personnelles doit être donné par le titulaire de
// l'autorité parentale. FKS collecte des données de santé (douleurs, blessures,
// fatigue) → catégorie spéciale RGPD, d'où la case obligatoire au setup profil.
//
// Catégories concernées :
// - U15 (13-14 ans) → consentement parental requis.
// - U13 (11-12 ans) → couverte défensivement tant qu'elle reste sélectionnable
//   (un chantier parallèle la retire ; une fois le retrait mergé, l'entrée
//   devient du code mort inoffensif).
// - U17 / U18 / Senior (≥ 15 ans) → l'ado consent seul, zéro friction ajoutée.
//
// ⚠️ Volontairement des chaînes littérales (pas le type AgeCategory) pour que
// le retrait de U13 dans domain/types.ts ne casse rien ici (merge trivial).

/** Preuve de consentement persistée dans users/{uid} (accountability RGPD). */
export type ParentalConsent = {
  accepted: true;
  /** Timestamp ISO 8601 du moment où le consentement a été donné. */
  acceptedAt: string;
  /** Catégorie d'âge au moment du consentement (ex: "U15"). */
  ageCategoryAtConsent: string;
};

const CATEGORIES_REQUIRING_PARENTAL_CONSENT: readonly string[] = ["U13", "U15"];

/** true si la catégorie implique un joueur de moins de 15 ans. */
export function requiresParentalConsent(ageCategory: string | null | undefined): boolean {
  if (typeof ageCategory !== "string") return false;
  return CATEGORIES_REQUIRING_PARENTAL_CONSENT.includes(ageCategory.trim());
}

/**
 * true si l'étape doit être bloquée (bouton désactivé + validation en échec) :
 * catégorie < 15 ans ET case non cochée. Toujours false pour U17/U18/Senior,
 * quelle que soit la valeur de la case → aucune friction hors mineurs.
 */
export function isParentalConsentBlocking(
  ageCategory: string | null | undefined,
  consentChecked: boolean,
): boolean {
  return requiresParentalConsent(ageCategory) && !consentChecked;
}

/**
 * État de la case après un changement de catégorie.
 * Quitter une catégorie < 15 ans décoche (pas de consentement fantôme conservé) ;
 * y revenir impose de re-cocher explicitement.
 */
export function consentCheckedAfterCategoryChange(
  ageCategory: string | null | undefined,
  currentChecked: boolean,
): boolean {
  return requiresParentalConsent(ageCategory) ? currentChecked : false;
}

/** Garde de lecture tolérante : true si `value` est une preuve valide déjà stockée. */
export function isStoredParentalConsent(value: unknown): value is ParentalConsent {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.accepted === true &&
    typeof v.acceptedAt === "string" &&
    v.acceptedAt.length > 0 &&
    typeof v.ageCategoryAtConsent === "string" &&
    v.ageCategoryAtConsent.length > 0
  );
}

/**
 * Construit l'objet à persister à l'enregistrement du profil.
 * Si une preuve valide existe déjà pour la même catégorie, elle est conservée
 * telle quelle : le premier `acceptedAt` reste la preuve d'origine, on ne la
 * réécrit pas à chaque édition du profil.
 */
export function buildParentalConsent(ageCategory: string, existing: unknown): ParentalConsent {
  if (isStoredParentalConsent(existing) && existing.ageCategoryAtConsent === ageCategory) {
    return existing;
  }
  return {
    accepted: true,
    acceptedAt: new Date().toISOString(),
    ageCategoryAtConsent: ageCategory,
  };
}
