import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { SectionHeader } from "../ui/SectionHeader";
import { theme } from "../../constants/theme";

const palette = theme.colors;

type Props = {
  hasPending: boolean;
  upcomingLabel: string;
  onPrimary: () => void;
  primaryLabel: string;
  onSecondary: () => void;
  secondaryLabel: string;
  onFeedback?: () => void;
};

export default function HomeNextSessionCard({
  hasPending,
  upcomingLabel,
  onPrimary,
  primaryLabel,
  onSecondary,
  secondaryLabel,
  onFeedback,
}: Props) {
  return (
    <View style={styles.section}>
      <SectionHeader
        title="Prochaine séance FKS"
        right={<Badge label={hasPending ? "Planifiée" : "À générer"} tone={hasPending ? "ok" : "default"} />}
      />

      <Card variant="soft" style={styles.nextCard}>
        <View style={styles.nextRail} />
        <View style={styles.nextGlow} />
        <View style={styles.nextTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextMainText}>{upcomingLabel}</Text>
            {hasPending ? (
              <Text style={styles.nextSubText}>
                Séance en attente. Feedback requis pour débloquer la suivante.
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.nextDivider} />

        <View style={styles.nextActionsRow}>
          <TouchableOpacity onPress={onPrimary} style={styles.nextPrimary} activeOpacity={0.9}>
            <Text style={styles.nextPrimaryText}>{primaryLabel}</Text>
            <Text style={styles.nextPrimaryArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onSecondary} style={styles.nextSecondary} activeOpacity={0.9}>
            <Text style={styles.nextSecondaryText}>{secondaryLabel}</Text>
          </TouchableOpacity>
        </View>

        {hasPending && onFeedback ? (
          <TouchableOpacity onPress={onFeedback} style={styles.nextFeedbackChip} activeOpacity={0.9}>
            <Text style={styles.nextFeedbackText}>Donner mon feedback</Text>
          </TouchableOpacity>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  nextCard: {
    borderRadius: 20,
    padding: 14,
    gap: 12,
    overflow: "hidden",
  },
  nextRail: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: palette.borderSoft,
  },
  nextGlow: {
    position: "absolute",
    top: -60,
    right: -60,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: "rgba(20,20,20,0.04)",
  },
  nextTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nextMainText: {
    fontSize: 14,
    fontWeight: "800",
    color: palette.text,
  },
  nextSubText: {
    marginTop: 4,
    fontSize: 12,
    color: palette.sub,
  },
  nextDivider: {
    height: 1,
    backgroundColor: palette.borderSoft,
  },
  nextActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  nextPrimary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  nextPrimaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: palette.accent,
  },
  nextPrimaryArrow: {
    fontSize: 13,
    color: palette.accent,
  },
  nextSecondary: {
    width: 140,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  nextSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
  nextFeedbackChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  nextFeedbackText: {
    fontSize: 12,
    color: palette.sub,
    fontWeight: "700",
  },
});
