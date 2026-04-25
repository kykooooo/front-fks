// components/ui/SafetyBanner.tsx
// Bannière sécurité permanente affichée sur SessionPreview et SessionLive.
// Rappel important pour la santé du joueur + disclaimer "pas un avis médical".

import React, { useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Linking, type ViewStyle, type StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../../constants/theme";

type Props = {
  variant?: "full" | "compact";
  style?: StyleProp<ViewStyle>;
};

const MESSAGE_FULL =
  "En cas de douleur, essoufflement anormal ou vertige : arrête immédiatement. FKS n'est pas un avis médical — consulte un pro en cas de doute.";
const MESSAGE_COMPACT = "Douleur ou malaise : arrête immédiatement.";

export function SafetyBanner({ variant = "full", style }: Props) {
  const isCompact = variant === "compact";

  const callEmergency = useCallback((number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => {
      // Silencieux : si l'appareil ne peut pas ouvrir l'app Téléphone (tablette, simulateur web),
      // on ne veut pas faire crasher une bannière sécurité.
    });
  }, []);

  if (isCompact) {
    return (
      <View style={[styles.container, styles.containerCompact, style]}>
        <Ionicons name="alert-circle-outline" size={16} color={theme.colors.warn} />
        <Text style={[styles.text, styles.textCompact]}>{MESSAGE_COMPACT}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <Ionicons name="alert-circle-outline" size={18} color={theme.colors.warn} />
        <Text style={styles.text}>{MESSAGE_FULL}</Text>
      </View>
      <View style={styles.emergencyRow}>
        <Text style={styles.emergencyLabel}>Urgence :</Text>
        <Pressable
          onPress={() => callEmergency("15")}
          style={({ pressed }) => [styles.emergencyChip, pressed && styles.emergencyChipPressed]}
          accessibilityRole="button"
          accessibilityLabel="Appeler le SAMU au 15"
          hitSlop={6}
        >
          <Ionicons name="call" size={13} color={theme.colors.red} />
          <Text style={styles.emergencyChipText}>SAMU 15</Text>
        </Pressable>
        <Pressable
          onPress={() => callEmergency("112")}
          style={({ pressed }) => [styles.emergencyChip, pressed && styles.emergencyChipPressed]}
          accessibilityRole="button"
          accessibilityLabel="Appeler le numéro d'urgence européen 112"
          hitSlop={6}
        >
          <Ionicons name="call" size={13} color={theme.colors.red} />
          <Text style={styles.emergencyChipText}>Urgences 112</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    backgroundColor: theme.colors.amberSoft08,
    borderWidth: 1,
    borderColor: theme.colors.amberSoft30,
    gap: 10,
  },
  containerCompact: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  text: {
    flex: 1,
    color: theme.colors.text,
    fontSize: TYPE.caption.fontSize,
    lineHeight: 18,
  },
  textCompact: {
    flex: 1,
    fontSize: TYPE.micro.fontSize,
    lineHeight: 14,
    fontWeight: "600",
    color: theme.colors.text,
  },
  emergencyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  emergencyLabel: {
    fontSize: TYPE.caption.fontSize,
    color: theme.colors.sub,
    fontWeight: "700",
  },
  emergencyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: theme.colors.redSoft15,
    backgroundColor: theme.colors.redSoft05,
    minHeight: 32,
  },
  emergencyChipPressed: {
    backgroundColor: theme.colors.redSoft10,
    opacity: 0.85,
  },
  emergencyChipText: {
    fontSize: TYPE.caption.fontSize,
    color: theme.colors.red,
    fontWeight: "800",
  },
});
