// screens/CoachPlayerDetailScreen.tsx
// Fiche joueuse LECTURE SEULE pour le coach (Coach Visibility).
// Le coach observe : aucune modification de séance possible.
//
// Coach-safe (PR-3) : lit UN SEUL résumé de la projection serveur
// (clubs/{clubId}/playerSummaries/{playerUid}). Jamais users/{uid}, jamais
// sessions/plannedSessions. Aucun RPE, aucune donnée médicale, aucun TSB/ATL/CTL.
// Les labels arrivent déjà traduits par le serveur : on les affiche tels quels.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../components/ui/ScreenContainer";
import { Card } from "../components/ui/Card";
import { CoachBadge, coachColors, coachRadius } from "../components/coach/coachUi";
import { fetchClubPlayerSummary } from "../repositories/clubsRepo";
import {
  coachSessionStatusLabel,
  nextCoachDetailView,
  EMPTY_COACH_DETAIL_VIEW,
  type CoachDetailView,
} from "../domain/coachSummary";
import { getCoachGuardrailNotes } from "../domain/coachLabels";
import { showToast } from "../utils/toast";

const palette = coachColors;

const MAX_TRUST_REASONS = 4;

type DetailRoute = RouteProp<
  { CoachPlayerDetail: { clubId: string; playerUid: string } },
  "CoachPlayerDetail"
>;

