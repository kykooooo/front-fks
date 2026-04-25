import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "../domain/types";
import type { FKS_NextSessionV2 } from "../screens/newSession/types";
import { toDateKey } from "./dateHelpers";

export const LIVE_SESSION_KEY = "fks_live_session";
const LIVE_SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000;

type PersistedLiveState = {
  sessionId?: string;
  checkedSets?: Record<string, boolean[]>;
  activeBlock?: number;
  sessionSec?: number;
  sessionRunning?: boolean;
  savedAt?: number;
};

type SessionEntryNavigation = {
  navigate: (screen: "SessionPreview", params: {
    v2: FKS_NextSessionV2;
    plannedDateISO: string;
    sessionId?: string;
  }) => void;
};

export type SessionEntryTarget = {
  mode: "preview";
  v2: FKS_NextSessionV2;
  plannedDateISO: string;
  sessionId?: string;
};

function hasMeaningfulLiveProgress(saved: PersistedLiveState) {
  const checkedProgress = Object.values(saved.checkedSets ?? {}).some((sets) =>
    Array.isArray(sets) && sets.some(Boolean)
  );
  return checkedProgress || (saved.sessionSec ?? 0) > 30 || !!saved.sessionRunning;
}

export async function hasRecoverableLiveState(sessionId?: string | null) {
  if (!sessionId) return false;
  try {
    const raw = await AsyncStorage.getItem(LIVE_SESSION_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as PersistedLiveState;
    if (saved.sessionId !== sessionId) return false;
    if (
      typeof saved.savedAt !== "number" ||
      Date.now() - saved.savedAt >= LIVE_SESSION_MAX_AGE_MS
    ) {
      return false;
    }
    return hasMeaningfulLiveProgress(saved);
  } catch {
    return false;
  }
}

export async function resolveSessionEntryTarget(
  session: Session | null | undefined,
  fallbackV2?: Record<string, unknown> | null
): Promise<SessionEntryTarget | null> {
  if (!session) return null;
  const rawV2 = session.aiV2 ?? session.ai ?? fallbackV2;
  if (!rawV2) return null;
  const plannedDateISO =
    toDateKey(session.dateISO ?? session.date) ?? toDateKey(new Date()) ?? "";

  return {
    // Single-screen session flow:
    // always open SessionPreview and let it handle start/resume UX inline.
    mode: "preview",
    v2: rawV2 as FKS_NextSessionV2,
    plannedDateISO,
    sessionId: session.id,
  };
}

export async function openSessionEntry(
  navigation: SessionEntryNavigation,
  session: Session | null | undefined,
  fallbackV2?: Record<string, unknown> | null
) {
  const target = await resolveSessionEntryTarget(session, fallbackV2);
  if (!target) return null;
  navigation.navigate("SessionPreview", {
    v2: target.v2,
    plannedDateISO: target.plannedDateISO,
    sessionId: target.sessionId,
  });
  return target;
}
