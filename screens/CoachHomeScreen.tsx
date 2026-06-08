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
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { getAuth, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { ScreenContainer } from "../components/ui/ScreenContainer";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { CoachBadge, coachColors, coachRadius } from "../components/coach/coachUi";
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
  formatCoachWeekLabel,
} from "../domain/coachLabels";
import { weekKeyOf, toDateKey } from "../utils/dateHelpers";
import { showToast } from "../utils/toast";
import { useHaptics } from "../hooks/useHaptics";

const palette = coachColors;

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
  const [cadreSaved, setCadreSaved] = useState(false);
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

  // Remet le cadre de la semaine à vide. Appelé quand aucun cadre n'existe pour
  // la semaine active (ou pas de club) → cohérent avec "À réactualiser chaque semaine".
  const resetWeekContextState = useCallback(() => {
    setIntensity(null);
    setWeekGoal(null);
    setNote("");
    setMatchThisWeekend(null);
    setCadreSaved(false);
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
        resetWeekContextState();
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

      // Cadre de semaine existant (best-effort). Si absent → reset explicite
      // (évite qu'un ancien cadre reste affiché après changement de semaine/club).
      try {
        const wc = await getClubWeekContext(resolvedClubId, weekKey);
        if (wc) {
          setIntensity(wc.trainingIntensity);
          setWeekGoal(wc.weekGoal);
          setNote(wc.note ?? "");
          setMatchThisWeekend(typeof wc.matchThisWeekend === "boolean" ? wc.matchThisWeekend : null);
          setCadreSaved(true);
        } else {
          resetWeekContextState();
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
  }, [uid, weekKey, loadPlayerOverviews, resetWeekContextState]);

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
      setCadreSaved(true);
      haptics.success();
      showToast({ type: "success", title: "Cadre enregistré", message: "Il s'applique aux prochaines séances générées cette semaine." });
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
      <ScreenContainer scroll={false} safeAreaStyle={styles.screenBg}>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      </ScreenContainer>
    );
  }

  const teamLabel = getTeamPlayerLabel(teamGender);
  const memberWord = teamGender === "female" ? "joueuse" : teamGender === "male" ? "joueur" : "membre";

  // État du groupe : une phrase actionnable selon la priorité (relance > prévu > rien).
  const groupState =
    summary.toRelance > 0
      ? {
          icon: "alert-circle" as const,
          color: coachColors.warn,
          tint: coachColors.warnSoft,
          text: `${summary.toRelance} ${memberWord}${summary.toRelance > 1 ? "s" : ""} à relancer aujourd'hui`,
        }
      : summary.planned > 0
        ? {
            icon: "checkmark-circle" as const,
            color: coachColors.success,
            tint: coachColors.successSoft,
            text: "Des séances sont prêtes pour le groupe",
          }
        : {
            icon: "time-outline" as const,
            color: coachColors.sub,
            tint: coachColors.cardAlt,
            text: "Aucune séance générée pour l'instant",
          };

  const statusTone = (label: string): "ok" | "warn" | "info" | "default" =>
    label === "Faite" ? "ok" : label === "À relancer" ? "warn" : label === "Prête" ? "info" : "default";

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
        <View style={styles.weekHead}>
          <Text style={styles.weekRange}>{formatCoachWeekLabel(weekKey)}</Text>
          <CoachBadge
            label={cadreSaved ? "Cadre enregistré" : "Non renseigné"}
            tone={cadreSaved ? "ok" : "default"}
          />
        </View>
        <Text style={styles.sectionTitle}>Cadre de la semaine</Text>
        <Text style={styles.weekExplain}>
          Ce cadre s'applique aux prochaines séances générées cette semaine. À réactualiser chaque semaine.
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
        <Text style={styles.fieldHint}>Info staff ajoutée au cadre.</Text>

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
          label={
            savingContext
              ? "Enregistrement..."
              : cadreSaved
                ? "Mettre à jour le cadre de la semaine"
                : "Enregistrer le cadre de la semaine"
          }
          onPress={handleSaveContext}
          disabled={savingContext || !intensity || !weekGoal}
          fullWidth
          style={styles.primaryBtn}
        />
      </Card>
    </>
  );

  // ── Onglet "Séances" : état du groupe + compteurs + liste orientée séance ──
  const renderSeances = () => (
    <>
      {/* État du groupe — phrase actionnable (priorité : relance > prévu > rien) */}
      <View style={[styles.groupCard, { borderLeftColor: groupState.color }]}>
        <View style={[styles.groupIcon, { backgroundColor: groupState.tint }]}>
          <Ionicons name={groupState.icon} size={18} color={groupState.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupHeadline}>{groupState.text}</Text>
          <Text style={styles.groupSub}>FKS garde la charge sous contrôle, tu gardes la vision.</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Séances générées</Text>
      <Text style={styles.weekExplain}>FKS génère la séance au moment où la joueuse la lance.</Text>
      <Card variant="soft" style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryStat value={summary.planned} label="Prêtes" icon="checkmark-done-outline" color={palette.accent} />
          <SummaryStat value={summary.adapted} label="Adaptées" icon="options-outline" color={palette.success} />
          <SummaryStat value={summary.toRelance} label="À relancer" icon="alert-circle-outline" color={palette.warn} />
          <SummaryStat value={summary.noData} label="Sans séance" icon="ellipse-outline" color={palette.muted} />
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
            const label = st?.sessionStatusLabel;
            const barColor =
              label === "À relancer" ? palette.warn : label === "Faite" ? palette.success : "transparent";
            return (
              <TouchableOpacity
                key={p.uid}
                style={[styles.listRow, i > 0 && styles.listRowDivider]}
                activeOpacity={0.7}
                onPress={() => { haptics.impactLight(); navigation.navigate("CoachPlayerDetail", { player: p }); }}
                accessibilityLabel={`Voir la séance de ${p.firstName ?? "ce profil"}`}
              >
                <View style={[styles.priorityBar, { backgroundColor: barColor }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <View style={styles.nameWrap}>
                      <Text style={styles.rowName} numberOfLines={1}>{p.firstName ?? "Membre"}</Text>
                      {p.position ? <CoachBadge label={p.position} tone="default" style={styles.posBadge} /> : null}
                    </View>
                    {st ? <CoachBadge label={st.sessionStatusLabel} tone={statusTone(st.sessionStatusLabel)} /> : null}
                  </View>
                  <Text style={styles.rowLine} numberOfLines={1}>{line ?? "Aucune séance générée"}</Text>
                  {reason ? (
                    <Text style={styles.noteText} numberOfLines={1}>
                      <Text style={styles.noteLabel}>Note FKS</Text>
                      {`  ·  ${reason}`}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.muted} />
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
        <CoachBadge label={String(players.length)} tone="default" />
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
                  {p.ageCategory ? <CoachBadge label={p.ageCategory} tone="default" /> : null}
                </View>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {[p.position, p.level].filter(Boolean).join(" · ") || "Profil à compléter"}
                </Text>
                {st ? (
                  <View style={styles.statusRow}>
                    <CoachBadge label={st.sessionStatusLabel} tone={statusTone(st.sessionStatusLabel)} />
                    <CoachBadge label={st.activityLabel} tone="default" />
                    {st.adaptationLabel === "Adaptée" ? <CoachBadge label="Adaptée" tone="ok" /> : null}
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
      safeAreaStyle={styles.screenBg}
      contentContainerStyle={styles.screenBg}
      scrollProps={{
        refreshControl: (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.accent} />
        ),
      }}
    >
      <StatusBar style="dark" />
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
  icon,
  color,
}: {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  // Valeur colorée seulement si > 0 — sinon atténuée (moins "dashboard froid").
  const active = value > 0;
  return (
    <View style={styles.summaryStat}>
      <Ionicons name={icon} size={15} color={active ? color : palette.muted} />
      <Text style={[styles.summaryValue, { color: active ? color : palette.muted }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const CARD = {
  backgroundColor: palette.card,
  borderColor: palette.border,
  borderRadius: coachRadius.card,
};

const styles = StyleSheet.create({
  screenBg: {
    backgroundColor: palette.bg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.bg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  clubName: {
    fontSize: 21,
    fontWeight: "800",
    color: palette.text,
    marginTop: 2,
    letterSpacing: -0.2,
  },
  // ── Segmented control (track clair, onglet actif = pastille blanche) ──
  segment: {
    flexDirection: "row",
    backgroundColor: palette.cardAlt,
    borderRadius: 10,
    padding: 4,
    gap: 4,
    marginTop: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 7,
    alignItems: "center",
  },
  segmentItemActive: {
    backgroundColor: palette.card,
    shadowColor: "#0B1220",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.sub,
  },
  segmentTextActive: {
    color: palette.text,
    fontWeight: "700",
  },
  // ── Code club compact (onglet Semaine) ──
  codeCardCompact: {
    ...CARD,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  codeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.sub,
    letterSpacing: 0.2,
  },
  codeValueCompact: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.text,
    letterSpacing: 2,
    marginTop: 3,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    borderColor: "#C9D8FA",
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
    ...CARD,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  weekHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  weekRange: {
    fontSize: 12.5,
    fontWeight: "700",
    color: palette.sub,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  weekExplain: {
    fontSize: 12.5,
    color: palette.muted,
    lineHeight: 16,
    marginTop: 2,
  },
  fieldHint: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 5,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
    letterSpacing: 0.1,
    marginTop: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: coachRadius.chip,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  chipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.sub,
  },
  chipTextActive: {
    color: palette.accent,
    fontWeight: "700",
  },
  noteInput: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: coachRadius.chip,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: palette.text,
    backgroundColor: palette.card,
    minHeight: 46,
    marginBottom: 4,
  },
  primaryBtn: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
    shadowColor: palette.accent,
    borderRadius: 10,
    marginTop: 6,
  },
  // ── État du groupe (onglet Séances) ──
  groupCard: {
    ...CARD,
    borderWidth: 1,
    borderLeftWidth: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  groupIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  groupHeadline: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.text,
    letterSpacing: -0.2,
  },
  groupSub: {
    fontSize: 12.5,
    color: palette.sub,
    marginTop: 2,
    lineHeight: 16,
  },
  // ── Compteurs (onglet Séances) ──
  summaryCard: {
    ...CARD,
    borderWidth: 1,
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
    gap: 3,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  summaryLabel: {
    fontSize: 12,
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
    fontWeight: "800",
    color: palette.text,
    letterSpacing: -0.2,
  },
  listCard: {
    ...CARD,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
  },
  rosterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 13,
  },
  listRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowName: {
    fontSize: 15.5,
    fontWeight: "700",
    color: palette.text,
    flexShrink: 1,
  },
  rowLine: {
    fontSize: 13.5,
    color: palette.sub,
    marginTop: 3,
  },
  noteText: {
    fontSize: 12.5,
    color: palette.muted,
    marginTop: 4,
  },
  noteLabel: {
    fontWeight: "700",
    color: palette.sub,
  },
  priorityBar: {
    width: 3,
    borderRadius: 2,
    alignSelf: "stretch",
    marginRight: 11,
  },
  nameWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 1,
  },
  posBadge: {
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  rowMeta: {
    fontSize: 13,
    color: palette.sub,
    marginTop: 2,
  },
  avatarSm: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSmText: {
    fontSize: 15,
    fontWeight: "800",
    color: palette.accent,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 7,
  },
  // ── Empty ──
  emptyCard: {
    ...CARD,
    borderWidth: 1,
    padding: 22,
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
