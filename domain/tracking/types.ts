// domain/tracking/types.ts
// Types de la boucle de suivi (contrat inter-lots). Source de verite : voir
// docs/boucle-suivi-2026-07-25/MODELE_DONNEES.md — toute evolution passe par
// le chef de chantier, ne pas modifier ces signatures dans un autre lot.

// ----------------------------------------------------------------------------
// Prescription figee (au lancement de seance)
// ----------------------------------------------------------------------------

export type PrescribedItem = {
  key: string; // `${blockIndex}-${itemIndex}` (aligne getItemKey de SessionLive)
  exerciseId: string; // id stable banque (ou id fabrique par transform.ts, accepte tel quel)
  name: string;
  blockId: string;
  blockIndex: number;
  itemIndex: number;
  blockType: string | null; // type du bloc v2 (run|strength|...)
  role: "primary" | "secondary" | null; // item.role du v2 si present
  sets: number | null;
  reps: number | string | null;
  workS: number | null;
  restS: number | null;
  durationMin: number | null;
  notes: string | null; // porte la consigne de charge en texte (pas de kg structure cote backend)
};

export type PrescribedSnapshot = {
  sessionId: string;
  fingerprint: string; // hash djb2 des champs prescriptifs du v2
  generatedAtISO: string | null; // createdAt de la seance si connu
  launchedAtISO: string;
  cycleGoal: string | null; // microcycleGoal canonique
  sessionIndex: number | null; // 0-11
  phase: string | null; // phase de volume/periodisation si connue
  matchContext:
    | "match_today"
    | "match_tomorrow"
    | "match_in_two_days"
    | "match_yesterday"
    | "none"
    | "unknown";
  plannedDurationMin: number | null;
  rpeTarget: number | null;
  intensity: string | null;
  focusPrimary: string | null;
  items: PrescribedItem[]; // ordre = ordre des blocs/items du v2
};

// ----------------------------------------------------------------------------
// Realise
// ----------------------------------------------------------------------------

export type ItemStatus = "done" | "adapted" | "skipped" | "replaced" | "unknown";

export type DeviationReason =
  | "time"
  | "equipment"
  | "too_difficult"
  | "fatigue"
  | "pain"
  | "technical"
  | "space"
  | "no_partner"
  | "other";

export type ActualValues = {
  loadKg?: number; // exercice charge
  reps?: number; // total ou par serie selon saisie, libre
  distanceM?: number; // sprints
  durationS?: number; // exercices chronometres
  setsDone?: number;
};

export type ItemExecution = {
  key: string; // = PrescribedItem.key
  status: ItemStatus;
  reason: DeviationReason | null; // requis si adapted/skipped/replaced
  comment: string | null; // court, facultatif
  actual: ActualValues | null; // facultatif
  replacement: {
    originalExerciseId: string;
    replacementExerciseId: string;
    reason: DeviationReason;
    equivalent: boolean; // true = equivalence sportive validee par le registre
    prescription: {
      sets: number | null;
      reps: number | string | null;
      durationS: number | null;
      restS: number | null;
      note: string | null;
    };
  } | null;
  setsChecked: number; // reprend checkedSets (compat execution par series)
  setsTotal: number;
};

export type SessionExecution = {
  version: 1;
  sessionId: string;
  fingerprint: string; // = snapshot.fingerprint (lien prescrit <-> realise)
  snapshot: PrescribedSnapshot; // photographie complete, immuable apres finish
  items: ItemExecution[];
  startedAtISO: string;
  finishedAtISO: string | null;
  actualDurationMin: number | null; // chrono live si significatif
  allAsPlanned: boolean; // action rapide "tout comme prevu"
  completion: {
    pct: number; // 0-100, calcul unique dans execution.ts
    done: number;
    adapted: number;
    skipped: number;
    replacedEquivalent: number;
    replacedPartial: number;
    status: "full" | "partial" | "abandoned";
    mainReasons: DeviationReason[]; // raisons dominantes des ecarts (max 3)
  };
};

// ----------------------------------------------------------------------------
// Feedback enrichi (extension de SessionFeedback, champs OPTIONNELS)
// domain/types.ts -- ajout additif futur (hors perimetre de ce lot) :
//   executionSummary?: {
//     completionPct: number; completionStatus: "full" | "partial" | "abandoned";
//     done: number; adapted: number; skipped: number; replaced: number;
//     mainReasons: DeviationReason[]; fingerprint: string;
//   }
// (la duree reelle reste feedback.durationMin -- pas de doublon)
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Signaux
// ----------------------------------------------------------------------------

