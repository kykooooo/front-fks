// screens/sessionPreview/components/HeroCard.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { intensityTone } from "../sessionPreviewConfig";
import { ImageBanner } from "../../../components/ui/ImageBanner";
import {
  BANNER_IMAGES,
  BANNER_FALLBACK,
  cycleToBannerKey,
} from "../../../constants/bannerImages";

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
  cycleType?: string | null;
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
  cycleType,
}: Props) {
  const bannerKey = cycleToBannerKey(cycleType);

  return (
    <Card variant="surface" style={styles.heroCard}>
      {/* Bandeau image pleine largeur */}
      <ImageBanner
        source={BANNER_IMAGES[bannerKey]}
        height={180}
        fallbackColor={BANNER_FALLBACK[bannerKey]}
        borderRadius={20}
      >
        <View style={styles.bannerOverlay}>
          <Text style={styles.bannerTitle} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.bannerSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
          <View style={styles.bannerBadges}>
            <Badge label={plannedDateISO} />
            {intensity ? (
              <Badge label={intensity} tone={intensityTone(intensity)} />
            ) : null}
          </View>
        </View>
      </ImageBanner>

      {/* Contenu sous le bandeau */}
      <View style={styles.body}>
        {sessionTheme ? (
          <View style={styles.sessionThemeRow}>
            <Ionicons
              name="color-palette-outline"
              size={13}
              color={palette.accent}
            />
            <Text style={styles.sessionThemeText}>{sessionTheme}</Text>
          </View>
        ) : null}

        <View style={styles.heroTags}>
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
            Progression : {completedItems}/{totalItems || "\u2014"}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
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
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 0,
    borderRadius: 20,
    overflow: "hidden",
  },
  bannerOverlay: {
    gap: 6,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bannerBadges: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  body: {
    padding: 14,
    gap: 10,
  },
  sessionThemeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  sessionThemeText: {
    fontSize: 12,
    color: palette.accent,
    fontWeight: "600",
    fontStyle: "italic",
  },
  heroTags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  heroStats: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  heroStat: { flex: 1 },
  heroStatLabel: {
    color: palette.sub,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroStatValue: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: palette.borderSoft,
    marginHorizontal: 12,
  },
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
