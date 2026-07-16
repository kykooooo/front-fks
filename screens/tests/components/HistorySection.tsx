// screens/tests/components/HistorySection.tsx
// Langage commun : SectionHeader (hors Card) + Card surface + rangées sobres.
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { formatEntryTimestamp, formatEntryValue, getUnitForField, shouldHideUnitSuffix } from "../testHelpers";
import {
  PLAYLISTS, FIELD_BY_KEY, SHORT_LABELS,
  type TestEntry, type PlaylistId, type FieldKey,
} from "../testConfig";

const palette = theme.colors;

type Props = {
  entriesForPlaylist: TestEntry[];
  selectedPlaylist: PlaylistId;
  activeKeys: FieldKey[];
  cardAnim: Animated.Value;
};

export function HistorySection({ entriesForPlaylist, selectedPlaylist, activeKeys, cardAnim }: Props) {
  if (entriesForPlaylist.length === 0) return null;

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
          title="Historique récent"
          right={<Badge label={PLAYLISTS[selectedPlaylist].label} />}
        />
        <Card variant="surface" style={styles.historyCard}>
          {entriesForPlaylist.slice(0, 5).map((e, idx) => (
            <View
              key={`${e.ts}-${idx}`}
              style={[
                styles.historyRow,
                idx === Math.min(entriesForPlaylist.length, 5) - 1 && styles.historyRowLast,
              ]}
            >
              <View>
                <Text style={styles.historyDate}>
                  {formatEntryTimestamp(e.ts, "dd/MM/yyyy")}
                </Text>
                <Text style={styles.historyTime}>
                  {formatEntryTimestamp(e.ts, "HH:mm")}
                </Text>
              </View>
              <Text style={styles.historyValues}>
                {activeKeys
                  .slice(0, 3)
                  .map((key) => {
                    const val = (e as any)[key];
                    if (val === undefined || val === null || val === "") return null;
                    const unit = shouldHideUnitSuffix(key) ? "" : getUnitForField(key);
                    const label = SHORT_LABELS[key] ?? FIELD_BY_KEY[key]?.label ?? key;
                    return `${label} ${formatEntryValue(key, val)}${unit}`;
                  })
                  .filter(Boolean)
                  .join(" · ") || "--"}
              </Text>
            </View>
          ))}
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
  },
});
