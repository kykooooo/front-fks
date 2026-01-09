// screens/HomeScreen.tsx
import React, { useMemo, useLayoutEffect, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { signOut } from "firebase/auth";
import { subDays, startOfWeek, addDays, format } from "date-fns";
import { fr } from "date-fns/locale";

import { useTrainingStore } from "../state/trainingStore";
import { auth } from "../services/firebase";
import { DEV_FLAGS } from "../config/devFlags";

const palette = {
  bg: "#050509",
  bgSoft: "#050815",
  card: "#080C14",
  cardSoft: "#0c0e13",
  border: "#111827",
  borderSoft: "#1f2430",
  text: "#f9fafb",
  sub: "#9ca3af",
  accent: "#f97316",
  accentSoft: "rgba(249,115,22,0.16)",
  success: "#22c55e",
  warn: "#facc15",
  danger: "#fb7185",
  info: "#60a5fa",
};

type DebugEvent = {
  kind: "feedback_applied" | "external_applied";
  whenISO: string;
  sessionId?: string;
  rpe?: number;
  fatigue?: number;
  pain?: number;
  recoveryPerceived?: number;
  totalToday?: number;
  deltaLoad?: number;
  atl: number;
  ctl: number;
  tsb: number;
  phase?: string;
  phaseCount?: number;
  source?: "match" | "club" | "other" | string;
  note?: string;
};

const EMPTY_LOG: ReadonlyArray<DebugEvent> = Object.freeze([]);
const NOOP = () => {};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

function Badge({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "ok" | "warn";
}) {
  const bg =
    tone === "ok"
      ? "rgba(34,197,94,0.14)"
      : tone === "warn"
      ? "rgba(250,204,21,0.14)"
      : "rgba(148,163,184,0.18)";
  const color =
    tone === "ok" ? "#bbf7d0" : tone === "warn" ? "#fef3c7" : "#e5e7eb";
  const borderColor =
    tone === "ok" ? "#22c55e" : tone === "warn" ? "#facc15" : "#4b5563";

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor },
      ]}
    >
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  type RootNav = {
    navigate: (screen: string, params?: any) => void;
    setOptions?: (opts: any) => void;
  };
  const nav = useNavigation<RootNav>();
  const resetTrainingStore = useTrainingStore((s) => s.resetForUser);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      resetTrainingStore(null);
    } catch {
      Alert.alert("Déconnexion", "Échec de la déconnexion. Réessaie.");
    }
  };

  useLayoutEffect(() => {
    nav.setOptions?.({
      headerStyle: { backgroundColor: palette.bg },
      headerTitle: "",
      headerTintColor: palette.text,
      headerTitleStyle: { color: palette.text },
      headerRight: () => (
        <TouchableOpacity
          onPress={handleLogout}
          style={{ paddingHorizontal: 10, paddingVertical: 6 }}
        >
          <Text
            style={{
              fontWeight: "500",
              color: palette.sub,
              fontSize: 12,
            }}
          >
            Déconnexion
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [nav]);

  const startFirestoreWatch = useTrainingStore((s) => s.startFirestoreWatch);
  const storeHydrated = useTrainingStore((s) => (s as any).storeHydrated ?? true);

  useEffect(() => {
    if (!storeHydrated) return;
    startFirestoreWatch();
  }, [startFirestoreWatch, storeHydrated]);

  const phase = useTrainingStore((s) => s.phase);
  const phaseCount = useTrainingStore((s) => s.phaseCount);
  const atl = useTrainingStore((s) => s.atl);
  const ctl = useTrainingStore((s) => s.ctl);
  const tsb = useTrainingStore((s) => s.tsb);
  const devNowISO = useTrainingStore((s) => s.devNowISO);
  const externalLoads = useTrainingStore((s) => s.externalLoads);
  const clubTrainingDays = useTrainingStore((s) => s.clubTrainingDays ?? []);
  const matchDays = useTrainingStore((s) => s.matchDays ?? []);
  const runTestHarness = useTrainingStore((s) => s.runTestHarness);
  const plannedFksDays = useTrainingStore((s) => s.plannedFksDays ?? []);

  const dailyApplied = useTrainingStore((s) => s.dailyApplied);
  const lastAppliedDate = useTrainingStore((s) => s.lastAppliedDate);
  const hasAppliedToday =
    !!dailyApplied &&
    !!lastAppliedDate &&
    isSameDay(new Date(lastAppliedDate), new Date());

  const sessions = useTrainingStore((s) => s.sessions);
  const lastAiSessionV2 = useTrainingStore((s) => s.lastAiSessionV2);

  const pendingSession = useMemo(
    () =>
      [...sessions]
        .filter((s: any) => !s.completed)
        .sort((a: any, b: any) => {
          const da = new Date(a?.dateISO ?? a?.date ?? 0).getTime();
          const db = new Date(b?.dateISO ?? b?.date ?? 0).getTime();
          return db - da;
        })[0],
    [sessions]
  );


  const debugLogRaw = useTrainingStore((s) => s.debugLog ?? EMPTY_LOG);
  const clearDebugLog = useTrainingStore((s) => s.clearDebugLog ?? NOOP);
  const debugLog = debugLogRaw as ReadonlyArray<DebugEvent>;
  const journal = useMemo(() => {
    return (debugLog ?? []).slice(0, 5).map((ev: DebugEvent) => {
      const date = ev.whenISO ? ev.whenISO.slice(0, 10) : "";
      const label =
        ev.kind === "external_applied"
          ? `Charge externe ${ev.source ?? ""} · Δcharge ${Math.round(
              ev.deltaLoad ?? 0
            )} · ATL ${ev.atl.toFixed(1)} · CTL ${ev.ctl.toFixed(1)} · TSB ${ev.tsb.toFixed(1)}`
          : `Feedback RPE ${ev.rpe ?? "-"} · Δcharge ${Math.round(
              ev.deltaLoad ?? 0
            )} · ATL ${ev.atl.toFixed(1)} · CTL ${ev.ctl.toFixed(1)} · TSB ${ev.tsb.toFixed(1)}`;
      return { date, label };
    });
  }, [debugLog]);

  const todayKey = useMemo(() => {
    const iso = devNowISO ?? new Date().toISOString();
    return iso.slice(0, 10);
  }, [devNowISO]);

  const fatigueText = useMemo(() => {
    if (tsb <= -15) return "Charge très élevée, calme le jeu.";
    if (tsb <= -8) return "Fatigué, privilégie léger/modéré.";
    if (tsb < 0) return "OK mais reste prudent.";
    return "Tu es prêt à envoyer de la qualité.";
  }, [tsb]);
  const weekDays = useMemo(() => {
    const todayReal = new Date();
    const start = startOfWeek(todayReal, { weekStartsOn: 1 });
    const days: {
      key: string;
      label: string;
      isToday: boolean;
      hasFks: boolean;
      hasExt: boolean;
      hasClub: boolean;
      hasMatch: boolean;
      hasPlanned: boolean;
    }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const key = d.toISOString().slice(0, 10);
      const label = format(d, "EEEEE", { locale: fr }).toUpperCase();

      const hasFks = sessions.some((s: any) => {
        const dateStr = (s?.dateISO ?? s?.date ?? "").slice(0, 10);
        return dateStr === key && s.completed;
      });

      const hasExt = (externalLoads ?? []).some((e: any) => {
        const dateStr = (e?.dateISO ?? e?.date ?? "").slice(0, 10);
        return dateStr === key;
      });

      const dow = format(d, "eee", { locale: fr }).toLowerCase().slice(0, 3);
      const map: Record<string, string> = {
        lun: "mon",
        mar: "tue",
        mer: "wed",
        jeu: "thu",
        ven: "fri",
        sam: "sat",
        dim: "sun",
      };
      const hasClub = clubTrainingDays.includes(map[dow] ?? "");
      const hasMatch = matchDays.includes(map[dow] ?? "");
      const hasPlanned = plannedFksDays.includes(key);

      days.push({
        key,
        label,
        isToday: isSameDay(d, todayReal),
        hasFks,
        hasExt,
        hasClub,
        hasMatch,
        hasPlanned,
      });
    }

    return days;
  }, [sessions, externalLoads, clubTrainingDays, matchDays, plannedFksDays]);

  const onPressNew = () => {
    if (pendingSession && !DEV_FLAGS.ENABLED) {
      const date = (pendingSession as any).dateISO?.slice(0, 10) ?? "";
      Alert.alert(
        "Feedback requis",
        date
          ? `Donne le feedback de la séance du ${date} avant d'en générer une nouvelle.`
          : "Donne le feedback de la dernière séance avant d'en générer une nouvelle.",
        [
          {
            text: "Feedback",
            onPress: () =>
              nav.navigate(
                "Feedback" as never,
                { sessionId: (pendingSession as any).id } as never
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
                (pendingSession as any).dateISO?.slice(0, 10) ?? "";
              if (v2) {
                nav.navigate("SessionPreview" as never, {
                  v2,
                  plannedDateISO,
                  sessionId: (pendingSession as any).id,
                } as never);
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
        Alert.alert(
          "Déjà validé aujourd’hui",
          "Tu as déjà appliqué la charge pour aujourd’hui. Reviens demain ou ajoute une charge externe."
        );
        return;
      }
    }
    nav.navigate("NewSession");
  };

  const onPressPreview = () => {
    if (lastAiSessionV2) {
      nav.navigate(
        "SessionPreview" as never,
        {
          v2: lastAiSessionV2.v2,
          plannedDateISO: lastAiSessionV2.date,
          sessionId: lastAiSessionV2.sessionId,
        } as never
      );
      return;
    }

    const latest = [...sessions]
      .filter((s: any) => s?.aiV2 || s?.ai)
      .sort((a: any, b: any) => {
        const da = new Date(a.dateISO ?? a.date ?? 0).getTime();
        const db = new Date(b.dateISO ?? b.date ?? 0).getTime();
        return db - da;
      })[0];

    if (!latest) {
      Alert.alert(
        "Aucune séance IA",
        "Génère une séance d’abord pour la prévisualiser."
      );
      return;
    }

    const v2 = (latest as any).aiV2 ?? (latest as any).ai;
    const plannedDateISO = (latest as any).dateISO?.slice(0, 10) ?? "";
    if (!v2) {
      Alert.alert(
        "Séance sans blueprint",
        "Cette séance n’a pas de données IA associées."
      );
      return;
    }

    nav.navigate("SessionPreview" as never, {
      v2,
      plannedDateISO,
      sessionId: latest?.id,
    } as never);
  };

  const onRunHarness = () => {
    runTestHarness?.(7);
    Alert.alert(
      "Harness appliqué",
      "Charges auto + externes de test injectées sur 7 jours."
    );
  };

  const upcomingSessionLabel = useMemo(() => {
    if (!pendingSession) return "Aucune séance planifiée";
    const v2 = (pendingSession as any).aiV2 ?? (pendingSession as any).ai;
    if (v2) {
      const title = v2.title || "Séance IA";
      const focus = v2.focus_primary ? ` · ${v2.focus_primary}` : "";
      const intens = v2.intensity ? ` · ${v2.intensity}` : "";
      const dur =
        typeof v2.duration_min === "number" ? ` · ${Math.round(v2.duration_min)} min` : "";
      return `${title}${focus}${intens}${dur}`;
    }
    const focus = (pendingSession as any)?.focus ?? (pendingSession as any)?.modality ?? "-";
    const intens = (pendingSession as any)?.intensity ?? "-";
    return `Séance planifiée · ${intens} · ${focus}`;
  }, [pendingSession]);

  const weekSummary = useMemo(() => {
    const now = new Date();
    const weekAgo = subDays(now, 7).getTime();
    const fksCount = sessions.filter((s: any) => {
      const d = new Date(s?.dateISO ?? s?.date ?? 0).getTime();
      return s.completed && d >= weekAgo;
    }).length;
    const extCount = (externalLoads ?? []).filter((e: any) => {
      const d = new Date(e?.dateISO ?? e?.date ?? 0).getTime();
      return d >= weekAgo;
    }).length;
    const message =
      fksCount >= 2
        ? "Bonne zone cette semaine."
        : "Ajoute une séance légère pour optimiser.";
    return { fksCount, extCount, message };
  }, [sessions, externalLoads]);

  const lastEvents = useMemo(() => {
    const events: { date: string; label: string }[] = [];
    sessions
      .filter((s: any) => s.completed)
      .forEach((s: any) => {
        const date = (s.dateISO ?? s.date ?? "").slice(0, 10);
        events.push({
          date,
          label: `Séance FKS · RPE ${
            s.feedback?.rpe ?? s.rpe ?? "-"
          } · ${Math.round(s.durationMin ?? s.volumeScore ?? 45)} min`,
        });
      });
    (externalLoads ?? []).forEach((e: any) => {
      const date = (e.dateISO ?? e.date ?? "").slice(0, 10);
      events.push({
        date,
        label: `${e.source ?? "club"} · RPE ${e.rpe} · ${
          e.durationMin ?? "?"
        } min`,
      });
    });
    return events
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
  }, [sessions, externalLoads]);

  const tsbColor =
    tsb >= 0 ? palette.success : tsb <= -15 ? palette.danger : palette.accent;

  const athleteName = auth.currentUser?.displayName ?? "athlète";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.screenContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Bouton déconnexion (en plus du header) */}
        <View style={{ alignItems: "flex-end" }}>
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              backgroundColor: palette.card,
              borderColor: palette.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingVertical: 8,
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ color: palette.sub, fontWeight: "700", fontSize: 12 }}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        {/* HEADER TEXTE */}
        <View>
          <Text style={styles.helloTitle}>Salut, {athleteName}</Text>
          <Text style={styles.helloSub}>
            FKS ajuste ta charge au jour le jour.
          </Text>
        </View>

        {DEV_FLAGS.ENABLED && (
          <TouchableOpacity onPress={onRunHarness} style={styles.devChip}>
            <Text style={styles.devChipText}>
              Mode test : injecter charges club/match + externes (7j)
            </Text>
          </TouchableOpacity>
        )}

        {/* HERO FORM & CHARGE — NE PAS TOUCHER */}
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroTitle}>Forme & charge</Text>
              <Text style={styles.heroSubtitle}>{todayKey}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeLabel}>TSB</Text>
              <Text style={[styles.heroBadgeValue, { color: tsbColor }]}>
                {tsb.toFixed(1)}
              </Text>
            </View>
          </View>

          <View style={styles.heroBottomRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Phase</Text>
              <Text style={styles.heroStatValue}>{phase ?? "—"}</Text>
              <Text style={styles.heroStatSub}>
                Séance #{phaseCount ?? 0} dans cette phase
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Charge interne</Text>
              <Text style={styles.heroStatValue}>
                ATL {atl.toFixed(1)} · CTL {ctl.toFixed(1)}
              </Text>
              <Text style={styles.heroStatSub}>{fatigueText}</Text>
            </View>
          </View>
        </View>

        {/* SECTION — CETTE SEMAINE */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Cette semaine</Text>
            <View style={styles.sectionChip}>
              <Text style={styles.sectionChipText}>
                {weekSummary.fksCount} FKS · {weekSummary.extCount} club/match
              </Text>
            </View>
          </View>

          <View style={styles.weekCard}>
            <View style={styles.weekTopRow}>
              <Text style={styles.weekLabel}>Volume & séances</Text>
              <Text style={styles.weekHint}>{weekSummary.message}</Text>
            </View>

            <View style={styles.weekDaysRow}>
              {weekDays.map((d) => (
                <View key={d.key} style={styles.weekDayCell}>
                  <Text
                    style={[
                      styles.weekDayLabel,
                      d.isToday && styles.weekDayLabelToday,
                    ]}
                  >
                    {d.label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.weekDotsRow}>
              {weekDays.map((d) => {
                const hasSomething =
                  d.hasFks || d.hasExt || d.hasClub || d.hasMatch;
                let dot = palette.sub;
                if (d.hasMatch) dot = palette.danger;
                else if (d.hasClub) dot = palette.accent;
                else if (d.hasFks) dot = palette.success;
                else if (d.hasExt) dot = palette.info;

                return (
                  <View key={d.key + "_dots"} style={styles.weekDayCell}>
                    <View
                      style={[
                        styles.weekDotWrapper,
                        d.isToday && styles.weekDotWrapperToday,
                      ]}
                    >
                      {hasSomething && (
                        <View
                          style={[styles.weekDot, { backgroundColor: dot }]}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.weekLegendRow}>
              <View style={styles.weekLegendItem}>
                <View
                  style={[styles.weekLegendDot, { backgroundColor: palette.success }]}
                />
                <Text style={styles.weekLegendText}>Séance FKS</Text>
              </View>
              <View style={styles.weekLegendItem}>
                <View
                  style={[styles.weekLegendDot, { backgroundColor: palette.info }]}
                />
                <Text style={styles.weekLegendText}>Charge externe</Text>
              </View>
              <View style={styles.weekLegendItem}>
                <View
                  style={[
                    styles.weekLegendDot,
                    { backgroundColor: palette.accent },
                  ]}
                />
                <Text style={styles.weekLegendText}>Entraînement club</Text>
              </View>
              <View style={styles.weekLegendItem}>
                <View
                  style={[
                    styles.weekLegendDot,
                    { backgroundColor: palette.danger },
                  ]}
                />
                <Text style={styles.weekLegendText}>Match</Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION — PROCHAINE SÉANCE */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Prochaine séance FKS</Text>
            <Badge
              label={pendingSession ? "Planifiée" : "À générer"}
              tone={pendingSession ? "ok" : "default"}
            />
          </View>

          <View style={styles.nextCard}>
            <View style={styles.nextTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextMainText}>{upcomingSessionLabel}</Text>
                {pendingSession && (
                  <Text style={styles.nextSubText}>
                    Séance en attente. Feedback requis pour débloquer la suivante.
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.nextDivider} />

            <View style={styles.nextActionsRow}>
              <TouchableOpacity
                onPress={
                  pendingSession
                    ? () =>
                        nav.navigate(
                          "SessionPreview" as never,
                          {
                            v2:
                              (pendingSession as any).aiV2 ??
                              (pendingSession as any).ai ??
                              lastAiSessionV2?.v2,
                            plannedDateISO:
                              (pendingSession as any).dateISO?.slice(0, 10) ??
                              "",
                            sessionId: (pendingSession as any).id,
                          } as never
                        )
                    : onPressNew
                }
                style={styles.nextPrimary}
                activeOpacity={0.9}
              >
                <Text style={styles.nextPrimaryText}>
                  {pendingSession ? "Lancer la séance" : "Générer une séance"}
                </Text>
                <Text style={styles.nextPrimaryArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onPressPreview}
                style={styles.nextSecondary}
                activeOpacity={0.9}
              >
                <Text style={styles.nextSecondaryText}>Voir la séance IA</Text>
              </TouchableOpacity>
            </View>

            {pendingSession && (
              <TouchableOpacity
                onPress={() =>
                  nav.navigate(
                    "Feedback" as never,
                    { sessionId: (pendingSession as any).id } as never
                  )
                }
                style={styles.nextFeedbackChip}
                activeOpacity={0.9}
              >
                <Text style={styles.nextFeedbackText}>Donner mon feedback</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* SECTION — DERNIERS ÉVÈNEMENTS */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Derniers événements</Text>
            <TouchableOpacity
              onPress={() => nav.navigate("SessionHistory" as never)}
            >
              <Text style={styles.sectionLink}>Historique complet</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.eventsCard}>
            {lastEvents.length === 0 ? (
              <Text style={styles.eventsEmpty}>
                Rien de récent. Génère une séance ou ajoute un match / entraînement
                club.
              </Text>
            ) : (
              <View style={{ flexDirection: "row" }}>
                <View style={styles.eventsTimeline} />
                <View style={{ flex: 1, gap: 8 }}>
                  {lastEvents.map((ev, idx) => (
                    <View key={`${ev.date}-${idx}`} style={styles.eventRow}>
                      <View style={styles.eventDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventDate}>{ev.date}</Text>
                        <Text style={styles.eventLabel}>{ev.label}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* SECTION — JOURNAL CHARGE */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Journal charge</Text>
            <TouchableOpacity onPress={clearDebugLog}>
              <Text style={styles.sectionLink}>Vider</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.eventsCard}>
            {journal.length === 0 ? (
              <Text style={styles.eventsEmpty}>
                Aucun événement de charge pour l’instant.
              </Text>
            ) : (
              <View style={{ flexDirection: "row" }}>
                <View style={styles.eventsTimeline} />
                <View style={{ flex: 1, gap: 8 }}>
                  {journal.map((ev, idx) => (
                    <View key={`${ev.date}-${idx}`} style={styles.eventRow}>
                      <View style={styles.eventDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventDate}>{ev.date}</Text>
                        <Text style={styles.eventLabel}>{ev.label}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* SECTION — ACTIONS RAPIDES */}
        <View style={[styles.section, { marginBottom: 8 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Actions rapides</Text>
          </View>

          <View style={styles.actionsCard}>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={() => nav.navigate("ExternalLoad" as never)}
                style={styles.quickAction}
                activeOpacity={0.9}
              >
                <Text style={styles.quickActionLabel}>+ Charge externe</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => nav.navigate("ProfileSetup" as never)}
                style={styles.quickAction}
                activeOpacity={0.9}
              >
                <Text style={styles.quickActionLabel}>Profil joueur</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={() => nav.navigate("AiContextDebug" as never)}
                style={styles.quickAction}
                activeOpacity={0.9}
              >
                <Text style={styles.quickActionLabel}>ATL / CTL / TSB manuels</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: 12 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    padding: 16,
    gap: 16,
    backgroundColor: palette.bg,
  },

  helloTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.text,
  },
  helloSub: {
    marginTop: 4,
    fontSize: 13,
    color: palette.sub,
  },
  devChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  devChipText: {
    fontSize: 11,
    color: palette.sub,
  },

  // HERO (inchangé)
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    backgroundColor: palette.card,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -60,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    opacity: 0.9,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.text,
  },
  heroSubtitle: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 4,
  },
  heroBadge: {
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  heroBadgeLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: palette.sub,
  },
  heroBadgeValue: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  heroBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  heroStat: {
    flex: 1,
  },
  heroStatLabel: {
    fontSize: 11,
    color: palette.sub,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.text,
    marginTop: 2,
  },
  heroStatSub: {
    fontSize: 11,
    color: palette.sub,
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 40,
    backgroundColor: palette.border,
    marginHorizontal: 16,
  },

  // Sections génériques
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
  },
  sectionChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  sectionChipText: {
    fontSize: 11,
    color: palette.sub,
  },
  sectionLink: {
    fontSize: 11,
    color: palette.sub,
  },

  // Badge composant
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontWeight: "600",
    fontSize: 11,
  },

  // Semaine
  weekCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 12,
    backgroundColor: palette.bgSoft,
  },
  weekTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  weekLabel: {
    fontSize: 12,
    color: palette.sub,
  },
  weekHint: {
    fontSize: 11,
    color: palette.sub,
  },
  weekDaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  weekDotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
  },
  weekDayLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: palette.sub,
  },
  weekDayLabelToday: {
    color: palette.text,
    fontWeight: "700",
  },
  weekDotWrapper: {
    marginTop: 4,
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDotWrapperToday: {
    borderWidth: 1,
    borderColor: palette.accent,
  },
  weekDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  weekLegendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  weekLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  weekLegendDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  weekLegendText: {
    fontSize: 10,
    color: palette.sub,
  },

  // Prochaine séance
  nextCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
    backgroundColor: palette.cardSoft,
  },
  nextTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  nextMainText: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.text,
  },
  nextSubText: {
    marginTop: 4,
    fontSize: 12,
    color: palette.sub,
  },
  nextDivider: {
    height: 1,
    backgroundColor: palette.borderSoft,
    marginTop: 10,
    marginBottom: 10,
  },
  nextActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  nextPrimary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  nextPrimaryText: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.accent,
  },
  nextPrimaryArrow: {
    fontSize: 13,
    color: palette.accent,
  },
  nextSecondary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  nextSecondaryText: {
    fontSize: 13,
    fontWeight: "500",
    color: palette.text,
  },
  nextFeedbackChip: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  nextFeedbackText: {
    fontSize: 11,
    color: palette.sub,
  },

  // Évènements
  eventsCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 12,
    backgroundColor: palette.bgSoft,
  },
  eventsEmpty: {
    fontSize: 12,
    color: palette.sub,
  },
  eventsTimeline: {
    width: 2,
    borderRadius: 999,
    backgroundColor: palette.border,
    marginRight: 10,
    marginLeft: 2,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  eventDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: palette.accent,
    marginTop: 4,
  },
  eventDate: {
    fontSize: 13,
    fontWeight: "500",
    color: palette.text,
  },
  eventLabel: {
    fontSize: 12,
    color: palette.sub,
  },

  // Actions rapides
  actionsCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 12,
    backgroundColor: palette.cardSoft,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickAction: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    fontSize: 12,
    color: palette.text,
    fontWeight: "500",
  },
});
