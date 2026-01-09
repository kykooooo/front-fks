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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTrainingStore } from "../state/trainingStore";

type Modality = "Match" | "TeamTraining" | "Physio" | "Other";
type ExternalSource = "match" | "club" | "other";

const genId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const modalityWeight: Record<Modality, number> = {
  Match: 0.9,
  TeamTraining: 0.8,
  Physio: 0.4,
  Other: 0.7,
};


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
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0} // ajuste selon la hauteur de ton header
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 20, fontWeight: "600" }}>Ajouter une charge externe</Text>

          {/* Date */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: "500" }}>Date</Text>
            <Pressable
              onPress={onOpenDate}
              style={{
                borderWidth: 1,
                borderColor: "#ddd",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <Text>
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
              <Text style={{ opacity: 0.6 }}>
                Le sélecteur natif n’est pas dispo sur Web. Ferme ce message et saisis la date via un champ texte si besoin.
              </Text>
            )}
          </View>

          {/* Modality */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: "500" }}>Type</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(["Match", "TeamTraining", "Physio", "Other"] as Modality[]).map((m) => {
                const active = modality === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setModality(m)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? "#111" : "#ccc",
                      backgroundColor: active ? "#f0f0f0" : "white",
                    }}
                  >
                    <Text>{m}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ opacity: 0.6, fontSize: 12 }}>
              Poids (prévu) : {modalityWeight[modality]}×
            </Text>
          </View>

          {/* Durée */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: "500" }}>Durée (min)</Text>
            <TextInput
              value={durationMin}
              onChangeText={setDurationMin}
              keyboardType="numeric"
              placeholder="ex: 90"
              blurOnSubmit
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              style={{
                borderWidth: 1,
                borderColor: "#ddd",
                borderRadius: 12,
                padding: 12,
              }}
            />
          </View>

          {/* RPE */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: "500" }}>RPE (1–10)</Text>
            <TextInput
              value={rpe}
              onChangeText={setRpe}
              keyboardType="numeric"
              placeholder="ex: 8"
              blurOnSubmit
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              style={{
                borderWidth: 1,
                borderColor: "#ddd",
                borderRadius: 12,
                padding: 12,
              }}
            />
          </View>

          {/* Note */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: "500" }}>Note (optionnelle)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="ex: match intense, prolongations"
              blurOnSubmit
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              multiline
              style={{
                borderWidth: 1,
                borderColor: "#ddd",
                borderRadius: 12,
                padding: 12,
                minHeight: 48,
              }}
            />
          </View>

          {/* Aperçu */}
          <View
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: "#eee",
              borderRadius: 12,
              backgroundColor: "#fafafa",
              gap: 4,
            }}
          >
            <Text style={{ fontWeight: "600" }}>Aperçu charge (sRPE pondérée)</Text>
            <Text>
              Durée×RPE×Poids = {parsedDuration}×{parsedRpe}×{modalityWeight[modality]}
            </Text>
            <Text style={{ fontSize: 16 }}>
              ≈ <Text style={{ fontWeight: "700" }}>{previewSRPE.toFixed(0)}</Text> UA
            </Text>
          </View>

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            style={{
              marginTop: 8,
              padding: 14,
              borderRadius: 12,
              backgroundColor: "#111",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Enregistrer</Text>
          </Pressable>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
