// screens/feedback/components/PainInjuryRow.tsx
//
// LE CURSEUR DOULEUR, ET RIEN D'AUTRE.
//
// Ce bloc portait aussi un toggle « Aucune / À préciser » et, derrière, un
// formulaire de blessure complet : zone, sévérité, type aigu/chronique, six
// restrictions, une note. L'audit (DESIGN_MON_CORPS.md §T4) a montré que le
// type, les six restrictions et la note n'étaient lus par PERSONNE. Le joueur
// remplissait, en fin de séance, des interrupteurs qui ne changeaient rien à sa
// séance suivante. Et le toggle repassé sur « Aucune » effaçait la déclaration
// sans un mot (§T8).
//
// Le détail des gênes vit désormais dans « Mon corps », son écran, où on peut
// aussi le METTRE À JOUR — ce qui était impossible avant (§T2). Le feedback
// propose d'y aller, après l'enregistrement, quand la douleur est marquée.
//
// LE CURSEUR 0-5 RESTE : il alimente le score de readiness (useReadinessScore)
// et le facteur de charge (utils/feedbackFactor). Ce n'est pas un doublon du
// détail de blessure, c'est le ressenti du jour.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../constants/theme';
import { PAIN_SCALE } from '../feedbackScales';
import { SegmentedRow } from './SegmentedRow';

const COLORS = theme.colors;

type Props = {
  pain: number;
  onPainChange: (v: number) => void;
};

export function PainInjuryRow({ pain, onPainChange }: Props) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIconRow}>
        <Ionicons name="bandage-outline" size={16} color="#ef4444" />
        <Text style={styles.metricTitle}>Douleurs</Text>
      </View>
      <SegmentedRow options={PAIN_SCALE} value={pain} onChange={onPainChange} scaleLabel="Douleur" />
    </View>
  );
}

const styles = StyleSheet.create({
  metricCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    backgroundColor: COLORS.surfaceSoft,
  },
  metricIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  metricTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
});
