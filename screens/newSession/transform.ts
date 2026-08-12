import type { Exercise, Session } from "../../domain/types";
import { BackendError } from "../../utils/errorHandler";
import { modalityFromBlockType, normalizeFocus, prettifyName, toPlannedIntensity } from "./helpers";
import { garantirSeanceSolo } from "./soloGuard";
import type { FKS_NextSessionV2 } from "./types";

/** Guard: retourne fallback si la valeur n'est pas un nombre fini > 0 */
const safeDur = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;

/**
 * Refus typé (docs/CONTRAT_ERREUR_FRONT.md §2.1) — la mise en forme locale a
 * détecté une séance qu'elle ne peut pas servir telle quelle. DOCTRINE
 * (Option C) : on ne répare plus jamais ça en silence. Réutilise le code
 * SESSION_SCHEMA_INVALID déjà catégorisé par `lireEchecGeneration`
 * (screens/newSession/echecGeneration.ts) — même mécanique que
 * `screens/newSession/api.ts` — plutôt que d'inventer une seconde table de
 * codes. La transformation échoue, rien n'est persisté : `processV2` propage,
 * l'écran affiche `CarteEchecGeneration`.
 */
function refusTypeTransform(message: string, failedStep: string): BackendError {
  return new BackendError(
    422,
    "Unprocessable Entity",
    JSON.stringify({
      error: "SESSION_SCHEMA_INVALID",
      code: "SESSION_SCHEMA_INVALID",
      category: "technique",
      retryable: false,
      message,
      failedStep,
      requestId: null,
    })
  );
}

