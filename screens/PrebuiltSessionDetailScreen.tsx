// screens/PrebuiltSessionDetailScreen.tsx
import React, { useMemo, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import type { AppStackParamList } from "../navigation/RootNavigator";
import { theme } from "../constants/theme";
import { useTrainingStore } from "../state/trainingStore";
import { v2ToLocalSession } from "./newSession/transform";

const palette = theme.colors;

type Prebuilt = {
  category: string;
  title: string;
  intensity: "easy" | "moderate" | "hard";
  duration: string;
  objective: string;
  detail: string[];
  focus?: "run" | "strength" | "speed" | "circuit" | "plyo" | "mobility";
  location?: "gym" | "pitch" | "home";
  equipment?: string[];
  tags?: string[];
  level?: string;
  expectations?: string[]; // Consignes IA sur l'exécution de la séance/exos
  rpe_target?: number;
};

const INTENSITY_LABEL: Record<string, string> = {
  easy: "Facile",
  moderate: "Modéré",
  hard: "Dur",
};

const INTENSITY_COLOR: Record<string, string> = {
  easy: palette.success,
  moderate: palette.accent,
  hard: palette.danger,
};

const LOCATION_LABEL: Record<string, string> = {
  gym: "Salle",
  pitch: "Terrain",
  home: "Maison",
};

const FOCUS_LABEL: Record<string, string> = {
  strength: "Force",
  speed: "Vitesse",
  run: "Endurance",
  plyo: "Explosivité",
  circuit: "Circuit",
  mobility: "Mobilité",
};

const parseDurationMin = (raw?: string) => {
  if (!raw) return undefined;
  const matches = raw.match(/\d+/g);
  if (!matches || matches.length === 0) return undefined;
  const values = matches.map((m) => Number(m)).filter((n) => Number.isFinite(n));
  if (!values.length) return undefined;
  if (values.length === 1) return values[0];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg);
};

const buildV2FromPrebuilt = (session: Prebuilt, expectations: string[]) => {
  const detail = Array.isArray(session.detail) ? session.detail : [];
  const blocks = detail.map((line, index) => {
    const parts = line.split(":");
    const left = parts[0]?.trim() ?? "";
    const right = parts.slice(1).join(":").trim();
    const blockTitle = left.length ? left : `Bloc ${index + 1}`;
    const description = right.length ? right : line;
    return {
      name: blockTitle,
      type: session.category?.toLowerCase(),
      intensity: session.intensity,
      items: [
        {
          name: blockTitle,
          description,
        },
      ],
    };
  });

  return {
    version: "prebuilt_v1",
    title: session.title,
    subtitle: session.objective,
    intensity: session.intensity,
    focus_primary: session.focus ?? session.category?.toLowerCase() ?? "run",
    duration_min: parseDurationMin(session.duration),
    rpe_target:
      typeof session.rpe_target === "number"
        ? session.rpe_target
        : session.intensity === "hard"
        ? 8
        : session.intensity === "easy"
        ? 4
        : 6,
    location: session.location,
    blocks,
    coaching_tips: expectations,
  };
};

