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
  // Depuis le 05/09, cet objectif est PERSISTÉ sans accent (P2-05 de l'audit
  // d'inscription : il était le seul à en porter un, en contradiction avec la
  // convention rappelée trois lignes plus haut dans le questionnaire).
  // L'ancienne forme accentuée reste en base pour les profils antérieurs —
  // aucune migration de masse — et s'affiche telle quelle, sans passer par
  // cette table : elle est déjà correcte à l'œil.
  "Mieux encaisser les entrainements et les matchs":
    "Mieux encaisser les entraînements et les matchs",
};

const display = (table: Record<string, string>) =>
  <T extends string | null | undefined>(value: T): string | T =>
    value ? table[value] ?? value : value;

/** Valeur inconnue = rendue telle quelle (jamais vide, jamais inventée). */
export const displayPosition = display(POSITION_DISPLAY_LABELS);
export const displayLevel = display(LEVEL_DISPLAY_LABELS);
export const displayObjective = display(OBJECTIVE_DISPLAY_LABELS);
