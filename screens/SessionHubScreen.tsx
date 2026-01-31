// screens/SessionHubScreen.tsx
import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTrainingStore } from "../state/trainingStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { SectionHeader } from "../components/ui/SectionHeader";

const palette = theme.colors;

const TESTS_STORAGE_KEY = "fks_tests_v1";

function HubCard({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.cardPressable} onPress={onPress} activeOpacity={0.9}>
      <Card variant="surface" style={styles.card}>
        <View>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.cardCta}>→</Text>
      </Card>
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
        <SectionHeader title="Séances" />
        <Text style={styles.subtitle}>
          Choisis ce que tu veux faire aujourd’hui.
        </Text>

        {pending ? (
          <Card variant="soft" style={styles.infoCard}>
            <Text style={styles.infoText}>
              Une séance est en attente de feedback. Tu peux la compléter ou en générer une nouvelle.
            </Text>
          </Card>
        ) : null}

        {testsEmpty === true && (
          <Card variant="soft" style={styles.infoCard}>
            <Text style={styles.infoText}>
              Tu n’as pas encore de tests enregistrés. Pense à faire le protocole “Tests terrain” pour suivre tes progrès.
            </Text>
            <Button
              label="Aller aux tests"
              onPress={() => nav.navigate("Tests" as never)}
              variant="primary"
              size="sm"
              style={styles.infoButton}
            />
          </Card>
        )}

        <View style={{ gap: 12 }}>
          <HubCard
            title="Créer une séance"
            subtitle="Séance IA adaptée à ton contexte"
            onPress={() => nav.navigate("GenerateSession" as never)}
          />
          <HubCard
            title="Programmes & packs"
            subtitle="Séances prêtes à l’emploi (ex: Mobility 7 jours)"
            onPress={() => nav.navigate("PrebuiltSessions" as never)}
          />
          <HubCard
            title="Historique"
            subtitle="Consulte tes séances passées"
            onPress={() => nav.navigate("SessionHistory" as never)}
          />
          <HubCard
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
  subtitle: { color: palette.sub, fontSize: 14 },
  cardPressable: {
    borderRadius: 14,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { color: palette.text, fontSize: 16, fontWeight: "700" },
  cardSubtitle: { color: palette.sub, fontSize: 13, marginTop: 2 },
  cardCta: { color: palette.accentSoft, fontSize: 18, fontWeight: "800" },
  infoCard: {
    padding: 12,
    borderRadius: 12,
  },
  infoText: { color: palette.sub, fontSize: 13 },
  infoButton: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
});
