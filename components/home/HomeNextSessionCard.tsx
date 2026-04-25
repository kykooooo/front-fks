import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { SectionHeader } from "../ui/SectionHeader";
import { theme, TYPE, RADIUS } from "../../constants/theme";

const palette = theme.colors;

type Props = {
  hasPending: boolean;
  upcomingLabel: string;
  onPrimary: () => void;
  primaryLabel: string;
  onSecondary: () => void;
  secondaryLabel: string;
  onFeedback?: () => void;
  primaryDisabled?: boolean;
  secondaryDisabled?: boolean;
};

function HomeNextSessionCardInner({
  hasPending,
  upcomingLabel,
  onPrimary,
  primaryLabel,
  onSecondary,
  secondaryLabel,
  onFeedback,
  primaryDisabled = false,
  secondaryDisabled = false,
}: Props) {
  if (__DEV__) console.log("[RENDER] HomeNextSessionCard");
  const primaryTextColor = primaryDisabled ? palette.sub : palette.accent;
  const secondaryTextColor = secondaryDisabled ? palette.sub : palette.text;

  return (
    <View style={styles.section}>
      <SectionHeader
        title="Prochaine séance"
        right={
          <Badge
            label={hasPending ? "Prête" : "À créer"}
            tone={hasPending ? "ok" : "default"}
          />
        }
      />

      <Card variant="soft" style={styles.nextCard}>
        <View style={styles.nextRail} />
        <View style={styles.nextGlow} />
        <View style={styles.nextTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextMainText}>{upcomingLabel}</Text>
            {hasPending ? (
              <Text style={styles.nextSubText}>
                Ta séance est prête. Ouvre-la pour la lancer ou la reprendre.
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.nextDivider} />

        <View style={styles.nextActionsRow}>
          <TouchableOpacity
            onPress={onPrimary}
            style={[styles.nextPrimary, primaryDisabled && styles.nextPrimaryDisabled]}
            activeOpacity={0.9}
            disabled={primaryDisabled}
          >
            <Text style={[styles.nextPrimaryText, { color: primaryTextColor }]}>
              {primaryLabel}
            </Text>
            <Text style={[styles.nextPrimaryArrow, { color: primaryTextColor }]}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSecondary}
            style={[styles.nextSecondary, secondaryDisabled && styles.nextSecondaryDisabled]}
            activeOpacity={0.9}
            disabled={secondaryDisabled}
          >
            <Text style={[styles.nextSecondaryText, { color: secondaryTextColor }]}>
              {secondaryLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {hasPending && onFeedback ? (
          <TouchableOpacity
            onPress={onFeedback}
            style={styles.nextFeedbackChip}
            activeOpacity={0.9}
          >
            <Text style={styles.nextFeedbackText}>J'ai fini, donner mon feedback</Text>
          </TouchableOpacity>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  nextCard: {
    borderRadius: RADIUS.xl,
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
    borderRadius: RADIUS.pill,
    backgroundColor: theme.colors.neutralSoft04,
  },
  nextTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nextMainText: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "800",
    color: palette.text,
  },
  nextSubText: {
    marginTop: 4,
    fontSize: TYPE.caption.fontSize,
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
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  nextPrimaryDisabled: {
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    opacity: 0.7,
  },
  nextPrimaryText: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "800",
  },
  nextPrimaryArrow: {
    fontSize: TYPE.caption.fontSize,
  },
  nextSecondary: {
    width: 140,
    paddingVertical: 11,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  nextSecondaryDisabled: {
    opacity: 0.7,
  },
  nextSecondaryText: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
  },
  nextFeedbackChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  nextFeedbackText: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    fontWeight: "700",
  },
});

export default React.memo(HomeNextSessionCardInner);
