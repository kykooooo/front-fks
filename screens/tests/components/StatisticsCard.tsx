// screens/tests/components/StatisticsCard.tsx
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { formatStatValue } from "../testHelpers";
import type { FieldKey } from "../testConfig";

const palette = theme.colors;

export type SummaryStat = {
  key: FieldKey;
  label: string;
  unit: string;
  avg: number;
  best: number;
  count: number;
};

type Props = {
  stats: SummaryStat[];
  entriesCount: number;
  cardAnim: Animated.Value;
};

export function StatisticsCard({ stats, entriesCount, cardAnim }: Props) {
  if (stats.length === 0) return null;

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
      <Card variant="surface" style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryTitleRow}>
            <Ionicons name="stats-chart-outline" size={16} color={theme.colors.cyan500} />
            <View>
              <Text style={styles.sectionTitle}>Statistiques</Text>
              <Text style={styles.sectionSub}>
                Sur {entriesCount} batterie(s)
              </Text>
            </View>
          </View>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>Stats</Text>
          </View>
        </View>

        <View style={styles.summaryList}>
          {stats.map((item) => (
            <View key={item.key} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <View style={styles.summaryValues}>
                <View style={styles.summaryPill}>
                  <Text style={styles.summaryPillLabel}>Moy.</Text>
                  <Text style={styles.summaryPillValue}>
                    {formatStatValue(item.avg, item.unit)}
                    {item.unit ? ` ${item.unit}` : ""}
                  </Text>
                </View>
                <View style={[styles.summaryPill, styles.summaryPillBest]}>
                  <Text style={styles.summaryPillLabel}>Meilleur</Text>
                  <Text style={styles.summaryPillValue}>
                    {formatStatValue(item.best, item.unit)}
                    {item.unit ? ` ${item.unit}` : ""}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
  },
  sectionSub: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
    marginTop: 2,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  summaryTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  summaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  summaryBadgeText: {
    color: palette.sub,
    fontSize: TYPE.micro.fontSize,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryList: {
    gap: 10,
  },
  summaryRow: {
    gap: 8,
  },
  summaryLabel: {
    color: palette.text,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
  },
  summaryValues: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  summaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    minWidth: 110,
  },
  summaryPillBest: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  summaryPillLabel: {
    color: palette.sub,
    fontSize: TYPE.micro.fontSize,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryPillValue: {
    color: palette.text,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    marginTop: 2,
  },
});
