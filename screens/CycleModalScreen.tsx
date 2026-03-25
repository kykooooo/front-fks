// screens/CycleModalScreen.tsx
// Sélection de programme — parcours guidé en 3 étapes
// Step 1: Choisis ton objectif (pathway)
// Step 2: Programme recommandé + alternatives
// Step 3: Confirmation + lancement

import React, { useMemo, useState, useCallback, useRef } from "react";
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
  Animated,
  AccessibilityInfo,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

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
import { useHaptics } from "../hooks/useHaptics";

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

const clampInt = (value: any) => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
};

/* ═══ Couleurs par pathway (dégradés subtils, pas kitsch) ═══ */
const PATHWAY_GRADIENTS: Record<string, [string, string]> = {
  debut: ["#1a2a1a", "#0f170f"],
  performance: ["#2a1a0f", "#170f0a"],
  saison_active: ["#0f1a2a", "#0a0f17"],
  reprise: ["#1a1a2a", "#0f0f17"],
};

const PATHWAY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  debut: "fitness-outline",
  performance: "rocket-outline",
  saison_active: "shield-checkmark-outline",
  reprise: "refresh-outline",
};

/* ═══ Couleurs par cycle ═══ */
const CYCLE_ACCENT: Partial<Record<MicrocycleId, string>> = {
  fondation: "#22c55e",
  force: "#f59e0b",
  endurance: "#3b82f6",
  explosivite: "#a855f7",
  explosif: "#ef4444",
  rsa: "#ec4899",
  saison: "#06b6d4",
  offseason: "#84cc16",
};

/* ═══════════════════════════════════════════ */
/*                COMPOSANT                    */
/* ═══════════════════════════════════════════ */

