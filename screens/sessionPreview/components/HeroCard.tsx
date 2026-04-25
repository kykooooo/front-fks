import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { PitchDecoration } from "../../../components/ui/PitchDecoration";
import { TrainingIllustration } from "../../../components/ui/TrainingIllustration";
import { intensityTone } from "../sessionPreviewConfig";
import { cycleToBannerKey } from "../../../constants/bannerImages";

const palette = theme.colors;

type Props = {
  title: string;
  subtitle?: string | null;
  sessionTheme?: string | null;
  playerRationaleTitle?: string | null;
  playerRationale?: string | null;
  cycleLabel?: string | null;
  cycleProgressLabel?: string | null;
  cyclePhaseLabel?: string | null;
  adaptationLabels?: string[];
  plannedDateISO: string;
  intensity?: string | null;
  focusPrimary?: string | null;
  focusSecondary?: string | null;
  location?: string | null;
  durationLabel: string;
  rpeLabel: string;
  completedItems: number;
  totalItems: number;
  progress: number;
  canStart: boolean;
  onGoLive: () => void;
  ctaLabel?: string;
  ctaDisabled?: boolean;
  cycleType?: string | null;
};

type HeroVisualTone = {
  gradient: readonly [string, string, string];
  glowColor: string;
  secondaryGlowColor: string;
  illustrationPrimary: string;
  illustrationAccent: string;
  illustrationSecondary: string;
};

