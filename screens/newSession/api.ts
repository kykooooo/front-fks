import { getAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BACKEND_URL } from "../../config/backend";
import { firebaseWebConfig } from "../../config/firebaseConfig";
import { BACKEND_EXERCISE_IDS } from "../../engine/backendExerciseIds";
import { EXERCISE_BY_ID } from "../../engine/exerciseBank";
import type { FKS_NextSessionV2 } from "./types";
import { safeFetch, BackendError } from "../../utils/errorHandler";
import { sessionV2Schema } from "../../schemas/sessionSchema";
import { snakeToCamel } from "../../utils/caseTransform";
import { sanitizeCoachText, sanitizeCoachTextList } from "../../utils/sanitizeCoachText";

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

function hashContext(context: Record<string, unknown>): string {
  // Exclure allowed_exercises (toujours identique ~20KB) et flags debug du hash
  const { allowed_exercises, debug, debug_allow_all_exercises, ...rest } = context;
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
  const normalizedEquipment = Array.from(
    new Set(
      selectedEquipment.flatMap((id) => [id])
    )
  );
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
  context: Record<string, unknown>
): Promise<{ v2: FKS_NextSessionV2; debug: Record<string, unknown> }> {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  // Firebase Auth est la SEULE source d'auth backend : si pas d'utilisateur connecté,
  // le backend va refuser (401). On bloque ici avec un message clair plutôt que de
  // laisser passer une requête qui va échouer côté serveur.
  if (!currentUser) {
    throw new BackendError(
      401,
      "Unauthorized",
      "Connexion requise pour générer une séance",
      "Tu dois être connecté pour générer une séance. Reconnecte-toi et réessaie."
    );
  }
  const userId = currentUser.uid;
  const idToken = await currentUser.getIdToken();
  const url = `${BACKEND_URL}/api/fks/generate`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${idToken}`,
  };
  if (firebaseWebConfig.apiKey) {
    headers["x-fks-firebase-api-key"] = firebaseWebConfig.apiKey;
  }

  // Timeout long : Render free-tier cold start (~30-50s) + génération IA (~15s)
  const fetchOptions = {
    method: "POST",
    headers,
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

  const v2 = snakeToCamel<FKS_NextSessionV2>(parsed.data);
  // Défense en profondeur : si une phrase toxique (culpabilisation, diagnostic médical,
  // message technique) a échappé au nettoyage backend, on la neutralise avant affichage.
  // Voir INJURY_IA_CHARTER.md côté back et utils/sanitizeCoachText.ts côté front.
  const sanitizedV2 = sanitizeSessionText(v2);
  return { v2: sanitizedV2, debug: data };
}

function sanitizeSessionText(v2: FKS_NextSessionV2): FKS_NextSessionV2 {
  const cleaned: FKS_NextSessionV2 = {
    ...v2,
    title: sanitizeCoachText(v2.title),
    subtitle: sanitizeCoachText(v2.subtitle ?? null),
    sessionTheme: sanitizeCoachText(v2.sessionTheme ?? null),
    coachingTips: sanitizeCoachTextList(v2.coachingTips),
    recoveryTips: sanitizeCoachTextList(v2.recoveryTips),
    injuryAdaptationExplanation: sanitizeCoachText(v2.injuryAdaptationExplanation ?? null),
    blocks: Array.isArray(v2.blocks)
      ? v2.blocks.map((block: any) => ({
          ...block,
          goal: sanitizeCoachText(block?.goal ?? null),
          items: Array.isArray(block?.items)
            ? block.items.map((item: any) => ({
                ...item,
                description: sanitizeCoachText(item?.description ?? null),
                footballContext: sanitizeCoachText(item?.footballContext ?? null),
                notes: sanitizeCoachText(item?.notes ?? null),
              }))
            : block?.items,
        }))
      : v2.blocks,
  } as FKS_NextSessionV2;
  return cleaned;
}
