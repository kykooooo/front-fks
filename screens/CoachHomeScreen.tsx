// screens/CoachHomeScreen.tsx
// Espace coach minimal : nom du club, code d'invitation à partager, liste des joueurs.
// Lecture seule : le coach observe, il ne modifie ni les profils ni les séances.

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  CLUB_TEAM_GENDERS,
  normalizeTeamGender,
  type ClubTrainingIntensity,
  type ClubWeekGoal,
  type ClubTeamGender,
} from "../domain/types";
import {
  sortCoachPlayersForDashboard,
  summarizeCoachGroup,
  topCoachAdaptationLabel,
  getTeamPlayerLabel,
  readableIntensity,
} from "../domain/coachLabels";
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

// Cadre coach = 3 niveaux clairs (légère / normale / intense). `very_heavy`
// reste un état valide (rétrocompat) mais n'est pas proposé au coach.
const OFFERED_INTENSITIES: ClubTrainingIntensity[] = ["light", "normal", "heavy"];

const GOAL_LABELS: Record<ClubWeekGoal, string> = {
  freshness: "Fraîcheur",
  prevention: "Appuis & freinage",
  speed: "Vitesse contrôlée",
  strength: "Renfo terrain",
  comeback: "Reprise",
};

// Les 4 objectifs FKS proposés au coach (langage terrain). `comeback` reste
// accepté en lecture (vieux docs) mais n'est plus offert dans le cadre.
const OFFERED_WEEK_GOALS: ClubWeekGoal[] = ["freshness", "prevention", "speed", "strength"];

const TEAM_GENDER_LABELS: Record<ClubTeamGender, string> = {
  female: "Féminine",
  male: "Masculine",
  mixed: "Mixte",
};

