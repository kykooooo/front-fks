import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { showToast } from "../../utils/toast";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../../domain/microcycles";
import { DEV_FLAGS } from "../../config/devFlags";
import { toDateKey } from "../../utils/dateHelpers";

type Nav = {
  navigate: (screen: string, params?: any) => void;
};

type Params = {
  nav: Nav;
  sessions: any[];
  lastAiSessionV2: any;
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
  const pendingSession = useMemo(
    () => {
      const toSessionTime = (session: any) => {
        const key = toDateKey(session?.dateISO ?? session?.date);
        if (!key) return Number.POSITIVE_INFINITY;
        const time = new Date(`${key}T12:00:00`).getTime();
        return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
      };

      return [...sessions]
        .filter((s: any) => !s.completed)
        .sort((a: any, b: any) => {
          const da = toSessionTime(a);
          const db = toSessionTime(b);
          if (da === db) {
            const ca = new Date(a?.createdAt ?? 0).getTime();
            const cb = new Date(b?.createdAt ?? 0).getTime();
            return ca - cb;
          }
          return da - db;
        })[0];
    },
    [sessions]
  );

  const todayKey = useMemo(() => {
    const now = devNowISO ? new Date(devNowISO) : new Date();
    return toDateKey(now);
  }, [devNowISO]);

  const upcomingSessionLabel = useMemo(() => {
    if (!pendingSession) return "Pas de séance prévue";
    const v2 = (pendingSession as any).aiV2 ?? (pendingSession as any).ai;
    if (v2) {
      const title = v2.title || "Séance FKS";
      const focus = v2.focus_primary ? ` · ${v2.focus_primary}` : "";
      const intens = v2.intensity ? ` · ${v2.intensity}` : "";
      const dur =
        typeof v2.duration_min === "number" ? ` · ${Math.round(v2.duration_min)} min` : "";
      return `${title}${focus}${intens}${dur}`;
    }
    const focus = (pendingSession as any)?.focus ?? (pendingSession as any)?.modality ?? "-";
    const intens = (pendingSession as any)?.intensity ?? "-";
    return `Séance prévue · ${intens} · ${focus}`;
  }, [pendingSession]);

  const pendingDateKey = toDateKey(
    (pendingSession as any)?.dateISO ?? (pendingSession as any)?.date
  );
  const isPendingToday = pendingDateKey && pendingDateKey === todayKey;

  const startPendingSession = useCallback(() => {
    if (!pendingSession) return;
    const v2 =
      (pendingSession as any).aiV2 ??
      (pendingSession as any).ai ??
      lastAiSessionV2?.v2;
    const plannedDateISO = toDateKey(
      (pendingSession as any).dateISO ?? (pendingSession as any).date
    );
    if (v2) {
      nav.navigate("SessionLive", {
        v2,
        plannedDateISO,
        sessionId: (pendingSession as any).id,
      });
      return;
    }
    nav.navigate("SessionPreview", {
      v2: lastAiSessionV2?.v2,
      plannedDateISO,
      sessionId: (pendingSession as any).id,
    });
  }, [nav, pendingSession, lastAiSessionV2]);

  const onPressNew = useCallback(() => {
    const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
    const microIdx = Math.max(0, Math.trunc(microcycleSessionIndex ?? 0));
    const cycleCompleted = Boolean(cycleId) && microIdx >= MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
    if (!cycleId || cycleCompleted) {
      nav.navigate("CycleModal", { mode: "select", origin: "home" });
      return;
    }

    if (pendingSession && !DEV_FLAGS.ENABLED) {
      const date = toDateKey((pendingSession as any).dateISO ?? (pendingSession as any).date);
      Alert.alert(
        "Dis-nous comment ça s'est passé",
        date
          ? `Dis-nous comment s'est passée la séance du ${date} avant d'en lancer une nouvelle.`
          : "Dis-nous comment s'est passée ta dernière séance avant d'en lancer une nouvelle.",
        [
          {
            text: "C'est parti",
            onPress: () =>
              nav.navigate(
                "Feedback",
                { sessionId: (pendingSession as any).id }
              ),
          },
          {
            text: "Voir la séance",
            onPress: () => {
              const v2 =
                (pendingSession as any).aiV2 ??
                (pendingSession as any).ai ??
                lastAiSessionV2?.v2;
              const plannedDateISO =
                toDateKey((pendingSession as any).dateISO ?? (pendingSession as any).date);
              if (v2) {
                nav.navigate("SessionPreview", {
                  v2,
                  plannedDateISO,
                  sessionId: (pendingSession as any).id,
                });
              }
            },
          },
          { text: "Annuler", style: "cancel" },
        ]
      );
      return;
    }

    if (hasAppliedToday) {
      if (DEV_FLAGS.ENABLED) {
        // mode dev : on autorise plusieurs séances par jour
      } else {
        showToast({ type: "info", title: "C'est fait pour aujourd'hui", message: "Tu as déjà fait ta séance. Reviens demain ou ajoute une activité externe." });
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
        label: "C'est parti !",
        sub: upcomingSessionLabel,
        tone: "primary" as const,
        disabled: false,
        onPress: startPendingSession,
      };
    }
    if (pendingSession) {
      return {
        label: "Ma séance est prête",
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

  return { primaryCta, upcomingSessionLabel, pendingSession, startPendingSession, onPressNew };
}
