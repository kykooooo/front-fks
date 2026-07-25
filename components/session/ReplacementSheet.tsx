// components/session/ReplacementSheet.tsx
// Feuille de proposition de remplacement d'exercice (SessionLiveScreen,
// Lot 2 boucle de suivi). Toujours honnete : badge "adaptation partielle"
// si equivalent=false, message clair si aucune alternative fiable.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { ModalContainer } from "../modal/ModalContainer";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { theme } from "../../constants/theme";
import type { ReplacementProposal } from "../../domain/tracking/types";

const palette = theme.colors;

function formatPrescription(p: ReplacementProposal["prescription"]): string {
  const parts: string[] = [];
  if (p.sets != null) parts.push(`${p.sets}x`);
  if (p.reps != null) parts.push(`${p.reps} reps`);
  if (p.durationS != null) parts.push(`${p.durationS}s`);
  if (p.restS != null) parts.push(`repos ${p.restS}s`);
  return parts.join(" · ");
}

export type ReplacementSheetProps = {
  visible: boolean;
  originalName: string;
  proposal: ReplacementProposal | null;
  canSeeAnother: boolean;
  onAccept: () => void;
  onSeeAnother: () => void;
  onSkip: () => void;
  onClose: () => void;
};

export function ReplacementSheet({
  visible,
  originalName,
  proposal,
  canSeeAnother,
  onAccept,
  onSeeAnother,
  onSkip,
  onClose,
}: ReplacementSheetProps) {
  const prescriptionLabel = proposal ? formatPrescription(proposal.prescription) : "";

  return (
    <ModalContainer visible={visible} onClose={onClose} animationType="slide" allowSwipeDismiss allowBackdropDismiss>
      <View style={styles.container}>
        <Text style={styles.kicker} numberOfLines={1}>
          À la place de {originalName}
        </Text>

        {proposal ? (
          <View style={{ gap: 12 }}>
            <View style={styles.headerRow}>
              <Text style={styles.title} numberOfLines={2}>
                {proposal.name}
              </Text>
              {!proposal.equivalent ? <Badge label="Adaptation partielle" tone="warn" /> : null}
            </View>
            <Text style={styles.why}>{proposal.shortWhy}</Text>
            {prescriptionLabel ? <Text style={styles.prescription}>{prescriptionLabel}</Text> : null}

            <View style={{ gap: 8 }}>
              <Button label="Utiliser ce remplacement" onPress={onAccept} fullWidth size="md" />
              {canSeeAnother ? (
                <Button label="Voir une autre option" onPress={onSeeAnother} fullWidth size="md" variant="secondary" />
              ) : null}
              <Button label="Passer l'exercice" onPress={onSkip} fullWidth size="md" variant="ghost" />
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={styles.why}>
              Pas d'alternative fiable pour cet exercice avec tes contraintes. Tu peux le passer sans culpabiliser.
            </Text>
            <Button label="Passer l'exercice" onPress={onSkip} fullWidth size="md" />
          </View>
        )}
      </View>
    </ModalContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 6, gap: 12 },
  kicker: {
    color: palette.sub,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    minHeight: 16,
  },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  title: { color: palette.text, fontSize: 17, fontWeight: "700", flex: 1, minHeight: 20 },
  why: { color: palette.sub, fontSize: 13, lineHeight: 19, minHeight: 19 },
  prescription: { color: palette.text, fontSize: 13, fontWeight: "600" },
});