export default function CoachPlayerDetailScreen() {
  const route = useRoute<DetailRoute>();
  const navigation = useNavigation();
  const clubId = route.params?.clubId ?? null;
  const playerUid = route.params?.playerUid ?? null;

  // Header de navigation en DA claire (cohérent avec l'écran clair).
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: palette.card },
      headerTintColor: palette.text,
      headerTitleStyle: { color: palette.text },
      headerShadowVisible: false,
    });
  }, [navigation]);

  const [view, setView] = useState<CoachDetailView>(EMPTY_COACH_DETAIL_VIEW);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Jeton de la requête en cours : neutralise une réponse TARDIVE si la route a
  // changé entre le lancement du fetch et son retour (anti stale-response).
  const activeKeyRef = useRef<string | null>(null);
  // Route effectivement reflétée par `view` : on ne conserve l'ancien summary sur
  // un refresh raté que s'il correspond ENCORE au clubId/playerUid affiché.
  const committedKeyRef = useRef<string | null>(null);
  // Miroir synchrone de `view` (lecture sans capturer `view` dans les closures).
  const viewRef = useRef<CoachDetailView>(EMPTY_COACH_DETAIL_VIEW);

  // Lecture coach-safe (UN summary) + application défensive de l'état.
  // `mode` : "initial" (montage) ou "refresh" (pull-to-refresh).
  const runFetch = useCallback(
    async (mode: "initial" | "refresh") => {
      if (!clubId || !playerUid) {
        setLoading(false);
        return;
      }
      const key = `${clubId}/${playerUid}`;
      activeKeyRef.current = key;
      // JAMAIS de fallback : on ne lit QUE la projection coach-safe.
      const incoming = await fetchClubPlayerSummary(clubId, playerUid);
      // Réponse tardive : la route a changé pendant le fetch → on ignore ce résultat.
      if (activeKeyRef.current !== key) return;

      const { view: nextView, keptStale } = nextCoachDetailView(viewRef.current, incoming, {
        isRefresh: mode === "refresh",
        prevMatchesRoute: committedKeyRef.current === key,
      });
      viewRef.current = nextView;
      committedKeyRef.current = key;
      setView(nextView);
      if (mode === "initial") setLoading(false);
      if (keptStale) {
        // Refresh raté mais on garde le dernier résumé valide affiché.
        showToast({
          type: "warn",
          title: "Mise à jour impossible",
          message: "Dernières données affichées.",
        });
      }
    },
    [clubId, playerUid],
  );

  useEffect(() => {
    runFetch("initial");
  }, [runFetch]);

  // Pull-to-refresh : relit EXACTEMENT un summary (aucune lecture brute/fallback).
  // On ne repasse pas par `loading` → l'ancien contenu reste monté pendant le fetch.
  // Si la relecture échoue et qu'un summary aligné sur la route est déjà affiché,
  // `runFetch` le conserve (+ toast) au lieu de le remplacer par un état indisponible.
  const onRefresh = useCallback(async () => {
    if (!clubId || !playerUid) return;
    setRefreshing(true);
    try {
      await runFetch("refresh");
    } finally {
      setRefreshing(false);
    }
  }, [clubId, playerUid, runFetch]);

  const summary = view.summary;
  const unavailable = view.unavailable;
  const session = summary?.latestSession ?? null;
  const activity = summary?.lastActivity ?? null;
  // Labels d'adaptation DÉJÀ traduits par le serveur : on plafonne, on n'invente rien.
  const trustReasons = summary?.adaptation.labels.slice(0, MAX_TRUST_REASONS) ?? [];
  const guardrailNotes = getCoachGuardrailNotes(summary?.ageCategory);

  return (
    <ScreenContainer
      safeAreaStyle={styles.screenBg}
      contentContainerStyle={styles.screenBg}
      scrollProps={{
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />
        ),
      }}
    >
      <StatusBar style="dark" />
      {/* Identité (issue de la projection coach-safe) */}
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(summary?.firstName ?? "?").slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{summary?.firstName ?? "Joueur"}</Text>
            {summary?.ageCategory ? <CoachBadge label={summary.ageCategory} tone="default" /> : null}
          </View>
          <Text style={styles.meta}>
            {[summary?.position, summary?.level].filter(Boolean).join(" · ") || "Profil à compléter"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : unavailable || !summary ? (
        <Card variant="soft" style={styles.emptyCard}>
          <Ionicons name="lock-closed-outline" size={26} color={palette.sub} />
          <Text style={styles.emptyTitle}>Détails indisponibles</Text>
          <Text style={styles.emptyText}>
            Le résumé de ce joueur n'est pas accessible pour le moment.
          </Text>
        </Card>
      ) : (
        <>
          {/* Dernière séance FKS */}
          <Text style={styles.sectionTitle}>Dernière séance FKS</Text>
          {session ? (
            <Card variant="soft" style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{session.title ?? "Séance FKS"}</Text>
                <CoachBadge
                  label={coachSessionStatusLabel(session.status)}
                  tone={session.status === "done" ? "ok" : "info"}
                />
              </View>
              <View style={styles.statRow}>
                <Stat icon="flag-outline" label="Type" value={session.focusLabel ?? "—"} />
                <Stat icon="speedometer-outline" label="Intensité" value={session.intensityLabel ?? "—"} />
              </View>
              <View style={styles.statRow}>
                <Stat
                  icon="time-outline"
                  label="Durée"
                  value={session.durationMin ? `${session.durationMin} min` : "—"}
                />
                <Stat
                  icon="layers-outline"
                  label="Blocs"
                  value={session.blockCount != null ? String(session.blockCount) : "—"}
                />
              </View>
            </Card>
          ) : (
            <Card variant="soft" style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={24} color={palette.sub} />
              <Text style={styles.emptyText}>Aucune séance FKS pour l'instant.</Text>
            </Card>
          )}

          {/* Pourquoi cette séance — raisons en langage coach (max 4), jamais médical */}
          {session ? (
            <>
              <Text style={styles.sectionTitle}>Pourquoi cette séance</Text>
              <Card variant="soft" style={styles.card}>
                {trustReasons.length > 0 ? (
                  trustReasons.map((label) => (
                    <View key={label} style={styles.reasonRow}>
                      <Ionicons name="information-circle-outline" size={16} color={palette.accent} />
                      <Text style={styles.reasonText}>{label}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.reasonRow}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={palette.sub} />
                    <Text style={styles.reasonText}>Séance standard, aucun ajustement particulier.</Text>
                  </View>
                )}
              </Card>
            </>
          ) : null}

          {/* Dernière activité — date + durée uniquement (aucun RPE) */}
          <Text style={styles.sectionTitle}>Dernière activité</Text>
          {activity ? (
            <Card variant="soft" style={styles.card}>
              <View style={styles.statRow}>
                <Stat icon="checkmark-done-outline" label="Faite le" value={activity.dateKey ?? "—"} />
                <Stat
                  icon="time-outline"
                  label="Durée réelle"
                  value={activity.durationMin ? `${activity.durationMin} min` : "—"}
                />
              </View>
            </Card>
          ) : (
            <Card variant="soft" style={styles.emptyCard}>
              <Ionicons name="walk-outline" size={24} color={palette.sub} />
              <Text style={styles.emptyText}>Pas encore de séance terminée.</Text>
            </Card>
          )}

          {/* Garde-fous FKS — zone de confiance courte, lecture seule */}
          <Text style={styles.sectionTitle}>Garde-fous FKS</Text>
          <Card variant="soft" style={styles.card}>
            {guardrailNotes.map((note) => (
              <View key={note} style={styles.reasonRow}>
                <Ionicons name="lock-closed-outline" size={15} color={palette.sub} />
                <Text style={styles.guardrailText}>{note}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScreenContainer>
  );
}

function Stat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statLabelRow}>
        <Ionicons name={icon} size={14} color={palette.sub} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const CARD = {
  backgroundColor: palette.card,
  borderColor: palette.border,
  borderRadius: coachRadius.card,
  borderWidth: 1,
};

const styles = StyleSheet.create({
  screenBg: { backgroundColor: palette.bg },
  center: { paddingVertical: 32, alignItems: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 19, fontWeight: "800", color: palette.accent },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 21, fontWeight: "800", color: palette.text, letterSpacing: -0.2 },
  meta: { fontSize: 13.5, color: palette.sub, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: palette.text, marginTop: 4, letterSpacing: -0.2 },
  card: { ...CARD, padding: 14, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontSize: 15.5, fontWeight: "700", color: palette.text, flex: 1 },
  statRow: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, gap: 3 },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statLabel: { fontSize: 12, color: palette.sub, letterSpacing: 0.1 },
  statValue: { fontSize: 15.5, fontWeight: "700", color: palette.text },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  reasonText: { fontSize: 14, color: palette.text, flex: 1, lineHeight: 19 },
  guardrailText: { fontSize: 13.5, color: palette.sub, flex: 1, lineHeight: 18 },
  emptyCard: { ...CARD, padding: 18, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: palette.text },
  emptyText: { fontSize: 13, color: palette.sub, textAlign: "center", lineHeight: 18 },
});
