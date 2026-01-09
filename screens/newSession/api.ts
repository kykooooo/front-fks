import { getAuth } from "firebase/auth";
import { BACKEND_URL } from "../../config/backend";
import { EXERCISE_BANK } from "../../engine/exerciseBank";
import type { FKS_NextSessionV2 } from "./types";

export const buildAllowedExercisesPayload = () =>
  EXERCISE_BANK.map((ex) => ({
    id: ex.id,
    name: ex.name,
    modality: ex.modality,
    description: null,
    equipment: [],
    intensity: ex.intensity,
    tags: ex.tags,
  }));

export function prepareBackendContext(
  ctx: any,
  selectedEquipment: string[],
  environment: string[]
) {
  const location = environment.includes("gym")
    ? "gym"
    : environment.includes("pitch")
    ? "pitch"
    : "home";

  const prepared = {
    ...ctx,
    training_environment: environment,
    location,
    equipment_available: selectedEquipment,
    equipment_used: selectedEquipment,
    goal: ctx.goal ?? ctx.profile?.goal ?? "fondation",
    profile: { ...(ctx.profile ?? {}), goal: ctx.profile?.goal ?? "fondation" },
    constraints: {
      ...(ctx as any)?.constraints,
      equipment: selectedEquipment,
      pains: (ctx as any)?.constraints?.pains ?? [],
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
  const url = `${BACKEND_URL}/api/fks/generate`;

  let r: any;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, context }),
    });
  } catch (e) {
    console.warn("Network error when calling backend", e);
    throw e;
  }

  if (!r.ok) {
    throw new Error(`Backend error ${r.status}`);
  }

  const data: any = await r.json();

  if (data && typeof data.v2 === "object" && data.v2 !== null) {
    const v2 = data.v2 as FKS_NextSessionV2;
    return { v2, debug: data };
  }

  throw new Error("Backend did not return v2");
}
