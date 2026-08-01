// screens/feedback/components/ExecutionSummaryCard.tsx
// Resume auto de l'execution en seance (Lot 4), affiche avant les sliders de
// feedback quand une execution finalisee existe pour la seance cible. Sans
// execution -> ce composant n'est simplement pas monte (cf. FeedbackScreen.tsx).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../constants/theme';
import { DEVIATION_REASON_LABEL_FR } from '../deviationReasonLabels';
import type { DeviationReason } from '../../../domain/tracking/types';

const COLORS = theme.colors;

type Props = {
  completionPct: number;
  adapted: number;
  skipped: number;
  replaced: number;
  mainReasons: DeviationReason[];
  rpeTarget: number | null;
  rpeFelt: number;
};

// Fix P2-f : DEVIATION_REASON_LABEL_FR porte desormais des libelles en casse
// "debut de phrase" (ex. "Manque de temps", cf. deviationReasonLabels.ts).
// Ici les raisons sont composees EN MILIEU de phrase, entre parentheses
// (jamais en tout debut) -- on les reabaisse donc en minuscule pour rester
// grammaticalement correct en francais ("... adaptés (manque de temps)"),
// jamais l'inverse (une majuscule en debut de phrase serait fautive a retirer).
const lowerFirst = (value: string) => (value.length > 0 ? value.charAt(0).toLowerCase() + value.slice(1) : value);

export function ExecutionSummaryCard({
  completionPct, adapted, skipped, replaced, mainReasons, rpeTarget, rpeFelt,
}: Props) {
  const reasonLabel =
    mainReasons.length > 0
      ? mainReasons.map((r) => lowerFirst(DEVIATION_REASON_LABEL_FR[r] ?? r)).join(', ')
      : null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="checkmark-done-circle-outline" size={18} color={COLORS.accent} />
        <Text style={styles.title} numberOfLines={1}>
          Séance réalisée à {completionPct} %
        </Text>
      </View>
      <Text style={styles.line} numberOfLines={1}>
        RPE prévu {rpeTarget ?? '—'} — RPE ressenti {rpeFelt}
      </Text>
      {adapted > 0 && (
        <Text style={styles.line} numberOfLines={2}>
          {adapted} exercice{adapted > 1 ? 's' : ''} adapté{adapted > 1 ? 's' : ''}
          {reasonLabel ? ` (${reasonLabel})` : ''}
        </Text>
      )}
      {skipped > 0 && (
        <Text style={styles.line} numberOfLines={2}>
          {skipped} exercice{skipped > 1 ? 's' : ''} sauté{skipped > 1 ? 's' : ''}
          {reasonLabel && adapted === 0 ? ` (${reasonLabel})` : ''}
        </Text>
      )}
      {replaced > 0 && (
        <Text style={styles.line} numberOfLines={1}>
          {replaced} exercice{replaced > 1 ? 's' : ''} remplacé{replaced > 1 ? 's' : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSoft,
    padding: 14,
    gap: 4,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, minHeight: 22 },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  line: { fontSize: 12, color: COLORS.textMuted, minHeight: 16 },
});
