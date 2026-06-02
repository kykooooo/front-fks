// screens/CoachHomeScreen.tsx
// Espace coach minimal : nom du club, code d'invitation à partager, liste des joueurs.
// Lecture seule : le coach observe, il ne modifie ni les profils ni les séances.

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Share,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getAuth, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { ScreenContainer } from "../components/ui/ScreenContainer";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { db, auth } from "../services/firebase";
import {
  fetchClubPlayers,
  fetchPlayerSessionOverview,
  getClubWeekContext,
  saveClubWeekContext,
  setClubTeamGender,
  type ClubPlayer,
  type CoachPlayerOverview,
} from "../repositories/clubsRepo";
import {
  CLUB_TRAINING_INTENSITIES,
  CLUB_WEEK_GOALS,
  CLUB_TEAM_GENDERS,
  normalizeTeamGender,
  type ClubTrainingIntensity,
  type ClubWeekGoal,
  type ClubTeamGender,
} from "../domain/types";
import { sortCoachPlayersForDashboard } from "../domain/coachLabels";
import { weekKeyOf, toDateKey } from "../utils/dateHelpers";
import { showToast } from "../utils/toast";
import { useHaptics } from "../hooks/useHaptics";
import { theme } from "../constants/theme";

const palette = theme.colors;

const INTENSITY_LABELS: Record<ClubTrainingIntensity, string> = {
  light: "Légère",
  normal: "Normale",
  heavy: "Intense",
  very_heavy: "Très intense",
};

const GOAL_LABELS: Record<ClubWeekGoal, string> = {
  freshness: "Fraîcheur",
  prevention: "Prévention",
  speed: "Vitesse",
  strength: "Force",
  comeback: "Reprise",
};

const TEAM_GENDER_LABELS: Record<ClubTeamGender, string> = {
  female: "Féminine",
  male: "Masculine",
  mixed: "Mixte",
};

