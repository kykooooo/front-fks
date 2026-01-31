import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../ui/Card";
import { theme } from "../../constants/theme";

const palette = theme.colors;

type Props = {
  label: string;
  sub: string;
  iconName?: string | null;
  progressRatio: number;
  primaryLabel: string;
  onPrimary: () => void;
  showManage?: boolean;
  onManage?: () => void;
};

export default function HomeCycleHero({
  label,
  sub,
  iconName,
  progressRatio,
  primaryLabel,
  onPrimary,
  showManage,
  onManage,
}: Props) {
  return (
    <Card variant="surface" style={styles.cycleHero}>
      <View style={styles.cycleHeroTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cycleHeroKicker}>CYCLE</Text>
          <Text style={styles.cycleHeroTitle}>{label}</Text>
          <Text style={styles.cycleHeroSub}>{sub}</Text>
        </View>
        {iconName ? (
          <View style={styles.cycleIconPill}>
            <Ionicons name={iconName as any} size={18} color={palette.accent} />
          </View>
        ) : null}
      </View>

      <View style={styles.cycleTrack}>
        <View
          style={[
            styles.cycleFill,
            { width: `${Math.max(0, Math.min(1, progressRatio)) * 100}%` },
          ]}
        />
      </View>

      <View style={styles.cycleActions}>
        <TouchableOpacity onPress={onPrimary} style={styles.cyclePrimary} activeOpacity={0.9}>
          <Text style={styles.cyclePrimaryText}>{primaryLabel}</Text>
          <Text style={styles.cyclePrimaryArrow}>→</Text>
        </TouchableOpacity>
        {showManage ? (
          <TouchableOpacity onPress={onManage} style={styles.cycleSecondary} activeOpacity={0.9}>
            <Text style={styles.cycleSecondaryText}>Gérer</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cycleHero: {
    borderRadius: 26,
    padding: 16,
    overflow: "hidden",
    gap: 12,
  },
  cycleHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cycleHeroKicker: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.sub,
    fontWeight: "700",
  },
  cycleHeroTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "900",
    color: palette.text,
  },
  cycleHeroSub: {
    marginTop: 4,
    fontSize: 12,
    color: palette.sub,
    lineHeight: 17,
  },
  cycleIconPill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  cycleTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  cycleFill: {
    height: "100%",
    backgroundColor: palette.accent,
    borderRadius: 999,
  },
  cycleActions: {
    flexDirection: "row",
    gap: 10,
  },
  cyclePrimary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  cyclePrimaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: palette.text,
  },
  cyclePrimaryArrow: {
    fontSize: 13,
    color: palette.accent,
  },
  cycleSecondary: {
    width: 96,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  cycleSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
});
