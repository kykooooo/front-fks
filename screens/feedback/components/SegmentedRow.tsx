// screens/feedback/components/SegmentedRow.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import type { SegmentedOption } from '../feedbackScales';

const COLORS = theme.colors;

type Props = {
  options: SegmentedOption[];
  value: number;
  onChange: (v: number) => void;
  scaleLabel?: string;
};

export function SegmentedRow({ options, value, onChange, scaleLabel }: Props) {
  const current = options.find((o) => o.value === value);
  return (
    <View>
      <View style={styles.segmentRow} accessibilityRole="radiogroup" accessibilityLabel={scaleLabel}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[styles.segmentChip, selected && styles.segmentChipSelected]}
              accessibilityRole="radio"
              accessibilityLabel={`${scaleLabel ? scaleLabel + ' ' : ''}${opt.value} : ${opt.label}`}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.segmentValue,
                  selected && styles.segmentValueSelected,
                ]}
              >
                {opt.value}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {current && <Text style={styles.segmentHint}>{current.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  segmentChip: {
    flexGrow: 1,
    minWidth: 30,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingVertical: 6,
    alignItems: 'center',
  },
  segmentChipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  segmentValue: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  segmentValueSelected: {
    color: COLORS.accent,
  },
  segmentHint: {
    marginTop: 6,
    fontSize: TYPE.micro.fontSize,
    color: COLORS.textMuted,
  },
});
