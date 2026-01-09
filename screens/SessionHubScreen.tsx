// screens/SessionHubScreen.tsx
import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTrainingStore } from "../state/trainingStore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const palette = {
  bg: "#050509",
  card: "#0c0e13",
  cardSoft: "#10131b",
  border: "#1f2430",
  text: "#f9fafb",
  sub: "#9ca3af",
  accent: "#f97316",
  accentSoft: "#fed7aa",
  success: "#22c55e",
};

const TESTS_STORAGE_KEY = "fks_tests_v1";

function Card({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.cardCta}>→</Text>
    </TouchableOpacity>
  );
}

export default function SessionHubScreen() {
  const nav = useNavigation<any>();
  const pending = useTrainingStore((s) => s.sessions.find((x) => !x.completed));
  const [testsEmpty, setTestsEmpty] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(TESTS_STORAGE_KEY);
          if (cancelled) return;
          if (!raw) {
            setTestsEmpty(true);
            return;
          }
          const parsed = JSON.parse(raw);
          setTestsEmpty(!Array.isArray(parsed) || parsed.length === 0);
        } catch {
          if (!cancelled) setTestsEmpty(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Séances</Text>
        <Text style={styles.subtitle}>
          Choisis ce que tu veux faire aujourd’hui.
        </Text>

        {pending ? (
          <View style={styles.info}>
            <Text style={styles.infoText}>
              Une séance est en attente de feedback. Tu peux la compléter ou en générer une nouvelle.
            </Text>
          </View>
        ) : null}

        {testsEmpty === true && (
          <View style={styles.info}>
            <Text style={styles.infoText}>
              Tu n’as pas encore de tests enregistrés. Pense à faire le protocole “Tests terrain” pour suivre tes progrès.
            </Text>
            <TouchableOpacity
              style={styles.infoButton}
              activeOpacity={0.9}
              onPress={() => nav.navigate("Tests" as never)}
            >
              <Text style={styles.infoButtonText}>Aller aux tests</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ gap: 12 }}>
          <Card
            title="Créer une séance"
            subtitle="Séance IA adaptée à ton contexte"
            onPress={() => nav.navigate("GenerateSession" as never)}
          />
          <Card
            title="Historique"
            subtitle="Consulte tes séances passées"
            onPress={() => nav.navigate("SessionHistory" as never)}
          />
          <Card
            title="Séances pré-construites"
            subtitle="Parcours les plans prêts à jouer"
            onPress={() => nav.navigate("PrebuiltSessions" as never)}
          />
      <Card
        title="Tests terrain"
        subtitle="Mesure tes qualités (sprints, sauts, circuits test)"
        onPress={() => nav.navigate("Tests" as never)}
      />
    </View>
  </ScrollView>
</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: "800", color: palette.text },
  subtitle: { color: palette.sub, fontSize: 14 },
  card: {
    backgroundColor: palette.card,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { color: palette.text, fontSize: 16, fontWeight: "700" },
  cardSubtitle: { color: palette.sub, fontSize: 13, marginTop: 2 },
  cardCta: { color: palette.accentSoft, fontSize: 18, fontWeight: "800" },
  info: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  infoText: { color: palette.sub, fontSize: 13 },
  infoButton: {
    marginTop: 8,
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  infoButtonText: { color: "#0b0f19", fontWeight: "700", fontSize: 13 },
});
