import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "../theme";
import type { Advice } from "../../../domain/adviceRules";
import { toDateKey } from "../../../utils/dateHelpers";
import { theme, TYPE, RADIUS } from "../../../constants/theme";


type Props = {
  disabled: boolean;
  generating: boolean;
  label: string;
  onGenerate: () => void;
  onAdvanceDay: () => void;
  onRestTwoDays: () => void;
  storeHydrated: boolean;
  nextAllowedISO?: string | null;
  alreadyAppliedToday: boolean;
  advice?: Advice | null;
};

const TONE_CONFIG: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  info: { bg: theme.colors.blueSoft08, border: theme.colors.blue500, text: theme.colors.blue600, icon: theme.colors.blue500 },
  warn: { bg: theme.colors.amberSoft10, border: theme.colors.amber500, text: theme.colors.orange600, icon: theme.colors.amber500 },
  danger: { bg: theme.colors.redSoft10, border: theme.colors.red500, text: theme.colors.red600, icon: theme.colors.red500 },
  success: { bg: theme.colors.greenSoft08, border: theme.colors.green500, text: theme.colors.green600, icon: theme.colors.green500 },
};

export function GenerationActions({
  disabled,
  generating,
  label,
  onGenerate,
  onAdvanceDay,
  onRestTwoDays,
  storeHydrated,
  nextAllowedISO,
  alreadyAppliedToday,
  advice,
}: Props) {
  const toneConfig = advice ? TONE_CONFIG[advice.tone] ?? TONE_CONFIG.info : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Lancer la génération</Text>
      <Text style={styles.cardSubtitle}>
        FKS tient compte de ta forme, du lieu et du matériel pour construire ta séance.
      </Text>

      {/* Conseil contextuel avant génération */}
      {advice && toneConfig && (
        <View
          style={[
            styles.adviceBanner,
            { backgroundColor: toneConfig.bg, borderLeftColor: toneConfig.border },
          ]}
        >
          <View style={[styles.adviceIconWrap, { backgroundColor: toneConfig.bg }]}>
            <Ionicons name={advice.icon as any} size={18} color={toneConfig.icon} />
          </View>
          <View style={styles.adviceTextWrap}>
            <Text style={[styles.adviceTitle, { color: toneConfig.text }]}>{advice.title}</Text>
            <Text style={styles.adviceMessage}>{advice.message}</Text>
          </View>
        </View>
      )}

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.cta, styles.ctaPrimary, disabled && { opacity: 0.5 }]}
          onPress={onGenerate}
          disabled={disabled}
        >
          {generating ? (
            <ActivityIndicator color={palette.bg} />
          ) : (
            <Text style={styles.ctaPrimaryText}>{label}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.buttonRow, { marginTop: 10 }]}>
        <TouchableOpacity style={[styles.cta, styles.ctaSecondaryGreen]} onPress={onAdvanceDay}>
          <Text style={styles.ctaSecondaryGreenText}>Jour OFF (+1j)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.cta, styles.ctaSecondaryOrange]} onPress={onRestTwoDays}>
          <Text style={styles.ctaSecondaryOrangeText}>Repos 2 jours</Text>
        </TouchableOpacity>
      </View>

      {!storeHydrated ? (
        <Text style={styles.helper}>Chargement de ton historique...</Text>
      ) : nextAllowedISO ? (
        <Text style={styles.helper}>
          Prochaine séance autorisée à partir du {toDateKey(nextAllowedISO)}
        </Text>
      ) : null}

      {alreadyAppliedToday ? (
        <Text style={[styles.helper, { marginTop: 4 }]}>
          Info : tu as déjà validé une séance aujourd’hui — la prochaine sera planifiée pour demain.
        </Text>
      ) : null}
    </View>
  );
}

const styles = {
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: RADIUS.lg,
    backgroundColor: palette.card,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700" as const,
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: TYPE.caption.fontSize,
    marginTop: 4,
    color: palette.sub,
  },
  buttonRow: {
    flexDirection: "row" as const,
    gap: 10,
    marginTop: 14,
  },
  cta: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  ctaPrimary: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  ctaPrimaryText: {
    color: palette.bg,
    fontWeight: "800" as const,
    textTransform: "uppercase" as const,
    fontSize: TYPE.caption.fontSize,
  },
  ctaSecondaryGreen: {
    backgroundColor: palette.cardSoft,
    borderColor: palette.borderSoft,
  },
  ctaSecondaryGreenText: {
    color: palette.text,
    fontWeight: "700" as const,
    fontSize: TYPE.caption.fontSize,
  },
  ctaSecondaryOrange: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accent,
  },
  ctaSecondaryOrangeText: {
    color: palette.accent,
    fontWeight: "700" as const,
    fontSize: TYPE.caption.fontSize,
  },
  helper: {
    marginTop: 8,
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
  },
  adviceBanner: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: RADIUS.md,
    borderLeftWidth: 3,
  },
  adviceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  adviceTextWrap: {
    flex: 1,
    gap: 2,
  },
  adviceTitle: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700" as const,
  },
  adviceMessage: {
    fontSize: TYPE.caption.fontSize,
    color: palette.sub,
    lineHeight: 16,
  },
};
