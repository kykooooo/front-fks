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

// ════════════════════════════════════════════════════════════════════════════
// SIGNAUX SENSIBLES — supprimés À LA SOURCE de la projection coach
// ════════════════════════════════════════════════════════════════════════════
//
// RÈGLE (pilote FKS Club). Aucun statut, libellé, alerte ou événement coach ne
// doit être PRODUIT à partir : d'une douleur déclarée, d'une zone douloureuse,
// d'un niveau de douleur, d'un commentaire lié à une douleur, d'une fatigue ou
// d'un ressenti, NI d'un signal permettant raisonnablement de les déduire.
//
// POURQUOI TRADUIRE NE SUFFIT PAS. L'ancienne version renvoyait « Adaptation
// sécurité appliquée » pour tout token portant `injury`/`pain`. La VALEUR ne
// sortait pas, mais la PRÉSENCE de la ligne, en face d'un joueur NOMMÉ, prouvait
// qu'un problème physique avait été déclaré. C'est déjà une donnée de santé.
// Le signal doit donc disparaître entièrement : un token sensible se comporte
// exactement comme un token inconnu → `null`.
//
// MÉTHODE. Chaque token est classé par la SOURCE ULTIME de la donnée qui le
// déclenche, en remontant la chaîne de production côté moteur, pas par le mot
// qu'il contient. Deux catégories seulement :
//
//   AUTORISÉ  — contexte club (saisi par le coach), catégorie d'âge, calendrier
//               de match, planning club, focus d'équipe, décharge programmée.
//   SUPPRIMÉ  — tout ce dont la chaîne passe par une donnée déclarée par le
//               joueur ou par son ressenti : douleur, blessure, fatigue,
//               sommeil, RPE, et TOUT dérivé (ATL/CTL/TSB, paliers de fatigue,
//               overrides de feedback).
//
// CLASSIFICATION TOKEN PAR TOKEN (chaîne remontée dans le moteur, fksOrchestrator) :
//
//  ── SUPPRIMÉS ──
//  `injury:*`                     déclaration de blessure du joueur. Évident.
//  `*pain* / *douleur* / *blessure*`  idem (ex. `gate:pain_knee_ankle_no_plyo_speed_cod`,
//                                 `equipment_or_pain_violation_replaced`,
//                                 `feedback:pain_high_reduce`, `*:injury_adapted`).
//  `feedback:*`                   construit depuis le feedback post-séance
//                                 (RPE, douleur, durée ressentie) → sensible par
//                                 définition, y compris `feedback:cap_override:*`.
//  `*rpe*`                        le RPE est une donnée déclarée par le joueur.
//  `*tsb* / metrics:*`            le TSB vient d'ATL/CTL, eux-mêmes calculés à
//                                 partir de la charge = RPE × durée. Un « joueur
//                                 chargé » est donc un RPE déclaré, déguisé.
//  `tier:*`                       le palier vient de `cap_level`, qui est le
//                                 signal de fatigue (capLoadInfo/TSB), corrigé
//                                 par `feedbackAdj.cap_override` et forcé à
//                                 "easy" en cas de blessure. Triplement sensible.
//  `*fatigue*` (`fatigue_trend:*`) tendance de fatigue calculée sur les RPE.
//  `*cap_easy* / *cap_moderate*`  (`gate:cap_easy`, `intent:cap_easy_intensity_downgraded`,
//                                 `level:loisir_s1_s2_cap_easy_plus`) : ce sont
//                                 des lectures de `cap_level`, donc du même
//                                 signal de fatigue. ⚠ à ne pas confondre avec
//                                 `*_cap_level_easy` porté par un token de
//                                 calendrier (`intent:j_minus_1_cap_level_easy`),
//                                 qui reste autorisé : sa cause est la date du match.
//  `intensity_cap:*`              cap d'intensité non daté : origine fatigue.
//  `level:*`                      les caps « loisir » ne sont émis QUE si aucun
//                                 garde-fou blessure n'est actif
//                                 (`levelCapEligible = !injuryCapGuardrails.length`).
//                                 Leur ABSENCE chez un joueur loisir devient donc
//                                 un indice de blessure : canal fermé.
//  `client:load_*`                émis par le front depuis `tsb < -10` / `tsb < 0`
//                                 (state/stores/persistHelpers.ts) → dérivé du RPE.
//  `easy_alternation:* / intent:easy_sub:*`  substitutions déclenchées par cap easy.
//  `*safety_recovery_only*`       le token ÉNUMÈRE ses causes, dont `injury_severe`,
//                                 `tsb_critical` et `feedback_pain_high_recurrent`.
//  `*intensity_downgraded*`       résiduel de `cap_easy`.
//
//  ── AUTORISÉS (chaîne prouvée non sensible) ──
//  `club:*`                       contexte club saisi par le COACH lui-même.
//  `client:club_proximity_reduction`  entraînement club aujourd'hui/demain = agenda.
//  `*club_today*`                 même agenda club, côté moteur.
//  `team:*`                       type d'équipe, donnée du club.
//  `age:*`                        catégorie d'âge du profil (cf. section dédiée).
//  `j_minus_1 / match_today / j_plus_1 / j_minus_2 / j_plus_2`  calendrier de match.
//  `*deload* / volume:deload`     la décharge vient de la POSITION dans le cycle
//                                 (volumePlan calculé sur l'index de séance), pas
//                                 de l'état du joueur.
//
//  ── NON CLASSÉS → `null` par défaut ──
//  Tout le reste (agent_a:*, template:*, volume:*, playlist:*, pool_health:*,
//  selection_debug:*, seeds…) : bruit interne, jamais affiché.
//
// DOCTRINE DU DOUTE. Un token dont l'origine n'est pas prouvable ligne à ligne
// est traité comme SENSIBLE. Le coût d'un faux négatif (le coach apprend qu'un
// joueur a déclaré une douleur) est sans commune mesure avec celui d'un faux
// positif (une ligne d'information en moins). C'est pourquoi les fourre-tout
// historiques `intensity_capped` / `duration_capped` / `duration_reduced`, qui
// attrapaient aussi bien un cap d'âge qu'un cap de fatigue, ont disparu : les
// causes légitimes (calendrier, âge, club, décharge) sont désormais nommées une
// par une, et ce qui reste n'est plus traduit.

