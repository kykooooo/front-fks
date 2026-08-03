// src/services/aiContext.ts
import { getAuth } from "firebase/auth";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { useLoadStore } from "../state/stores/useLoadStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import { useFeedbackStore } from "../state/stores/useFeedbackStore";
import { toDateKey } from "../utils/dateHelpers";
import type { Session, AgeCategory } from "../domain/types";
import { normalizeAgeCategory, normalizeTeamGender } from "../domain/types";
import { canonicalizeMicrocycleGoal } from "../domain/microcycles";
import { CLUB_DIRECTIVES_COLLECTION, CLUB_DIRECTIVE_CURRENT_ID } from "../domain/clubDirective";
import { userProfileSchema, logValidationIssues } from "../schemas/firestoreSchemas";
import { weekKeyOf } from "../utils/dateHelpers";
import { readTestsRaw } from "../screens/tests/hooks/useTestsStorage";
import { resolveTrackingModes } from "../domain/tracking/modes";
import { applyDecisionToContext } from "../domain/tracking/apply";
import { TRACKING_CONFIG } from "../domain/tracking/config";
import { useExecutionStore } from "../state/stores/useExecutionStore";
// trackEvent est importé dynamiquement plus bas (jamais en top-level ici) :
// services/analytics.ts entraîne @amplitude/analytics-react-native, qui
// embarque sa PROPRE copie imbriquée de @react-native-async-storage/async-storage
// -- jest.setup.js ne mocke que la copie racine, pas cette copie imbriquée.
// Un import statique planterait tout test import buildAIPromptContext, même
// quand le mode Application est OFF (défaut). Le require différé ne s'exécute
// que si applied.length > 0, donc jamais tant que apply=false (défaut pilote).
import {
  RECENT_FKS_COPY_LIMIT,
  RECENT_FKS_SESSION_LIMIT,
  buildRecentByFocus,
  buildRecentFksSessionsPayload,
  buildClubContextPayload,
  buildFieldTestsPayload,
  collectActivePainConstraints,
  type ClubContextPayload,
  type FKS_FieldTestEntry,
} from "./aiContextHelpers";

// Reexport public API (le code applicatif importe depuis "./aiContext").
export type {
  FKS_PhaseId,
  FKS_SessionFocus,
  FKS_IntensityLevel,
  FKS_RecentSessionSummary,
  FKS_FieldTestEntry,
} from "./aiContextHelpers";
export {
  RECENT_FKS_SESSION_LIMIT,
  RECENT_FKS_COPY_LIMIT,
  normalizeFeedbackPainForBackend,
  readSessionMetrics,
  readSessionRpeTarget,
  readSessionArchetypeId,
  readSessionCycle,
  buildRecentFeedbackPayload,
  buildRecentFksSessionSummary,
  buildRecentFksSessionsPayload,
  buildFieldTestsPayload,
  toFksIntensity,
  toFksFocus,
  focusFromExercises,
  inferStrengthRegion,
} from "./aiContextHelpers";

import type { FKS_PhaseId, FKS_RecentSessionSummary } from "./aiContextHelpers";

// Contexte global envoyé à l'IA
export interface FKS_AiContext {
  version: "fks_context_v1";
  profile: {
    first_name: string | null;
    level: string | null;
    position: string | null;
    dominant_foot: string | null;
    age_category: AgeCategory | null;
    club_trainings_per_week: number;
    matches_per_week: number;
    target_fks_sessions_per_week: number | null;
    main_objective: string | null;
    club_training_days?: string[];
    match_days?: string[];
    goal?: string | null;
    program_goal?: string | null;
    microcycle_goal?: string | null;
    explosivite_playlist_len?: number | null;
  };
  goal?: string | null;
  available_time_min?: number | null;
  nowISO?: string;
  devNowISO?: string | null;
  phase: FKS_PhaseId;
  microcycle?: { session_index: number };
  constraints?: {
    equipment?: string[];
    pains?: string[];
    /** Sévérité max des blessures actives (1..3) — lu par le backend (caps injury). Absent si aucune. */
    injury_max_severity?: number;
    /** Dev only : bypass du cap fatigue (ignoré par le backend en production). */
    ignore_fatigue_cap?: boolean;
  };
  metrics: {
    atl: number;
    ctl: number;
    tsb: number;
  };
  recent_fks_sessions: FKS_RecentSessionSummary[];
  recent_fks_summary_text?: string;
  recent_fks_badges?: string[];
  recent_by_focus?: Record<string, string[]>;
  equipment_available: string[];
  club_context?: ClubContextPayload | null;
  /** Tests terrain recents (derniere valeur par type, <= 90 j). Absent si aucun test valide. */
  field_tests?: FKS_FieldTestEntry[];
}

