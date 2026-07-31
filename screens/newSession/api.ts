import { getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BACKEND_URL, backendAuthHeaders } from "../../config/backend";
import { BACKEND_EXERCISE_IDS } from "../../engine/backendExerciseIds";
import { EXERCISE_BY_ID } from "../../engine/exerciseBank";
import type { FKS_NextSessionV2 } from "./types";
import { safeFetch, BackendError } from "../../utils/errorHandler";
import { detecterSentinellesReparation, estSeanceReparee, sessionV2Schema } from "../../schemas/sessionSchema";
import { snakeToCamel } from "../../utils/caseTransform";

// TODO: Backend optimization — envoyer uniquement les IDs d'exercices au lieu des objets
// complets (~20 KB économisés par requête). Nécessite que le backend maintienne sa propre
// banque d'exercices côté serveur. Actuellement le backend dépend des données complètes
// envoyées par le client pour le matching des token pools.
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

/* ─── Session cache ─── */
const SESSION_CACHE_KEY = "fks_session_cache_v1";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Exporté pour les tests (stabilité du hash de cache). */
export function hashContext(context: Record<string, unknown>): string {
  // Exclure du hash : allowed_exercises (toujours identique ~20KB), flags debug,
  // et les horloges nowISO/devNowISO — elles changent à chaque milliseconde,
  // donc les garder rendait le cache inatteignable (chaque re-génération
  // repayait un appel LLM alors que le contexte réel était identique).
  const rest: Record<string, unknown> = { ...context };
  delete rest.allowed_exercises;
  delete rest.debug;
  delete rest.debug_allow_all_exercises;
  delete rest.nowISO;
  delete rest.devNowISO;
  const str = JSON.stringify(rest);
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

type CachedSession = {
  hash: string;
  timestamp: number;
  response: { v2: FKS_NextSessionV2; debug: Record<string, unknown> };
};

/** Vérifie si un cache récent (<5 min) existe pour ce contexte. */
export async function getSessionCache(
  context: Record<string, unknown>
): Promise<{ v2: FKS_NextSessionV2; debug: Record<string, unknown>; ageMs: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedSession = JSON.parse(raw);
    if (!cached || typeof cached !== "object") return null;

    const hash = hashContext(context);
    if (cached.hash !== hash) return null;

    const ageMs = Date.now() - cached.timestamp;
    if (ageMs > CACHE_TTL_MS) return null;

    return { ...cached.response, ageMs };
  } catch {
    return null;
  }
}

/** Sauvegarde la réponse API dans le cache. */
export async function setSessionCache(
  context: Record<string, unknown>,
  response: { v2: FKS_NextSessionV2; debug: Record<string, unknown> }
): Promise<void> {
  try {
    const cached: CachedSession = {
      hash: hashContext(context),
      timestamp: Date.now(),
      response,
    };
    await AsyncStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Échec écriture cache — non critique
  }
}

/** Supprime le cache de séance. */
export async function clearSessionCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // non critique
  }
}

import type { FKS_AiContext } from "../../services/aiContext";

// The backend context is a superset of FKS_AiContext with extra fields
// Use Record<string, unknown> intersection for the extra backend-specific fields
type BackendCtx = FKS_AiContext & Record<string, unknown>;