/** Fragments qui trahissent une donnée déclarée par le joueur ou son ressenti. */
const SENSITIVE_MARKERS = [
  "pain",
  "douleur",
  "blessure",
  "injur", // injury / injuries / injured / injury_adapted
  "fatigue",
  "rpe",
  "tsb",
  "readiness",
  "ressenti",
  "soreness",
  "courbature",
  "sommeil",
  "sleep",
  "wellness",
  "charged", // `intent:<cycle>_charged_*` = lecture de la charge interne
];

/** Espaces de noms entièrement sensibles (préfixe exact). */
const SENSITIVE_PREFIXES = [
  "feedback:", // feedback post-séance : RPE, douleur, durée ressentie
  "tier:", // palier de fatigue (cap_level)
  "metrics:", // atl / ctl / tsb bruts
  "client:load_", // front : dérivé du TSB
  "intensity_cap:", // cap d'intensité non daté → fatigue
  "level:", // caps « loisir » émis seulement hors blessure (canal par absence)
  "gate:cap_", // gate:cap_easy / gate:cap_moderate
  "easy_alternation:", // substitution déclenchée par cap easy
  "intent:easy_sub:", // idem
];

/** Fragments sensibles qui ne sont ni un marqueur de vocabulaire ni un préfixe. */
const SENSITIVE_FRAGMENTS = [
  "cap_easy",
  "cap_moderate",
  "intensity_downgraded",
  "safety_recovery_only",
  // `saison:deload_reset:<causes>` : à ne pas confondre avec la décharge
  // PROGRAMMÉE (autorisée). L'override « reset » n'est choisi que sous
  // `cap_level easy` + une cause de sécurité — donc sur le signal de fatigue,
  // pas sur la position dans le cycle.
  "deload_reset",
];

