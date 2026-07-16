// screens/tests/components/CycleTimingBanner.tsx
// Style coachTipBox (fond soft + barre gauche 3px + kicker uppercase), même
// motif que le "Conseil du coach" de BlockCard / "Points clés" de PrebuiltSessionDetail.
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import type { TestTimingBanner, TestTimingTone } from "../testTiming";

const palette = theme.colors;

type Props = {
  banner: TestTimingBanner;
  cardAnim: Animated.Value;
};

const KICKER: Record<TestTimingTone, string> = {
  start: "Début de cycle",
  end: "Fin de cycle",
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
      <View style={styles.banner}>
        <View style={styles.header}>
          <Ionicons name={icon} size={12} color={palette.accent} />
          <Text style={styles.kicker}>{KICKER[banner.tone]}</Text>
        </View>
        <Text style={styles.message}>{banner.message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: 4,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
    backgroundColor: palette.accentSoft,
    borderTopRightRadius: theme.radius.sm,
    borderBottomRightRadius: theme.radius.sm,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 5 },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: palette.accent,
  },
  message: {
    color: palette.text,
    fontSize: 13,
    lineHeight: 18,
  },
});
