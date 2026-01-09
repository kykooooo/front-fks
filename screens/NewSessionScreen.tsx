// src/screens/NewSessionScreen.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDaysISO } from "../utils/virtualClock";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { useTrainingStore } from "../state/trainingStore";
import type { Session } from "../domain/types";
import { buildAIPromptContext } from "../services/aiContext";
import { DEV_FLAGS } from "../config/devFlags";
import {
  FKS_NextSessionV2,
  ResetChoiceState,
  EnvironmentSelection,
} from "./newSession/types";
import { isSameDay, RESET_VARIANT_FALLBACKS } from "./newSession/helpers";
import { prepareBackendContext, fetchV2 } from "./newSession/api";
import { processV2 } from "./newSession/orchestrator";
import { buildFallbackSession } from "./newSession/fallback";
import { ResetVariantModal } from "./newSession/ResetVariantModal";
import { EnvironmentSelector } from "./newSession/ui/EnvironmentSelector";
import { EquipmentSelector } from "./newSession/ui/EquipmentSelector";
import { GenerationActions } from "./newSession/ui/GenerationActions";
import { CurrentSessionCard } from "./newSession/ui/CurrentSessionCard";
import { useAiContextLoader, useEnvironmentEquipment } from "./newSession/hooks";
import { palette } from "./newSession/theme";

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
  { id: "swiss_ball", label: "Swiss ball (salle)", source: "gym" },
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
  { id: "medicine_ball", label: "Médecine ball", source: "home" },
  { id: "sandbag", label: "Sandbag", source: "home" },
  { id: "home_foam_roller", label: "Foam roller (chez toi)", source: "home" },
  { id: "home_yoga_mat", label: "Tapis (chez toi)", source: "home" },
  { id: "home_swiss_ball", label: "Swiss ball (chez toi)", source: "home" },
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
};

/** =====================================================================
 *  ECRAN
 * ===================================================================== */
