// screens/newSession/ui/GenerationActions.tsx
//
// Pied collant de création de séance (SPEC_DA_ACCUEIL_SEANCE.md §3.7) : ligne
// récapitulative (helper pur `resumerContexte`), UN bouton principal, sous-
// texte, et l'outil d'horloge dev. Le conseil contextuel (`advice`) est SORTI
// d'ici : l'écran le rend maintenant dans le ScrollView (DaNotice).
import React from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { da, PLAFOND_TEXTE } from "../../../constants/daJoueur";
import { DaPrimaryButton } from "../../../components/ui/da/DaPrimaryButton";
import { resumerContexte, type LibellesEquipement } from "../resumeContexte";
import type { EnvironmentSelection } from "../types";

type Props = {
  disabled: boolean;
  generating: boolean;
  environment: EnvironmentSelection;
  selectedEquipment: string[];
  libelles: LibellesEquipement;
  onGenerate: () => void;
  onAdvanceDay: () => void;
  storeHydrated: boolean;
  alreadyAppliedToday: boolean;
};

export function GenerationActions({
  disabled,
  generating,
  environment,
  selectedEquipment,
  libelles,
  onGenerate,
  onAdvanceDay,
  storeHydrated,
  alreadyAppliedToday,
}: Props) {
  const resume = resumerContexte({ environment, selectedEquipment, libelles });

  // Petit écran (320×568 mesuré) : le pied mangeait ~1/3 de l'écran. La
  // légende décorative disparaît sous 700 de haut ; la note
  // "déjà validé aujourd'hui" reste — c'est une information, pas une déco.
  const { height } = useWindowDimensions();
  const ecranBas = height < 700;

  const label = !storeHydrated
    ? "Chargement de ton historique…"
    : alreadyAppliedToday
    ? "Créer ma séance pour demain"
    : "Créer ma séance";

  // Un double-tap accidentel sur "Jour OFF" avancerait le calendrier de 2 jours en silence.
  const lastPressRef = React.useRef(0);
  const guardedPress = (action: () => void) => {
    const now = Date.now();
    if (now - lastPressRef.current < 600) return;
    lastPressRef.current = now;
    action();
  };

  return (
    <View style={styles.pied}>
      <View style={styles.recap}>
        <Ionicons name="location-outline" size={16} color={da.colors.sub} />
        <Text
          style={styles.recapTexte}
          maxFontSizeMultiplier={PLAFOND_TEXTE}
          numberOfLines={2}
        >
          {resume}
        </Text>
      </View>

      <DaPrimaryButton
        label={label}
        onPress={onGenerate}
        disabled={disabled}
        loading={generating}
        accessibilityHint="Lance la génération de ta séance"
      />

      {alreadyAppliedToday ? (
        <Text style={styles.sousTexte} maxFontSizeMultiplier={PLAFOND_TEXTE}>
          Tu as déjà validé une séance aujourd’hui — la prochaine sera planifiée pour demain.
        </Text>
      ) : !ecranBas ? (
        <Text style={styles.sousTexte} maxFontSizeMultiplier={PLAFOND_TEXTE}>
          Ta séance sera adaptée à tes choix.
        </Text>
      ) : null}

      {/* « Jour OFF (+1j) » = outil d'HORLOGE DEV (avance lastLoadDayKey et
          décaye ATL/CTL sans retour visuel). Gaté __DEV__ (P1-10 inventaire
          clubs) : dans le binaire des clubs, il corrompait la charge de la
          session en cours en silence. */}
      {__DEV__ ? (
        <Pressable
          onPress={() => guardedPress(onAdvanceDay)}
          disabled={generating}
          accessibilityRole="button"
          style={styles.devButton}
        >
          <Text style={styles.devButtonText} maxFontSizeMultiplier={PLAFOND_TEXTE}>
            Jour OFF (+1j)
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pied: {
    gap: da.spacing.xs,
  },
  recap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  recapTexte: {
    flex: 1,
    ...da.typography.secondary,
    color: da.colors.sub,
  },
  sousTexte: {
    ...da.typography.secondary,
    color: da.colors.sub,
    textAlign: "center",
  },
  devButton: {
    alignSelf: "center",
    minHeight: 32,
    paddingHorizontal: da.spacing.sm,
    justifyContent: "center",
  },
  devButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: da.colors.sub,
  },
});
