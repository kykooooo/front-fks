import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import type { AppStackParamList } from "../navigation/RootNavigator";
import { db } from "../services/firebase";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { SectionHeader } from "../components/ui/SectionHeader";
import { MICROCYCLES, MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../domain/microcycles";

const palette = theme.colors;

type Route = RouteProp<AppStackParamList, "CoachPlayerDetail">;

type MinimalSession = {
  id: string;
  date?: string | null;
  focus?: string | null;
  intensity?: string | null;
  plannedLoad?: number | null;
  rpe?: number | null;
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
};

const formatSessionTitle = (s: MinimalSession) => {
  const focus = String(s.focus ?? "").trim();
  const intensity = String(s.intensity ?? "").trim();
  const parts = [focus, intensity].filter(Boolean);
  return parts.length ? parts.join(" • ") : "Séance";
};

export default function CoachPlayerDetailScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<Route>();
  const userId = route.params?.userId;
  const userName = route.params?.userName;

  const [profile, setProfile] = useState<any | null>(null);
  const [sessions, setSessions] = useState<MinimalSession[]>([]);
  const [planned, setPlanned] = useState<MinimalSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const ref = doc(db, "users", userId);
    return onSnapshot(
      ref,
      (snap) => {
        const d = snap.data() as any;
        setProfile(d ?? null);
        const title = userName || d?.firstName || "Joueur";
        nav.setOptions({ title });
      },
      (err: any) => {
        setError(err?.code === "permission-denied" ? "Accès refusé (Firestore)." : "Impossible de charger le joueur.");
      }
    );
  }, [nav, userId, userName]);

  useEffect(() => {
    if (!userId) return;
    setError(null);
    const q = query(collection(db, "users", userId, "sessions"), orderBy("date", "desc"), limit(20));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            date: typeof data?.date === "string" ? data.date : null,
            focus: typeof data?.focus === "string" ? data.focus : null,
            intensity: typeof data?.intensity === "string" ? data.intensity : null,
            plannedLoad: typeof data?.plannedLoad === "number" ? data.plannedLoad : null,
            rpe: typeof data?.rpe === "number" ? data.rpe : null,
          } satisfies MinimalSession;
        });
        setSessions(list);
      },
      (err: any) => {
        setError(err?.code === "permission-denied" ? "Accès refusé (Firestore)." : "Impossible de charger les séances.");
      }
    );
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setError(null);
    const q = query(collection(db, "users", userId, "plannedSessions"), orderBy("date", "desc"), limit(20));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            date: typeof data?.date === "string" ? data.date : null,
            focus: typeof data?.focus === "string" ? data.focus : null,
            intensity: typeof data?.intensity === "string" ? data.intensity : null,
            plannedLoad: typeof data?.plannedLoad === "number" ? data.plannedLoad : null,
            rpe: typeof data?.rpe === "number" ? data.rpe : null,
          } satisfies MinimalSession;
        });
        setPlanned(list);
      },
      (err: any) => {
        setError(err?.code === "permission-denied" ? "Accès refusé (Firestore)." : "Impossible de charger le planning.");
      }
    );
  }, [userId]);

  const headerBadges = useMemo(() => {
    const clubId = typeof profile?.clubId === "string" ? profile.clubId : null;
    const position = typeof profile?.position === "string" ? profile.position : null;
    const level = typeof profile?.level === "string" ? profile.level : null;
    return [clubId ? `Club: ${clubId}` : null, position, level].filter(Boolean) as string[];
  }, [profile]);

  const cycleId = useMemo(() => {
    const raw = typeof profile?.microcycleGoal === "string" ? profile.microcycleGoal : null;
    return isMicrocycleId(raw) ? raw : null;
  }, [profile]);
  const cycleCompleted = useMemo(() => {
    const idx = Number(profile?.microcycleSessionIndex ?? 0);
    if (!Number.isFinite(idx)) return 0;
    return Math.min(MICROCYCLE_TOTAL_SESSIONS_DEFAULT, Math.max(0, Math.trunc(idx)));
  }, [profile]);
  const cycleDone = Boolean(cycleId) && cycleCompleted >= MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  const lastSessionDate =
    typeof profile?.lastSessionDate === "string" ? profile.lastSessionDate : sessions[0]?.date ?? null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Card variant="surface" style={styles.heroCard}>
          <Text style={styles.heroTitle}>{userName || profile?.firstName || "Joueur"}</Text>
          <View style={styles.badgesRow}>
            {headerBadges.map((b) => (
              <Badge key={b} label={b} />
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Card>

        <Card variant="soft" style={styles.cycleCard}>
          <View style={styles.cycleHeader}>
            <Text style={styles.cycleTitle}>{cycleId ? MICROCYCLES[cycleId].label : "Aucun cycle actif"}</Text>
            {cycleId ? (
              <Badge label={cycleDone ? "Terminé" : `${cycleCompleted}/${MICROCYCLE_TOTAL_SESSIONS_DEFAULT}`} tone={cycleDone ? "ok" : "warn"} />
            ) : (
              <Badge label="—" />
            )}
          </View>
          <Text style={styles.cycleSub}>
            {cycleId ? "Progression du joueur sur sa playlist." : "Le joueur n’a pas encore sélectionné de cycle."}
          </Text>
          {cycleId ? (
            <View style={styles.cycleProgressTrack}>
              <View
                style={[
                  styles.cycleProgressFill,
                  { width: `${(cycleCompleted / MICROCYCLE_TOTAL_SESSIONS_DEFAULT) * 100}%` },
                ]}
              />
            </View>
          ) : null}
          <Text style={styles.cycleMeta}>Dernière séance : {formatShortDate(lastSessionDate)}</Text>
        </Card>

        <View style={styles.section}>
          <SectionHeader title="Planning" right={<Badge label={`${planned.length}`} />} />
          <Card variant="soft" style={styles.sectionCard}>
            {planned.length === 0 ? <Text style={styles.empty}>Aucune séance planifiée.</Text> : null}
            {planned.map((s) => (
              <View key={s.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{formatSessionTitle(s)}</Text>
                  <Text style={styles.itemSub}>{s.date ?? "—"}</Text>
                </View>
                {typeof s.plannedLoad === "number" ? <Badge label={`Load ${Math.round(s.plannedLoad)}`} /> : null}
              </View>
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Séances réalisées" right={<Badge label={`${sessions.length}`} />} />
          <Card variant="soft" style={styles.sectionCard}>
            {sessions.length === 0 ? <Text style={styles.empty}>Aucune séance enregistrée.</Text> : null}
            {sessions.map((s) => (
              <View key={s.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{formatSessionTitle(s)}</Text>
                  <Text style={styles.itemSub}>{s.date ?? "—"}</Text>
                </View>
                {typeof s.rpe === "number" ? <Badge label={`RPE ${Math.round(s.rpe)}`} tone="ok" /> : null}
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 16, paddingBottom: 28, gap: 14 },
  heroCard: { padding: 16, gap: 10 },
  heroTitle: { fontSize: 20, fontWeight: "900", color: palette.text },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: { color: palette.danger, fontSize: 13 },
  section: { gap: 10 },
  sectionCard: { padding: 14, gap: 10 },
  empty: { color: palette.sub, fontSize: 13 },
  cycleCard: { padding: 14, gap: 8 },
  cycleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cycleTitle: { color: palette.text, fontSize: 15, fontWeight: "800", flex: 1 },
  cycleSub: { color: palette.sub, fontSize: 12 },
  cycleProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  cycleProgressFill: {
    height: "100%",
    backgroundColor: palette.accent,
    borderRadius: 999,
  },
  cycleMeta: { color: palette.sub, fontSize: 12 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  itemTitle: { color: palette.text, fontWeight: "800", fontSize: 13 },
  itemSub: { color: palette.sub, fontSize: 12, marginTop: 2 },
});
