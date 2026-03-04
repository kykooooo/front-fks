// screens/tests/components/HistorySection.tsx
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { formatEntryTimestamp, getUnitForField } from "../testHelpers";
import {
  PLAYLISTS, PLAYLIST_FIELDS, FIELD_BY_KEY, SHORT_LABELS,
  type TestEntry, type PlaylistId,
} from "../testConfig";

const palette = theme.colors;

type Props = {
  entriesForPlaylist: TestEntry[];
  selectedPlaylist: PlaylistId;
  cardAnim: Animated.Value;
};

export function HistorySection({ entriesForPlaylist, selectedPlaylist, cardAnim }: Props) {
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
      <Card variant="surface" style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Ionicons name="time-outline" size={16} color={palette.accent} />
          <View>
            <Text style={styles.sectionTitle}>Historique récent</Text>
            <Text style={styles.sectionSub}>
              {PLAYLISTS[selectedPlaylist].label}
            </Text>
          </View>
        </View>
        <View style={{ gap: 8, marginTop: 10 }}>
          {entriesForPlaylist.slice(0, 5).map((e, idx) => (
            <View key={`${e.ts}-${idx}`} style={styles.historyRow}>
              <View>
                <Text style={styles.historyDate}>
                  {formatEntryTimestamp(e.ts, "dd/MM/yyyy")}
                </Text>
                <Text style={styles.historyTime}>
                  {formatEntryTimestamp(e.ts, "HH:mm")}
                </Text>
              </View>
              <Text style={styles.historyValues}>
                {PLAYLIST_FIELDS[selectedPlaylist]
                  .slice(0, 3)
                  .map((key) => {
                    const val = (e as any)[key];
                    if (val === undefined || val === null || val === "") return null;
                    const unit = getUnitForField(key);
                    const label = SHORT_LABELS[key] ?? FIELD_BY_KEY[key]?.label ?? key;
                    return `${label} ${val}${unit ? unit : ""}`;
                  })
                  .filter(Boolean)
                  .join(" · ") || "--"}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  historyCard: {
    borderRadius: 16,
    padding: 14,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionSub: {
    color: palette.sub,
    fontSize: 12,
    marginTop: 2,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(31, 36, 48, 0.6)",
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
