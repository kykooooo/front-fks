// screens/feedback/components/CyclePrompt.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';

const COLORS = theme.colors;

type Props = {
  onChooseNewProgram: () => void;
  onLater: () => void;
};

export function CyclePrompt({ onChooseNewProgram, onLater }: Props) {
  return (
    <View style={styles.cyclePrompt}>
      <Text style={styles.cyclePromptText}>
        Programme terminé ! Choisis ton prochain programme ou ferme ce message.
      </Text>
      <View style={styles.cycleActions}>
        <Button
          label="Choisir un nouveau programme"
          onPress={onChooseNewProgram}
          variant="primary"
          size="md"
          fullWidth
        />
        <Button
          label="Plus tard"
          onPress={onLater}
          variant="ghost"
          size="md"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cyclePrompt: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cyclePromptText: { color: COLORS.text, fontSize: 13, lineHeight: 18 },
  cycleActions: { marginTop: 10, gap: 8 },
});
