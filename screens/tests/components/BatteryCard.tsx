// screens/tests/components/BatteryCard.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import {
  FIELD_BY_KEY, PLAYLISTS, getGroupConfig,
  type FieldKey, type PlaylistId, type TestEntry,
} from "../testConfig";

const palette = theme.colors;

type Props = {
  activeKeys: FieldKey[];
  form: Partial<TestEntry>;
  selectedPlaylist: PlaylistId;
  completedCount: number;
  totalTests: number;
  progressRatio: number;
  hasAnyInput: boolean;
  onStart: () => void;
  onReset: () => void;
  onHaptic: () => void;
  cardAnim: Animated.Value;
};

export function BatteryCard({
  activeKeys, form, selectedPlaylist,
  completedCount, totalTests, progressRatio, hasAnyInput,
  onStart, onReset, onHaptic, cardAnim,
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
      <Card variant="surface" style={styles.batteryCard}>
        <View style={styles.batteryHeader}>
          <View style={styles.batteryTitleRow}>
            <Ionicons name="list-outline" size={16} color={palette.accent} />
            <View>
              <Text style={styles.sectionTitle}>Batterie active</Text>
              <Text style={styles.sectionSub}>
                {completedCount}/{totalTests} tests renseignés
              </Text>
            </View>
          </View>
          <View style={styles.batteryBadge}>
            <Text style={styles.batteryBadgeText}>
              {PLAYLISTS[selectedPlaylist].label}
            </Text>
          </View>
        </View>
        <View style={styles.batteryProgressTrack}>
          <LinearGradient
            colors={[theme.colors.accent, theme.colors.accentAlt]}
            style={[styles.batteryProgressFill, { width: `${progressRatio * 100}%` }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>

        <View style={styles.batteryList}>
          {activeKeys.map((key, idx) => {
            const field = FIELD_BY_KEY[key];
            const val = (form as any)[key];
            const done =
              val !== undefined &&
              val !== null &&
              val !== "" &&
              Number.isFinite(Number(val));
            const cfg = getGroupConfig(field.group);
            return (
              <View key={key} style={styles.batteryRow}>
                <View
                  style={[
                    styles.batteryIndex,
                    done && { backgroundColor: cfg.tint, borderColor: cfg.tint },
                  ]}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={12} color={theme.colors.white} />
                  ) : (
                    <Text style={styles.batteryIndexText}>{idx + 1}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.batteryLabel}>{field.label}</Text>
                  <Text style={styles.batteryMeta}>{field.protocol}</Text>
                </View>
                <Text style={done ? [styles.batteryValue, { color: cfg.tint }] : styles.batteryPending}>
                  {done ? `${val}${field.unit ? ` ${field.unit}` : ""}` : "À faire"}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.batteryActions}>
          <TouchableOpacity
            style={styles.batteryStartButton}
            onPress={() => { onStart(); onHaptic(); }}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[theme.colors.accent, theme.colors.accentAlt]}
              style={styles.batteryStartGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name={hasAnyInput ? "play" : "flash"} size={18} color={theme.colors.white} />
              <Text style={styles.batteryStartText}>
                {hasAnyInput ? "Reprendre" : "Lancer la batterie"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          {hasAnyInput ? (
            <Button
              label="Recommencer"
              onPress={() => { onReset(); onHaptic(); }}
              size="sm"
              variant="ghost"
              fullWidth
            />
          ) : null}
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  batteryCard: {
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
  batteryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  batteryTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  batteryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  batteryBadgeText: {
    color: palette.sub,
    fontSize: TYPE.micro.fontSize,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  batteryProgressTrack: {
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  batteryProgressFill: {
    height: "100%",
    backgroundColor: palette.accent,
  },
  batteryList: {
    gap: 10,
  },
  batteryRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  batteryIndex: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  batteryIndexText: {
    color: palette.sub,
    fontSize: TYPE.micro.fontSize,
    fontWeight: "700",
  },
  batteryLabel: {
    color: palette.text,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
  },
  batteryMeta: {
    color: palette.sub,
    fontSize: TYPE.micro.fontSize,
    marginTop: 2,
  },
  batteryValue: {
    color: palette.text,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
  },
  batteryPending: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
  },
  batteryActions: {
    marginTop: 4,
    gap: 8,
  },
  batteryStartButton: {
    borderRadius: RADIUS.md,
    overflow: "hidden",
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  batteryStartGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  batteryStartText: {
    color: theme.colors.white,
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
  },
});
