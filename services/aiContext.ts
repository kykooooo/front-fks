// src/services/aiContext.ts
import { getAuth } from "firebase/auth";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { useTrainingStore } from "../state/trainingStore";

// Phases FKS
export type FKS_PhaseId = "playlist" | "construction" | "progression" | "performance" | "deload";

// Focus et intensité (on les garde déjà ici pour l’IA)
export type FKS_SessionFocus =
  | "run"
  | "strength"
  | "speed"
  | "circuit"
  | "plyo"
  | "mobility";

export type FKS_IntensityLevel = "easy" | "moderate" | "hard";

// Résumé d’une séance FKS pour l’IA (on le définit maintenant,
// mais on le remplira plus tard, quand tu auras des séances)
export interface FKS_RecentSessionSummary {
  date: string; // "2025-11-25"
  date_relative: string; // "hier", "il y a 3 jours" (optionnel, on peut mettre "" au début)
  label: string; // "Séance FKS circuit full body"

  phase: FKS_PhaseId;
  focus_primary: FKS_SessionFocus;
  focus_secondary?: FKS_SessionFocus | null;
  strength_region?: "upper" | "lower" | "both" | string;

  intensity: FKS_IntensityLevel;
  rpe: number;
  duration_min: number;

  // On garde le reste pour la suite, mais tu peux commencer minimal
  pain_level_after?: number;
  soreness_zones_after?: string[];
  perceived_difficulty?: "trop_facile" | "ok" | "très_dur";
  completed_as_planned?: boolean;
}

