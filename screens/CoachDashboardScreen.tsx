import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../services/firebase";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { SectionHeader } from "../components/ui/SectionHeader";
import { showToast } from "../utils/toast";
import {
  attachUserToClub,
  createClub,
  generateInviteCode,
  normalizeInviteCode,
  setClubMembership,
} from "../repositories/clubsRepo";
import { MICROCYCLES, MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../domain/microcycles";
import { CoachTeamCalendar } from "../components/coach/CoachTeamCalendar";
import { CoachPlayerAlerts } from "../components/coach/CoachPlayerAlerts";
import { CoachTeamAnalytics } from "../components/coach/CoachTeamAnalytics";
import { CoachPlayerComparison } from "../components/coach/CoachPlayerComparison";
import { useCoachPlayersData } from "../hooks/coach/useCoachPlayersData";
import { toDateKey } from "../utils/dateHelpers";

const palette = theme.colors;

type TabId = "players" | "calendar" | "alerts" | "analytics" | "compare";
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "players", label: "Joueurs", icon: "people" },
  { id: "calendar", label: "Semaine", icon: "calendar" },
  { id: "alerts", label: "Alertes", icon: "notifications" },
  { id: "analytics", label: "Stats", icon: "stats-chart" },
  { id: "compare", label: "Comparer", icon: "git-compare" },
];

type ClubUser = {
  uid: string;
  firstName?: string | null;
  position?: string | null;
  level?: string | null;
  clubId?: string | null;
  microcycleGoal?: string | null;
  microcycleSessionIndex?: number | null;
  lastSessionDate?: string | null;
};

const formatShortDate = (value?: string | null) => {
  const key = toDateKey(value);
  if (!key) return "—";
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
};

