// screens/feedback/components/RPEBlock.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { getRpeColor, RPE_LABELS } from '../feedbackScales';

const COLORS = theme.colors;

type Props = {
  rpe: number;
  onRpeChange: (v: number) => void;
};

export function RPEBlock({ rpe, onRpeChange }: Props) {
  const color = getRpeColor(rpe);
  return (
    <View style={styles.rpeCard}>
      <View style={styles.rpeHeader}>
        <View style={styles.rpeHeaderLeft}>
          <LinearGradient
            colors={[color, getRpeColor(Math.min(10, rpe + 1))]}
            style={styles.rpeIconCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="pulse-outline" size={18} color={theme.colors.white} />
          </LinearGradient>
          <View>
            <Text style={styles.metricTitle}>RPE séance</Text>
            <Text style={styles.rpeSubtitle}>Effort perçu</Text>
          </View>
        </View>
        <View style={[styles.rpeBadge, { backgroundColor: color + '20', borderColor: color }]}>
          <Text style={[styles.rpeBadgeText, { color }]}>
            {RPE_LABELS[rpe] || 'RPE ' + rpe}
          </Text>
        </View>
      </View>

      <View style={styles.rpeValueRow}>
        <Text style={[styles.rpeValue, { color }]}>{rpe}</Text>
        <Text style={styles.rpeValueSuffix}>/10</Text>
      </View>

      <View style={styles.rpeBarTrack}>
        <LinearGradient
          colors={[theme.colors.green600, theme.colors.lime500, theme.colors.amber500, theme.colors.orange500, theme.colors.red500]}
          style={[styles.rpeBarFill, { width: `${rpe * 10}%` }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      </View>

      <View style={styles.rpeSelector}>
        {Array.from({ length: 10 }).map((_, i) => {
          const v = i + 1;
          const selected = v === rpe;
          const dotColor = getRpeColor(v);
          return (
            <TouchableOpacity
              key={v}
              onPress={() => onRpeChange(v)}
              style={[
                styles.rpeDot,
                selected && { backgroundColor: dotColor, borderColor: dotColor },
              ]}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityLabel={`RPE ${v}`}
              accessibilityState={{ selected }}
            >
              <Text style={[styles.rpeDotText, selected && styles.rpeDotTextSelected]}>
                {v}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rpeCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    backgroundColor: COLORS.surfaceSoft,
  },
  rpeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  rpeHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rpeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTitle: { fontSize: TYPE.caption.fontSize, fontWeight: '600', color: COLORS.text },
  rpeSubtitle: { fontSize: TYPE.micro.fontSize, color: COLORS.textMuted, marginTop: 1 },
  rpeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.pill, borderWidth: 1 },
  rpeBadgeText: { fontSize: TYPE.micro.fontSize, fontWeight: '700' },
  rpeValueRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  rpeValue: { fontSize: TYPE.display.md.fontSize, fontWeight: '800' },
  rpeValueSuffix: { fontSize: TYPE.body.fontSize, color: COLORS.textMuted, marginLeft: 4 },
  rpeBarTrack: {
    height: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  rpeBarFill: { height: '100%', borderRadius: RADIUS.pill },
  rpeSelector: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  rpeDot: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  rpeDotText: { color: COLORS.textMuted, fontSize: TYPE.body.fontSize, fontWeight: '700' },
  rpeDotTextSelected: { color: theme.colors.white, fontWeight: '700' },
});
