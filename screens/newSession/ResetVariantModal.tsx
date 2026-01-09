import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { palette } from "./theme";
import type { ResetVariant } from "./types";

type Props = {
  variants: ResetVariant[];
  onSelect: (id: string) => void;
  onCancel: () => void;
};

export function ResetVariantModal({ variants, onSelect, onCancel }: Props) {
  return (
    <View style={styles.resetOverlay}>
      <View style={styles.resetModal}>
        <Text style={styles.resetTitle}>Séance Prime (reset)</Text>
        <Text style={styles.resetSubtitle}>
          Choisis la variante légère du jour (RPE 3–4 · 12–16 min · zéro fatigue)
        </Text>
        {variants.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={styles.resetCard}
            onPress={() => onSelect(v.id)}
          >
            <Text style={styles.resetCardTitle}>{v.title}</Text>
            <Text style={styles.resetCardSubtitle}>{v.subtitle}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.resetCancel} onPress={onCancel}>
          <Text style={styles.resetCancelText}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  resetOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5,5,9,0.8)",
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  resetModal: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    padding: 16,
    gap: 10,
  },
  resetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: palette.text,
  },
  resetSubtitle: {
    fontSize: 13,
    color: palette.sub,
    marginBottom: 4,
  },
  resetCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSoft,
    marginTop: 6,
  },
  resetCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
  },
  resetCardSubtitle: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 2,
  },
  resetCancel: {
    marginTop: 8,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resetCancelText: {
    color: palette.sub,
    fontSize: 13,
  },
});