export default function CoachDashboardScreen() {
  const nav = useNavigation<any>();
  const uid = auth.currentUser?.uid ?? null;

  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState("");
  const [clubNameRemote, setClubNameRemote] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [players, setPlayers] = useState<ClubUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("players");

  // Données enrichies pour calendrier, alertes et analytics
  const { players: enrichedPlayers, calendarData, alerts, loading: enrichedLoading } = useCoachPlayersData(clubId);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    return onSnapshot(
      ref,
      (snap) => {
        const d = snap.data() as any;
        const raw = typeof d?.clubId === "string" ? d.clubId : null;
        setClubId(raw?.trim() ? raw.trim() : null);
      },
      (err: any) => {
        setError(err?.code === "permission-denied" ? "Accès refusé (Firestore)." : "Impossible de charger ton profil.");
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!clubId) {
      setInviteCode(null);
      setClubNameRemote(null);
      return;
    }
    const ref = doc(db, "clubs", clubId);
    return onSnapshot(
      ref,
      (snap) => {
        const d = snap.data() as any;
        const rawName = typeof d?.name === "string" ? d.name : null;
        const raw = typeof d?.inviteCode === "string" ? d.inviteCode : null;
        setClubNameRemote(rawName?.trim() ? rawName.trim() : null);
        setInviteCode(raw ? normalizeInviteCode(raw) : null);
      },
      () => {
        setInviteCode(null);
        setClubNameRemote(null);
      }
    );
  }, [clubId]);

  useEffect(() => {
    if (!clubId) {
      setPlayers([]);
      return;
    }

    setError(null);
    const q = query(collection(db, "clubs", clubId, "members"), where("role", "==", "player"));
    return onSnapshot(
      q,
      async (snap) => {
        try {
          const playerUids = snap.docs
            .map((d) => String(d.id))
            .filter(Boolean)
            .filter((id) => id !== uid);

          const docs = await Promise.all(playerUids.map((id) => getDoc(doc(db, "users", id))));
          const list: ClubUser[] = docs
            .filter((d) => d.exists())
            .map((d) => {
              const data = d.data() as any;
              return {
                uid: d.id,
                firstName: typeof data?.firstName === "string" ? data.firstName : null,
                position: typeof data?.position === "string" ? data.position : null,
                level: typeof data?.level === "string" ? data.level : null,
                clubId: typeof data?.clubId === "string" ? data.clubId : null,
                microcycleGoal: typeof data?.microcycleGoal === "string" ? data.microcycleGoal : null,
                microcycleSessionIndex:
                  typeof data?.microcycleSessionIndex === "number" ? data.microcycleSessionIndex : null,
                lastSessionDate: typeof data?.lastSessionDate === "string" ? data.lastSessionDate : null,
              };
            });
          setPlayers(list);
        } catch (e: any) {
          setError(e?.code === "permission-denied" ? "Accès refusé (Firestore)." : "Impossible de charger les joueurs.");
        }
      },
      (err: any) => {
        setError(err?.code === "permission-denied" ? "Accès refusé (Firestore)." : "Impossible de charger les joueurs.");
      }
    );
  }, [clubId, uid]);

  const handleCreateClub = async () => {
    if (!uid) return;
    const name = clubName.trim();
    if (!name) {
      showToast({ type: "warn", title: "Nom du club", message: "Entre un nom de club pour générer un code." });
      return;
    }
    setCreating(true);
    try {
      const club = await createClub({ name, ownerUid: uid });
      await setClubMembership({ clubId: club.id, uid, role: "coach" });
      await attachUserToClub({ uid, clubId: club.id, role: "coach" });
      setClubName("");
    } catch (e: any) {
      showToast({ type: "error", title: "Erreur", message: e?.message ?? "Impossible de créer le club." });
    } finally {
      setCreating(false);
    }
  };

  const title = useMemo(() => {
    const name = auth.currentUser?.displayName || auth.currentUser?.email || "Coach";
    return String(name).split("@")[0];
  }, []);

  const playerStats = useMemo(() => {
    const total = players.length;
    const withCycle = players.filter((p) => isMicrocycleId(p.microcycleGoal)).length;
    const completed = players.filter((p) => {
      if (!isMicrocycleId(p.microcycleGoal)) return false;
      const idx = Math.max(0, Math.trunc(p.microcycleSessionIndex ?? 0));
      return idx >= MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
    }).length;
    return { total, withCycle, completed };
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const query = queryText.trim().toLowerCase();
    if (!query) return players;
    return players.filter((p) => (p.firstName ?? "joueur").toLowerCase().includes(query));
  }, [players, queryText]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Card variant="surface" style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Espace coach</Text>
              <Text style={styles.heroSubtitle}>Suivi club • {title}</Text>
              {clubNameRemote ? <Text style={styles.heroClub}>Club {clubNameRemote}</Text> : null}
            </View>
            <Badge
              label={
                inviteCode
                  ? `Code: ${inviteCode}`
                  : clubId
                    ? `Club: ${clubId}`
                    : "Club: non défini"
              }
              tone={clubId ? "ok" : "warn"}
            />
          </View>
          {clubId ? (
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{playerStats.total}</Text>
                <Text style={styles.heroStatLabel}>Joueurs</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{playerStats.withCycle}</Text>
                <Text style={styles.heroStatLabel}>Cycle actif</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{playerStats.completed}</Text>
                <Text style={styles.heroStatLabel}>Cycles finis</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.heroActions}>
            <Button label="Paramètres" variant="secondary" onPress={() => nav.navigate("Settings")} />
            <Button label="Profil joueur" variant="ghost" onPress={() => nav.navigate("ProfileSetup")} />
          </View>
        </Card>

        {!clubId ? (
          <Card variant="soft" style={styles.sectionCard}>
            <Text style={styles.emptyTitle}>Crée ton club</Text>
            <Text style={styles.emptySub}>
              Donne un nom, on génère un code d’invitation. Tes joueurs le rentrent dans leur profil.
            </Text>
            <TextInput
              value={clubName}
              onChangeText={setClubName}
              placeholder="Ex: FKS FC"
              placeholderTextColor={palette.sub}
              style={styles.input}
              autoCapitalize="words"
            />
            <Badge label={`Exemple: ${generateInviteCode(clubName || "FKS")}`} />
            <Button
              label={creating ? "Création..." : "Créer mon club"}
              fullWidth
              onPress={handleCreateClub}
              disabled={creating}
            />
          </Card>
        ) : (
          <>
            {/* Tabs */}
            <View style={styles.tabsRow}>
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                const alertCount = tab.id === "alerts" ? alerts.length : 0;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={[styles.tab, isActive && styles.tabActive]}
                  >
                    <Ionicons
                      name={tab.icon as any}
                      size={16}
                      color={isActive ? palette.accent : palette.sub}
                    />
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                      {tab.label}
                    </Text>
                    {alertCount > 0 && (
                      <View style={styles.tabBadge}>
                        <Text style={styles.tabBadgeText}>{alertCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tab content: Players */}
            {activeTab === "players" && (
              <View style={styles.section}>
                <SectionHeader
                  title="Joueurs du club"
                  right={
                    <Badge
                      label={
                        filteredPlayers.length === players.length
                          ? `${players.length}`
                          : `${filteredPlayers.length}/${players.length}`
                      }
                    />
                  }
                />
                <Card variant="soft" style={styles.sectionCard}>
                  <TextInput
                    value={queryText}
                    onChangeText={setQueryText}
                    placeholder="Rechercher un joueur"
                    placeholderTextColor={palette.sub}
                    style={styles.searchInput}
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  {filteredPlayers.length === 0 && !error ? (
                    <Text style={styles.emptySub}>
                      {players.length === 0
                        ? "Aucun joueur trouvé pour ce club."
                        : "Aucun résultat pour cette recherche."}
                    </Text>
                  ) : null}
                  {filteredPlayers.map((p) => {
                    const name = (p.firstName || "Joueur").trim();
                    const meta = [p.position, p.level].filter(Boolean).join(" • ");
                    const cycleId = isMicrocycleId(p.microcycleGoal) ? p.microcycleGoal : null;
                    const cycleLabel = cycleId ? MICROCYCLES[cycleId].label : "Aucun cycle";
                    const cycleProgress = cycleId
                      ? `${Math.min(
                          MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
                          Math.max(0, Math.trunc(p.microcycleSessionIndex ?? 0))
                        )}/${MICROCYCLE_TOTAL_SESSIONS_DEFAULT}`
                      : null;
                    return (
                      <Pressable
                        key={p.uid}
                        onPress={() => nav.navigate("CoachPlayerDetail", { userId: p.uid, userName: name })}
                        style={({ pressed }) => [styles.playerRow, pressed && { opacity: 0.75 }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.playerName}>{name}</Text>
                          {meta ? <Text style={styles.playerMeta}>{meta}</Text> : null}
                          <Text style={styles.playerMeta}>
                            {cycleLabel}
                            {cycleProgress ? ` · ${cycleProgress}` : ""}
                          </Text>
                          <Text style={styles.playerMeta}>
                            Dernière séance : {formatShortDate(p.lastSessionDate)}
                          </Text>
                        </View>
                        <Badge label="Voir" />
                      </Pressable>
                    );
                  })}
                </Card>
              </View>
            )}

            {/* Tab content: Calendar */}
            {activeTab === "calendar" && (
              <View style={styles.section}>
                <SectionHeader title="Calendrier équipe" />
                <CoachTeamCalendar
                  players={calendarData}
                  onPlayerPress={(playerId) => {
                    const player = players.find((p) => p.uid === playerId);
                    nav.navigate("CoachPlayerDetail", {
                      userId: playerId,
                      userName: player?.firstName ?? "Joueur",
                    });
                  }}
                />
              </View>
            )}

            {/* Tab content: Alerts */}
            {activeTab === "alerts" && (
              <View style={styles.section}>
                <SectionHeader
                  title="Alertes joueurs"
                  right={alerts.length > 0 ? <Badge label={`${alerts.length}`} tone="warn" /> : undefined}
                />
                <CoachPlayerAlerts
                  alerts={alerts}
                  onPlayerPress={(playerId) => {
                    const player = players.find((p) => p.uid === playerId);
                    nav.navigate("CoachPlayerDetail", {
                      userId: playerId,
                      userName: player?.firstName ?? "Joueur",
                    });
                  }}
                />
              </View>
            )}

            {/* Tab content: Analytics */}
            {activeTab === "analytics" && (
              <View style={styles.section}>
                <SectionHeader title="Statistiques équipe" />
                <CoachTeamAnalytics players={enrichedPlayers} />
              </View>
            )}

            {/* Tab content: Compare */}
            {activeTab === "compare" && (
              <View style={styles.section}>
                <SectionHeader title="Comparaison joueurs" />
                <CoachPlayerComparison
                  players={enrichedPlayers}
                  onPlayerPress={(playerId) => {
                    const player = players.find((p) => p.uid === playerId);
                    nav.navigate("CoachPlayerDetail", {
                      userId: playerId,
                      userName: player?.firstName ?? "Joueur",
                    });
                  }}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 16, paddingBottom: 28, gap: 14 },
  heroCard: { padding: 16, gap: 10, overflow: "hidden" },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroTitle: { fontSize: 22, fontWeight: "900", color: palette.text },
  heroSubtitle: { fontSize: 13, color: palette.sub, marginTop: 3 },
  heroClub: { fontSize: 12, color: palette.text, fontWeight: "700", marginTop: 6 },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  heroStat: { flex: 1, alignItems: "center", gap: 2 },
  heroStatValue: { color: palette.text, fontSize: 16, fontWeight: "800" },
  heroStatLabel: { color: palette.sub, fontSize: 11 },
  heroDivider: { width: 1, height: 28, backgroundColor: palette.borderSoft },
  heroActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  section: { gap: 10 },
  sectionCard: { padding: 14, gap: 10 },
  error: { color: palette.danger, fontSize: 13 },
  emptyTitle: { color: palette.text, fontWeight: "800", fontSize: 16 },
  emptySub: { color: palette.sub, fontSize: 13, lineHeight: 18 },
  searchInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    backgroundColor: palette.cardSoft,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    backgroundColor: palette.cardSoft,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  playerName: { color: palette.text, fontWeight: "800", fontSize: 14 },
  playerMeta: { color: palette.sub, fontSize: 12, marginTop: 2 },
  // Tabs styles
  tabsRow: {
    flexDirection: "row",
    backgroundColor: palette.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: palette.cardSoft,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.sub,
  },
  tabLabelActive: {
    color: palette.accent,
    fontWeight: "700",
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
});
