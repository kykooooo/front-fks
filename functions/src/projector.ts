// functions/src/projector.ts
//
// Projecteur PUR (aucun accès Firestore, aucune horloge implicite). Reçoit les
// sources brutes + une date contrôlable, renvoie le cœur métier coach-safe
// (`CoachPlayerSummaryCore`) ou `null`. Construit chaque champ EXPLICITEMENT :
// aucun spread de source, aucune clé inconnue recopiée.

import { isActivePlayer } from "./clubAuthority";
import { isMembershipCoachAccessGranted } from "./coachAccess";
import {
  boundBlockCount,
  boundDurationMin,
  collectAdaptationTokens,
  focusTitle,
  isSensitiveDeviationReason,
  normalizeAgeCategory,
  normalizeLevel,
  normalizePosition,
  pickCoachSessionToDisplay,
  readableFocus,
  readableIntensity,
  sanitizeFirstName,
  toCoachAdaptationLabels,
  toCoachDeviationLabels,
  toDateKey,
  type DisplayableSession,
} from "./coachLabels";
import type {
  CoachActivityWindow,
  CoachExecutionSummary,
  CoachLatestSession,
  CoachPlayerSummaryCore,
  CoachSessionRef,
  SessionStatus,
} from "./dto";

export type RawDoc = Record<string, unknown>;
/** Doc brut + son id Firestore (posé sous `__id`). */
export type RawSessionDoc = RawDoc & { __id?: string };

export interface ProjectorInput {
  playerUid: string;
  clubId: string;
  /** clubs/{clubId}/members/{playerUid} — null si absent. */
  membership: RawDoc | null;
  /** users/{playerUid} — null si absent. */
  profile: RawDoc | null;
  /** Séances FAITES récentes (users/{uid}/sessions). */
  sessions: RawSessionDoc[];
  /** Séances PLANIFIÉES récentes (users/{uid}/plannedSessions). */
  plannedSessions: RawSessionDoc[];
  /** Horloge injectable (réservée : la logique planned/completed est purement dateKey). */
  now: Date;
}

// ─── Petits accès sûrs ──────────────────────────────────────────────────────
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): RawDoc => (v && typeof v === "object" && !Array.isArray(v) ? (v as RawDoc) : {});
const idOf = (d: RawSessionDoc): string | null => str(d.id) ?? str(d.__id);
const dateOf = (d: RawDoc): string => str(d.dateISO) ?? str(d.date) ?? "";
const dateKeyOf = (d: RawDoc): string | null => {
  const raw = dateOf(d);
  return raw ? toDateKey(raw) || null : null;
};

/** Dernier doc par date décroissante (tri stable, tolère l'absence de date). */
function pickLatest(docs: RawSessionDoc[]): RawSessionDoc | null {
  if (!docs.length) return null;
  return [...docs].sort((a, b) => {
    const da = dateOf(a);
    const dbb = dateOf(b);
    return da < dbb ? 1 : da > dbb ? -1 : 0;
  })[0];
}

/** Candidat interne : DTO d'affichage + tokens d'adaptation associés. */
type SessionCandidate = DisplayableSession & CoachLatestSession & { __tokens: string[] };

function projectPlanned(doc: RawSessionDoc): SessionCandidate {
  const ai = obj(doc.ai);
  // Focus = SEULE source du titre/label (allowlist). Jamais doc.title/ai.title.
  const focusSrc = str(doc.focus) ?? str(ai.focusPrimary) ?? str(ai.focus_primary);
  const blocks = Array.isArray(ai.blocks) ? ai.blocks.length : null;
  return {
    id: idOf(doc),
    dateKey: dateKeyOf(doc),
    title: focusTitle(focusSrc),
    focusLabel: readableFocus(focusSrc),
    intensityLabel: readableIntensity(str(doc.intensity) ?? str(ai.intensity)),
    durationMin: boundDurationMin(num(ai.durationMin) ?? num(ai.duration_min) ?? num(doc.durationMin)),
    blockCount: boundBlockCount(blocks),
    status: "planned" as SessionStatus,
    __tokens: collectAdaptationTokens(
      ai.guardrailsApplied,
      ai.guardrails_applied,
      doc.clientGuardrailsApplied,
      doc.guardrailsApplied,
    ),
  };
}

