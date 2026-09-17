import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import { showToast } from "../../utils/toast";
import { MICROCYCLES, MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../../domain/microcycles";
import { DEV_FLAGS } from "../../config/devFlags";
import { toDateKey } from "../../utils/dateHelpers";
import { selectPendingSession } from "../../utils/sessionHelpers";
import { useNavGuard } from "../useNavGuard";
import { frFocus, frIntensity } from "../../utils/frLabels";
import type { Session } from "../../domain/types";

type Nav = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

/**
 * true si presser "nouvelle séance" ouvre en réalité CycleModal (aucun cycle
 * actif, ou cycle terminé). Mêmes 3 lignes que le début de onPressNew — le
 * texte du CTA et sa navigation ne doivent jamais diverger. Exportée pure
 * pour les tests (pas de renderer dans le dépôt).
 */
export function computeNeedsCycleChoice(
  microcycleGoal: string | null,
  microcycleSessionIndex?: number | null
): boolean {
  const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
  const microIdx = Math.max(0, Math.trunc(microcycleSessionIndex ?? 0));
  const cycleCompleted = Boolean(cycleId) && microIdx >= MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  return !cycleId || cycleCompleted;
}

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

/**
 * Discriminant pur du CTA (SPEC_DA_ACCUEIL_SEANCE.md §2.3) — AJOUT PUR : les 6
 * branches ci-dessous et leurs libellés/onPress ne changent pas d'une ligne,
 * `kind` ne fait que NOMMER la branche déjà choisie pour que la carte
 * d'accueil sache quel gabarit rendre sans redupliquer la logique.
 */
export type PrimaryCtaKind =
  | "recovery"
  | "start_today"
  | "start_pending"
  | "day_off"
  | "choose_cycle"
  | "prepare";

type PrimaryCtaKindInputs = {
  tsb: number;
  isPendingToday: boolean;
  hasPendingSession: boolean;
  hasAppliedToday: boolean;
  devModeEnabled: boolean;
  microcycleGoal: string | null;
  microcycleSessionIndex?: number | null;
};

/**
 * Calcule `kind` en PREMIER, à partir des mêmes 5 conditions et dans le même
 * ordre de priorité que la chaîne if/else historique de `primaryCta`
 * ci-dessous — celle-ci ne fait plus que BRANCHER sur ce résultat (switch),
 * elle ne réévalue rien. Une seule implémentation des conditions : `kind` ne
 * peut donc jamais désigner une branche différente de celle réellement
 * choisie. Exportée pure pour les tests (même méthode que
 * `computeNeedsCycleChoice` : pas de renderer de hook dans le dépôt).
 */
export function computePrimaryCtaKind(inputs: PrimaryCtaKindInputs): PrimaryCtaKind {
  if (inputs.tsb <= -15) return "recovery";
  if (inputs.isPendingToday) return "start_today";
  if (inputs.hasPendingSession) return "start_pending";
  if (inputs.hasAppliedToday && !inputs.devModeEnabled) return "day_off";
  if (computeNeedsCycleChoice(inputs.microcycleGoal, inputs.microcycleSessionIndex)) {
    return "choose_cycle";
  }
  return "prepare";
}

/**
 * Description PURE d'une séance en attente, scindée en `titre` (nom de la
 * séance ou repli générique) et `meta` (« focus · intensité · durée », ou
 * `null` si rien à ajouter). `upcomingSessionLabel` est la concaténation
 * exacte de ces deux morceaux via `joindreTitreMeta` — la chaîne produite
 * reste identique au caractère près à l'ancienne implémentation à bloc
 * unique (test à l'appui : hooks/home/__tests__/decrireSeanceEnAttente.test.ts).
 */
export function decrireSeanceEnAttente(
  pendingSession: Session | null | undefined
): { titre: string; meta: string | null } {
  if (!pendingSession) return { titre: "Pas de séance prévue", meta: null };
  const v2 = pendingSession.aiV2 ?? pendingSession.ai;
  if (v2) {
    const titre = String(v2.title ?? "") || "Séance FKS";
    const focusVal = v2.focusPrimary ?? v2.focus_primary;
    const focus = focusVal ? frFocus(String(focusVal)) : "";
    const intens = v2.intensity ? frIntensity(String(v2.intensity)) : "";
    const durVal = v2.durationMin ?? v2.duration_min;
    const dur = typeof durVal === "number" ? `${Math.round(durVal)} min` : "";
    const parts = [focus, intens, dur].filter((p) => p.length > 0);
    return { titre, meta: parts.length ? parts.join(" · ") : null };
  }
  const focus = frFocus(pendingSession.focus ?? pendingSession.modality) || "-";
  const intens = frIntensity(pendingSession.intensity) || "-";
  return { titre: "Séance prévue", meta: `${intens} · ${focus}` };
}

/** Recompose la chaîne unique historique à partir de `decrireSeanceEnAttente`. */
export function joindreTitreMeta(titre: string, meta: string | null): string {
  return meta ? `${titre} · ${meta}` : titre;
}

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
    const { titre, meta } = decrireSeanceEnAttente(pendingSession);
    return joindreTitreMeta(titre, meta);
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
    // Route AppStack "GenerateSession" = le VRAI écran de génération
    // (l'onglet "NewSession" rend SessionHubScreen, un menu — le CTA mentait).
    guardNav(() => nav.navigate("GenerateSession"));
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
    // Une seule évaluation des conditions (computePrimaryCtaKind) ; le switch
    // ci-dessous ne fait que construire le libellé/onPress de la branche déjà
    // désignée — mêmes 6 résultats, mêmes textes, mêmes actions qu'avant
    // l'ajout de `kind`.
    const kind = computePrimaryCtaKind({
      tsb,
      isPendingToday: Boolean(isPendingToday),
      hasPendingSession: Boolean(pendingSession),
      hasAppliedToday,
      devModeEnabled: DEV_FLAGS.ENABLED,
      microcycleGoal,
      microcycleSessionIndex,
    });

    switch (kind) {
      case "recovery":
        return {
          label: "Journée récup",
          sub: "Ton corps a besoin de souffler. Fais une séance légère.",
          tone: "warn" as const,
          kind,
          disabled: false,
          onPress: goToRecovery,
        };
      case "start_today":
        return {
          label: "C'est parti !",
          sub: upcomingSessionLabel,
          tone: "primary" as const,
          kind,
          disabled: false,
          onPress: startPendingSession,
        };
      case "start_pending":
        return {
          label: "Ma séance est prête",
          sub: upcomingSessionLabel,
          tone: "primary" as const,
          kind,
          disabled: false,
          onPress: startPendingSession,
        };
      case "day_off":
        return {
          label: "Journée off",
          sub: "Tu as déjà fait ta séance aujourd'hui.",
          tone: "disabled" as const,
          kind,
          disabled: true,
          onPress: undefined,
        };
      case "choose_cycle":
        // Quand la vraie cible de onPressNew est CycleModal (pas la génération),
        // le CTA doit le dire — même calcul que onPressNew pour ne jamais diverger.
        return {
          label: "Choisir mon cycle",
          sub: `${Object.keys(MICROCYCLES).length} cycles, ${MICROCYCLE_TOTAL_SESSIONS_DEFAULT} séances chacun.`,
          tone: "primary" as const,
          kind,
          disabled: false,
          onPress: onPressNew,
        };
      case "prepare":
      default:
        return {
          label: "Préparer ma séance",
          sub: "On te prépare un programme adapté en 2 min.",
          tone: "primary" as const,
          kind,
          disabled: false,
          onPress: onPressNew,
        };
    }
  }, [
    tsb,
    isPendingToday,
    pendingSession,
    hasAppliedToday,
    upcomingSessionLabel,
    startPendingSession,
    onPressNew,
    goToRecovery,
    microcycleGoal,
    microcycleSessionIndex,
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