export default function PrebuiltSessionDetailScreen() {
  const route =
    useRoute<RouteProp<AppStackParamList, "PrebuiltSessionDetail">>();
  const navigation = useNavigation<any>();
  const phase = useTrainingStore((s) => s.phase);
  const devNowISO = useTrainingStore((s) => s.devNowISO);
  const pushSession = useTrainingStore((s) => s.pushSession);
  const session = route.params.session as unknown as Prebuilt;
  const expectations = Array.isArray(session.expectations)
    ? session.expectations.filter((line) => !!line && line.trim().length > 0)
    : [];
  const [timeSec, setTimeSec] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showCoachTip, setShowCoachTip] = useState(true);
  const detailLines = useMemo(
    () => (session.detail ?? []).filter((line) => !!line && line.trim().length > 0),
    [session.detail]
  );
  const infoItems = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    const focusLabel = session.focus ? FOCUS_LABEL[session.focus] ?? session.focus : "";
    if (focusLabel) items.push({ label: "Focus", value: focusLabel });
    if (session.location) {
      items.push({
        label: "Lieu",
        value: LOCATION_LABEL[session.location] ?? session.location,
      });
    }
    if (session.level) items.push({ label: "Niveau", value: session.level });
    if (session.equipment && session.equipment.length > 0) {
      items.push({ label: "Matériel", value: session.equipment.join(", ") });
    }
    return items;
  }, [session]);

  const intensityColor =
    INTENSITY_COLOR[session.intensity] ?? palette.accent;
  const intensityLabel =
    INTENSITY_LABEL[session.intensity] ?? session.intensity;

  const handleUseSession = () => {
    const v2 = buildV2FromPrebuilt(session, expectations);
    const nowISO = devNowISO ?? new Date().toISOString();
    const plannedDateISO = nowISO.slice(0, 10);
    const local = v2ToLocalSession(v2 as any, phase as any, plannedDateISO);
    const withMeta = {
      ...local,
      prebuiltMeta: {
        version: "prebuilt_v1",
        category: session.category,
        title: session.title,
      },
    } as any;
    pushSession(withMeta);
    navigation.navigate(
      "SessionLive" as never,
      { v2, plannedDateISO, sessionId: withMeta.id } as never
    );
  };

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeSec((t) => t + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  const formatTime = (total: number) => {
    const minutes = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor(total % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const toggleTimer = () => setIsRunning((r) => !r);
  const resetTimer = () => {
    setIsRunning(false);
    setTimeSec(0);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["right", "left", "bottom"]}>
      <View style={styles.root}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO */}
          <View style={styles.heroCard}>
            <View style={styles.heroGlow} />

            <View style={styles.heroHeaderRow}>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryText}>{session.category}</Text>
              </View>
              <View style={styles.tagsRow}>
                <View style={[styles.tag, { borderColor: intensityColor }]}>
                  <View
                    style={[styles.tagDot, { backgroundColor: intensityColor }]}
                  />
                  <Text style={styles.tagText}>{intensityLabel}</Text>
                </View>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{session.duration}</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroTitleBlock}>
              <Text style={styles.title}>{session.title}</Text>
              <Text style={styles.objective}>{session.objective}</Text>
            </View>

            {Array.isArray(session.tags) && session.tags.length > 0 ? (
              <View style={styles.metaRow}>
                {session.tags.map((tag) => (
                  <View key={tag} style={styles.metaTag}>
                    <Text style={styles.metaTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* INFO RAPIDE */}
          {infoItems.length > 0 ? (
            <View style={styles.infoGrid}>
              {infoItems.map((item) => (
                <View key={item.label} style={styles.infoCard}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoText}>{item.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* PLAN DETAILLE */}
          <View style={styles.planCard}>
            <Text style={styles.planTitle}>Plan détaillé</Text>
            <Text style={styles.planSub}>
              Suis les blocs dans l’ordre. Garde la qualité avant le volume.
            </Text>

            <View style={styles.stepsContainer}>
              {detailLines.map((line, index) => (
                <View key={line} style={styles.stepRow}>
                  <View style={styles.stepIndexCircle}>
                    <Text style={styles.stepIndexText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{line}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ATTENTES IA */}
          {expectations.length > 0 && (
            <View style={styles.expectCard}>
              <Text style={styles.expectTitle}>Ce que l’IA attend</Text>
              <View style={styles.expectList}>
                {expectations.map((line, idx) => (
                  <View key={`${line}-${idx}`} style={styles.expectRow}>
                    <View style={styles.expectDot} />
                    <Text style={styles.expectText}>{line}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* CHRONO */}
          <View style={styles.timerCard}>
            <Text style={styles.timerTitle}>Chronomètre</Text>
            <Text style={styles.timerValue}>{formatTime(timeSec)}</Text>
            <View style={styles.timerActions}>
              <TouchableOpacity
                style={[
                  styles.timerButton,
                  isRunning ? styles.timerButtonSecondary : styles.timerButtonPrimary,
                ]}
                activeOpacity={0.9}
                onPress={toggleTimer}
              >
                <Text
                  style={[
                    isRunning ? styles.timerButtonTextSecondary : styles.timerButtonTextPrimary,
                  ]}
                >
                  {isRunning ? "Pause" : "Démarrer"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.timerButton, styles.timerButtonGhost]}
                activeOpacity={0.9}
                onPress={resetTimer}
              >
                <Text style={styles.timerButtonTextGhost}>Réinitialiser</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* COACH MARK */}
          {showCoachTip && (
            <View style={styles.coachCard}>
              <Text style={styles.coachTitle}>Astuce rapide</Text>
              <Text style={styles.coachText}>
                Lis les attentes de l’IA, prépare ton matériel, puis lance le chrono et suis les blocs dans l’ordre.
              </Text>
              <TouchableOpacity
                style={styles.coachClose}
                onPress={() => setShowCoachTip(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.coachCloseText}>J’ai compris</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.mainButton}
            activeOpacity={0.9}
            onPress={handleUseSession}
          >
            <Text style={styles.mainButtonText}>Utiliser cette séance</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  root: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
    gap: 14,
  },

  // HERO
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
    top: -70,
    right: -80,
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    opacity: 0.9,
  },
  heroHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  categoryText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: palette.sub,
  },
  tagsRow: {
    flexDirection: "row",
    gap: 6,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginRight: 4,
  },
  tagText: {
    fontSize: 11,
    color: palette.sub,
  },
  heroTitleBlock: {
    marginTop: 4,
    gap: 6,
  },
  title: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "800",
  },
  objective: {
    color: palette.sub,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  metaTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
  },
  metaTagText: {
    fontSize: 11,
    color: palette.sub,
  },

  // INFO CARDS
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  infoCard: {
    minWidth: 150,
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 10,
    backgroundColor: palette.bgSoft,
  },
  infoLabel: {
    fontSize: 11,
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: palette.text,
  },

  // PLAN DETAILLE
  planCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    backgroundColor: palette.cardSoft,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
  },
  planSub: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 4,
  },
  stepsContainer: {
    marginTop: 12,
    gap: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  stepIndexCircle: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepIndexText: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.accent,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: palette.sub,
  },
  // EXPECTATIONS
  expectCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    backgroundColor: palette.cardSoft,
    gap: 10,
  },
  expectTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.text,
  },
  expectList: {
    gap: 8,
  },
  expectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  expectDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  expectText: {
    flex: 1,
    color: palette.sub,
    fontSize: 13,
  },
  // TIMER
  timerCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 16,
    backgroundColor: palette.card,
    alignItems: "center",
    gap: 10,
  },
  timerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.text,
  },
  timerValue: {
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: 1,
    color: palette.text,
  },
  timerActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  timerButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  timerButtonPrimary: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  timerButtonSecondary: {
    backgroundColor: palette.bg,
    borderColor: palette.border,
  },
  timerButtonGhost: {
    backgroundColor: palette.bgSoft,
    borderColor: palette.borderSoft,
  },
  timerButtonTextPrimary: {
    color: palette.bg,
    fontWeight: "700",
  },
  timerButtonTextSecondary: {
    color: palette.text,
    fontWeight: "700",
  },
  timerButtonTextGhost: {
    color: palette.sub,
    fontWeight: "600",
  },
  // COACH TIP
  coachCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 14,
    backgroundColor: palette.bgSoft,
    gap: 8,
  },
  coachTitle: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 13,
  },
  coachText: {
    color: palette.sub,
    fontSize: 12,
    lineHeight: 18,
  },
  coachClose: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
  },
  coachCloseText: {
    color: palette.accent,
    fontWeight: "700",
    fontSize: 12,
  },

  // BOTTOM CTA
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
    backgroundColor: palette.bg,
  },
  mainButton: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
  },
  mainButtonText: {
    color: palette.bg,
    fontWeight: "700",
    fontSize: 15,
  },
});
