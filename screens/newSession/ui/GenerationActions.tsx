import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { palette } from "../theme";

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
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Lancer la génération</Text>
      <Text style={styles.cardSubtitle}>
        FKS tient compte de ta charge, du lieu et du matériel pour construire une séance cohérente.
      </Text>

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
          Prochaine séance autorisée à partir du {new Date(nextAllowedISO).toISOString().slice(0, 10)}
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
};
