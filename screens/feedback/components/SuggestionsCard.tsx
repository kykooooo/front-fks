// screens/feedback/components/SuggestionsCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import type { FeedbackSuggestion } from '../hooks/useSuggestions';

const COLORS = theme.colors;

type Props = {
  suggestion: FeedbackSuggestion;
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  onApplyRpe: () => void;
  onApplyFatigue: () => void;
  onApplyRecovery: () => void;
  onApplyPain: () => void;
  onApplyAll: () => void;
};

export function SuggestionsCard({
  suggestion, fadeAnim, slideAnim,
  onApplyRpe, onApplyFatigue, onApplyRecovery, onApplyPain, onApplyAll,
}: Props) {
  return (
    <Animated.View
      style={[styles.suggestCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      <View style={styles.suggestHeader}>
        <View style={styles.suggestTitleRow}>
          <Ionicons name="sparkles-outline" size={16} color={COLORS.accent} />
          <Text style={styles.suggestTitle}>Suggestions rapides</Text>
        </View>
        <Text style={styles.suggestSubtitle}>
          Basées sur l'intensité {suggestion.intensityLabel || 'du jour'}
        </Text>
      </View>
      <View style={styles.suggestRow}>
        <TouchableOpacity style={styles.suggestChip} onPress={onApplyRpe} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Appliquer RPE ${suggestion.rpe}`}>
          <Text style={styles.suggestChipText}>RPE {suggestion.rpe}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.suggestChip} onPress={onApplyFatigue} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Appliquer fatigue ${suggestion.fatigue}`}>
          <Text style={styles.suggestChipText}>Fatigue {suggestion.fatigue}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.suggestChip} onPress={onApplyRecovery} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Appliquer récupération ${suggestion.recovery}`}>
          <Text style={styles.suggestChipText}>Récup {suggestion.recovery}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.suggestChip} onPress={onApplyPain} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`Appliquer douleur ${suggestion.pain}`}>
          <Text style={styles.suggestChipText}>Douleur {suggestion.pain}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.suggestApply} onPress={onApplyAll} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Appliquer toutes les suggestions">
        <Ionicons name="checkmark-circle" size={16} color={COLORS.accent} />
        <Text style={styles.suggestApplyText}>Appliquer tout</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  suggestCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    backgroundColor: COLORS.surface,
    gap: 10,
  },
  suggestHeader: { gap: 4 },
  suggestTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestTitle: { color: COLORS.text, fontSize: TYPE.body.fontSize, fontWeight: '700' },
  suggestSubtitle: { color: COLORS.textMuted, fontSize: TYPE.caption.fontSize },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
  },
  suggestChipText: { color: COLORS.text, fontSize: TYPE.caption.fontSize, fontWeight: '600' },
  suggestApply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
    alignSelf: 'flex-start',
  },
  suggestApplyText: { color: COLORS.accent, fontSize: TYPE.caption.fontSize, fontWeight: '700' },
});