function projectCompleted(doc: RawSessionDoc): SessionCandidate {
  const v2 = obj(doc.aiV2);
  const fb = obj(doc.feedback);
  const focusSrc = str(doc.focus) ?? str(v2.focusPrimary) ?? str(v2.focus_primary);
  const blocks = Array.isArray(v2.blocks) ? v2.blocks.length : null;
  return {
    id: idOf(doc),
    dateKey: dateKeyOf(doc),
    title: focusTitle(focusSrc),
    focusLabel: readableFocus(focusSrc),
    intensityLabel: readableIntensity(str(doc.intensity) ?? str(v2.intensity)),
    durationMin: boundDurationMin(num(fb.durationMin) ?? num(v2.durationMin) ?? num(v2.duration_min)),
    blockCount: boundBlockCount(blocks),
    status: "done" as SessionStatus,
    // RPE volontairement ABSENT. Tokens = guardrails backend uniquement.
    __tokens: collectAdaptationTokens(v2.guardrailsApplied, v2.guardrails_applied),
  };
}

/** Retire les champs internes (dont `id`, non exposé) → CoachLatestSession propre. */
function toLatestSession(c: SessionCandidate): CoachLatestSession {
  return {
    dateKey: c.dateKey,
    title: c.title,
    focusLabel: c.focusLabel,
    intensityLabel: c.intensityLabel,
    durationMin: c.durationMin,
    blockCount: c.blockCount,
    status: c.status,
  };
}

/** Même chose SANS `status` : le nom du champ (lastPlanned/lastDone) le porte. */
function toSessionRef(c: SessionCandidate): CoachSessionRef {
  return {
    dateKey: c.dateKey,
    title: c.title,
    focusLabel: c.focusLabel,
    intensityLabel: c.intensityLabel,
    durationMin: c.durationMin,
    blockCount: c.blockCount,
  };
}

// ─── Fenêtre d'activité : faits bruts à date absolue ─────────────────────────
/**
 * Deux semaines de dates suffisent au front pour parler de "cette semaine" et de
 * "la semaine dernière" avec l'horloge du coach. Au-delà, la projection grossit
 * sans rien apporter à une lecture de 30 secondes.
 */
export const ACTIVITY_MAX_DATES = 14;

/**
 * Dates des séances RÉELLEMENT faites : décroissantes, dédupliquées, bornées.
 * Aucun compteur, aucun delta, aucune notion de "récent" — le serveur n'a pas
 * d'horloge métier (cf. en-tête de fichier), c'est le front qui date.
 */
function projectActivity(sessions: RawSessionDoc[]): CoachActivityWindow {
  const seen = new Set<string>();
  for (const doc of sessions) {
    const key = dateKeyOf(doc);
    // Une séance sans date exploitable n'est PAS un fait datable : on l'ignore
    // plutôt que d'inventer une date (qui deviendrait un mensonge affiché).
    if (key) seen.add(key);
  }
  const doneDateKeys = [...seen].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, ACTIVITY_MAX_DATES);
  return { doneDateKeys };
}

// ─── Exécution réelle (boucle de suivi joueur) ───────────────────────────────
/** Bornes réalistes d'un compteur d'exercices dans une séance. */
function boundItemCount(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Number.isInteger(n) && n >= 0 && n <= 200 ? n : null;
}

/** Pourcentage borné 0..100 et arrondi (une estimation reste lisible en entier). */
function boundPct(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;
  return Math.round(n);
}

function normalizeCompletionStatus(v: unknown): CoachExecutionSummary["completionStatus"] {
  const s = String(v ?? "").toLowerCase();
  return s === "full" || s === "partial" || s === "abandoned" ? s : null;
}

