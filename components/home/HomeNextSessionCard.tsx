import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { homeColors } from "./homeUi";

const palette = homeColors;

type Props = {
  hasPending: boolean;
  upcomingLabel: string;
  onPrimary: () => void;
  primaryLabel: string;
  onSecondary: () => void;
  secondaryLabel: string;
  onFeedback?: () => void;
  /** true si la séance en attente est datée d'un jour PASSÉ → nag feedback légitime */
  feedbackDue?: boolean;
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
  feedbackDue = false,
  primaryDisabled = false,
  secondaryDisabled = false,
}: Props) {
  if (__DEV__) console.log("[RENDER] HomeNextSessionCard");
  const primaryTextColor = primaryDisabled ? palette.sub : palette.accent;
  const secondaryTextColor = secondaryDisabled ? palette.sub : palette.text;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleGroup}>
          <View style={styles.sectionMark} />
          <Text style={styles.sectionTitle}>Prochaine séance</Text>
        </View>
        <View
          style={[
            styles.badge,
            hasPending
              ? { backgroundColor: "rgba(52, 211, 153, 0.16)", borderColor: palette.success }
              : { backgroundColor: palette.cardSoft, borderColor: palette.borderSoft },
          ]}
        >
          <Text style={[styles.badgeText, { color: hasPending ? palette.success : palette.sub }]}>
            {hasPending ? "Prête" : "À créer"}
          </Text>
        </View>
      </View>

      <View style={styles.nextCard}>
        <View style={styles.nextTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextMainText}>{upcomingLabel}</Text>
            {hasPending ? (
              <Text style={styles.nextSubText}>
                {feedbackDue
                  ? "Séance en attente. Dis-nous comment ça s'est passé pour débloquer la suivante."
                  : "Prête à être lancée."}
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
            <Text style={[styles.nextPrimaryText, { color: primaryTextColor }]}>{primaryLabel}</Text>
            <Text style={[styles.nextPrimaryArrow, { color: primaryTextColor }]}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSecondary}
            style={[styles.nextSecondary, secondaryDisabled && styles.nextSecondaryDisabled]}
            activeOpacity={0.9}
            disabled={secondaryDisabled}
          >
            <Text style={[styles.nextSecondaryText, { color: secondaryTextColor }]}>{secondaryLabel}</Text>
          </TouchableOpacity>
        </View>

        {hasPending && feedbackDue && onFeedback ? (
          <TouchableOpacity onPress={onFeedback} style={styles.nextFeedbackChip} activeOpacity={0.9}>
            <Text style={styles.nextFeedbackText}>Comment ça s'est passé ?</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionMark: {
    width: 3,
    height: 14,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.text,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontWeight: "700",
    fontSize: 11,
  },
  nextCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    padding: 14,
    gap: 12,
    overflow: "hidden",
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
  nextPrimaryDisabled: {
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    opacity: 0.7,
  },
  nextPrimaryText: {
    fontSize: 14,
    fontWeight: "800",
  },
  nextPrimaryArrow: {
    fontSize: 13,
  },
  nextSecondary: {
    width: 140,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  nextSecondaryDisabled: {
    opacity: 0.7,
  },
  nextSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
  },
  nextFeedbackChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  nextFeedbackText: {
    fontSize: 12,
    color: palette.sub,
    fontWeight: "700",
  },
});

export default React.memo(HomeNextSessionCardInner);
