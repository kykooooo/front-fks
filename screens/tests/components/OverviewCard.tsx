// screens/tests/components/OverviewCard.tsx
// Langage commun : SectionHeader (hors Card) + icônes de groupe en cercles teintés
// plats (même famille que BatteryCard/EntryFormCard, plus de LinearGradient).
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { formatEntryTimestamp, formatEntryValue, getUnitForField, isBetterDelta, shouldHideUnitSuffix } from "../testHelpers";
import { getGroupConfig, FIELD_BY_KEY, type TestEntry, type FieldKey, type FieldConfig } from "../testConfig";

const palette = theme.colors;

type GroupedField = { title: string; fields: FieldConfig[] };

type Props = {
  lastEntry: TestEntry;
  lastTwo: TestEntry[];
  groupedFields: GroupedField[];
  cardAnim: Animated.Value;
};

export function OverviewCard({ lastEntry, lastTwo, groupedFields, cardAnim }: Props) {
  const renderDelta = (key: FieldKey) => {
    if (lastTwo.length < 2) return null;
    const curr = lastTwo[0]?.[key];
    const prev = lastTwo[1]?.[key];
    if (curr === undefined || prev === undefined) return null;

    const currNum = Number(curr);
    const prevNum = Number(prev);
    if (!Number.isFinite(currNum) || !Number.isFinite(prevNum)) return null;

    const delta = currNum - prevNum;
    if (delta === 0) return null;

    const better = isBetterDelta(key, delta);
    const sign = delta > 0 ? "+" : "";
    const unit = getUnitForField(key);
    const arrow = better ? "↑" : "↓";

    return (
      <View style={styles.deltaChip}>
        <Text style={[styles.deltaText, { color: better ? palette.success : palette.danger }]}>
          {arrow} {sign}
          {Math.abs(delta).toFixed(2)} {unit}
        </Text>
        <Text style={styles.deltaSub}>vs. dernier test</Text>
      </View>
    );
  };

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
          title="Dernière performance"
          right={<Badge label={formatEntryTimestamp(lastEntry.ts, "dd/MM")} />}
        />
        <Card variant="surface" style={styles.overviewCard}>
          <Text style={styles.overviewCaption}>
            {lastTwo.length > 1 ? "Comparée au test précédent" : "Premier test enregistré"}
          </Text>

          <View style={{ gap: 16, marginTop: 10 }}>
            {groupedFields.map((group) => {
              const cfg = getGroupConfig(group.fields[0]?.group ?? "");
              return (
                <View key={group.title} style={styles.overviewGroup}>
                  <View style={styles.groupHeader}>
                    <View style={[styles.groupIcon, { backgroundColor: cfg.tintSoft }]}>
                      <Ionicons name={cfg.icon} size={14} color={cfg.tint} />
                    </View>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    {group.fields.map((f) => {
                      const val = lastEntry[f.key];
                      if (val === undefined) return null;
                      const unit = shouldHideUnitSuffix(f.key) ? "" : getUnitForField(f.key);
                      return (
                        <View key={f.key} style={styles.overviewMetricRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.overviewMetricLabel}>{f.label}</Text>
                            <Text style={styles.overviewMetricValue}>
                              {formatEntryValue(f.key, val)}
                              {unit ? ` ${unit}` : ""}
                            </Text>
                          </View>
                          {renderDelta(f.key)}
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {lastEntry.notes ? (
              <View style={styles.overviewNotesBlock}>
                <View style={styles.groupHeader}>
                  <Ionicons name="document-text-outline" size={14} color={palette.sub} />
                  <Text style={styles.groupTitle}>Notes du jour</Text>
                </View>
                <Text style={styles.overviewNotesText}>{lastEntry.notes}</Text>
              </View>
            ) : null}
          </View>
        </Card>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  overviewCard: {
    borderRadius: theme.radius.lg,
    padding: 14,
  },
  overviewCaption: {
    color: palette.sub,
    fontSize: 12,
  },
  overviewGroup: {
    gap: 8,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  groupIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  groupTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },
  overviewMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  overviewMetricLabel: {
    color: palette.sub,
    fontSize: 11,
  },
  overviewMetricValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  overviewNotesBlock: {
    marginTop: 6,
    borderRadius: theme.radius.md,
    padding: 10,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  overviewNotesText: {
    color: palette.sub,
    fontSize: 12,
    lineHeight: 17,
  },
  deltaChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSoft,
    alignItems: "flex-end",
  },
  deltaText: {
    fontSize: 11,
    fontWeight: "600",
  },
  deltaSub: {
    fontSize: 9,
    color: palette.sub,
  },
});
