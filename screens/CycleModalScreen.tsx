// screens/CycleModalScreen.tsx
// Choix du cycle — liste directe des cycles
//  • Liste : tous les cycles visibles (bénéfice, durée, intensité, axes, recommandé)
//  • Confirmation : récap + tests optionnels + lancement
//  • Cycle actif : progression + changement de cycle
//  • Cycle terminé : choix d'un nouveau cycle

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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../constants/theme";
import { auth, db } from "../services/firebase";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import {
  MICROCYCLES,
  MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
  suggestNextCycle,
  type MicrocycleId,
  isMicrocycleId,
} from "../domain/microcycles";
import { recommendMicrocycle } from "../domain/recommendMicrocycle";
import { getCycleTheme } from "../constants/cycleTheme";
import { getMicrocyclePhase, getMicrocyclePhaseRanges } from "../utils/microcycleUtils";
import { Badge } from "../components/ui/Badge";
import { showToast } from "../utils/toast";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { trackEvent } from "../services/analytics";
import { ModalContainer } from "../components/modal/ModalContainer";
import { readTestsRaw } from "./tests/hooks/useTestsStorage";
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
  { id: "injury", label: "Gêne physique" },
  { id: "goal_changed", label: "Objectif changé" },
  { id: "other", label: "Autre" },
];

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

  // ─── Sélection state ───
  // step 1 = liste des cycles, step 3 = confirmation
  const [step, setStep] = useState<1 | 3>(1);
  const [selectedId, setSelectedId] = useState<MicrocycleId>(() => activeCycleId ?? "fondation");

  // ─── Abandon state ───
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [abandonReasonId, setAbandonReasonId] = useState<string>("too_hard");
  const [abandonOtherText, setAbandonOtherText] = useState("");

  // ─── Tests state ───
  const [mainObjective, setMainObjective] = useState<string | null>(null);
  const [lastTestPlaylist, setLastTestPlaylist] = useState<MicrocycleId | null>(null);
  const [lastTestTs, setLastTestTs] = useState<number | null>(null);
  const [testsCount, setTestsCount] = useState<number>(0);

  // ─── Animation ───
  const fadeAnim = useRef(new Animated.Value(1)).current;
  // Le contenu change IMMÉDIATEMENT (le tap répond tout de suite) ; le fade-in
  // se joue en parallèle. Avant, le fade-out de 150ms d'abord donnait l'impression
  // que le tap n'avait pas répondu.
  const animateTransition = useCallback((cb: () => void) => {
    cb();
    fadeAnim.setValue(0.4);
    Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
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
        const raw = await readTestsRaw();
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

  // Ferme le modal et revient à l'écran qui l'a ouvert (NewSession, Profile, Home…).
  // On NE navigue PAS vers Tabs depuis le modal (sinon Tabs s'affiche dans la présentation
  // transparentModal → écran prisonnier). Le store (microcycleGoal) mis à jour rafraîchit
  // l'écran sous-jacent (la carte "choisir un cycle" disparaît).
  const goNextAfterStart = () => {
    navigation.goBack();
  };

  const startCycleNow = async () => {
    try {
      // Choix direct d'un cycle : pas de parcours (pathway) associé.
      const cyclePayload: Record<string, any> = {
        microcycleGoal: selectedId,
        goal: selectedId,
        programGoal: selectedId,
        microcycleStatus: "active",
        microcycleTotalSessions: total,
        microcycleSessionIndex: 0,
        microcycleStartedAt: serverTimestamp(),
        activePathwayId: null,
        activePathwayIndex: 0,
      };
      await persistCycle(cyclePayload);
      setMicrocycleGoal(selectedId);
      setActivePathway(null);
      trackEvent("cycle_selected", {
        cycleId: selectedId,
        pathway: "none",
        origin: params.origin ?? "unknown",
      });
      goNextAfterStart();
    } catch {
      showToast({ type: "error", title: "Erreur", message: "Impossible d'enregistrer ton cycle. Réessaie." });
    }
  };

  const handleStartCycle = async () => {
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
      showToast({ type: "error", title: "Erreur", message: "Impossible de changer de cycle. Réessaie." });
    }
  };

  const locationLabels: Record<string, string> = { home: "Maison", pitch: "Terrain", gym: "Salle" };

  // ─── Navigation entre vues ───
  const goToStep = (s: 1 | 3) => {
    haptics.impactLight();
    animateTransition(() => setStep(s));
  };

  const selectCycleDirect = (id: MicrocycleId) => {
    haptics.impactMedium();
    setSelectedId(id);
    goToStep(3);
  };

  /* ═══════════════════════════════════════════ */
  /*              LISTE DES CYCLES               */
  /* ═══════════════════════════════════════════ */
  const renderCycleList = () => {
    const recId = isMicrocycleId(recommendation.id) ? recommendation.id : null;
    const cycles = (Object.keys(MICROCYCLES) as MicrocycleId[]).map((id) => MICROCYCLES[id]);
    return (
      <View style={s.stepContainer}>
        <View style={s.stepHeader}>
          <Text style={s.stepTitle}>Choisir un cycle</Text>
          <Text style={s.stepSubtitle}>
            Un cycle guide tes prochaines séances. Tu peux changer plus tard.
          </Text>
        </View>

        {recId ? (
          <View style={s.recoBanner}>
            <Ionicons name="sparkles-outline" size={16} color={palette.accent} />
            <Text style={s.recoBannerText}>
              Recommandé pour ton profil :{" "}
              <Text style={s.recoBannerStrong}>{MICROCYCLES[recId].label}</Text>
            </Text>
          </View>
        ) : null}

        {cycles.map((cycle) => {
          const isReco = cycle.id === recId;
          return (
            <View key={cycle.id} style={[s.cycleCard, isReco && s.cycleCardReco]}>
              <View style={s.cycleCardHead}>
                <View style={s.cycleCardIcon}>
                  <Ionicons name={cycle.icon as any} size={22} color={palette.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cycleCardTitle}>{cycle.label}</Text>
                  <Text style={s.cycleCardSub}>{cycle.subtitle}</Text>
                </View>
                {isReco ? <Badge label="Recommandé" tone="ok" /> : null}
              </View>

              <View style={s.tagRow}>
                <View style={s.tag}>
                  <Text style={s.tagText}>{total} séances</Text>
                </View>
                {cycle.intensity ? (
                  <View style={s.tag}>
                    <Text style={s.tagText}>{cycle.intensity}</Text>
                  </View>
                ) : null}
              </View>

              <View style={s.axisRow}>
                {cycle.highlights.slice(0, 3).map((h) => (
                  <View key={h} style={s.axisChip}>
                    <Text style={s.axisChipText}>{h}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                onPress={() => selectCycleDirect(cycle.id)}
                activeOpacity={0.85}
                style={s.cycleChooseBtn}
              >
                <Text style={s.cycleChooseBtnText}>Choisir ce cycle</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  /* ═══════════════════════════════════════════ */
  /*               CONFIRMATION                  */
  /* ═══════════════════════════════════════════ */
  const renderConfirm = () => {
    const cycle = MICROCYCLES[selectedId];
    const cycleAccent = palette.accent;

    return (
      <View style={s.stepContainer}>
        {/* Back button */}
        <TouchableOpacity
          onPress={() => goToStep(1)}
          style={s.backRow}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={20} color={palette.sub} />
          <Text style={s.backText}>Retour</Text>
        </TouchableOpacity>

        <View style={s.stepHeader}>
          <Text style={s.stepKicker}>CONFIRMATION</Text>
          <Text style={s.stepTitle}>Prêt à lancer ?</Text>
        </View>

        {/* Résumé du cycle */}
        <View style={[s.confirmCard, { borderColor: cycleAccent + "30" }]}>
          <View style={[s.confirmIconWrap, { backgroundColor: cycleAccent + "20" }]}>
            <Ionicons name={cycle.icon as any} size={32} color={cycleAccent} />
          </View>
          <Text style={s.confirmTitle}>{cycle.label}</Text>
          <Text style={s.confirmSub}>{cycle.description}</Text>
          {cycle.intensity ? (
            <View style={s.tag}>
              <Text style={s.tagText}>{cycle.intensity}</Text>
            </View>
          ) : null}

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
        </View>

        {/* Tests — info compacte, non bloquante */}
        {shouldSuggestTests ? (
          <View style={s.testsCompact}>
            <Ionicons name="analytics-outline" size={16} color={palette.sub} style={{ marginTop: 1 }} />
            <Text style={s.testsCompactText}>
              Les tests terrain affinent les séances, mais tu peux commencer sans.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Tests", { initialPlaylist: selectedId })}
              style={s.testsCompactLink}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Faire les tests"
            >
              <Text style={s.testsCompactLinkText}>Faire les tests</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* CTA */}
        <View style={s.confirmActions}>
          <Button
            label="Démarrer ce cycle"
            onPress={handleStartCycle}
            fullWidth
            style={s.ctaBlue}
          />
          <Button
            label="Changer de cycle"
            variant="ghost"
            onPress={() => goToStep(1)}
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
    // Couleur du cycle actif (cohérence avec les headers thémés des écrans de séance).
    const cycleAccent = getCycleTheme(activeCycleId).strong;
    const progressPct = (completed / total) * 100;

    // Phase courante + découpage du cycle en 4 phases (affichage dérivé, voir microcycleUtils).
    const currentPhase = getMicrocyclePhase(completed, total);
    const phaseRanges = getMicrocyclePhaseRanges(total);

    return (
      <View style={s.stepContainer}>
        <View style={s.stepHeader}>
          <Text style={s.stepKicker}>CYCLE ACTUEL</Text>
          <Text style={s.stepTitle}>{activeCycle?.label}</Text>
          <Text style={s.stepSubtitle}>{activeCycle?.subtitle}</Text>
        </View>

        {/* Progress card */}
        <View style={[s.confirmCard, { borderColor: cycleAccent + "30" }]}>
          <View style={[s.confirmIconWrap, { backgroundColor: cycleAccent + "20" }]}>
            <Ionicons name={activeCycle?.icon as any} size={32} color={cycleAccent} />
          </View>
          <Text style={s.progressLabel}>{completed}/{total} séances</Text>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${progressPct}%`, backgroundColor: cycleAccent }]} />
          </View>

          {/* Phase courante + sens (où le joueur en est dans son voyage) */}
          <View style={[s.phaseNow, { backgroundColor: cycleAccent + "12", borderColor: cycleAccent + "33" }]}>
            <Text style={s.phaseNowKicker}>SÉANCE {currentPhase.sessionNumber} / {total}</Text>
            <Text style={[s.phaseNowLabel, { color: cycleAccent }]}>{currentPhase.label}</Text>
            <Text style={s.phaseNowMeaning}>{currentPhase.meaning}</Text>
          </View>
        </View>

        {/* Voyage du cycle — les 4 phases regroupées et teintées */}
        <Text style={s.altSectionTitle}>Ton voyage dans le cycle</Text>
        <View style={s.journey}>
          {phaseRanges.map((range) => {
            const phaseDone = completed >= range.end;
            const phaseCurrent = !phaseDone && completed >= range.start - 1;
            const dotColor = phaseDone ? palette.success : phaseCurrent ? cycleAccent : palette.borderSoft;
            const stateLabel = phaseDone ? "Terminé" : phaseCurrent ? "En cours" : "À venir";
            const stateTone = phaseDone ? "ok" : phaseCurrent ? "warn" : "default";
            return (
              <View
                key={range.key}
                style={[
                  s.phaseBlock,
                  { borderColor: phaseCurrent ? cycleAccent : palette.borderSoft },
                  phaseCurrent ? { backgroundColor: cycleAccent + "12" } : null,
                ]}
              >
                <View style={s.phaseBlockHead}>
                  <View style={[s.phaseBlockDot, { backgroundColor: dotColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.phaseBlockTitle, phaseCurrent ? { color: cycleAccent } : null]}>
                      {range.label}
                    </Text>
                    <Text style={s.phaseBlockRange}>
                      {range.start === range.end
                        ? `Séance ${range.start}`
                        : `Séances ${range.start}–${range.end}`}
                    </Text>
                  </View>
                  <Badge label={stateLabel} tone={stateTone as any} />
                </View>

                {phaseCurrent ? <Text style={s.phaseBlockMeaning}>{range.meaning}</Text> : null}

                {/* Pastilles numérotées : une par séance de la phase */}
                <View style={s.phasePills}>
                  {Array.from({ length: range.count }).map((_, i) => {
                    const number = range.start + i;
                    const sDone = completed >= number;
                    const sCurrent = completed === number - 1;
                    const pillBg = sDone ? palette.success : sCurrent ? cycleAccent : palette.card;
                    const pillBorder = sDone ? palette.success : sCurrent ? cycleAccent : palette.borderSoft;
                    return (
                      <View
                        key={number}
                        style={[s.sessionPill, { backgroundColor: pillBg, borderColor: pillBorder }]}
                      >
                        <Text style={[s.sessionPillText, sDone || sCurrent ? { color: "#fff" } : null]}>
                          {number}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        {/* Actions */}
        <View style={s.confirmActions}>
          <Button
            label="Continuer mon cycle"
            onPress={() => navigation.goBack()}
            fullWidth
            style={s.ctaBlue}
          />
          <Button
            label="Changer de cycle"
            variant="ghost"
            onPress={() => setAbandonOpen(true)}
            fullWidth
          />
        </View>

        {/* Abandon */}
        {abandonOpen ? (
          <Card variant="surface" style={s.abandonCard}>
            <Text style={s.abandonTitle}>Changer de cycle</Text>
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
                      <Text style={s.dangerButtonText}>Oui, changer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setConfirmAbandon(true)} style={s.dangerButton} activeOpacity={0.9}>
                  <Text style={s.dangerButtonText}>Changer de cycle</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        ) : null}
      </View>
    );
  };

  /* ═══════════════════════════════════════════ */
  /*               CYCLE TERMINÉ                 */
  /* ═══════════════════════════════════════════ */
  const renderCompleted = () => {
    const nextSuggestions = activeCycleId ? suggestNextCycle(activeCycleId) : null;
    return (
      <View style={s.stepContainer}>
        <View style={s.stepHeader}>
          <View style={s.completedBadge}>
            <Ionicons name="trophy" size={32} color={palette.accent} />
          </View>
          <Text style={s.stepTitle}>Cycle terminé !</Text>
          <Text style={s.stepSubtitle}>
            {completed}/{total} séances validées. Choisis ton prochain cycle.
          </Text>
        </View>

        {nextSuggestions && nextSuggestions.suggestedNext.length > 0 ? (
          <View style={s.nextHint}>
            <Ionicons name="arrow-forward-circle-outline" size={16} color={palette.accent} />
            <Text style={s.nextHintText}>{nextSuggestions.tip}</Text>
          </View>
        ) : null}

        <Button label="Choisir un nouveau cycle" onPress={async () => {
          try {
            await persistCycle({
              microcycleGoal: null, goal: null, programGoal: null,
              microcycleStatus: "completed", microcycleSessionIndex: 0,
              microcycleCompletedAt: serverTimestamp(),
              activePathwayId: null, activePathwayIndex: 0,
            });
            setMicrocycleGoal(null);
            setActivePathway(null);
            goToStep(1);
          } catch {
            showToast({ type: "error", title: "Erreur", message: "Impossible de changer de cycle. Réessaie." });
          }
        }} fullWidth style={s.ctaBlue} />
      </View>
    );
  };

  /* ═══════════════════════════════════════════ */
  /*                 RENDER                      */
  /* ═══════════════════════════════════════════ */
  const renderContent = () => {
    if (isCompleted) return renderCompleted();
    if (hasActiveCycle) return renderActiveCycle();
    return step === 3 ? renderConfirm() : renderCycleList();
  };

  return (
    <View style={s.modalRoot}>
      <ModalContainer
        visible
        onClose={() => navigation.goBack()}
        animationType="slide"
        blurIntensity={40}
        showHandle={false}
        allowBackdropDismiss
        allowSwipeDismiss
      >
        <SafeAreaView style={s.safeArea} edges={["bottom"]}>
          <View style={[s.modalHeader, { paddingTop: insets.top }]}>
            <Text style={s.modalHeaderTitle}>Cycle</Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={s.closeButton}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
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

  // ─── Vues communes ───
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

  // ─── Tags (durée / intensité) ───
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  tagText: { fontSize: 12, fontWeight: "600", color: palette.sub },

  // ─── Bannière recommandé ───
  recoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: palette.accentSoft,
  },
  recoBannerText: { flex: 1, fontSize: 13, color: palette.text, lineHeight: 18 },
  recoBannerStrong: { fontWeight: "800", color: palette.accent },

  // ─── Carte cycle (liste directe) ───
  cycleCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    padding: 16,
    gap: 12,
    ...theme.shadow.soft,
  },
  cycleCardReco: { borderColor: palette.accent },
  cycleCardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  cycleCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cycleCardTitle: { fontSize: 17, fontWeight: "800", color: palette.text },
  cycleCardSub: { fontSize: 13, color: palette.sub, lineHeight: 18, marginTop: 2 },

  axisRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  axisChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  axisChipText: { fontSize: 12, fontWeight: "600", color: palette.text },

  cycleChooseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.accent,
  },
  cycleChooseBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // ─── Tests compact (confirmation) ───
  testsCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  testsCompactText: { flex: 1, fontSize: 12.5, color: palette.sub, lineHeight: 17 },
  testsCompactLink: { paddingVertical: 2 },
  testsCompactLinkText: { fontSize: 13, fontWeight: "700", color: palette.accent },

  // ─── CTA bleu (override DA flow cycle) ───
  ctaBlue: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
    shadowColor: palette.accent,
  },

  // ─── Section "Séances" (cycle actif) ───
  altSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.sub,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
  },

  // ─── Confirmation ───
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
  confirmActions: { gap: 10 },

  // ─── Cycle actif ───
  progressLabel: { fontSize: 16, fontWeight: "700", color: palette.text, textAlign: "center" },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: { height: "100%", borderRadius: 999 },

  // ─── Phase courante (dans la progress card) ───
  phaseNow: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    marginTop: 4,
  },
  phaseNowKicker: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.sub,
    letterSpacing: 1,
  },
  phaseNowLabel: { fontSize: 18, fontWeight: "900" },
  phaseNowMeaning: { fontSize: 13, color: palette.text, lineHeight: 18 },

  // ─── Voyage du cycle (4 phases) ───
  journey: { gap: 10 },
  phaseBlock: {
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: palette.card,
    padding: 14,
    gap: 10,
  },
  phaseBlockHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  phaseBlockDot: { width: 12, height: 12, borderRadius: 999 },
  phaseBlockTitle: { fontSize: 15, fontWeight: "800", color: palette.text },
  phaseBlockRange: { fontSize: 12, color: palette.sub, marginTop: 1 },
  phaseBlockMeaning: { fontSize: 12.5, color: palette.text, lineHeight: 18 },
  phasePills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sessionPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  sessionPillText: { fontSize: 12, fontWeight: "800", color: palette.sub },

  // ─── Cycle terminé ───
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

  // ─── Abandon / changement ───
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
});
