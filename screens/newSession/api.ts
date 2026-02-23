import { getAuth } from "firebase/auth";
import { BACKEND_URL, backendAuthHeaders } from "../../config/backend";
import { BACKEND_EXERCISE_IDS } from "../../engine/backendExerciseIds";
import { EXERCISE_BY_ID } from "../../engine/exerciseBank";
import type { FKS_NextSessionV2 } from "./types";
import { safeFetch, BackendError } from "../../utils/errorHandler";

export const buildAllowedExercisesPayload = () =>
  BACKEND_EXERCISE_IDS.map((id) => EXERCISE_BY_ID[id])
    .filter(Boolean)
    .map((ex) => ({
      id: ex.id,
      name: ex.name,
      modality: ex.modality,
      description: ex.description,
      equipment: [],
      intensity: ex.intensity,
      tags: ex.tags,
    }));

export function prepareBackendContext(
  ctx: any,
  selectedEquipment: string[],
  environment: string[]
) {
  const normalizedEquipment = Array.from(
    new Set(
      selectedEquipment.flatMap((id) => [id])
    )
  );
  const resolvedGoal = ctx.profile?.goal ?? ctx.goal ?? "fondation";
  const availableTimeMin =
    typeof ctx?.constraints?.available_time_min === "number"
      ? ctx.constraints.available_time_min
      : typeof ctx?.available_time_min === "number"
      ? ctx.available_time_min
      : typeof ctx?.profile?.available_time_min === "number"
      ? ctx.profile.available_time_min
      : undefined;
  const derivedVenue = environment.includes("gym")
    ? "gym"
    : environment.includes("pitch") || environment.includes("field")
    ? "field"
    : "home";
  const venue =
    environment.length > 0
      ? derivedVenue
      : ctx.constraints?.venue ?? ctx.profile?.venue ?? derivedVenue;
  const location = environment.includes("gym")
    ? "gym"
    : environment.includes("pitch")
    ? "pitch"
    : "home";

  const prepared = {
    ...ctx,
    training_environment: environment,
    location,
    equipment_available: normalizedEquipment,
    equipment_used: normalizedEquipment,
    goal: resolvedGoal,
    profile: {
      ...(ctx.profile ?? {}),
      goal: resolvedGoal,
      venue,
    },
    constraints: {
      ...(ctx as any)?.constraints,
      venue,
      equipment: normalizedEquipment,
      pains: (ctx as any)?.constraints?.pains ?? [],
      ...(typeof availableTimeMin === "number" ? { available_time_min: availableTimeMin } : {}),
    },
    // aide au debug backend : pools non vides + logs [FKS][token_pools]
    allowed_exercises: buildAllowedExercisesPayload(),
    debug: true,
    debug_allow_all_exercises: false,
  };

  return { context: prepared, location };
}

export async function fetchV2(
  context: any
): Promise<{ v2: FKS_NextSessionV2; debug: any }> {
  const auth = getAuth();
  const userId = auth.currentUser?.uid ?? "test-user-dev";
  const idToken = await auth.currentUser?.getIdToken();
  const url = `${BACKEND_URL}/api/fks/generate`;

  // Timeout long : Render free-tier cold start (~30-50s) + génération IA (~15s)
  const fetchOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...backendAuthHeaders(),
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ userId, context }),
  };

  let r: Response;
  try {
    r = await safeFetch(url, fetchOptions, 90000);
  } catch (firstError: any) {
    // Si timeout (cold start probable), retry une fois
    if (firstError.code === "ETIMEDOUT") {
      r = await safeFetch(url, fetchOptions, 90000);
    } else {
      throw firstError;
    }
  }

  const data: any = await r.json();

  // Validation de la réponse
  if (!data || typeof data.v2 !== "object" || data.v2 === null) {
    throw new BackendError(
      500,
      'Invalid Response',
      'Le serveur a retourné une réponse invalide',
      'La génération de séance a échoué. Le serveur n\'a pas renvoyé de séance valide. Réessaie ou contacte le support si le problème persiste.'
    );
  }

  const v2 = data.v2 as FKS_NextSessionV2;
  return { v2, debug: data };
}
