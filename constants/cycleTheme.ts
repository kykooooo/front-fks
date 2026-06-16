// constants/cycleTheme.ts
// Source UNIQUE des couleurs par cycle pour thémer les écrans de séance.
//
// Décision design (FRONT-2, fondateur) : on remplace les photos par une COULEUR
// PAR CYCLE qui thème l'écran de séance. Fond clair conservé (#F5F7FA) ; seuls
// les ACCENTS prennent la couleur du cycle.
//   - strong     : bande pleine de header, CTA primaire, bordures d'accent
//   - soft       : fonds de chips / cases / encadrés (teinte très claire)
//   - textOnSoft : texte lisible posé sur "soft"
//
// ⚠️ Palette CLAIRE fixe (indépendante de theme.colors) : ces écrans sont traités
// en thème clair (DA par défaut). Pas de variantes sombres ici — si le mode sombre
// devait être supporté sur ces écrans un jour, ajouter un second jeu de teintes.
//
// L'ICÔNE de chaque cycle n'est PAS dupliquée : elle est référencée depuis
// domain/microcycles.ts (MICROCYCLES[id].icon).
import {
  MICROCYCLES,
  canonicalizeMicrocycleGoal,
  type MicrocycleId,
} from "../domain/microcycles";

export type CycleTheme = {
  id: MicrocycleId;
  /** Nom court pour le kicker "Cycle {label}". */
  label: string;
  /** Nom d'icône Ionicons (référencé depuis MICROCYCLES, non dupliqué). */
  icon: string;
  strong: string;
  soft: string;
  textOnSoft: string;
};

type CyclePalette = {
  label: string;
  strong: string;
  soft: string;
  textOnSoft: string;
};

// Teintes de départ (cf. cahier FRONT-2). À ajuster si le contraste du texte blanc
// sur la bande "strong" n'est pas net.
const PALETTE: Record<MicrocycleId, CyclePalette> = {
  force: { label: "Force", strong: "#2A4D8F", soft: "#E9EEF7", textOnSoft: "#0C447C" },
  explosivite: { label: "Explosivité", strong: "#993C1D", soft: "#FAECE7", textOnSoft: "#712B13" },
  endurance: { label: "Endurance", strong: "#3B6D11", soft: "#EAF3DE", textOnSoft: "#27500A" },
  fondation: { label: "Fondation", strong: "#0F6E56", soft: "#E1F5EE", textOnSoft: "#085041" },
  saison: { label: "Saison", strong: "#534AB7", soft: "#EEEDFE", textOnSoft: "#3C3489" },
};

/** Cycle inconnu / non renseigné → Force (bleu accent). */
const FALLBACK_ID: MicrocycleId = "force";

/**
 * Dérive le thème de couleur du cycle servi.
 * @param goal cycle de la séance servie (ou cycle actif du store passé par l'appelant).
 *   Normalisé via canonicalizeMicrocycleGoal (gère les alias legacy). Si null/inconnu → fallback Force.
 */
export function getCycleTheme(goal?: string | null): CycleTheme {
  const resolved = canonicalizeMicrocycleGoal(goal) ?? FALLBACK_ID;
  // Lookup totale : si un id n'est pas dans PALETTE (drift type/PALETTE), on retombe
  // intégralement sur le fallback (id + icône + couleurs) — jamais de crash écran.
  const id = PALETTE[resolved] ? resolved : FALLBACK_ID;
  const p = PALETTE[id];
  return {
    id,
    label: p.label,
    icon: MICROCYCLES[id].icon,
    strong: p.strong,
    soft: p.soft,
    textOnSoft: p.textOnSoft,
  };
}