// Helper : fusionner le matos de salle + maison en une seule liste
function buildEquipmentFromProfile(profile: Record<string, unknown>): string[] {
  const result: string[] = [];

  if (Array.isArray(profile.gymEquipment)) {
    result.push(...profile.gymEquipment);
  }
  if (Array.isArray(profile.homeEquipment)) {
    result.push(...profile.homeEquipment);
  }

  // Exemple : si accès salle, tu peux ajouter un flag générique
  // (optionnel pour l'instant)
  if (profile.hasGymAccess && profile.hasGymAccess !== "none") {
    result.push("gym_access");
  }

  // on supprime les doublons
  return Array.from(new Set(result));
}

// ⚙️ Fonction principale : construit le contexte pour l'IA
export async function buildAIPromptContext(): Promise<FKS_AiContext> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Utilisateur non connecté, impossible de construire le contexte IA.");
  }

  // 1) Récup profil Firestore (validé par Zod)
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const rawProfile = snap.data() ?? {};
  const profileParsed = userProfileSchema.safeParse(rawProfile);
  if (!profileParsed.success) {
    logValidationIssues("userProfile (aiContext)", user.uid, profileParsed.error.issues);
  }
  const data = profileParsed.success ? profileParsed.data : userProfileSchema.parse({});

  const firstName = data.firstName?.trim() ?? null;
  const level = data.level ?? null;
  const position = data.position ?? null;
  const dominantFoot = data.dominantFoot ?? null;
  const mainObjective = data.mainObjective ?? null;
  const loadState = useLoadStore.getState();
  const sessionsState = useSessionsStore.getState();
  const ignoreFatigueCap = Boolean(loadState.ignoreFatigueCap);

  const storeGoal =
    typeof sessionsState.microcycleGoal === "string"
      ? sessionsState.microcycleGoal.trim()
      : "";
  const dataGoal = (data.microcycleGoal ?? "").trim();
  const resolvedGoal = storeGoal || dataGoal;
  // Remap des anciens cycles (explosif/rsa/offseason) avant envoi backend : on ne transmet
  // jamais un cycle supprimé, même si Firestore contient une valeur legacy non encore migrée.
  const microcycleGoal = canonicalizeMicrocycleGoal(resolvedGoal) ?? "fondation";
  const microcycleSessionIndex =
    typeof sessionsState.microcycleSessionIndex === "number" && Number.isFinite(sessionsState.microcycleSessionIndex)
      ? sessionsState.microcycleSessionIndex
      : 0;
  const availableTimeMin = data.available_time_min ?? data.availableTimeMin ?? null;
  const explosivitePlaylistLenRaw = data.explosivite_playlist_len ?? data.explosivitePlaylistLen ?? null;
  const explosivitePlaylistLen =
    explosivitePlaylistLenRaw === 8 || explosivitePlaylistLenRaw === 12
      ? explosivitePlaylistLenRaw
      : null;
  // Ne PAS appeler setMicrocycleGoal ici : buildAIPromptContext est une
  // fonction de lecture. L'appel provoquait un reset de microcycleSessionIndex
  // à chaque génération quand le goal différait (casse, fallback, etc.).
  const clubTrainingDays = data.clubTrainingDays;
  const matchDay = data.matchDay ?? null;
  const matchDays = data.matchDays.length > 0 ? data.matchDays : matchDay ? [matchDay] : [];

  const clubTrainingsPerWeek = data.clubTrainingsPerWeek;
  const matchesPerWeek = data.matchesPerWeek;
  const targetFksSessionsPerWeek = data.targetFksSessionsPerWeek ?? null;

  const equipment_available = buildEquipmentFromProfile(data as Record<string, unknown>);

  const debugState = useDebugStore.getState();
  const feedbackState = useFeedbackStore.getState();
  const nowISO = debugState.devNowISO ?? new Date().toISOString();
  const todayKey = toDateKey(nowISO);
  // Blessures déclarées au feedback (dayStates.injury) → tokens backend.
  // Fenêtre glissante 7 jours : une blessure déclarée hier contraint encore
  // aujourd'hui (voir collectActivePainConstraints dans aiContextHelpers).
  const { pains, injuryMaxSeverity } = collectActivePainConstraints(
    feedbackState.dayStates,
    todayKey
  );

  // Contexte de semaine club (FKS Club) : si le joueur a un clubId, on lit le
  // weekContext de la semaine courante. Lecture best-effort : toute erreur est
  // loggée en dev mais ne bloque jamais la génération (fallback silencieux).
  //
  // LA NOTE DU COACH N'ENTRE PLUS ICI. Elle est devenue privée (document
  // coach-only, cf. domain/clubCoachNote.ts) et n'est ni lue ni envoyée : une
  // note écrite pour le staff ne doit pas modifier la séance d'un joueur. Ce
  // qui aura le droit de peser sur la préparation est désormais un objet dédié
  // — la DIRECTIVE — lue ci-dessous, et que le joueur peut lire lui aussi.
  // Elle est transmise ; elle n'est PAS encore appliquée par le moteur
  // (cf. domain/clubDirective.ts) — aucun écran ne prétend le contraire.
  let clubContext: ClubContextPayload | null = null;
  const clubId = typeof (rawProfile as any)?.clubId === "string" ? (rawProfile as any).clubId.trim() : "";
  if (clubId) {
    try {
      const weekKey = weekKeyOf(nowISO);
      // weekContext (intensité/objectif) + teamGender (club doc) + directive.
      const [wcSnap, clubSnap, directiveSnap] = await Promise.all([
        getDoc(doc(db, "clubs", clubId, "weekContexts", weekKey)),
        getDoc(doc(db, "clubs", clubId)),
        getDoc(doc(db, "clubs", clubId, CLUB_DIRECTIVES_COLLECTION, CLUB_DIRECTIVE_CURRENT_ID)),
      ]);
      const directiveRaw = directiveSnap.exists()
        ? (directiveSnap.data() as Record<string, unknown>)
        : null;
      const base = buildClubContextPayload(
        wcSnap.exists() ? (wcSnap.data() as Record<string, unknown>) : null,
        weekKey,
        // La fenêtre de validité est évaluée avec le JOUR du joueur (horloge
        // virtuelle comprise en dev) : une directive expirée ne part pas.
        { directive: directiveRaw, todayKey },
      );
      const teamGender = clubSnap.exists() ? normalizeTeamGender((clubSnap.data() as any)?.teamGender) : null;
      if (base || teamGender) {
        clubContext = {
          ...(base ?? {}),
          ...(teamGender ? { team_gender: teamGender } : {}),
        };
      }
    } catch (err) {
      if (__DEV__) console.warn("[aiContext] lecture contexte club échouée:", err);
    }
  }

  // 2) Récup état charge / phase depuis ton store FKS
  const phase: FKS_PhaseId =
    (sessionsState.phase as FKS_PhaseId) ?? "playlist";

  const atl = typeof loadState.atl === "number" ? loadState.atl : 0;
  const ctl = typeof loadState.ctl === "number" ? loadState.ctl : 0;
  const tsb = typeof loadState.tsb === "number" ? loadState.tsb : 0;

  // 3) Séances récentes FKS (on prend les plus récentes du store).
  // Le tri des séances artificielles est fait à la frontière du payload,
  // dans aiContextHelpers (buildRecentFksSessionsPayload / buildRecentByFocus).
  const sessions: Session[] = Array.isArray(sessionsState.sessions)
    ? [...sessionsState.sessions]
    : [];
  sessions.sort((a, b) => {
    const da = new Date(a?.dateISO ?? a?.date ?? 0).getTime();
    const dbTime = new Date(b?.dateISO ?? b?.date ?? 0).getTime();
    return dbTime - da;
  });

  const recent_fks_sessions: FKS_RecentSessionSummary[] = buildRecentFksSessionsPayload(
    sessions,
    phase,
    RECENT_FKS_SESSION_LIMIT
  );

  // Tests terrain (AsyncStorage, hors-hook) -> field_tests. Best-effort : une
  // erreur de lecture/parse ne doit jamais bloquer la generation de seance.
  let field_tests: FKS_FieldTestEntry[] = [];
  try {
    const rawTests = await readTestsRaw();
    if (rawTests) {
      const parsedTests = JSON.parse(rawTests);
      const referenceNowMs = debugState.devNowISO
        ? new Date(debugState.devNowISO).getTime()
        : Date.now();
      field_tests = buildFieldTestsPayload(parsedTests, referenceNowMs);
    }
  } catch (err) {
    if (__DEV__) console.warn("[aiContext] lecture tests terrain échouée:", err);
  }

  const recent_fks_badges = Array.from(
    new Set(
      recent_fks_sessions
        .slice(0, RECENT_FKS_COPY_LIMIT)
        .flatMap((s) => {
          const focusBadge = s.focus_primary ? [`focus:${s.focus_primary}`] : [];
          const combo =
            s.focus_primary && s.intensity
              ? [`focus_intensity:${s.focus_primary}:${s.intensity}`]
              : [];
          const strengthDetail =
            s.strength_region && s.focus_primary === "strength"
              ? [`focus_strength:${s.strength_region}`]
              : [];
          return [...focusBadge, ...combo, ...strengthDetail];
        })
    )
  );

  // Condensé narratif des 3 dernières séances pour varier l'IA
  const summarySessions = recent_fks_sessions.slice(0, RECENT_FKS_COPY_LIMIT);
  const recent_fks_summary_text =
    summarySessions.length > 0
      ? summarySessions
          .map(
            (s) =>
              `${s.date || "date inconnue"} · ${s.focus_primary} · ${s.intensity}${
                s.rpe ? ` · RPE ${s.rpe}` : ""
              }${s.duration_min ? ` · ${s.duration_min} min` : ""}`
          )
          .join(" | ")
      : undefined;

  let context: FKS_AiContext = {
    version: "fks_context_v1",
    profile: {
      first_name: firstName,
      level,
      position,
      dominant_foot: dominantFoot,
      age_category: normalizeAgeCategory(data.ageCategory),
      club_trainings_per_week: clubTrainingsPerWeek,
      matches_per_week: matchesPerWeek,
      target_fks_sessions_per_week: targetFksSessionsPerWeek,
      main_objective: mainObjective,
      club_training_days: clubTrainingDays,
      match_days: matchDays,
      goal: microcycleGoal,
      program_goal: microcycleGoal,
      microcycle_goal: microcycleGoal,
      explosivite_playlist_len: explosivitePlaylistLen,
    },
    goal: microcycleGoal,
    available_time_min: availableTimeMin,
    nowISO,
    devNowISO: debugState.devNowISO ?? null,
    constraints: {
      equipment: equipment_available,
      pains,
      ...(injuryMaxSeverity > 0 ? { injury_max_severity: injuryMaxSeverity } : {}),
      ...(ignoreFatigueCap ? { ignore_fatigue_cap: true } : {}),
    },
    phase,
    microcycle: { session_index: microcycleSessionIndex },
    metrics: {
      atl,
      ctl,
      tsb,
    },
    recent_fks_sessions,
    recent_fks_summary_text,
    recent_fks_badges,
    recent_by_focus: buildRecentByFocus(sessions, 3),
    equipment_available,
    ...(clubContext ? { club_context: clubContext } : {}),
    ...(field_tests.length > 0 ? { field_tests } : {}),
  };

  // ---- Boucle de suivi joueur : mode Application (OFF par défaut, cf. Lot 6) ----
  // POINT D'INTÉGRATION UNIQUE (voir docs/boucle-suivi-2026-07-25/COHABITATION_AGENT_85.md
  // section "Points d'intégration"). rawProfile est le doc BRUT (pré-Zod, avant
  // la ligne 138 plus haut) : seul canal portant users/{uid}.trackingConfig.
  // Choix documenté : `previousDecisions: []` plutôt que `[lastDecision]`.
  // useExecutionStore ne persiste qu'UNE seule décision (`lastDecision`), pas un
  // historique de décisions successives ; passer lastDecision comme sa propre
  // "décision précédente" ferait déclencher à tort la branche "persistant sur
  // >= 2 fenêtres" de reduce_intensity_light dès le tout premier calcul (cf.
  // REGLES_AJUSTEMENT.md section "Mode Application"). Sans historique réel de
  // décisions, le passage prudent (branche 1er déclenchement, no-op tracé) est
  // le seul honnête.
  const trackingModes = resolveTrackingModes(rawProfile as Record<string, unknown>);
  const lastTrackingDecision = trackingModes.apply ? useExecutionStore.getState().lastDecision : null;
  if (lastTrackingDecision) {
    const { context: adjustedContext, applied } = applyDecisionToContext(
      context,
      lastTrackingDecision,
      TRACKING_CONFIG,
      undefined,
      { previousDecisions: [] }
    );
    if (applied.length > 0) {
      // require() différé (même pattern que state/migration/migrateFromLegacy.ts
      // pour @sentry/react-native) : voir la note plus haut -- jamais de coût
      // @amplitude quand le mode Application est OFF, càd quasi toujours au pilote.
      const { trackEvent } = require("./analytics");
      trackEvent("tracking_apply_adjustments", { applied });
    }
    context = adjustedContext;
  }

  // debug: stocke le contexte pour inspection (post-ajustement : reflète ce qui part réellement)
  useSessionsStore.getState().setLastAiContext?.(context);

  return context;
}
