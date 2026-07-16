// screens/tests/components/CycleTimingBanner.tsx
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import type { TestTimingBanner } from "../testTiming";

const palette = theme.colors;

type Props = {
  banner: TestTimingBanner;
  cardAnim: Animated.Value;
};

export function CycleTimingBanner({ banner, cardAnim }: Props) {
  const icon = banner.tone === "start" ? "flag-outline" : "checkmark-done-circle-outline";

  return (
    <Animated.View
      style={{
        opacity: cardAnim,
        transform: [
          {
            translateY: cardAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
            }),
          },
        ],
      }}
    >
      <Card variant="soft" style={styles.banner}>
        <Ionicons name={icon} size={18} color={palette.accent} />
        <Text style={styles.message}>{banner.message}</Text>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  message: {
    flex: 1,
    color: palette.text,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
});
