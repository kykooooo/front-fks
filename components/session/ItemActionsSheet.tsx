// components/session/ItemActionsSheet.tsx
// Feuille d'options par exercice (SessionLiveScreen, Lot 2 boucle de suivi) :
// Adapte / Saute / Je ne peux pas faire cet exercice -> raison -> details.
// Jamais de saisie serie par serie, tout est facultatif.
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ModalContainer } from "../modal/ModalContainer";
import { Button } from "../ui/Button";
import { theme } from "../../constants/theme";
import { useHaptics } from "../../hooks/useHaptics";
import type { ActualValues, DeviationReason } from "../../domain/tracking/types";
import { DEVIATION_REASON_LABELS, DEVIATION_REASON_ORDER, type ActualFieldsConfig } from "./liveTrackingHelpers";

const palette = theme.colors;
const MAX_COMMENT_LENGTH = 140;

export type ItemActionKind = "adapt" | "skip" | "cannot_do";
type Step = "menu" | "reason" | "details";

export type ItemActionsSheetProps = {
  visible: boolean;
  itemName: string;
  fields: ActualFieldsConfig;
  onClose: () => void;
  onAdapt: (reason: DeviationReason, actual: ActualValues | null, comment: string | null) => void;
  onSkip: (reason: DeviationReason, comment: string | null) => void;
  onCannotDo: (reason: DeviationReason) => void;
};

