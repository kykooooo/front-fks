import type { FKS_NextSessionV2 } from "../newSession/types";
import { getFootballLabel } from "../../config/trainingDefaults";

type ResolvePlayerPreviewContextInput = {
  v2: FKS_NextSessionV2;
  canUseLiveCycleFallback: boolean;
  fallbackCycleLabel?: string | null;
  fallbackCycleProgressLabel?: string | null;
  fallbackCyclePhaseLabel?: string | null;
  profilePosition?: string | null;
  tsb?: number | null;
};

export type ResolvedPlayerPreviewContext = {
  cycleLabel: string | null;
  cycleProgressLabel: string | null;
  cyclePhaseLabel: string | null;
  adaptationLabels: string[];
  playerRationaleTitle: string | null;
  playerRationale: string | null;
  coachNote: string | null;
  locationTag: string | null;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function stripCoachPrefix(value: string | null): string | null {
  if (!value) return null;
  return cleanText(value.replace(/^Note du pr(?:e|é)pa:\s*/i, ""));
}

function sanitizeLabels(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  const labels = values
    .map((value) => cleanText(value))
    .filter((value): value is string => value !== null);

  return Array.from(new Set(labels)).slice(0, 4);
}

function mapLegacyPositionLabel(rawPosition: string | null | undefined): string | null {
  const position = String(rawPosition ?? "").toLowerCase().trim();
  if (!position) return null;
  if (position.includes("mil") || position.includes("mid")) return "Poste : milieu";
  if (position.includes("ail") || position.includes("wing")) return "Poste : ailier";
  if (position.includes("def")) return "Poste : défenseur";
  return null;
}

function mapLegacyReadinessLabel(tsb: number | null | undefined): string | null {
  if (typeof tsb !== "number" || !Number.isFinite(tsb)) return null;
  if (tsb <= -20) return "État du jour : récupération";
  if (tsb < -12) return "État du jour : retour progressif";
  if (tsb < -5) return "État du jour : charge ajustée";
  if (tsb >= 5) return "État du jour : grosse fenêtre de travail";
  return "État du jour : prêt à travailler";
}

function mapLegacyLocationLabel(rawLocation: string | null | undefined): string | null {
  const location = String(rawLocation ?? "").toLowerCase().trim();
  if (!location) return null;
  if (location.includes("gym") || location.includes("salle")) return "Cadre : salle";
  if (location.includes("pitch") || location.includes("field") || location.includes("terrain")) {
    return "Cadre : terrain";
  }
  if (location.includes("home") || location.includes("maison")) return "Cadre : maison";
  return null;
}

function buildLegacyAdaptationLabels(input: {
  profilePosition?: string | null;
  tsb?: number | null;
  location?: string | null;
  cyclePhaseLabel?: string | null;
}): string[] {
  const labels = [
    mapLegacyPositionLabel(input.profilePosition ?? null),
    mapLegacyReadinessLabel(input.tsb ?? null),
    mapLegacyLocationLabel(input.location ?? null),
    input.cyclePhaseLabel ? `Phase : ${input.cyclePhaseLabel}` : null,
  ].filter((value): value is string => value !== null);

  return Array.from(new Set(labels)).slice(0, 4);
}

function buildLegacyCoachNote(input: {
  tsb?: number | null;
  intensity?: string | null;
  cyclePhaseLabel?: string | null;
}): string {
  if (typeof input.tsb === "number" && Number.isFinite(input.tsb) && input.tsb < -12) {
    return "Aujourd'hui, on veut une séance propre. Tu gardes de la marge et tu privilégies la qualité.";
  }

  if (typeof input.intensity === "string" && input.intensity.toLowerCase().includes("hard")) {
    return "Pousse si la technique reste nette. Dès que la qualité baisse, tu coupes une rep ou tu rallonges un peu le repos.";
  }

  if (input.cyclePhaseLabel === "Mise en route") {
    return "Pose une base propre dès le départ. Contrôle, amplitude et transfert terrain avant de chercher plus lourd.";
  }

  return "Exécute chaque bloc avec de la qualité. Le but, c'est du transfert terrain, pas de faire du volume pour faire du volume.";
}

function buildPlayerRationale(tsb: number | null | undefined): {
  playerRationale: string | null;
  playerRationaleTitle: string | null;
} {
  if (typeof tsb !== "number" || !Number.isFinite(tsb)) {
    return { playerRationale: null, playerRationaleTitle: null };
  }

  const football = getFootballLabel(tsb);

  if (tsb <= -20) {
    return {
      playerRationaleTitle: `${football.label} ${football.emoji}`,
      playerRationale:
        "Tu es en zone rouge \u2014 cette s\u00E9ance est all\u00E9g\u00E9e pour te prot\u00E9ger. R\u00E9cup\u00E8re bien.",
    };
  }
  if (tsb < -12) {
    return {
      playerRationaleTitle: `${football.label} ${football.emoji}`,
      playerRationale:
        "Tu accumules de la fatigue. On a r\u00E9duit le volume pour te permettre de remonter.",
    };
  }
  if (tsb < -5) {
    return {
      playerRationaleTitle: `${football.label} ${football.emoji}`,
      playerRationale:
        "Charge ajust\u00E9e aujourd\u2019hui. Le volume est l\u00E9g\u00E8rement r\u00E9duit, reste concentr\u00E9 sur la qualit\u00E9.",
    };
  }
  if (tsb > 5) {
    return {
      playerRationaleTitle: `${football.label} ${football.emoji}`,
      playerRationale:
        "Tu es frais \u2014 on en profite pour pousser l\u2019intensit\u00E9.",
    };
  }

  return { playerRationale: null, playerRationaleTitle: null };
}

export function resolvePlayerPreviewContext(
  input: ResolvePlayerPreviewContextInput
): ResolvedPlayerPreviewContext {
  const playerContext = input.v2.playerContext ?? null;
  const cyclePhaseLabel =
    cleanText(playerContext?.cyclePhaseLabel) ??
    (input.canUseLiveCycleFallback ? cleanText(input.fallbackCyclePhaseLabel) : null);
  const cycleLabel =
    cleanText(playerContext?.cycleLabel) ??
    (input.canUseLiveCycleFallback ? cleanText(input.fallbackCycleLabel) : null);
  const cycleProgressLabel =
    cleanText(playerContext?.cycleProgressLabel) ??
    (input.canUseLiveCycleFallback ? cleanText(input.fallbackCycleProgressLabel) : null);

  const { playerRationale, playerRationaleTitle } = buildPlayerRationale(input.tsb);

  const adaptationLabels = (() => {
    const backendLabels = sanitizeLabels(playerContext?.adaptationLabels);
    if (backendLabels.length > 0) return backendLabels;

    return buildLegacyAdaptationLabels({
      profilePosition: input.profilePosition,
      tsb: input.tsb,
      location: input.v2.location ?? null,
      cyclePhaseLabel,
    });
  })();

  const locationTag = adaptationLabels.some((label) => label.toLowerCase().startsWith("cadre:"))
    ? null
    : cleanText(input.v2.location);

  return {
    cycleLabel,
    cycleProgressLabel,
    cyclePhaseLabel,
    adaptationLabels,
    playerRationaleTitle,
    playerRationale,
    coachNote:
      stripCoachPrefix(cleanText(playerContext?.coachNote)) ??
      buildLegacyCoachNote({
        tsb: input.tsb,
        intensity: input.v2.intensity ?? null,
        cyclePhaseLabel,
      }),
    locationTag,
  };
}