export function v2ToLocalSession(
  v2: FKS_NextSessionV2,
  phase: Session["phase"],
  plannedDateISO: string,
  contexteGardeSolo?: { ageCategory?: string | null }
): Session {
  const seenExerciseIds = new Set<string>();

  const blocks: Exercise[] = Array.isArray(v2.blocks)
    ? v2.blocks.flatMap((block, blockIdx) => {
        const blockType =
          block.type ||
          block.blockId ||
          block.focus ||
          "run";
        const modality = modalityFromBlockType(blockType);
        const blockIntensity = toPlannedIntensity(
          block.intensity ?? v2.intensity ?? "moderate"
        );

        if (!Array.isArray(block.items) || block.items.length === 0) {
          return [
            {
              id: `${block.id || blockType || "block"}_${blockIdx}`,
              name: block.goal || blockType || "Bloc",
              modality,
              intensity: blockIntensity as Exercise["intensity"],
              sets: undefined,
              reps: undefined,
              durationSec: Math.max(120, Math.round(safeDur(block.durationMin, 5) * 60)),
              restSec: undefined,
              notes: block.notes || undefined,
            } as Exercise,
          ];
        }

        // Un bloc avec 1 item légitime SERT 1 item : plus de complétion
        // artificielle à 2 (ensureMinItems, supprimé — mesure sur 620 séances
        // réelles, docs/CONTRAT_ERREUR_FRONT.md : un protocole VMA 6x800m est
        // légitimement UN item).
        return block.items.map((item, i) => {
          const friendlyName = prettifyName(
            item.name ||
              item.exerciseId ||
              item.id ||
              block.goal ||
              blockType ||
              "Exercice"
          );
          const workRest = typeof item.workRest === "string" ? item.workRest : "";
          let parsedWork: number | undefined;
          let parsedRest: number | undefined;
          if (workRest.includes("/")) {
            const [w, r] = workRest.split("/").map((x: string) => parseInt(x.replace(/\D/g, ""), 10));
            if (Number.isFinite(w)) parsedWork = w;
            if (Number.isFinite(r)) parsedRest = r;
          }

          const hasWork = typeof item.workS === "number" && Number.isFinite(item.workS);
          const hasDurationMin =
            typeof item.durationMin === "number" &&
            Number.isFinite(item.durationMin);
          const setsVal =
            typeof item.sets === "number" && Number.isFinite(item.sets)
              ? item.sets
              : undefined;
          const effectiveWork =
            hasWork && Number.isFinite(item.workS)
              ? item.workS
              : parsedWork;
          const durationSec = typeof effectiveWork === "number"
            ? effectiveWork * (setsVal ?? 1)
            : hasDurationMin
            ? Math.round((item.durationMin as number) * 60)
            : undefined;

          // `effectiveWork` NE DOIT PAS être subordonné à `setsVal` : le dosage
          // par défaut backend run/mobility (sets:null + work_s:240) n'a pas de
          // sets numérique, mais work_s EST une charge à lui seul (un effort
          // continu, implicitement 1x). Seul `reps` reste couplé à `setsVal`
          // ("sets x reps" — un nombre de répétitions seul, sans savoir combien
          // de séries, n'est pas une charge exploitable).
          const hasAnyLoad =
            (setsVal && typeof item.reps === "number") ||
            typeof effectiveWork === "number" ||
            hasDurationMin ||
            typeof parsedWork === "number" ||
            typeof parsedRest === "number";
          if (!hasAnyLoad) {
            // Un item prescrit sans AUCUNE donnée de charge (ni sets+reps, ni
            // travail, ni durée, ni work/rest parsé) ne disparaît plus en
            // silence.
            throw refusTypeTransform(
              "Le serveur a renvoyé un exercice sans aucune charge (séries, répétitions ou durée). Rien n'a été ajouté à ton programme. Réessaie dans quelques instants.",
              "transform.item_sans_charge"
            );
          }

          const rawExerciseId: string | null =
            item.exerciseId ??
            item.id ??
            null;

          const exerciseId = rawExerciseId ? String(rawExerciseId) : null;
          if (exerciseId && seenExerciseIds.has(exerciseId)) {
            // Un exercise_id dupliqué dans la même séance n'est plus remplacé
            // en silence par un exercice de secours (le backend corrige déjà
            // le doublon à la source, invariant #40 — ce refus reste un filet).
            throw refusTypeTransform(
              "Le serveur a renvoyé deux fois le même exercice dans la séance. Rien n'a été ajouté à ton programme. Réessaie dans quelques instants.",
              "transform.exercise_id_duplique"
            );
          }

          if (exerciseId) {
            seenExerciseIds.add(exerciseId);
          }

          return {
            id: exerciseId ?? `${block.id || blockType || "block"}_${blockIdx}_${i}`,
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
              typeof item.restS === "number" && Number.isFinite(item.restS)
                ? item.restS
                : parsedRest,
            notes: item.notes ?? undefined,
          } as Exercise;
        });
      })
    : [];

  if (blocks.length === 0) {
    // Plus de placeholder « Séance à confirmer » fabriqué ici. Chemin
    // atteignable : `api.ts` refuse déjà `blocks` vide au niveau racine
    // (`estSeanceReparee`), mais un variant de reset peut arriver ici avec
    // `blocks: []` — NewSessionScreen.tsx construit `chosen.blocks ??
    // resetChoice.v2.blocks`, et `??` ne retombe PAS sur le v2 validé quand
    // `chosen.blocks` vaut `[]` (tableau vide, pas null/undefined). Même refus
    // typé que les autres cas : rien n'est fabriqué à la place.
    throw refusTypeTransform(
      "Le serveur a renvoyé une séance sans aucun bloc. Rien n'a été ajouté à ton programme. Réessaie dans quelques instants.",
      "transform.blocks_vides"
    );
  }

  // Garde « joueur seul » : un exo à 2+ est remplacé par son équivalent solo
  // ou marqué « (à 2) », jamais servi nu (soloGuard.ts). Équipement lu depuis
  // la séance v2 — mêmes champs que SessionLiveScreen (equipmentAvailable ??
  // equipmentUsed) ; âge transmis par l'écran (store), null = jamais de swap
  // à seuil d'âge.
  const v2Equip = v2 as unknown as { equipmentAvailable?: unknown; equipmentUsed?: unknown };
  const equipmentAvailable = Array.isArray(v2Equip.equipmentAvailable)
    ? (v2Equip.equipmentAvailable as string[])
    : Array.isArray(v2Equip.equipmentUsed)
      ? (v2Equip.equipmentUsed as string[])
      : [];
  const exercisesSoloSafe = garantirSeanceSolo(blocks, {
    equipmentAvailable,
    ageCategory: contexteGardeSolo?.ageCategory ?? null,
  });

  const baseModality = normalizeFocus(v2.focusPrimary || "run");
  const baseIntensity = toPlannedIntensity(v2.intensity) as Exercise["intensity"];

  const id = `planned_${plannedDateISO}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const srpeVal = v2?.estimatedLoad?.srpe;
  const volumeScore =
    typeof srpeVal === "number" &&
    Number.isFinite(srpeVal) &&
    srpeVal > 0
      ? Math.round(srpeVal)
      : Math.max(1, Math.round(safeDur(v2.durationMin, 45)));

  return {
    id,
    phase,
    focus: v2.focusPrimary ?? baseModality,
    intensity: baseIntensity,
    dateISO: `${plannedDateISO}T12:00:00`, // midi local : évite le recul d'un jour via toDateKey dans les fuseaux UTC-
    completed: false,
    volumeScore,
    exercises: exercisesSoloSafe,
  } as Session;
}
