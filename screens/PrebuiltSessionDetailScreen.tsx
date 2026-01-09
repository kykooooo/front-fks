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
  accentSoft: "rgba(249,115,22,0.18)",
};

type Prebuilt = {
  category: string;
  title: string;
  intensity: string; // "easy" | "moderate" | "hard"
  duration: string;
  objective: string;
  detail: string[];
  expectations?: string[]; // Consignes IA sur l'exécution de la séance/exos
};

const INTENSITY_LABEL: Record<string, string> = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
};

const INTENSITY_COLOR: Record<string, string> = {
  easy: "#4ade80",
  moderate: "#facc15",
  hard: "#fb7185",
};

export default function PrebuiltSessionDetailScreen() {
  const route =
    useRoute<RouteProp<AppStackParamList, "PrebuiltSessionDetail">>();
  const navigation = useNavigation<any>();
  const session = route.params.session as Prebuilt;
  const expectations = Array.isArray(session.expectations)
    ? session.expectations.filter((line) => !!line && line.trim().length > 0)
    : [];
  const [timeSec, setTimeSec] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showCoachTip, setShowCoachTip] = useState(true);
  const detailLines = useMemo(
    () =>
      (session.detail ?? []).filter(
        (line) => !/échauffement|warm[- ]?up|warmup|prep/i.test(line)
      ),
    [session.detail]
  );

  const intensityColor =
    INTENSITY_COLOR[session.intensity] ?? palette.accent;
  const intensityLabel =
    INTENSITY_LABEL[session.intensity] ?? session.intensity;

  const handleUseSession = () => {
    // TODO: brancher ici la logique pour créer/planifier une séance à partir de ce template
    // Pour l'instant on se contente de revenir en arrière
    navigation.goBack();
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
          </View>

          {/* INFO RAPIDE */}
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Objectif</Text>
              <Text style={styles.infoText}>Séance pré-construite FKS optimisée pour le foot.</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Utilisation</Text>
              <Text style={styles.infoText}>
                À intégrer telle quelle ou à adapter en fonction de la charge club.
              </Text>
            </View>
          </View>

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

  // INFO CARDS
  infoRow: {
    flexDirection: "row",
    gap: 10,
  },
  infoCard: {
    flex: 1,
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
    color: "#0b0f19",
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
    color: "#0b0f19",
    fontWeight: "700",
    fontSize: 15,
  },
});
