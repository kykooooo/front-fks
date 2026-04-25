// screens/tests/components/PlaylistSelector.tsx
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { PLAYLISTS, type PlaylistId } from "../testConfig";

const palette = theme.colors;

type Props = {
  selectedPlaylist: PlaylistId;
  activeKeysCount: number;
  onSelect: (id: PlaylistId) => void;
  onHaptic: () => void;
  cardAnim: Animated.Value;
};

export function PlaylistSelector({
  selectedPlaylist, activeKeysCount, onSelect, onHaptic, cardAnim,
}: Props) {
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
      <Card variant="soft" style={styles.playlistCard}>
        <View style={styles.playlistHeader}>
          <View style={styles.playlistTitleRow}>
            <Ionicons name="layers-outline" size={16} color={palette.accent} />
            <View>
              <Text style={styles.sectionTitle}>
                {PLAYLISTS[selectedPlaylist].label}
              </Text>
              <Text style={styles.sectionSub}>
                {PLAYLISTS[selectedPlaylist].subtitle}
              </Text>
            </View>
          </View>
          <View style={styles.playlistBadge}>
            <Text style={styles.playlistBadgeText}>{activeKeysCount} tests</Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.playlistRow}
        >
          {(Object.keys(PLAYLISTS) as PlaylistId[]).map((id) => {
            const active = id === selectedPlaylist;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.playlistChip, active && styles.playlistChipActive]}
                onPress={() => {
                  onSelect(id);
                  onHaptic();
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.playlistChipText,
                    active && styles.playlistChipTextActive,
                  ]}
                >
                  {PLAYLISTS[id].label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  playlistCard: {
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 10,
  },
  playlistHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  playlistTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
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
  playlistBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  playlistBadgeText: {
    color: palette.sub,
    fontSize: TYPE.micro.fontSize,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  playlistRow: {
    gap: 8,
    paddingVertical: 4,
  },
  playlistChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  playlistChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  playlistChipText: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
  },
  playlistChipTextActive: {
    color: palette.accent,
  },
});
