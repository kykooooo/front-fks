// functions/src/dto.ts
// Contrat DTO strict de la projection coach-safe + garde-fou anti-fuite.

import type { AgeCategory } from "./coachLabels";

export type SessionStatus = "planned" | "done" | "unknown";

export interface CoachLatestSession {
  // NB : pas d'`id` — un doc ID Firestore est une chaîne client arbitraire non
  // bornée ; inutile au lecteur coach après la sélection serveur planned/completed.
  // Il reste UNIQUEMENT interne (SessionCandidate) pour comparer planned vs completed.
  dateKey: string | null;
  title: string | null;
  focusLabel: string | null;
  intensityLabel: string | null;
  durationMin: number | null;
  blockCount: number | null;
  status: SessionStatus;
}

export interface CoachLastActivity {
  dateKey: string | null;
  durationMin: number | null;
}

export interface CoachAdaptation {
  adapted: boolean;
  /** Labels d'une allowlist serveur uniquement (jamais de token brut). */
  labels: string[];
}

/**
 * Fenêtre d'activité = FAITS BRUTS à date absolue, rien d'autre.
 *
 * INVARIANT (cf. en-tête projector.ts) : le serveur n'a PAS d'horloge métier. On
 * projette donc les dates des séances réellement terminées, décroissantes, et le
 * front (qui, lui, a l'horloge du coach) en déduit "cette semaine", "3 jours sans
 * séance", etc. Aucun compteur, aucune fenêtre glissante, aucun "isLate" ici :
 * un tel champ serait FAUX dès la seconde suivant l'écriture de la projection.
 */
export interface CoachActivityWindow {
  /** "YYYY-MM-DD", tri décroissant, dédupliquées, bornées (cf. ACTIVITY_MAX_DATES). */
  doneDateKeys: string[];
}

/**
 * Référence de séance : même forme que `CoachLatestSession` SANS `status`.
 * Le statut est porté par le NOM du champ (`lastPlanned` / `lastDone`), ce qui
 * évite l'ambiguïté actuelle où les deux séances se disputent un seul slot.
 */
export interface CoachSessionRef {
  dateKey: string | null;
  title: string | null;
  focusLabel: string | null;
  intensityLabel: string | null;
  durationMin: number | null;
  blockCount: number | null;
}

/**
 * Exécution RÉELLE de la dernière séance faite (prescrit vs réalisé).
 *
 * Source : le champ `execution` posé sur `users/{uid}/sessions/{id}` par la
 * boucle de suivi joueur. Ce champ N'EXISTE PAS ENCORE : tant que la boucle
 * n'est pas mergée, `execution` vaut `null` et c'est le cas NOMINAL.
 *
 * Vocabulaire : ici "adapté / sauté / remplacé" décrit ce que LE JOUEUR a fait.
 * À ne pas confondre avec `CoachAdaptation`, qui décrit ce que LE MOTEUR FKS a
 * allégé avant la séance.
 */