/**
 * Somme de deux compteurs éventuellement absents. `null + 3 = 3`, `null + null = null` :
 * on ne transforme pas une absence de donnée en 0 (un 0 affiché est une affirmation).
 */
function addCounts(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

/**
 * Résume l'exécution réelle portée par `doc.execution` (écrit par la boucle de
 * suivi joueur sur `users/{uid}/sessions/{id}`).
 *
 * ⚠️ LECTURE DÉFENSIVE OBLIGATOIRE : ce champ N'EXISTE PAS tant que la boucle
 * n'est pas mergée — son absence est le cas NOMINAL, jamais une erreur.
 *
 * ⚠️ CONSTRUCTION EXPLICITE, JAMAIS DE SPREAD : `execution` porte `snapshot`
 * (toute la prescription), `items[].comment` (texte libre du joueur) et
 * `items[].reason === "pain"`. Un seul `...execution` ferait fuiter tout ça vers
 * le coach. On ne recopie donc QUE les champs listés ci-dessous.
 */
function projectExecution(doc: RawSessionDoc | null): CoachExecutionSummary | null {
  if (!doc) return null;
  const raw = doc.execution;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const execution = raw as RawDoc;
  const completion = obj(execution.completion);

  const completionPct = boundPct(num(completion.pct));
  const completionStatus = normalizeCompletionStatus(completion.status);
  const itemsDone = boundItemCount(num(completion.done));
  const itemsAdapted = boundItemCount(num(completion.adapted));
  const itemsSkipped = boundItemCount(num(completion.skipped));
  // Les deux natures de remplacement sont exposées SÉPARÉMENT : elles n'ont pas
  // le même poids dans le pourcentage (1 pour un équivalent, 0,5 pour un
  // partiel). Les écraser rendrait le pourcentage non recalculable par le coach.
  const itemsReplacedEquivalent = boundItemCount(num(completion.replacedEquivalent));
  const itemsReplacedPartial = boundItemCount(num(completion.replacedPartial));
  // Somme, gardée pour les affichages compacts. Variante `completion.replaced`
  // (compteur déjà agrégé) acceptée en repli : dans ce cas la nuance est
  // réellement inconnue et les deux champs ci-dessus restent `null`.
  const itemsReplaced = boundItemCount(
    addCounts(itemsReplacedEquivalent, itemsReplacedPartial) ?? num(completion.replaced),
  );
  const itemsTotal = readItemsTotal(execution, completion);

  const deviationLabels = toCoachDeviationLabels(readDeviationReasons(execution));

  // Champ `execution` présent mais vide de tout signal exploitable → `null`
  // plutôt qu'un objet de `null` : côté coach, "pas de donnée" est un état franc.
  // `itemsTotal` est VOLONTAIREMENT absent de ce test : un total seul ne dit rien
  // au coach (il ne détaille aucun calcul), ce n'est donc pas un signal.
  const hasSignal =
    completionPct !== null ||
    completionStatus !== null ||
    itemsDone !== null ||
    itemsAdapted !== null ||
    itemsSkipped !== null ||
    itemsReplaced !== null ||
    deviationLabels.length > 0;
  if (!hasSignal) return null;

  return {
    completionPct,
    completionStatus,
    itemsDone,
    itemsAdapted,
    itemsSkipped,
    itemsReplaced,
    itemsReplacedEquivalent,
    itemsReplacedPartial,
    itemsTotal,
    deviationLabels,
  };
}

/**
 * Total d'exercices de la séance = DÉNOMINATEUR du pourcentage. Lecture
 * défensive, dans l'ordre : un total explicite s'il existe, sinon la longueur de
 * la liste d'items.
 *
 * Une liste VIDE ne produit jamais `0` : un total de 0 serait un dénominateur
 * impossible (le pourcentage annoncé ne pourrait pas en venir), donc un chiffre
 * faux affiché au coach. Dans ce cas on renvoie `null` = "total inconnu".
 */
function readItemsTotal(execution: RawDoc, completion: RawDoc): number | null {
  const explicite = num(completion.total) ?? num(completion.itemsTotal) ?? num(execution.total);
  if (explicite !== null) {
    const borne = boundItemCount(explicite);
    if (borne !== null && borne > 0) return borne;
  }
  const items = Array.isArray(execution.items) ? execution.items.length : null;
  if (items === null || items <= 0) return null;
  return boundItemCount(items);
}

/**
 * Extrait UNIQUEMENT les tokens de raison (jamais `comment`, `actual`, `snapshot`),
 * et UNIQUEMENT les raisons NON sensibles.
 *
 * ⚠️ LE FILTRAGE A LIEU ICI, AVANT LA DÉCISION « mainReasons ou repli sur items ».
 * Ce n'est pas un détail d'implémentation, c'est ce qui ferme un canal réel,
 * trouvé par la sonde hostile : la boucle classe `mainReasons` par poids, donc
 * une douleur DOMINANTE occupait la liste et empêchait le repli sur les items.
 * Résultat, `mainReasons = ["pain"]` donnait une liste de raisons VIDE là où
 * `mainReasons = ["time"]`, sur exactement les mêmes items, donnait « Manque de
 * temps » : le vide désignait la douleur. En filtrant d'abord, les trois cas
 * (`["pain"]`, `["pain","time"]`, `[]`) convergent vers la même sortie.
 *
 * Rappel du contrat : une liste vide signifie « raisons non calculées » (et non
 * « aucun écart ») → on relit les items, eux aussi filtrés.
 */
function readDeviationReasons(execution: RawDoc): string[] {
  const main = obj(execution.completion).mainReasons;
  if (Array.isArray(main)) {
    const principales = main.filter((r): r is string => typeof r === "string" && !isSensitiveDeviationReason(r));
    if (principales.length) return principales;
  }

  const items = Array.isArray(execution.items) ? execution.items : [];
  const out: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const reason = (item as RawDoc).reason;
    if (typeof reason !== "string" || !reason.trim()) continue;
    if (isSensitiveDeviationReason(reason)) continue;
    out.push(reason);
  }
  return out;
}

