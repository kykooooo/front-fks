// screens/CoachPlayerDetailScreen.tsx
// Fiche joueur LECTURE SEULE pour le coach (Coach Visibility v1).
// Le coach observe : aucune modification de séance possible.
// Ne montre ni données médicales détaillées, ni TSB/ATL/CTL, ni guardrails bruts.

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "../components/ui/ScreenContainer";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import {
  fetchPlayerSessionOverview,
  type ClubPlayer,
  type CoachPlayerOverview,
} from "../repositories/clubsRepo";
import {
  toCoachAdaptationLabels,
  readableIntensity,
  readableFocus,
  readableSessionStatus,
} from "../domain/coachLabels";
import { toDateKey } from "../utils/dateHelpers";
import { theme } from "../constants/theme";

const palette = theme.colors;

type DetailRoute = RouteProp<{ CoachPlayerDetail: { player: ClubPlayer } }, "CoachPlayerDetail">;

export default function CoachPlayerDetailScreen() {
  const route = useRoute<DetailRoute>();
  const player = route.params?.player;
  const uid = player?.uid ?? null;

  const [overview, setOverview] = useState<CoachPlayerOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    const data = await fetchPlayerSessionOverview(uid);
    setOverview(data);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const session = overview?.session ?? null;
  const activity = overview?.lastActivity ?? null;
  const adaptationLabels = toCoachAdaptationLabels(session?.adaptationTokens);

  return (
    <ScreenContainer>
      {/* Identité */}
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(player?.firstName ?? "?").slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{player?.firstName ?? "Joueur"}</Text>
            {player?.ageCategory ? <Badge label={player.ageCategory} tone="default" /> : null}
          </View>
          <Text style={styles.meta}>
            {[player?.position, player?.level].filter(Boolean).join(" · ") || "Profil à compléter"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : overview?.detailsUnavailable ? (
        <Card variant="soft" style={styles.emptyCard}>
          <Ionicons name="lock-closed-outline" size={26} color={palette.sub} />
          <Text style={styles.emptyTitle}>Détails indisponibles</Text>
          <Text style={styles.emptyText}>
            Les séances de ce joueur ne sont pas accessibles pour le moment.
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
                <Badge
                  label={readableSessionStatus(session.status)}
                  tone={session.status === "done" ? "ok" : "default"}
                />
              </View>
              <View style={styles.statRow}>
                <Stat icon="flag-outline" label="Type" value={readableFocus(session.focus)} />
                <Stat icon="speedometer-outline" label="Intensité" value={readableIntensity(session.intensity)} />
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

          {/* Pourquoi cette séance est adaptée */}
          {session && adaptationLabels.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Contexte pris en compte</Text>
              <Card variant="soft" style={styles.card}>
                {adaptationLabels.map((label) => (
                  <View key={label} style={styles.reasonRow}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={palette.accent} />
                    <Text style={styles.reasonText}>{label}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {/* Dernière activité */}
          <Text style={styles.sectionTitle}>Dernière activité</Text>
          {activity ? (
            <Card variant="soft" style={styles.card}>
              <View style={styles.statRow}>
                <Stat
                  icon="checkmark-done-outline"
                  label="Faite le"
                  value={activity.dateISO ? toDateKey(activity.dateISO) : "—"}
                />
                <Stat
                  icon="pulse-outline"
                  label="Ressenti (RPE)"
                  value={activity.rpe != null ? `${activity.rpe}/10` : "—"}
                />
              </View>
              <View style={styles.statRow}>
                <Stat
                  icon="time-outline"
                  label="Durée réelle"
                  value={activity.durationMin ? `${activity.durationMin} min` : "—"}
                />
                <View style={styles.stat} />
              </View>
            </Card>
          ) : (
            <Card variant="soft" style={styles.emptyCard}>
              <Ionicons name="walk-outline" size={24} color={palette.sub} />
              <Text style={styles.emptyText}>Pas encore de séance terminée.</Text>
            </Card>
          )}

          <Text style={styles.footnote}>
            Vue lecture seule. FKS construit la préparation ; tu donnes le contexte de la semaine.
          </Text>
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

const styles = StyleSheet.create({
  center: { paddingVertical: 32, alignItems: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 19, fontWeight: "800", color: palette.accent },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 20, fontWeight: "800", color: palette.text },
  meta: { fontSize: 13, color: palette.sub, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: palette.text, marginTop: 4 },
  card: { padding: 14, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: palette.text, flex: 1 },
  statRow: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, gap: 2 },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statLabel: { fontSize: 11, color: palette.sub, textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { fontSize: 15, fontWeight: "700", color: palette.text },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  reasonText: { fontSize: 14, color: palette.text, flex: 1, lineHeight: 19 },
  emptyCard: { padding: 18, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: palette.text },
  emptyText: { fontSize: 13, color: palette.sub, textAlign: "center", lineHeight: 18 },
  footnote: { fontSize: 12, color: palette.muted, fontStyle: "italic", marginTop: 8, lineHeight: 16 },
});
