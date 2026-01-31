// screens/ExternalLoadScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTrainingStore } from "../state/trainingStore";
import { EXTERNAL_WEIGHTS } from "../config/trainingDefaults";
import { theme } from "../constants/theme";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

type Modality = "Match" | "TeamTraining" | "Physio" | "Other";
type ExternalSource = "match" | "club" | "other";

const genId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const modalityWeight: Record<Modality, number> = {
  Match: EXTERNAL_WEIGHTS.match,
  TeamTraining: EXTERNAL_WEIGHTS.club,
  Physio: EXTERNAL_WEIGHTS.other,
  Other: EXTERNAL_WEIGHTS.other,
};

const palette = theme.colors;


// mapping conforme au type du store: "match" | "club" | "other"
const sourceMap: Record<Modality, ExternalSource> = {
  Match: "match",
  TeamTraining: "club",
  Physio: "other",
  Other: "other",
};

export default function ExternalLoadScreen() {
  const nav = useNavigation();
  const addExternalLoad = useTrainingStore((s) => s.addExternalLoad);

  const [date, setDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [modality, setModality] = useState<Modality>("Match");
  const [durationMin, setDurationMin] = useState<string>("75");
  const [rpe, setRpe] = useState<string>("7");
  const [note, setNote] = useState<string>("");

  const parsedDuration = useMemo(() => Number(durationMin) || 0, [durationMin]);
  const parsedRpe = useMemo(() => Number(rpe) || 0, [rpe]);

  const previewSRPE = useMemo(() => {
    const w = modalityWeight[modality] ?? 1;
    return Math.max(0, parsedDuration * parsedRpe * w);
  }, [parsedDuration, parsedRpe, modality]);

  const onOpenDate = () => {
    Keyboard.dismiss();            // ✅ ferme le clavier avant d’ouvrir le picker
    setShowPicker(true);
  };

  const onSubmit = () => {
    Keyboard.dismiss();            // ✅ ferme le clavier au submit
    if (parsedDuration <= 0 || parsedRpe <= 0) {
      Alert.alert("Entrée invalide", "Durée et RPE doivent être > 0");
      return;
    }
    try {
      const payload = {
        id: genId(),
        source: sourceMap[modality] as ExternalSource, // ✅ conforme au type du store
        dateISO: date.toISOString(),
        modality, // retire-le si ton type store n'a pas 'modality'
        durationMin: parsedDuration,
        rpe: parsedRpe,
        note: note?.trim() || undefined,
      };
      addExternalLoad(payload as any); // garde 'as any' si le type du store diffère encore

      Alert.alert("Ajouté ✅", "La charge externe a été enregistrée.");
      // @ts-ignore
      nav.goBack();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible d’ajouter la charge.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0} // ajuste selon la hauteur de ton header
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <SectionHeader title="Ajouter une charge externe" />

          {/* Date */}
          <View style={styles.section}>
            <Text style={styles.label}>Date</Text>
            <Pressable
              onPress={onOpenDate}
              style={styles.inputButton}
            >
              <Text style={styles.inputText}>
                {date.toDateString()} {date.toTimeString().slice(0, 5)}
              </Text>
            </Pressable>

            {Platform.OS !== "web" && showPicker && (
              <DateTimePicker
                value={date}
                mode="datetime"
                onChange={(_, d) => {
                  setShowPicker(Platform.OS === "ios");
                  if (d) setDate(d);
                }}
              />
            )}

            {Platform.OS === "web" && showPicker && (
              <Text style={styles.helperMuted}>
                Le sélecteur natif n’est pas dispo sur Web. Ferme ce message et saisis la date via un champ texte si besoin.
              </Text>
            )}
          </View>

          {/* Modality */}
          <View style={styles.section}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.rowWrap}>
              {(["Match", "TeamTraining", "Physio", "Other"] as Modality[]).map((m) => {
                const active = modality === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setModality(m)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.helperMuted}>
              Poids (prévu) : {modalityWeight[modality]}×
            </Text>
          </View>

          {/* Durée */}
          <View style={styles.section}>
            <Text style={styles.label}>Durée (min)</Text>
            <TextInput
              value={durationMin}
              onChangeText={setDurationMin}
              keyboardType="numeric"
              placeholder="ex: 90"
              placeholderTextColor={palette.sub}
              blurOnSubmit
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              style={styles.input}
            />
          </View>

          {/* RPE */}
          <View style={styles.section}>
            <Text style={styles.label}>RPE (1–10)</Text>
            <TextInput
              value={rpe}
              onChangeText={setRpe}
              keyboardType="numeric"
              placeholder="ex: 8"
              placeholderTextColor={palette.sub}
              blurOnSubmit
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              style={styles.input}
            />
          </View>

          {/* Note */}
          <View style={styles.section}>
            <Text style={styles.label}>Note (optionnelle)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="ex: match intense, prolongations"
              placeholderTextColor={palette.sub}
              blurOnSubmit
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              multiline
              style={[styles.input, styles.inputMultiline]}
            />
          </View>

          {/* Aperçu */}
          <Card variant="soft" style={styles.previewCard}>
            <Text style={styles.previewTitle}>Aperçu charge (sRPE pondérée)</Text>
            <Text style={styles.previewText}>
              Durée×RPE×Poids = {parsedDuration}×{parsedRpe}×{modalityWeight[modality]}
            </Text>
            <Text style={styles.previewValue}>
              ≈ <Text style={styles.previewValueStrong}>{previewSRPE.toFixed(0)}</Text> UA
            </Text>
          </Card>

          {/* Submit */}
          <Button label="Enregistrer" onPress={onSubmit} fullWidth size="lg" />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 16, gap: 16 },
  section: { gap: 8 },
  label: { color: palette.sub, fontWeight: "600" },
  helperMuted: { color: palette.sub, fontSize: 12 },
  rowWrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  chipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  chipText: { color: palette.sub, fontWeight: "600" },
  chipTextActive: { color: palette.accent, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    color: palette.text,
    backgroundColor: palette.cardSoft,
  },
  inputMultiline: { minHeight: 48 },
  inputButton: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: palette.cardSoft,
  },
  inputText: { color: palette.text },
  previewCard: { padding: 12, gap: 4 },
  previewTitle: { color: palette.text, fontWeight: "700" },
  previewText: { color: palette.sub },
  previewValue: { color: palette.text, fontSize: 16 },
  previewValueStrong: { fontWeight: "800", color: palette.text },
});
