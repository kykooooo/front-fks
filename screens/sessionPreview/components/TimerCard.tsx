// screens/sessionPreview/components/TimerCard.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { formatTime, formatPresetLabel } from "../sessionPreviewConfig";

const palette = theme.colors;

type TimerPreset = {
  label?: string | null;
  work_s?: number | null;
  rest_s?: number | null;
  rounds?: number | null;
};

type Props = {
  sessionSec: number;
  sessionRunning: boolean;
  restSec: number;
  timerPresets: TimerPreset[];
  isCompleted: boolean;
  onToggleSession: () => void;
  onResetSession: () => void;
  onStartRest: (seconds: number) => void;
  onStopRest: () => void;
};

export function TimerCard({
  sessionSec,
  sessionRunning,
  restSec,
  timerPresets,
  isCompleted,
  onToggleSession,
  onResetSession,
  onStartRest,
  onStopRest,
}: Props) {
  return (
    <Card variant="soft" style={styles.timerCard}>
      <SectionHeader title="Chronos" />
      <View style={styles.timerRow}>
        <View style={styles.timerBlock}>
          <Text style={styles.timerLabel}>Séance</Text>
          <Text style={styles.timerValue}>{formatTime(sessionSec)}</Text>
        </View>
        <View style={styles.timerBlock}>
          <Text style={styles.timerLabel}>Repos</Text>
          <Text style={styles.timerValue}>{formatTime(restSec)}</Text>
        </View>
      </View>

      <View style={styles.timerActions}>
        <Button
          label={sessionRunning ? "Pause" : "Démarrer"}
          onPress={onToggleSession}
          size="sm"
          variant={sessionRunning ? "secondary" : "primary"}
          style={styles.timerButton}
          disabled={isCompleted}
        />
        <Button
          label="Réinit"
          onPress={onResetSession}
          size="sm"
          variant="ghost"
          style={styles.timerButton}
          disabled={isCompleted}
        />
      </View>

      <View style={styles.restRow}>
        {[30, 60, 90].map((s) => (
          <TouchableOpacity
            key={s}
            style={styles.restChip}
            onPress={() => onStartRest(s)}
            activeOpacity={0.85}
            disabled={isCompleted}
          >
            <Text style={styles.restChipText}>{s}s</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.restChip, styles.restChipGhost]}
          onPress={onStopRest}
          disabled={isCompleted}
        >
          <Text style={styles.restChipGhostText}>Stop</Text>
        </TouchableOpacity>
      </View>
      {timerPresets.length > 0 ? (
        <View style={styles.presetRow}>
          {timerPresets.map((preset, idx) => (
            <Badge key={`preset_${idx}`} label={formatPresetLabel(preset)} />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  timerCard: { padding: 12, gap: 10 },
  timerRow: { flexDirection: "row", gap: 10 },
  timerBlock: { flex: 1 },
  timerLabel: { color: palette.sub, fontSize: 12 },
  timerValue: { color: palette.text, fontSize: 22, fontWeight: "800" },
  timerActions: { flexDirection: "row", gap: 8 },
  timerButton: { flex: 1 },
  restRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  presetRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  restChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  restChipGhost: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accent,
  },
  restChipText: { color: palette.text, fontWeight: "600", fontSize: 12 },
  restChipGhostText: { color: palette.accent, fontWeight: "700", fontSize: 12 },
});
