// screens/PrebuiltSessionDetailScreen.tsx
// Design moderne avec animations stagger, icônes gradient et cards pro
import React, { useMemo, useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useHaptics } from "../hooks/useHaptics";
import type { AppStackParamList } from "../navigation/RootNavigator";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { useExternalStore } from "../state/stores/useExternalStore";

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
  expectations?: string[];
  rpe_target?: number;
};

// Configuration visuelle des catégories
type CategoryConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  tint: string;
};

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  ACTIVATION: {
    icon: "flash",
    gradient: ["#f59e0b", "#fbbf24"],
    tint: "#f59e0b",
  },
  RÉCUPÉRATION: {
    icon: "leaf",
    gradient: ["#10b981", "#34d399"],
    tint: "#10b981",
  },
  "MOBILITÉ EXPRESS": {
    icon: "body",
    gradient: ["#8b5cf6", "#a78bfa"],
    tint: "#8b5cf6",
  },
  PRÉVENTION: {
    icon: "shield-checkmark",
    gradient: ["#ef4444", "#f87171"],
    tint: "#ef4444",
  },
  "MATCH DAY": {
    icon: "football",
    gradient: ["#3b82f6", "#60a5fa"],
    tint: "#3b82f6",
  },
  "PACK 7 JOURS": {
    icon: "calendar",
    gradient: ["#14b8a6", "#2dd4bf"],
    tint: "#14b8a6",
  },
  DÉFIS: {
    icon: "trophy",
    gradient: ["#ff7a1a", "#ff9a4a"],
    tint: "#ff7a1a",
  },
};

const getCategoryConfig = (category: string): CategoryConfig =>
  CATEGORY_CONFIG[category] ?? {
    icon: "sparkles",
    gradient: ["#6b7280", "#9ca3af"],
    tint: "#6b7280",
  };

const INTENSITY_LABEL: Record<string, string> = {
  easy: "Facile",
  moderate: "Modéré",
  hard: "Intense",
};

const INTENSITY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  easy: "sunny-outline",
  moderate: "flame-outline",
  hard: "flash",
};

const INTENSITY_COLOR: Record<string, string> = {
  easy: "#10b981",
  moderate: "#f59e0b",
  hard: "#ef4444",
};

const LOCATION_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  gym: "barbell-outline",
  pitch: "football-outline",
  home: "home-outline",
};

const LOCATION_LABEL: Record<string, string> = {
  gym: "Salle",
  pitch: "Terrain",
  home: "Maison",
};

const FOCUS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  strength: "barbell",
  speed: "flash",
  run: "footsteps",
  plyo: "rocket",
  circuit: "sync",
  mobility: "body",
};

const FOCUS_LABEL: Record<string, string> = {
  strength: "Force",
  speed: "Vitesse",
  run: "Endurance",
  plyo: "Explosivité",
  circuit: "Circuit",
  mobility: "Mobilité",
};


// Parse duration string like "8-10 min" to average minutes
const parseDurationMin = (raw?: string): number | undefined => {
  if (!raw) return undefined;
  const matches = raw.match(/\d+/g);
  if (!matches || matches.length === 0) return undefined;
  const values = matches.map((m) => Number(m)).filter((n) => Number.isFinite(n));
  if (!values.length) return undefined;
  if (values.length === 1) return values[0];
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
};

