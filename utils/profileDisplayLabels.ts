// utils/profileDisplayLabels.ts
//
// LIBELLÉS ACCENTUÉS DES VALEURS DE PROFIL PERSISTÉES.
//
// ⚠️ Les valeurs `position`, `level` et `mainObjective` sont PERSISTÉES en
// Firestore SANS accents (convention du projet : jamais d'accents dans les
// valeurs persistées — allowlists Cloud Functions + matching substring de
// recommendMicrocycle). Ces maps servent UNIQUEMENT à afficher un libellé
// accentué dans l'UI, jamais à écrire.
//
// Partagé entre le setup (saisie) et le Profil (relecture) : avant ce module,
// le Profil relisait les valeurs brutes et affichait « Defenseur · Regional »
// et « Gagner en vitesse / explosivite » (P1-20 inventaire clubs).

export const POSITION_DISPLAY_LABELS: Record<string, string> = {
  Defenseur: "Défenseur",
};

export const LEVEL_DISPLAY_LABELS: Record<string, string> = {
  Regional: "Régional",
};

export const OBJECTIVE_DISPLAY_LABELS: Record<string, string> = {
  "Etre en forme toute la saison": "Être en forme toute la saison",
  "Gagner en vitesse / explosivite": "Gagner en vitesse / explosivité",
  "Reprendre apres une blessure": "Reprendre après une blessure",
};

const display = (table: Record<string, string>) =>
  <T extends string | null | undefined>(value: T): string | T =>
    value ? table[value] ?? value : value;

/** Valeur inconnue = rendue telle quelle (jamais vide, jamais inventée). */
export const displayPosition = display(POSITION_DISPLAY_LABELS);
export const displayLevel = display(LEVEL_DISPLAY_LABELS);
export const displayObjective = display(OBJECTIVE_DISPLAY_LABELS);