export function HeroCard({
  title,
  subtitle,
  sessionTheme,
  playerRationaleTitle,
  playerRationale,
  adaptationLabels = [],
  plannedDateISO,
  intensity,
  focusPrimary,
  focusSecondary,
  location,
  durationLabel,
  rpeLabel,
  completedItems,
  totalItems,
  progress,
  canStart,
  onGoLive,
  ctaLabel,
  ctaDisabled = false,
  cycleType,
}: Props) {
  const visualTone = getHeroVisualTone(cycleToBannerKey(cycleType));

  return (
    <Card variant="surface" style={styles.heroCard}>
      <LinearGradient
        colors={visualTone.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroVisual}
      >
        <View style={styles.heroGlowWrap} pointerEvents="none">
          <View
            style={[
              styles.heroGlow,
              styles.heroGlowTop,
              { backgroundColor: visualTone.glowColor },
            ]}
          />
          <View
            style={[
              styles.heroGlow,
              styles.heroGlowBottom,
              { backgroundColor: visualTone.secondaryGlowColor },
            ]}
          />
        </View>

        <PitchDecoration
          type="centerCircle"
          width={184}
          height={184}
          color={theme.colors.white}
          opacity={0.07}
          style={styles.heroCircle}
        />
        <PitchDecoration
          type="halfwayLine"
          width={158}
          height={52}
          color={theme.colors.white}
          opacity={0.06}
          style={styles.heroHalfway}
        />
        <TrainingIllustration
          variant="session"
          width={148}
          height={148}
          primaryColor={visualTone.illustrationPrimary}
          accentColor={visualTone.illustrationAccent}
          secondaryColor={visualTone.illustrationSecondary}
          opacity={0.94}
          style={styles.heroIllustration}
        />

        <View style={styles.bannerOverlay}>
          <Text style={styles.bannerEyebrow}>{"S\u00E9ance du jour"}</Text>
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
      </LinearGradient>

      <View style={styles.body}>
        {sessionTheme ? (
          <View style={styles.sessionThemeRow}>
            <Ionicons
              name="sparkles-outline"
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
          {adaptationLabels.map((label) => (
            <Badge key={label} label={label} />
          ))}
        </View>

        {playerRationale ? (
          <View style={styles.rationaleCard}>
            <View style={styles.rationaleHeader}>
              <Ionicons
                name="sparkles-outline"
                size={13}
                color={palette.accent}
              />
              <Text style={styles.rationaleLabel}>
                {playerRationaleTitle || "Aujourd'hui, on travaille"}
              </Text>
            </View>
            <Text style={styles.rationaleText}>{playerRationale}</Text>
          </View>
        ) : null}

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>{"Dur\u00E9e"}</Text>
            <Text style={styles.heroStatValue}>{durationLabel}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>RPE cible</Text>
            <Text style={styles.heroStatValue}>{rpeLabel}</Text>
          </View>
        </View>

        <View style={styles.progressWrap}>
          <Text style={styles.progressLabel}>
            Progression: {completedItems}/{totalItems || "\u2014"}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
        </View>

        {canStart ? (
          <Button
            label={ctaLabel ?? "Commencer la seance"}
            onPress={onGoLive}
            fullWidth
            size="md"
            variant="secondary"
            style={styles.heroCta}
            disabled={ctaDisabled}
          />
        ) : null}
      </View>
    </Card>
  );
}

function getHeroVisualTone(
  key: ReturnType<typeof cycleToBannerKey>
): HeroVisualTone {
  switch (key) {
    case "force":
      return {
        gradient: [palette.ember950, palette.ink930, palette.ink900],
        glowColor: palette.accentSoft24,
        secondaryGlowColor: palette.bronzeSoft40,
        illustrationPrimary: palette.white18,
        illustrationAccent: palette.accentAlt,
        illustrationSecondary: palette.bronzeSoft40,
      };
    case "engine":
      return {
        gradient: [palette.navy950, palette.ink930, palette.ink900],
        glowColor: palette.blue500Soft15,
        secondaryGlowColor: palette.skySoft10,
        illustrationPrimary: palette.white16,
        illustrationAccent: palette.sky,
        illustrationSecondary: palette.white35,
      };
    case "explosif":
      return {
        gradient: [palette.plum900, palette.ember950, palette.ink900],
        glowColor: palette.accentSoft28,
        secondaryGlowColor: palette.redSoft18,
        illustrationPrimary: palette.white18,
        illustrationAccent: palette.accentAlt,
        illustrationSecondary: palette.redSoft18,
      };
    case "foundation":
      return {
        gradient: [palette.forest950, palette.ink930, palette.ink900],
        glowColor: palette.green500Soft15,
        secondaryGlowColor: palette.emeraldSoft15,
        illustrationPrimary: palette.white16,
        illustrationAccent: palette.emerald400,
        illustrationSecondary: palette.emeraldSoft15,
      };
    case "home":
    default:
      return {
        gradient: [palette.ink950, palette.ink930, palette.ink900],
        glowColor: palette.accentSoft15,
        secondaryGlowColor: palette.skySoft10,
        illustrationPrimary: palette.white16,
        illustrationAccent: palette.accentAlt,
        illustrationSecondary: palette.white35,
      };
  }
}

const styles = StyleSheet.create({
  heroCard: {
    padding: 0,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    ...theme.shadow.soft,
  },
  heroVisual: {
    position: "relative",
    minHeight: 188,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  heroGlowWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  heroGlow: {
    position: "absolute",
    borderRadius: RADIUS.pill,
  },
  heroGlowTop: {
    width: 164,
    height: 164,
    top: -34,
    right: -42,
  },
  heroGlowBottom: {
    width: 140,
    height: 140,
    bottom: -30,
    left: -26,
  },
  heroCircle: {
    position: "absolute",
    top: 12,
    right: -38,
  },
  heroHalfway: {
    position: "absolute",
    top: 26,
    left: 10,
  },
  heroIllustration: {
    position: "absolute",
    right: -14,
    bottom: -18,
    transform: [{ rotate: "-5deg" }],
  },
  bannerOverlay: {
    gap: 6,
  },
  bannerEyebrow: {
    color: theme.colors.white70,
    fontSize: TYPE.micro.fontSize,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  bannerTitle: {
    fontSize: TYPE.title.fontSize,
    fontWeight: "800",
    color: theme.colors.white,
    textShadowColor: theme.colors.black60,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bannerSubtitle: {
    fontSize: TYPE.caption.fontSize,
    color: theme.colors.white85,
    textShadowColor: theme.colors.black50,
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
    gap: 12,
  },
  sessionThemeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.accentSoft,
  },
  sessionThemeText: {
    fontSize: TYPE.caption.fontSize,
    color: palette.accent,
    fontWeight: "700",
  },
  heroTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rationaleCard: {
    gap: 6,
    padding: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
  },
  rationaleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rationaleLabel: {
    color: palette.accent,
    fontSize: TYPE.micro.fontSize,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rationaleText: {
    color: palette.text,
    fontSize: TYPE.caption.fontSize,
    lineHeight: 18,
    fontWeight: "600",
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    padding: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  heroStat: { flex: 1 },
  heroStatLabel: {
    color: palette.sub,
    fontSize: TYPE.micro.fontSize,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroStatValue: {
    color: palette.text,
    fontSize: TYPE.body.fontSize,
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
  progressLabel: {
    color: palette.sub,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
  },
  progressTrack: {
    height: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: palette.accent },
});
