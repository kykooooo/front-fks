// components/InjuryLegalBanner.tsx
//
// Bannière légale rouge NON-DISMISSABLE affichée AU-DESSUS de tout formulaire
// de déclaration de zone sensible (inscription étape 4, InjuryForm profil...).
//
// Obligations :
//   1. Guideline Apple 1.4.1 (Medical apps)  : "remind users to check with a
//      doctor before making medical decisions".
//   2. Guideline Apple 5.1.3.i               : "disclose the specific health
//      data that you are collecting".
//   3. RGPD art. 9                           : consentement explicite.
//
// La phrase de disclaimer (GENERAL_DISCLAIMER) est sourced depuis
// shared/SAFETY_PHRASES.ts pour rester alignée front/back (/sync-check point #7).
//
// Les boutons SAMU 15 / Urgences 112 réutilisent le pattern de `SafetyBanner`
// (tel:15 / tel:112 via Linking.openURL). Le fallback silencieux est conservé
// pour les simulateurs / tablettes qui ne peuvent pas composer.

import React, { useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Linking, type ViewStyle, type StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../constants/theme";
import { SAFETY_PHRASES } from "../shared/SAFETY_PHRASES";

type Props = {
  style?: StyleProp<ViewStyle>;
};

export function InjuryLegalBanner({ style }: Props) {
  const callEmergency = useCallback((number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => {
      // Silencieux : si l'appareil ne peut pas ouvrir l'app Téléphone
      // (tablette, simulateur web), on ne veut pas faire crasher la bannière.
    });
  }, []);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.headerRow}>
        <Ionicons name="medical-outline" size={18} color={theme.colors.red} />
        <Text style={styles.text}>{SAFETY_PHRASES.GENERAL_DISCLAIMER}</Text>
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
    backgroundColor: theme.colors.redSoft05,
    borderWidth: 1,
    borderColor: theme.colors.redSoft18,
    gap: 10,
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
    fontWeight: "600",
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
    backgroundColor: theme.colors.redSoft06,
    minHeight: 32,
  },
  emergencyChipPressed: {
    backgroundColor: theme.colors.redSoft12,
    opacity: 0.85,
  },
  emergencyChipText: {
    fontSize: TYPE.caption.fontSize,
    color: theme.colors.red,
    fontWeight: "800",
  },
});
