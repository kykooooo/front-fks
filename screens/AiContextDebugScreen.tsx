// screens/AiContextDebugScreen.tsx
import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTrainingStore } from "../state/trainingStore";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

const palette = theme.colors;

export default function AiContextDebugScreen() {
  // Pas de souscription pour éviter les boucles : lecture one-shot
  const ctx = useTrainingStore.getState().lastAiContext as any;
  const initial = useTrainingStore.getState();
  const setManualLoad = useTrainingStore.getState().setManualLoad;

  const [atlInput, setAtlInput] = useState(initial.atl.toString());
  const [ctlInput, setCtlInput] = useState(initial.ctl.toString());
  const [tsbInput, setTsbInput] = useState(initial.tsb.toString());

  const applyLoad = () => {
    const nextAtl = Number(atlInput);
    const nextCtl = Number(ctlInput);
    const nextTsb = Number(tsbInput);
    if (!Number.isFinite(nextAtl) || !Number.isFinite(nextCtl) || !Number.isFinite(nextTsb)) {
      return;
    }
    setManualLoad(nextAtl, nextCtl, nextTsb);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.title}>Contexte IA</Text>
        <Text style={styles.sub}>
          Ajuste ATL / CTL / TSB pour tes tests, et visualise le dernier contexte envoyé.
        </Text>
        <Card variant="surface" style={styles.card}>
          <Text style={styles.cardTitle}>Override ATL / CTL / TSB</Text>
          <View style={styles.row}>
            <View style={styles.inputBlock}>
              <Text style={styles.label}>ATL</Text>
              <TextInput
                value={atlInput}
                onChangeText={setAtlInput}
                keyboardType="numeric"
                style={styles.input}
                placeholder="0"
                placeholderTextColor={palette.sub}
              />
            </View>
            <View style={styles.inputBlock}>
              <Text style={styles.label}>CTL</Text>
              <TextInput
                value={ctlInput}
                onChangeText={setCtlInput}
                keyboardType="numeric"
                style={styles.input}
                placeholder="0"
                placeholderTextColor={palette.sub}
              />
            </View>
            <View style={styles.inputBlock}>
              <Text style={styles.label}>TSB</Text>
              <TextInput
                value={tsbInput}
                onChangeText={setTsbInput}
                keyboardType="numeric"
                style={styles.input}
                placeholder="0"
                placeholderTextColor={palette.sub}
              />
            </View>
          </View>
          <Button label="Appliquer" onPress={applyLoad} fullWidth style={styles.button} />
        </Card>
        <Card variant="surface" style={styles.card}>
          <Text style={styles.cardTitle}>JSON</Text>
          <Text style={styles.mono}>
            {ctx ? JSON.stringify(ctx, null, 2) : "Pas de contexte disponible."}
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { color: palette.text, fontSize: 20, fontWeight: "800" },
  sub: { color: palette.sub, fontSize: 13 },
  card: {
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: { color: palette.text, fontWeight: "700", marginBottom: 8 },
  mono: { color: palette.sub, fontFamily: "Courier", fontSize: 12 },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  inputBlock: { flex: 1, gap: 4 },
  label: { color: palette.sub, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: palette.text,
    backgroundColor: palette.cardSoft,
  },
  button: {
    marginTop: 10,
  },
});
