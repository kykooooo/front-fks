// screens/feedback/components/CyclePrompt.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { Button } from '../../../components/ui/Button';

const COLORS = theme.colors;

type Props = {
  onChooseNewProgram: () => void;
  onLater: () => void;
  onTestProgress?: () => void;
};

export function CyclePrompt({ onChooseNewProgram, onLater, onTestProgress }: Props) {
  return (
    <View style={styles.cyclePrompt}>
      <Text style={styles.cyclePromptText}>
        Programme terminé ! Avant de démarrer le prochain, mesure tes progrès — ce cycle a dû payer sur ton 30m, ton CMJ ou ton Yo-Yo.
      </Text>
      <View style={styles.cycleActions}>
        {onTestProgress ? (
          <Button
            label="Mesurer mes progrès"
            onPress={onTestProgress}
            variant="primary"
            size="md"
            fullWidth
          />
        ) : null}
        <Button
          label="Choisir un nouveau programme"
          onPress={onChooseNewProgram}
          variant={onTestProgress ? "secondary" : "primary"}
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
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cyclePromptText: { color: COLORS.text, fontSize: TYPE.caption.fontSize, lineHeight: 18 },
  cycleActions: { marginTop: 10, gap: 8 },
});
