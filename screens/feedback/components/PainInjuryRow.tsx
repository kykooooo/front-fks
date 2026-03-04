// screens/feedback/components/PainInjuryRow.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../constants/theme';
import { PAIN_SCALE } from '../feedbackScales';
import { SegmentedRow } from './SegmentedRow';
import InjuryForm from '../../../components/InjuryForm';
import type { InjuryRecord } from '../../../domain/types';

const COLORS = theme.colors;

type Props = {
  pain: number;
  hasPainDetails: boolean;
  injury: InjuryRecord | null;
  onPainChange: (v: number) => void;
  onTogglePainDetails: (v: boolean) => void;
  onInjuryChange: (v: InjuryRecord | null) => void;
  injuryCardAnim: Animated.Value;
};

export function PainInjuryRow({
  pain, hasPainDetails, injury,
  onPainChange, onTogglePainDetails, onInjuryChange, injuryCardAnim,
}: Props) {
  return (
    <>
      <View style={styles.metricCard}>
        <View style={styles.metricIconRow}>
          <Ionicons name="bandage-outline" size={16} color="#ef4444" />
          <Text style={styles.metricTitle}>Douleurs</Text>
        </View>
        <SegmentedRow options={PAIN_SCALE} value={pain} onChange={onPainChange} scaleLabel="Douleur" />
      </View>
      <View style={styles.metricCard}>
        <View style={styles.metricIconRow}>
          <Ionicons name="medical-outline" size={16} color="#8b5cf6" />
          <Text style={styles.metricTitle}>Blessure</Text>
        </View>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleChip, !hasPainDetails && styles.toggleChipSelected]}
            onPress={() => onTogglePainDetails(false)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityLabel="Aucune blessure"
            accessibilityState={{ selected: !hasPainDetails }}
          >
            <Text style={[styles.toggleText, !hasPainDetails && styles.toggleTextSelected]}>
              Aucune
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleChip, hasPainDetails && styles.toggleChipSelected]}
            onPress={() => onTogglePainDetails(true)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityLabel="Blessure à préciser"
            accessibilityState={{ selected: hasPainDetails }}
          >
            <Text style={[styles.toggleText, hasPainDetails && styles.toggleTextSelected]}>
              À préciser
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {hasPainDetails && (
        <Animated.View
          style={[
            styles.injuryCard,
            {
              opacity: injuryCardAnim,
              transform: [{
                translateY: injuryCardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              }],
            },
          ]}
        >
          <View style={styles.injuryHeader}>
            <Ionicons name="body-outline" size={16} color="#8b5cf6" />
            <Text style={styles.injuryTitle}>Détails de la blessure</Text>
          </View>
          <InjuryForm value={injury} onChange={onInjuryChange} />
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  metricCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    backgroundColor: COLORS.surfaceSoft,
  },
  metricIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  metricTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  toggleRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  toggleChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleChipSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accentSoft },
  toggleText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  toggleTextSelected: { color: COLORS.accent },
  injuryCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    backgroundColor: COLORS.surfaceSoft,
  },
  injuryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  injuryTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
});