export function prepareBackendContext(
  ctx: FKS_AiContext,
  selectedEquipment: string[],
  environment: string[]
) {
  // Salle : l'UI promet « Équipement standard inclus par défaut » (haltères,
  // barres, bancs, machines) — le payload doit donc TOUJOURS porter gym_full,
  // en plus des sélections explicites. Sans lui, le backend filtre strictement
  // sur la sélection (ex: ["barbell"] seule) et la séance salle est appauvrie
  // en silence. Côté backend, gym_full n'inclut PAS medball (zéro ballon).
  const withGymDefaults = environment.includes("gym")
    ? [...selectedEquipment, "gym_full", "bodyweight"]
    : selectedEquipment;
  // "Sans matériel" (terrain/maison sans coche) est un choix assumé : le
  // moteur gère nativement le poids du corps, donc le payload ne doit
  // jamais partir avec une liste vide — cf. EquipmentSelector (plus aucun
  // blocage "Matériel requis" côté UI).
  const normalizedEquipment = withGymDefaults.length > 0
    ? Array.from(new Set(withGymDefaults))
    : ["bodyweight"];
  const resolvedGoal = ctx.profile?.goal ?? ctx.goal ?? "fondation";
  const constraints = ctx.constraints as Record<string, unknown> | undefined;
  const profile = ctx.profile as Record<string, unknown>;
  const availableTimeMin =
    typeof constraints?.available_time_min === "number"
      ? constraints.available_time_min
      : typeof ctx?.available_time_min === "number"
      ? ctx.available_time_min
      : typeof profile?.available_time_min === "number"
      ? profile.available_time_min as number
      : undefined;
  const derivedVenue = environment.includes("gym")
    ? "gym"
    : environment.includes("pitch") || environment.includes("field")
    ? "field"
    : "home";
  const venue =
    environment.length > 0
      ? derivedVenue
      : (constraints?.venue as string | undefined) ?? (profile?.venue as string | undefined) ?? derivedVenue;
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
      ...(ctx.constraints ?? {}),
      venue,
      equipment: normalizedEquipment,
      pains: ctx.constraints?.pains ?? [],
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
  context: Record<string, unknown>,
  options?: { onRetry?: (reason: "timeout" | "network") => void }
): Promise<{ v2: FKS_NextSessionV2; debug: Record<string, unknown> }> {
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
    // Retry une fois sur timeout OU échec réseau : un cold start Render peut
    // dépasser la limite système iOS (~60s) AVANT notre AbortController (90s),
    // ce qui sort en "Network request failed"/"Failed to fetch" plutôt qu'en
    // ETIMEDOUT — le 2e essai tombe sur un serveur déjà réveillé.
    const isTimeout = firstError.code === "ETIMEDOUT";
    const isNetwork = firstError.code === "NETWORK_ERROR";
    if (isTimeout || isNetwork) {
      options?.onRetry?.(isTimeout ? "timeout" : "network");
      r = await safeFetch(url, fetchOptions, 90000);
    } else {
      throw firstError;
    }
  }

  const data = (await r.json()) as Record<string, unknown>;

  // Validation de la réponse
  if (!data || typeof data.v2 !== "object" || data.v2 === null) {
    throw new BackendError(
      500,
      'Invalid Response',
      'Le serveur a retourné une réponse invalide',
      'La génération de séance a échoué. Le serveur n\'a pas renvoyé de séance valide. Réessaie ou contacte le support si le problème persiste.'
    );
  }

  const parsed = sessionV2Schema.safeParse(data.v2);

  if (!parsed.success) {
    if (__DEV__) {
      console.warn("[FKS] Session V2 validation failed:", JSON.stringify(parsed.error.issues, null, 2));
    }
    throw new BackendError(
      500,
      'Validation Error',
      'La séance reçue est incomplète ou corrompue',
      'Le serveur a renvoyé une séance invalide. Réessaie dans quelques instants.'
    );
  }

  // Un manque de données ne devient jamais une fausse séance : le schéma
  // répare champ par champ (title/duration_min/blocks retombent sur une
  // valeur plausible plutôt que de faire échouer tout le parse), ce qui rend
  // la réparation invisible en aval. Au-delà du seuil (ou blocks vide, quel
  // que soit le seuil), on refuse au lieu de laisser passer une coquille —
  // même mécanique de corps typé que le reste (§2 de docs/CONTRAT_ERREUR_FRONT.md),
  // lu automatiquement par lireEchecGeneration comme un code "SESSION_SCHEMA_INVALID".
  if (estSeanceReparee(parsed.data)) {
    if (__DEV__) {
      console.warn(
        "[FKS] Session V2 reparee au-dela du seuil, refusee :",
        detecterSentinellesReparation(parsed.data)
      );
    }
    throw new BackendError(
      422,
      'Unprocessable Entity',
      JSON.stringify({
        error: 'SESSION_SCHEMA_INVALID',
        code: 'SESSION_SCHEMA_INVALID',
        category: 'technique',
        retryable: false,
        message:
          "Le serveur a renvoyé une séance incomplète. Rien n'a été ajouté à ton programme. Réessaie dans quelques instants.",
        failedStep: 'schema.validation',
        requestId: null,
      })
    );
  }

  const v2 = snakeToCamel<FKS_NextSessionV2>(parsed.data);
  return { v2, debug: data };
}
