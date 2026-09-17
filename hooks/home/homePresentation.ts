// hooks/home/homePresentation.ts
// =============================================================================
// HELPERS PURS DE PRÉSENTATION DE L'ACCUEIL (SPEC_DA_ACCUEIL_SEANCE.md §2.2/2.4).
// =============================================================================
//
// Trois fonctions, aucun store, aucun hook React — testables sans renderer.
// Elles ne DÉCIDENT rien (aucune règle métier) : elles mettent en mots un état
// déjà calculé ailleurs (usePrimaryCta pour `kind`, useWeekDays pour un jour).
// =============================================================================

import type { PrimaryCtaKind } from "./usePrimaryCta";

/**
 * Premier mot non vide d'un nom affiché, ou `null` si rien d'exploitable.
 * Un prénom composé à trait d'union ("Jean-Pierre Dupont") reste intact : on
 * ne coupe que sur les espaces.
 */
export function extrairePrenom(displayName: string | null | undefined): string | null {
  const trimmed = (displayName ?? "").trim();
  if (!trimmed) return null;
  const [premierMot] = trimmed.split(/\s+/);
  return premierMot || null;
}

/**
 * Salutation de l'en-tête, dérivée du MÊME discriminant que le CTA
 * (`primaryCta.kind`) pour ne jamais raconter deux histoires différentes sur
 * le même écran. `day_off` → « Bien joué » ; `recovery` → « Salut » ; toute
 * autre valeur → « À toi de jouer ». Jamais « joueur », jamais de virgule
 * orpheline sans prénom.
 */
export function salutation(kind: PrimaryCtaKind, prenom: string | null): string {
  const debut = kind === "day_off" ? "Bien joué" : kind === "recovery" ? "Salut" : "À toi de jouer";
  return prenom ? `${debut}, ${prenom}.` : `${debut}.`;
}

/** Les seuls drapeaux de `useWeekDays` que `decrireJourSemaine` met en mots. */
export type JourSemaineDescriptif = {
  isToday: boolean;
  hasFks: boolean;
  hasExt: boolean;
  hasPlanned: boolean;
  hasMatch: boolean;
  hasClub: boolean;
};

/**
 * Libellé d'accessibilité d'une colonne de la bande « Cette semaine ».
 * MÊME PRIORITÉ que le rendu visuel de la pastille (HomeWeekStrip, spec
 * §2.4) : une séance FKS faite prime sur une activité externe, qui prime sur
 * une séance prévue non faite — pour que le texte lu par un lecteur d'écran
 * ne contredise jamais ce que la pastille montre.
 */
export function decrireJourSemaine(item: JourSemaineDescriptif, nomLong: string): string {
  const segments: string[] = [nomLong];
  if (item.isToday) segments.push("aujourd'hui");

  if (item.hasFks) {
    segments.push("séance FKS faite");
  } else if (item.hasExt) {
    segments.push("activité enregistrée hors FKS");
  } else if (item.hasPlanned) {
    segments.push("séance prévue");
  } else {
    segments.push("rien de prévu");
  }

  if (item.hasMatch) {
    segments.push("match");
  } else if (item.hasClub) {
    segments.push("club");
  }

  return segments.join(", ");
}
