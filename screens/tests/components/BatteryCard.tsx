// screens/tests/components/BatteryCard.tsx
// Langage BlockCard : itemRows (nom + protocole en note + statut en Badge),
// barre de progression sobre, CTA via Button du design system.
import React from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import {
  FIELD_BY_KEY, PLAYLISTS, PLAYLIST_PLAN, getGroupConfig,
  type FieldKey, type PlaylistId, type TestEntry,
} from "../testConfig";
import { formatEntryValue, shouldHideUnitSuffix } from "../testHelpers";

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
          <Badge label={PLAYLISTS[selectedPlaylist].label} />
        </View>
        <View style={styles.batteryProgressTrack}>
          <View
            style={[
              styles.batteryProgressFill,
              { width: `${progressRatio * 100}%`, backgroundColor: palette.accent },
            ]}
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
            const statusLabel = done
              ? `${formatEntryValue(key, val)}${
                  field.unit && !shouldHideUnitSuffix(key) ? ` ${field.unit}` : ""
                }`
              : "À faire";
            return (
              <View key={key} style={styles.itemRow}>
                <View
                  style={[
                    styles.itemIndex,
                    done && { backgroundColor: cfg.tintSoft, borderColor: cfg.tint },
                  ]}
                >
                  {done ? (
                    <Ionicons name="checkmark" size={13} color={cfg.tint} />
                  ) : (
                    <Text style={styles.itemIndexText}>{idx + 1}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{field.label}</Text>
                  <Text style={styles.itemNote} numberOfLines={2}>
                    {field.protocol}
                  </Text>
                </View>
                <Badge label={statusLabel} tone={done ? "ok" : "default"} />
              </View>
            );
          })}
        </View>

        <View style={styles.batteryActions}>
          <Button
            label={hasAnyInput ? "Reprendre" : "Lancer la batterie"}
            onPress={() => { onStart(); onHaptic(); }}
            size="lg"
            variant="primary"
            fullWidth
            leftAccessory={
              <Ionicons name={hasAnyInput ? "play" : "flash"} size={16} color="#fff" />
            }
          />
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

        {/* Déroulé conseillé — repris de l'ex-TestPlanCard : reste utile pour
            l'échauffement et les temps de repos entre blocs (pas redondant avec
            le protocole par test ci-dessus, qui ne couvre que l'essai lui-même). */}
        <View style={styles.planBox}>
          <View style={styles.planHeader}>
            <Ionicons name="footsteps-outline" size={12} color={palette.accent} />
            <Text style={styles.planKicker}>Déroulé conseillé</Text>
          </View>
          <View style={styles.planList}>
            {PLAYLIST_PLAN[selectedPlaylist].map((step) => (
              <Text key={step} style={styles.planText}>
                {'•'} {step}
              </Text>
            ))}
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  batteryCard: {
    borderRadius: theme.radius.lg,
    padding: 14,
    gap: 12,
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
  batteryProgressTrack: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  batteryProgressFill: {
    height: "100%",
    borderRadius: theme.radius.pill,
  },
  batteryList: {
    gap: 10,
  },
  // itemRow — même motif que BlockCard (checkbox/index + nom + note + statut).
  itemRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  itemIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  itemIndexText: {
    color: palette.sub,
    fontSize: 11,
    fontWeight: "700",
  },
  itemName: { color: palette.text, fontSize: 14, fontWeight: "600" },
  itemNote: { color: palette.sub, fontSize: 12, marginTop: 2, lineHeight: 16 },
  batteryActions: {
    marginTop: 4,
    gap: 8,
  },
  // Bandeau "Déroulé conseillé" — style coachTipBox (fond soft + barre gauche).
  planBox: {
    gap: 6,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
    backgroundColor: palette.accentSoft,
    borderTopRightRadius: theme.radius.sm,
    borderBottomRightRadius: theme.radius.sm,
  },
  planHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  planKicker: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: palette.accent,
  },
  planList: { gap: 3 },
  planText: { fontSize: 12, lineHeight: 16, color: palette.text },
});
