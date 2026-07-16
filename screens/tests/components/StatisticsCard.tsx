// screens/tests/components/StatisticsCard.tsx
// Langage commun : SectionHeader (hors Card) + Card surface + rangées de pills sobres.
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { formatStatValueForField, shouldHideUnitSuffix } from "../testHelpers";
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
      <View style={styles.section}>
        <SectionHeader
          title="Statistiques"
          right={<Badge label={`${entriesCount} relevé${entriesCount > 1 ? "s" : ""}`} />}
        />
        <Card variant="surface" style={styles.summaryCard}>
          <View style={styles.summaryList}>
            {stats.map((item) => {
              const hideUnit = shouldHideUnitSuffix(item.key);
              return (
                <View key={item.key} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{item.label}</Text>
                  <View style={styles.summaryValues}>
                    <View style={styles.summaryPill}>
                      <Text style={styles.summaryPillLabel}>Moy.</Text>
                      <Text style={styles.summaryPillValue}>
                        {formatStatValueForField(item.key, item.avg)}
                        {item.unit && !hideUnit ? ` ${item.unit}` : ""}
                      </Text>
                    </View>
                    <View style={[styles.summaryPill, styles.summaryPillBest]}>
                      <Text style={styles.summaryPillLabel}>Meilleur</Text>
                      <Text style={styles.summaryPillValue}>
                        {formatStatValueForField(item.key, item.best)}
                        {item.unit && !hideUnit ? ` ${item.unit}` : ""}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  summaryCard: {
    borderRadius: theme.radius.lg,
    padding: 14,
  },
  summaryList: {
    gap: 10,
  },
  summaryRow: {
    gap: 8,
  },
  summaryLabel: {
    color: palette.text,
    fontSize: 13,
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
    borderRadius: theme.radius.md,
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
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryPillValue: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
});