const parseNumber = (value: string): number | undefined => {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export function ItemActionsSheet({
  visible,
  itemName,
  fields,
  onClose,
  onAdapt,
  onSkip,
  onCannotDo,
}: ItemActionsSheetProps) {
  const haptics = useHaptics();
  const [step, setStep] = useState<Step>("menu");
  const [kind, setKind] = useState<ItemActionKind | null>(null);
  const [reason, setReason] = useState<DeviationReason | null>(null);
  const [comment, setComment] = useState("");
  const [loadKg, setLoadKg] = useState("");
  const [reps, setReps] = useState("");
  const [distanceM, setDistanceM] = useState("");
  const [durationS, setDurationS] = useState("");

  // Reinitialise le contenu de la feuille a chaque ouverture (pas d'effet :
  // on detecte la transition pendant le rendu, cf. React "Adjusting state
  // based on a prop change" - https://react.dev/learn/you-might-not-need-an-effect).
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setStep("menu");
      setKind(null);
      setReason(null);
      setComment("");
      setLoadKg("");
      setReps("");
      setDistanceM("");
      setDurationS("");
    }
  }

  const chooseKind = (next: ItemActionKind) => {
    haptics.impactLight();
    setKind(next);
    setStep("reason");
  };

  const chooseReason = (next: DeviationReason) => {
    haptics.impactLight();
    setReason(next);
    if (kind === "cannot_do") {
      onCannotDo(next);
      return;
    }
    setStep("details");
  };

  const buildActual = (): ActualValues | null => {
    const actual: ActualValues = {};
    if (fields.loadKg) {
      const v = parseNumber(loadKg);
      if (v != null) actual.loadKg = v;
    }
    if (fields.reps) {
      const v = parseNumber(reps);
      if (v != null) actual.reps = v;
    }
    if (fields.distanceM) {
      const v = parseNumber(distanceM);
      if (v != null) actual.distanceM = v;
    }
    if (fields.durationS) {
      const v = parseNumber(durationS);
      if (v != null) actual.durationS = v;
    }
    return Object.keys(actual).length > 0 ? actual : null;
  };

  const confirmDetails = () => {
    if (!reason) return;
    const trimmed = comment.trim().slice(0, MAX_COMMENT_LENGTH);
    const finalComment = trimmed.length > 0 ? trimmed : null;
    haptics.success();
    if (kind === "adapt") {
      onAdapt(reason, buildActual(), finalComment);
    } else if (kind === "skip") {
      onSkip(reason, finalComment);
    }
  };

  const hasAnyField = fields.loadKg || fields.reps || fields.distanceM || fields.durationS;

  return (
    <ModalContainer visible={visible} onClose={onClose} animationType="slide" allowSwipeDismiss allowBackdropDismiss>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} numberOfLines={2}>
          {itemName}
        </Text>

        {step === "menu" ? (
          <View style={{ gap: 10 }}>
            <TouchableOpacity style={styles.menuRow} onPress={() => chooseKind("adapt")} activeOpacity={0.85}>
              <Ionicons name="create-outline" size={18} color={palette.text} />
              <Text style={styles.menuLabel}>Adapté</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => chooseKind("skip")} activeOpacity={0.85}>
              <Ionicons name="play-skip-forward-outline" size={18} color={palette.text} />
              <Text style={styles.menuLabel}>Sauté</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => chooseKind("cannot_do")} activeOpacity={0.85}>
              <Ionicons name="close-circle-outline" size={18} color={palette.text} />
              <Text style={styles.menuLabel}>Je ne peux pas faire cet exercice</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {step === "reason" ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.stepLabel}>Pourquoi ?</Text>
            {DEVIATION_REASON_ORDER.map((r) => (
              <TouchableOpacity key={r} style={styles.reasonRow} onPress={() => chooseReason(r)} activeOpacity={0.85}>
                <Text style={styles.reasonLabel}>{DEVIATION_REASON_LABELS[r]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {step === "details" ? (
          <View style={{ gap: 14 }}>
            {kind === "adapt" && hasAnyField ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.stepLabel}>Ce que tu as vraiment fait (facultatif)</Text>
                <View style={styles.fieldsRow}>
                  {fields.loadKg ? (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Charge (kg)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        keyboardType="decimal-pad"
                        value={loadKg}
                        onChangeText={setLoadKg}
                        placeholder="—"
                        placeholderTextColor={palette.muted}
                      />
                    </View>
                  ) : null}
                  {fields.reps ? (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Répétitions</Text>
                      <TextInput
                        style={styles.fieldInput}
                        keyboardType="number-pad"
                        value={reps}
                        onChangeText={setReps}
                        placeholder="—"
                        placeholderTextColor={palette.muted}
                      />
                    </View>
                  ) : null}
                  {fields.distanceM ? (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Distance (m)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        keyboardType="decimal-pad"
                        value={distanceM}
                        onChangeText={setDistanceM}
                        placeholder="—"
                        placeholderTextColor={palette.muted}
                      />
                    </View>
                  ) : null}
                  {fields.durationS ? (
                    <View style={styles.fieldBox}>
                      <Text style={styles.fieldLabel}>Durée (s)</Text>
                      <TextInput
                        style={styles.fieldInput}
                        keyboardType="number-pad"
                        value={durationS}
                        onChangeText={setDurationS}
                        placeholder="—"
                        placeholderTextColor={palette.muted}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              <Text style={styles.stepLabel}>Un mot (facultatif)</Text>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={(t) => setComment(t.slice(0, MAX_COMMENT_LENGTH))}
                placeholder="Ex : genou qui tire un peu"
                placeholderTextColor={palette.muted}
                maxLength={MAX_COMMENT_LENGTH}
                multiline
              />
            </View>

            <Button label="Valider" onPress={confirmDetails} fullWidth size="md" />
          </View>
        ) : null}
      </ScrollView>
    </ModalContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 6, gap: 16 },
  title: { color: palette.text, fontSize: 16, fontWeight: "700", minHeight: 20 },
  stepLabel: { color: palette.sub, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    minHeight: 48,
  },
  menuLabel: { color: palette.text, fontSize: 14, fontWeight: "600", flexShrink: 1 },
  reasonRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    minHeight: 44,
    justifyContent: "center",
  },
  reasonLabel: { color: palette.text, fontSize: 14, fontWeight: "500" },
  fieldsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fieldBox: { minWidth: 100, flexGrow: 1, gap: 4 },
  fieldLabel: { color: palette.sub, fontSize: 11, fontWeight: "600" },
  fieldInput: {
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    fontSize: 14,
    backgroundColor: palette.card,
    minHeight: 44,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    fontSize: 13,
    backgroundColor: palette.card,
    minHeight: 44,
  },
});
