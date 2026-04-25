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
import { theme, TYPE, RADIUS } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { useExternalStore } from "../state/stores/useExternalStore";
import type { Prebuilt, RoutineCategory } from "./prebuilt/prebuiltConfig";
// Linking retiré — on utilise le YouTubePlayer intégré
import {
  CATEGORY_CONFIG,
  INTENSITY_LABEL,
  INTENSITY_ICON,
  INTENSITY_COLOR,
  LOCATION_ICON,
  LOCATION_LABEL,
} from "./prebuilt/prebuiltConfig";
import { getExerciseVideoRef, type ExerciseVideoRef } from "../engine/exerciseVideos";
import { YouTubePlayer } from "../components/ui/YouTubePlayer";

const YT_SHORTS_FILTER = "EgQQARgB";
/** Cherche une vidéo pour un exercice de routine (par nom) */
const getRoutineVideoUrl = (exerciseName: string): string => {
  // Essayer par ID si le nom correspond à un exercice de la banque
  const ref = getExerciseVideoRef(exerciseName);
  if (ref.kind === "vetted") return ref.url;
  // Fallback : recherche YouTube Shorts avec le nom
  const query = `${exerciseName} exercise technique football`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=${YT_SHORTS_FILTER}`;
};

const palette = theme.colors;

// Tint color par catégorie (pour checkboxes, accents)
const CATEGORY_TINT: Record<string, string> = {
  "AVANT L'EFFORT": palette.amber500,
  "APRÈS L'EFFORT": palette.emerald500,
  "JOUR DE MATCH": palette.blue500,
  "MOBILITÉ": palette.violet500,
  "PRÉVENTION": palette.red500,
  "CIRCUITS": palette.rose400 ?? palette.red500,
};

type VisualConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  tint: string;
};

const getCategoryConfig = (category: string): VisualConfig => {
  const cfg = CATEGORY_CONFIG[category as RoutineCategory];
  return cfg
    ? { ...cfg, tint: CATEGORY_TINT[category] ?? palette.accent }
    : { icon: "sparkles", gradient: [palette.gray500, palette.gray400], tint: palette.gray500 };
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

export default function PrebuiltSessionDetailScreen() {
  const route = useRoute<RouteProp<AppStackParamList, "PrebuiltSessionDetail">>();
  const navigation = useNavigation<any>();
  const haptics = useHaptics();
  const session = route.params.session as unknown as Prebuilt;
  const addCompletedRoutine = useExternalStore((s) => s.addCompletedRoutine);

  const coachingTips = Array.isArray(session.coaching)
    ? session.coaching.filter((line) => !!line && line.trim().length > 0)
    : [];

  const [timeSec, setTimeSec] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLabel, setVideoLabel] = useState("");

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

  // Flatten blocks → exercices pour la checklist
  const allExercises = useMemo(() => {
    const blocks = session.blocks ?? [];
    const flat: { blockTitle: string; name: string; detail: string; globalIdx: number }[] = [];
    let idx = 0;
    for (const block of blocks) {
      for (const ex of block.exercises) {
        const parts: string[] = [];
        if (ex.sets && ex.reps) parts.push(`${ex.sets}×${ex.reps}`);
        else if (ex.reps) parts.push(`${ex.reps}`);
        if (ex.rest_s) parts.push(`repos ${ex.rest_s}s`);
        if (ex.tempo) parts.push(`tempo ${ex.tempo}`);
        const detail = parts.join(" · ");
        flat.push({ blockTitle: block.title, name: ex.name, detail, globalIdx: idx });
        idx++;
      }
    }
    return flat;
  }, [session.blocks]);

  const categoryConfig = getCategoryConfig(session.category);
  const intensityColor = INTENSITY_COLOR[session.intensity] ?? palette.accent;
  const intensityIcon = INTENSITY_ICON[session.intensity] ?? "flash-outline";
  const intensityLabel = INTENSITY_LABEL[session.intensity] ?? session.intensity;

  const handleFinish = useCallback(() => {
    addCompletedRoutine({
      category: session.category,
      title: session.title,
      durationMin: session.durationMin,
    });
    // Si la routine impacte le TSB, enregistrer comme charge externe
    if (session.impactsTsb && session.rpeTarget) {
      try {
        const { applyExternalLoad } = require("../state/orchestrators/applyExternalLoad");
        applyExternalLoad({
          id: `routine-${Date.now()}`,
          source: "other" as const,
          dateISO: new Date().toISOString(),
          rpe: session.rpeTarget,
          durationMin: session.durationMin,
          notes: `Routine: ${session.title}`,
        });
      } catch (_) { /* silently fail */ }
    }
    haptics.success();
    navigation.goBack();
  }, [navigation, addCompletedRoutine, session, haptics]);

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

  const progressRatio = allExercises.length > 0
    ? completedSteps.size / allExercises.length
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
                    <Ionicons name={categoryConfig.icon} size={12} color={theme.colors.white} />
                    <Text style={styles.categoryText}>{session.category}</Text>
                  </View>
                  <View style={styles.heroBadgesRow}>
                    <View style={styles.heroBadge}>
                      <Ionicons name={intensityIcon} size={10} color={theme.colors.white} />
                      <Text style={styles.heroBadgeText}>{intensityLabel}</Text>
                    </View>
                    <View style={styles.heroBadge}>
                      <Ionicons name="time-outline" size={10} color={theme.colors.white} />
                      <Text style={styles.heroBadgeText}>{session.durationMin} min</Text>
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
                        color={theme.colors.white80}
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
                        color={theme.colors.white80}
                      />
                      <Text style={styles.heroStatText}>
                        {FOCUS_LABEL[session.focus]}
                      </Text>
                    </View>
                  )}
                  {session.level && (
                    <View style={styles.heroStat}>
                      <Ionicons name="person-outline" size={14} color={theme.colors.white80} />
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
                    <Ionicons name="bag-outline" size={16} color={theme.colors.violet500} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>Matériel requis</Text>
                    <Text style={styles.cardSubtitle}>Prépare avant de commencer</Text>
                  </View>
                </View>
                <View style={styles.equipmentList}>
                  {session.equipment.map((item) => (
                    <View key={item} style={styles.equipmentItem}>
                      <Ionicons name="checkmark-circle" size={14} color={theme.colors.emerald500} />
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
                    <Ionicons name="list" size={18} color={theme.colors.white} />
                  </LinearGradient>
                  <View>
                    <Text style={styles.cardTitle}>Plan détaillé</Text>
                    <Text style={styles.cardSubtitle}>
                      {completedSteps.size}/{allExercises.length} exercices complétés
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
                {(session.blocks ?? []).map((block, bIdx) => (
                  <View key={`block-${bIdx}`} style={styles.blockSection}>
                    <Text style={styles.blockTitle}>{block.title}</Text>
                    {block.exercises.map((ex, eIdx) => {
                      const globalIdx = allExercises.findIndex(
                        (a) => a.blockTitle === block.title && a.name === ex.name && a.globalIdx >= 0
                      );
                      const idx = globalIdx >= 0 ? globalIdx : bIdx * 100 + eIdx;
                      const isCompleted = completedSteps.has(idx);
                      const parts: string[] = [];
                      if (ex.sets && ex.reps) parts.push(`${ex.sets}×${ex.reps}`);
                      else if (ex.reps) parts.push(`${ex.reps}`);
                      if (ex.rest_s) parts.push(`repos ${ex.rest_s}s`);
                      if (ex.tempo) parts.push(`tempo ${ex.tempo}`);
                      return (
                        <View key={`ex-${bIdx}-${eIdx}`} style={styles.stepRow}>
                          <TouchableOpacity
                            style={{ flexDirection: "row", alignItems: "flex-start", flex: 1, gap: 12 }}
                            onPress={() => toggleStepComplete(idx)}
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
                                <Ionicons name="checkmark" size={14} color={theme.colors.white} />
                              ) : (
                                <Text style={styles.stepIndexText}>{eIdx + 1}</Text>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.stepText,
                                  isCompleted && styles.stepTextCompleted,
                                ]}
                              >
                                {ex.name}
                              </Text>
                              {parts.length > 0 && (
                                <Text style={styles.stepDetail}>{parts.join(" · ")}</Text>
                              )}
                              {ex.notes && (
                                <Text style={styles.stepNotes}>{ex.notes}</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.videoButton}
                            activeOpacity={0.7}
                            onPress={() => {
                              setVideoLabel(ex.name);
                              setVideoUrl(getRoutineVideoUrl(ex.name));
                            }}
                          >
                            <Ionicons name="logo-youtube" size={14} color={palette.accent} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

            </Card>
          </Animated.View>

          {/* Attentes / Consignes */}
          {coachingTips.length > 0 && (
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
                    <Ionicons name="bulb" size={16} color={theme.colors.amber500} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>Coaching</Text>
                    <Text style={styles.cardSubtitle}>Conseils du prépa</Text>
                  </View>
                </View>
                <View style={styles.expectList}>
                  {coachingTips.map((line, idx) => (
                    <View key={`coach-${idx}`} style={styles.expectRow}>
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
                  <Ionicons name="stopwatch" size={18} color={theme.colors.cyan500} />
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
                    colors={isRunning ? [theme.colors.red500, theme.colors.rose300] : [theme.colors.emerald500, theme.colors.emerald400]}
                    style={styles.timerStartGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons
                      name={isRunning ? "pause" : "play"}
                      size={18}
                      color={theme.colors.white}
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
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
              <Text style={styles.mainButtonText}>Finir la routine</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <YouTubePlayer
          visible={videoUrl !== null}
          url={videoUrl}
          label={videoLabel}
          onClose={() => setVideoUrl(null)}
        />
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
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    shadowColor: theme.colors.black,
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
    borderRadius: RADIUS.pill,
    backgroundColor: theme.colors.white20,
  },
  categoryText: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "700",
    color: theme.colors.white,
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
    borderRadius: RADIUS.pill,
    backgroundColor: theme.colors.white20,
  },
  heroBadgeText: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "600",
    color: theme.colors.white,
  },
  heroTitleBlock: {
    gap: 6,
  },
  heroTitle: {
    color: theme.colors.white,
    fontSize: TYPE.title.fontSize,
    fontWeight: "800",
  },
  heroObjective: {
    color: theme.colors.white85,
    fontSize: TYPE.body.fontSize,
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
    fontSize: TYPE.caption.fontSize,
    color: theme.colors.white90,
    fontWeight: "500",
  },

  // Cards common
  cardTitle: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: TYPE.caption.fontSize,
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
    borderRadius: RADIUS.sm,
    backgroundColor: theme.colors.violetSoft15,
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
    borderRadius: RADIUS.sm,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  equipmentText: {
    fontSize: TYPE.caption.fontSize,
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
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.accent,
  },
  planBadgeText: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "700",
    color: palette.accent,
  },
  progressTrack: {
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: RADIUS.pill,
  },
  stepsContainer: {
    gap: 14,
  },
  blockSection: {
    gap: 6,
  },
  blockTitle: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  stepDetail: {
    fontSize: TYPE.micro.fontSize,
    color: palette.sub,
    fontWeight: "600",
    marginTop: 2,
  },
  stepNotes: {
    fontSize: TYPE.micro.fontSize,
    color: palette.sub,
    fontStyle: "italic",
    marginTop: 2,
    lineHeight: 16,
  },
  videoButton: {
    padding: 8,
    marginLeft: 4,
    alignSelf: "flex-start",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  stepCheckbox: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndexText: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: palette.sub,
  },
  stepText: {
    flex: 1,
    fontSize: TYPE.caption.fontSize,
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
    borderRadius: RADIUS.sm,
    backgroundColor: theme.colors.amberSoft15,
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
    fontSize: TYPE.caption.fontSize,
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
    borderRadius: RADIUS.sm,
    backgroundColor: theme.colors.cyanSoft15,
    alignItems: "center",
    justifyContent: "center",
  },
  timerValue: {
    fontSize: TYPE.display.md.fontSize,
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
    borderRadius: RADIUS.md,
    overflow: "hidden",
    shadowColor: theme.colors.emerald500,
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
    color: theme.colors.white,
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
  },
  timerResetButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSoft,
  },
  timerResetText: {
    color: palette.sub,
    fontSize: TYPE.body.fontSize,
    fontWeight: "600",
  },

  // Tags
  tagsSection: {
    gap: 8,
  },
  tagsSectionTitle: {
    fontSize: TYPE.caption.fontSize,
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
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
  },
  tagPillText: {
    fontSize: TYPE.micro.fontSize,
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
    borderRadius: RADIUS.md,
    overflow: "hidden",
    shadowColor: theme.colors.accent,
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
    color: theme.colors.white,
    fontWeight: "700",
    fontSize: TYPE.body.fontSize,
  },
});
