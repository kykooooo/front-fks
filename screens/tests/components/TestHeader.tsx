// screens/tests/components/TestHeader.tsx
import React from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { formatEntryTimestamp } from "../testHelpers";
import type { TestEntry } from "../testConfig";

const palette = theme.colors;

type Props = {
  lastEntry: TestEntry | undefined;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
};

export function TestHeader({ lastEntry, fadeAnim, slideAnim }: Props) {
  const navigation = useNavigation();

  return (
    <Animated.View
      style={[
        styles.headerRow,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={22} color={palette.text} />
      </TouchableOpacity>
      <View style={styles.headerLeft}>
        <LinearGradient
          colors={[theme.colors.accent, theme.colors.accentAlt]}
          style={styles.headerIcon}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="speedometer-outline" size={24} color={theme.colors.white} />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tests terrain</Text>
          <Text style={styles.subtitle}>
            Mesure tes qualités physiques
          </Text>
        </View>
      </View>
      {lastEntry && (
        <View style={styles.lastBadge}>
          <Text style={styles.lastBadgeLabel}>Dernier</Text>
          <Text style={styles.lastBadgeDate}>
            {formatEntryTimestamp(lastEntry.ts, "dd/MM")}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    color: palette.text,
    fontSize: TYPE.title.fontSize,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
    marginTop: 2,
  },
  lastBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    alignItems: "flex-end",
  },
  lastBadgeLabel: {
    color: palette.sub,
    fontSize: TYPE.micro.fontSize,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lastBadgeDate: {
    color: palette.text,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    marginTop: 2,
  },
});
