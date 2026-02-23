import { addDays } from "date-fns";
import type { Exercise, Session } from "../../domain/types";
import { deepClean, normalizeFocus, toPlannedIntensity } from "./helpers";
import type { FKS_NextSessionV2, PlannedPhase } from "./types";
import { v2ToLocalSession } from "./transform";
import { toDateKey } from "../../utils/dateHelpers";

export async function processV2(params: {
  v2: FKS_NextSessionV2;
  phase: Session["phase"];
  now: Date;
  clubTrainingDays: string[];
  tsb: number;
  alreadyAppliedToday: boolean;
  location: string;
  pushSession: (s: Session) => void;
  persistPlanned: (p: any) => Promise<void>;
  setLastAiSessionV2: (p: { v2: FKS_NextSessionV2; date: string; sessionId: string }) => void;
  navigate: (dest: { v2: FKS_NextSessionV2; plannedDateISO: string; sessionId: string }) => void;
  alertPlanified?: (dateISO: string) => void;
}) {
  const {
    v2,
    phase,
    now,
    clubTrainingDays,
    tsb,
    alreadyAppliedToday,
    location,
    pushSession,
    persistPlanned,
    setLastAiSessionV2,
    navigate,
    alertPlanified,
  } = params;

  const toDow = (dateISO: string) => {
    const d = new Date(`${dateISO}T00:00:00.000Z`);
    const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    return map[d.getUTCDay()] ?? "sun";
  };

  const isClubDay = (dateISO: string) => clubTrainingDays.includes(toDow(dateISO));

  const base = new Date(now);
  let plannedDate = base;
  let deferredToTomorrow = false;
  if (alreadyAppliedToday) {
    plannedDate = new Date(base);
    plannedDate.setDate(plannedDate.getDate() + 1);
    deferredToTomorrow = true;
  }
  const plannedDateISO = toDateKey(plannedDate);
  const plannedTomorrowISO = toDateKey(addDays(plannedDate, 1));

  const sessionFromV2 = v2ToLocalSession(v2, phase as any, plannedDateISO);
  const sessionWithAi = { ...sessionFromV2, aiV2: v2 } as any;

  const exercisesPlanned: Exercise[] =
    Array.isArray(sessionFromV2.exercises) &&
    sessionFromV2.exercises.length > 0
      ? sessionFromV2.exercises
      : [
          {
            id: "placeholder_1",
            name: "Séance à confirmer",
            modality: "run",
            intensity: "easy",
            sets: 1,
            reps: 1,
            durationSec: 300,
          },
        ];

  const phaseForPayload: PlannedPhase = (
    ["Playlist", "Construction", "Progression", "Performance", "Deload"] as const
  ).includes(sessionFromV2.phase as PlannedPhase)
    ? (sessionFromV2.phase as PlannedPhase)
    : "Playlist";

  const guardrailsApplied: string[] = Array.isArray(v2.guardrails_applied)
    ? [...v2.guardrails_applied]
    : [];

  let intensityPlanned = toPlannedIntensity(sessionFromV2.intensity);
  let plannedLoadSafe = Math.max(
    1,
    Math.round(
      Number.isFinite(sessionFromV2.volumeScore as any)
        ? (sessionFromV2.volumeScore as number)
        : 45
    )
  );

  const clubToday = isClubDay(plannedDateISO);
  const clubTomorrow = isClubDay(plannedTomorrowISO);
  let guardFactor = 1;

  if (clubToday || clubTomorrow) {
    guardFactor *= 0.75;
    guardrailsApplied.push("Réduction charge (jour/veille club)");
    if (intensityPlanned === "hard") intensityPlanned = "moderate";
  }
  if (tsb < -10) {
    guardFactor *= 0.8;
    guardrailsApplied.push("TSB < -10 → easy/modéré et volume -20%");
    intensityPlanned = "easy";
  } else if (tsb < 0 && intensityPlanned === "hard") {
    intensityPlanned = "moderate";
    guardrailsApplied.push("TSB négatif → hard abaissé en moderate");
  }

  plannedLoadSafe = Math.max(1, Math.round(plannedLoadSafe * guardFactor));
  sessionWithAi.intensity = intensityPlanned as any;
  sessionWithAi.volumeScore = plannedLoadSafe;

  const createdAt = new Date().toISOString();
  const rawPayload = {
    id: sessionFromV2.id,
    dateISO: plannedDateISO,
    createdAt,
    generationLabel: `${plannedDateISO} ${createdAt.slice(11, 19)}`,
    phase: phaseForPayload,
    focus: normalizeFocus(sessionFromV2.focus),
    intensity: intensityPlanned,
    plannedLoad: plannedLoadSafe,
    title: v2.title ?? null,
    subtitle: v2.subtitle ?? null,
    rpeTarget: typeof v2.rpe_target === "number" ? v2.rpe_target : null,
    durationMin: typeof v2.duration_min === "number" ? v2.duration_min : null,
    location: v2.location ?? location ?? null,
    badges: Array.isArray(v2.badges) ? v2.badges : [],
    coachingTips: Array.isArray(v2.coaching_tips) ? v2.coaching_tips : [],
    safetyNotes: v2.safety_notes ?? null,
    guardrailsApplied,
    postSession: v2.post_session ?? null,
    aiV2: v2,
    exercises: exercisesPlanned.map((e: Exercise) => ({
      id: String(e.id),
      name: String(e.name),
      modality: String(e.modality),
      intensity: String(e.intensity),
      ...(typeof e.sets === "number" && Number.isFinite(e.sets)
        ? { sets: e.sets }
        : {}),
      ...(typeof e.reps === "number" && Number.isFinite(e.reps)
        ? { reps: e.reps }
        : {}),
      ...(typeof e.durationSec === "number" && Number.isFinite(e.durationSec)
        ? { durationSec: e.durationSec }
        : {}),
      ...(typeof e.restSec === "number" && Number.isFinite(e.restSec)
        ? { restSec: e.restSec }
        : {}),
      ...(e.notes ? { notes: String(e.notes) } : {}),
    })),
  };

  const payload = deepClean(rawPayload) as any;
  await persistPlanned(payload);
  pushSession(sessionWithAi);
  setLastAiSessionV2({
    v2,
    date: plannedDateISO,
    sessionId: sessionWithAi.id,
  });

  navigate({
    v2,
    plannedDateISO,
    sessionId: sessionWithAi.id,
  });

  if (deferredToTomorrow && alertPlanified) {
    alertPlanified(plannedDateISO);
  }
}
