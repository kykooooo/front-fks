import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BACKEND_URL } from "../config/backend";
import { FKS_CATALOG_V2_ENABLED } from "../config/features";
import bundledSnapshot from "../assets/exercise-catalog-v2.json";
import {
  HISTORICAL_EXERCISE_ALIASES,
  exerciseCatalogManifestSchema,
  resolveCatalogId,
  type ExerciseCatalogManifest,
} from "../engine/exerciseCatalogV2";

const CACHE_KEY = "fks_exercise_catalog_v2";
const ETAG_KEY = "fks_exercise_catalog_v2_etag";

/**
 * Journalise un incident catalogue sans jamais faire planter l'app. Les échecs
 * réseau / cache corrompu sont tolérés : on garde le cache ou le snapshot.
 */
const logCatalogIssue = (code: string, detail?: unknown) => {
  if (__DEV__) console.warn(`[catalog_v2] ${code}`, detail ?? "");
};

const parsedBundled = exerciseCatalogManifestSchema.parse(bundledSnapshot);
let currentCatalog: ExerciseCatalogManifest = parsedBundled;
let hydrationPromise: Promise<ExerciseCatalogManifest> | null = null;
const listeners = new Set<() => void>();

const publish = (catalog: ExerciseCatalogManifest) => {
  if (
    catalog.catalogVersion === currentCatalog.catalogVersion &&
    catalog.contentHash === currentCatalog.contentHash
  ) {
    return;
  }
  currentCatalog = catalog;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getExerciseCatalogSnapshot = () => currentCatalog;

export const useExerciseCatalog = () =>
  useSyncExternalStore(subscribe, getExerciseCatalogSnapshot, getExerciseCatalogSnapshot);

export function resolveExerciseCatalogId(id: string): string {
  // Flag OFF = ID backend conservé tel quel : la banque V1 (EXERCISE_BY_ID,
  // VETTED_BY_ID, instructions) est clé par les anciens IDs ; remapper ici
  // casserait fiches/vidéos et ferait collisionner le dédoublonnage de séance.
  if (!FKS_CATALOG_V2_ENABLED) return id;
  // Le manifeste live (API) prime sur la table de compat historique.
  return resolveCatalogId(id, {
    ...HISTORICAL_EXERCISE_ALIASES,
    ...currentCatalog.aliases,
  });
}

/**
 * À appeler (non bloquant) quand une séance arrive avec un `catalog_version`
 * différent de celui du catalogue en mémoire : on déclenche un rafraîchissement
 * en arrière-plan sans jamais bloquer l'affichage de la séance.
 */
export function reconcileCatalogVersion(
  sessionCatalogVersion?: string | null
): void {
  // Flag OFF : le pipeline V2 est inerte — aucun fetch, aucune lecture/écriture
  // de cache, aucune publication. Le gate du resolver ne suffit pas : ce point
  // d'entrée est déclenché par screens/newSession/api.ts à chaque séance reçue.
  if (!FKS_CATALOG_V2_ENABLED) return;
  if (!sessionCatalogVersion) return;
  if (sessionCatalogVersion === currentCatalog.catalogVersion) return;
  void refreshExerciseCatalog();
}

async function readCachedCatalog(): Promise<ExerciseCatalogManifest | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = exerciseCatalogManifestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      logCatalogIssue("cache_corrupt", parsed.error.issues);
      return null;
    }
    return parsed.data;
  } catch (error) {
    logCatalogIssue("cache_read_failed", error);
    return null;
  }
}

export async function refreshExerciseCatalog(): Promise<ExerciseCatalogManifest> {
  if (!BACKEND_URL) return currentCatalog;
  try {
    const etag = await AsyncStorage.getItem(ETAG_KEY);
    const response = await fetch(`${BACKEND_URL}/api/fks/catalog/exercises`, {
      headers: etag ? { "If-None-Match": etag } : undefined,
    });
    if (response.status === 304) return currentCatalog; // cache conservé
    if (!response.ok) {
      logCatalogIssue("fetch_http_error", response.status);
      return currentCatalog;
    }

    const parsed = exerciseCatalogManifestSchema.safeParse(await response.json());
    if (!parsed.success) {
      logCatalogIssue("manifest_invalid", parsed.error.issues);
      return currentCatalog;
    }

    publish(parsed.data);
    await AsyncStorage.multiSet([
      [CACHE_KEY, JSON.stringify(parsed.data)],
      [ETAG_KEY, response.headers.get("etag") ?? parsed.data.contentHash],
    ]);
  } catch (error) {
    // Réseau indisponible : le cache ou le snapshot restent servis hors ligne.
    logCatalogIssue("fetch_failed", error);
  }
  return currentCatalog;
}

export function hydrateExerciseCatalog(): Promise<ExerciseCatalogManifest> {
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    const cached = await readCachedCatalog();
    if (cached) publish(cached);
    return refreshExerciseCatalog();
  })();
  return hydrationPromise;
}

export async function clearExerciseCatalogCacheForTests(): Promise<void> {
  hydrationPromise = null;
  currentCatalog = parsedBundled;
  await AsyncStorage.multiRemove([CACHE_KEY, ETAG_KEY]);
  listeners.forEach((listener) => listener());
}
