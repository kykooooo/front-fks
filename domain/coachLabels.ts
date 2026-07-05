// domain/coachLabels.ts
// Libellés statiques COACH côté front (langage terrain, non médical).
//
// Depuis PR-3, le coach lit la projection coach-safe (clubs/{clubId}/playerSummaries)
// où les labels (focus, intensité, adaptation) arrivent DÉJÀ traduits et allowlistés
// par le serveur. Le front ne re-traduit donc plus aucun guardrail : ce module ne
// garde que des libellés purement front (semaine active, groupe, garde-fous statiques).
// La logique de statut/tri/résumé du dashboard vit désormais dans domain/coachSummary.ts.

/**
 * Libellé du groupe selon le type d'équipe (pour titres / résumés coach).
 * female → "Joueuses", male → "Joueurs", mixed/absent/inconnu → "Effectif".
 */
export function getTeamPlayerLabel(teamGender: unknown): "Joueuses" | "Joueurs" | "Effectif" {
  switch (teamGender) {
    case "female":
      return "Joueuses";
    case "male":
      return "Joueurs";
    default:
      return "Effectif";
  }
}

// ─── Libellé de la semaine active (cadre coach) ─────────────────────────────
// Prend une weekKey (date du LUNDI "YYYY-MM-DD", cf. weekKeyOf) et renvoie
// "Semaine du 8 au 14 juin 2026" (ou "du 29 juin au 5 juillet 2026" à cheval).
const COACH_MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function formatCoachWeekLabel(weekKey: unknown): string {
  if (typeof weekKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) return "Semaine en cours";
  const start = new Date(`${weekKey}T12:00:00`);
  if (Number.isNaN(start.getTime())) return "Semaine en cours";
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const d1 = start.getDate();
  const m1 = start.getMonth();
  const d2 = end.getDate();
  const m2 = end.getMonth();
  const y2 = end.getFullYear();
  if (m1 === m2) return `Semaine du ${d1} au ${d2} ${COACH_MONTHS_FR[m2]} ${y2}`;
  return `Semaine du ${d1} ${COACH_MONTHS_FR[m1]} au ${d2} ${COACH_MONTHS_FR[m2]} ${y2}`;
}

// ─── Trust Layer : garde-fous FKS (zone de confiance, lecture seule) ─────────
// Phrases statiques, courtes, non médicales. La ligne "jeunes" n'apparaît que
// pour une catégorie d'âge jeune (U13/U15/U17/U18). Aucune promesse médicale.
const YOUTH_AGE_CATEGORIES = ["U13", "U15", "U17", "U18"];
const KNOWN_AGE_CATEGORIES = [...YOUTH_AGE_CATEGORIES, "SENIOR"];

export function getCoachGuardrailNotes(ageCategory?: unknown): string[] {
  const cat = typeof ageCategory === "string" ? ageCategory.trim().toUpperCase() : "";
  // Catégorie connue → on affirme l'adaptation catégorie ; sinon on reste neutre
  // (ne jamais survendre une adaptation catégorie quand l'âge est inconnu).
  const categoryNote = KNOWN_AGE_CATEGORIES.includes(cat)
    ? "Durée et intensité adaptées à la catégorie."
    : "Durée et intensité cadrées par FKS.";
  const notes = [
    "Lecture seule : le coach observe, FKS construit la séance.",
    "Pas de données médicales détaillées affichées.",
    categoryNote,
  ];
  if (YOUTH_AGE_CATEGORIES.includes(cat)) {
    notes.push("Les séances jeunes privilégient contrôle, appuis et renfo.");
  }
  return notes;
}
