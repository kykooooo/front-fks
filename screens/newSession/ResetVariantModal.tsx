import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { palette } from "./theme";
import type { ResetVariant } from "./types";
import type { ResetExplain } from "./resetExplain";

type Props = {
  variants: ResetVariant[];
  onSelect: (id: string) => void;
  onCancel: () => void;
  explain?: ResetExplain | null;
};

export function ResetVariantModal({ variants, onSelect, onCancel, explain }: Props) {
  return (
    <View style={styles.resetOverlay}>
      <View style={styles.resetModal}>
        <ScrollView
          contentContainerStyle={styles.resetContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.resetTitle}>Séance Prime (reset)</Text>
          <Text style={styles.resetSubtitle}>
            Choisis la variante légère du jour (RPE 3–4 · 12–16 min · zéro fatigue)
          </Text>

          {explain ? (
            <View style={styles.explainBlock}>
              <Text style={styles.explainTitle}>{explain.title}</Text>
              <Text style={styles.explainSubtitle}>{explain.subtitle}</Text>
              <View style={styles.explainGroup}>
                {explain.reasons.map((reason, index) => (
                  <View key={`${reason}-${index}`} style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>{reason}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.explainLabel}>Exemples concrets</Text>
              <View style={styles.explainGroup}>
                {explain.examples.map((example, index) => (
                  <View key={`${example}-${index}`} style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>{example}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

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
        </ScrollView>
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
    maxHeight: "88%",
  },
  resetContent: {
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
  explainBlock: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSoft,
    gap: 8,
  },
  explainTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "800",
  },
  explainSubtitle: {
    color: palette.sub,
    fontSize: 12,
  },
  explainLabel: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
  },
  explainGroup: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  bullet: {
    color: palette.accent,
    fontSize: 12,
    marginTop: 1,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    color: palette.text,
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
