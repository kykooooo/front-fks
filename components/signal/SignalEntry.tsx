// components/signal/SignalEntry.tsx
//
// Point d'entrée Signal FKS depuis la séance. Entièrement gardé :
//   - flag OFF                    → rien (comportement V1 strictement inchangé)
//   - exercice non compatible     → rien
//   - signalConfig absent/invalide → rien
//   - assets vocaux absents       → indication passive claire (aucun lancement)
//   - tout OK                     → bouton fonctionnel + overlay SignalController

import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/theme";
import { FKS_SIGNAL_V1_ENABLED } from "../../config/features";
import {
  isSignalCompatibleExercise,
  resolveSignalEngineConfig,
  validateSignalConfig,
  type SignalConfigInput,
} from "../../engine/signal/signalConfig";
import { areSignalAssetsAvailable } from "../../services/signalAudio";
import { SignalController } from "./SignalController";

const palette = theme.colors;

type Props = {
  exerciseId: string | null | undefined;
  signalConfig: SignalConfigInput;
  catalogVersion?: string | null;
  repetitions?: number | null;
};

export function SignalEntry({ exerciseId, signalConfig, catalogVersion, repetitions }: Props) {
  const [open, setOpen] = useState(false);

  // Flag OFF ⇒ aucun rendu (V1 strictement préservée).
  if (!FKS_SIGNAL_V1_ENABLED) return null;
  if (!exerciseId || !isSignalCompatibleExercise(exerciseId)) return null;

  const validation = validateSignalConfig(signalConfig);
  if (!validation.ok) return null;

  const assetsAvailable = areSignalAssetsAvailable(validation.cues);
  const engineConfig = resolveSignalEngineConfig(validation, {
    repetitions: repetitions ?? undefined,
  });

  if (!assetsAvailable) {
    return (
      <View style={styles.chipDisabled}>
        <Ionicons name="mic-off-outline" size={14} color={palette.muted} />
        <Text style={styles.chipDisabledText}>
          Signal FKS bientôt disponible (consignes vocales à venir)
        </Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        style={styles.chip}
        accessibilityRole="button"
        accessibilityLabel="Lancer Signal FKS"
      >
        <Ionicons name="radio-outline" size={14} color={palette.accent} />
        <Text style={styles.chipText}>Lancer Signal FKS</Text>
      </TouchableOpacity>
      <SignalController
        visible={open}
        onClose={() => setOpen(false)}
        engineConfig={engineConfig}
        exerciseId={exerciseId}
        catalogVersion={catalogVersion}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  chipText: { fontSize: 12, fontWeight: "800", color: palette.accent },
  chipDisabled: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  chipDisabledText: { fontSize: 11, fontWeight: "700", color: palette.muted },
});
