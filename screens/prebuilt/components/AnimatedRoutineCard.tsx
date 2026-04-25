// screens/prebuilt/components/AnimatedRoutineCard.tsx
import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useHaptics } from "../../../hooks/useHaptics";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import {
  CATEGORY_CONFIG,
  INTENSITY_COLOR, INTENSITY_ICON, INTENSITY_LABEL,
  LOCATION_ICON, LOCATION_LABEL,
  type Prebuilt,
  type RoutineCategory,
} from "../prebuiltConfig";

const palette = theme.colors;

type Props = {
  routine: Prebuilt;
  index: number;
  onPress: () => void;
};

export function AnimatedRoutineCard({ routine, index, onPress }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        delay: index * 70,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        delay: index * 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const haptics = useHaptics();

  const handlePress = () => {
    haptics.impactLight();
    onPress();
  };

  const config = CATEGORY_CONFIG[routine.category as RoutineCategory];
  const intensityColor = INTENSITY_COLOR[routine.intensity] ?? palette.accent;
  const intensityIcon = INTENSITY_ICON[routine.intensity] ?? "flash-outline";
  const locationIcon = LOCATION_ICON[routine.location ?? "home"] ?? "home-outline";

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <TouchableOpacity
        style={styles.routineCard}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.routineCardContent}>
          <LinearGradient
            colors={config?.gradient ?? [theme.colors.gray500, theme.colors.gray400]}
            style={styles.routineCardIcon}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name={config?.icon ?? "sparkles"} size={20} color={theme.colors.white} />
          </LinearGradient>

          <View style={styles.routineCardBody}>
            <Text style={styles.routineCardTitle} numberOfLines={1}>
              {routine.title}
            </Text>
            <Text style={styles.routineCardObjective} numberOfLines={2}>
              {routine.objective}
            </Text>

            <View style={styles.routineTagsRow}>
              <View style={[styles.routineTag, { borderColor: intensityColor }]}>
                <Ionicons name={intensityIcon} size={10} color={intensityColor} />
                <Text style={[styles.routineTagText, { color: intensityColor }]}>
                  {INTENSITY_LABEL[routine.intensity]}
                </Text>
              </View>

              <View style={styles.routineTag}>
                <Ionicons name="time-outline" size={10} color={palette.sub} />
                <Text style={styles.routineTagText}>{routine.durationMin} min</Text>
              </View>

              {routine.location && (
                <View style={styles.routineTag}>
                  <Ionicons name={locationIcon} size={10} color={palette.sub} />
                  <Text style={styles.routineTagText}>
                    {LOCATION_LABEL[routine.location]}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Ionicons name="chevron-forward" size={18} color={palette.sub} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  routineCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    padding: 14,
  },
  routineCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  routineCardIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },
  routineCardBody: {
    flex: 1,
    gap: 4,
  },
  routineCardTitle: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: palette.text,
  },
  routineCardObjective: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    lineHeight: 16,
  },
  routineTagsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap",
  },
  routineTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
  },
  routineTagText: {
    fontSize: TYPE.micro.fontSize,
    color: palette.sub,
    fontWeight: "500",
  },
});
