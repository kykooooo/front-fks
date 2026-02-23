import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/theme";
import { getFootballLabel } from "../../config/trainingDefaults";

const palette = theme.colors;

type Props = {
  phaseLabel: string;
  tsbValue: number;
  tsbTone: "good" | "warn" | "danger";
  matchSoon: boolean;
};

export default function HomeStatusBar({ phaseLabel, tsbValue, tsbTone, matchSoon }: Props) {
  const football = getFootballLabel(tsbValue);

  return (
    <View style={styles.wrap}>
      <View style={styles.pill}>
        <Text style={styles.pillText}>{phaseLabel}</Text>
      </View>
      <View style={styles.center}>
        <Text style={styles.centerLabel}>ÉTAT</Text>
        <Text style={[styles.centerValue, { color: football.color }]}>
          {football.label}
        </Text>
      </View>
      <View style={styles.right}>
        {matchSoon ? (
          <View style={styles.warning}>
            <Ionicons name="alert-circle" size={16} color={palette.warn} />
            <Text style={styles.warningText}>Match proche</Text>
          </View>
        ) : (
          <Text style={styles.rightSub}>—</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.text,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  center: {
    alignItems: "center",
  },
  centerLabel: {
    fontSize: 10,
    color: palette.sub,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  centerValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "800",
  },
  right: {
    alignItems: "flex-end",
    minWidth: 90,
  },
  rightSub: {
    fontSize: 12,
    color: palette.sub,
  },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  warningText: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.warn,
  },
});
