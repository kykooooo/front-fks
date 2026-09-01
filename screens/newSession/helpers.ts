import type { Exercise, Session } from "../../domain/types";
import type { FKS_NextSessionV2, PlannedIntensity, ResetVariant } from "./types";

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

/**
 * Contrat front↔back : le backend émet `recovery_tips` à la RACINE de la
 * réponse v2 (fks/src/fksSchema.ts) — son `post_session` ne contient que
 * {cooldown_min, mobility}. On lit d'abord postSession.recoveryTips (compat
 * si le backend les y remet un jour), puis la racine.
 * Retourne undefined si aucun conseil (jamais un tableau vide).
 */
export function readRecoveryTips(
  v2: Pick<FKS_NextSessionV2, "recoveryTips" | "postSession"> | null | undefined
): string[] | undefined {
  const fromPost = v2?.postSession?.recoveryTips;
  if (Array.isArray(fromPost) && fromPost.length > 0) return fromPost;
  const fromRoot = v2?.recoveryTips;
  if (Array.isArray(fromRoot) && fromRoot.length > 0) return fromRoot;
  return undefined;
}

/**
 * Contrat front↔back : `coaching_tips` est un tableau de STRINGS au niveau
 * SÉANCE (fks/src/fksSchema.ts:121 — `coaching_tips: z.array(z.string())`),
 * jamais rattaché à un bloc. Agent B en produit 3 (fks/src/agents/agentB.*.ts),
 * bornés à 150 caractères pièce ; le post-traitement backend peut en garder
 * moins après dédup.
 * Retourne undefined si aucun conseil (jamais un tableau vide), et filtre les
 * entrées non-string ou vides pour ne jamais rendre une puce fantôme.
 */
export function readCoachingTips(
  v2: Pick<FKS_NextSessionV2, "coachingTips"> | null | undefined
): string[] | undefined {
  const raw = v2?.coachingTips;
  if (!Array.isArray(raw)) return undefined;
  const clean = raw
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return clean.length > 0 ? clean : undefined;
}

export function prettifyName(name: string) {
  const trimmed = (name || "").trim();
  if (!trimmed) return "Exercice";
  // Slug brut (ex: "str_squat_bodyweight") : on retire le prefixe token et on
  // remplace les underscores par des espaces avant la mise en forme. Un nom
  // déjà rédigé par le backend (avec espaces) n'est pas retouché ici.
  const isSlug = /^[a-z0-9_]+$/i.test(trimmed) && trimmed.includes("_");
  const noPrefix = isSlug ? trimmed.replace(/^(wu_|str_|run_|plyo_|cod_|core_)/i, "") : trimmed;
  const spaced = isSlug ? noPrefix.replace(/_/g, " ").toLowerCase() : noPrefix;
  // Casse française : majuscule initiale seule (pas un mot-à-mot comme en
  // anglais — "Squat Poids Du Corps" est faux, "Squat poids du corps" est juste).
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Variantes de reset RÉELLEMENT fournies par le backend (`v2.resetVariants`),
 * prêtes pour `ResetVariantModal`. Ne fabrique JAMAIS de variante ni de
 * titre : quand le backend n'envoie rien d'exploitable, retourne un tableau
 * vide plutôt qu'une liste de quatre choix inventés (ancien
 * `RESET_VARIANT_FALLBACKS`, supprimé le 31/07/2026 — un manque de données
 * ne devient jamais une fausse séance, ici pas plus qu'ailleurs). L'appelant
 * doit alors dégrader proprement : pas de carte de choix affichée, la
 * séance de reset continue normalement, sans variante à choisir.
 */
export function resolveResetVariants(v2: Pick<FKS_NextSessionV2, "resetVariants">): ResetVariant[] {
  if (!Array.isArray(v2.resetVariants) || v2.resetVariants.length === 0) return [];
  return v2.resetVariants
    .filter((rv): rv is NonNullable<typeof rv> => Boolean(rv?.id))
    .map((rv) => {
      // Sous-titre construit UNIQUEMENT depuis des champs réels de la
      // variante : jamais de RPE ni de "zéro fatigue" inventés (le backend
      // ne les envoie pas ici). Sans donnée réelle exploitable, pas de
      // sous-titre du tout plutôt qu'un chiffre halluciné.
      const subtitle =
        rv.subtitle ??
        (typeof rv.durationMin === "number" && rv.durationMin > 0
          ? `~${rv.durationMin} min`
          : undefined);
      return {
        id: rv.id,
        // Dernier recours : l'identifiant réel du backend, jamais un titre inventé.
        title: rv.title ?? rv.id,
        subtitle,
        durationMin: rv.durationMin,
        blocks: rv.blocks,
        display: rv.display,
      };
    });
}

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