type CoachTabKey = "semaine" | "seances" | "effectif";
const COACH_TABS: { key: CoachTabKey; label: string }[] = [
  { key: "semaine", label: "Semaine" },
  { key: "seances", label: "Séances" },
  { key: "effectif", label: "Effectif" },
];

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

  // Cadre de la semaine
  const weekKey = weekKeyOf();
  const [intensity, setIntensity] = useState<ClubTrainingIntensity | null>(null);
  const [weekGoal, setWeekGoal] = useState<ClubWeekGoal | null>(null);
  const [note, setNote] = useState("");
  const [matchThisWeekend, setMatchThisWeekend] = useState<boolean | null>(null);
  const [savingContext, setSavingContext] = useState(false);
  const [teamGender, setTeamGender] = useState<ClubTeamGender | null>(null);
  const [tab, setTab] = useState<CoachTabKey>("seances");

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
          setMatchThisWeekend(typeof wc.matchThisWeekend === "boolean" ? wc.matchThisWeekend : null);
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
      await saveClubWeekContext({ clubId, weekKey, uid, trainingIntensity: intensity, weekGoal, note, matchThisWeekend });
      haptics.success();
      showToast({ type: "success", title: "Cadre enregistré", message: "FKS s'appuie sur ce cadre pour la prépa de la semaine." });
    } catch (e) {
      if (__DEV__) console.error("[CoachHome] save weekContext failed:", e);
      haptics.error();
      showToast({ type: "error", title: "Erreur", message: "Impossible d'enregistrer le cadre." });
    } finally {
      setSavingContext(false);
    }
  }, [uid, clubId, intensity, weekGoal, note, matchThisWeekend, weekKey, haptics]);

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

  // Lignes triées (priorité actionnable) + compteurs groupe — calculés une fois.
  const rows = useMemo(
    () => sortCoachPlayersForDashboard(players, overviews, todayKey),
    [players, overviews, todayKey],
  );
  const summary = useMemo(() => summarizeCoachGroup(rows), [rows]);

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      </ScreenContainer>
    );
  }

  const teamLabel = getTeamPlayerLabel(teamGender);

  const renderEmptyRoster = () => (
    <Card variant="soft" style={styles.emptyCard}>
      <Ionicons name="person-add-outline" size={28} color={palette.sub} />
      <Text style={styles.emptyTitle}>Aucun membre pour l'instant</Text>
      <Text style={styles.emptyText}>
        Partage ton code club. Ton effectif apparaîtra ici dès la première inscription.
      </Text>
    </Card>
  );

  // ── Onglet "Semaine" : code club compact + cadre ──
  const renderSemaine = () => (
    <>
      <Card variant="soft" style={styles.codeCardCompact}>
        <View style={{ flex: 1 }}>
          <Text style={styles.codeLabel}>Code club</Text>
          <Text style={styles.codeValueCompact} numberOfLines={1}>{inviteCode ?? "—"}</Text>
        </View>
        <TouchableOpacity
          style={[styles.shareBtn, !inviteCode && styles.shareBtnDisabled]}
          onPress={handleShareCode}
          disabled={!inviteCode}
          accessibilityLabel="Partager le code"
          hitSlop={8}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={16} color={palette.accent} />
          <Text style={styles.shareBtnText}>Partager</Text>
        </TouchableOpacity>
      </Card>

      <Card variant="soft" style={styles.contextCard}>
        <Text style={styles.sectionTitle}>Cadre de la semaine</Text>

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

        <Text style={styles.fieldLabel}>Intensité club cette semaine</Text>
        <View style={styles.chipRow}>
          {OFFERED_INTENSITIES.map((v) => (
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

        <Text style={styles.fieldLabel}>Objectif FKS</Text>
        <View style={styles.chipRow}>
          {OFFERED_WEEK_GOALS.map((v) => (
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

        <Text style={styles.fieldLabel}>Match ce week-end ?</Text>
        <View style={styles.chipRow}>
          {([
            { value: true, label: "Oui" },
            { value: false, label: "Non" },
          ] as const).map(({ value, label }) => (
            <TouchableOpacity
              key={label}
              style={[styles.chip, matchThisWeekend === value && styles.chipActive]}
              onPress={() => { haptics.impactLight(); setMatchThisWeekend(value); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, matchThisWeekend === value && styles.chipTextActive]}>{label}</Text>
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
          label={savingContext ? "Enregistrement..." : "Enregistrer le cadre"}
          onPress={handleSaveContext}
          disabled={savingContext || !intensity || !weekGoal}
          fullWidth
        />
      </Card>
    </>
  );

  // ── Onglet "Séances" : compteurs + liste orientée séance (lignes compactes) ──
  const renderSeances = () => (
    <>
      <Text style={styles.sectionTitle}>Suivi des séances</Text>
      <Card variant="soft" style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryStat value={summary.planned} label="Prévues" tone="ok" />
          <SummaryStat value={summary.adapted} label="Adaptées" />
          <SummaryStat value={summary.toRelance} label="À relancer" tone={summary.toRelance > 0 ? "warn" : "default"} />
          <SummaryStat value={summary.noData} label="Sans donnée" />
        </View>
      </Card>

      {players.length === 0 ? (
        renderEmptyRoster()
      ) : (
        <Card variant="soft" style={styles.listCard}>
          {rows.map(({ player: p, status: st }, i) => {
            const sess = overviews[p.uid]?.session ?? null;
            const reason =
              st?.adaptationLabel === "Adaptée" ? topCoachAdaptationLabel(sess?.adaptationTokens) : null;
            const line = sess
              ? [
                  sess.title,
                  sess.durationMin ? `${sess.durationMin} min` : null,
                  sess.intensity ? readableIntensity(sess.intensity) : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || null
              : null;
            return (
              <TouchableOpacity
                key={p.uid}
                style={[styles.listRow, i > 0 && styles.listRowDivider]}
                activeOpacity={0.7}
                onPress={() => { haptics.impactLight(); navigation.navigate("CoachPlayerDetail", { player: p }); }}
                accessibilityLabel={`Voir la séance de ${p.firstName ?? "ce profil"}`}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowName} numberOfLines={1}>{p.firstName ?? "Membre"}</Text>
                    {st ? <Badge label={st.sessionStatusLabel} tone={st.tone} /> : null}
                  </View>
                  <Text style={styles.rowLine} numberOfLines={1}>{line ?? "Aucune séance prévue"}</Text>
                  {reason ? <Text style={styles.rowReason} numberOfLines={1}>{reason}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.sub} />
              </TouchableOpacity>
            );
          })}
        </Card>
      )}
    </>
  );

  // ── Onglet "Effectif" : roster compact (avatar réduit, lignes denses) ──
  const renderEffectif = () => (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{teamLabel}</Text>
        <Badge label={String(players.length)} tone="default" />
      </View>

      {players.length === 0 ? (
        renderEmptyRoster()
      ) : (
        <Card variant="soft" style={styles.listCard}>
          {rows.map(({ player: p, status: st }, i) => (
            <TouchableOpacity
              key={p.uid}
              style={[styles.rosterRow, i > 0 && styles.listRowDivider]}
              activeOpacity={0.7}
              onPress={() => { haptics.impactLight(); navigation.navigate("CoachPlayerDetail", { player: p }); }}
              accessibilityLabel={`Voir ${p.firstName ?? "ce profil"}`}
            >
              <View style={styles.avatarSm}>
                <Text style={styles.avatarSmText}>{(p.firstName ?? "?").slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowName} numberOfLines={1}>{p.firstName ?? "Membre"}</Text>
                  {p.ageCategory ? <Badge label={p.ageCategory} tone="default" /> : null}
                </View>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {[p.position, p.level].filter(Boolean).join(" · ") || "Profil à compléter"}
                </Text>
                {st ? (
                  <View style={styles.statusRow}>
                    <Badge label={st.sessionStatusLabel} tone={st.tone} />
                    <Badge label={st.activityLabel} tone="default" />
                    {st.adaptationLabel === "Adaptée" ? <Badge label="Adaptée" tone="default" /> : null}
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.sub} />
            </TouchableOpacity>
          ))}
        </Card>
      )}
    </>
  );

  return (
    <ScreenContainer
      scrollProps={{
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />
        ),
      }}
    >
      {/* Header club compact */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Espace coach</Text>
          <Text style={styles.clubName} numberOfLines={1}>{clubName ?? "Mon club"}</Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} hitSlop={8} accessibilityLabel="Se déconnecter">
          <Ionicons name="log-out-outline" size={22} color={palette.sub} />
        </TouchableOpacity>
      </View>

      {/* Segmented control : Semaine / Séances / Effectif */}
      <View style={styles.segment}>
        {COACH_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              onPress={() => { haptics.impactLight(); setTab(t.key); }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === "semaine" ? renderSemaine() : tab === "seances" ? renderSeances() : renderEffectif()}
    </ScreenContainer>
  );
}

function SummaryStat({
  value,
  label,
  tone = "default",
}: {
  value: number;
  label: string;
  tone?: "default" | "ok" | "warn";
}) {
  const valueColor =
    tone === "warn" && value > 0 ? palette.warn : tone === "ok" ? palette.accent : palette.text;
  return (
    <View style={styles.summaryStat}>
      <Text style={[styles.summaryValue, { color: valueColor }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
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
    fontSize: 11,
    fontWeight: "700",
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clubName: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.text,
    marginTop: 1,
  },
  // ── Segmented control ──
  segment: {
    flexDirection: "row",
    backgroundColor: palette.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 3,
    gap: 2,
    marginTop: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  segmentItemActive: {
    backgroundColor: palette.accentSoft,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.sub,
  },
  segmentTextActive: {
    color: palette.accent,
  },
  // ── Code club compact (onglet Semaine) ──
  codeCardCompact: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  codeValueCompact: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.text,
    letterSpacing: 2,
    marginTop: 2,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  shareBtnDisabled: {
    opacity: 0.4,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.accent,
  },
  // ── Cadre ──
  contextCard: {
    padding: 16,
    gap: 8,
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
  // ── Compteurs (onglet Séances) ──
  summaryCard: {
    padding: 16,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryStat: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: palette.sub,
    textAlign: "center",
  },
  // ── Listes denses (Séances / Effectif) ──
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
  listCard: {
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  rosterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  listRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.borderSoft,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
    flexShrink: 1,
  },
  rowLine: {
    fontSize: 13,
    color: palette.sub,
    marginTop: 3,
  },
  rowReason: {
    fontSize: 12,
    color: palette.accent,
    marginTop: 3,
  },
  rowMeta: {
    fontSize: 12,
    color: palette.sub,
    marginTop: 2,
  },
  avatarSm: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSmText: {
    fontSize: 14,
    fontWeight: "800",
    color: palette.accent,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  // ── Empty ──
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
});