/**
 * Projette un joueur en `CoachPlayerSummaryCore`, ou `null` si le membre ne doit
 * pas apparaître (non-player, club incohérent, membership absent, ou accès non
 * autorisé).
 *
 * `null` n'est jamais un "on saute" silencieux : l'appelant (`rebuildPlayerSummary`)
 * SUPPRIME la projection existante. C'est ce qui fait qu'un passage en "revoked"
 * retire réellement la donnée déjà projetée, au lieu de la laisser traîner.
 */
export function projectPlayerSummary(input: ProjectorInput): CoachPlayerSummaryCore | null {
  const { playerUid, clubId, membership, profile, sessions, plannedSessions } = input;

  // 1) Membership requis + STATUT DE JOUEUR ACTIF, strictement.
  //
  // C'est le STATUT qui decide, jamais les permissions d'encadrement : un
  // entraineur-joueur (`accessRole: "coach"` ET `playerStatus: "active"`) doit
  // apparaitre dans l'effectif suivi comme n'importe quel joueur. C'est le but
  // du modele a deux axes (cf. clubAuthority.ts) — et ca n'ouvre RIEN d'autre :
  // sa fiche reste soumise a `coachAccess` (juste en dessous) et aux memes
  // regles Firestore que celle de tout le monde.
  //
  // C'est aussi ce qui rend le RETRAIT d'un membre insensible aux courses : le
  // retrait pose une pierre tombale (`playerStatus: "inactive"`, cf.
  // clubMembers.ts), et toute reprojection ulterieure — declenchee par une
  // seance que le joueur continue d'enregistrer — relit ce statut, renvoie
  // `null`, donc SUPPRIME la projection au lieu de la recreer. Le refus vient de
  // l'ETAT, pas de l'ordre d'arrivee des evenements.
  if (!isActivePlayer(membership)) return null;

  // 1 bis) AUTORISATION D'ACCÈS (default-deny). Deuxième couche de verrou, la
  // première étant les règles Firestore. On la met AVANT toute lecture du profil
  // ou des séances : rien de ce joueur n'est même calculé tant que l'état n'est
  // pas autorisant. Un membership ANCIEN, sans le champ, ne passe pas.
  if (!isMembershipCoachAccessGranted(membership)) return null;

  // 2) Cohérence membership/profil (P0.3) : le profil DOIT exister et pointer
  //    vers CE club. Sinon aucune projection (l'appelant supprime).
  //
  //    L'ANCIENNE CONDITION `profile.role === "coach"` A ÉTÉ RETIRÉE, et il faut
  //    dire pourquoi plutôt que de la faire disparaître :
  //     . elle lisait `users/{uid}.role`, un champ que son titulaire ÉCRIT
  //       LUI-MÊME (firestore.rules autorise chacun à écrire tout son document
  //       `users/{uid}`). Un champ falsifiable ne protège rien : il ne pouvait
  //       qu'exclure quelqu'un, jamais empêcher une fuite ;
  //     . elle EMPÊCHAIT désormais la fonctionnalité. Un entraîneur-joueur dont
  //       le profil porte encore ce résidu (`role: "coach"`, posé par une
  //       ancienne version de l'app) aurait été silencieusement retiré de
  //       l'effectif suivi, sans qu'aucun écran ne puisse l'expliquer.
  //    Ce qui décide reste ce que le serveur contrôle seul : `playerStatus`
  //    (ci-dessus) et `coachAccess`.
  if (!profile) return null;
  if (str(profile.clubId) !== clubId) return null;

  // 3) Identité sportive — allowlists serveur strictes (jamais de texte client brut).
  const firstName = sanitizeFirstName(profile.firstName);
  const ageCategory = normalizeAgeCategory(profile.ageCategory);
  const position = normalizePosition(profile.position);
  const level = normalizeLevel(profile.level);
  const profileComplete = !!(profile.profileCompleted === true && firstName);

  // 4) Sélection séance à afficher (mêmes règles que le front).
  const latestPlannedDoc = pickLatest(plannedSessions);
  const latestCompletedDoc = pickLatest(sessions);
  const plannedCand = latestPlannedDoc ? projectPlanned(latestPlannedDoc) : null;
  const completedCand = latestCompletedDoc ? projectCompleted(latestCompletedDoc) : null;

  const chosen = pickCoachSessionToDisplay<SessionCandidate>(plannedCand, completedCand);

  const latestSession = chosen ? toLatestSession(chosen) : null;
  const adaptationLabels = chosen ? toCoachAdaptationLabels(chosen.__tokens) : [];

  // 5) Dernière activité = dernière séance RÉELLEMENT faite (jamais de RPE).
  const lastActivity = completedCand
    ? { dateKey: completedCand.dateKey, durationMin: completedCand.durationMin }
    : null;

  // 6) Extension v2 — prévu ET fait coexistent (le coach doit pouvoir comparer),
  //    plus les dates d'activité brutes et l'exécution réelle si elle existe.
  //    `latestSession` reste tel quel : les lecteurs déjà déployés continuent.
  const activity = projectActivity(sessions);
  const lastPlanned = plannedCand ? toSessionRef(plannedCand) : null;
  const lastDone = completedCand ? toSessionRef(completedCand) : null;
  const execution = projectExecution(latestCompletedDoc);

  return {
    playerUid,
    firstName,
    ageCategory,
    position,
    level,
    profileComplete,
    latestSession,
    lastActivity,
    adaptation: { adapted: adaptationLabels.length > 0, labels: adaptationLabels },
    activity,
    lastPlanned,
    lastDone,
    execution,
  };
}