/**
 * `true` si le token porte, ou permet de déduire, une donnée de santé / de
 * ressenti. Utilisé AVANT toute traduction (garde-fous) et AVANT tout
 * regroupement (raisons d'écart) : c'est le point unique de la règle.
 */
export function isSensitiveSignalToken(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const low = raw.trim().toLowerCase();
  if (!low) return false;
  if (SENSITIVE_PREFIXES.some((p) => low.startsWith(p))) return true;
  if (SENSITIVE_MARKERS.some((m) => low.includes(m))) return true;
  return SENSITIVE_FRAGMENTS.some((f) => low.includes(f));
}

/**
 * Libellé UNIQUE de toute la famille « substitution jeune ».
 *
 * POURQUOI UN SEUL LIBELLÉ POUR SIX TOKENS. Le moteur choisit l'archétype jeune
 * avec `pickU15TrainingArchetype`, dont la toute première ligne est
 * `if (loaded || lowerLimbPain) return PREVENTION`. La VARIANTE du token
 * (`prevention` vs `speed` vs `bodyweight` vs `deceleration`) est donc une
 * lecture directe de la douleur de membre inférieur et de la fatigue — et dans
 * l'autre sens, voir `speed` PROUVE l'absence des deux. De même
 * `age:youth_safety_recovery` n'est émis que sous « sécurité forte »
 * (blessure ≥ 3, TSB critique, jour de match, veille de match).
 *
 * Les supprimer ferait perdre une information légitime (FKS a bien adapté la
 * séance à la catégorie d'âge). On les rend donc INDISCERNABLES entre eux : la
 * présence de la ligne ne dit que « séance substituée pour un jeune », ce qui
 * est vrai dans tous les cas, et la variante n'est plus observable.
 */
export const COACH_YOUTH_SUBSTITUTE_LABEL = "Séance adaptée à la catégorie d'âge";

