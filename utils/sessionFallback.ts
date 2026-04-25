import type { Session } from "../domain/types";
import { getSessionStatus, isSessionCompleted } from "./sessionStatus";

type SessionLike =
  | Partial<Pick<Session, "id" | "title" | "aiV2" | "ai" | "status" | "completed" | "startedAt" | "feedback" | "rpe">>
  | null
  | undefined;

function hasFallbackMarker(payload: Record<string, unknown> | null | undefined) {
  if (!payload) return false;

  const title = typeof payload.title === "string" ? payload.title.trim().toLowerCase() : "";
  if (title.includes("fallback")) return true;

  const guardrails = Array.isArray(payload.guardrailsApplied)
    ? payload.guardrailsApplied.filter((value): value is string => typeof value === "string")
    : [];

  return guardrails.includes("fallback_safe");
}

export function isFallbackSession(session: SessionLike) {
  if (!session) return false;

  if (typeof session.id === "string" && session.id.startsWith("fallback_")) {
    return true;
  }

  if (typeof session.title === "string" && session.title.trim().toLowerCase().includes("fallback")) {
    return true;
  }

  const aiV2 = session.aiV2 as Record<string, unknown> | undefined;
  if (hasFallbackMarker(aiV2)) return true;

  const ai = session.ai as Record<string, unknown> | undefined;
  return hasFallbackMarker(ai);
}

export function shouldSurfaceAsPendingSession(session: SessionLike) {
  if (!session || isSessionCompleted(session)) return false;
  if (!isFallbackSession(session)) return true;

  return getSessionStatus(session) === "in_progress";
}
