// screens/videoLibrary/components/FiltersPanel.tsx
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { FilterChip } from "./FilterChip";
import {
  INTENSITY_LABELS,
  TAG_LABELS,
  TAG_ORDER,
  EQUIPMENT_LABELS,
  EQUIPMENT_ORDER,
  SORT_LABELS,
  type SortMode,
  type EquipmentKey,
} from "../videoLibraryConfig";
import type { BankIntensity, ExerciseTag } from "../../../engine/exerciseBank";

const palette = theme.colors;

type Props = {
  selectedIntensity: BankIntensity | null;
  onIntensityChange: (intensity: BankIntensity | null) => void;
  selectedTags: ExerciseTag[];
  onToggleTag: (tag: ExerciseTag) => void;
  selectedEquipment: EquipmentKey[];
  onToggleEquipment: (eq: EquipmentKey) => void;
  videoOnly: boolean;
  onVideoOnlyChange: (v: boolean) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  activeFilters: number;
  onReset: () => void;
};

export function FiltersPanel({
  selectedIntensity,
  onIntensityChange,
  selectedTags,
  onToggleTag,
  selectedEquipment,
  onToggleEquipment,
  videoOnly,
  onVideoOnlyChange,
  sortMode,
  onSortModeChange,
  activeFilters,
  onReset,
}: Props) {
  return (
    <Card variant="soft" style={styles.filtersCard}>
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Intensité</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(Object.keys(INTENSITY_LABELS) as BankIntensity[]).map((intensity) => (
            <FilterChip
              key={intensity}
              label={INTENSITY_LABELS[intensity]}
              selected={selectedIntensity === intensity}
              onPress={() => onIntensityChange(selectedIntensity === intensity ? null : intensity)}
            />
          ))}
        </ScrollView>
      </View>
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Tags</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {TAG_ORDER.map((tag) => (
            <FilterChip
              key={tag}
              label={TAG_LABELS[tag]}
              selected={selectedTags.includes(tag)}
              onPress={() => onToggleTag(tag)}
            />
          ))}
        </ScrollView>
      </View>
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Matériel</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {EQUIPMENT_ORDER.map((equipment) => (
            <FilterChip
              key={equipment}
              label={EQUIPMENT_LABELS[equipment]}
              selected={selectedEquipment.includes(equipment)}
              onPress={() => onToggleEquipment(equipment)}
            />
          ))}
        </ScrollView>
      </View>
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Vidéo</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <FilterChip label="Vidéos validées" selected={videoOnly} onPress={() => onVideoOnlyChange(!videoOnly)} />
        </ScrollView>
      </View>
      <View style={styles.filterGroup}>
        <Text style={styles.filterLabel}>Tri</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(["favorites", "alpha", "recent"] as SortMode[]).map((mode) => (
            <FilterChip
              key={mode}
              label={SORT_LABELS[mode]}
              selected={sortMode === mode}
              onPress={() => onSortModeChange(mode)}
            />
          ))}
        </ScrollView>
      </View>
      {activeFilters > 0 ? (
        <View style={styles.filtersFooter}>
          <TouchableOpacity onPress={onReset} activeOpacity={0.85} style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Réinitialiser</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  filtersCard: { padding: 12, gap: 12 },
  filterGroup: { gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: "700", color: palette.text },
  filterRow: { gap: 8 },
  filtersFooter: { flexDirection: "row", justifyContent: "flex-end" },
  resetButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  resetButtonText: { fontSize: 11, fontWeight: "600", color: palette.sub },
});
