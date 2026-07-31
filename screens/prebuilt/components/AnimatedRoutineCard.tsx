// screens/prebuilt/components/AnimatedRoutineCard.tsx
import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useHaptics } from "../../../hooks/useHaptics";
import { theme } from "../../../constants/theme";
import {
  CATEGORY_CONFIG,
  LOCATION_ICON, LOCATION_LABEL,
  type Prebuilt,
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

  const config = CATEGORY_CONFIG[routine.category];
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
            colors={config?.gradient ?? ["#6b7280", "#9ca3af"]}
            style={styles.routineCardIcon}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name={config?.icon ?? "sparkles"} size={18} color="#fff" />
          </LinearGradient>

          <View style={styles.routineCardBody}>
            <Text style={styles.routineCardTitle} numberOfLines={1}>
              {routine.title}
            </Text>

            <View style={styles.routineTagsRow}>
              <View style={styles.routineTag}>
                <Ionicons name="time-outline" size={10} color={palette.sub} />
                <Text style={styles.routineTagText}>{routine.duration}</Text>
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    padding: 12,
  },
  routineCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  routineCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  routineCardBody: {
    flex: 1,
    gap: 4,
  },
  routineCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.text,
  },
  routineTagsRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  routineTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgSoft,
  },
  routineTagText: {
    fontSize: 10,
    color: palette.sub,
    fontWeight: "500",
  },
});