export default function CycleModalScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as RouteParams;
  const haptics = useHaptics();

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

  // ─── Wizard state ───
  const [step, setStep] = useState<1 | 2 | 3>(hasActiveCycle ? 1 : 1);
  const [selectedPathway, setSelectedPathway] = useState<CyclePathway | null>(null);
  const [selectedId, setSelectedId] = useState<MicrocycleId>(() => activeCycleId ?? "fondation");
  const [pendingPathway, setPendingPathway] = useState<{ id: string; index: number } | null>(null);
  const [showAllCycles, setShowAllCycles] = useState(false);

  // ─── Abandon state ───
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [abandonReasonId, setAbandonReasonId] = useState<string>("too_hard");
  const [abandonOtherText, setAbandonOtherText] = useState("");

  // ─── Tests state ───
  const [suppressTestsPrompt, setSuppressTestsPrompt] = useState(false);
  const [showTestsPrompt, setShowTestsPrompt] = useState(false);
  const [mainObjective, setMainObjective] = useState<string | null>(null);
  const [lastTestPlaylist, setLastTestPlaylist] = useState<MicrocycleId | null>(null);
  const [lastTestTs, setLastTestTs] = useState<number | null>(null);
  const [testsCount, setTestsCount] = useState<number>(0);

  // ─── Animation ───
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const animateTransition = useCallback((cb: () => void) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      cb();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }, [fadeAnim]);

  // ─── Data fetch ───
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
      } catch { /* best effort */ }
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
      } catch { /* best effort */ }
    })();
    return () => { alive = false; };
  }, []);

  const recommendation = useMemo(
    () => recommendMicrocycle({ mainObjective, lastTestPlaylist }),
    [mainObjective, lastTestPlaylist]
  );

  const testsAgeDays = useMemo(() => {
    if (!lastTestTs) return null;
    return daysBetween(lastTestTs, Date.now());
  }, [lastTestTs]);
  const testsFresh = testsAgeDays != null ? testsAgeDays <= TESTS_RECENCY_DAYS : false;
  const shouldSuggestTests = testsCount === 0 || !testsFresh;

  const activeCycle = activeCycleId ? MICROCYCLES[activeCycleId] : null;

  // ─── Actions ───
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

  const handleAbandon = async () => {
    const reason =
      abandonReasonId === "other"
        ? abandonOtherText.trim() || "Autre"
        : ABANDON_REASONS.find((r) => r.id === abandonReasonId)?.label ?? "Autre";
    try {
      await persistCycle({
        microcycleGoal: null, goal: null, programGoal: null,
        microcycleStatus: "abandoned", microcycleSessionIndex: 0,
        microcycleAbandonedAt: serverTimestamp(), microcycleAbandonReason: reason,
        activePathwayId: null, activePathwayIndex: 0,
      });
      setMicrocycleGoal(null);
      setActivePathway(null);
      setAbandonOpen(false);
      trackEvent("cycle_abandoned", { cycleId: activeCycleId ?? "none", reason, origin: params.origin ?? "unknown" });
    } catch {
      showToast({ type: "error", title: "Erreur", message: "Impossible d'abandonner le programme. Réessaie." });
    }
  };

  const locationLabels: Record<string, string> = { home: "Maison", pitch: "Terrain", gym: "Salle" };

  // ─── Navigation entre steps ───
  const goToStep = (s: 1 | 2 | 3) => {
    haptics.impactLight();
    animateTransition(() => setStep(s));
  };

  const selectPathway = (pw: CyclePathway) => {
    haptics.impactMedium();
    setSelectedPathway(pw);
    setSelectedId(pw.sequence[0]);
    setPendingPathway({ id: pw.id, index: 0 });
    goToStep(2);
  };

  const selectCycleDirect = (id: MicrocycleId) => {
    haptics.impactMedium();
    setSelectedId(id);
    setPendingPathway(null);
    setSelectedPathway(null);
    goToStep(3);
  };

  /* ═══════════════════════════════════════════ */
  /*              STEP 1 — OBJECTIF              */
  /* ═══════════════════════════════════════════ */
  const renderStep1 = () => (
    <View style={s.stepContainer}>
      <View style={s.stepHeader}>
        <Text style={s.stepKicker}>ÉTAPE 1 SUR 3</Text>
        <Text style={s.stepTitle}>Quel est ton objectif ?</Text>
        <Text style={s.stepSubtitle}>
          Choisis le parcours qui te correspond. On s'occupe du reste.
        </Text>
      </View>

      <View style={s.pathwayGrid}>
        {CYCLE_PATHWAYS.map((pw) => {
          const gradientColors = PATHWAY_GRADIENTS[pw.id] ?? ["#1a1a1a", "#0f0f0f"];
          const icon = PATHWAY_ICONS[pw.id] ?? (pw.icon as any);
          return (
            <TouchableOpacity
              key={pw.id}
              onPress={() => selectPathway(pw)}
              activeOpacity={0.85}
              style={s.pathwayCard}
            >
              <LinearGradient colors={gradientColors} style={s.pathwayGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={s.pathwayIconWrap}>
                  <Ionicons name={icon} size={28} color={palette.accent} />
                </View>
                <Text style={s.pathwayLabel}>{pw.label}</Text>
                <Text style={s.pathwayDesc}>{pw.forWhom}</Text>
                <View style={s.pathwayArrow}>
                  <Ionicons name="arrow-forward" size={18} color={palette.accent} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={() => {
          setShowAllCycles(true);
          goToStep(2);
          setSelectedPathway(null);
          setPendingPathway(null);
        }}
        style={s.skipLink}
      >
        <Text style={s.skipText}>Je veux choisir moi-même</Text>
        <Ionicons name="chevron-forward" size={16} color={palette.accent} />
      </TouchableOpacity>
    </View>
  );

  /* ═══════════════════════════════════════════ */
  /*         STEP 2 — PROGRAMME RECOMMANDÉ       */
  /* ═══════════════════════════════════════════ */
  const renderStep2 = () => {
    const cycle = MICROCYCLES[selectedId];
    const cycleAccent = CYCLE_ACCENT[selectedId] ?? palette.accent;
    const isFromPathway = selectedPathway != null;

    // Build list of cycles to show
    const cyclesToShow = isFromPathway && !showAllCycles
      ? selectedPathway!.sequence.map((id) => MICROCYCLES[id])
      : (Object.keys(MICROCYCLES) as MicrocycleId[]).map((id) => MICROCYCLES[id]);

    return (
      <View style={s.stepContainer}>
        {/* Back button */}
        <TouchableOpacity onPress={() => goToStep(1)} style={s.backRow}>
          <Ionicons name="chevron-back" size={20} color={palette.sub} />
          <Text style={s.backText}>Objectif</Text>
        </TouchableOpacity>

        <View style={s.stepHeader}>
          <Text style={s.stepKicker}>ÉTAPE 2 SUR 3</Text>
          <Text style={s.stepTitle}>
            {isFromPathway ? "Ton parcours" : "Choisis ton programme"}
          </Text>
          {isFromPathway ? (
            <Text style={s.stepSubtitle}>
              On te recommande de commencer par{"\u00a0"}
              <Text style={{ color: palette.accent, fontWeight: "700" }}>{cycle.label}</Text>
            </Text>
          ) : null}
        </View>

        {/* Cycle recommandé — carte hero */}
        <TouchableOpacity
          onPress={() => {
            setSelectedId(cycle.id);
            goToStep(3);
          }}
          activeOpacity={0.9}
          style={[s.heroCard, { borderColor: cycleAccent + "40" }]}
        >
          <LinearGradient
            colors={[cycleAccent + "18", "transparent"]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={s.heroTop}>
            <View style={[s.heroIconWrap, { backgroundColor: cycleAccent + "20", borderColor: cycleAccent + "30" }]}>
              <Ionicons name={cycle.icon as any} size={26} color={cycleAccent} />
            </View>
            {isFromPathway ? <Badge label="Recommandé" tone="ok" /> : null}
          </View>
          <Text style={s.heroTitle}>{cycle.label}</Text>
          <Text style={s.heroSubtitle}>{cycle.subtitle}</Text>
          {cycle.footballTip ? (
            <View style={s.heroTipRow}>
              <Ionicons name="football-outline" size={14} color={palette.accent} />
              <Text style={s.heroTipText}>{cycle.footballTip}</Text>
            </View>
          ) : null}
          <View style={s.heroHighlights}>
            {cycle.highlights.map((h) => (
              <View key={h} style={[s.highlightPill, { backgroundColor: cycleAccent + "15" }]}>
                <Text style={[s.highlightText, { color: cycleAccent }]}>{h}</Text>
              </View>
            ))}
          </View>
          <View style={s.heroCta}>
            <Text style={[s.heroCtaText, { color: cycleAccent }]}>Sélectionner ce programme</Text>
            <Ionicons name="arrow-forward" size={16} color={cycleAccent} />
          </View>
        </TouchableOpacity>

        {/* Autres cycles */}
        {cyclesToShow.length > 1 ? (
          <>
            <Text style={s.altSectionTitle}>
              {isFromPathway ? "Séquence du parcours" : "Tous les programmes"}
            </Text>
            {cyclesToShow.map((item, idx) => {
              if (item.id === selectedId && isFromPathway) return null;
              const itemAccent = CYCLE_ACCENT[item.id] ?? palette.sub;
              const isFirst = isFromPathway && idx === 0;
              return (
                <TouchableOpacity
                  key={`${item.id}_${idx}`}
                  onPress={() => {
                    setSelectedId(item.id);
                    if (isFromPathway) {
                      setPendingPathway({ id: selectedPathway!.id, index: idx });
                    } else {
                      setPendingPathway(null);
                    }
                    goToStep(3);
                  }}
                  activeOpacity={0.9}
                  style={s.altCard}
                >
                  <View style={[s.altIcon, { backgroundColor: itemAccent + "15" }]}>
                    <Ionicons name={item.icon as any} size={18} color={itemAccent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.altLabelRow}>
                      {isFromPathway ? (
                        <Text style={s.altStepNum}>#{idx + 1}</Text>
                      ) : null}
                      <Text style={s.altLabel}>{item.label}</Text>
                    </View>
                    <Text style={s.altSub}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={palette.sub} />
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}
      </View>
    );
  };

  /* ═══════════════════════════════════════════ */
  /*         STEP 3 — CONFIRMATION               */
  /* ═══════════════════════════════════════════ */
  const renderStep3 = () => {
    const cycle = MICROCYCLES[selectedId];
    const cycleAccent = CYCLE_ACCENT[selectedId] ?? palette.accent;

    return (
      <View style={s.stepContainer}>
        {/* Back button */}
        <TouchableOpacity onPress={() => goToStep(2)} style={s.backRow}>
          <Ionicons name="chevron-back" size={20} color={palette.sub} />
          <Text style={s.backText}>Retour</Text>
        </TouchableOpacity>

        <View style={s.stepHeader}>
          <Text style={s.stepKicker}>ÉTAPE 3 SUR 3</Text>
          <Text style={s.stepTitle}>Prêt à lancer ?</Text>
        </View>

        {/* Résumé du cycle */}
        <View style={[s.confirmCard, { borderColor: cycleAccent + "30" }]}>
          <LinearGradient
            colors={[cycleAccent + "10", "transparent"]}
            style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[s.confirmIconWrap, { backgroundColor: cycleAccent + "20" }]}>
            <Ionicons name={cycle.icon as any} size={32} color={cycleAccent} />
          </View>
          <Text style={s.confirmTitle}>{cycle.label}</Text>
          <Text style={s.confirmSub}>{cycle.description}</Text>

          {/* Stats */}
          <View style={s.confirmStats}>
            <View style={s.confirmStat}>
              <Text style={s.confirmStatValue}>{total}</Text>
              <Text style={s.confirmStatLabel}>séances</Text>
            </View>
            <View style={s.confirmStatDivider} />
            <View style={s.confirmStat}>
              <Text style={s.confirmStatValue}>
                {cycle.allowedLocations.map((l) => locationLabels[l]).join(", ")}
              </Text>
              <Text style={s.confirmStatLabel}>lieux possibles</Text>
            </View>
          </View>

          {/* Highlights */}
          <View style={s.confirmHighlights}>
            {cycle.highlights.map((h) => (
              <View key={h} style={s.confirmHighlightRow}>
                <Ionicons name="checkmark-circle" size={16} color={palette.success} />
                <Text style={s.confirmHighlightText}>{h}</Text>
              </View>
            ))}
          </View>

          {selectedPathway ? (
            <View style={s.confirmPathwayRow}>
              <Ionicons name="map-outline" size={14} color={palette.accent} />
              <Text style={s.confirmPathwayText}>
                Parcours : {selectedPathway.label}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Tests prompt */}
        {showTestsPrompt ? (
          <Card variant="surface" style={s.testsCard}>
            <View style={s.testsHeader}>
              <Ionicons name="analytics-outline" size={20} color={palette.accent} />
              <Text style={s.testsTitle}>Tests conseillés</Text>
            </View>
            <Text style={s.testsText}>
              {testsCount === 0
                ? "Tu n'as pas encore fait les tests terrain. Ils aident FKS à mieux cibler tes séances."
                : `Tes tests datent de ${testsAgeDays} jours. Les refaire améliore la précision.`}
            </Text>
            <View style={s.testsActions}>
              <Button label="Faire mes tests" onPress={() => {
                setShowTestsPrompt(false);
                navigation.navigate("Tests", { initialPlaylist: selectedId });
              }} fullWidth />
              <Button label="Démarrer quand même" variant="secondary" onPress={() => {
                setShowTestsPrompt(false);
                setSuppressTestsPrompt(true);
                startCycleNow();
              }} fullWidth />
              <Button label="Annuler" variant="ghost" onPress={() => setShowTestsPrompt(false)} fullWidth />
            </View>
          </Card>
        ) : null}

        {/* CTA */}
        <View style={s.confirmActions}>
          <Button
            label="Lancer le programme"
            onPress={handleStartCycle}
            fullWidth
          />
          <Button
            label="Changer de programme"
            variant="ghost"
            onPress={() => goToStep(2)}
            fullWidth
          />
        </View>
      </View>
    );
  };

  /* ═══════════════════════════════════════════ */
  /*        CYCLE ACTIF — MODE GESTION           */
  /* ═══════════════════════════════════════════ */
  const renderActiveCycle = () => {
    const cycleAccent = CYCLE_ACCENT[activeCycleId!] ?? palette.accent;
    const progressPct = (completed / total) * 100;

    const timelineRows = Array.from({ length: total }).map((_, idx) => {
      const number = idx + 1;
      const status = completed > idx ? "done" : completed === idx ? "current" : "next";
      return { number, status };
    });

    return (
      <View style={s.stepContainer}>
        <View style={s.stepHeader}>
          <Text style={s.stepKicker}>PROGRAMME ACTIF</Text>
          <Text style={s.stepTitle}>{activeCycle?.label}</Text>
          <Text style={s.stepSubtitle}>{activeCycle?.subtitle}</Text>
        </View>

        {/* Progress card */}
        <View style={[s.confirmCard, { borderColor: cycleAccent + "30" }]}>
          <LinearGradient
            colors={[cycleAccent + "10", "transparent"]}
            style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[s.confirmIconWrap, { backgroundColor: cycleAccent + "20" }]}>
            <Ionicons name={activeCycle?.icon as any} size={32} color={cycleAccent} />
          </View>
          <Text style={s.progressLabel}>{completed}/{total} séances</Text>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progressPct}%`, backgroundColor: cycleAccent }]} />
          </View>
        </View>

        {/* Timeline */}
        <Text style={s.altSectionTitle}>Séances</Text>
        <Card variant="soft" style={s.timelineCard}>
          {timelineRows.map((row) => {
            const dotColor =
              row.status === "done" ? palette.success
                : row.status === "current" ? palette.accent
                  : palette.borderSoft;
            const label = row.status === "done" ? "Terminée" : row.status === "current" ? "À faire" : "À venir";
            const labelTone = row.status === "done" ? "ok" : row.status === "current" ? "warn" : "default";
            return (
              <View key={`session_${row.number}`} style={s.timelineRow}>
                <View style={[s.timelineDot, { backgroundColor: dotColor }]} />
                <Text style={s.timelineTitle}>Séance {row.number}</Text>
                <Badge label={label} tone={labelTone as any} />
              </View>
            );
          })}
        </Card>

        {/* Actions */}
        <View style={s.confirmActions}>
          <Button
            label="Continuer ma séance"
            onPress={() => navigation.navigate("Tabs", { screen: "NewSession" })}
            fullWidth
          />
          <Button
            label="Changer de programme"
            variant="ghost"
            onPress={() => setAbandonOpen(true)}
            fullWidth
          />
        </View>

        {/* Abandon */}
        {abandonOpen ? (
          <Card variant="surface" style={s.abandonCard}>
            <Text style={s.abandonTitle}>Abandonner ce programme</Text>
            <Text style={s.abandonSub}>
              Ta progression ({completed}/{total}) sera remise à zéro.
            </Text>
            <View style={s.reasonGrid}>
              {ABANDON_REASONS.map((r) => {
                const selected = abandonReasonId === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setAbandonReasonId(r.id)}
                    style={[s.reasonChip, selected && s.reasonChipSelected]}
                    activeOpacity={0.9}
                  >
                    <Text style={[s.reasonChipText, selected && s.reasonChipTextSelected]}>{r.label}</Text>
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
                style={s.input}
              />
            ) : null}
            <View style={s.abandonActions}>
              <Button label="Annuler" variant="secondary" onPress={() => { setAbandonOpen(false); setConfirmAbandon(false); }} fullWidth />
              {confirmAbandon ? (
                <View style={s.confirmBox}>
                  <Text style={s.confirmBoxText}>Tu es sûr ? Ta progression sera remise à zéro.</Text>
                  <View style={s.confirmBoxActions}>
                    <Button label="Non, annuler" variant="secondary" size="sm" onPress={() => setConfirmAbandon(false)} fullWidth />
                    <TouchableOpacity onPress={() => { setConfirmAbandon(false); handleAbandon(); }} style={s.dangerButton} activeOpacity={0.9}>
                      <Text style={s.dangerButtonText}>Oui, abandonner</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setConfirmAbandon(true)} style={s.dangerButton} activeOpacity={0.9}>
                  <Text style={s.dangerButtonText}>Abandonner</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        ) : null}
      </View>
    );
  };

  /* ═══════════════════════════════════════════ */
  /*        CYCLE TERMINÉ                        */
  /* ═══════════════════════════════════════════ */
  const renderCompleted = () => {
    const nextSuggestions = activeCycleId ? suggestNextCycle(activeCycleId) : null;
    return (
      <View style={s.stepContainer}>
        <View style={s.stepHeader}>
          <View style={s.completedBadge}>
            <Ionicons name="trophy" size={32} color={palette.accent} />
          </View>
          <Text style={s.stepTitle}>Programme terminé !</Text>
          <Text style={s.stepSubtitle}>
            {completed}/{total} séances validées. Choisis ton prochain programme.
          </Text>
        </View>

        {nextSuggestions && nextSuggestions.suggestedNext.length > 0 ? (
          <View style={s.nextHint}>
            <Ionicons name="arrow-forward-circle-outline" size={16} color={palette.accent} />
            <Text style={s.nextHintText}>{nextSuggestions.tip}</Text>
          </View>
        ) : null}

        <Button label="Choisir un nouveau programme" onPress={() => {
          setMicrocycleGoal(null);
          setActivePathway(null);
          goToStep(1);
        }} fullWidth />
      </View>
    );
  };

  /* ═══════════════════════════════════════════ */
  /*                 RENDER                      */
  /* ═══════════════════════════════════════════ */
  const renderContent = () => {
    if (isCompleted) return renderCompleted();
    if (hasActiveCycle) return renderActiveCycle();
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
    }
  };

  return (
    <View style={s.modalRoot}>
      <ModalContainer
        visible
        onClose={() => navigation.goBack()}
        animationType="slide"
        blurIntensity={40}
        allowBackdropDismiss
        allowSwipeDismiss
      >
        <SafeAreaView style={s.safeArea} edges={["bottom"]}>
          <View style={[s.modalHeader, { paddingTop: insets.top }]}>
            <Text style={s.modalHeaderTitle}>Programme</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeButton}>
              <Ionicons name="close" size={22} color={palette.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <ScrollView
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Animated.View style={{ opacity: fadeAnim }}>
                  {renderContent()}
                </Animated.View>
              </ScrollView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </ModalContainer>
    </View>
  );
}

/* ═══════════════════════════════════════════ */
/*                 STYLES                      */
/* ═══════════════════════════════════════════ */
const s = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: "transparent" },
  safeArea: { flexGrow: 1, backgroundColor: palette.bg },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  modalHeaderTitle: { fontSize: 16, fontWeight: "800", color: palette.text },
  closeButton: { paddingHorizontal: 12, paddingVertical: 8 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // ─── Steps communs ───
  stepContainer: { gap: 16 },
  stepHeader: { gap: 6, marginBottom: 4 },
  stepKicker: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.accent,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  stepTitle: { fontSize: 26, fontWeight: "900", color: palette.text, lineHeight: 32 },
  stepSubtitle: { fontSize: 14, color: palette.sub, lineHeight: 20 },

  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  backText: { fontSize: 14, color: palette.sub, fontWeight: "600" },

  // ─── Step 1 — Pathways ───
  pathwayGrid: { gap: 12 },
  pathwayCard: { borderRadius: 20, overflow: "hidden" },
  pathwayGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    position: "relative",
  },
  pathwayIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,122,26,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  pathwayLabel: { fontSize: 18, fontWeight: "800", color: palette.text, marginBottom: 4 },
  pathwayDesc: { fontSize: 13, color: palette.sub, lineHeight: 18 },
  pathwayArrow: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,122,26,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  skipLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
  },
  skipText: { fontSize: 14, fontWeight: "600", color: palette.accent },

  // ─── Step 2 — Hero card ───
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 10,
    overflow: "hidden",
    backgroundColor: palette.card,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 22, fontWeight: "900", color: palette.text },
  heroSubtitle: { fontSize: 14, color: palette.sub, lineHeight: 20 },
  heroTipRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  heroTipText: { flex: 1, fontSize: 12, color: palette.accent, fontStyle: "italic", lineHeight: 17 },
  heroHighlights: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  highlightPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  highlightText: { fontSize: 12, fontWeight: "700" },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 6,
  },
  heroCtaText: { fontSize: 14, fontWeight: "700" },

  // ─── Step 2 — Alternatives ───
  altSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  altCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  altIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  altLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  altStepNum: { fontSize: 11, fontWeight: "800", color: palette.accent },
  altLabel: { fontSize: 15, fontWeight: "700", color: palette.text },
  altSub: { fontSize: 12, color: palette.sub, marginTop: 2 },

  // ─── Step 3 — Confirm ───
  confirmCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    gap: 14,
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: palette.card,
  },
  confirmIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTitle: { fontSize: 22, fontWeight: "900", color: palette.text, textAlign: "center" },
  confirmSub: { fontSize: 13, color: palette.sub, textAlign: "center", lineHeight: 19 },
  confirmStats: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 8,
  },
  confirmStat: { flex: 1, alignItems: "center" },
  confirmStatValue: { fontSize: 14, fontWeight: "700", color: palette.text, textAlign: "center" },
  confirmStatLabel: { fontSize: 11, color: palette.sub, marginTop: 2 },
  confirmStatDivider: { width: 1, height: 30, backgroundColor: palette.borderSoft },
  confirmHighlights: { gap: 8, width: "100%" },
  confirmHighlightRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  confirmHighlightText: { fontSize: 13, color: palette.text, fontWeight: "600" },
  confirmPathwayRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  confirmPathwayText: { fontSize: 12, color: palette.accent, fontWeight: "600" },
  confirmActions: { gap: 10 },

  // ─── Active cycle ───
  progressLabel: { fontSize: 16, fontWeight: "700", color: palette.text, textAlign: "center" },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: { height: "100%", borderRadius: 999 },
  timelineCard: { padding: 12, gap: 10 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timelineDot: { width: 10, height: 10, borderRadius: 999 },
  timelineTitle: { flex: 1, color: palette.text, fontWeight: "700", fontSize: 13 },

  // ─── Completed ───
  completedBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  nextHint: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 },
  nextHintText: { flex: 1, fontSize: 13, color: palette.sub, lineHeight: 18 },

  // ─── Abandon ───
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
  reasonChipSelected: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
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
  confirmBoxText: { color: palette.danger, fontSize: 13 },
  confirmBoxActions: { flexDirection: "row", gap: 10 },

  // ─── Tests ───
  testsCard: { padding: 14, gap: 10 },
  testsHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  testsTitle: { fontSize: 15, fontWeight: "700", color: palette.text },
  testsText: { fontSize: 13, color: palette.sub, lineHeight: 18 },
  testsActions: { gap: 8 },
});
