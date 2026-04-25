// screens/feedback/components/MetricsRow.tsx
import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme, TYPE, RADIUS } from "../../../constants/theme";

const COLORS = theme.colors;

type Props = {
  durationMin: string;
  durationValid: boolean;
  estimatedLoad: number | null;
  tsb: number;
  projectedTsb: number | null;
  projectedDelta: number | null;
  onDurationChange: (v: string) => void;
};

export function MetricsRow({
  durationMin, durationValid, estimatedLoad, tsb,
  projectedTsb, projectedDelta, onDurationChange,
}: Props) {
  return (
    <>
      <View style={styles.metricCard}>
        <View style={styles.metricIconRow}>
          <Ionicons name="time-outline" size={16} color={COLORS.accent} />
          <Text style={styles.metricTitle}>Durée réelle</Text>
        </View>
        <TextInput
          value={durationMin}
          onChangeText={onDurationChange}
          onFocus={() => {
            // Vider le champ au focus pour que le joueur puisse taper directement sa valeur
            if (durationMin) onDurationChange("");
          }}
          placeholder="ex: 60"
          placeholderTextColor={COLORS.textMuted}
          keyboardType="number-pad"
          style={[styles.durationInput, !durationValid && durationMin ? styles.durationInputError : null]}
          accessibilityLabel="Durée de la séance"
          accessibilityHint="Entre la durée réelle en minutes, entre 5 et 300"
        />
        <Text style={styles.metricHint}>minutes</Text>
        {!durationValid && durationMin ? (
          <Text style={styles.metricError}>Entre 5 et 300 min</Text>
        ) : null}
      </View>
      <View style={styles.metricCard}>
        <View style={styles.metricIconRow}>
          <Ionicons name="fitness-outline" size={16} color={COLORS.accent} />
          <Text style={styles.metricTitle}>Charge estimée</Text>
        </View>
        <Text style={styles.metricValue}>
          {estimatedLoad != null ? `${estimatedLoad} UA` : '—'}
        </Text>
        <Text style={styles.metricHint}>
          Forme {tsb.toFixed(1)} → {projectedTsb ?? '—'}
          {projectedDelta != null ? ` (${projectedDelta >= 0 ? '+' : ''}${projectedDelta})` : ''}
        </Text>
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
  durationInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    fontSize: TYPE.body.fontSize,
  },
  durationInputError: {
    borderColor: COLORS.danger,
    borderWidth: 2,
    backgroundColor: theme.colors.redSoft05,
  },
  metricValue: { marginTop: 8, fontSize: TYPE.subtitle.fontSize, fontWeight: '700', color: COLORS.text },
  metricHint: { marginTop: 4, fontSize: TYPE.micro.fontSize, color: COLORS.textMuted },
  metricError: { marginTop: 4, fontSize: TYPE.micro.fontSize, color: COLORS.danger },
});
