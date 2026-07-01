// functions/src/coachLabels.ts
//
// Port SERVEUR (pur, aucune dépendance React Native) de la logique coach-safe du
// front : allowlist de traduction des guardrails, choix planned/completed, et
// helpers de date/catégorie. Copie conceptuelle de `domain/coachLabels.ts` +
// `utils/dateHelpers.ts` + `domain/types.ts` — gardée synchro manuellement.
//
// Règle de sécurité centrale : un token INCONNU est traduit en `null` (supprimé),
// jamais recopié tel quel. Aucune donnée médicale / TSB / commentaire ne sort.

// ─── Date → "YYYY-MM-DD" (UTC-stable pour les clés déjà "bare") ──────────────
// Réplique utils/dateHelpers.toDateKey MAIS en UTC (le serveur n'a pas de fuseau
// utilisateur). Pour une clé "bare" YYYY-MM-DD on renvoie tel quel (pas de shift).
const pad2 = (value: number) => String(value).padStart(2, "0");

export function toDateKey(value?: string | Date | null): string {
  if (!value) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(parsed.getUTCDate())}`;
  }
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

// ─── Catégorie d'âge (miroir domain/types.AGE_CATEGORIES) ───────────────────
export const AGE_CATEGORIES = ["U13", "U15", "U17", "U18", "Senior"] as const;
export type AgeCategory = (typeof AGE_CATEGORIES)[number];

export function normalizeAgeCategory(value: unknown): AgeCategory | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return (AGE_CATEGORIES as readonly string[]).includes(v) ? (v as AgeCategory) : null;
}

// ─── Allowlist des guardrails → label coach (port de guardrailToCoachLabel) ──
/** Convertit un guardrail unique en label coach. `null` = invisible pour le coach. */
export function guardrailToCoachLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  const low = t.toLowerCase();

  // 1) Sécurité blessure / douleur — jamais de détail médical brut.
  if (low.startsWith("injury:") || low.includes("pain") || low.includes("douleur") || low.includes("blessure")) {
    return "Adaptation sécurité appliquée";
  }

  // 2) Contexte club renseigné par le coach.
  if (low === "club:heavy_week_adjustment") return "Semaine club intense : charge FKS réduite";
  if (low === "club:very_heavy_week_adjustment") return "Semaine club très intense : séance fortement allégée";
  if (low === "club:goal_freshness") return "Objectif coach : fraîcheur (séance allégée si besoin)";
  if (low === "club:goal_prevention") return "Objectif coach renseigné : appuis & freinage";
  if (low === "club:goal_speed") return "Objectif coach renseigné : vitesse";
  if (low === "club:goal_strength") return "Objectif coach renseigné : force";
  if (low === "club:goal_comeback") return "Objectif coach renseigné : reprise";

  // 2bis) Ajustements client stables (planification front) — tokens `client:*`.
  if (low === "client:club_proximity_reduction") return "Entraînement club proche : charge réduite";
  if (low === "client:load_high_forced_easy") return "Joueur chargé : séance allégée";
  if (low === "client:load_negative_intensity_reduced") return "Joueur chargé : intensité réduite";

  // 2ter) Focus équipe (neuromusculaire) — libellé NEUTRE, jamais "féminin"/médical.
  if (low === "team:female_neuromuscular_focus") return "Contrôle appuis et alignement";

  // 3) Catégorie d'âge.
  if (low.startsWith("age:")) {
    const catMatch = t.match(/age:(U13|U15|U17|U18)/i);
    const cat = catMatch ? catMatch[1].toUpperCase() : null;
    if (low.includes("youth_safety_recovery")) return "Récupération adaptée (sécurité jeune)";
    if (low.includes("youth_movement_substitute")) return "Séance jeune adaptée (école de mouvement)";
    if (low.includes("youth_speed_substitute")) return "Séance jeune adaptée (coordination / vitesse contrôlée)";
    if (low.includes("youth_bodyweight_substitute")) return "Séance jeune adaptée (renfo poids de corps)";
    if (low.includes("youth_deceleration_substitute")) return "Focus freinage / réception contrôlée";
    if (low.includes("youth_prevention_speed_substitute")) return "Séance jeune adaptée (renfo & appuis)";
    if (low.includes("youth_prevention_substitute")) return "Séance jeune adaptée (renfo & appuis)";
    if (low.includes("forbidden_family_filtered")) return "Exercices incompatibles retirés (catégorie d'âge)";
    if (low.includes("duration_cap")) return cat ? `Catégorie ${cat} : durée plafonnée` : "Catégorie d'âge : durée plafonnée";
    if (low.includes("intensity_cap")) return cat ? `Catégorie ${cat} : intensité plafonnée` : "Catégorie d'âge : intensité plafonnée";
    return null;
  }

  // 4) Match proche (calendrier).
  if (low.includes("j_minus_1") || low.includes("j-1")) return "Veille de match : activation uniquement";
  if (low.includes("match_today")) return "Jour de match : séance très légère";
  if (low.includes("j_plus_1") || low.includes("j+1")) return "Lendemain de match : récupération";
  if (low.includes("j_minus_2") || low.includes("j-2")) return "Avant-match : charge réduite";
  if (low.includes("j_plus_2") || low.includes("j+2")) return "Après-match : charge contrôlée";

  // 5) Fatigue / allègement (paliers + downgrades).
  if (low === "tier:easy_plus") return "Séance allégée";
  if (low === "tier:moderate_light") return "Séance modérée";
  if (low.includes("cap_easy") || low.includes("intensity_downgraded") || low.includes("intensity_forced_easy")) {
    return "Joueur chargé : séance allégée";
  }
  if (low.includes("intensity_capped")) return "Intensité réduite (prudence)";
  if (low.includes("duration_capped") || low.includes("duration_reduced")) return "Durée réduite (prudence)";
  if (low.includes("rpe") && (low.includes("reduce") || low.includes("high"))) {
    return "Séances récentes dures : charge réduite";
  }

  // Chaînes FR héritées (planned guardrailsApplied) — elles fuitent le TSB : on traduit.
  if (low.includes("tsb")) return "Joueur chargé : séance allégée";
  if (low.includes("réduction club") || low.includes("reduction club")) return "Entraînement club proche : charge réduite";

  // 6) Bruit interne (volume, phases, seeds, scale, debug, inconnu) → masqué.
  return null;
}

/** Fusionne plusieurs sources de tokens en une liste dédupliquée (port). */
export function collectAdaptationTokens(...sources: unknown[]): string[] {
  const out: string[] = [];
  for (const src of sources) {
    if (!Array.isArray(src)) continue;
    for (const x of src) {
      if (typeof x === "string" && x.trim() && !out.includes(x)) out.push(x);
    }
  }
  return out;
}

/** Traduit une liste de tokens en labels coach (filtrés + dédupliqués). */
export function toCoachAdaptationLabels(tokens: unknown): string[] {
  if (!Array.isArray(tokens)) return [];
  const out: string[] = [];
  for (const tk of tokens) {
    const label = guardrailToCoachLabel(tk);
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}

/** Intensité technique → mot coach (port de readableIntensity). `null` si inconnu. */
export function readableIntensity(intensity: unknown): string | null {
  switch (String(intensity ?? "").toLowerCase()) {
    case "easy":
      return "Légère";
    case "moderate":
      return "Modérée";
    case "hard":
      return "Intense";
    case "max":
      return "Très intense";
    default:
      return null;
  }
}

// ─── Focus : ALLOWLIST serveur stricte (jamais de valeur brute recopiée) ────
// Preuve valeurs front : state/stores/types.ts (run|strength|plyo|speed|circuit|
// mobility) + repositories/sessionsRepo.ts. Superset défensif (core/cod/endurance)
// toléré car ce sont des constantes serveur, non du texte client. Inconnu → null.
const FOCUS_MAP: Record<string, { label: string; title: string }> = {
  strength: { label: "Renfo / Force", title: "Séance renfo / force" },
  run: { label: "Course / Endurance", title: "Séance course / endurance" },
  endurance: { label: "Course / Endurance", title: "Séance course / endurance" },
  speed: { label: "Vitesse", title: "Séance vitesse" },
  plyo: { label: "Pliométrie", title: "Séance pliométrie" },
  circuit: { label: "Circuit", title: "Séance circuit" },
  mobility: { label: "Mobilité", title: "Séance mobilité" },
  core: { label: "Gainage", title: "Séance gainage" },
  cod: { label: "Appuis / Changements de direction", title: "Séance appuis" },
};

function focusEntry(focus: unknown): { label: string; title: string } | null {
  if (typeof focus !== "string") return null;
  return FOCUS_MAP[focus.trim().toLowerCase()] ?? null;
}

/** Focus technique → label coach depuis l'allowlist. Inconnu → null (jamais la valeur brute). */
export function readableFocus(focus: unknown): string | null {
  return focusEntry(focus)?.label ?? null;
}

/**
 * Titre de séance dérivé UNIQUEMENT du focus allowlisté. On NE copie JAMAIS
 * `doc.title`/`ai.title` (texte libre issu du client). Inconnu → null.
 */
export function focusTitle(focus: unknown): string | null {
  return focusEntry(focus)?.title ?? null;
}

// ─── Identité : allowlists serveur (preuve front ProfileSetupScreen.tsx:50-51) ─
const POSITIONS = new Set(["Gardien", "Defenseur", "Milieu", "Attaquant"]);
const LEVELS = new Set(["Amateur", "Regional", "National", "Semi-pro", "Pro"]);

export function normalizePosition(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return POSITIONS.has(t) ? t : null;
}

export function normalizeLevel(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return LEVELS.has(t) ? t : null;
}

/** Seul champ d'identité en texte libre autorisé : borné + nettoyé des caractères de contrôle. */
export const FIRST_NAME_MAX = 40;
export function sanitizeFirstName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // Retire les caractères de contrôle C0/DEL/C1 (filtrage par codepoint, sans littéral).
  let cleaned = "";
  for (const ch of v) {
    const c = ch.codePointAt(0) ?? 0;
    if (c <= 0x1f || (c >= 0x7f && c <= 0x9f)) continue;
    cleaned += ch;
  }
  cleaned = cleaned.trim();
  return cleaned ? cleaned.slice(0, FIRST_NAME_MAX) : null;
}

/** Bornes réalistes : durée séance 1..240 min, sinon null. */
export function boundDurationMin(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n >= 1 && n <= 240 ? Math.round(n) : null;
}

/** Bornes réalistes : 1..20 blocs, sinon null. */
export function boundBlockCount(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Number.isInteger(n) && n >= 1 && n <= 20 ? n : null;
}

// ─── Choix planned vs completed (port EXACT de pickCoachSessionToDisplay) ────
export type DisplayableSession = {
  id?: string | null;
  dateKey?: string | null; // "YYYY-MM-DD"
};

export function pickCoachSessionToDisplay<T extends DisplayableSession>(
  planned: T | null | undefined,
  completed: T | null | undefined,
): T | null {
  const p = planned ?? null;
  const c = completed ?? null;
  if (!p && !c) return null;
  if (!p) return c;
  if (!c) return p;

  // Même séance (même id) → elle a été faite : on montre la version "Faite".
  if (p.id && c.id && p.id === c.id) return c;

  const pd = p.dateKey ?? null;
  const cd = c.dateKey ?? null;

  if (pd && cd) {
    if (pd === cd) return c; // même jour → on privilégie la séance faite
    return pd > cd ? p : c; // planned plus récente/future → planned ; sinon completed
  }

  // Une date manque → fallback prudent : la séance FAITE est la vérité terrain.
  return c;
}
