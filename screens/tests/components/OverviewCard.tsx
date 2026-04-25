// screens/tests/components/OverviewCard.tsx
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { formatEntryTimestamp, getUnitForField, isBetterDelta } from "../testHelpers";
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
      <Card variant="surface" style={styles.overviewCard}>
        <View style={styles.overviewHeaderRow}>
          <View style={styles.overviewTitleRow}>
            <Ionicons name="trophy-outline" size={16} color={theme.colors.amber500} />
            <View>
              <Text style={styles.sectionTitle}>Dernière performance</Text>
              <Text style={styles.sectionSub}>
                {lastTwo.length > 1
                  ? "Comparée au test précédent"
                  : "Premier test enregistré"}
              </Text>
            </View>
          </View>
          <View style={styles.overviewPill}>
            <Text style={styles.overviewPillLabel}>Test</Text>
            <Text style={styles.overviewPillDate}>
              {formatEntryTimestamp(lastEntry.ts, "dd/MM")}
            </Text>
          </View>
        </View>

        <View style={{ gap: 16, marginTop: 12 }}>
          {groupedFields.map((group) => {
            const cfg = getGroupConfig(group.fields[0]?.group ?? "");
            return (
              <View key={group.title} style={styles.overviewGroup}>
                <View style={styles.groupHeader}>
                  <LinearGradient
                    colors={cfg.colors}
                    style={styles.groupIcon}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name={cfg.icon} size={14} color={theme.colors.white} />
                  </LinearGradient>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {group.fields.map((f) => {
                    const val = lastEntry[f.key];
                    if (val === undefined) return null;
                    const unit = getUnitForField(f.key);
                    return (
                      <View key={f.key} style={styles.overviewMetricRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.overviewMetricLabel}>{f.label}</Text>
                          <Text style={styles.overviewMetricValue}>
                            {val}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
  overviewCard: {
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 10,
  },
  overviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  overviewTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  overviewPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "flex-end",
  },
  overviewPillLabel: {
    color: palette.sub,
    fontSize: TYPE.micro.fontSize,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  overviewPillDate: {
    color: palette.text,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
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
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  groupTitle: {
    color: palette.text,
    fontSize: TYPE.caption.fontSize,
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
    fontSize: TYPE.micro.fontSize,
  },
  overviewMetricValue: {
    color: palette.text,
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    marginTop: 2,
  },
  overviewNotesBlock: {
    marginTop: 6,
    borderRadius: RADIUS.sm,
    padding: 10,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  overviewNotesText: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
    lineHeight: 17,
  },
  deltaChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSoft,
    alignItems: "flex-end",
  },
  deltaText: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "600",
  },
  deltaSub: {
    fontSize: TYPE.micro.fontSize,
    color: palette.sub,
  },
});
