import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { showToast } from "../../utils/toast";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../../domain/microcycles";
import { DEV_FLAGS } from "../../config/devFlags";
import { toDateKey } from "../../utils/dateHelpers";
import { selectPendingSession } from "../../utils/sessionHelpers";
import { useNavGuard } from "../useNavGuard";
import { frFocus, frIntensity } from "../../utils/frLabels";
import type { Session } from "../../domain/types";

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
  const guardNav = useNavGuard();

  const todayKey = useMemo(() => {
    const now = devNowISO ? new Date(devNowISO) : new Date();
    return toDateKey(now);
  }, [devNowISO]);

  // Même fenêtre que FeedbackScreen : une séance non complétée hors fenêtre
  // (zombie) ne bloque plus le CTA — voir selectPendingSession.
  const pendingSession = useMemo(
    () => selectPendingSession(sessions, todayKey),
    [sessions, todayKey]
  );

  const upcomingSessionLabel = useMemo(() => {
    if (!pendingSession) return "Pas de séance prévue";
    const v2 = pendingSession.aiV2 ?? pendingSession.ai;
    if (v2) {
      const title = v2.title || "Séance FKS";
      const focusVal = v2.focusPrimary ?? v2.focus_primary;
      const focus = focusVal ? ` · ${frFocus(String(focusVal))}` : "";
      const intens = v2.intensity ? ` · ${frIntensity(String(v2.intensity))}` : "";
      const durVal = v2.durationMin ?? v2.duration_min;
      const dur =
        typeof durVal === "number" ? ` · ${Math.round(durVal)} min` : "";
      return `${title}${focus}${intens}${dur}`;
    }
    const focus = frFocus(pendingSession.focus ?? pendingSession.modality) || "-";
    const intens = frIntensity(pendingSession.intensity) || "-";
    return `Séance prévue · ${intens} · ${focus}`;
  }, [pendingSession]);

  const pendingDateKey = toDateKey(
    pendingSession?.dateISO ?? pendingSession?.date
  );
  const isPendingToday = pendingDateKey && pendingDateKey === todayKey;

  // Lance directement la séance (SessionLive) — utilisé par le CTA "C'est parti !".
  const startPendingSession = useCallback(() => {
    if (!pendingSession) return;
    const v2 =
      pendingSession.aiV2 ??
      pendingSession.ai ??
      lastAiSessionV2?.v2;
    if (!v2) {
      showToast({
        type: "warn",
        title: "Séance indisponible",
        message: "Le contenu de cette séance est introuvable. Relance une génération.",
      });
      return;
    }
    const plannedDateISO = toDateKey(
      pendingSession.dateISO ?? pendingSession.date
    );
    guardNav(() => {
      nav.navigate("SessionLive", {
        v2,
        plannedDateISO,
        sessionId: pendingSession.id,
      });
    });
  }, [nav, pendingSession, lastAiSessionV2, guardNav]);

  // Ouvre l'aperçu de la séance (SessionPreview) — utilisé par "Voir la séance".
  const viewPendingSession = useCallback(() => {
    if (!pendingSession) return;
    const v2 =
      pendingSession.aiV2 ??
      pendingSession.ai ??
      lastAiSessionV2?.v2;
    if (!v2) {
      showToast({
        type: "warn",
        title: "Séance indisponible",
        message: "Le contenu de cette séance est introuvable. Relance une génération.",
      });
      return;
    }
    const plannedDateISO = toDateKey(
      pendingSession.dateISO ?? pendingSession.date
    );
    guardNav(() => {
      nav.navigate("SessionPreview", {
        v2,
        plannedDateISO,
        sessionId: pendingSession.id,
      });
    });
  }, [nav, pendingSession, lastAiSessionV2, guardNav]);

  const onPressNew = useCallback(() => {
    const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
    const microIdx = Math.max(0, Math.trunc(microcycleSessionIndex ?? 0));
    const cycleCompleted = Boolean(cycleId) && microIdx >= MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
    if (!cycleId || cycleCompleted) {
      guardNav(() => nav.navigate("CycleModal", { mode: "select", origin: "home" }));
      return;
    }

    if (pendingSession && !DEV_FLAGS.ENABLED) {
      const date = toDateKey(pendingSession.dateISO ?? pendingSession.date);
      Alert.alert(
        "Dis-nous comment ça s'est passé",
        date
          ? `Dis-nous comment s'est passée la séance du ${date} avant d'en lancer une nouvelle.`
          : "Dis-nous comment s'est passée ta dernière séance avant d'en lancer une nouvelle.",
        [
          {
            text: "C'est parti",
            onPress: () =>
              guardNav(() =>
                nav.navigate("Feedback", { sessionId: pendingSession.id })
              ),
          },
          {
            text: "Voir la séance",
            onPress: () => {
              const v2 =
                pendingSession.aiV2 ??
                pendingSession.ai ??
                lastAiSessionV2?.v2;
              const plannedDateISO =
                toDateKey(pendingSession.dateISO ?? pendingSession.date);
              if (v2) {
                guardNav(() =>
                  nav.navigate("SessionPreview", {
                    v2,
                    plannedDateISO,
                    sessionId: pendingSession.id,
                  })
                );
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
    guardNav(() => nav.navigate("NewSession"));
  }, [
    nav,
    microcycleGoal,
    microcycleSessionIndex,
    pendingSession,
    lastAiSessionV2,
    hasAppliedToday,
    guardNav,
  ]);

  const goToRecovery = useCallback(() => {
    guardNav(() => nav.navigate("PrebuiltSessions"));
  }, [nav, guardNav]);

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

  return {
    primaryCta,
    upcomingSessionLabel,
    pendingSession,
    startPendingSession,
    viewPendingSession,
    onPressNew,
  };
}
