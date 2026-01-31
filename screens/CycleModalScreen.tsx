import React, { useLayoutEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../constants/theme";
import { auth, db } from "../services/firebase";
import { useTrainingStore } from "../state/trainingStore";
import {
  MICROCYCLES,
  MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
  type MicrocycleId,
  isMicrocycleId,
} from "../domain/microcycles";
import { recommendMicrocycle } from "../domain/recommendMicrocycle";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SectionHeader } from "../components/ui/SectionHeader";
import { trackEvent } from "../services/analytics";

const palette = theme.colors;

type RouteParams = {
  mode?: "select" | "manage";
  origin?: "home" | "profile" | "newSession" | "feedback";
};

const ABANDON_REASONS: Array<{ id: string; label: string }> = [
  { id: "too_hard", label: "Trop difficile" },
  { id: "too_easy", label: "Trop facile" },
  { id: "no_time", label: "Manque de temps" },
  { id: "injury", label: "Douleur / blessure" },
  { id: "goal_changed", label: "Objectif changé" },
  { id: "other", label: "Autre" },
];

const TESTS_STORAGE_KEY = "fks_tests_v1";
const TESTS_RECENCY_DAYS = 30;

const daysBetween = (fromTs: number, toTs: number) => {
  const ms = Math.max(0, toTs - fromTs);
  return Math.floor(ms / (24 * 60 * 60 * 1000));
};

function ModalCloseButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.headerClose}
      accessibilityLabel="Fermer"
      activeOpacity={0.8}
    >
      <Ionicons name="close" size={22} color={palette.text} />
    </TouchableOpacity>
  );
}

const clampInt = (value: any) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
};