export default function CoachHomeScreen() {
  const haptics = useHaptics();
  const navigation = useNavigation<any>();
  const uid = auth.currentUser?.uid ?? null;

  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<ClubPlayer[]>([]);
  const [overviews, setOverviews] = useState<Record<string, CoachPlayerOverview>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const todayKey = toDateKey(new Date());

  // Contexte de la semaine
  const weekKey = weekKeyOf();
  const [intensity, setIntensity] = useState<ClubTrainingIntensity | null>(null);
  const [weekGoal, setWeekGoal] = useState<ClubWeekGoal | null>(null);
  const [note, setNote] = useState("");
  const [savingContext, setSavingContext] = useState(false);
  const [teamGender, setTeamGender] = useState<ClubTeamGender | null>(null);

  // Recharge les overviews joueurs (voyants). Best-effort + ISOLATION par joueur :
  // une erreur sur un joueur → "Détails indispo" pour lui seul, jamais toute la page.
  // On remplace la map d'un bloc à la fin → pas de flash "Aucune donnée" pendant le fetch.
  const loadPlayerOverviews = useCallback(async (list: ClubPlayer[]) => {
    if (list.length === 0) {
      setOverviews({});
      return;
    }
    const entries = await Promise.all(
      list.map(async (p) => {
        try {
          return [p.uid, await fetchPlayerSessionOverview(p.uid)] as const;
        } catch {
          return [p.uid, { session: null, lastActivity: null, detailsUnavailable: true }] as const;
        }
      }),
    );
    setOverviews(Object.fromEntries(entries));
  }, []);

  const load = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      const resolvedClubId = userSnap.exists() ? (userSnap.data() as any)?.clubId : null;
      if (!resolvedClubId || typeof resolvedClubId !== "string") {
        setClubId(null);
        setClubName(null);
        setInviteCode(null);
        setPlayers([]);
        setOverviews({});
        return;
      }
      setClubId(resolvedClubId);

      const clubSnap = await getDoc(doc(db, "clubs", resolvedClubId));
      if (clubSnap.exists()) {
        const data = clubSnap.data() as any;
        setClubName(typeof data?.name === "string" ? data.name : "Mon club");
        setInviteCode(typeof data?.inviteCode === "string" ? data.inviteCode : null);
        setTeamGender(normalizeTeamGender(data?.teamGender));
      }

      const list = await fetchClubPlayers(resolvedClubId);
      setPlayers(list);

      // Voyants joueurs — rechargés à chaque load() (donc aussi au pull-to-refresh),
      // même si la liste d'UIDs est identique.
      await loadPlayerOverviews(list);

      // Contexte de semaine existant (best-effort)
      try {
        const wc = await getClubWeekContext(resolvedClubId, weekKey);
        if (wc) {
          setIntensity(wc.trainingIntensity);
          setWeekGoal(wc.weekGoal);
          setNote(wc.note ?? "");
        }
      } catch (e) {
        if (__DEV__) console.warn("[CoachHome] weekContext load failed:", e);
      }
    } catch (error) {
      if (__DEV__) console.error("[CoachHome] load failed:", error);
      showToast({ type: "error", title: "Erreur", message: "Impossible de charger ton club." });
    } finally {
      setLoading(false);
    }
  }, [uid, weekKey, loadPlayerOverviews]);

  const handleSetTeamGender = useCallback(async (g: ClubTeamGender) => {
    if (!clubId) return;
    setTeamGender(g);
    try {
      await setClubTeamGender(clubId, g);
      haptics.success();
    } catch (e) {
      if (__DEV__) console.error("[CoachHome] setTeamGender failed:", e);
      showToast({ type: "error", title: "Erreur", message: "Impossible d'enregistrer le type d'équipe." });
    }
  }, [clubId, haptics]);

  const handleSaveContext = useCallback(async () => {
    if (!uid || !clubId || !intensity || !weekGoal) {
      showToast({ type: "warn", title: "Champs manquants", message: "Choisis l'intensité et l'objectif." });
      return;
    }
    setSavingContext(true);
    try {
      await saveClubWeekContext({ clubId, weekKey, uid, trainingIntensity: intensity, weekGoal, note });
      haptics.success();
      showToast({ type: "success", title: "Contexte enregistré", message: "FKS adapte la prépa de tes joueurs." });
    } catch (e) {
      if (__DEV__) console.error("[CoachHome] save weekContext failed:", e);
      haptics.error();
      showToast({ type: "error", title: "Erreur", message: "Impossible d'enregistrer le contexte." });
    } finally {
      setSavingContext(false);
    }
  }, [uid, clubId, intensity, weekGoal, note, weekKey, haptics]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(); // recharge players + overviews (même si UIDs identiques)
    setRefreshing(false);
  }, [load]);

  const handleShareCode = async () => {
    if (!inviteCode) return;
    haptics.impactLight();
    try {
      await Share.share({
        message: `Rejoins notre club sur FKS avec le code : ${inviteCode}`,
      });
    } catch {
      // L'utilisateur a annulé le partage : rien à signaler.
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
    } catch {
      showToast({ type: "error", title: "Erreur", message: "Déconnexion impossible." });
    }
  };

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      scrollProps={{
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />
        ),
      }}
    >
      {/* En-tête club */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Espace coach</Text>
          <Text style={styles.clubName}>{clubName ?? "Mon club"}</Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} hitSlop={8} accessibilityLabel="Se déconnecter">
          <Ionicons name="log-out-outline" size={24} color={palette.sub} />
        </TouchableOpacity>
      </View>

      {/* Code d'invitation */}
      <Card variant="soft" style={styles.codeCard}>
        <Text style={styles.codeLabel}>Code d'invitation</Text>
        <Text style={styles.codeValue}>{inviteCode ?? "—"}</Text>
        <Text style={styles.codeHint}>Partage ce code à tes joueurs pour qu'ils rejoignent le club.</Text>
        <Button
          label="Partager le code"
          onPress={handleShareCode}
          disabled={!inviteCode}
          fullWidth
          leftAccessory={<Ionicons name="share-outline" size={18} color="#fff" />}
        />
      </Card>

      {/* Contexte de la semaine */}
      <Card variant="soft" style={styles.contextCard}>
        <Text style={styles.sectionTitle}>Contexte de la semaine</Text>
        <Text style={styles.contextHint}>
          Tu donnes le terrain, FKS construit la prépa. Indique comment s'est passée la semaine club.
        </Text>

        <Text style={styles.fieldLabel}>Type d'équipe</Text>
        <View style={styles.chipRow}>
          {CLUB_TEAM_GENDERS.map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.chip, teamGender === v && styles.chipActive]}
              onPress={() => handleSetTeamGender(v)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, teamGender === v && styles.chipTextActive]}>{TEAM_GENDER_LABELS[v]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Intensité club</Text>
        <View style={styles.chipRow}>
          {CLUB_TRAINING_INTENSITIES.map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.chip, intensity === v && styles.chipActive]}
              onPress={() => { haptics.impactLight(); setIntensity(v); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, intensity === v && styles.chipTextActive]}>{INTENSITY_LABELS[v]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Objectif de la semaine</Text>
        <View style={styles.chipRow}>
          {CLUB_WEEK_GOALS.map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.chip, weekGoal === v && styles.chipActive]}
              onPress={() => { haptics.impactLight(); setWeekGoal(v); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, weekGoal === v && styles.chipTextActive]}>{GOAL_LABELS[v]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Note (optionnel)</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Ex: gros match dimanche, jambes lourdes"
          placeholderTextColor={palette.muted}
          value={note}
          onChangeText={setNote}
          maxLength={200}
          multiline
        />

        <Button
          label={savingContext ? "Enregistrement..." : "Enregistrer le contexte"}
          onPress={handleSaveContext}
          disabled={savingContext || !intensity || !weekGoal}
          fullWidth
        />
      </Card>

      {/* Liste joueurs */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Joueurs</Text>
        <Badge label={String(players.length)} tone="default" />
      </View>

      {players.length === 0 ? (
        <Card variant="soft" style={styles.emptyCard}>
          <Ionicons name="person-add-outline" size={28} color={palette.sub} />
          <Text style={styles.emptyTitle}>Aucun joueur pour l'instant</Text>
          <Text style={styles.emptyText}>
            Partage ton code d'invitation. Les joueurs apparaîtront ici dès qu'ils auront rejoint le club.
          </Text>
        </Card>
      ) : (
        sortCoachPlayersForDashboard(players, overviews, todayKey).map(({ player: p, status: st }) => {
          return (
            <TouchableOpacity
              key={p.uid}
              activeOpacity={0.7}
              onPress={() => { haptics.impactLight(); navigation.navigate("CoachPlayerDetail", { player: p }); }}
              accessibilityLabel={`Voir ${p.firstName ?? "le joueur"}`}
            >
              <Card variant="soft" style={styles.playerCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(p.firstName ?? "?").slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.playerNameRow}>
                    <Text style={styles.playerName}>{p.firstName ?? "Joueur"}</Text>
                    {p.ageCategory ? <Badge label={p.ageCategory} tone="default" /> : null}
                  </View>
                  <Text style={styles.playerMeta}>
                    {[p.position, p.level].filter(Boolean).join(" · ") || "Profil à compléter"}
                  </Text>
                  {/* 3 voyants max — détail complet dans CoachPlayerDetail */}
                  {st ? (
                    <View style={styles.statusRow}>
                      <Badge label={st.sessionStatusLabel} tone={st.tone} />
                      <Badge label={st.activityLabel} tone="default" />
                      {st.adaptationLabel ? <Badge label={st.adaptationLabel} tone="default" /> : null}
                    </View>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.sub} />
              </Card>
            </TouchableOpacity>
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  kicker: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clubName: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.text,
    marginTop: 2,
  },
  codeCard: {
    padding: 16,
    gap: 8,
    alignItems: "center",
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  codeValue: {
    fontSize: 28,
    fontWeight: "800",
    color: palette.text,
    letterSpacing: 3,
  },
  codeHint: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.muted,
    textAlign: "center",
    marginBottom: 4,
  },
  contextCard: {
    padding: 16,
    gap: 8,
  },
  contextHint: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.muted,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: "transparent",
  },
  chipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.sub,
  },
  chipTextActive: {
    color: palette.accent,
    fontWeight: "700",
  },
  noteInput: {
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: palette.text,
    backgroundColor: palette.card,
    minHeight: 44,
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: palette.text,
  },
  emptyCard: {
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    color: palette.sub,
    textAlign: "center",
  },
  playerCard: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "800",
    color: palette.accent,
  },
  playerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  playerName: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
  },
  playerMeta: {
    fontSize: 13,
    color: palette.sub,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  playerMutedMeta: {
    fontSize: 12,
    color: palette.muted,
    fontStyle: "italic",
    marginTop: 2,
  },
});
