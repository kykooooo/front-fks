// screens/tests/components/OverviewCard.tsx
// "Dernière performance" — historique unifié (Phase C) : chaque champ affiche
// sa PROPRE dernière valeur connue et sa propre date, tous cycles/entrées
// confondus (avant : un seul instantané `lastEntry`, filtré par playlist —
// changer de cycle "cachait" les valeurs des autres champs). Le delta (vs.
// test précédent) reste calculé par champ, indépendamment des autres.
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { formatEntryTimestamp, formatEntryValue, getUnitForField, isBetterDelta, shouldHideUnitSuffix, type FieldSample } from "../testHelpers";
import { getGroupConfig, type FieldKey, type FieldConfig } from "../testConfig";

const palette = theme.colors;

type GroupedField = { title: string; fields: FieldConfig[] };

type Props = {
  latestTs: number;
  latestNotes: string | null;
  hasComparison: boolean;
  fieldSamples: Partial<Record<FieldKey, FieldSample[]>>;
  groupedFields: GroupedField[];
  cardAnim: Animated.Value;
};

export function OverviewCard({ latestTs, latestNotes, hasComparison, fieldSamples, groupedFields, cardAnim }: Props) {
  const renderDelta = (key: FieldKey, currNum: number, prevNum: number) => {
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
        <Text style={styles.deltaSub}>vs. précédent</Text>
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
          right={<Badge label={formatEntryTimestamp(latestTs, "dd/MM")} />}
        />
        <Card variant="surface" style={styles.overviewCard}>
          <Text style={styles.overviewCaption}>
            {hasComparison ? "Dernières valeurs connues, tous tests confondus" : "Premier test enregistré"}
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
                    const samples = fieldSamples[f.key];
                    if (!samples || samples.length === 0) return null;
                    const latest = samples[0];
                    const prev = samples[1];
                    const unit = shouldHideUnitSuffix(f.key) ? "" : getUnitForField(f.key);
                    const isStale = latest.ts !== latestTs;
                    return (
                      <View key={f.key} style={styles.overviewMetricRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.overviewMetricLabel}>{f.label}</Text>
                          <Text style={styles.overviewMetricValue}>
                            {formatEntryValue(f.key, latest.value)}
                            {unit ? ` ${unit}` : ""}
                          </Text>
                          {isStale ? (
                            <Text style={styles.overviewMetricDate}>
                              {formatEntryTimestamp(latest.ts, "dd/MM")}
                            </Text>
                          ) : null}
                        </View>
                        {prev ? renderDelta(f.key, latest.value, prev.value) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
              );
            })}

            {latestNotes ? (
              <View style={styles.overviewNotesBlock}>
                <View style={styles.groupHeader}>
                  <Ionicons name="document-text-outline" size={14} color={palette.sub} />
                  <Text style={styles.groupTitle}>Dernières notes</Text>
                </View>
                <Text style={styles.overviewNotesText}>{latestNotes}</Text>
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
  overviewMetricDate: {
    color: palette.sub,
    fontSize: 10,
    marginTop: 1,
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
