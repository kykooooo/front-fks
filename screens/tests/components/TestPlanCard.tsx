// screens/tests/components/TestPlanCard.tsx
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { PLAYLIST_PLAN, type PlaylistId } from "../testConfig";

const palette = theme.colors;

type Props = {
  selectedPlaylist: PlaylistId;
  cardAnim: Animated.Value;
};

export function TestPlanCard({ selectedPlaylist, cardAnim }: Props) {
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
      <Card variant="surface" style={styles.planCard}>
        <View style={styles.planHeader}>
          <Ionicons name="clipboard-outline" size={16} color={palette.accent} />
          <Text style={styles.sectionTitle}>
            Déroulé conseillé
          </Text>
        </View>
        <View style={{ gap: 10, marginTop: 10 }}>
          {PLAYLIST_PLAN[selectedPlaylist].map((step, idx) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepIndexCircle}>
                <Text style={styles.stepIndex}>{idx + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  planCard: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  stepIndexCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIndex: {
    color: palette.accent,
    fontWeight: "700",
    fontSize: 12,
  },
  stepText: {
    color: palette.text,
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },
});
