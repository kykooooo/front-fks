import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { SectionHeader } from "../components/ui/SectionHeader";
import {
  attachUserToClub,
  createClub,
  generateInviteCode,
  normalizeInviteCode,
  setClubMembership,
} from "../repositories/clubsRepo";
import { MICROCYCLES, MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../domain/microcycles";

const palette = theme.colors;

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
  if (!value) return "—";
  const date = new Date(value);
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
      Alert.alert("Nom du club", "Entre un nom de club pour générer un code.");
      return;
    }
    setCreating(true);
    try {
      const club = await createClub({ name, ownerUid: uid });
      await setClubMembership({ clubId: club.id, uid, role: "coach" });
      await attachUserToClub({ uid, clubId: club.id, role: "coach" });
      setClubName("");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Impossible de créer le club.");
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
});