// ─── Allowlist des guardrails → label coach (port de guardrailToCoachLabel) ──
/** Convertit un guardrail unique en label coach. `null` = invisible pour le coach. */
export function guardrailToCoachLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  const low = t.toLowerCase();

  // 1) SUPPRESSION D'ABORD. Placé avant toute allowlist pour que l'ajout futur
  //    d'une règle de traduction ne puisse pas rouvrir le canal par accident
  //    (ex. `intent:safety_recovery_only:club_today+deload` contient bien
  //    « club_today », mais sa présence trahit une cause de sécurité).
  if (isSensitiveSignalToken(low)) return null;

  // 2) Contexte club renseigné par le coach.
  if (low === "club:heavy_week_adjustment") return "Semaine club intense : charge FKS réduite";
  if (low === "club:very_heavy_week_adjustment") return "Semaine club très intense : séance fortement allégée";
  if (low === "club:goal_freshness") return "Objectif coach : fraîcheur (séance allégée si besoin)";
  if (low === "club:goal_prevention") return "Objectif coach renseigné : appuis & freinage";
  if (low === "club:goal_speed") return "Objectif coach renseigné : vitesse";
  if (low === "club:goal_strength") return "Objectif coach renseigné : force";
  if (low === "club:goal_comeback") return "Objectif coach renseigné : reprise";

  // 2bis) Ajustements client stables (planification front) — tokens `client:*`.
  //       Seule la proximité club survit : `client:load_*` est dérivé du TSB
  //       (persistHelpers.computePlannedClientGuardrails) et tombe en 1).
  if (low === "client:club_proximity_reduction") return "Entraînement club proche : charge réduite";

  // 2ter) Focus équipe (neuromusculaire) — libellé NEUTRE, jamais "féminin"/médical.
  if (low === "team:female_neuromuscular_focus") return "Contrôle appuis et alignement";

  // 3) Catégorie d'âge.
  if (low.startsWith("age:")) {
    const catMatch = t.match(/age:(U13|U15|U17|U18)/i);
    const cat = catMatch ? catMatch[1].toUpperCase() : null;
    // Famille « substitution jeune » : UN SEUL libellé, la variante n'est pas
    // observable (cf. COACH_YOUTH_SUBSTITUTE_LABEL).
    if (low.includes("_substitute") || low.includes("youth_safety_recovery")) {
      return COACH_YOUTH_SUBSTITUTE_LABEL;
    }
    if (low.includes("forbidden_family_filtered")) return "Exercices incompatibles retirés (catégorie d'âge)";
    if (low.includes("duration_cap")) return cat ? `Catégorie ${cat} : durée plafonnée` : "Catégorie d'âge : durée plafonnée";
    if (low.includes("intensity_cap")) return cat ? `Catégorie ${cat} : intensité plafonnée` : "Catégorie d'âge : intensité plafonnée";
    return null;
  }

  // 4) Match proche (calendrier). Cause = la DATE du match, jamais l'état du joueur.
  if (low.includes("j_minus_1") || low.includes("j-1")) return "Veille de match : activation uniquement";
  if (low.includes("match_today")) return "Jour de match : séance très légère";
  if (low.includes("j_plus_1") || low.includes("j+1")) return "Lendemain de match : récupération";
  if (low.includes("j_minus_2") || low.includes("j-2")) return "Avant-match : charge réduite";
  if (low.includes("j_plus_2") || low.includes("j+2")) return "Après-match : charge contrôlée";

  // 5) Agenda club côté moteur (`intent:club_today_duration_capped_30`,
  //    `gate:club_today_no_hard`, `club_today_micro`…). Même nature que 2bis :
  //    c'est le planning d'entraînement du club, pas l'état du joueur.
  if (low.includes("club_today")) return "Entraînement club le même jour : séance adaptée";

  // 6) Décharge PROGRAMMÉE : `volumePlan` la déduit de l'index de séance dans le
  //    cycle (fin de bloc), jamais de la fatigue mesurée du joueur.
  if (low.includes("deload")) return "Semaine de décharge programmée";

  // 7) Chaîne FR héritée (planned guardrailsApplied) sur la proximité club.
  //    Les autres chaînes FR héritées mentionnaient le TSB : elles tombent en 1).
  if (low.includes("réduction club") || low.includes("reduction club")) return "Entraînement club proche : charge réduite";

  // 8) Bruit interne (volume, phases, seeds, scale, debug, inconnu) → masqué.
  //    Y compris les anciens fourre-tout `intensity_capped`/`duration_capped`/
  //    `duration_reduced` : leurs causes légitimes sont nommées en 3) à 6), et
  //    ce qui reste n'a pas d'origine prouvable (cf. doctrine du doute).
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

// ─── Raisons d'écart joueur → label coach (allowlist FERMÉE, non inversible) ──
//
// Source : `DeviationReason` de la boucle de suivi joueur (domain/tracking/types.ts)
// = time | equipment | too_difficult | fatigue | pain | technical | space |
//   no_partner | other.
//
// RÈGLE DE SÉCURITÉ CENTRALE — LE SIGNAL SENSIBLE NE TRAVERSE PAS.
//
// Version précédente : `pain` et `fatigue` étaient NOYÉS dans « Autre raison »,
// partagé avec `other` et les tokens inconnus. La valeur ne sortait pas, mais le
// signal traversait quand même la projection — et une ligne « Autre raison »
// apparaissait bel et bien à cause d'une douleur. Ce n'est plus suffisant :
// `pain` et `fatigue` sont maintenant RETIRÉS de la liste avant toute
// traduction, donc absents de `deviationLabels`.
//
// LE PIÈGE QUE CELA CRÉE, ET COMMENT IL EST FERMÉ.
// Supprimer une raison sensible pendant que `other` reste traduit ouvrirait une
// déduction par élimination (« il a sauté 3 exos et rien n'est affiché → il a
// mal quelque part »). Trois propriétés la ferment, et elles sont testées :
//
//  1. « Autre raison » RESTE le libellé de `other` ET de tout token inconnu. Une
//     liste vide est donc compatible avec plusieurs mondes : aucune raison
//     saisie (la boucle autorise `reason: null`), raisons non calculées, ou
//     raison sensible retirée. Le vide ne prouve rien.
//  2. AUCUN COMPTEUR de raisons n'est projeté. `deviationLabels` est un ENSEMBLE
//     dédupliqué et borné à 3 : il n'a jamais été comparable au nombre
//     d'exercices sautés/adaptés. Il n'existe donc pas de canal arithmétique
//     (« 3 sautés, 1 seule raison → la 2e était médicale ») : le coach ne peut
//     pas savoir si la liste est exhaustive.
//  3. Le filtrage a lieu AVANT la déduplication et AVANT le plafond de 3, si
//     bien que ["time","pain"] produit EXACTEMENT la même sortie que ["time"] —
//     octet pour octet. Une raison sensible ne laisse aucune trace, pas même un
//     décalage de troncature.

