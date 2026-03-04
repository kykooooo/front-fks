// screens/prebuilt/components/CategorySection.tsx
import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../../constants/theme";
import { CATEGORY_CONFIG, type Prebuilt } from "../prebuiltConfig";
import { AnimatedRoutineCard } from "./AnimatedRoutineCard";

const palette = theme.colors;

type Props = {
  category: string;
  routines: Prebuilt[];
  baseIndex: number;
  onRoutinePress: (routine: Prebuilt) => void;
};

export function CategorySection({ category, routines, baseIndex, onRoutinePress }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        delay: baseIndex * 80,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        delay: baseIndex * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, baseIndex]);

  const config = CATEGORY_CONFIG[category] ?? {
    icon: "sparkles" as keyof typeof Ionicons.glyphMap,
    gradient: ["#6b7280", "#9ca3af"] as [string, string],
    tagline: "",
  };

  return (
    <Animated.View
      style={[
        styles.categorySection,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.categorySectionHeader}>
        <View style={styles.categorySectionLeft}>
          <LinearGradient
            colors={config.gradient}
            style={styles.categorySectionIcon}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name={config.icon} size={18} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.categorySectionTitle}>{category}</Text>
            <Text style={styles.categorySectionTagline}>{config.tagline}</Text>
          </View>
        </View>
        <View style={styles.categorySectionBadge}>
          <Text style={styles.categorySectionBadgeText}>{routines.length}</Text>
        </View>
      </View>

      <View style={styles.routinesList}>
        {routines.map((routine, idx) => (
          <AnimatedRoutineCard
            key={routine.title}
            routine={routine}
            index={idx}
            onPress={() => onRoutinePress(routine)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  categorySection: {
    gap: 12,
  },
  categorySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categorySectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  categorySectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  categorySectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
  },
  categorySectionTagline: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 2,
  },
  categorySectionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.border,
  },
  categorySectionBadgeText: {
    fontSize: 12,
    color: palette.sub,
    fontWeight: "600",
  },
  routinesList: {
    gap: 10,
  },
});
