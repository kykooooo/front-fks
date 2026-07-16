// screens/tests/components/TestHeader.tsx
// Langage BlockCard : Card surface + barre d'accent 4px + icone en cercle teinte.
// Pas de back button ici : la route "Tests" a deja headerShown:true (RootNavigator).
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { formatEntryTimestamp } from "../testHelpers";
import type { TestEntry } from "../testConfig";

const palette = theme.colors;

type Props = {
  lastEntry: TestEntry | undefined;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
};

export function TestHeader({ lastEntry, fadeAnim, slideAnim }: Props) {
  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <Card variant="surface" style={styles.heroCard}>
        <View style={[styles.heroAccentBar, { backgroundColor: palette.accent }]} />
        <View style={styles.heroInner}>
          <View style={[styles.heroIconWrap, { backgroundColor: palette.accentSoft }]}>
            <Ionicons name="speedometer-outline" size={20} color={palette.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>Tests terrain</Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              Mesure tes qualités physiques
            </Text>
          </View>
          {lastEntry ? (
            <Badge label={`Dernier ${formatEntryTimestamp(lastEntry.ts, "dd/MM")}`} />
          ) : null}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heroCard: { padding: 0, flexDirection: "row", overflow: "hidden" },
  heroAccentBar: {
    width: 4,
    borderTopLeftRadius: theme.radius.sm,
    borderBottomLeftRadius: theme.radius.sm,
  },
  heroInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800", color: palette.text },
  subtitle: { fontSize: 13, color: palette.sub, marginTop: 2, minHeight: 18 },
});
