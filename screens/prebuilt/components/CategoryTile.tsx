// screens/prebuilt/components/CategoryTile.tsx
import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useHaptics } from "../../../hooks/useHaptics";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import type { CategoryConfig } from "../prebuiltConfig";

const palette = theme.colors;

type Props = {
  category: string;
  count: number;
  config: CategoryConfig;
  index: number;
  onPress: () => void;
};

export function CategoryTile({ category, count, config, index, onPress }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        delay: index * 50,
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
      style={[styles.tileWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        <Card variant="surface" style={styles.tile}>
          <View style={styles.tileTopRow}>
            <LinearGradient
              colors={config.gradient}
              style={styles.tileIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={config.icon} size={18} color="#fff" />
            </LinearGradient>
            <View style={styles.tileCount}>
              <Text style={styles.tileCountText}>{count}</Text>
            </View>
          </View>
          <Text style={styles.tileTitle} numberOfLines={1}>
            {category}
          </Text>
          <Text style={styles.tileTagline} numberOfLines={2}>
            {config.tagline}
          </Text>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tileWrap: {
    width: "48%",
  },
  tile: {
    padding: 12,
    gap: 8,
    minHeight: 108,
  },
  tileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  tileCount: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: palette.bgSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    minWidth: 22,
    alignItems: "center",
  },
  tileCountText: {
    fontSize: 11,
    color: palette.sub,
    fontWeight: "700",
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
  tileTagline: {
    fontSize: 11,
    color: palette.sub,
    lineHeight: 14,
    minHeight: 28,
  },
});
