// screens/feedback/components/PainInjuryRow.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, TYPE, RADIUS } from "../../../constants/theme";
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
          <Ionicons name="bandage-outline" size={16} color={theme.colors.red500} />
          <Text style={styles.metricTitle}>Douleurs</Text>
        </View>
        <SegmentedRow options={PAIN_SCALE} value={pain} onChange={onPainChange} scaleLabel="Douleur" />
      </View>
      <View style={styles.metricCard}>
        <View style={styles.metricIconRow}>
          <Ionicons name="medical-outline" size={16} color={theme.colors.violet500} />
          <Text style={styles.metricTitle}>Zone sensible</Text>
        </View>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleChip, !hasPainDetails && styles.toggleChipSelected]}
            onPress={() => onTogglePainDetails(false)}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityLabel="Aucune zone sensible"
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
            accessibilityLabel="Zone sensible à préciser"
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
            <Ionicons name="body-outline" size={16} color={theme.colors.violet500} />
            <Text style={styles.injuryTitle}>Détails de la zone sensible</Text>
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
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    backgroundColor: COLORS.surfaceSoft,
  },
  metricIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  metricTitle: { fontSize: TYPE.caption.fontSize, fontWeight: '600', color: COLORS.text },
  toggleRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  toggleChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleChipSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accentSoft },
  toggleText: { fontSize: TYPE.caption.fontSize, color: COLORS.textMuted, fontWeight: '500' },
  toggleTextSelected: { color: COLORS.accent },
  injuryCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    backgroundColor: COLORS.surfaceSoft,
  },
  injuryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  injuryTitle: { fontSize: TYPE.body.fontSize, fontWeight: '700', color: COLORS.text },
});
