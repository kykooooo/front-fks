// screens/SessionHistoryScreen.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTrainingStore } from "../state/trainingStore";
import { useNavigation } from "@react-navigation/native";

const palette = {
  bg: "#050509",
  card: "#0c0e13",
  border: "#1f2430",
  text: "#f9fafb",
  sub: "#9ca3af",
  accent: "#f97316",
  accentSoft: "#fed7aa",
};

export default function SessionHistoryScreen() {
  const sessions = useTrainingStore((s) => s.sessions);
  const nav = useNavigation<any>();

  const sorted = useMemo(
    () =>
      [...sessions]
        .filter((s) => s.completed)
        .sort(
          (a, b) =>
            new Date(b.dateISO ?? (b as any).date ?? 0).getTime() -
            new Date(a.dateISO ?? (a as any).date ?? 0).getTime()
        ),
    [sessions]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Historique</Text>
        <Text style={styles.subtitle}>Tes dernières séances complétées.</Text>

        {sorted.length === 0 ? (
          <Text style={styles.sub}>Aucune séance complétée pour l’instant.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {sorted.map((s) => {
              const date = (s.dateISO ?? (s as any).date ?? "").slice(0, 10);
              const focus =
                s.focus ||
                (s as any).aiV2?.focus_primary ||
                (s as any).ai?.focus_primary ||
                (s as any).modality ||
                "—";
              const rpe = s.feedback?.rpe ?? s.rpe ?? "—";
              const dur =
                typeof s.durationMin === "number"
                  ? `${Math.round(s.durationMin)} min`
                  : typeof s.volumeScore === "number"
                  ? `${Math.round(s.volumeScore)} min`
                  : "—";
              const canPreview = !!(s as any).aiV2 || !!(s as any).ai;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={styles.row}
                  onPress={() => {
                    if (!canPreview) return;
                    const v2 = (s as any).aiV2 ?? (s as any).ai;
                    nav.navigate("SessionPreview" as never, {
                      v2,
                      plannedDateISO: date,
                      sessionId: s.id,
                    } as never);
                  }}
                  activeOpacity={canPreview ? 0.85 : 1}
                >
                  <View>
                    <Text style={styles.rowTitle}>{date}</Text>
                    <Text style={styles.rowSub}>
                      {focus} · RPE {rpe} · {dur}
                    </Text>
                    {canPreview ? (
                      <Text style={styles.rowHint}>Voir le détail →</Text>
                    ) : (
                      <Text style={styles.rowHintMuted}>Aucun détail IA</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "800", color: palette.text },
  subtitle: { color: palette.sub, fontSize: 14 },
  sub: { color: palette.sub, marginTop: 8 },
  row: {
    backgroundColor: palette.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  rowTitle: { color: palette.text, fontWeight: "700", fontSize: 14 },
  rowSub: { color: palette.sub, marginTop: 2, fontSize: 13 },
  rowHint: { color: palette.accentSoft, marginTop: 4, fontSize: 12, fontWeight: "700" },
  rowHintMuted: { color: palette.sub, marginTop: 4, fontSize: 12 },
});
