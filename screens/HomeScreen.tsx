// screens/HomeScreen.tsx
// L'ACCUEIL ACTIF du joueur (HOME_FEATURES.VNEXT = false, config/homeFeatures.ts).
// Direction visuelle 17/09/2026 (SPEC_DA_ACCUEIL_SEANCE.md §2) : en-tête sobre,
// UNE carte « prochaine séance » qui fusionne CTA + badge cycle + carte
// "Prochaine séance", bande "Cette semaine", accès "Mon corps", carte
// progression et carte forme restylées, conseil du jour, historique.
//
// Aucune donnée inventée : tout vient des hooks existants (usePrimaryCta,
// useWeekDays, useWeekSummary, useActivityStreak, useMatchSoon,
// useHomeVNextViewModel, useContextualAdvice). Le comptage hebdo passe par
// useWeekSummary -> domain/resumeCanonique.ts (règle 11 du dépôt).
import React, { useMemo, useEffect, useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, AccessibilityInfo } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../components/ui/Screen";
import { useLoadStore } from "../state/stores/useLoadStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useExternalStore } from "../state/stores/useExternalStore";
import { useSyncStore } from "../state/stores/useSyncStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import { auth } from "../services/firebase";
import { DEV_FLAGS } from "../config/devFlags";
import { da, PLAFOND_TEXTE } from "../constants/daJoueur";
import { DaCard, DaNavRow } from "../components/ui/da";
import { useSettingsStore } from "../state/settingsStore";
import { resoudreObjectifHebdo } from "../domain/resumeCanonique";
import HomeHeader from "../components/home/HomeHeader";
import HomeSessionCard from "../components/home/HomeSessionCard";
import HomeWeekStrip from "../components/home/HomeWeekStrip";
import HomeReadinessHero from "../components/home/HomeReadinessHero";
import HomeProgressionCard from "../components/home/HomeProgressionCard";
import HomeAdviceCard from "../components/home/HomeAdviceCard";
import { MonCorpsHubCard } from "../components/monCorps/MonCorpsHubCard";
import { useHomeVNextViewModel } from "../hooks/home/useHomeVNextViewModel";
import { useRealLoadData } from "../hooks/home/useRealLoadData";
import { useMatchSoon } from "../hooks/home/useMatchSoon";
import { useWeekDays } from "../hooks/home/useWeekDays";
import { useWeekSummary } from "../hooks/home/useWeekSummary";
import { useActivityStreak } from "../hooks/home/useActivityStreak";
import { usePrimaryCta } from "../hooks/home/usePrimaryCta";
import { useContextualAdvice } from "../hooks/home/useContextualAdvice";
import { useNavGuard } from "../hooks/useNavGuard";
import { isSameDay, toDateKey } from "../utils/dateHelpers";
import { showToast } from "../utils/toast";
import { MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../domain/microcycles";
import { getMicrocyclePhase } from "../utils/microcycleUtils";

// Références stables pour éviter que `?? []` ne recrée un tableau à chaque rendu
const EMPTY_STRINGS: string[] = [];
const EMPTY_EXTERNALS: { source?: string; dateISO?: string }[] = [];

export default function HomeScreen() {
  if (__DEV__) console.log("[RENDER] HomeScreen");

  type RootNav = {
    navigate: (screen: string, params?: any) => void;
    setOptions?: (opts: any) => void;
  };
  const nav = useNavigation<RootNav>();

  // `Animated.Value` créées une seule fois — jamais `useRef(...).current` lu
  // pendant le rendu (règle react-hooks/refs du chantier).
  const [headerAnim] = useState(() => new Animated.Value(0));
  const [ctaAnim] = useState(() => new Animated.Value(0));
  const [cardsAnim] = useState(() => new Animated.Value(0));

  // Note : pas de headerRight "Déconnexion" ici — les headers sont cachés
  // (Tab.Navigator + AppStack "Tabs" en headerShown: false). Le logout vit dans Réglages.

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        headerAnim.setValue(1);
        ctaAnim.setValue(1);
        cardsAnim.setValue(1);
        return;
      }
      Animated.stagger(80, [
        Animated.timing(headerAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.timing(ctaAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(cardsAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    });
  }, [headerAnim, ctaAnim, cardsAnim]);

  // ── Actions (stable refs) ──
  const startFirestoreWatch = useSyncStore((s) => s.startFirestoreWatch);
  const runTestHarness = useDebugStore((s) => s.runTestHarness);

  // ── Load state ──
  const tsb = useLoadStore((s) => s.tsb);
  const devNowISO = useDebugStore((s) => s.devNowISO);
  const storeHydrated = useSyncStore((s) => s.storeHydrated ?? true);
  const dailyApplied = useLoadStore((s) => s.dailyApplied);
  const lastAppliedDate = useLoadStore((s) => s.lastAppliedDate);
  // Série TSB : UNE SEULE vérité, celle du store (écrite par rebuildLoad /
  // applyFeedback / applyExternalLoad) — plus de resimulation locale.
  const tsbHistoryRaw = useLoadStore((s) => s.tsbHistory);

  // ── Sessions & calendar ──
  const sessions = useSessionsStore((s) => s.sessions);
  const externalLoads = useExternalStore((s) => s.externalLoads ?? EMPTY_EXTERNALS);
  const clubTrainingDays = useExternalStore((s) => s.clubTrainingDays ?? EMPTY_STRINGS);
  const matchDays = useExternalStore((s) => s.matchDays ?? EMPTY_STRINGS);
  const plannedFksDays = useSyncStore((s) => s.plannedFksDays ?? EMPTY_STRINGS);
  const lastAiSessionV2 = useSessionsStore((s) => s.lastAiSessionV2);
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);

  useEffect(() => {
    if (!storeHydrated) return;
    startFirestoreWatch();
  }, [startFirestoreWatch, storeHydrated]);

  const weekStart = useSettingsStore((s) => s.weekStart);
  // MEME RESOLUTION QUE LE NOUVEL ACCUEIL (voir hooks/home/useHomeVNextViewModel.ts).
  const targetFksSessionsPerWeek = useExternalStore((s) => s.targetFksSessionsPerWeek);
  const weeklyGoalReglage = useSettingsStore((s) => s.weeklyGoal);
  const weeklyGoal =
    resoudreObjectifHebdo({ targetFksSessionsPerWeek, weeklyGoalReglage }) ?? 2;

  const nowISO = devNowISO ?? undefined;
  const hasAppliedToday =
    !!dailyApplied &&
    !!lastAppliedDate &&
    isSameDay(new Date(lastAppliedDate), nowISO ? new Date(nowISO) : new Date());

  // Le store est NEWEST-FIRST ; HomeReadinessHero attend du CHRONOLOGIQUE.
  const tsbHistoryChrono = useMemo(
    () => [...(tsbHistoryRaw ?? [])].reverse(),
    [tsbHistoryRaw]
  );

  // Prédicat "données réelles" (H1) : conditionne la carte "Ta forme" + sa courbe.
  const { hasRealLoadData, realActivityDayCount } = useRealLoadData(sessions, externalLoads);

  const matchSoon = useMatchSoon(matchDays, nowISO);

  const weekDays = useWeekDays({
    devNowISO: nowISO,
    weekStart,
    sessions,
    externalLoads,
    clubTrainingDays,
    matchDays,
    plannedFksDays,
  });

  const { primaryCta, pendingSession, viewPendingSession } = usePrimaryCta({
    nav,
    sessions,
    lastAiSessionV2,
    microcycleGoal,
    microcycleSessionIndex,
    hasAppliedToday,
    tsb,
    devNowISO: nowISO,
  });

  // Stable callbacks — protégés anti double-tap (useNavGuard, même garde que usePrimaryCta)
  const guardNav = useNavGuard();
  const goToHistory = useCallback(
    () => guardNav(() => nav.navigate("SessionHistory")),
    [nav, guardNav]
  );
  const goToFeedback = useCallback(() => {
    if (pendingSession) {
      guardNav(() => nav.navigate("Feedback", { sessionId: (pendingSession as any).id }));
    }
  }, [nav, pendingSession, guardNav]);
  const goToProgression = useCallback(
    () => guardNav(() => nav.navigate("Progression")),
    [nav, guardNav]
  );
  const goToCycleModal = useCallback(
    () => guardNav(() => nav.navigate("CycleModal", { mode: "manage", origin: "home" })),
    [nav, guardNav]
  );
  const goToProfile = useCallback(
    () => guardNav(() => nav.navigate("Profile")),
    [nav, guardNav]
  );
  const goToMonCorps = useCallback(
    () => guardNav(() => nav.navigate("MonCorps")),
    [nav, guardNav]
  );

  // Nag feedback légitime uniquement si la séance en attente date d'un jour passé.
  const todayKey = toDateKey(nowISO ? new Date(nowISO) : new Date());
  const pendingDateKey = pendingSession
    ? toDateKey((pendingSession as any).dateISO ?? (pendingSession as any).date)
    : null;
  const feedbackDue = Boolean(pendingDateKey && pendingDateKey < todayKey);

  const advice = useContextualAdvice();

  // Carte « Ta progression » : contenu TOUJOURS verbatim du ViewModel canonique
  // (seule `progression` est consommée — jamais le champ "demarrage" du VM). R7 tenu par
  // construction : le compte hebdo que ce VM connaît est celui de
  // `construireSemaineCouranteDepuisLeHome`, le MEME nombre que la bande
  // "Cette semaine" ci-dessus (compterSeancesFksSurJours — unicité verrouillée
  // par resumeCanoniqueUnicite).
  const { progression } = useHomeVNextViewModel();

  const onRunHarness = () => {
    runTestHarness?.(7);
    showToast({ type: "info", title: "Harness appliqué", message: "Charges auto + externes de test injectées sur 7 jours." });
  };

  const weekSummary = useWeekSummary({
    sessions,
    externalLoads,
    weekDays,
    weeklyGoal,
  });

  const displayName = auth.currentUser?.displayName ?? null;

  const activityStreak = useActivityStreak(sessions, externalLoads, nowISO);

  // Cycle actif — affichage dérivé (jamais session.phase = "Playlist").
  const homeCycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
  const homeCycleDone =
    Math.max(0, Math.trunc(microcycleSessionIndex ?? 0)) >= MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  const homeCyclePhase =
    homeCycleId && !homeCycleDone ? getMicrocyclePhase(microcycleSessionIndex) : null;

  const animStyle = (v: Animated.Value) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  return (
    <Screen scroll style={styles.fond} contentContainerStyle={styles.screenContainer}>
      {/* En-tête : marque + avatar, date, salutation */}
      <Animated.View style={animStyle(headerAnim)}>
        <HomeHeader
          dateISO={nowISO}
          displayName={displayName}
          kind={primaryCta.kind}
          onPressAvatar={goToProfile}
        />
      </Animated.View>

      {/* Carte « prochaine séance » — action n°1, fusion CTA + badge cycle */}
      <Animated.View style={animStyle(ctaAnim)}>
        <HomeSessionCard
          storeHydrated={storeHydrated}
          primaryCta={primaryCta}
          pendingSession={pendingSession}
          feedbackDue={feedbackDue}
          onViewPendingSession={viewPendingSession}
          onFeedback={goToFeedback}
          cycleId={homeCycleId}
          cycleDone={homeCycleDone}
          cyclePhase={homeCyclePhase}
          onManageCycle={goToCycleModal}
        />
      </Animated.View>

      {/* Cette semaine — bande des 7 jours */}
      <Animated.View style={[animStyle(ctaAnim), styles.blocSemaine]}>
        {!storeHydrated ? (
          // H4 — squelette pendant l'hydratation : pas de verdict d'usine.
          <View style={styles.skeletonSemaine} />
        ) : (
          <HomeWeekStrip
            weekDays={weekDays}
            fksCount={weekSummary.fksCount}
            weeklyGoal={weeklyGoal}
            activityStreak={activityStreak}
            matchSoon={matchSoon}
          />
        )}
      </Animated.View>

      {/* Mon corps — accès direct, variante accueil (habillage da, mêmes textes) */}
      <Animated.View style={animStyle(ctaAnim)}>
        <MonCorpsHubCard variant="accueil" onPress={goToMonCorps} />
      </Animated.View>

      {/* Ta progression — carte enrichie sur le ViewModel canonique */}
      <Animated.View style={animStyle(cardsAnim)}>
        {!storeHydrated ? (
          <View style={styles.skeletonCarte} />
        ) : (
          <DaCard style={styles.progressionCarte}>
            <View style={styles.progressionEnTete}>
              <Ionicons name="stats-chart" size={24} color={da.colors.text} />
              <Text
                style={styles.progressionTitre}
                maxFontSizeMultiplier={PLAFOND_TEXTE}
                numberOfLines={1}
              >
                Ta progression
              </Text>
            </View>
            <HomeProgressionCard vm={progression} onVoirProgression={goToProgression} />
          </DaCard>
        )}
      </Animated.View>

      {/* Ta forme — état honnête (H1/H2), courbe si assez de jours réels */}
      <Animated.View style={animStyle(cardsAnim)}>
        {!storeHydrated ? (
          <View style={styles.skeletonCarteForme} />
        ) : (
          <HomeReadinessHero
            tsb={tsb}
            tsbHistory={tsbHistoryChrono}
            hasRealLoadData={hasRealLoadData}
            realActivityDayCount={realActivityDayCount}
          />
        )}
      </Animated.View>

      {advice ? (
        <Animated.View style={animStyle(cardsAnim)}>
          <HomeAdviceCard advice={advice} />
        </Animated.View>
      ) : null}

      <Animated.View style={animStyle(cardsAnim)}>
        <DaNavRow icon="time-outline" title="Historique des séances" onPress={goToHistory} />
      </Animated.View>

      {DEV_FLAGS.ENABLED && (
        <TouchableOpacity onPress={onRunHarness} style={styles.devChip}>
          <Text style={styles.devChipText}>
            Mode test : injecter charges club/match + externes (7j)
          </Text>
        </TouchableOpacity>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fond: {
    backgroundColor: da.colors.bg,
  },
  screenContainer: {
    paddingHorizontal: da.gutter,
    paddingTop: da.spacing.xs,
    paddingBottom: da.spacing.xl,
    gap: da.spacing.md,
  },
  // Écart de 24 avant "Cette semaine" (16 de gap commun + 8 ici).
  blocSemaine: {
    marginTop: da.spacing.xxs + da.spacing.xxs,
  },
  skeletonSemaine: {
    minHeight: 108,
    borderRadius: da.radius.tile,
    backgroundColor: da.colors.disabledBg,
  },
  skeletonCarte: {
    minHeight: 140,
    borderRadius: da.radius.card,
    backgroundColor: da.colors.disabledBg,
  },
  skeletonCarteForme: {
    minHeight: 220,
    borderRadius: da.radius.card,
    backgroundColor: da.colors.disabledBg,
  },
  progressionCarte: {
    gap: da.spacing.sm,
  },
  progressionEnTete: {
    flexDirection: "row",
    alignItems: "center",
    gap: da.spacing.xs,
  },
  progressionTitre: {
    ...da.typography.bodyStrong,
    color: da.colors.text,
  },
  devChip: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: da.colors.disabledBg,
    borderWidth: 1,
    borderColor: da.colors.border,
  },
  devChipText: {
    fontSize: 11,
    color: da.colors.sub,
  },
});
