// screens/SessionHistoryScreen.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useNavigation } from "@react-navigation/native";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { SectionHeader } from "../components/ui/SectionHeader";
import { toDateKey } from "../utils/dateHelpers";
import type { Session } from "../domain/types";

const palette = theme.colors;

export default function SessionHistoryScreen() {
  const sessions = useSessionsStore((s) => s.sessions);
  const nav = useNavigation<any>();

  const sorted = useMemo(
    () => {
      const toSessionDay = (session: Session) => toDateKey(session.dateISO ?? session.date);
      return [...sessions]
        .filter((s) => s.completed)
        .sort((a, b) => {
          const da = toSessionDay(a);
          const db = toSessionDay(b);
          if (da === db) {
            const ca = new Date(a.completedAt ?? a.createdAt ?? 0).getTime();
            const cb = new Date(b.completedAt ?? b.createdAt ?? 0).getTime();
            return cb - ca;
          }
          return db.localeCompare(da);
        });
    },
    [sessions]
  );

  const animMap = useRef(new Map<string, Animated.Value>()).current;
  const animatedIds = useRef(new Set<string>()).current;

  const rowAnims = useMemo(() => {
    return sorted.map((s) => {
      if (!animMap.has(s.id)) {
        animMap.set(s.id, new Animated.Value(0));
      }
      return animMap.get(s.id)!;
    });
  }, [sorted, animMap]);

  // Stagger animation + stale key cleanup (runs when sorted changes)
  useEffect(() => {
    if (!sorted.length) return;
    const ids = new Set(sorted.map((s) => s.id));
    for (const id of animMap.keys()) {
      if (!ids.has(id)) {
        animMap.delete(id);
        animatedIds.delete(id);
      }
    }
    const newAnims = sorted
      .filter((s) => !animatedIds.has(s.id))
      .map((s) => animMap.get(s.id)!)
      .filter(Boolean);
    if (!newAnims.length) return;
    Animated.stagger(
      30,
      newAnims.map((anim) =>
        Animated.timing(anim, { toValue: 1, duration: 240, useNativeDriver: true })
      )
    ).start();
    sorted.forEach((s) => animatedIds.add(s.id));
  }, [sorted, animMap, animatedIds]);

  // Full cleanup on unmount only
  useEffect(() => {
    return () => {
      animMap.clear();
      animatedIds.clear();
    };
  }, [animMap, animatedIds]);

  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        <SectionHeader title="Historique" />
        <Text style={styles.subtitle}>Tes dernières séances complétées.</Text>

        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={palette.borderSoft} />
            <Text style={styles.emptyTitle}>Aucune séance</Text>
            <Text style={styles.emptyText}>
              Tes séances complétées apparaîtront ici.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {sorted.map((s, idx) => {
              const date = toDateKey(s.dateISO ?? s.date);
              const focus =
                s.focus ||
                ((s.aiV2?.focusPrimary ?? s.aiV2?.focus_primary ?? s.ai?.focusPrimary ?? s.ai?.focus_primary) as string | undefined) ||
                s.modality ||
                "—";
              const rpe = s.feedback?.rpe ?? s.rpe ?? "—";
              const dur =
                typeof s.durationMin === "number"
                  ? `${Math.round(s.durationMin)} min`
                  : typeof s.volumeScore === "number"
                  ? `${Math.round(s.volumeScore)} min`
                  : "—";
              const canPreview = !!s.aiV2 || !!s.ai;
              const anim = rowAnims[idx];
              return (
                <Animated.View
                  key={s.id}
                  style={{
                    opacity: anim,
                    transform: [
                      {
                        translateY: anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [20, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <TouchableOpacity
                  onPress={() => {
                    if (!canPreview) return;
                    const v2 = s.aiV2 ?? s.ai;
                    nav.navigate("SessionPreview", {
                      v2,
                      plannedDateISO: date,
                      sessionId: s.id,
                    });
                  }}
                  activeOpacity={canPreview ? 0.85 : 1}
                  >
                    <Card variant="surface" style={styles.row}>
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
                    </Card>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  subtitle: { color: palette.sub, fontSize: 14 },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    color: palette.sub,
    textAlign: "center",
  },
  row: {
    padding: 12,
  },
  rowTitle: { color: palette.text, fontWeight: "700", fontSize: 14 },
  rowSub: { color: palette.sub, marginTop: 2, fontSize: 13 },
  rowHint: { color: palette.accent, marginTop: 4, fontSize: 12, fontWeight: "700" },
  rowHintMuted: { color: palette.sub, marginTop: 4, fontSize: 12 },
});