export interface CoachExecutionSummary {
  /** 0..100. `null` = non calculable. */
  completionPct: number | null;
  completionStatus: "full" | "partial" | "abandoned" | null;
  itemsDone: number | null;
  itemsAdapted: number | null;
  itemsSkipped: number | null;
  /**
   * Somme `itemsReplacedEquivalent + itemsReplacedPartial`, gardée pour les
   * affichages COMPACTS (une ligne « remplacés »). Ne suffit PAS à refaire le
   * calcul du pourcentage : voir les deux champs ci-dessous.
   */
  itemsReplaced: number | null;
  /**
   * POURQUOI ces deux compteurs sont SÉPARÉS.
   *
   * Le pourcentage de réalisation est PONDÉRÉ (boucle de suivi joueur,
   * domain/tracking/execution.ts + config.ts) :
   *   pct = arrondi( (1×fait + 1×adapté + 1×remplacé_équivalent
   *                   + 0,5×remplacé_partiel + 0×sauté + 0×inconnu) / total × 100 )
   * Un remplacement équivalent pèse 1, un remplacement partiel 0,5. Les écraser
   * en un seul « remplacés » rendait le pourcentage IMPOSSIBLE à retrouver pour
   * le coach — c'est très exactement le score opaque que la doctrine interdit.
   */
  itemsReplacedEquivalent: number | null;
  itemsReplacedPartial: number | null;
  /**
   * Nombre TOTAL d'exercices de la séance = dénominateur du pourcentage.
   * Sans lui, aucune vérification n'est possible. Les items « inconnus »
   * (ni faits, ni sautés, ni adaptés) comptent dans ce total tout en pesant 0 :
   * les compteurs ci-dessus ne somment donc PAS toujours au total, et c'est
   * normal. `null` = total non transmis → le front doit dire qu'il ne peut pas
   * détailler le calcul, JAMAIS fabriquer un total.
   */
  itemsTotal: number | null;
  /**
   * Raisons d'écart traduites via une allowlist FERMÉE et NON INVERSIBLE :
   * douleur, fatigue, "autre" et tout token inconnu produisent EXACTEMENT le
   * même libellé, pour qu'un coach ne puisse pas déduire une info de santé par
   * élimination (cf. `toCoachDeviationLabels`).
   */
  deviationLabels: string[];
}

/**
 * Cœur MÉTIER de la projection : déterministe à partir des sources. Ne contient
 * PAS `sourceEventAt`/`updatedAt` (posés par `rebuildPlayerSummary`, cf. §5).
 * Deux exécutions sur des sources identiques produisent le même `CoachPlayerSummaryCore`.
 */
export interface CoachPlayerSummaryCore {
  playerUid: string;
  firstName: string | null;
  ageCategory: AgeCategory | null;
  position: string | null;
  level: string | null;
  profileComplete: boolean;
  latestSession: CoachLatestSession | null;
  lastActivity: CoachLastActivity | null;
  adaptation: CoachAdaptation;

  // ── Extension v2 (TOUS optionnels) ────────────────────────────────────────
  // `latestSession` reste INCHANGÉ (rétrocompatibilité des lecteurs déjà
  // déployés). Les champs ci-dessous le COMPLÈTENT : `lastPlanned` et `lastDone`
  // coexistent au lieu de se disputer un seul slot — c'est précisément le défaut
  // que le coach subit aujourd'hui (il ne peut pas comparer prévu vs fait).
  // Leur absence est l'état NOMINAL sur les projections écrites avant ce lot.
  /** Dates des séances faites (fait brut, sans horloge). */
  activity?: CoachActivityWindow | null;
  /** Dernière séance PLANIFIÉE (par date), telle quelle. */
  lastPlanned?: CoachSessionRef | null;
  /** Dernière séance FAITE, telle quelle. */
  lastDone?: CoachSessionRef | null;
  /** Exécution réelle de cette dernière séance faite (boucle de suivi). */
  execution?: CoachExecutionSummary | null;
}

/** DTO complet écrit dans Firestore = cœur métier + enveloppe watermark/idempotence. */
export interface CoachPlayerSummary extends CoachPlayerSummaryCore {
  /** Millisecondes epoch de l'événement source (lisibilité + fallback compare). */
  sourceEventAt: number;
  /** Heure RFC3339 exacte de l'événement source (source de vérité du watermark). */
  sourceEventTime: string;
  /** Id CloudEvent de l'événement source (tie-break déterministe). */
  sourceEventId: string;
  /** Posé serveur (serverTimestamp en prod). Peut changer sans changer le métier. */
  updatedAt: unknown;
}

/**
 * Clés STRICTEMENT interdites, à quelque profondeur que ce soit. Aligné sur
 * `firestore-tests/fixtures.FORBIDDEN_SUMMARY_KEYS` + exigences §3 PR-2.
 * `ai`/`aiV2`/`feedback`/`metrics`/`selection_debug` = blueprints/bruts jamais projetés.
 */
