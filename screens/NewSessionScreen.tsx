// src/screens/NewSessionScreen.tsx
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { subDays } from "date-fns";
import { useNavigation, NavigationProp, useFocusEffect } from "@react-navigation/native";
import { useLoadStore } from "../state/stores/useLoadStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useExternalStore } from "../state/stores/useExternalStore";
import { useSyncStore } from "../state/stores/useSyncStore";
import { useDebugStore } from "../state/stores/useDebugStore";
import type { Session } from "../domain/types";
import { buildAIPromptContext } from "../services/aiContext";
import { DEV_FLAGS } from "../config/devFlags";
import {
  FKS_NextSessionV2,
  ResetChoiceState,
  EnvironmentSelection,
} from "./newSession/types";
import { isSameDay, RESET_VARIANT_FALLBACKS } from "./newSession/helpers";
import { prepareBackendContext, fetchV2, getSessionCache, setSessionCache, clearSessionCache } from "./newSession/api";
import { processV2 } from "./newSession/orchestrator";
import { buildFallbackSession } from "./newSession/fallback";
import { classifyError, ErrorType } from "../utils/errorHandler";
import { showToast } from "../utils/toast";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { ResetVariantModal } from "./newSession/ResetVariantModal";
import { EnvironmentSelector } from "./newSession/ui/EnvironmentSelector";
import { EquipmentSelector } from "./newSession/ui/EquipmentSelector";
import { GenerationActions } from "./newSession/ui/GenerationActions";
import { CurrentSessionCard } from "./newSession/ui/CurrentSessionCard";
import { useAiContextLoader, useEnvironmentEquipment } from "./newSession/hooks";
import { palette } from "./newSession/theme";
import { MICROCYCLES, MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../domain/microcycles";
import { Button } from "../components/ui/Button";
import { trackEvent } from "../services/analytics";
import { buildResetExplain } from "./newSession/resetExplain";
import { useContextualAdvice } from "../hooks/home/useContextualAdvice";
import { toDateKey } from "../utils/dateHelpers";

/** Catalogue matériel (ids alignés avec le profil) */
const EQUIPMENT_CATALOG = [
  // Salle (reprend ProfileSetup)
  { id: "barbell", label: "Barre + poids libres", source: "gym" },
  { id: "squat_rack", label: "Rack à squat", source: "gym" },
  { id: "bench", label: "Banc de musculation", source: "gym" },
  { id: "dumbbells_light", label: "Haltères légers (≤10 kg)", source: "gym" },
  { id: "dumbbells_medium", label: "Haltères moyens (10–25 kg)", source: "gym" },
  { id: "dumbbells_heavy", label: "Haltères lourds (≥25 kg)", source: "gym" },
  { id: "kettlebell", label: "Kettlebells (salle)", source: "gym" },
  { id: "leg_press", label: "Presse (leg press)", source: "gym" },
  { id: "cable_machine", label: "Poulies / câble", source: "gym" },
  { id: "smith_machine", label: "Smith machine", source: "gym" },
  { id: "pullup_bar", label: "Barre de tractions", source: "gym" },
  { id: "box_plyo", label: "Box plyo", source: "gym" },
  { id: "bosu", label: "BOSU", source: "gym" },
  { id: "foam_roller", label: "Foam roller (salle)", source: "gym" },
  { id: "yoga_mat", label: "Tapis (salle)", source: "gym" },
  // Maison / terrain (reprend ProfileSetup)
  { id: "field", label: "Terrain herbe / synthé", source: "pitch" },
  { id: "street_area", label: "City / bitume / parking", source: "pitch" },
  { id: "indoor_small", label: "Petit espace intérieur", source: "home" },
  { id: "cones", label: "Cônes", source: "pitch" },
  { id: "flat_markers", label: "Plots plats", source: "pitch" },
  { id: "speed_ladder", label: "Échelle de rythme", source: "pitch" },
  { id: "mini_hurdles", label: "Petites haies", source: "pitch" },
  { id: "minibands", label: "Mini-bands", source: "home" },
  { id: "long_bands", label: "Élastiques longues", source: "home" },
  { id: "home_dumbbells", label: "Haltères (chez toi)", source: "home" },
  { id: "home_kettlebell", label: "Kettlebell (chez toi)", source: "home" },
  { id: "sandbag", label: "Sandbag", source: "home" },
  { id: "home_foam_roller", label: "Foam roller (chez toi)", source: "home" },
  { id: "home_yoga_mat", label: "Tapis (chez toi)", source: "home" },
  // Fallback générique
  { id: "bodyweight", label: "Poids du corps", source: "both" },
];

/** =====================================================================
 *  APPEL BACKEND — récupère v2 depuis fks-backend
 * ===================================================================== */
// v2ToLocalSession moved to screens/newSession/transform

/** =====================================================================
 *  NAV TYPES
 * ===================================================================== */
type RootStackParamList = {
  Home: undefined;
  NewSession: undefined;
  Feedback: { sessionId?: string } | undefined;
  ExternalLoad: undefined;
  SessionPreview: {
    v2: FKS_NextSessionV2;
    plannedDateISO: string;
    sessionId?: string;
  };
  CycleModal: { mode?: "select" | "manage"; origin?: "home" | "profile" | "newSession" | "feedback" } | undefined;
};

/** =====================================================================
 *  ECRAN
 * ===================================================================== */
export default function NewSessionScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();

  const phase = useSessionsStore((s) => s.phase);
  const sessions = useSessionsStore((s) => s.sessions);
  const pushSession = useSessionsStore((s) => s.pushSession);
  const devNowISO = useDebugStore((s) => s.devNowISO);
  const nextAllowedISO = useLoadStore((s) => s.nextAllowedDateISO);
  const persistPlanned = useSyncStore((s) => s.persistPlannedSession);
  const setLastAiSessionV2 = useSessionsStore(
    (s) => s.setLastAiSessionV2 ?? (() => {})
  );
  const tsb = useLoadStore((s) => s.tsb);
  const clubTrainingDays = useExternalStore((s) => s.clubTrainingDays ?? []);
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);

  const dailyApplied = useLoadStore((s) => s.dailyApplied);
  const lastAppliedDate = useLoadStore((s) => s.lastAppliedDate);
  const advanceDays = useLoadStore((s) => s.advanceDays);
  const restUntil = useLoadStore((s) => s.restUntil);
  const storeHydrated = useSyncStore((s) => s.storeHydrated ?? true);

  const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
  const cycleDef = cycleId ? MICROCYCLES[cycleId] : null;
  const cycleCompleted =
    Boolean(cycleId) &&
    Math.max(0, Math.trunc(microcycleSessionIndex ?? 0)) >= MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  const allowedLocations = cycleDef?.allowedLocations ?? ["gym", "pitch", "home"];

  // IA / backend debug
  const [debugAgent, setDebugAgent] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Contexte IA & matériel / environnement
  const [aiContext, setAiContext] = useState<any | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [environment, setEnvironment] = useState<EnvironmentSelection>([]);
  const [availableEquipment, setAvailableEquipment] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [gymMachinesEnabled, setGymMachinesEnabled] = useState(false);
  const [pitchSmallGearEnabled, setPitchSmallGearEnabled] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [resetChoice, setResetChoice] = useState<ResetChoiceState>(null);
  const [cachePrompt, setCachePrompt] = useState<{
    cached: { v2: FKS_NextSessionV2; debug: Record<string, unknown> };
    preparedCtx: Record<string, unknown>;
    location: string;
    ageMin: number;
  } | null>(null);

  useEffect(() => {
    setEnvironment((prev) => {
      const next = prev.filter((loc) => allowedLocations.includes(loc));
      if (next.length === 0 && allowedLocations.length === 1) {
        return [allowedLocations[0]] as EnvironmentSelection;
      }
      return next as EnvironmentSelection;
    });
  }, [cycleId]);

  useEffect(() => {
    setSetupDone(false);
    setCachePrompt(null);
  }, [environment.join("|"), selectedEquipment.join("|")]);

  const current: Session | undefined = useMemo(
    () => {
      const nowDate = devNowISO ? new Date(devNowISO) : new Date();
      const oldestAllowedKey = toDateKey(subDays(nowDate, 2));
      const withDate = sessions
        .filter((s) => !s.completed)
        .filter((s) => {
          const day = toDateKey(s.dateISO ?? s.date);
          if (!day) return true;
          return day >= oldestAllowedKey;
        })
        .sort((a, b) => {
          const da = toDateKey(a.dateISO ?? a.date) || "9999-12-31";
          const db = toDateKey(b.dateISO ?? b.date) || "9999-12-31";
          if (da === db) {
            const ca = new Date(a.createdAt ?? 0).getTime();
            const cb = new Date(b.createdAt ?? 0).getTime();
            return ca - cb;
          }
          return da.localeCompare(db);
        });
      return withDate[0];
    },
    [sessions, devNowISO]
  );

  const now = devNowISO ? new Date(devNowISO) : new Date();
  const isBeforeNextAllowed = nextAllowedISO
    ? now.getTime() < new Date(nextAllowedISO).getTime()
    : false;
  const allowSameDayInDev = DEV_FLAGS.ENABLED;
  const alreadyAppliedToday =
    !allowSameDayInDev &&
    !!lastAppliedDate &&
    dailyApplied &&
    isSameDay(new Date(lastAppliedDate), now);

  // Conseil contextuel pour guider le joueur
  const advice = useContextualAdvice();

  const isResetPlan = (v2: FKS_NextSessionV2) =>
    v2?.archetypeId === "foundation_X_reset" ||
    (v2?.selectionDebug?.reasons || []).includes("reset_selected");

  const buildResetVariants = (v2: FKS_NextSessionV2) => {
    if (Array.isArray(v2.resetVariants) && v2.resetVariants.length) {
      return v2.resetVariants.map((rv) => ({
        id: rv.id,
        title: rv.title ?? rv.id,
        subtitle: rv.subtitle ?? "RPE 3–4 · 12–16 min · zéro fatigue",
        durationMin: rv.durationMin,
        blocks: rv.blocks,
        display: rv.display,
      }));
    }
    return RESET_VARIANT_FALLBACKS;
  };

  const handleSelectResetVariant = async (variantId: string) => {
    if (!resetChoice) return;
    setGenerating(true);
    const chosen =
      resetChoice.variants.find((v) => v.id === variantId) ?? resetChoice.variants[0];
    const merged: FKS_NextSessionV2 = {
      ...resetChoice.v2,
      title: chosen.title || resetChoice.v2.title,
      subtitle: chosen.subtitle || resetChoice.v2.subtitle,
      durationMin: chosen.durationMin ?? resetChoice.v2.durationMin,
      blocks: chosen.blocks ?? resetChoice.v2.blocks,
      display: chosen.display ?? resetChoice.v2.display,
      selectionDebug: {
        ...(resetChoice.v2.selectionDebug ?? {}),
        resetVariantId: chosen.id,
      },
    };
    setResetChoice(null);
    setDebugAgent(resetChoice.debug);
    await processV2({
      v2: merged,
      location: resetChoice.location,
      phase,
      now,
      clubTrainingDays,
      tsb,
      alreadyAppliedToday,
      pushSession,
      persistPlanned,
      setLastAiSessionV2,
      navigate: ({ v2, plannedDateISO, sessionId }) =>
        nav.navigate("SessionPreview", {
          v2,
          plannedDateISO,
          sessionId,
        }),
      alertPlanified: (dateISO: string) => {
        showToast({ type: "info", title: "Planifiée pour demain", message: `Séance planifiée pour le ${dateISO}.` });
      },
    });
    trackEvent("session_generate_success", {
      cycleId: cycleId ?? "none",
      location: resetChoice.location,
      resetVariantId: chosen.id,
    });
  };

  /** ------------------------------------------------------------------
   *  Chargement du contexte IA dès l'ouverture de l'écran
   * ------------------------------------------------------------------ */
  useAiContextLoader(storeHydrated, {
    aiContext,
    setAiContext,
    contextLoading,
    setContextLoading,
    setAvailableEquipment,
    setSelectedEquipment,
  }, Boolean(cycleId) && !cycleCompleted);

  useEnvironmentEquipment(
    environment,
    availableEquipment,
    EQUIPMENT_CATALOG,
    setSelectedEquipment,
    { gymMachinesEnabled, pitchSmallGearEnabled }
  );

  // Block back navigation while generating (prevents setState on unmounted component)
  useEffect(() => {
    const unsubscribe = nav.addListener("beforeRemove", (e: any) => {
      if (!generating) return;
      e.preventDefault();
    });
    return unsubscribe;
  }, [nav, generating]);

  // Disable header back button while generating
  useEffect(() => {
    (nav as any).setOptions?.({ headerBackVisible: !generating });
  }, [nav, generating]);

  // Fallback : auto-open CycleModal si arrivé sans cycle actif (anti-boucle via ref)
  const cyclePickerAutoOpened = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!storeHydrated) return;
      if (cycleId && !cycleCompleted) return;
      if (cyclePickerAutoOpened.current) return;
      cyclePickerAutoOpened.current = true;
      nav.navigate("CycleModal", { mode: "select", origin: "newSession" });
    }, [storeHydrated, cycleId, cycleCompleted, nav])
  );

  // Reset le flag quand un cycle devient actif (pour permettre un re-trigger si le cycle change)
  useEffect(() => {
    if (cycleId && !cycleCompleted) {
      cyclePickerAutoOpened.current = false;
    }
  }, [cycleId, cycleCompleted]);

  /** ------------------------------------------------------------------
   *  GÉNÉRATION DE SÉANCE
   * ------------------------------------------------------------------ */
  const handleGenerate = async () => {
    try {
      if (!cycleId) {
        showToast({ type: "warn", title: "Choisir un cycle", message: "Choisis ton cycle (playlist) avant de générer des séances." });
        nav.navigate("CycleModal", { mode: "select", origin: "newSession" });
        return;
      }
      if (cycleCompleted) {
        showToast({ type: "info", title: "Cycle terminé", message: "Bien joué. Choisis un nouveau cycle pour continuer." });
        nav.navigate("CycleModal", { mode: "select", origin: "newSession" });
        return;
      }

      if (isBeforeNextAllowed) {
        const d = nextAllowedISO ? new Date(nextAllowedISO) : null;
        const dateLabel = d
          ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
          : null;
        showToast({
          type: "info",
          title: "Repos programmé",
          message: dateLabel
            ? `Repos jusqu'au ${dateLabel} — reviens te reposer avant ta prochaine séance !`
            : "Une période de repos est programmée. Reviens bientôt !",
        });
        return;
      }

      if (environment.length === 0) {
        showToast({ type: "warn", title: "Lieu manquant", message: "Choisis au moins un lieu : salle, terrain ou chez toi." });
        return;
      }

      if (!selectedEquipment.length) {
        showToast({ type: "warn", title: "Matériel manquant", message: "Sélectionne au moins un matériel disponible." });
        return;
      }

      if (!setupDone) {
        showToast({ type: "warn", title: "Contexte incomplet", message: "Valide d'abord ton lieu et ton matériel." });
        return;
      }

      trackEvent("session_generate_start", {
        cycleId,
        locations: environment,
      });

      setGenerating(true);

      // On reconstruit le contexte à chaque génération pour refléter microcycle/index/goal à jour.
      setContextLoading(true);
      const ctx = await buildAIPromptContext();
      setAiContext(ctx);
      setContextLoading(false);

      const { context: preparedCtx, location } = prepareBackendContext(
        ctx,
        selectedEquipment,
        environment
      );

      // 2) Vérifier le cache avant l'appel API
      const cached = await getSessionCache(preparedCtx);
      if (cached) {
        setGenerating(false);
        setCachePrompt({
          cached: { v2: cached.v2, debug: cached.debug },
          preparedCtx,
          location,
          ageMin: Math.max(1, Math.round(cached.ageMs / 60000)),
        });
        return;
      }

      // 3) Appel backend → workflow → v2
      const { v2, debug } = await fetchV2(preparedCtx);
      await setSessionCache(preparedCtx, { v2, debug });
      if (isResetPlan(v2)) {
        const variants = buildResetVariants(v2).map((rv) => ({
          ...rv,
          title: rv.title || "Prime reset",
          subtitle:
            rv.subtitle ??
            "RPE 3–4 · 12–16 min · zéro fatigue",
        }));
        trackEvent("session_generate_reset", {
          cycleId,
          location,
          variantCount: variants.length,
        });
        setResetChoice({ v2, debug, variants, location });
        setGenerating(false);
        return;
      }

      setDebugAgent(debug);
      await processV2({
        v2,
        location,
        phase,
        now,
        clubTrainingDays,
        tsb,
        alreadyAppliedToday,
      pushSession,
      persistPlanned,
      setLastAiSessionV2,
      navigate: ({ v2, plannedDateISO, sessionId }) =>
        nav.navigate("SessionPreview", {
          v2,
          plannedDateISO,
          sessionId,
          }),
        alertPlanified: (dateISO: string) => {
          showToast({ type: "info", title: "Planifiée pour demain", message: `Séance planifiée pour le ${dateISO}.` });
        },
      });
      trackEvent("session_generate_success", {
        cycleId,
        location,
      });
    } catch (err: any) {
      if (err?.code === "AUTH_REQUIRED") {
        showToast({ type: "error", title: "Connexion requise", message: "Connecte-toi pour enregistrer la séance." });
        return;
      }

      // Classifier l'erreur pour obtenir un message clair
      const appError = classifyError(err);
      trackEvent("session_generate_error", {
        cycleId: cycleId ?? "none",
        code: err?.code ?? "unknown",
        type: appError.type,
      });

      // Log en mode dev pour debug
      if (__DEV__) {
        console.error("Generate & persist planned session failed", {
          type: appError.type,
          message: appError.message,
          technical: appError.technicalDetails,
        });
      }

      // Si c'est une erreur réseau/serveur/timeout, on utilise le fallback
      const shouldUseFallback =
        appError.type === ErrorType.NETWORK ||
        appError.type === ErrorType.SERVER ||
        appError.type === ErrorType.TIMEOUT;

      if (shouldUseFallback) {
        const todayISO = toDateKey(now);
        const { session, aiV2 } = buildFallbackSession(todayISO, phase as any);
        pushSession({ ...session, aiV2 } as any);
        showToast({ type: "warn", title: "Séance de secours", message: "Une séance cardio+mobilité de secours a été préparée pour toi." });
        nav.navigate("SessionPreview", {
          v2: aiV2 as any,
          plannedDateISO: todayISO,
          sessionId: session.id,
        });
      } else {
        showToast({ type: "error", title: appError.type === ErrorType.VALIDATION ? "Données invalides" : "Erreur", message: appError.userMessage });
      }
    } finally {
      setGenerating(false);
    }
  };

  const goFeedback = () => {
    if (!current) return;
    nav.navigate("Feedback", { sessionId: current.id });
  };

  const useCachedSession = async () => {
    if (!cachePrompt) return;
    const { cached, location } = cachePrompt;
    setCachePrompt(null);
    setGenerating(true);
    try {
      const { v2, debug } = cached;
      if (isResetPlan(v2)) {
        const variants = buildResetVariants(v2).map((rv) => ({
          ...rv,
          title: rv.title || "Prime reset",
          subtitle: rv.subtitle ?? "RPE 3–4 · 12–16 min · zéro fatigue",
        }));
        setResetChoice({ v2, debug, variants, location });
        setGenerating(false);
        return;
      }
      setDebugAgent(debug);
      await processV2({
        v2,
        location,
        phase,
        now,
        clubTrainingDays,
        tsb,
        alreadyAppliedToday,
        pushSession,
        persistPlanned,
        setLastAiSessionV2,
        navigate: ({ v2: navV2, plannedDateISO, sessionId }) =>
          nav.navigate("SessionPreview", { v2: navV2, plannedDateISO, sessionId }),
        alertPlanified: (dateISO: string) => {
          showToast({ type: "info", title: "Planifiée pour demain", message: `Séance planifiée pour le ${dateISO}.` });
        },
      });
      trackEvent("session_generate_from_cache", { cycleId });
    } catch {
      showToast({ type: "error", title: "Erreur", message: "Impossible de charger la séance en cache." });
    } finally {
      setGenerating(false);
    }
  };

  const regenerateIgnoringCache = async () => {
    setCachePrompt(null);
    await clearSessionCache();
    handleGenerate();
  };

  /** ------------------------------------------------------------------
   *  RENDER
   * ------------------------------------------------------------------ */
  const generateLabel =
    !storeHydrated
      ? "Chargement de ton historique..."
      : environment.includes("gym")
      ? "Générer une séance pour la salle"
      : environment.includes("pitch")
      ? "Générer une séance sur terrain"
      : environment.includes("home")
      ? "Générer une séance chez toi"
      : alreadyAppliedToday
      ? "Générer une séance (planifiée demain)"
      : "Générer une séance";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} edges={["right", "left", "bottom"]}>
      {resetChoice && (
        <ResetVariantModal
          variants={resetChoice.variants}
          onSelect={handleSelectResetVariant}
          explain={buildResetExplain(
            resetChoice.v2,
            resetChoice.debug,
            resetChoice.location,
            aiContext?.profile ?? null
          )}
          onCancel={() => {
            setResetChoice(null);
            setGenerating(false);
          }}
        />
      )}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
      {/* HEADER SIMPLE */}
	      <View style={{ marginBottom: 8 }}>
	        <Text style={styles.headerTitle}>Nouvelle séance FKS</Text>
	        <Text style={styles.headerSubtitle}>
	          Choisis ton contexte et ton matériel, FKS s’occupe du reste.
	        </Text>
	      </View>

        {!cycleId ? (
          <View style={[styles.card, styles.cycleGateCard]}>
            <Text style={styles.cardTitle}>Choisis ton cycle</Text>
            <Text style={styles.cardSubtitle}>
              Pour générer des séances cohérentes, sélectionne un cycle (playlist). Tu pourras le gérer ensuite depuis ton profil.
            </Text>
            <Button
              label="Choisir mon cycle"
              onPress={() => nav.navigate("CycleModal", { mode: "select", origin: "newSession" })}
              fullWidth
            />
          </View>
        ) : cycleCompleted ? (
          <View style={[styles.card, styles.cycleGateCard]}>
            <Text style={styles.cardTitle}>Cycle terminé</Text>
            <Text style={styles.cardSubtitle}>
              {cycleDef?.label ?? "Ton cycle"} est complété ({MICROCYCLE_TOTAL_SESSIONS_DEFAULT}/{MICROCYCLE_TOTAL_SESSIONS_DEFAULT}). Choisis un nouveau cycle pour continuer.
            </Text>
            <Button
              label="Choisir un nouveau cycle"
              onPress={() => nav.navigate("CycleModal", { mode: "select", origin: "newSession" })}
              fullWidth
            />
            <Button
              label="Voir mon cycle"
              variant="ghost"
              onPress={() => nav.navigate("CycleModal", { mode: "manage", origin: "newSession" } as any)}
              fullWidth
            />
          </View>
        ) : (
          <View style={[styles.card, styles.cycleMiniCard]}>
            <View style={styles.cycleMiniRow}>
              <Text style={styles.cycleMiniText}>
                Cycle : <Text style={{ fontWeight: "800" }}>{cycleDef?.label ?? "—"}</Text>
              </Text>
              <Button
                label="Gérer"
                variant="ghost"
                size="sm"
                onPress={() => nav.navigate("CycleModal", { mode: "manage", origin: "newSession" } as any)}
              />
            </View>
          </View>
        )}

	      {/* SI PAS DE SÉANCE EN COURS */}
	      {!current ? (
	        cycleId && !cycleCompleted ? (
            <>
	          <View style={styles.card}>
	            <EnvironmentSelector
                environment={environment}
                setEnvironment={setEnvironment}
                allowed={allowedLocations}
                currentCycleId={cycleId}
              />
	          </View>

          <View style={styles.card}>
            <EquipmentSelector
              catalog={EQUIPMENT_CATALOG as any}
              environment={environment}
              availableEquipment={availableEquipment}
              selectedEquipment={selectedEquipment}
              contextLoading={contextLoading}
              onSelect={setSelectedEquipment}
              gymMachinesEnabled={gymMachinesEnabled}
              onToggleGymMachines={(next) => {
                setGymMachinesEnabled(next);
                setSetupDone(false);
              }}
              pitchSmallGearEnabled={pitchSmallGearEnabled}
              onTogglePitchSmallGear={(next) => {
                setPitchSmallGearEnabled(next);
                setSetupDone(false);
              }}
              onValidateContext={() => {
                setSetupDone(true);
                showToast({ type: "success", title: "Contexte validé", message: "Tu peux lancer la génération." });
              }}
              setupDone={setupDone}
            />
          </View>

          {/* Cache prompt */}
          {cachePrompt && setupDone ? (
            <View style={[styles.card, { gap: 10 }]}>
              <Text style={styles.cardTitle}>Séance récente en cache</Text>
              <Text style={styles.cardSubtitle}>
                Une séance a été générée il y a {cachePrompt.ageMin} min avec les mêmes paramètres.
              </Text>
              <Button
                label="Utiliser cette séance"
                onPress={useCachedSession}
                fullWidth
              />
              <Button
                label="Générer une nouvelle"
                variant="ghost"
                onPress={regenerateIgnoringCache}
                fullWidth
              />
            </View>
          ) : null}

          {/* Étape 2 : CTA Génération (affiché après validation) */}
	          {setupDone && !cachePrompt ? (
	            <GenerationActions
	              disabled={isBeforeNextAllowed || contextLoading || generating || !storeHydrated || !!current}
	              generating={generating}
	              label={generateLabel}
	              onGenerate={handleGenerate}
	              onAdvanceDay={() => advanceDays(1)}
	              onRestTwoDays={() => restUntil(2)}
	              storeHydrated={storeHydrated}
	              nextAllowedISO={nextAllowedISO}
	              alreadyAppliedToday={alreadyAppliedToday}
	              advice={advice}
	            />
		          ) : null}
		        </>
	          ) : null
		      ) : (
	        // SI UNE SÉANCE EST DÉJÀ EN COURS
	        <CurrentSessionCard
	          current={current}
          nextAllowedISO={nextAllowedISO}
          alreadyAppliedToday={alreadyAppliedToday}
          onFeedback={goFeedback}
          onAdvanceDay={() => advanceDays(1)}
          onRestTwoDays={() => restUntil(2)}
        />
      )}

      {/* Bloc debug replié — dev only */}
      {__DEV__ && debugAgent && (
        <View style={[styles.card, { marginTop: 12 }]}>
          <TouchableOpacity
            onPress={() => setShowDebug((v) => !v)}
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={styles.cardTitle}>Debug backend (optionnel)</Text>
            <Text style={{ color: palette.accentSoft, fontSize: 12 }}>
              {showDebug ? "Masquer" : "Afficher"}
            </Text>
          </TouchableOpacity>
          {showDebug && (
            <Text style={styles.debugText}>
              {JSON.stringify(debugAgent, null, 2)}
            </Text>
          )}
        </View>
      )}
      </ScrollView>

      <LoadingOverlay
        visible={generating}
        steps={[
          "Analyse de ton profil et ta charge...",
          "Sélection des exercices adaptés...",
          "Construction des blocs d'entraînement...",
          "Personnalisation selon tes contraintes...",
          "Vérification et finalisation...",
        ]}
        estimatedDurationMs={25000}
      />
    </SafeAreaView>
  );
}

/** =====================================================================
 *  STYLES
 * ===================================================================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: palette.text,
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: palette.sub,
    marginTop: 4,
  },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 18,
    backgroundColor: palette.card,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.text,
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: 4,
    color: palette.sub,
  },
  cycleGateCard: {
    gap: 12,
  },
  cycleMiniCard: {
    paddingVertical: 12,
  },
  cycleMiniRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cycleMiniText: {
    flex: 1,
    fontSize: 13,
    color: palette.text,
  },
  debugText: {
    marginTop: 8,
    fontSize: 11,
    color: palette.sub,
  },
});
