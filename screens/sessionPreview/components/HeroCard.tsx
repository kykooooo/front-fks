// screens/sessionPreview/components/HeroCard.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { intensityTone } from "../sessionPreviewConfig";

const palette = theme.colors;

type Props = {
  title: string;
  subtitle?: string | null;
  sessionTheme?: string | null;
  plannedDateISO: string;
  intensity?: string | null;
  focusPrimary?: string | null;
  focusSecondary?: string | null;
  location?: string | null;
  durationLabel: string;
  srpeLabel: string;
  rpeLabel: string;
  completedItems: number;
  totalItems: number;
  progress: number;
  canStart: boolean;
  onGoLive: () => void;
};

export function HeroCard({
  title,
  subtitle,
  sessionTheme,
  plannedDateISO,
  intensity,
  focusPrimary,
  focusSecondary,
  location,
  durationLabel,
  srpeLabel,
  rpeLabel,
  completedItems,
  totalItems,
  progress,
  canStart,
  onGoLive,
}: Props) {
  return (
    <Card variant="surface" style={styles.heroCard}>
      <View style={styles.heroGlow} />
      <View style={styles.heroTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={3}>{subtitle}</Text> : null}
          {sessionTheme ? (
            <View style={styles.sessionThemeRow}>
              <Ionicons name="color-palette-outline" size={13} color={palette.accent} />
              <Text style={styles.sessionThemeText}>{sessionTheme}</Text>
            </View>
          ) : null}
        </View>
        <Badge label={plannedDateISO} />
      </View>

      <View style={styles.heroTags}>
        {intensity ? <Badge label={intensity} tone={intensityTone(intensity)} /> : null}
        {focusPrimary ? <Badge label={focusPrimary} /> : null}
        {focusSecondary ? <Badge label={focusSecondary} /> : null}
        {location ? <Badge label={location} /> : null}
      </View>

      <View style={styles.heroStats}>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatLabel}>Durée</Text>
          <Text style={styles.heroStatValue}>{durationLabel}</Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStat}>
          <Text style={styles.heroStatLabel}>Charge</Text>
          <Text style={styles.heroStatValue}>{srpeLabel}</Text>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStat}>
          <Text style={styles.heroStatLabel}>RPE cible</Text>
          <Text style={styles.heroStatValue}>{rpeLabel}</Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        <Text style={styles.progressLabel}>
          Progression : {completedItems}/{totalItems || '\u2014'}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>

      {canStart ? (
        <Button
          label="Passer en mode live"
          onPress={onGoLive}
          fullWidth
          size="md"
          variant="secondary"
          style={styles.heroCta}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  heroCard: { padding: 14, gap: 10, borderRadius: 20, overflow: "hidden" },
  heroGlow: {
    position: "absolute",
    top: -90,
    right: -130,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: palette.accentSoft,
    opacity: 0.85,
  },
  heroTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  title: { fontSize: 22, fontWeight: "800", color: palette.text },
  subtitle: { fontSize: 13, color: palette.sub, marginTop: 4 },
  sessionThemeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  sessionThemeText: { fontSize: 12, color: palette.accent, fontWeight: "600", fontStyle: "italic" },
  heroTags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heroStats: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  heroStat: { flex: 1 },
  heroStatLabel: { color: palette.sub, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 },
  heroStatValue: { color: palette.text, fontSize: 16, fontWeight: "700", marginTop: 2 },
  heroDivider: { width: 1, height: 36, backgroundColor: palette.borderSoft, marginHorizontal: 12 },
  heroCta: { marginTop: 4 },
  progressWrap: { gap: 4 },
  progressLabel: { color: palette.sub, fontSize: 12 },
  progressTrack: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: palette.accent },
});
