// screens/prebuilt/components/AnimatedCategoryCard.tsx
import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useHaptics } from "../../../hooks/useHaptics";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import type { CategoryConfig } from "../prebuiltConfig";

const palette = theme.colors;

type Props = {
  category: string;
  count: number;
  config: CategoryConfig;
  index: number;
  isActive: boolean;
  onPress: () => void;
};

export function AnimatedCategoryCard({
  category, count, config, index, isActive, onPress,
}: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, index]);

  const haptics = useHaptics();

  const handlePress = () => {
    haptics.impactLight();
    onPress();
  };

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateX: slideAnim }],
      }}
    >
      <TouchableOpacity
        style={[styles.categoryChip, isActive && styles.categoryChipActive]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={isActive ? config.gradient : [palette.cardSoft, palette.cardSoft]}
          style={styles.categoryChipIcon}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons
            name={config.icon}
            size={14}
            color={isActive ? theme.colors.white : palette.sub}
          />
        </LinearGradient>
        <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
          {category}
        </Text>
        <View style={[styles.categoryChipBadge, isActive && styles.categoryChipBadgeActive]}>
          <Text style={[styles.categoryChipBadgeText, isActive && styles.categoryChipBadgeTextActive]}>
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    paddingRight: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSoft,
  },
  categoryChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  categoryChipIcon: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryChipText: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: palette.accent,
  },
  categoryChipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    minWidth: 22,
    alignItems: "center",
  },
  categoryChipBadgeActive: {
    borderColor: palette.accent,
    backgroundColor: theme.colors.accentSoft10,
  },
  categoryChipBadgeText: {
    fontSize: TYPE.micro.fontSize,
    color: palette.sub,
    fontWeight: "700",
  },
  categoryChipBadgeTextActive: {
    color: palette.accent,
  },
});
