// screens/PrebuiltSessionDetailScreen.tsx
// Même langage visuel que l'écran de séance (BlockCard/SessionPreviewScreen) :
// Card surface + barre d'accent + icône teintée, plus de gradient plein cadre.
import React, { useMemo, useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Screen } from "../components/ui/Screen";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useHaptics } from "../hooks/useHaptics";
import type { AppStackParamList } from "../navigation/RootNavigator";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { SectionHeader } from "../components/ui/SectionHeader";
import { useExternalStore } from "../state/stores/useExternalStore";
import { parseStepLine } from "./prebuilt/parseStepLine";
import { frIntensity } from "../utils/frLabels";

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

// Configuration visuelle des catégories — icône + couleur en touches seulement
// (barre d'accent, icône), jamais en fond plein.
type CategoryConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  tintSoft: string;
};

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  ACTIVATION: { icon: "flash", tint: "#f59e0b", tintSoft: "rgba(245,158,11,0.12)" },
  RÉCUPÉRATION: { icon: "leaf", tint: "#10b981", tintSoft: "rgba(16,185,129,0.12)" },
  "MOBILITÉ EXPRESS": { icon: "body", tint: "#8b5cf6", tintSoft: "rgba(139,92,246,0.12)" },
  PRÉVENTION: { icon: "shield-checkmark", tint: "#ef4444", tintSoft: "rgba(239,68,68,0.12)" },
  "MATCH DAY": { icon: "football", tint: "#3b82f6", tintSoft: "rgba(59,130,246,0.12)" },
  "PACK 7 JOURS": { icon: "calendar", tint: "#14b8a6", tintSoft: "rgba(20,184,166,0.12)" },
  DÉFIS: { icon: "trophy", tint: "#ff7a1a", tintSoft: "rgba(255,122,26,0.12)" },
  CIRCUITS: { icon: "repeat", tint: "#e11d48", tintSoft: "rgba(225,29,72,0.12)" },
};

const getCategoryConfig = (category: string): CategoryConfig =>
  CATEGORY_CONFIG[category] ?? {
    icon: "sparkles",
    tint: "#6b7280",
    tintSoft: "rgba(107,114,128,0.12)",
  };