export default function CycleModalScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as RouteParams;

  const microcycleGoal = useTrainingStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useTrainingStore((s) => s.microcycleSessionIndex);
  const setMicrocycleGoal = useTrainingStore((s) => s.setMicrocycleGoal);

  const activeCycleId: MicrocycleId | null = useMemo(() => {
    if (isMicrocycleId(microcycleGoal)) return microcycleGoal;
    return null;
  }, [microcycleGoal]);

  const total = MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  const completed = Math.min(total, clampInt(microcycleSessionIndex));
  const isCompleted = Boolean(activeCycleId) && completed >= total;
  const hasActiveCycle = Boolean(activeCycleId) && !isCompleted;

  const [selectedId, setSelectedId] = useState<MicrocycleId>(() => activeCycleId ?? "fondation");

  const [abandonOpen, setAbandonOpen] = useState(false);
  const [abandonReasonId, setAbandonReasonId] = useState<string>("too_hard");
  const [abandonOtherText, setAbandonOtherText] = useState("");
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [testsNudgeDismissed, setTestsNudgeDismissed] = useState(false);
  const [suppressTestsPrompt, setSuppressTestsPrompt] = useState(false);

  const [mainObjective, setMainObjective] = useState<string | null>(null);
  const [lastTestPlaylist, setLastTestPlaylist] = useState<MicrocycleId | null>(null);
  const [lastTestTs, setLastTestTs] = useState<number | null>(null);
  const [testsCount, setTestsCount] = useState<number>(0);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const uid = auth.currentUser?.uid ?? null;
        if (uid) {
          const snap = await getDoc(doc(db, "users", uid));
          const data = snap.data() as any;
          const obj = typeof data?.mainObjective === "string" ? data.mainObjective : null;
          if (alive) setMainObjective(obj?.trim() ? obj.trim() : null);
        }
      } catch {
        // best effort
      }
      try {
        const raw = await AsyncStorage.getItem(TESTS_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Array<any>;
        if (alive) setTestsCount(Array.isArray(parsed) ? parsed.length : 0);
        const latest = Array.isArray(parsed)
          ? [...parsed].sort((a, b) => Number(b?.ts ?? 0) - Number(a?.ts ?? 0))[0]
          : null;
        const latestTs = Number(latest?.ts ?? 0);
        if (alive && Number.isFinite(latestTs) && latestTs > 0) setLastTestTs(latestTs);
        const pick = latest?.playlist;
        if (alive && isMicrocycleId(pick)) setLastTestPlaylist(pick);
      } catch {
        // best effort
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const recommendation = useMemo(
    () => recommendMicrocycle({ mainObjective, lastTestPlaylist }),
    [mainObjective, lastTestPlaylist]
  );
  const recommendedId = recommendation.id;

  const testsAgeDays = useMemo(() => {
    if (!lastTestTs) return null;
    return daysBetween(lastTestTs, Date.now());
  }, [lastTestTs]);
  const testsFresh = testsAgeDays != null ? testsAgeDays <= TESTS_RECENCY_DAYS : false;
  const shouldSuggestTests = testsCount === 0 || !testsFresh;

  React.useEffect(() => {
    if (!selectionTouched && !hasActiveCycle && !isCompleted) {
      setSelectedId(recommendedId);
    }
    // only run when recommendation changes (avoid fighting user selection)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendedId, selectionTouched]);

  useLayoutEffect(() => {
    navigation.setOptions?.({
      headerStyle: { backgroundColor: palette.bg },
      headerTintColor: palette.text,
      headerTitleStyle: { color: palette.text },
      headerLeft: () => <ModalCloseButton onPress={() => navigation.goBack()} />,
    });
  }, [navigation]);

  const activeCycle = activeCycleId ? MICROCYCLES[activeCycleId] : null;

  const persistCycle = async (payload: Record<string, any>) => {
    const uid = auth.currentUser?.uid ?? null;
    if (!uid) throw new Error("Not authenticated");
    const ref = doc(db, "users", uid);
    await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  };

  const goNextAfterStart = () => {
    if (params.origin === "profile") {
      navigation.goBack();
      return;
    }
    navigation.navigate("Tabs", { screen: "NewSession" });
  };

  const startCycleNow = async () => {
    try {
      await persistCycle({
        microcycleGoal: selectedId,
        goal: selectedId,
        programGoal: selectedId,
        microcycleStatus: "active",
        microcycleTotalSessions: total,
        microcycleSessionIndex: 0,
        microcycleStartedAt: serverTimestamp(),
      });
      setMicrocycleGoal(selectedId);
      setAbandonOpen(false);
      trackEvent("cycle_selected", {
        cycleId: selectedId,
        origin: params.origin ?? "unknown",
      });
      goNextAfterStart();
    } catch {
      Alert.alert("Erreur", "Impossible d’enregistrer ton cycle. Réessaie.");
    }
  };

  const handleStartCycle = async () => {
    if (!suppressTestsPrompt && shouldSuggestTests) {
      Alert.alert(
        "Tests conseillés",
        testsCount === 0
          ? "Tu n’as pas encore fait les tests terrain. Ils aident FKS à mieux te recommander et suivre tes progrès."
          : `Tes tests datent de ${testsAgeDays} jours. Les refaire améliore la précision.`,
        [
          {
            text: "Faire mes tests",
            onPress: () =>
              navigation.navigate("Tests" as never, { initialPlaylist: selectedId } as never),
          },
          { text: "Démarrer quand même", style: "default", onPress: startCycleNow },
          { text: "Annuler", style: "cancel" },
        ]
      );
      return;
    }
    await startCycleNow();
  };

  const handleContinue = () => {
    navigation.navigate("Tabs", { screen: "NewSession" });
  };

  const handleAbandon = async () => {
    const reason =
      abandonReasonId === "other"
        ? abandonOtherText.trim() || "Autre"
        : ABANDON_REASONS.find((r) => r.id === abandonReasonId)?.label ?? "Autre";

    try {
      await persistCycle({
        microcycleGoal: null,
        goal: null,
        programGoal: null,
        microcycleStatus: "abandoned",
        microcycleSessionIndex: 0,
        microcycleAbandonedAt: serverTimestamp(),
        microcycleAbandonReason: reason,
      });
      setMicrocycleGoal(null);
      setSelectionTouched(false);
      setSelectedId(recommendedId);
      setAbandonOpen(false);
      trackEvent("cycle_abandoned", {
        cycleId: activeCycleId ?? "none",
        reason,
        origin: params.origin ?? "unknown",
      });
    } catch {
      Alert.alert("Erreur", "Impossible d’abandonner le cycle. Réessaie.");
    }
  };

  const timelineRows = useMemo(() => {
    const rows = Array.from({ length: total }).map((_, idx) => {
      const number = idx + 1;
      const status =
        completed > idx ? "done" : completed === idx && hasActiveCycle ? "current" : "next";
      return { number, status };
    });
    return rows;
  }, [completed, hasActiveCycle, total]);

  const renderTimeline = () => (
    <Card variant="soft" style={styles.timelineCard}>
      {timelineRows.map((row) => {
        const dotColor =
          row.status === "done"
            ? palette.success
            : row.status === "current"
              ? palette.accent
              : palette.borderSoft;
        const label =
          row.status === "done" ? "Terminée" : row.status === "current" ? "À faire" : "À venir";
        const labelTone = row.status === "done" ? "ok" : row.status === "current" ? "warn" : "default";
        return (
          <View key={`session_${row.number}`} style={styles.timelineRow}>
            <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
            <Text style={styles.timelineTitle}>Séance {row.number}</Text>
            <Badge label={label} tone={labelTone as any} />
          </View>
        );
      })}
    </Card>
  );

  const canCloseSelect = !hasActiveCycle;

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {hasActiveCycle ? (
          <View style={styles.section}>
            <SectionHeader
              title="Mon cycle"
              right={<Badge label={activeCycle?.label ?? "Cycle"} tone="ok" />}
            />
            <Card variant="surface" style={styles.activeCard}>
              <View style={styles.activeHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeTitle}>{activeCycle?.subtitle ?? "Cycle actif"}</Text>
                  <Text style={styles.activeSub}>
                    Progression · {completed}/{total} séances complétées
                  </Text>
                </View>
                {activeCycle ? (
                  <View style={styles.iconPill}>
                    <Ionicons name={activeCycle.icon as any} size={18} color={palette.accent} />
                  </View>
                ) : null}
              </View>

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${(completed / total) * 100}%` }]} />
              </View>

              <View style={styles.activeActions}>
                <Button label="Continuer" onPress={handleContinue} fullWidth />
                <Button
                  label="Abandonner / changer"
                  variant="ghost"
                  onPress={() => {
                    setAbandonOpen(true);
                  }}
                  fullWidth
                />
              </View>

              <Text style={styles.activeHint}>
                Le changement est volontaire : abandonne le cycle en cours avant d’en choisir un autre (rare et sérieux).
              </Text>
            </Card>

            <SectionHeader title="Séances du cycle" right={<Badge label="12" />} />
            {renderTimeline()}

            {abandonOpen ? (
              <Card variant="surface" style={styles.abandonCard}>
                <Text style={styles.abandonTitle}>Abandonner ce cycle</Text>
                <Text style={styles.abandonSub}>
                  Tu perds ta progression actuelle ({completed}/{total}). Tu pourras relancer un cycle plus tard.
                </Text>

                <View style={styles.reasonGrid}>
                  {ABANDON_REASONS.map((r) => {
                    const selected = abandonReasonId === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() => setAbandonReasonId(r.id)}
                        style={[styles.reasonChip, selected && styles.reasonChipSelected]}
                        activeOpacity={0.9}
                      >
                        <Text style={[styles.reasonChipText, selected && styles.reasonChipTextSelected]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {abandonReasonId === "other" ? (
                  <TextInput
                    value={abandonOtherText}
                    onChangeText={setAbandonOtherText}
                    placeholder="Précise (optionnel)"
                    placeholderTextColor={palette.sub}
                    style={styles.input}
                  />
                ) : null}

                <View style={styles.abandonActions}>
                  <Button
                    label="Annuler"
                    variant="secondary"
                    onPress={() => setAbandonOpen(false)}
                    fullWidth
                  />
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert(
                        "Confirmer l’abandon",
                        "Tu es sûr ? Ta progression sera remise à zéro.",
                        [
                          { text: "Annuler", style: "cancel" },
                          { text: "Abandonner", style: "destructive", onPress: handleAbandon },
                        ]
                      );
                    }}
                    style={styles.dangerButton}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.dangerButtonText}>Abandonner</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ) : null}
          </View>
        ) : (
          <View style={styles.section}>
            <SectionHeader title="Choisir un cycle" right={<Badge label={`${total} séances`} />} />

            {isCompleted ? (
              <Card variant="surface" style={styles.completedCard}>
                <View style={styles.completedHeader}>
                  <Text style={styles.completedTitle}>Cycle terminé</Text>
                  <Badge label={activeCycle?.label ?? "Cycle"} tone="ok" />
                </View>
                <Text style={styles.completedSub}>
                  Tu as validé {completed}/{total} séances. Relance un cycle pour continuer ta progression.
                </Text>
                <View style={styles.completedProgressTrack}>
                  <View style={[styles.completedProgressFill, { width: "100%" }]} />
                </View>
              </Card>
            ) : null}

            <Card variant="surface" style={styles.selectIntro}>
              <Text style={styles.selectTitle}>Ton objectif du moment</Text>
              <Text style={styles.selectSub}>
                1 cycle actif à la fois, à ton rythme. FKS te propose une recommandation selon ton objectif et tes tests.
              </Text>
            </Card>

            {shouldSuggestTests && !testsNudgeDismissed ? (
              <Card variant="soft" style={styles.testsCard}>
                <View style={styles.testsHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.testsKicker}>TESTS TERRAIN</Text>
                    <Text style={styles.testsTitle}>
                      {testsCount === 0 ? "À faire avant de commencer" : "À mettre à jour"}
                    </Text>
                    <Text style={styles.testsSub}>
                      {testsCount === 0
                        ? "Tu peux démarrer sans, mais les tests rendent le suivi plus sérieux (progrès, choix de cycle)."
                        : testsAgeDays != null
                          ? `Derniers tests : il y a ${testsAgeDays} jours.`
                          : "Tes tests méritent une mise à jour."}
                    </Text>
                  </View>
                  <View style={styles.testsIconPill}>
                    <Ionicons name="analytics-outline" size={18} color={palette.accent} />
                  </View>
                </View>
                <View style={styles.testsActions}>
                  <Button
                    label="Faire mes tests"
                    onPress={() =>
                      navigation.navigate("Tests" as never, { initialPlaylist: selectedId } as never)
                    }
                    fullWidth
                  />
                  <Button
                    label="Continuer sans tests"
                    variant="ghost"
                    onPress={() => {
                      setTestsNudgeDismissed(true);
                      setSuppressTestsPrompt(true);
                    }}
                    fullWidth
                  />
                </View>
              </Card>
            ) : null}

            <Card variant="soft" style={styles.recoCard}>
              <View style={styles.recoHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recoKicker}>RECOMMANDÉ POUR TOI</Text>
                  <Text style={styles.recoTitle}>{MICROCYCLES[recommendedId].label}</Text>
                  <Text style={styles.recoSub}>
                    {recommendation.confidence === "high"
                      ? "Recommandation forte"
                      : recommendation.confidence === "medium"
                        ? "Recommandation probable"
                        : "Recommandation indicative"}
                  </Text>
                </View>
                <View style={styles.recoIconPill}>
                  <Ionicons name="sparkles-outline" size={18} color={palette.accent} />
                </View>
              </View>
              <View style={styles.recoReasons}>
                {recommendation.reasons.slice(0, 2).map((r) => (
                  <Text key={r} style={styles.recoReasonText}>
                    • {r}
                  </Text>
                ))}
              </View>
              <Button
                label={`Sélectionner ${MICROCYCLES[recommendedId].label}`}
                variant="secondary"
                onPress={() => {
                  setSelectionTouched(true);
                  setSelectedId(recommendedId);
                }}
                fullWidth
              />
            </Card>

            <View style={styles.cycleList}>
              {(Object.keys(MICROCYCLES) as MicrocycleId[]).map((id) => {
                const item = MICROCYCLES[id];
                const selected = selectedId === id;
                const isReco = id === recommendedId;
                const locationLabels: Record<string, string> = {
                  home: "Maison",
                  pitch: "Terrain",
                  gym: "Salle",
                };
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => {
                      setSelectionTouched(true);
                      setSelectedId(id);
                    }}
                    style={[styles.cycleCard, selected && styles.cycleCardSelected]}
                    activeOpacity={0.9}
                  >
                    <View style={styles.cycleHeader}>
                      <View style={styles.cycleIcon}>
                        <Ionicons name={item.icon as any} size={18} color={selected ? palette.accent : palette.sub} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cycleLabel}>{item.label}</Text>
                        <Text style={styles.cycleSubtitle}>{item.subtitle}</Text>
                      </View>
                      {isReco && !selected ? <Badge label="Recommandé" /> : null}
                      {selected ? <Ionicons name="checkmark-circle" size={20} color={palette.accent} /> : null}
                    </View>
                    <Text style={styles.cycleDesc}>{item.description}</Text>
                    <View style={styles.locationRow}>
                      {item.allowedLocations.map((loc) => {
                        const extra = item.locationDescriptions?.[loc];
                        const label = extra ? `${locationLabels[loc]} · ${extra}` : locationLabels[loc];
                        return <Badge key={`${id}_${loc}`} label={label} />;
                      })}
                    </View>
                    <View style={styles.highlightRow}>
                      {item.highlights.slice(0, 3).map((h) => (
                        <Badge key={`${id}_${h}`} label={h} />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.selectActions}>
              <Button label="Démarrer ce cycle" onPress={handleStartCycle} fullWidth />
              {canCloseSelect ? (
                <Button label="Fermer" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
              ) : null}
            </View>

            {!canCloseSelect ? (
              <Text style={styles.footerNote}>
                Un cycle est déjà en cours. Abandonne-le d’abord pour en choisir un autre.
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 16, paddingBottom: 28, gap: 14 },
  section: { gap: 12 },
  headerClose: { paddingHorizontal: 12, paddingVertical: 8 },

  activeCard: { padding: 14, gap: 12 },
  activeHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  activeTitle: { color: palette.text, fontSize: 16, fontWeight: "900" },
  activeSub: { color: palette.sub, fontSize: 12, marginTop: 3 },
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: palette.accent,
    borderRadius: 999,
  },
  activeActions: { gap: 10 },
  activeHint: { color: palette.sub, fontSize: 12, lineHeight: 17 },

  timelineCard: { padding: 12, gap: 10 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timelineDot: { width: 10, height: 10, borderRadius: 999 },
  timelineTitle: { flex: 1, color: palette.text, fontWeight: "700", fontSize: 13 },

  abandonCard: { padding: 14, gap: 10 },
  abandonTitle: { color: palette.text, fontSize: 16, fontWeight: "900" },
  abandonSub: { color: palette.sub, fontSize: 12, lineHeight: 17 },
  reasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  reasonChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  reasonChipSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  reasonChipText: { color: palette.text, fontSize: 12, fontWeight: "600" },
  reasonChipTextSelected: { color: palette.text, fontWeight: "800" },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    backgroundColor: palette.cardSoft,
    marginTop: 6,
  },
  abandonActions: { gap: 10, marginTop: 6 },
  dangerButton: {
    width: "100%",
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.danger,
    backgroundColor: "rgba(239,68,68,0.12)",
  },
  dangerButtonText: { color: palette.danger, fontSize: 14, fontWeight: "800" },

  selectIntro: { padding: 14, gap: 6 },
  selectTitle: { color: palette.text, fontSize: 16, fontWeight: "900" },
  selectSub: { color: palette.sub, fontSize: 12, lineHeight: 17 },
  cycleList: { gap: 10 },
  cycleCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    padding: 14,
    gap: 8,
  },
  cycleCardSelected: { borderColor: palette.accent },
  cycleHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cycleIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  cycleLabel: { color: palette.text, fontSize: 15, fontWeight: "900" },
  cycleSubtitle: { color: palette.sub, fontSize: 12, marginTop: 2 },
  cycleDesc: { color: palette.sub, fontSize: 12, lineHeight: 17 },
  highlightRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  locationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },

  selectActions: { gap: 10, marginTop: 4 },
  footerNote: { color: palette.sub, fontSize: 12, lineHeight: 17, textAlign: "center" },

  recoCard: { padding: 14, gap: 10 },
  recoHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  recoKicker: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.sub,
    fontWeight: "800",
  },
  recoTitle: { marginTop: 4, fontSize: 16, fontWeight: "900", color: palette.text },
  recoSub: { marginTop: 2, fontSize: 12, color: palette.sub },
  recoIconPill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  recoReasons: { gap: 2 },
  recoReasonText: { color: palette.sub, fontSize: 12, lineHeight: 17 },

  testsCard: { padding: 14, gap: 10 },
  testsHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  testsKicker: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: palette.sub,
    fontWeight: "800",
  },
  testsTitle: { marginTop: 4, fontSize: 16, fontWeight: "900", color: palette.text },
  testsSub: { marginTop: 2, fontSize: 12, color: palette.sub, lineHeight: 17 },
  testsIconPill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  testsActions: { gap: 10, marginTop: 4 },

  completedCard: { padding: 14, gap: 8 },
  completedHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  completedTitle: { color: palette.text, fontSize: 16, fontWeight: "900" },
  completedSub: { color: palette.sub, fontSize: 12, lineHeight: 17 },
  completedProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  completedProgressFill: {
    height: "100%",
    backgroundColor: palette.success,
    borderRadius: 999,
  },
});