// Contexte global envoyé à l’IA
export interface FKS_AiContext {
  version: "fks_context_v1";
  profile: {
    first_name: string | null;
    level: string | null;
    position: string | null;
    dominant_foot: string | null;
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
}

// Normalise l’intensité appli (store) → enum IA
function toFksIntensity(x: any): FKS_IntensityLevel {
  const k = String(x || "").toLowerCase();
  if (k.includes("hard") || k.includes("max")) return "hard";
  if (k.includes("mod")) return "moderate";
  return "easy";
}

// Normalise la modalité principale → focus IA
function toFksFocus(modality: any): FKS_SessionFocus {
  const k = String(modality || "").toLowerCase();
  if (["strength", "force", "muscu"].some((t) => k.includes(t))) return "strength";
  if (["speed", "vma", "sprint"].some((t) => k.includes(t))) return "speed";
  if (["circuit", "core", "wod"].some((t) => k.includes(t))) return "circuit";
  if (["plyo"].some((t) => k.includes(t))) return "plyo";
  if (["mobility", "mobilite", "stretch"].some((t) => k.includes(t))) return "mobility";
  return "run";
}

function focusFromExercises(session: any): { primary: FKS_SessionFocus; secondary: FKS_SessionFocus | null } {
  const exos: any[] = Array.isArray(session?.exercises) ? session.exercises : [];
  if (!exos.length) {
    const f = toFksFocus(session?.focus ?? session?.modality);
    return { primary: f, secondary: null };
  }

  const tally = new Map<FKS_SessionFocus, number>();
  exos.forEach((e) => {
    const mod = toFksFocus(e?.modality ?? e?.focus);
    const weight =
      typeof e?.durationSec === "number" && Number.isFinite(e.durationSec)
        ? e.durationSec / 60
        : typeof e?.sets === "number" && Number.isFinite(e.sets)
          ? e.sets
          : 1;
    tally.set(mod, (tally.get(mod) ?? 0) + weight);
  });

  const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
  const primary = sorted[0]?.[0] ?? toFksFocus(session?.focus ?? session?.modality);
  const secondary = sorted[1]?.[0] ?? null;
  return { primary, secondary };
}

function inferStrengthRegion(exercises: any[]): "upper" | "lower" | "both" | null {
  const lowerKeys = ["squat", "hinge", "deadlift", "rdl", "split", "lunge", "hip", "glute", "ham", "posterior", "quad", "calf", "copenhagen"];
  const upperKeys = ["press", "row", "pull", "push", "bench", "shoulder", "overhead", "landmine", "curl", "triceps", "biceps"];
  let hasLower = false;
  let hasUpper = false;
  exercises.forEach((e) => {
    const name = `${e?.name ?? e?.id ?? ""}`.toLowerCase();
    if (lowerKeys.some((k) => name.includes(k))) hasLower = true;
    if (upperKeys.some((k) => name.includes(k))) hasUpper = true;
  });
  if (hasLower && hasUpper) return "both";
  if (hasLower) return "lower";
  if (hasUpper) return "upper";
  return null;
}

function buildRecentByFocus(sessions: any[], limit = 3): Record<string, string[]> {
  const res: Record<string, string[]> = {};
  const sorted = [...sessions].sort(
    (a, b) =>
      new Date(b?.dateISO ?? b?.date ?? 0).getTime() -
      new Date(a?.dateISO ?? a?.date ?? 0).getTime()
  );
  sorted.forEach((s) => {
    const exos: any[] = Array.isArray((s as any)?.exercises) ? (s as any).exercises : [];
    const focus = toFksFocus(s?.focus ?? s?.modality);
    if (!exos.length) return;
    res[focus] = res[focus] ?? [];
    for (const e of exos) {
      const name = (e?.name ?? e?.id ?? "").toString().trim();
      if (!name || res[focus].includes(name)) continue;
      res[focus].push(name);
      if (res[focus].length >= limit) break;
    }
  });
  return res;
}

// Helper : fusionner le matos de salle + maison en une seule liste
function buildEquipmentFromProfile(profile: any): string[] {
  const result: string[] = [];

  if (Array.isArray(profile.gymEquipment)) {
    result.push(...profile.gymEquipment);
  }
  if (Array.isArray(profile.homeEquipment)) {
    result.push(...profile.homeEquipment);
  }

  // Exemple : si accès salle, tu peux ajouter un flag générique
  // (optionnel pour l’instant)
  if (profile.hasGymAccess && profile.hasGymAccess !== "none") {
    result.push("gym_access");
  }

  // on supprime les doublons
  return Array.from(new Set(result));
}

// ⚙️ Fonction principale : construis le contexte pour l’IA
export async function buildAIPromptContext(): Promise<FKS_AiContext> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Utilisateur non connecté, impossible de construire le contexte IA.");
  }

  // 1) Récup profil Firestore
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const data = snap.data() ?? {};

  const firstName = (data.firstName as string | undefined)?.trim() ?? null;
  const level = (data.level as string | undefined) ?? null;
  const position = (data.position as string | undefined) ?? null;
  const dominantFoot = (data.dominantFoot as string | undefined) ?? null;
  const mainObjective = (data.mainObjective as string | undefined) ?? null;
  const trainingState: any = useTrainingStore.getState();

  const storeGoal =
    typeof trainingState.microcycleGoal === "string"
      ? trainingState.microcycleGoal.trim()
      : "";
  const dataGoal = (
    (data.microcycleGoal as string | undefined) ??
    (data.programGoal as string | undefined) ??
    (data.goal as string | undefined) ??
    ""
  ).trim();
  const resolvedGoal = storeGoal || dataGoal;
  const microcycleGoal = resolvedGoal || "fondation";
  const microcycleSessionIndex =
    typeof trainingState.microcycleSessionIndex === "number" && Number.isFinite(trainingState.microcycleSessionIndex)
      ? trainingState.microcycleSessionIndex
      : 0;
  const availableTimeRaw =
    (data as any).available_time_min ??
    (data as any).availableTimeMin ??
    (trainingState as any).available_time_min ??
    (trainingState as any).availableTimeMin ??
    null;
  const availableTimeMin = (() => {
    const parsed =
      typeof availableTimeRaw === "number"
        ? availableTimeRaw
        : typeof availableTimeRaw === "string"
          ? Number(availableTimeRaw)
          : NaN;
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
  })();
  const explosivitePlaylistLenRaw =
    (data as any).explosivite_playlist_len ?? (data as any).explosivitePlaylistLen;
  const explosivitePlaylistLen = (() => {
    const parsed =
      typeof explosivitePlaylistLenRaw === "number"
        ? explosivitePlaylistLenRaw
        : typeof explosivitePlaylistLenRaw === "string"
          ? Number(explosivitePlaylistLenRaw)
          : NaN;
    const normalized = Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    if (normalized === 8 || normalized === 12) return normalized;
    return null;
  })();
  if (trainingState.setMicrocycleGoal && resolvedGoal) {
    trainingState.setMicrocycleGoal(microcycleGoal);
  }
  const clubTrainingDays = Array.isArray(data.clubTrainingDays) ? data.clubTrainingDays : [];
  const matchDay = typeof data.matchDay === "string" ? data.matchDay : null;
  const matchDays = Array.isArray(data.matchDays)
    ? data.matchDays
    : matchDay
    ? [matchDay]
    : [];

  const clubTrainingsPerWeek = Number(data.clubTrainingsPerWeek ?? 0);
  const matchesPerWeek = Number(data.matchesPerWeek ?? 0);
  const targetFksSessionsPerWeek = data.targetFksSessionsPerWeek
    ? Number(data.targetFksSessionsPerWeek)
    : null;

  const equipment_available = buildEquipmentFromProfile(data);

  const nowISO = trainingState.devNowISO ?? new Date().toISOString();
  const todayKey = nowISO.slice(0, 10);
  const pains: string[] =
    (trainingState.dayStates?.[todayKey]?.feedback?.pains as string[]) ??
    (trainingState.dayStates?.[todayKey]?.feedback?.painZones as string[]) ??
    [];

  // 2) Récup état charge / phase depuis ton store FKS
  const phase: FKS_PhaseId =
    (trainingState.currentPhase as FKS_PhaseId) ?? "playlist";

  const atl = typeof trainingState.atl === "number" ? trainingState.atl : 0;
  const ctl = typeof trainingState.ctl === "number" ? trainingState.ctl : 0;
  const tsb = typeof trainingState.tsb === "number" ? trainingState.tsb : 0;

  // 3) Séances récentes FKS (on prend les plus récentes du store)
  const sessions: any[] = Array.isArray(trainingState.sessions)
    ? [...trainingState.sessions]
    : [];
  sessions.sort((a, b) => {
    const da = new Date(a?.dateISO ?? a?.date ?? 0).getTime();
    const dbTime = new Date(b?.dateISO ?? b?.date ?? 0).getTime();
    return dbTime - da;
  });

  const recent_fks_sessions: FKS_RecentSessionSummary[] = sessions.slice(0, 5).map((s) => {
    const dateISO: string =
      typeof s?.dateISO === "string"
        ? s.dateISO.slice(0, 10)
        : typeof s?.date === "string"
          ? s.date.slice(0, 10)
          : "";

    const intensity = toFksIntensity(s?.intensity);
    const exos = Array.isArray((s as any)?.exercises) ? (s as any).exercises : [];
    const { primary: focus, secondary } = focusFromExercises(s);
    const strengthRegion = focus === "strength" ? inferStrengthRegion(exos) : null;
    const phaseRecent: FKS_PhaseId =
      typeof s?.phase === "string"
        ? ((s.phase.toLowerCase() as FKS_PhaseId) ?? phase)
        : phase;

    const rpeVal =
      typeof s?.feedback?.rpe === "number"
        ? s.feedback.rpe
        : typeof s?.rpe === "number"
          ? s.rpe
          : 0;

    const duration =
      typeof s?.durationMin === "number"
        ? s.durationMin
        : Number.isFinite(s?.volumeScore)
          ? Math.max(15, Math.round(Number(s.volumeScore)))
          : 45;

    const label = s?.title
      ? String(s.title)
      : `Séance ${focus}`;

    return {
      date: dateISO,
      date_relative: "",
      label,
      phase: phaseRecent,
      focus_primary: focus,
      focus_secondary: secondary,
      ...(strengthRegion ? { strength_region: strengthRegion } : {}),
      intensity,
      rpe: rpeVal,
      duration_min: duration,
    };
  });

  const recent_fks_badges = Array.from(
    new Set(
      recent_fks_sessions
        .slice(0, 5)
        .flatMap((s) => {
          const focusBadge = s.focus_primary ? [`focus:${s.focus_primary}`] : [];
          const combo =
            s.focus_primary && s.intensity
              ? [`focus_intensity:${s.focus_primary}:${s.intensity}`]
              : [];
          const strengthDetail =
            (s as any).strength_region && s.focus_primary === "strength"
              ? [`focus_strength:${(s as any).strength_region}`]
              : [];
          return [...focusBadge, ...combo, ...strengthDetail];
        })
    )
  );

  // Condensé narratif des 3 dernières séances pour varier l’IA
  const summarySessions = recent_fks_sessions.slice(0, 5);
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

  const context: FKS_AiContext = {
    version: "fks_context_v1",
    profile: {
      first_name: firstName,
      level,
      position,
      dominant_foot: dominantFoot,
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
    devNowISO: trainingState.devNowISO ?? null,
    constraints: {
      equipment: equipment_available,
      pains,
    },
    phase,
    microcycle: { session_index: microcycleSessionIndex },
    metrics: {
      atl,
      ctl,
      tsb,
    },
    recent_fks_sessions: recent_fks_sessions.slice(0, 5),
    recent_fks_summary_text,
    recent_fks_badges,
    recent_by_focus: buildRecentByFocus(sessions, 3),
    equipment_available,
  };

  // debug: stocke le contexte pour inspection
  useTrainingStore.getState().setLastAiContext?.(context);

  return context;
}
