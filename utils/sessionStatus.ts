import type { Session, SessionStatus } from "../domain/types";

type SessionLike = Partial<Pick<Session, "status" | "completed" | "feedback" | "rpe" | "startedAt">> | null | undefined;

export function getSessionStatus(session: SessionLike): SessionStatus {
  if (!session) return "planned";

  if (
    session.status === "planned" ||
    session.status === "in_progress" ||
    session.status === "completed"
  ) {
    return session.status;
  }

  if (session.completed === true || session.feedback != null || session.rpe != null) {
    return "completed";
  }

  if (typeof session.startedAt === "string" && session.startedAt.trim().length > 0) {
    return "in_progress";
  }

  return "planned";
}

export function isSessionCompleted(session: SessionLike) {
  return getSessionStatus(session) === "completed";
}

export function isSessionInProgress(session: SessionLike) {
  return getSessionStatus(session) === "in_progress";
}

export function isSessionPlanned(session: SessionLike) {
  return getSessionStatus(session) === "planned";
}
