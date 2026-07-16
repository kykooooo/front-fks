// screens/tests/components/HistorySection.tsx
// Historique unifié (Phase C) : UNE timeline, toutes entrées confondues —
// avant, `entriesForPlaylist` filtrait par cycle actif et "cachait" les
// anciennes valeurs dès qu'on changeait de cycle. Chaque ligne affiche les
// champs réellement présents dans CETTE entrée (une entrée peut être la
// batterie socle complète, ou un seul test optionnel saisi à part) + un tag
// discret du cycle actif au moment du test, si connu (informationnel seul).
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { formatEntryTimestamp, formatEntryValue, getUnitForField, shouldHideUnitSuffix } from "../testHelpers";
import {
  FIELD_DEFS, FIELD_BY_KEY, PLAYLISTS, SHORT_LABELS,
  type TestEntry, type FieldKey,
} from "../testConfig";

const palette = theme.colors;

type Props = {
  entries: TestEntry[];
  cardAnim: Animated.Value;
};

const MAX_ROWS = 6;
const MAX_FIELDS_PER_ROW = 4;

const hasValue = (entry: TestEntry, key: FieldKey): boolean => {
  const v = (entry as any)[key];
  if (v === undefined || v === null || v === "") return false;
  return Number.isFinite(Number(v));
};

export function HistorySection({ entries, cardAnim }: Props) {
  if (entries.length === 0) return null;

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
          title="Historique"
          right={<Badge label={`${entries.length} relevé${entries.length > 1 ? "s" : ""}`} />}
        />
        <Card variant="surface" style={styles.historyCard}>
          {entries.slice(0, MAX_ROWS).map((e, idx) => {
            const rowKeys = FIELD_DEFS.map((f) => f.key).filter((key) => hasValue(e, key));
            const shown = rowKeys.slice(0, MAX_FIELDS_PER_ROW);
            const extra = rowKeys.length - shown.length;
            const valuesText =
              shown
                .map((key) => {
                  const unit = shouldHideUnitSuffix(key) ? "" : getUnitForField(key);
                  const label = SHORT_LABELS[key] ?? FIELD_BY_KEY[key]?.label ?? key;
                  return `${label} ${formatEntryValue(key, (e as any)[key])}${unit}`;
                })
                .join(" · ") + (extra > 0 ? ` +${extra}` : "");
            const provenance = e.playlist ? PLAYLISTS[e.playlist]?.label : null;
            return (
              <View
                key={`${e.ts}-${idx}`}
                style={[
                  styles.historyRow,
                  idx === Math.min(entries.length, MAX_ROWS) - 1 && styles.historyRowLast,
                ]}
              >
                <View>
                  <Text style={styles.historyDate}>
                    {formatEntryTimestamp(e.ts, "dd/MM/yyyy")}
                  </Text>
                  <Text style={styles.historyTime}>
                    {formatEntryTimestamp(e.ts, "HH:mm")}
                    {provenance ? ` · ${provenance}` : ""}
                  </Text>
                </View>
                <Text style={styles.historyValues} numberOfLines={2}>
                  {valuesText || "--"}
                </Text>
              </View>
            );
          })}
        </Card>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  historyCard: {
    borderRadius: theme.radius.lg,
    padding: 14,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  historyRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  historyDate: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "600",
  },
  historyTime: {
    color: palette.sub,
    fontSize: 10,
  },
  historyValues: {
    color: palette.text,
    fontSize: 12,
    textAlign: "right",
    flexShrink: 1,
    marginLeft: 10,
  },
});
