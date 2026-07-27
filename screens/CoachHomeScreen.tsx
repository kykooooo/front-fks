// screens/CoachHomeScreen.tsx
// Espace coach minimal : nom du club, liste des joueurs.
// Lecture seule : le coach observe, il ne modifie ni les profils ni les séances.
//
// ÉCRAN HÉRITÉ : plus monté par aucune route (navigation/CoachTabs.tsx ne charge
// que screens/coach/*). Il compile encore, donc il est maintenu au niveau du
// contrat de données — le code d'invitation en a été retiré, puisqu'il n'existe
// plus dans le document club.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
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
import { CoachBadge, coachColors, coachRadius } from "../components/coach/coachUi";
import { db, auth } from "../services/firebase";
import {
  fetchClubPlayerSummaries,
  getClubWeekContext,
  saveClubWeekContext,
  setClubTeamGender,
} from "../repositories/clubsRepo";
import {
  sortCoachSummaries,
  summarizeCoachGroup,
  coachRosterDisplay,
  buildWeeklyReportSentence,
  type CoachPlayerSummary,
} from "../domain/coachSummary";
import {
  CLUB_TEAM_GENDERS,
  normalizeTeamGender,
  type ClubTrainingIntensity,
  type ClubWeekGoal,
  type ClubTeamGender,
} from "../domain/types";
import { getTeamPlayerLabel, formatCoachWeekLabel } from "../domain/coachLabels";
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
  const [summaries, setSummaries] = useState<CoachPlayerSummary[]>([]);
  const [summariesUnavailable, setSummariesUnavailable] = useState(false);
  // Nb de membres player dont la projection n'est pas encore prête (compteur only,
  // aucun UID). Sert le bandeau "en cours de synchronisation".
  const [summariesPending, setSummariesPending] = useState(0);
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
        setSummaries([]);
        setSummariesUnavailable(false);
        setSummariesPending(0);
        resetWeekContextState();
        return;
      }
      setClubId(resolvedClubId);

      const clubSnap = await getDoc(doc(db, "clubs", resolvedClubId));
      if (clubSnap.exists()) {
        const data = clubSnap.data() as any;
        setClubName(typeof data?.name === "string" ? data.name : "Mon club");
        setTeamGender(normalizeTeamGender(data?.teamGender));
      }

      // Effectif + voyants en UNE lecture de collection coach-safe (playerSummaries).
      // Une erreur de collection → état global indisponible honnête (jamais de crash,
      // jamais de fallback vers les documents bruts).
      const res = await fetchClubPlayerSummaries(resolvedClubId);
      setSummaries(res.summaries);
      setSummariesUnavailable(res.unavailable);
      setSummariesPending(res.pendingCount);

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
      // On ne conserve JAMAIS les données d'un club précédent : vider + marquer
      // indisponible pour afficher un état global honnête (pas de faux compteurs).
      setSummaries([]);
      setSummariesUnavailable(true);
      setSummariesPending(0);
      showToast({ type: "error", title: "Erreur", message: "Impossible de charger ton club." });
    } finally {
      setLoading(false);
    }
  }, [uid, weekKey, resetWeekContextState]);

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
    await load(); // relit la collection playerSummaries (pull-to-refresh)
    setRefreshing(false);
  }, [load]);

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
    } catch {
      showToast({ type: "error", title: "Erreur", message: "Déconnexion impossible." });
    }
  };

  // Lignes triées (priorité actionnable) + compteurs groupe — calculés une fois.
  const rows = useMemo(() => sortCoachSummaries(summaries, todayKey), [summaries, todayKey]);
  const summary = useMemo(() => summarizeCoachGroup(rows), [rows]);

  if (loading) {
    return (
      <ScreenContainer scroll={false} safeAreaStyle={styles.screenBg}>
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      </ScreenContainer>
    );
  }

  const teamLabel = getTeamPlayerLabel(teamGender);
  const memberWord = teamGender === "female" ? "joueuse" : teamGender === "male" ? "joueur" : "membre";
  const memberArticle = teamGender === "female" ? "la" : "le";
  // Effectif = projections prêtes + projections en cours de synchronisation (même calcul que l'onglet Effectif).
  const rosterCount = summaries.length + summariesPending;

  // Bulletin hebdo : une phrase de synthèse (cadre + état du groupe), calculée
  // par une fonction PURE (domain/coachSummary.ts) — aucune logique ici.
  const weeklyReportText = buildWeeklyReportSentence({
    weekLabel: formatCoachWeekLabel(weekKey),
    cadreSaved,
    intensityLabel: intensity ? INTENSITY_LABELS[intensity] : null,
    weekGoalLabel: weekGoal ? GOAL_LABELS[weekGoal] : null,
    summary,
    memberWord,
  });

  const statusTone = (label: string): "ok" | "warn" | "info" | "default" =>
    label === "Faite" ? "ok" : label === "À relancer" ? "warn" : label === "Prête" ? "info" : "default";

  // Aperçu grisé (mockup, aucune donnée réelle) : montre à quoi ressemblera
  // l'écran une fois des joueurs inscrits — utile en démo à froid (0 joueur).
  const renderEmptyRoster = () => (
    <Card variant="soft" style={styles.emptyCard}>
      <Ionicons name="person-add-outline" size={28} color={palette.sub} />
      <Text style={styles.emptyTitle}>Aucun membre pour l'instant</Text>
      <Text style={styles.emptyText}>
        Partage ton code club. Ton effectif apparaîtra ici dès la première inscription.
      </Text>
      <View style={styles.previewWrap}>
        <View style={styles.previewLabelRow}>
          <Ionicons name="eye-outline" size={13} color={palette.muted} />
          <Text style={styles.previewLabel}>Aperçu — à quoi ça ressemblera</Text>
        </View>
        <View style={styles.previewRow}>
          <View style={styles.previewAvatar} />
          <View style={styles.previewLines}>
            <View style={[styles.previewBar, { width: "45%" }]} />
            <View style={[styles.previewBar, { width: "70%" }]} />
          </View>
          <View style={styles.previewBadge} />
        </View>
        <Text style={styles.previewCaption}>
          Assiduité, ressenti agrégé et alertes à relancer apparaîtront ici, joueur par joueur.
        </Text>
      </View>
    </Card>
  );

  // Lecture de collection refusée (permissions/réseau) → état global honnête.
  const renderUnavailable = () => (
    <Card variant="soft" style={styles.emptyCard}>
      <Ionicons name="cloud-offline-outline" size={28} color={palette.sub} />
      <Text style={styles.emptyTitle}>Effectif indisponible</Text>
      <Text style={styles.emptyText}>
        Impossible de charger les résumés joueurs pour le moment. Réessaie en tirant vers le bas.
      </Text>
    </Card>
  );

  // Projections pas encore prêtes (membres actifs sans summary). Bandeau NEUTRE :
  // aucun nom, aucun UID, aucun détail technique — juste un compteur rassurant.
  // Affiché seulement si des projections sont en cours ET la lecture n'a pas échoué.
  const renderPendingNotice = () => {
    if (summariesPending <= 0 || summariesUnavailable) return null;
    return (
      <Card variant="soft" style={styles.pendingCard}>
        <Ionicons name="sync-outline" size={20} color={palette.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pendingTitle}>
            {summariesPending} profil{summariesPending > 1 ? "s" : ""} en cours de synchronisation
          </Text>
          <Text style={styles.pendingText}>
            Ils apparaîtront dès que FKS aura préparé leurs données.
          </Text>
        </View>
      </Card>
    );
  };

  // ── Onglet "Semaine" : cadre de la semaine ──
  // ÉCRAN HÉRITÉ, plus monté par aucune route (navigation/CoachTabs ne charge
  // que screens/coach/*). Le bloc « code club » y a été retiré : le code n'est
  // plus stocké dans le document club, il est émis à la demande par une Cloud
  // Function et affiché une seule fois (cf. screens/coach/CoachWeekScreen).
  // Le laisser afficherait un tiret permanent avec un bouton mort.
  const renderSemaine = () => (
    <>
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
  const renderSeances = () => {
    // Lecture de collection refusée → afficher UNIQUEMENT l'état global indisponible.
    // On ne montre ni l'état du groupe ni les compteurs (qui seraient calculés à
    // zéro et donc trompeurs).
    if (summariesUnavailable) {
      return (
        <>
          <Text style={styles.sectionTitle}>Séances générées</Text>
          {renderUnavailable()}
        </>
      );
    }
    return (
    <>
      <Text style={styles.sectionTitle}>Séances générées</Text>
      <Text style={styles.weekExplain}>FKS génère la séance au moment où {memberArticle} {memberWord} la lance.</Text>
      <Card variant="soft" style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryStat value={summary.planned} label="Prêtes" icon="checkmark-done-outline" color={palette.accent} />
          <SummaryStat value={summary.adapted} label="Adaptées" icon="options-outline" color={palette.success} />
          <SummaryStat value={summary.toRelance} label="À relancer" icon="alert-circle-outline" color={palette.warn} />
          <SummaryStat value={summary.noSession} label="Sans séance" icon="ellipse-outline" color={palette.muted} />
        </View>
      </Card>

      {renderPendingNotice()}
      {coachRosterDisplay({ readyCount: summaries.length, pendingCount: summariesPending, unavailable: false }) === "empty" ? (
        renderEmptyRoster()
      ) : rows.length > 0 ? (
        <Card variant="soft" style={styles.listCard}>
          {rows.map(({ summary: p, status: st }, i) => {
            const sess = p.latestSession;
            // adaptation.labels[0] : déjà traduit serveur (jamais re-traduit ici).
            const reason = st.adaptationLabel === "Adaptée" ? p.adaptation.labels[0] ?? null : null;
            const line = sess
              ? [
                  sess.title,
                  sess.durationMin ? `${sess.durationMin} min` : null,
                  sess.intensityLabel,
                ]
                  .filter(Boolean)
                  .join(" · ") || null
              : null;
            const label = st.sessionStatusLabel;
            const barColor =
              label === "À relancer" ? palette.warn : label === "Faite" ? palette.success : "transparent";
            return (
              <TouchableOpacity
                key={p.playerUid}
                style={[styles.listRow, i > 0 && styles.listRowDivider]}
                activeOpacity={0.7}
                onPress={() => {
                  haptics.impactLight();
                  if (clubId) navigation.navigate("CoachPlayerDetail", { clubId, playerUid: p.playerUid });
                }}
                accessibilityLabel={`Voir la séance de ${p.firstName ?? "ce profil"}`}
              >
                <View style={[styles.priorityBar, { backgroundColor: barColor }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <View style={styles.nameWrap}>
                      <Text style={styles.rowName} numberOfLines={1}>{p.firstName ?? "Membre"}</Text>
                      {p.position ? <CoachBadge label={p.position} tone="default" style={styles.posBadge} /> : null}
                    </View>
                    <CoachBadge label={st.sessionStatusLabel} tone={statusTone(st.sessionStatusLabel)} />
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
      ) : null}
    </>
    );
  };

  // ── Onglet "Effectif" : roster compact (avatar réduit, lignes denses) ──
  const renderEffectif = () => {
    // Indisponible → titre + état global honnête, sans compteur d'effectif trompeur.
    if (summariesUnavailable) {
      return (
        <>
          <Text style={styles.sectionTitle}>{teamLabel}</Text>
          {renderUnavailable()}
        </>
      );
    }
    return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{teamLabel}</Text>
        <CoachBadge label={String(rosterCount)} tone="default" />
      </View>

      {renderPendingNotice()}
      {coachRosterDisplay({ readyCount: summaries.length, pendingCount: summariesPending, unavailable: false }) === "empty" ? (
        renderEmptyRoster()
      ) : rows.length > 0 ? (
        <Card variant="soft" style={styles.listCard}>
          {rows.map(({ summary: p, status: st }, i) => (
            <TouchableOpacity
              key={p.playerUid}
              style={[styles.rosterRow, i > 0 && styles.listRowDivider]}
              activeOpacity={0.7}
              onPress={() => {
                haptics.impactLight();
                if (clubId) navigation.navigate("CoachPlayerDetail", { clubId, playerUid: p.playerUid });
              }}
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
                <View style={styles.statusRow}>
                  <CoachBadge label={st.sessionStatusLabel} tone={statusTone(st.sessionStatusLabel)} />
                  <CoachBadge label={st.activityLabel} tone="default" />
                  {st.adaptationLabel === "Adaptée" ? <CoachBadge label="Adaptée" tone="ok" /> : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.sub} />
            </TouchableOpacity>
          ))}
        </Card>
      ) : null}
    </>
    );
  };

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
      {/* Header club — nom + effectif visibles en un coup d'œil, avant les onglets */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Espace coach</Text>
          <Text style={styles.clubName} numberOfLines={1}>{clubName ?? "Mon club"}</Text>
          <View style={styles.heroStatPill}>
            <Ionicons name="people" size={14} color={palette.accent} />
            <Text style={styles.heroStatText}>
              {rosterCount} {memberWord}{rosterCount > 1 ? "s" : ""}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleSignOut} hitSlop={8} accessibilityLabel="Se déconnecter">
          <Ionicons name="log-out-outline" size={22} color={palette.sub} />
        </TouchableOpacity>
      </View>

      {/* Résumé exécutif — visible avant tout onglet : lecture en 2 secondes
          pour un président de club qui découvre l'app. */}
      {!summariesUnavailable ? (
        <>
          <Card variant="soft" style={styles.kpiCard}>
            <View style={styles.summaryRow}>
              <SummaryStat value={summary.planned} label="Prêtes" icon="checkmark-done-outline" color={palette.accent} />
              <SummaryStat value={summary.toRelance} label="À relancer" icon="alert-circle-outline" color={palette.warn} />
              <SummaryStat value={rosterCount} label="Effectif" icon="people-outline" color={palette.text} />
            </View>
          </Card>

          <View style={styles.reportCard}>
            <Text style={styles.reportKicker}>BULLETIN DE LA SEMAINE</Text>
            <Text style={styles.reportText}>{weeklyReportText}</Text>
          </View>
        </>
      ) : null}

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

      {/* Accès légal + suppression de compte — invisible ailleurs dans l'espace
          coach (pas de tab bar, pas d'écran Paramètres coach dédié pour l'instant). */}
      <View style={styles.legalFooter}>
        <TouchableOpacity
          onPress={() => { haptics.impactLight(); navigation.navigate("LegalNotice"); }}
          hitSlop={8}
          accessibilityLabel="Mentions légales"
        >
          <Text style={styles.legalLink}>Mentions légales</Text>
        </TouchableOpacity>
        <Text style={styles.legalDot}>·</Text>
        <TouchableOpacity
          onPress={() => { haptics.impactLight(); navigation.navigate("PrivacyPolicy"); }}
          hitSlop={8}
          accessibilityLabel="Politique de confidentialité"
        >
          <Text style={styles.legalLink}>Confidentialité</Text>
        </TouchableOpacity>
        <Text style={styles.legalDot}>·</Text>
        <TouchableOpacity
          onPress={() => { haptics.impactLight(); navigation.navigate("DeleteAccount"); }}
          hitSlop={8}
          accessibilityLabel="Supprimer mon compte"
        >
          <Text style={[styles.legalLink, styles.legalLinkDanger]}>Supprimer mon compte</Text>
        </TouchableOpacity>
      </View>
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
  heroStatPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: coachRadius.pill,
    backgroundColor: palette.accentSoft,
  },
  heroStatText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.accent,
  },
  // ── Résumé exécutif (KPI + bulletin hebdo, avant les onglets) ──
  kpiCard: {
    ...CARD,
    borderWidth: 1,
    padding: 16,
    marginTop: 4,
  },
  reportCard: {
    ...CARD,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  reportKicker: {
    fontSize: 10.5,
    fontWeight: "800",
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  reportText: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.text,
    lineHeight: 20,
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
  // ── Aperçu mockup dans l'empty state (grisé, jamais de vraie donnée) ──
  previewWrap: {
    marginTop: 6,
    width: "100%",
    borderRadius: coachRadius.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardAlt,
    padding: 12,
    gap: 10,
  },
  previewLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    opacity: 0.55,
  },
  previewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.border,
  },
  previewLines: {
    flex: 1,
    gap: 6,
  },
  previewBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.border,
  },
  previewBadge: {
    width: 46,
    height: 20,
    borderRadius: 6,
    backgroundColor: palette.border,
  },
  previewCaption: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.sub,
    textAlign: "left",
  },
  // ── Pied de page : accès légal + suppression de compte ──
  legalFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingBottom: 8,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.sub,
  },
  legalLinkDanger: {
    color: palette.danger,
  },
  legalDot: {
    fontSize: 12,
    color: palette.muted,
  },
  // ── Bandeau "projections en cours de synchronisation" (neutre, sans UID) ──
  pendingCard: {
    ...CARD,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 10,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.text,
  },
  pendingText: {
    fontSize: 12.5,
    color: palette.sub,
    marginTop: 2,
    lineHeight: 16,
  },
});
