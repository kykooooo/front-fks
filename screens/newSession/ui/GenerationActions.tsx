import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette } from "../theme";
import type { Advice } from "../../../domain/adviceRules";
import { toDateKey } from "../../../utils/dateHelpers";

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
  info: { bg: "rgba(37, 99, 235, 0.08)", border: "#3b82f6", text: "#2563eb", icon: "#3b82f6" },
  warn: { bg: "rgba(245, 158, 11, 0.10)", border: "#f59e0b", text: "#d97706", icon: "#f59e0b" },
  danger: { bg: "rgba(239, 68, 68, 0.10)", border: "#ef4444", text: "#dc2626", icon: "#ef4444" },
  success: { bg: "rgba(22, 163, 74, 0.08)", border: "#22c55e", text: "#16a34a", icon: "#22c55e" },
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
    borderRadius: 18,
    backgroundColor: palette.card,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: 13,
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
    borderRadius: 12,
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
    fontSize: 13,
  },
  ctaSecondaryGreen: {
    backgroundColor: palette.cardSoft,
    borderColor: palette.borderSoft,
  },
  ctaSecondaryGreenText: {
    color: palette.text,
    fontWeight: "700" as const,
    fontSize: 12,
  },
  ctaSecondaryOrange: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accent,
  },
  ctaSecondaryOrangeText: {
    color: palette.accent,
    fontWeight: "700" as const,
    fontSize: 12,
  },
  helper: {
    marginTop: 8,
    fontSize: 12,
    color: palette.sub,
  },
  adviceBanner: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 10,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
  },
  adviceIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  adviceTextWrap: {
    flex: 1,
    gap: 2,
  },
  adviceTitle: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  adviceMessage: {
    fontSize: 12,
    color: palette.sub,
    lineHeight: 16,
  },
};
