// domain/tracking/prescription.ts
// Fige la prescription d'une seance au lancement : fingerprint stable des
// champs prescriptifs (memes ingredients que hashContext de
// screens/newSession/api.ts, meme famille de hash djb2) + extraction
// structuree en PrescribedSnapshot (Lot 2 s'en sert pour initExecution).
import type { FKS_Block, FKS_BlockItem, FKS_NextSessionV2 } from "../../screens/newSession/types";
import type { PrescribedItem, PrescribedSnapshot } from "./types";

const FIELD_SEP = "|";
const LINE_SEP = "\n";

/** Conversion defensive en chaine stable (null/undefined -> chaine vide). */
const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim().length > 0 ? v : null;

/** reps peut arriver en string cote backend (contrat MODELE_DONNEES) meme si
 * le type front FKS_BlockItem ne modelise que number -- on reste tolerant. */
const repsOrNull = (v: unknown): number | string | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length > 0) return v;
  return null;
};

const roleOrNull = (v: unknown): "primary" | "secondary" | null =>
  v === "primary" || v === "secondary" ? v : null;

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Hash djb2 calcule sur une projection deterministe des champs prescriptifs
 * du v2 : titre/intensite/duree/rpe cible/archetype, puis pour chaque
 * bloc/item DANS L'ORDRE : blockId/type/duree de bloc + exerciseId/sets/reps/
 * workS/restS/duree d'item. Volontairement PAS un JSON.stringify(v2) --
 * l'ordre d'insertion des cles d'un objet JS n'est pas une garantie qu'on
 * veut porter dans un contrat de stabilite : ici on lit des champs nommes
 * dans un ordre fixe, donc deux v2 equivalents produisent toujours le meme
 * hash quel que soit l'ordre des cles de l'objet source.
 */
export function fingerprintPrescription(v2: FKS_NextSessionV2): string {
  const header = [
    s(v2?.title),
    s(v2?.intensity),
    s(v2?.durationMin),
    s(v2?.rpeTarget),
    s(v2?.archetypeId),
  ].join(FIELD_SEP);

  const blocks: FKS_Block[] = Array.isArray(v2?.blocks) ? v2.blocks : [];
  const lines = blocks.map((block) => {
    const blockLine = ["B", s(block?.id ?? block?.blockId), s(block?.type), s(block?.durationMin)].join(
      FIELD_SEP
    );

    const items: FKS_BlockItem[] = Array.isArray(block?.items) ? block.items : [];
    const itemLines = items.map((item) =>
      [
        "I",
        s(item?.exerciseId ?? item?.id),
        s(item?.sets),
        s(item?.reps),
        s(item?.workS),
        s(item?.restS),
        s(item?.durationMin),
      ].join(FIELD_SEP)
    );

    return [blockLine, ...itemLines].join(LINE_SEP);
  });

  const canonical = [header, ...lines].join(LINE_SEP);
  return djb2(canonical);
}

export type PrescribedSnapshotMeta = {
  sessionId: string;
  launchedAtISO: string;
  generatedAtISO?: string | null;
  cycleGoal?: string | null;
  sessionIndex?: number | null;
  phase?: string | null;
  matchContext?: PrescribedSnapshot["matchContext"];
};

/**
 * Extrait un PrescribedSnapshot depuis un v2 + metadonnees de lancement.
 * Tolerant : tout champ absent/mal type -> null (jamais d'exception, jamais
 * de valeur inventee). L'ordre des items reprend l'ordre des blocs/items du
 * v2 ; la cle suit getItemKey de SessionLive (`${blockIndex}-${itemIndex}`).
 */
export function buildPrescribedSnapshot(
  v2: FKS_NextSessionV2,
  meta: PrescribedSnapshotMeta
): PrescribedSnapshot {
  const blocks: FKS_Block[] = Array.isArray(v2?.blocks) ? v2.blocks : [];
  const items: PrescribedItem[] = [];

  blocks.forEach((block, blockIndex) => {
    const blockId = strOrNull(block?.id) ?? strOrNull(block?.blockId) ?? "blk";
    const blockItems: FKS_BlockItem[] = Array.isArray(block?.items) ? block.items : [];

    blockItems.forEach((item, itemIndex) => {
      const exerciseId =
        strOrNull(item?.exerciseId) ?? strOrNull(item?.id) ?? `${blockId}_${blockIndex}_${itemIndex}`;

      // `role` n'est pas modelise dans FKS_BlockItem (front) mais peut etre
      // present dans la reponse brute backend -- lecture defensive via vue
      // non typee, jamais d'`any` propage.
      const rawItem = item as unknown as Record<string, unknown>;

      items.push({
        key: `${blockIndex}-${itemIndex}`,
        exerciseId,
        name: strOrNull(item?.name) ?? "Exercice",
        blockId,
        blockIndex,
        itemIndex,
        blockType: strOrNull(block?.type),
        role: roleOrNull(rawItem.role),
        sets: numOrNull(item?.sets),
        reps: repsOrNull(item?.reps),
        workS: numOrNull(item?.workS),
        restS: numOrNull(item?.restS),
        durationMin: numOrNull(item?.durationMin),
        notes: strOrNull(item?.notes),
      });
    });
  });

  return {
    sessionId: meta.sessionId,
    fingerprint: fingerprintPrescription(v2),
    generatedAtISO: meta.generatedAtISO ?? null,
    launchedAtISO: meta.launchedAtISO,
    cycleGoal: meta.cycleGoal ?? null,
    sessionIndex: typeof meta.sessionIndex === "number" ? meta.sessionIndex : null,
    phase: meta.phase ?? null,
    matchContext: meta.matchContext ?? "unknown",
    plannedDurationMin: numOrNull(v2?.durationMin),
    rpeTarget: numOrNull(v2?.rpeTarget),
    intensity: strOrNull(v2?.intensity),
    focusPrimary: strOrNull(v2?.focusPrimary),
    items,
  };
}
