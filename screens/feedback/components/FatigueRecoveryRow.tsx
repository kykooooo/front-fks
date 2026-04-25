// screens/feedback/components/FatigueRecoveryRow.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { FATIGUE_SCALE, RECOVERY_SCALE } from '../feedbackScales';
import { SegmentedRow } from './SegmentedRow';

const COLORS = theme.colors;

type Props = {
  fatigue: number;
  recovery: number;
  onFatigueChange: (v: number) => void;
  onRecoveryChange: (v: number) => void;
};

export function FatigueRecoveryRow({ fatigue, recovery, onFatigueChange, onRecoveryChange }: Props) {
  return (
    <>
      <View style={styles.metricCard}>
        <View style={styles.metricIconRow}>
          <Ionicons name="battery-half-outline" size={16} color={theme.colors.amber500} />
          <Text style={styles.metricTitle}>Fatigue</Text>
        </View>
        <SegmentedRow options={FATIGUE_SCALE} value={fatigue} onChange={onFatigueChange} scaleLabel="Fatigue" />
      </View>
      <View style={styles.metricCard}>
        <View style={styles.metricIconRow}>
          <Ionicons name="bed-outline" size={16} color={theme.colors.cyan500} />
          <Text style={styles.metricTitle}>Récupération</Text>
        </View>
        <SegmentedRow options={RECOVERY_SCALE} value={recovery} onChange={onRecoveryChange} scaleLabel="Récupération" />
      </View>
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
});
