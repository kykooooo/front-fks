// screens/tests/components/EntryFormCard.tsx
import React from "react";
import { View, Text, StyleSheet, TextInput, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { getGroupConfig, FIELD_BY_KEY, type FieldKey, type StepId, type TestEntry } from "../testConfig";
import { minSecToSeconds, secondsToMinSec } from "../testHelpers";

const palette = theme.colors;

type Props = {
  stepIndex: number;
  steps: StepId[];
  progressRatio: number;
  form: Partial<TestEntry>;
  onFormChange: (key: string, value: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onHaptic: () => void;
  cardAnim: Animated.Value;
};

export function EntryFormCard({
  stepIndex, steps, progressRatio, form,
  onFormChange, onNext, onPrev, onSkip, onHaptic, cardAnim,
}: Props) {
  const currentStep = steps[stepIndex] ?? steps[0];
  const isNotesStep = currentStep === "notes";
  const currentField = !isNotesStep ? FIELD_BY_KEY[currentStep as FieldKey] : null;
  const stepLabel = isNotesStep ? "Notes du jour" : currentField?.label ?? "Test";
  const stepProtocol = isNotesStep
    ? "Optionnel : surface, fatigue, conditions, ressenti."
    : currentField?.protocol ?? "";
  const stepUnit = isNotesStep ? "" : currentField?.unit ?? "";
  const currentFieldKey = !isNotesStep ? (currentStep as FieldKey) : null;

  // Le 1 km se saisit en minutes + secondes (le stockage reste en secondes,
  // compatible avec l'historique existant et les bornes min/max du champ).
  const isRun1km = currentFieldKey === "run1km_s";
  const run1kmTotalRaw = isRun1km ? Number(form.run1km_s) : NaN;
  const hasRun1kmValue = isRun1km && Number.isFinite(run1kmTotalRaw) && run1kmTotalRaw > 0;
  const run1kmParts = hasRun1kmValue ? secondsToMinSec(run1kmTotalRaw) : { minutes: 0, seconds: 0 };
  const run1kmMinStr = hasRun1kmValue ? String(run1kmParts.minutes) : "";
  const run1kmSecStr = hasRun1kmValue ? String(run1kmParts.seconds) : "";

  const updateRun1km = (nextMinStr: string, nextSecStr: string) => {
    const min = nextMinStr === "" ? 0 : parseInt(nextMinStr, 10);
    const sec = nextSecStr === "" ? 0 : parseInt(nextSecStr, 10);
    const total = minSecToSeconds(Number.isFinite(min) ? min : 0, Number.isFinite(sec) ? sec : 0);
    onFormChange("run1km_s", total > 0 ? String(total) : "");
  };

  return (
    <Animated.View
      style={{
        opacity: cardAnim,
        transform: [
          {
            translateY: cardAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
            }),
          },
        ],
      }}
    >
      <Card variant="surface" style={styles.entryCard}>
        <View style={styles.entryHeader}>
          <View style={styles.entryTitleRow}>
            <Ionicons name="play-circle-outline" size={18} color={palette.accent} />
            <Text style={styles.sectionTitle}>Batterie en cours</Text>
          </View>
          <Badge label={`${Math.min(stepIndex + 1, steps.length)}/${steps.length}`} />
        </View>
        <View style={styles.entryProgressTrack}>
          <View
            style={[
              styles.entryProgressFill,
              { width: `${progressRatio * 100}%`, backgroundColor: palette.accent },
            ]}
          />
        </View>

        <View style={styles.entryBody}>
          {currentField && (
            <View style={styles.entryFieldHeader}>
              <View
                style={[
                  styles.entryFieldIcon,
                  { backgroundColor: getGroupConfig(currentField.group).tintSoft },
                ]}
              >
                <Ionicons
                  name={getGroupConfig(currentField.group).icon}
                  size={16}
                  color={getGroupConfig(currentField.group).tint}
                />
              </View>
              <Text style={styles.entryLabel}>{stepLabel}</Text>
            </View>
          )}
          {isNotesStep && <Text style={styles.entryLabel}>{stepLabel}</Text>}
          <Text style={styles.entryProtocol}>{stepProtocol}</Text>

          {isNotesStep ? (
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Ressenti, surface, fatigue, contexte..."
              placeholderTextColor={palette.sub}
              multiline
              value={form.notes ?? ""}
              onChangeText={(txt) => onFormChange("notes", txt)}
            />
          ) : isRun1km ? (
            <View style={styles.entryInputRow}>
              <TextInput
                style={[styles.input, styles.entryInput]}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={palette.sub}
                value={run1kmMinStr}
                onChangeText={(txt) => updateRun1km(txt.replace(/[^0-9]/g, ""), run1kmSecStr)}
              />
              <View style={styles.entryUnitPill}>
                <Text style={styles.entryUnitText}>min</Text>
              </View>
              <TextInput
                style={[styles.input, styles.entryInput]}
                keyboardType="numeric"
                placeholder="00"
                placeholderTextColor={palette.sub}
                value={run1kmSecStr}
                onChangeText={(txt) => updateRun1km(run1kmMinStr, txt.replace(/[^0-9]/g, ""))}
              />
              <View style={styles.entryUnitPill}>
                <Text style={styles.entryUnitText}>s</Text>
              </View>
            </View>
          ) : (
            <View style={styles.entryInputRow}>
              <TextInput
                style={[styles.input, styles.entryInput]}
                keyboardType="numeric"
                placeholder={currentField?.placeholder || "0"}
                placeholderTextColor={palette.sub}
                value={
                  currentFieldKey ? form[currentFieldKey]?.toString() ?? "" : ""
                }
                onChangeText={(txt) =>
                  currentFieldKey ? onFormChange(currentFieldKey, txt) : undefined
                }
              />
              <View style={styles.entryUnitPill}>
                <Text style={styles.entryUnitText}>{stepUnit || "reps"}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.entryActions}>
          <Button
            label={stepIndex === 0 ? "Retour" : "Précédent"}
            onPress={() => { onPrev(); onHaptic(); }}
            size="sm"
            variant="ghost"
          />
          {!isNotesStep ? (
            <Button
              label="Passer"
              onPress={() => { onSkip(); onHaptic(); }}
              size="sm"
              variant="secondary"
            />
          ) : null}
          <Button
            label={stepIndex >= steps.length - 1 ? "Terminer" : "Suivant"}
            onPress={() => { onNext(); onHaptic(); }}
            size="sm"
            variant="primary"
          />
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  entryCard: {
    borderRadius: theme.radius.lg,
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryProgressTrack: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  entryProgressFill: {
    height: "100%",
    borderRadius: theme.radius.pill,
  },
  entryBody: {
    gap: 8,
  },
  entryFieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  entryFieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  entryLabel: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "800",
  },
  entryProtocol: {
    color: palette.sub,
    fontSize: 12,
    lineHeight: 17,
  },
  entryInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryInput: {
    flex: 1,
  },
  entryUnitPill: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  entryUnitText: {
    color: palette.sub,
    fontSize: 12,
    fontWeight: "600",
  },
  entryActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },
  input: {
    backgroundColor: palette.cardSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: palette.text,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
});
