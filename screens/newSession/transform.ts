import { EXERCISE_BANK } from "../../engine/exerciseBank";
import type { Exercise, Session } from "../../domain/types";
import { modalityFromBlockType, normalizeFocus, prettifyName, toPlannedIntensity } from "./helpers";
import type { FKS_Block, FKS_NextSessionV2 } from "./types";

export function v2ToLocalSession(
  v2: FKS_NextSessionV2,
  phase: Session["phase"],
  plannedDateISO: string
): Session {
  const seenExerciseIds = new Set<string>();
  const pickFallbackExercise = (modality: string) =>
    EXERCISE_BANK.find((ex) => ex.modality === modality && !seenExerciseIds.has(ex.id)) ??
    EXERCISE_BANK.find((ex) => !seenExerciseIds.has(ex.id));
  const ensureMinItems = (
    items: Exercise[],
    modality: Exercise["modality"],
    blockDurationMin: number,
    blockIdx: number
  ) => {
    const minItems = blockDurationMin < 6 ? 1 : 2;
    const safe = items.filter(Boolean);
    while (safe.length < minItems) {
      const fb = pickFallbackExercise(modality);
      if (!fb) break;
      const idx = safe.length;
      const id = `${fb.id}_extra_${blockIdx}_${idx}`;
      seenExerciseIds.add(fb.id);
      safe.push({
        id,
        name: fb.name,
        modality,
        intensity: (v2.intensity ?? "moderate") as Exercise["intensity"],
        sets: 3,
        reps: 8,
        restSec: 60,
      });
    }
    return safe;
  };

  const blocks: Exercise[] = Array.isArray(v2.blocks)
    ? v2.blocks.flatMap((block, blockIdx) => {
        const blockType =
          (block as any)?.type ||
          (block as any)?.block_id ||
          (block as any)?.focus ||
          "run";
        const modality = modalityFromBlockType(blockType);
        const blockIntensity = toPlannedIntensity(
          (block as any)?.intensity ?? v2.intensity ?? "moderate"
        );

        if (!Array.isArray(block.items) || block.items.length === 0) {
          const solo = [
            {
              id: `${block.id || blockType || "block"}_${blockIdx}`,
              name: (block as FKS_Block).goal || blockType || "Bloc",
              modality,
              intensity: blockIntensity as Exercise["intensity"],
              sets: undefined,
              reps: undefined,
              durationSec: Math.max(120, Math.round(((block as FKS_Block).duration_min || 5) * 60)),
              restSec: undefined,
              notes: (block as FKS_Block).notes || undefined,
            } as Exercise,
          ];
          return ensureMinItems(solo, modality, (block as FKS_Block).duration_min ?? 10, blockIdx);
        }

        const mapped = block.items.map((item, i) => {
          let friendlyName = prettifyName(
            item.name ||
              (item as any).exercise_id ||
              (item as any).id ||
              (block as FKS_Block).goal ||
              blockType ||
              "Exercice"
          );
          const workRest = typeof (item as any).work_rest === "string" ? (item as any).work_rest : "";
          let parsedWork: number | undefined;
          let parsedRest: number | undefined;
          if (workRest.includes("/")) {
            const [w, r] = workRest.split("/").map((x: string) => parseInt(x.replace(/\D/g, ""), 10));
            if (Number.isFinite(w)) parsedWork = w;
            if (Number.isFinite(r)) parsedRest = r;
          }

          const hasWork = typeof item.work_s === "number" && Number.isFinite(item.work_s);
          const hasDurationMin =
            typeof (item as any).duration_min === "number" &&
            Number.isFinite((item as any).duration_min);
          const setsVal =
            typeof item.sets === "number" && Number.isFinite(item.sets)
              ? item.sets
              : undefined;
          const effectiveWork =
            hasWork && Number.isFinite(item.work_s)
              ? item.work_s
              : parsedWork;
          const durationSec = typeof effectiveWork === "number"
            ? effectiveWork * (setsVal ?? 1)
            : hasDurationMin
            ? Math.round(((item as any).duration_min as number) * 60)
            : undefined;

          const hasAnyLoad =
            (setsVal && (typeof item.reps === "number" || typeof effectiveWork === "number")) ||
            hasDurationMin ||
            parsedWork ||
            parsedRest;
          if (!hasAnyLoad) {
            return null;
          }

          const rawExerciseId: string | null =
            (item as any)?.exercise_id ??
            (item as any)?.id ??
            (item as any)?.exerciseId ??
            null;

          let exerciseId = rawExerciseId ? String(rawExerciseId) : null;
          if (exerciseId && seenExerciseIds.has(exerciseId)) {
            const fallback = pickFallbackExercise(modality);
            if (fallback) {
              exerciseId = fallback.id;
              friendlyName = fallback.name;
            }
          }

          if (exerciseId) {
            seenExerciseIds.add(exerciseId);
          }

          return {
            id: exerciseId ?? `${(block as FKS_Block).id || blockType || "block"}_${blockIdx}_${i}`,
            name: friendlyName,
            modality,
            intensity: blockIntensity as Exercise["intensity"],
            sets: setsVal,
            reps:
              typeof item.reps === "number" && Number.isFinite(item.reps)
                ? item.reps
                : undefined,
            durationSec,
            restSec:
              typeof item.rest_s === "number" && Number.isFinite(item.rest_s)
                ? item.rest_s
                : parsedRest,
            notes: item.notes ?? undefined,
          } as Exercise;
        }).filter(Boolean) as Exercise[];

        return ensureMinItems(mapped, modality, (block as FKS_Block).duration_min ?? 10, blockIdx);
      })
    : [];

  const baseModality = normalizeFocus(v2.focus_primary || "run");
  const baseIntensity = toPlannedIntensity(v2.intensity) as Exercise["intensity"];
  const placeholder: Exercise = {
    id: "placeholder_1",
    name: v2.title?.trim() || "Séance à confirmer",
    modality: baseModality,
    intensity: baseIntensity,
    sets: 1,
    reps: 1,
    durationSec: Math.max(
      300,
      Math.round((v2.duration_min || 30) * 60 * 0.3)
    ),
  };

  const exos = blocks.length > 0 ? blocks : [placeholder];

  const id = `planned_${plannedDateISO}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const srpeVal = v2?.estimated_load?.srpe;
  const volumeScore =
    typeof srpeVal === "number" &&
    Number.isFinite(srpeVal) &&
    srpeVal > 0
      ? Math.round(srpeVal)
      : Math.max(1, Math.round(v2.duration_min || 45));

  return {
    id,
    phase,
    focus: (v2.focus_primary as any) ?? baseModality,
    intensity: baseIntensity as any,
    dateISO: `${plannedDateISO}T00:00:00.000Z`,
    completed: false,
    volumeScore,
    exercises: exos,
  } as Session;
}