export default function NewSessionScreen() {
  const nav = useNavigation<NavigationProp<RootStackParamList>>();

  const phase = useTrainingStore((s) => s.phase);
  const sessions = useTrainingStore((s) => s.sessions);
  const pushSession = useTrainingStore((s) => s.pushSession);
  const devNowISO = useTrainingStore((s) => s.devNowISO);
  const nextAllowedISO = useTrainingStore((s) => s.nextAllowedDateISO);
  const persistPlanned = useTrainingStore((s) => s.persistPlannedSession);
  const setLastAiSessionV2 = useTrainingStore(
    (s) => (s as any).setLastAiSessionV2
  );
  const tsb = useTrainingStore((s) => s.tsb);
  const clubTrainingDays = useTrainingStore((s) => s.clubTrainingDays ?? []);

  const dailyApplied = useTrainingStore((s) => s.dailyApplied);
  const lastAppliedDate = useTrainingStore((s) => s.lastAppliedDate);
  const advanceDays = useTrainingStore((s) => s.advanceDays);
  const restUntil = useTrainingStore((s) => s.restUntil);
  const storeHydrated = useTrainingStore((s) => (s as any).storeHydrated ?? true);

  // IA / backend debug
  const [debugAgent, setDebugAgent] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Contexte IA & matériel / environnement
  const [aiContext, setAiContext] = useState<any | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [environment, setEnvironment] = useState<EnvironmentSelection>([]);
  const [availableEquipment, setAvailableEquipment] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [setupDone, setSetupDone] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [resetChoice, setResetChoice] = useState<ResetChoiceState>(null);

  const current: Session | undefined = useMemo(
    () =>
      sessions.find((s) => {
        if (s.completed) return false;
        const day = (s.dateISO ?? (s as any).date ?? "").slice(0, 10);
        if (!day) return true;
        const today = (devNowISO ?? new Date().toISOString()).slice(0, 10);
        // ignore planned trop anciennes (avant avant-hier)
        return day >= addDaysISO(today, -2).slice(0, 10);
      }),
    [sessions]
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

  const isResetPlan = (v2: FKS_NextSessionV2) =>
    v2?.archetype_id === "foundation_X_reset" ||
    (v2?.selection_debug?.reasons || []).includes("reset_selected");

  const buildResetVariants = (v2: FKS_NextSessionV2) => {
    if (Array.isArray(v2.reset_variants) && v2.reset_variants.length) {
      return v2.reset_variants.map((rv) => ({
        id: rv.id,
        title: rv.title ?? rv.id,
        subtitle: rv.subtitle ?? "RPE 3–4 · 12–16 min · zéro fatigue",
        duration_min: rv.duration_min,
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
      duration_min: chosen.duration_min ?? resetChoice.v2.duration_min,
      blocks: chosen.blocks ?? resetChoice.v2.blocks,
      display: chosen.display ?? resetChoice.v2.display,
      selection_debug: {
        ...(resetChoice.v2.selection_debug ?? {}),
        reset_variant_id: chosen.id,
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
        Alert.alert(
          "Planifiée pour demain",
          `Tu as déjà validé une séance aujourd’hui. Celle-ci est planifiée pour le ${dateISO}.`
        );
      },
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
  });

  useEnvironmentEquipment(
    environment,
    availableEquipment,
    EQUIPMENT_CATALOG,
    setSelectedEquipment
  );

  /** ------------------------------------------------------------------
   *  GÉNÉRATION DE SÉANCE
   * ------------------------------------------------------------------ */
  const handleGenerate = async () => {
    try {
      if (isBeforeNextAllowed) {
        const d = nextAllowedISO ? new Date(nextAllowedISO) : null;
        Alert.alert(
          "Repos planifié",
          d
            ? `Tu as prévu du repos jusqu’au ${d.toISOString().slice(0, 10)}.`
            : "Repos planifié."
        );
        return;
      }

      if (environment.length === 0) {
        Alert.alert(
          "Lieu d’entraînement",
          "Choisis au moins un lieu : salle, terrain ou chez toi (tu peux en sélectionner 2)."
        );
        return;
      }

      if (!selectedEquipment.length) {
        Alert.alert(
          "Matériel requis",
          "Sélectionne au moins un matériel disponible avant de générer ta séance."
        );
        return;
      }

      if (!setupDone) {
        Alert.alert("Contexte incomplet", "Valide d'abord ton lieu et ton matériel.");
        return;
      }

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

      // 2) Appel backend → workflow → v2
      const { v2, debug } = await fetchV2(preparedCtx);
      if (isResetPlan(v2)) {
        const variants = buildResetVariants(v2).map((rv) => ({
          ...rv,
          title: rv.title || "Prime reset",
          subtitle:
            rv.subtitle ??
            "RPE 3–4 · 12–16 min · zéro fatigue",
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
      navigate: ({ v2, plannedDateISO, sessionId }) =>
        nav.navigate("SessionPreview", {
          v2,
          plannedDateISO,
          sessionId,
          }),
        alertPlanified: (dateISO: string) => {
          Alert.alert(
            "Planifiée pour demain",
            `Tu as déjà validé une séance aujourd’hui. Celle-ci est planifiée pour le ${dateISO}.`
          );
        },
      });
    } catch (err: any) {
      if (err?.code === "AUTH_REQUIRED") {
        Alert.alert(
          "Connexion requise",
          "Connecte-toi pour enregistrer la séance."
        );
        return;
      }
      console.warn("Generate & persist planned session failed", err);
      const isBackendFailure =
        typeof err?.message === "string" &&
        (err.message.includes("Backend") || err.message.includes("Network") || err.message.includes("fetch"));
      if (isBackendFailure) {
        const todayISO = now.toISOString().slice(0, 10);
        const { session, aiV2 } = buildFallbackSession(todayISO, phase as any);
        pushSession({ ...session, aiV2 } as any);
        Alert.alert(
          "Fallback appliqué",
          "Impossible de générer via l'IA. Séance cardio+mobilité de secours prête."
        );
        nav.navigate("SessionPreview", {
          v2: aiV2 as any,
          plannedDateISO: todayISO,
          sessionId: session.id,
        });
      } else {
        Alert.alert("Erreur", "Impossible de générer la séance pour le moment.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const goFeedback = () => {
    if (!current) return;
    nav.navigate("Feedback", { sessionId: current.id });
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
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      {resetChoice && (
        <ResetVariantModal
          variants={resetChoice.variants}
          onSelect={handleSelectResetVariant}
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

      {/* SI PAS DE SÉANCE EN COURS */}
      {!current ? (
        <>
          <View style={styles.card}>
            <EnvironmentSelector environment={environment} setEnvironment={setEnvironment} />
          </View>

          <View style={styles.card}>
            <EquipmentSelector
              catalog={EQUIPMENT_CATALOG as any}
              environment={environment}
              availableEquipment={availableEquipment}
              selectedEquipment={selectedEquipment}
              contextLoading={contextLoading}
              onSelect={setSelectedEquipment}
              onValidateContext={() => {
                setSetupDone(true);
                Alert.alert("Contexte validé", "Tu peux lancer la génération de ta séance.");
              }}
              setupDone={setupDone}
            />
          </View>

          {/* Étape 2 : CTA Génération (affiché après validation) */}
          {setupDone ? (
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
            />
          ) : null}
        </>
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

      {/* Bloc debug replié */}
      {debugAgent && (
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
  debugText: {
    marginTop: 8,
    fontSize: 11,
    color: palette.sub,
  },
});