export type TrackingSignals = {
  dataQuality: "ok" | "insufficient" | "inconsistent";
  sessionsAnalyzed: number; // executions exploitables (fenetre config)
  completionRateAvg: number | null; // moyenne pct
  rpeDeltaAvg: number | null; // moyenne (rpe reel - rpe cible), >= minSessions requis
  rpeDeltaCount: number;
  durationRatioAvg: number | null; // reel / prevu
  timeConstrainedIncomplete: boolean; // seances incompletes dont raison dominante = time
  painSignal: { active: boolean; source: "feedback" | "replacement" | "injury" | null; occurrences: number };
  repeatedDifficulty: { exerciseIds: string[]; families: string[] }; // >= seuil too_difficult
  durableEquipmentIssues: string[]; // exerciseIds remplaces >= seuil pour equipment
  gapDays: number | null; // depuis derniere seance TERMINEE (completion >= seuil)
  streakOkSessions: number; // seances consecutives reussies (completion + rpe proche)
};

// ----------------------------------------------------------------------------
// Decision
// ----------------------------------------------------------------------------

export type TrackingDecisionKind =
  | "continue_planned" // poursuivre la progression prevue
  | "hold_dose" // maintenir
  | "reduce_volume_light" // reduire legerement le volume
  | "reduce_intensity_light" // reduire legerement l'intensite
  | "suggest_variant" // variante plus accessible (exercices cibles)
  | "prefer_replacement" // materiel durablement indisponible -> variante compatible
  | "resume_mode" // reprise/fondations temporaire
  | "keep_despite_time" // trajectoire conservee malgre incompletude par manque de temps
  | "block_increase_pain" // douleur : aucune augmentation
  | "standard_insufficient_data";

export type TrackingDecision = {
  version: 1;
  rulesVersion: string; // ex. "tracking-rules/1.0.0"
  decidedAtISO: string;
  kind: TrackingDecisionKind;
  targets: string[]; // exerciseIds concernes (variant/replacement), sinon []
  explanation: string; // FR, construite depuis les signaux reels
  signalsDigest: {
    // trace compacte pour audit/observabilite
    completionRateAvg: number | null;
    rpeDeltaAvg: number | null;
    painActive: boolean;
    gapDays: number | null;
    dataQuality: string;
  };
  mode: "shadow" | "applied"; // pilote : toujours "shadow"
};

// ----------------------------------------------------------------------------
// Remplacements
// ----------------------------------------------------------------------------

export type ReplacementEntry = {
  altExerciseId: string;
  reasonsAllowed: DeviationReason[]; // pourquoi cette alternative est proposable
  preservedQuality: string; // ex. "unilateral_lower_strength"
  equipmentRequired: string[]; // [] = poids du corps
  relativeDifficulty: "easier" | "similar";
  prescriptionAdapter: {
    setsDelta?: number;
    repsFactor?: number;
    durationFactor?: number;
    restDelta?: number;
    note?: string;
  };
  minAge: "U13" | "U15" | "U17" | "U18" | "Senior" | null; // null = tous
  painSafe: boolean; // false -> jamais propose sur raison douleur
  soloOk: boolean;
  compactSpaceOk: boolean;
};

export type ReplacementRequest = {
  exerciseId: string;
  reason: DeviationReason;
  context: {
    equipmentAvailable: string[];
    ageCategory: string | null;
    activePains: string[]; // tokens backend (injuryMapping)
    matchSoon: boolean; // J-1/J-2
    highFatigue: boolean; // tsb tres negatif
    solo: boolean;
    excludeIds: string[]; // deja proposes (anti-boucle)
  };
};

export type ReplacementProposal = {
  exerciseId: string; // l'alternative
  name: string;
  shortWhy: string; // "Meme travail unilateral des jambes, sans materiel."
  prescription: {
    sets: number | null;
    reps: number | string | null;
    durationS: number | null;
    restS: number | null;
    note: string | null;
  };
  equivalent: boolean; // false = adaptation sans equivalence complete (affiche honnetement)
  source: "registry" | "rule";
};
