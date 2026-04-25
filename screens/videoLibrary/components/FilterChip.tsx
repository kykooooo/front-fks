// screens/videoLibrary/components/FilterChip.tsx
import React from "react";
import { Text, StyleSheet, TouchableOpacity } from "react-native";
import { theme, TYPE, RADIUS } from "../../../constants/theme";

const palette = theme.colors;

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function FilterChip({ label, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.chip, selected && styles.chipActive]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  chipActive: { backgroundColor: palette.accentSoft, borderColor: palette.accent },
  chipText: { fontSize: TYPE.caption.fontSize, color: palette.sub, fontWeight: "600" },
  chipTextActive: { color: palette.accent },
});
