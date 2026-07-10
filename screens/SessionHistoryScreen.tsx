// screens/SessionHistoryScreen.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import { useNavigation } from "@react-navigation/native";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { SectionHeader } from "../components/ui/SectionHeader";
import { toDateKey, formatDayFR, isWithinFeedbackWindow } from "../utils/dateHelpers";
import type { Session } from "../domain/types";

const palette = theme.colors;

export default function SessionHistoryScreen() {
  const sessions = useSessionsStore((s) => s.sessions);
  const devNowISO = useDebugStore((s) => s.devNowISO);
  const nav = useNavigation<any>();

  const todayKey = toDateKey(devNowISO ? new Date(devNowISO) : new Date());

  const sorted = useMemo(
    () => {
      const toSessionDay = (session: Session) => toDateKey(session.dateISO ?? session.date);
      return [...sessions]
        // Complétées + zombies (non complétées hors fenêtre de validation) :
        // les zombies restent visibles en "Non validée", sans action possible.
        // Une séance non complétée encore dans la fenêtre vit sur le Home, pas ici.
        .filter(
          (s) =>
            s.completed || !isWithinFeedbackWindow(s.dateISO ?? s.date, todayKey)
        )
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
    [sessions, todayKey]
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
        <Text style={styles.subtitle}>
          Tes dernières séances. Les séances non validées ne comptent pas dans ta charge.
        </Text>

        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={40} color={palette.accent} />
            </View>
            <Text style={styles.emptyTitle}>Aucune séance</Text>
            <Text style={styles.emptyText}>
              Tes séances complétées apparaîtront ici.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {sorted.map((s, idx) => {
              const isZombie = !s.completed;
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
                    if (isZombie || !canPreview) return;
                    const v2 = s.aiV2 ?? s.ai;
                    nav.navigate("SessionPreview", {
                      v2,
                      plannedDateISO: date,
                      sessionId: s.id,
                    });
                  }}
                  disabled={isZombie}
                  activeOpacity={!isZombie && canPreview ? 0.85 : 1}
                  >
                    <Card variant="surface" style={[styles.row, isZombie && styles.rowZombie]}>
                      <View>
                        <View style={styles.rowTitleLine}>
                          <Text style={styles.rowTitle}>{formatDayFR(date) || date}</Text>
                          {isZombie ? (
                            <View style={styles.zombieBadge}>
                              <Text style={styles.zombieBadgeText}>Non validée</Text>
                            </View>
                          ) : null}
                        </View>
                        {isZombie ? (
                          <Text style={styles.rowSub}>
                            {focus} · sans feedback · pas comptée dans ta charge
                          </Text>
                        ) : (
                          <Text style={styles.rowSub}>
                            {focus} · RPE {rpe} · {dur}
                          </Text>
                        )}
                        {isZombie ? null : canPreview ? (
                          <Text style={styles.rowHint}>Voir le détail →</Text>
                        ) : (
                          <Text style={styles.rowHintMuted}>Aucun détail disponible</Text>
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
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
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
  rowZombie: {
    opacity: 0.6,
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zombieBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
  },
  zombieBadgeText: {
    color: palette.sub,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  rowTitle: { color: palette.text, fontWeight: "700", fontSize: 14 },
  rowSub: { color: palette.sub, marginTop: 2, fontSize: 13 },
  rowHint: { color: palette.accent, marginTop: 4, fontSize: 12, fontWeight: "700" },
  rowHintMuted: { color: palette.sub, marginTop: 4, fontSize: 12 },
});