export const FORBIDDEN_KEYS: readonly string[] = [
  "pain",
  "painzone",
  "painzones",
  "injury",
  "injuries",
  "severity",
  "fatigue",
  "sleep",
  "recovery",
  "recoveryperceived",
  "comment",
  "menstruation",
  "cycle",
  "rpe",
  "atl",
  "ctl",
  "tsb",
  "metrics",
  "feedback",
  "ai",
  "aiv2",
  "selection_debug",
  "guardrails",
  "guardrailsapplied",
  "guardrails_applied",
  "clientguardrailsapplied",
  "tokens",
  "prompt",
  "prompts",
  "rationale",
  "rationales",
];

const FORBIDDEN_SET = new Set(FORBIDDEN_KEYS.map((k) => k.toLowerCase()));

/**
 * Racines sensibles détectées par SOUS-CHAÎNE (et non plus par égalité stricte).
 *
 * POURQUOI. La liste `FORBIDDEN_KEYS` ci-dessus était comparée en match EXACT :
 * `pain` levait, mais `painFlag`, `fatigueLevel`, `sleepScore` ou `painZoneCode`
 * passaient tranquillement. Un seul champ ajouté à la va-vite dans un futur lot
 * suffisait à faire fuiter de la donnée de santé vers le coach. On bascule donc
 * sur une détection par racine : c'est volontairement large, quitte à refuser un
 * nom de champ innocent — dans ce cas on RENOMME le champ, on n'assouplit pas
 * le garde-fou.
 *
 * Ces racines sont assez longues pour ne pas collisionner avec le vocabulaire
 * légitime du DTO (adaptation, activity, execution, completionPct, lastDone,
 * lastPlanned, deviationLabels, itemsSkipped…), ce qu'un test verrouille.
 */
export const SENSITIVE_KEY_ROOTS: readonly string[] = [
  "pain",
  "douleur",
  "injur",
  "blessure",
  "fatigue",
  "sleep",
  "sommeil",
  "recover",
  "recup",
  "soreness",
  "courbature",
  "menstru",
  "medic",
  "health",
  "wellness",
  "mood",
  "stress",
  "symptom",
  "diagnos",
  "feedback",
  "comment",
];

/**
 * Sigles courts (3 lettres) de charge/ressenti. Trop courts pour une détection
 * par sous-chaîne sans faux positifs, donc comparés SEGMENT par SEGMENT :
 * `rpeAvg`, `avgRPE`, `rpe_target`, `tsbTrend`, `atl7` lèvent tous ; `latestSession`
 * ou `updatedAt` ne lèvent pas.
 */
export const SENSITIVE_KEY_TOKENS: readonly string[] = ["rpe", "tsb", "atl", "ctl", "hrv"];

/** Découpe une clé en segments minuscules (camelCase, snake_case, kebab-case). */
function keySegments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

/** `true` si la clé est interdite (match exact, racine sensible, ou sigle). */
export function isForbiddenKey(key: string): boolean {
  const low = key.toLowerCase();
  if (FORBIDDEN_SET.has(low)) return true;
  if (SENSITIVE_KEY_ROOTS.some((root) => low.includes(root))) return true;
  // Sigles : segment identique, éventuellement suivi de chiffres ("atl7", "rpe3").
  return keySegments(key).some((seg) =>
    SENSITIVE_KEY_TOKENS.some((tk) => seg === tk || (seg.startsWith(tk) && /^\d+$/.test(seg.slice(tk.length)))),
  );
}

/**
 * Vérifie récursivement qu'aucune clé interdite n'existe dans l'objet (dernier
 * rempart avant écriture Firestore). Jette si une clé interdite est trouvée.
 * N'inspecte QUE les clés (pas les valeurs) — la valeur ne peut fuiter que via
 * une clé, puisque la projection ne contient que des chaînes déjà traduites.
 */
export function assertCoachSafe(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertCoachSafe(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (isForbiddenKey(key)) {
        throw new Error(`assertCoachSafe: clé interdite "${key}" à ${path}`);
      }
      assertCoachSafe(v, `${path}.${key}`);
    }
  }
}
