import type { Exercise, Session } from "../../domain/types";
import type { PlannedIntensity, ResetVariant } from "./types";

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function toPlannedIntensity(x: Session["intensity"] | string): PlannedIntensity {
  const k = String(x).toLowerCase();
  if (k.includes("hard") || k.includes("difficile") || k.includes("max")) return "hard";
  if (k.includes("mod")) return "moderate";
  return "easy";
}

export function prettifyName(name: string) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "Exercice";
  const noPrefix = trimmed.replace(/^(wu_|str_|run_|plyo_|cod_|core_)/i, "");
  const spaced = noPrefix.replace(/_/g, " ");
  return spaced
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const RESET_VARIANT_FALLBACKS: ResetVariant[] = [
  {
    id: "prime_appuis",
    title: "Prime — Appuis nets",
    subtitle: "Appuis plus nets · RPE 3–4 · 12–16 min · zéro fatigue",
  },
  {
    id: "prime_hanches",
    title: "Prime — Hanches libres",
    subtitle: "Hanches libres · RPE 3–4 · 12–16 min · zéro fatigue",
  },
  {
    id: "prime_core",
    title: "Prime — Core duel",
    subtitle: "Gainage duel · RPE 3–4 · 12–16 min · zéro fatigue",
  },
  {
    id: "prime_posture",
    title: "Prime — Épaules stables",
    subtitle: "Épaules solides · RPE 3–4 · 12–16 min · zéro fatigue",
  },
];

export function modalityFromBlockType(type: string): Exercise["modality"] {
  const t = String(type).toLowerCase();
  if (t === "run" || t.includes("vma") || t.includes("tempo")) return "run";
  if (t === "strength" || t.includes("upper") || t.includes("lower")) return "strength";
  if (t === "speed" || t.includes("cod") || t.includes("coord")) return "speed" as Exercise["modality"];
  if (t.includes("circuit")) return "circuit";
  if (t.includes("plyo")) return "plyo";
  if (t.includes("core")) return "core";
  if (t.includes("mob") || t.includes("warmup") || t.includes("cooldown")) return "mobility";
  return "run";
}

export function normalizeFocus(f: Session["focus"] | string): Exercise["modality"] {
  const v = String(f).toLowerCase();
  if (["run", "course", "endurance", "aerobic", "cardio"].includes(v)) return "run";
  if (["strength", "force", "lift", "muscu"].includes(v)) return "strength";
  if (["speed", "vma", "sprint"].includes(v)) return "speed" as Exercise["modality"];
  if (["circuit", "wod"].includes(v)) return "circuit";
  if (["core", "gainage", "abdos"].includes(v)) return "core";
  if (["plyo", "plyometric", "plyometrie"].includes(v)) return "plyo";
  if (["mobility", "mobilite", "stretch"].includes(v)) return "mobility";
  return "run";
}

// Nettoyeur profond : retire undefined/NaN/Infinity de tout objet/array
export function deepClean<T>(val: T): T {
  if (val === undefined) return undefined as T;
  if (val === null) return null as T;
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return undefined as T;
    return val as T;
  }
  if (Array.isArray(val)) {
    const arr = (val as unknown[])
      .map((x) => deepClean(x))
      .filter((x) => x !== undefined);
    return arr as T;
  }
  if (typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      const cleaned = deepClean(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out as T;
  }
  return val;
}