/** Libellé fourre-tout. Partagé par "autre" et tout token inconnu non sensible. */
export const COACH_DEVIATION_OTHER_LABEL = "Autre raison";

/**
 * Raisons d'écart SENSIBLES : retirées, jamais traduites, jamais remplacées.
 * `too_difficult` n'en fait pas partie — c'est un constat de difficulté
 * d'exercice, pas un état physique du joueur.
 */
const SENSITIVE_DEVIATION_REASONS = new Set(["pain", "fatigue"]);

/** `true` si la raison porte, ou permet de déduire, une donnée de santé. */
export function isSensitiveDeviationReason(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const low = raw.trim().toLowerCase();
  return SENSITIVE_DEVIATION_REASONS.has(low) || isSensitiveSignalToken(low);
}

/** Raisons NON sensibles, seules à mériter un libellé propre. */
const DEVIATION_LABELS: Record<string, string> = {
  time: "Manque de temps",
  equipment: "Matériel indisponible",
  too_difficult: "Exercice trop difficile",
  technical: "Difficulté technique",
  space: "Espace insuffisant",
  no_partner: "Pas de partenaire",
};

/**
 * Nombre max de raisons affichées au coach. Aligné sur `completion.mainReasons`
 * de la boucle de suivi (max 3) : au-delà, ce n'est plus une explication, c'est
 * du bruit dans un écran qui doit se lire en quelques secondes.
 */
export const COACH_DEVIATION_LABELS_MAX = 3;

/**
 * Traduit UNE raison d'écart.
 * `null` = raison SUPPRIMÉE parce que sensible (même sort qu'un garde-fou
 * sensible : elle disparaît, elle n'est pas remplacée par un libellé neutre).
 * Toute autre valeur donne une chaîne : jamais de token brut.
 */
export function deviationReasonToCoachLabel(raw: unknown): string | null {
  if (isSensitiveDeviationReason(raw)) return null;
  if (typeof raw !== "string") return COACH_DEVIATION_OTHER_LABEL;
  return DEVIATION_LABELS[raw.trim().toLowerCase()] ?? COACH_DEVIATION_OTHER_LABEL;
}

/**
 * Traduit une liste de raisons : entrées vides/non-chaînes ignorées (absence de
 * raison ≠ raison inconnue), raisons sensibles RETIRÉES, reste dédupliqué et borné.
 *
 * ⚠️ Le retrait des raisons sensibles se fait AVANT la déduplication et AVANT le
 * plafond : c'est ce qui garantit qu'une liste contenant une douleur donne un
 * résultat strictement identique à la même liste sans elle (propriété 3 supra).
 */
export function toCoachDeviationLabels(reasons: unknown): string[] {
  if (!Array.isArray(reasons)) return [];
  const out: string[] = [];
  for (const r of reasons) {
    if (typeof r !== "string" || !r.trim()) continue;
    const label = deviationReasonToCoachLabel(r);
    if (label === null) continue; // raison sensible : aucune trace, pas même un rang
    if (!out.includes(label)) out.push(label);
    if (out.length >= COACH_DEVIATION_LABELS_MAX) break;
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