export default function PrebuiltSessionDetailScreen() {
  const route = useRoute<RouteProp<AppStackParamList, "PrebuiltSessionDetail">>();
  const navigation = useNavigation<any>();
  const haptics = useHaptics();
  const session = route.params.session as unknown as Prebuilt;
  const addCompletedRoutine = useExternalStore((s) => s.addCompletedRoutine);

  const expectations = Array.isArray(session.expectations)
    ? session.expectations.filter((line) => !!line && line.trim().length > 0)
    : [];

  const [timeSec, setTimeSec] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const cardAnims = useRef([0, 1, 2, 3, 4, 5].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.stagger(
        70,
        cardAnims.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          })
        )
      ).start();
    });
  }, [fadeAnim, slideAnim, cardAnims]);

  const detailLines = useMemo(
    () => (session.detail ?? []).filter((line) => !!line && line.trim().length > 0),
    [session.detail]
  );

  const categoryConfig = getCategoryConfig(session.category);
  const intensityColor = INTENSITY_COLOR[session.intensity] ?? palette.accent;
  const intensityIcon = INTENSITY_ICON[session.intensity] ?? "flash-outline";
  const intensityLabel = INTENSITY_LABEL[session.intensity] ?? session.intensity;

  const handleFinish = useCallback(() => {
    // Enregistrer la routine complétée (pour badges, sans impact sur charge)
    addCompletedRoutine({
      category: session.category,
      title: session.title,
      durationMin: parseDurationMin(session.duration),
    });
    haptics.success();
    navigation.goBack();
  }, [navigation, addCompletedRoutine, session]);

  const toggleStepComplete = useCallback((index: number) => {
    haptics.impactLight();
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Timer logic
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
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  const formatTime = (total: number) => {
    const minutes = Math.floor(total / 60).toString().padStart(2, "0");
    const seconds = Math.floor(total % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const toggleTimer = () => {
    haptics.impactMedium();
    setIsRunning((r) => !r);
  };

  const resetTimer = () => {
    haptics.impactLight();
    setIsRunning(false);
    setTimeSec(0);
  };

  const progressRatio = detailLines.length > 0
    ? completedSteps.size / detailLines.length
    : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "right", "left", "bottom"]}>
      <View style={styles.root}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO avec gradient */}
          <Animated.View
            style={[
              styles.heroCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <LinearGradient
              colors={categoryConfig.gradient}
              style={styles.heroGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.5 }}
            >
              <View style={styles.heroContent}>
                {/* Header row */}
                <View style={styles.heroHeaderRow}>
                  <View style={styles.categoryPill}>
                    <Ionicons name={categoryConfig.icon} size={12} color="#fff" />
                    <Text style={styles.categoryText}>{session.category}</Text>
                  </View>
                  <View style={styles.heroBadgesRow}>
                    <View style={styles.heroBadge}>
                      <Ionicons name={intensityIcon} size={10} color="#fff" />
                      <Text style={styles.heroBadgeText}>{intensityLabel}</Text>
                    </View>
                    <View style={styles.heroBadge}>
                      <Ionicons name="time-outline" size={10} color="#fff" />
                      <Text style={styles.heroBadgeText}>{session.duration}</Text>
                    </View>
                  </View>
                </View>

                {/* Title */}
                <View style={styles.heroTitleBlock}>
                  <Text style={styles.heroTitle}>{session.title}</Text>
                  <Text style={styles.heroObjective}>{session.objective}</Text>
                </View>

                {/* Quick stats */}
                <View style={styles.heroStatsRow}>
                  {session.location && (
                    <View style={styles.heroStat}>
                      <Ionicons
                        name={LOCATION_ICON[session.location] ?? "location-outline"}
                        size={14}
                        color="rgba(255,255,255,0.8)"
                      />
                      <Text style={styles.heroStatText}>
                        {LOCATION_LABEL[session.location]}
                      </Text>
                    </View>
                  )}
                  {session.focus && (
                    <View style={styles.heroStat}>
                      <Ionicons
                        name={FOCUS_ICON[session.focus] ?? "fitness-outline"}
                        size={14}
                        color="rgba(255,255,255,0.8)"
                      />
                      <Text style={styles.heroStatText}>
                        {FOCUS_LABEL[session.focus]}
                      </Text>
                    </View>
                  )}
                  {session.level && (
                    <View style={styles.heroStat}>
                      <Ionicons name="person-outline" size={14} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.heroStatText}>{session.level}</Text>
                    </View>
                  )}
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Matériel requis */}
          {session.equipment && session.equipment.length > 0 && (
            <Animated.View
              style={{
                opacity: cardAnims[0],
                transform: [
                  {
                    translateY: cardAnims[0].interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              }}
            >
              <Card variant="soft" style={styles.equipmentCard}>
                <View style={styles.equipmentHeader}>
                  <View style={styles.equipmentIconCircle}>
                    <Ionicons name="bag-outline" size={16} color="#8b5cf6" />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>Matériel requis</Text>
                    <Text style={styles.cardSubtitle}>Prépare avant de commencer</Text>
                  </View>
                </View>
                <View style={styles.equipmentList}>
                  {session.equipment.map((item) => (
                    <View key={item} style={styles.equipmentItem}>
                      <Ionicons name="checkmark-circle" size={14} color="#10b981" />
                      <Text style={styles.equipmentText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </Animated.View>
          )}

          {/* Plan détaillé */}
          <Animated.View
            style={{
              opacity: cardAnims[1],
              transform: [
                {
                  translateY: cardAnims[1].interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            }}
          >
            <Card variant="surface" style={styles.planCard}>
              <View style={styles.planHeader}>
                <View style={styles.planHeaderLeft}>
                  <LinearGradient
                    colors={categoryConfig.gradient}
                    style={styles.planIconCircle}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="list" size={18} color="#fff" />
                  </LinearGradient>
                  <View>
                    <Text style={styles.cardTitle}>Plan détaillé</Text>
                    <Text style={styles.cardSubtitle}>
                      {completedSteps.size}/{detailLines.length} étapes complétées
                    </Text>
                  </View>
                </View>
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>
                    {Math.round(progressRatio * 100)}%
                  </Text>
                </View>
              </View>

              {/* Barre de progression */}
              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={categoryConfig.gradient}
                  style={[styles.progressFill, { width: `${progressRatio * 100}%` }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>

              <View style={styles.stepsContainer}>
                {detailLines.map((line, index) => {
                  const isCompleted = completedSteps.has(index);
                  return (
                    <TouchableOpacity
                      key={`step-${index}`}
                      style={styles.stepRow}
                      onPress={() => toggleStepComplete(index)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.stepCheckbox,
                          isCompleted && {
                            backgroundColor: categoryConfig.tint,
                            borderColor: categoryConfig.tint,
                          },
                        ]}
                      >
                        {isCompleted ? (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        ) : (
                          <Text style={styles.stepIndexText}>{index + 1}</Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepText,
                          isCompleted && styles.stepTextCompleted,
                        ]}
                      >
                        {line}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>
          </Animated.View>

          {/* Attentes / Consignes */}
          {expectations.length > 0 && (
            <Animated.View
              style={{
                opacity: cardAnims[2],
                transform: [
                  {
                    translateY: cardAnims[2].interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              }}
            >
              <Card variant="soft" style={styles.expectCard}>
                <View style={styles.expectHeader}>
                  <View style={styles.expectIconCircle}>
                    <Ionicons name="bulb" size={16} color="#f59e0b" />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>Points clés</Text>
                    <Text style={styles.cardSubtitle}>Pour bien exécuter</Text>
                  </View>
                </View>
                <View style={styles.expectList}>
                  {expectations.map((line, idx) => (
                    <View key={`expect-${idx}`} style={styles.expectRow}>
                      <Ionicons name="arrow-forward-circle" size={16} color={categoryConfig.tint} />
                      <Text style={styles.expectText}>{line}</Text>
                    </View>
                  ))}
                </View>
              </Card>
            </Animated.View>
          )}

          {/* Chronomètre */}
          <Animated.View
            style={{
              opacity: cardAnims[3],
              transform: [
                {
                  translateY: cardAnims[3].interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            }}
          >
            <Card variant="surface" style={styles.timerCard}>
              <View style={styles.timerHeader}>
                <View style={styles.timerIconCircle}>
                  <Ionicons name="stopwatch" size={18} color="#06b6d4" />
                </View>
                <Text style={styles.cardTitle}>Chronomètre</Text>
              </View>

              <Text style={styles.timerValue}>{formatTime(timeSec)}</Text>

              <View style={styles.timerActions}>
                <TouchableOpacity
                  style={styles.timerStartButton}
                  activeOpacity={0.9}
                  onPress={toggleTimer}
                >
                  <LinearGradient
                    colors={isRunning ? ["#ef4444", "#f87171"] : ["#10b981", "#34d399"]}
                    style={styles.timerStartGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons
                      name={isRunning ? "pause" : "play"}
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.timerStartText}>
                      {isRunning ? "Pause" : "Démarrer"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.timerResetButton}
                  activeOpacity={0.85}
                  onPress={resetTimer}
                >
                  <Ionicons name="refresh" size={16} color={palette.sub} />
                  <Text style={styles.timerResetText}>Reset</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </Animated.View>

          {/* Tags */}
          {Array.isArray(session.tags) && session.tags.length > 0 && (
            <Animated.View
              style={{
                opacity: cardAnims[4],
                transform: [
                  {
                    translateY: cardAnims[4].interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              }}
            >
              <View style={styles.tagsSection}>
                <Text style={styles.tagsSectionTitle}>Tags</Text>
                <View style={styles.tagsRow}>
                  {session.tags.map((tag) => (
                    <View key={tag} style={styles.tagPill}>
                      <Text style={styles.tagPillText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.mainButton}
            activeOpacity={0.9}
            onPress={handleFinish}
          >
            <LinearGradient
              colors={categoryConfig.gradient}
              style={styles.mainButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.mainButtonText}>Finir la routine</Text>
            </LinearGradient>
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
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  heroGradient: {
    padding: 18,
  },
  heroContent: {
    gap: 14,
  },
  heroHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroBadgesRow: {
    flexDirection: "row",
    gap: 6,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
  },
  heroTitleBlock: {
    gap: 6,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  heroObjective: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    lineHeight: 20,
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  heroStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroStatText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },

  // Cards common
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 2,
  },

  // Equipment
  equipmentCard: {
    padding: 14,
    gap: 12,
  },
  equipmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  equipmentIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(139,92,246,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  equipmentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  equipmentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  equipmentText: {
    fontSize: 12,
    color: palette.text,
    fontWeight: "500",
  },

  // Plan
  planCard: {
    padding: 14,
    gap: 12,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  planIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.accent,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.accent,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  stepsContainer: {
    gap: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  stepCheckbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndexText: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.sub,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: palette.text,
    lineHeight: 20,
  },
  stepTextCompleted: {
    color: palette.sub,
    textDecorationLine: "line-through",
  },

  // Expectations
  expectCard: {
    padding: 14,
    gap: 12,
  },
  expectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  expectIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  expectList: {
    gap: 10,
  },
  expectRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  expectText: {
    flex: 1,
    color: palette.sub,
    fontSize: 13,
    lineHeight: 18,
  },

  // Timer
  timerCard: {
    padding: 16,
    alignItems: "center",
    gap: 12,
  },
  timerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(6,182,212,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  timerValue: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: 2,
    color: palette.text,
    fontVariant: ["tabular-nums"],
  },
  timerActions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  timerStartButton: {
    flex: 2,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  timerStartGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  timerStartText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  timerResetButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSoft,
  },
  timerResetText: {
    color: palette.sub,
    fontSize: 14,
    fontWeight: "600",
  },

  // Tags
  tagsSection: {
    gap: 8,
  },
  tagsSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
  },
  tagPillText: {
    fontSize: 11,
    color: palette.sub,
    fontWeight: "500",
  },

  // Bottom CTA
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
    backgroundColor: palette.bg,
  },
  mainButton: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#ff7a1a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  mainButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  mainButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
