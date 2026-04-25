import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { showToast } from "../../utils/toast";
import {
  MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
  isMicrocycleId,
} from "../../domain/microcycles";
import { DEV_FLAGS } from "../../config/devFlags";
import { toDateKey } from "../../utils/dateHelpers";
import { openSessionEntry } from "../../utils/sessionEntry";
import type { Session } from "../../domain/types";
import { isSessionCompleted } from "../../utils/sessionStatus";
import { shouldSurfaceAsPendingSession } from "../../utils/sessionFallback";

type Nav = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

type Params = {
  nav: Nav;
  sessions: Session[];
  lastAiSessionV2: { v2: Record<string, unknown>; date: string; sessionId: string } | null;
  microcycleGoal: string | null;
  microcycleSessionIndex?: number | null;
  hasAppliedToday: boolean;
  tsb: number;
  devNowISO?: string;
};

export function usePrimaryCta({
  nav,
  sessions,
  lastAiSessionV2,
  microcycleGoal,
  microcycleSessionIndex,
  hasAppliedToday,
  tsb,
  devNowISO,
}: Params) {
  const pendingSession = useMemo(() => {
    const toSessionTime = (session: Session) => {
      const key = toDateKey(session?.dateISO ?? session?.date);
      if (!key) return Number.POSITIVE_INFINITY;
      const time = new Date(`${key}T12:00:00`).getTime();
      return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
    };

    return [...sessions]
      .filter((session) => !isSessionCompleted(session))
      .filter((session) => shouldSurfaceAsPendingSession(session))
      .sort((a, b) => {
        const da = toSessionTime(a);
        const db = toSessionTime(b);
        if (da === db) {
          const ca = new Date(a?.createdAt ?? 0).getTime();
          const cb = new Date(b?.createdAt ?? 0).getTime();
          return ca - cb;
        }
        return da - db;
      })[0];
  }, [sessions]);

  const todayKey = useMemo(() => {
    const now = devNowISO ? new Date(devNowISO) : new Date();
    return toDateKey(now);
  }, [devNowISO]);

  const upcomingSessionLabel = useMemo(() => {
    if (!pendingSession) return "Pas de séance prévue";
    const v2 = pendingSession.aiV2 ?? pendingSession.ai;
    if (v2) {
      const title = v2.title || "Séance FKS";
      const focusVal = v2.focusPrimary ?? v2.focus_primary;
      const focus = focusVal ? ` · ${focusVal}` : "";
      const intensity = v2.intensity ? ` · ${v2.intensity}` : "";
      const durationVal = v2.durationMin ?? v2.duration_min;
      const duration =
        typeof durationVal === "number" ? ` · ${Math.round(durationVal)} min` : "";
      return `${title}${focus}${intensity}${duration}`;
    }
    const focus = pendingSession.focus ?? pendingSession.modality ?? "-";
    const intensity = pendingSession.intensity ?? "-";
    return `Séance prévue · ${intensity} · ${focus}`;
  }, [pendingSession]);

  const pendingDateKey = toDateKey(
    pendingSession?.dateISO ?? pendingSession?.date
  );
  const isPendingToday = pendingDateKey && pendingDateKey === todayKey;

  const startPendingSession = useCallback(() => {
    if (!pendingSession) return;
    void openSessionEntry(nav as any, pendingSession, lastAiSessionV2?.v2 ?? null);
  }, [nav, pendingSession, lastAiSessionV2]);

  const onPressNew = useCallback(() => {
    const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
    const microIdx = Math.max(0, Math.trunc(microcycleSessionIndex ?? 0));
    const cycleCompleted =
      Boolean(cycleId) && microIdx >= MICROCYCLE_TOTAL_SESSIONS_DEFAULT;

    if (!cycleId || cycleCompleted) {
      nav.navigate("CycleModal", { mode: "select", origin: "home" });
      return;
    }

    if (pendingSession && !DEV_FLAGS.ENABLED) {
      const date = toDateKey(pendingSession.dateISO ?? pendingSession.date);
      Alert.alert(
        "Ta séance est déjà prête",
        date
          ? `Ouvre la séance du ${date} pour la faire ou la reprendre avant d'en lancer une nouvelle.`
          : "Ouvre ta séance en cours avant d'en lancer une nouvelle.",
        [
          {
            text: "Ouvrir ma séance",
            onPress: () => {
              void openSessionEntry(
                nav as any,
                pendingSession,
                lastAiSessionV2?.v2 ?? null
              );
            },
          },
          {
            text: "J'ai fini, feedback",
            onPress: () => nav.navigate("Feedback", { sessionId: pendingSession.id }),
          },
          { text: "Annuler", style: "cancel" },
        ]
      );
      return;
    }

    if (hasAppliedToday) {
      if (!DEV_FLAGS.ENABLED) {
        showToast({
          type: "info",
          title: "C'est fait pour aujourd'hui",
          message:
            "Tu as déjà fait ta séance. Reviens demain ou ajoute une activité externe.",
        });
        return;
      }
    }

    nav.navigate("NewSession");
  }, [
    nav,
    microcycleGoal,
    microcycleSessionIndex,
    pendingSession,
    lastAiSessionV2,
    hasAppliedToday,
  ]);

  const goToRecovery = useCallback(() => {
    nav.navigate("PrebuiltSessions");
  }, [nav]);

  const primaryCta = useMemo(() => {
    if (tsb <= -15) {
      return {
        label: "Journée récup",
        sub: "Ton corps a besoin de souffler. Fais une séance légère.",
        tone: "warn" as const,
        disabled: false,
        onPress: goToRecovery,
      };
    }

    if (isPendingToday) {
      return {
        label: "Ouvrir ma séance",
        sub: upcomingSessionLabel,
        tone: "primary" as const,
        disabled: false,
        onPress: startPendingSession,
      };
    }

    if (pendingSession) {
      return {
        label: "Ouvrir ma séance",
        sub: upcomingSessionLabel,
        tone: "primary" as const,
        disabled: false,
        onPress: startPendingSession,
      };
    }

    if (hasAppliedToday && !DEV_FLAGS.ENABLED) {
      return {
        label: "Journée off",
        sub: "Tu as déjà fait ta séance aujourd'hui.",
        tone: "disabled" as const,
        disabled: true,
        onPress: undefined,
      };
    }

    return {
      label: "Préparer ma séance",
      sub: "On te prépare un programme adapté en 2 min.",
      tone: "primary" as const,
      disabled: false,
      onPress: onPressNew,
    };
  }, [
    tsb,
    isPendingToday,
    pendingSession,
    hasAppliedToday,
    upcomingSessionLabel,
    startPendingSession,
    onPressNew,
    goToRecovery,
  ]);

  return {
    primaryCta,
    upcomingSessionLabel,
    pendingSession,
    startPendingSession,
    onPressNew,
  };
}
