// screens/sessionPreview/components/HeroCard.tsx
// Header de séance thémé par cycle (FRONT-2) : plus de photo Pexels.
// Bande pleine en couleur "strong" du cycle + pastille icône + kicker/titre/sous-titre.
// Accents (chips meta, barre de progression, CTA) reprennent la couleur du cycle.
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { getCycleTheme } from "../../../constants/cycleTheme";
import { formatDayFR } from "../../../utils/dateHelpers";
import { frIntensity, frFocus, frLocation } from "../../../utils/frLabels";

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
  const ct = getCycleTheme(cycleType);
  const metaChips = [
    frIntensity(intensity),
    frFocus(focusPrimary),
    frFocus(focusSecondary),
    frLocation(location),
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  const plannedDateLabel = formatDayFR(plannedDateISO) || plannedDateISO;

  return (
    <Card variant="surface" style={styles.heroCard}>
      {/* Bande pleine couleur du cycle — aucune photo / dégradé / overlay sombre */}
      <View style={[styles.headerBand, { backgroundColor: ct.strong }]}>
        <View style={styles.pill}>
          <Ionicons name={ct.icon as any} size={26} color={ct.strong} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Cycle {ct.label}</Text>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
          ) : null}
          {plannedDateLabel ? <Text style={styles.headerDate}>{plannedDateLabel}</Text> : null}
        </View>
      </View>

      {/* Contenu sous la bande */}
      <View style={styles.body}>
        {sessionTheme ? (
          <View style={styles.sessionThemeRow}>
            <Ionicons name="color-palette-outline" size={13} color={ct.textOnSoft} />
            <Text style={[styles.sessionThemeText, { color: ct.textOnSoft }]} numberOfLines={2}>{sessionTheme}</Text>
          </View>
        ) : null}

        {/* Chips meta (intensité / focus / lieu) — fond "soft", texte "textOnSoft" */}
        {metaChips.length > 0 ? (
          <View style={styles.metaChips}>
            {metaChips.map((label, i) => (
              <View key={`meta_${i}`} style={[styles.chip, { backgroundColor: ct.soft }]}>
                <Text style={[styles.chipText, { color: ct.textOnSoft }]}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}

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
            Progression : {completedItems}/{totalItems || "—"}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: ct.strong }]}
            />
          </View>
        </View>

        {canStart ? (
          // CTA primaire d'écran de séance : couleur du cycle (pas l'orange CTA).
          // Choix FRONT-2 : sur les écrans de séance, le CTA primaire prend la
          // couleur "strong" du cycle ; l'orange reste la convention CTA ailleurs (Home…).
          <TouchableOpacity
            onPress={onGoLive}
            activeOpacity={0.85}
            style={[styles.cta, { backgroundColor: ct.strong }]}
            accessibilityRole="button"
            accessibilityLabel="Passer en mode live"
          >
            <Text style={styles.ctaText}>Passer en mode live</Text>
            <Ionicons name="play" size={16} color="#fff" />
          </TouchableOpacity>
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
  headerBand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  pill: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 2 },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.78)",
  },
  title: { fontSize: 18, fontWeight: "500", color: "#fff" },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.82)" },
  headerDate: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 },
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
    fontWeight: "600",
    fontStyle: "italic",
  },
  metaChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
  },
  chipText: { fontWeight: "600", fontSize: 11 },
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
  progressWrap: { gap: 4 },
  progressLabel: { color: palette.sub, fontSize: 12 },
  progressTrack: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  progressFill: { height: "100%" },
  cta: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderRadius: theme.radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
});
