import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../constants/theme";
import { auth, db } from "../services/firebase";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import {
  MICROCYCLES,
  MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
  CYCLE_PATHWAYS,
  suggestNextCycle,
  type MicrocycleId,
  type CyclePathway,
  isMicrocycleId,
} from "../domain/microcycles";
import { recommendMicrocycle } from "../domain/recommendMicrocycle";
import { Badge } from "../components/ui/Badge";
import { showToast } from "../utils/toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SectionHeader } from "../components/ui/SectionHeader";
import { trackEvent } from "../services/analytics";
import { ModalContainer } from "../components/modal/ModalContainer";

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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as RouteParams;

  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);
  const setMicrocycleGoal = useSessionsStore((s) => s.setMicrocycleGoal);
  const setActivePathway = useSessionsStore((s) => s.setActivePathway);

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
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [abandonReasonId, setAbandonReasonId] = useState<string>("too_hard");
  const [abandonOtherText, setAbandonOtherText] = useState("");
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [pendingPathway, setPendingPathway] = useState<{ id: string; index: number } | null>(null);
  const [testsNudgeDismissed, setTestsNudgeDismissed] = useState(false);
  const [suppressTestsPrompt, setSuppressTestsPrompt] = useState(false);
  const [showTestsPrompt, setShowTestsPrompt] = useState(false);

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
      const cyclePayload: Record<string, any> = {
        microcycleGoal: selectedId,
        goal: selectedId,
        programGoal: selectedId,
        microcycleStatus: "active",
        microcycleTotalSessions: total,
        microcycleSessionIndex: 0,
        microcycleStartedAt: serverTimestamp(),
      };

      // Persist pathway info
      if (pendingPathway) {
        cyclePayload.activePathwayId = pendingPathway.id;
        cyclePayload.activePathwayIndex = pendingPathway.index;
      } else {
        cyclePayload.activePathwayId = null;
        cyclePayload.activePathwayIndex = 0;
      }

      await persistCycle(cyclePayload);
      setMicrocycleGoal(selectedId);

      if (pendingPathway) {
        setActivePathway(pendingPathway.id, pendingPathway.index);
      } else {
        setActivePathway(null);
      }

      setAbandonOpen(false);
      trackEvent("cycle_selected", {
        cycleId: selectedId,
        pathway: pendingPathway?.id ?? "none",
        origin: params.origin ?? "unknown",
      });
      goNextAfterStart();
    } catch {
      showToast({ type: "error", title: "Erreur", message: "Impossible d'enregistrer ton programme. Réessaie." });
    }
  };

  const handleStartCycle = async () => {
    if (!suppressTestsPrompt && shouldSuggestTests) {
      setShowTestsPrompt(true);
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
        activePathwayId: null,
        activePathwayIndex: 0,
      });
      setMicrocycleGoal(null);
      setActivePathway(null);
      setSelectionTouched(false);
      setSelectedId(recommendedId);
      setAbandonOpen(false);
      trackEvent("cycle_abandoned", {
        cycleId: activeCycleId ?? "none",
        reason,
        origin: params.origin ?? "unknown",
      });
    } catch {
      showToast({ type: "error", title: "Erreur", message: "Impossible d'abandonner le programme. Réessaie." });
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

  const selectedCycle = MICROCYCLES[selectedId];
  const confidenceLabel =
    recommendation.confidence === "high"
      ? "On te le conseille"
      : recommendation.confidence === "medium"
        ? "Bonne option"
        : "Suggestion";

  const locationLabels: Record<string, string> = {
    home: "Maison",
    pitch: "Terrain",
    gym: "Salle",
  };

  return (
    <View style={styles.modalRoot}>
      <ModalContainer
        visible
        onClose={() => navigation.goBack()}
        animationType="slide"
        blurIntensity={40}
        allowBackdropDismiss
        allowSwipeDismiss
      >
        <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
          <View style={[styles.modalHeaderRow, { paddingTop: insets.top }]}>
            <Text style={styles.modalHeaderTitle}>Programme</Text>
            <ModalCloseButton onPress={() => navigation.goBack()} />
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {hasActiveCycle ? (
                  <View style={styles.section}>
                    <SectionHeader
                      title="Mon programme"
                      right={<Badge label={activeCycle?.label ?? "Programme"} tone="ok" />}
                    />
                    <Card variant="surface" style={styles.activeCard}>
                      <View style={styles.activeHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.activeTitle}>{activeCycle?.subtitle ?? "Programme actif"}</Text>
                          <Text style={styles.activeSub}>
                            {completed}/{total} séances complétées
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
                        <Button label="Continuer ma séance" onPress={handleContinue} fullWidth />
                        <Button
                          label="Changer de programme"
                          variant="ghost"
                          onPress={() => setAbandonOpen(true)}
                          fullWidth
                        />
                      </View>
                    </Card>

                    <SectionHeader title="Séances du programme" right={<Badge label="12" />} />
                    {renderTimeline()}

                    {abandonOpen ? (
                      <Card variant="surface" style={styles.abandonCard}>
                        <Text style={styles.abandonTitle}>Abandonner ce programme</Text>
                        <Text style={styles.abandonSub}>
                          Ta progression ({completed}/{total}) sera remise à zéro.
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
                            onPress={() => { setAbandonOpen(false); setConfirmAbandon(false); }}
                            fullWidth
                          />
                          {confirmAbandon ? (
                            <View style={styles.confirmBox}>
                              <Text style={styles.confirmText}>
                                Tu es sûr ? Ta progression sera remise à zéro.
                              </Text>
                              <View style={styles.confirmActions}>
                                <Button
                                  label="Non, annuler"
                                  variant="secondary"
                                  size="sm"
                                  onPress={() => setConfirmAbandon(false)}
                                  fullWidth
                                />
                                <TouchableOpacity
                                  onPress={() => { setConfirmAbandon(false); handleAbandon(); }}
                                  style={styles.dangerButton}
                                  activeOpacity={0.9}
                                >
                                  <Text style={styles.dangerButtonText}>Oui, abandonner</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <TouchableOpacity
                              onPress={() => setConfirmAbandon(true)}
                              style={styles.dangerButton}
                              activeOpacity={0.9}
                            >
                              <Text style={styles.dangerButtonText}>Abandonner</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </Card>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.section}>
                    {/* Cycle terminé */}
                    {isCompleted ? (
                      <Card variant="surface" style={styles.completedCard}>
                        <View style={styles.completedHeader}>
                          <Text style={styles.completedTitle}>Programme terminé !</Text>
                          <Badge label={activeCycle?.label ?? "Programme"} tone="ok" />
                        </View>
                        <Text style={styles.completedSub}>
                          {completed}/{total} séances validées. Choisis ton prochain programme.
                        </Text>
                        <View style={styles.completedProgressTrack}>
                          <View style={[styles.completedProgressFill, { width: "100%" }]} />
                        </View>
                        {activeCycleId ? (() => {
                          const { suggestedNext: nextIds, tip } = suggestNextCycle(activeCycleId);
                          return nextIds.length > 0 ? (
                            <View style={styles.nextSuggestion}>
                              <Ionicons name="arrow-forward-circle-outline" size={16} color={palette.accent} />
                              <Text style={styles.nextSuggestionText}>{tip}</Text>
                            </View>
                          ) : null;
                        })() : null}
                      </Card>
                    ) : null}

                    {/* Recommandation IA — section premium en haut */}
                    <SectionHeader title="Recommandé pour toi" right={<Badge label={confidenceLabel} tone="ok" />} />
                    <Card variant="surface" style={styles.recoCard}>
                      <View style={styles.recoHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recoTitle}>{MICROCYCLES[recommendedId].label}</Text>
                          <Text style={styles.recoSub}>{MICROCYCLES[recommendedId].subtitle}</Text>
                        </View>
                        <View style={styles.recoIconPill}>
                          <Ionicons name="sparkles-outline" size={18} color={palette.accent} />
                        </View>
                      </View>
                      <View style={styles.recoReasons}>
                        {recommendation.reasons.slice(0, 3).map((r) => (
                          <View key={r} style={styles.recoReasonRow}>
                            <Ionicons name="checkmark-circle" size={14} color={palette.success} />
                            <Text style={styles.recoReasonText}>{r}</Text>
                          </View>
                        ))}
                      </View>
                      <Button
                        label={selectedId === recommendedId ? "Sélectionné" : `Choisir ${MICROCYCLES[recommendedId].label}`}
                        variant={selectedId === recommendedId ? "primary" : "secondary"}
                        onPress={() => {
                          setSelectionTouched(true);
                          setSelectedId(recommendedId);
                          setPendingPathway(null);
                        }}
                        fullWidth
                      />
                    </Card>

                    {/* Tests terrain — nudge compact */}
                    {shouldSuggestTests && !testsNudgeDismissed ? (
                      <Card variant="soft" style={styles.testsCard}>
                        <View style={styles.testsRow}>
                          <Ionicons name="analytics-outline" size={18} color={palette.accent} />
                          <Text style={styles.testsText}>
                            {testsCount === 0
                              ? "Fais tes tests pour qu'on puisse mieux cibler tes séances."
                              : `Tests datant de ${testsAgeDays}j — une mise à jour améliore la précision.`}
                          </Text>
                        </View>
                        <View style={styles.testsActions}>
                          <Button
                            label="Faire mes tests"
                            size="sm"
                            onPress={() =>
                              navigation.navigate("Tests", { initialPlaylist: selectedId })
                            }
                            fullWidth
                          />
                          <Button
                            label="Passer"
                            variant="ghost"
                            size="sm"
                            onPress={() => {
                              setTestsNudgeDismissed(true);
                              setSuppressTestsPrompt(true);
                            }}
                            fullWidth
                          />
                        </View>
                      </Card>
                    ) : null}

                    {/* Parcours recommandés */}
                    <SectionHeader title="Parcours" right={<Badge label="Guide" />} />
                    <View style={styles.pathwayList}>
                      {CYCLE_PATHWAYS.map((pw) => {
                        const isPathwaySelected = pendingPathway?.id === pw.id;
                        return (
                          <TouchableOpacity
                            key={pw.id}
                            onPress={() => {
                              setSelectionTouched(true);
                              setSelectedId(pw.sequence[0]);
                              setPendingPathway({ id: pw.id, index: 0 });
                            }}
                            style={[styles.pathwayCard, isPathwaySelected && styles.pathwayCardSelected]}
                            activeOpacity={0.9}
                          >
                            <View style={styles.pathwayHeader}>
                              <View style={[styles.pathwayIcon, isPathwaySelected && styles.pathwayIconSelected]}>
                                <Ionicons name={pw.icon as any} size={18} color={palette.accent} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.pathwayLabel}>{pw.label}</Text>
                                <Text style={styles.pathwayDesc}>{pw.description}</Text>
                              </View>
                              {isPathwaySelected ? (
                                <Ionicons name="checkmark-circle" size={20} color={palette.accent} />
                              ) : null}
                            </View>
                            <View style={styles.pathwaySequence}>
                              {pw.sequence.map((cycleId, idx) => (
                                <React.Fragment key={`${pw.id}_${cycleId}_${idx}`}>
                                  <View style={[styles.pathwayStep, isPathwaySelected && idx === 0 && styles.pathwayStepActive]}>
                                    <Text style={[styles.pathwayStepNum, isPathwaySelected && idx === 0 && styles.pathwayStepNumActive]}>{idx + 1}</Text>
                                    <Text style={[styles.pathwayStepLabel, isPathwaySelected && idx === 0 && styles.pathwayStepLabelActive]}>{MICROCYCLES[cycleId].label}</Text>
                                  </View>
                                  {idx < pw.sequence.length - 1 ? (
                                    <Ionicons name="arrow-forward" size={12} color={palette.sub} />
                                  ) : null}
                                </React.Fragment>
                              ))}
                            </View>
                            <Text style={styles.pathwayForWhom}>{pw.forWhom}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Tous les cycles */}
                    <SectionHeader title="Tous les programmes" right={<Badge label={`${total} séances`} />} />
                    <View style={styles.cycleList}>
                      {(Object.keys(MICROCYCLES) as MicrocycleId[]).map((id) => {
                        const item = MICROCYCLES[id];
                        const selected = selectedId === id;
                        const isReco = id === recommendedId;
                        return (
                          <TouchableOpacity
                            key={id}
                            onPress={() => {
                              setSelectionTouched(true);
                              setSelectedId(id);
                              setPendingPathway(null);
                            }}
                            style={[styles.cycleCard, selected && styles.cycleCardSelected]}
                            activeOpacity={0.9}
                          >
                            <View style={styles.cycleHeader}>
                              <View style={[styles.cycleIcon, selected && styles.cycleIconSelected]}>
                                <Ionicons name={item.icon as any} size={18} color={selected ? palette.accent : palette.sub} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.cycleLabel}>{item.label}</Text>
                                <Text style={styles.cycleSubtitle}>{item.subtitle}</Text>
                              </View>
                              {isReco && !selected ? <Badge label="Reco" tone="ok" /> : null}
                              {selected ? <Ionicons name="checkmark-circle" size={20} color={palette.accent} /> : null}
                            </View>
                            {item.footballTip ? (
                              <View style={styles.cycleTipRow}>
                                <Ionicons name="football-outline" size={13} color={palette.accent} />
                                <Text style={styles.cycleTipText}>{item.footballTip}</Text>
                              </View>
                            ) : null}
                            <View style={styles.locationRow}>
                              {item.allowedLocations.map((loc) => {
                                const extra = item.locationDescriptions?.[loc];
                                const locLabel = extra ? `${locationLabels[loc]} · ${extra}` : locationLabels[loc];
                                return <Badge key={`${id}_${loc}`} label={locLabel} />;
                              })}
                            </View>
                            <View style={styles.highlightRow}>
                              {item.highlights.slice(0, 3).map((h) => (
                                <Badge key={`${id}_${h}`} label={h} />
                              ))}
                            </View>
                            {item.suggestedNext && item.suggestedNext.length > 0 ? (
                              <Text style={styles.cycleNextHint}>
                                Ensuite → {item.suggestedNext.map((nid) => MICROCYCLES[nid].label).join(" ou ")}
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Résumé sélection + CTA */}
                    <Card variant="surface" style={styles.selectionSummary}>
                      <View style={styles.selectionRow}>
                        <View style={[styles.cycleIcon, styles.cycleIconSelected]}>
                          <Ionicons name={selectedCycle.icon as any} size={18} color={palette.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.selectionLabel}>{selectedCycle.label}</Text>
                          <Text style={styles.selectionHighlights}>
                            {pendingPathway
                              ? `Parcours : ${CYCLE_PATHWAYS.find((p) => p.id === pendingPathway.id)?.label ?? ""} · ${selectedCycle.highlights.slice(0, 2).join(" · ")}`
                              : selectedCycle.highlights.slice(0, 2).join(" · ")}
                          </Text>
                        </View>
                      </View>
                    </Card>

                    {showTestsPrompt ? (
                      <Card variant="surface" style={styles.testsPromptCard}>
                        <View style={styles.testsPromptHeader}>
                          <Ionicons name="analytics-outline" size={20} color={palette.accent} />
                          <Text style={styles.testsPromptTitle}>Tests conseillés</Text>
                        </View>
                        <Text style={styles.testsPromptText}>
                          {testsCount === 0
                            ? "Tu n'as pas encore fait les tests terrain. Ils aident FKS à mieux te recommander et suivre tes progrès."
                            : `Tes tests datent de ${testsAgeDays} jours. Les refaire améliore la précision.`}
                        </Text>
                        <View style={styles.testsPromptActions}>
                          <Button
                            label="Faire mes tests"
                            onPress={() => {
                              setShowTestsPrompt(false);
                              navigation.navigate("Tests", { initialPlaylist: selectedId });
                            }}
                            fullWidth
                          />
                          <Button
                            label="Démarrer quand même"
                            variant="secondary"
                            onPress={() => {
                              setShowTestsPrompt(false);
                              setSuppressTestsPrompt(true);
                              startCycleNow();
                            }}
                            fullWidth
                          />
                          <Button
                            label="Annuler"
                            variant="ghost"
                            onPress={() => setShowTestsPrompt(false)}
                            fullWidth
                          />
                        </View>
                      </Card>
                    ) : null}

                    <View style={styles.selectActions}>
                      <Button label={pendingPathway ? "Commencer ce parcours" : "Commencer ce programme"} onPress={handleStartCycle} fullWidth />
                      {canCloseSelect ? (
                        <Button label="Fermer" variant="ghost" onPress={() => navigation.goBack()} fullWidth />
                      ) : null}
                    </View>

                    {!canCloseSelect ? (
                      <Text style={styles.footerNote}>
                        Abandonne ton programme actuel avant d'en choisir un autre.
                      </Text>
                    ) : null}
                  </View>
                )}
              </ScrollView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ModalContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: "transparent" },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  modalHeaderTitle: { fontSize: 16, fontWeight: "800", color: palette.text },
  safeArea: { flexGrow: 1, backgroundColor: palette.bg },
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
  confirmBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.danger,
    backgroundColor: "rgba(239,68,68,0.06)",
    padding: 12,
    gap: 10,
  },
  confirmText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  confirmActions: { gap: 8 },

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
  cycleIconSelected: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
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

  selectionSummary: { padding: 14, gap: 8, borderColor: palette.accent },
  selectionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  selectionLabel: { fontSize: 15, fontWeight: "900", color: palette.text },
  selectionHighlights: { fontSize: 12, color: palette.sub, marginTop: 2 },
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
  recoReasons: { gap: 6 },
  recoReasonRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  recoReasonText: { flex: 1, color: palette.sub, fontSize: 12, lineHeight: 17 },

  testsCard: { padding: 14, gap: 10 },
  testsRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  testsText: { flex: 1, fontSize: 12, color: palette.sub, lineHeight: 17 },
  testsActions: { flexDirection: "row", gap: 10 },

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
  nextSuggestion: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: palette.accentSoft,
  },
  nextSuggestionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: palette.accent,
    lineHeight: 17,
  },

  /* Pathways */
  pathwayList: { gap: 10 },
  pathwayCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    padding: 14,
    gap: 10,
  },
  pathwayCardSelected: {
    borderColor: palette.accent,
    borderWidth: 2,
    backgroundColor: palette.accentSoft,
  },
  pathwayHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  pathwayIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accentSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  pathwayIconSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accent + "22",
  },
  pathwayLabel: { color: palette.text, fontSize: 15, fontWeight: "900" },
  pathwayDesc: { color: palette.sub, fontSize: 12, marginTop: 2 },
  pathwaySequence: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  pathwayStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  pathwayStepActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  pathwayStepNum: { fontSize: 10, fontWeight: "800", color: palette.accent },
  pathwayStepNumActive: { color: palette.accent },
  pathwayStepLabel: { fontSize: 11, fontWeight: "700", color: palette.text },
  pathwayStepLabelActive: { color: palette.accent, fontWeight: "800" },
  pathwayForWhom: { fontSize: 11, color: palette.sub, fontStyle: "italic", lineHeight: 16 },

  /* Cycle card extras */
  cycleTipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: palette.accentSoft,
  },
  cycleTipText: { flex: 1, fontSize: 11, fontWeight: "600", color: palette.accent, lineHeight: 16 },
  cycleNextHint: {
    fontSize: 11,
    color: palette.sub,
    fontStyle: "italic",
    marginTop: 2,
  },

  /* Tests prompt inline */
  testsPromptCard: {
    padding: 14,
    gap: 10,
    borderColor: palette.accent,
  },
  testsPromptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  testsPromptTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: palette.text,
  },
  testsPromptText: {
    fontSize: 13,
    color: palette.sub,
    lineHeight: 18,
  },
  testsPromptActions: {
    gap: 8,
    marginTop: 4,
  },
});