// Le mapping FR de l'intensite vivait ici en doublon de `utils/frLabels.ts` (et
// n'y couvrait que 3 tokens). Source unique : `frIntensity`.
type BadgeTone = "default" | "ok" | "warn" | "danger";
const INTENSITY_TONE: Record<string, BadgeTone> = {
  easy: "ok",
  moderate: "warn",
  hard: "danger",
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
  // 0 = Matériel, 1 = Plan détaillé, 2 = Points clés, 3 = Chronomètre
  const cardAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;

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
  const parsedSteps = useMemo(() => detailLines.map(parseStepLine), [detailLines]);

  const categoryConfig = getCategoryConfig(session.category);
  const intensityLabel = frIntensity(session.intensity) || session.intensity;
  const intensityTone = INTENSITY_TONE[session.intensity] ?? "default";

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
    <Screen style={styles.safeArea}>
      <View style={styles.root}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO — Card surface + barre d'accent, langage BlockCard */}
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <Card variant="surface" style={styles.heroCard}>
              <View style={[styles.heroAccentBar, { backgroundColor: categoryConfig.tint }]} />
              <View style={styles.heroInner}>
                <View style={styles.heroHeaderRow}>
                  <View style={[styles.heroIconWrap, { backgroundColor: categoryConfig.tintSoft }]}>
                    <Ionicons name={categoryConfig.icon} size={20} color={categoryConfig.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.heroCategoryLabel, { color: categoryConfig.tint }]}>
                      {session.category}
                    </Text>
                    <Text style={styles.heroTitle} numberOfLines={2}>{session.title}</Text>
                  </View>
                </View>

                <Text style={styles.heroObjective} numberOfLines={3}>{session.objective}</Text>

                <View style={styles.heroBadgesRow}>
                  <Badge label={intensityLabel} tone={intensityTone} />
                  <Badge label={session.duration} />
                </View>

                {session.location || session.focus || session.level ? (
                  <View style={styles.heroChipsRow}>
                    {session.location ? (
                      <View style={styles.metaChip}>
                        <Ionicons
                          name={LOCATION_ICON[session.location] ?? "location-outline"}
                          size={12}
                          color={palette.sub}
                        />
                        <Text style={styles.metaChipText}>{LOCATION_LABEL[session.location]}</Text>
                      </View>
                    ) : null}
                    {session.focus ? (
                      <View style={styles.metaChip}>
                        <Ionicons
                          name={FOCUS_ICON[session.focus] ?? "fitness-outline"}
                          size={12}
                          color={palette.sub}
                        />
                        <Text style={styles.metaChipText}>{FOCUS_LABEL[session.focus]}</Text>
                      </View>
                    ) : null}
                    {session.level ? (
                      <View style={styles.metaChip}>
                        <Ionicons name="person-outline" size={12} color={palette.sub} />
                        <Text style={styles.metaChipText} numberOfLines={1}>{session.level}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </Card>
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
                  <View style={[styles.equipmentIconCircle, { backgroundColor: categoryConfig.tintSoft }]}>
                    <Ionicons name="bag-outline" size={16} color={categoryConfig.tint} />
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

          {/* Plan détaillé — étapes en itemRow, langage BlockCard */}
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
                  <View style={[styles.planIconCircle, { backgroundColor: categoryConfig.tintSoft }]}>
                    <Ionicons name="list" size={18} color={categoryConfig.tint} />
                  </View>
                  <View>
                    <Text style={styles.cardTitle}>Plan détaillé</Text>
                    <Text style={styles.cardSubtitle}>
                      {completedSteps.size}/{detailLines.length} étapes complétées
                    </Text>
                  </View>
                </View>
                <Badge label={`${Math.round(progressRatio * 100)}%`} />
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressRatio * 100}%`, backgroundColor: categoryConfig.tint },
                  ]}
                />
              </View>

              <View style={styles.stepsContainer}>
                {parsedSteps.map((step, index) => {
                  const isCompleted = completedSteps.has(index);
                  return (
                    <View key={`step-${index}`} style={styles.itemRow}>
                      <TouchableOpacity
                        onPress={() => toggleStepComplete(index)}
                        activeOpacity={0.85}
                        style={styles.itemMain}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isCompleted }}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            isCompleted && {
                              backgroundColor: categoryConfig.tintSoft,
                              borderColor: categoryConfig.tint,
                            },
                          ]}
                        >
                          {isCompleted ? (
                            <Ionicons name="checkmark" size={14} color={categoryConfig.tint} />
                          ) : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.itemName, isCompleted && styles.itemNameChecked]}
                            numberOfLines={step.name ? 2 : 4}
                          >
                            {step.name ?? step.raw}
                          </Text>
                          {step.dosage ? <Text style={styles.itemMeta}>{step.dosage}</Text> : null}
                          {step.consigne ? (
                            <Text style={styles.itemNote} numberOfLines={3}>{step.consigne}</Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </Card>
          </Animated.View>

          {/* Points clés — style coachTipBox de BlockCard */}
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
              <View
                style={[
                  styles.coachTipBox,
                  { backgroundColor: categoryConfig.tintSoft, borderLeftColor: categoryConfig.tint },
                ]}
              >
                <View style={styles.coachTipHeader}>
                  <Ionicons name="bulb-outline" size={12} color={categoryConfig.tint} />
                  <Text style={[styles.coachTipKicker, { color: categoryConfig.tint }]}>
                    Points clés
                  </Text>
                </View>
                <View style={styles.coachTipList}>
                  {expectations.map((line, idx) => (
                    <Text key={`expect-${idx}`} style={styles.coachTipText}>
                      {'•'} {line}
                    </Text>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Chronomètre — carte sobre, boutons du design system */}
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
            <Card variant="soft" style={styles.timerCard}>
              <SectionHeader title="Chronomètre" />
              <Text style={styles.timerValue}>{formatTime(timeSec)}</Text>
              <View style={styles.timerActions}>
                <Button
                  label={isRunning ? "Pause" : "Démarrer"}
                  onPress={toggleTimer}
                  size="sm"
                  variant={isRunning ? "secondary" : "primary"}
                  style={[
                    styles.timerButton,
                    !isRunning && { backgroundColor: categoryConfig.tint, borderColor: categoryConfig.tint },
                  ]}
                />
                <Button
                  label="Réinit"
                  onPress={resetTimer}
                  size="sm"
                  variant="ghost"
                  style={styles.timerButton}
                />
              </View>
            </Card>
          </Animated.View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Bottom CTA — sobre, couleur accent (comme les CTA de séance) */}
        <View style={styles.bottomBar}>
          <Button label="Finir la routine" onPress={handleFinish} fullWidth size="lg" />
        </View>
      </View>
    </Screen>
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

  // HERO — langage BlockCard : accent bar + icône teintée, pas de gradient
  heroCard: { padding: 0, flexDirection: "row", overflow: "hidden" },
  heroAccentBar: {
    width: 4,
    borderTopLeftRadius: theme.radius.sm,
    borderBottomLeftRadius: theme.radius.sm,
  },
  heroInner: { flex: 1, padding: 14, gap: 10 },
  heroHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCategoryLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroTitle: { fontSize: 18, fontWeight: "800", color: palette.text, marginTop: 2 },
  heroObjective: { fontSize: 13, color: palette.sub, lineHeight: 18, minHeight: 18 },
  heroBadgesRow: { flexDirection: "row", gap: 6 },
  heroChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
  },
  metaChipText: { fontSize: 11, color: palette.sub, fontWeight: "500" },

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
    gap: 10,
  },

  // Steps — itemRow, identique au motif BlockCard
  itemRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  itemMain: { flex: 1, flexDirection: "row", gap: 8, alignItems: "flex-start" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  itemName: { color: palette.text, fontSize: 14, fontWeight: "600" },
  itemNameChecked: { textDecorationLine: "line-through", color: palette.sub },
  itemMeta: { color: palette.sub, fontSize: 12, marginTop: 2 },
  itemNote: { color: palette.sub, fontSize: 12, marginTop: 2, lineHeight: 16 },

  // Points clés — coachTipBox (fond soft + barre gauche, kicker uppercase)
  coachTipBox: {
    gap: 6,
    padding: 12,
    borderLeftWidth: 3,
    borderTopRightRadius: theme.radius.sm,
    borderBottomRightRadius: theme.radius.sm,
  },
  coachTipHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  coachTipKicker: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  coachTipList: { gap: 4 },
  coachTipText: { fontSize: 12, lineHeight: 16, color: palette.text },

  // Timer
  timerCard: {
    padding: 14,
    gap: 12,
  },
  timerValue: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 2,
    color: palette.text,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  timerActions: {
    flexDirection: "row",
    gap: 10,
  },
  timerButton: { flex: 1 },

  // Bottom CTA
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
    backgroundColor: palette.bg,
  },
});
