// src/screens/NewSessionScreen.tsx
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuth } from "firebase/auth";
import { Screen } from "../components/ui/Screen";
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
import { isSameDay, resolveResetVariants } from "./newSession/helpers";
import { prepareBackendContext, fetchV2, getSessionCache, setSessionCache, clearSessionCache } from "./newSession/api";
import { processV2, rejouerApresEchecPostGeneration } from "./newSession/orchestrator";
import {
  creerVerrouGeneration,
  decisionApresEchec,
  type DecisionApresEchec,
} from "./newSession/echecGeneration";
import { CarteEchecGeneration } from "./newSession/ui/CarteEchecGeneration";
import { showToast } from "../utils/toast";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { ResetVariantModal } from "./newSession/ResetVariantModal";
import { EnvironmentSelector } from "./newSession/ui/EnvironmentSelector";
import { EquipmentSelector, HOME_EQUIPMENT, GYM_SPECIAL_EQUIPMENT } from "./newSession/ui/EquipmentSelector";
import { GenerationActions } from "./newSession/ui/GenerationActions";
import { CurrentSessionCard } from "./newSession/ui/CurrentSessionCard";
import { useAiContextLoader, useEnvironmentEquipment } from "./newSession/hooks";
import { categorieAgeAbsente, TOAST_CATEGORIE_MANQUANTE } from "./newSession/gardeCategorieAge";
import { construireLibelles } from "./newSession/resumeContexte";
import { da, PLAFOND_TITRE, PLAFOND_TEXTE } from "../constants/daJoueur";
import { DaCard } from "../components/ui/da/DaCard";
import { DaPrimaryButton } from "../components/ui/da/DaPrimaryButton";
import { DaTextButton } from "../components/ui/da/DaTextButton";
import { DaNotice } from "../components/ui/da/DaNotice";
import { MICROCYCLES, MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId, getRecommendedLocation } from "../domain/microcycles";
import { getMicrocyclePhase } from "../utils/microcycleUtils";
import { trackEvent } from "../services/analytics";
import { STORAGE_KEYS } from "../constants/storage";
import { buildResetExplain } from "./newSession/resetExplain";
import { useContextualAdvice } from "../hooks/home/useContextualAdvice";
import { toDateKey, formatDayFR } from "../utils/dateHelpers";
import { selectPendingSession } from "../utils/sessionHelpers";

/** Catalogue matériel (ids alignés avec le profil) */
export const EQUIPMENT_CATALOG = [
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
  Tabs: { screen?: "Home" | "NewSession" | "Profile" } | undefined;
  Feedback: { sessionId?: string } | undefined;
  ExternalLoad: undefined;
  SessionPreview: {
    v2: FKS_NextSessionV2;
    plannedDateISO: string;
    sessionId?: string;
  };
  CycleModal: { mode?: "select" | "manage"; origin?: "home" | "profile" | "newSession" | "feedback" } | undefined;
  MonCorps: { ouvrirAjout?: boolean; source?: "feedback" | "manual" | "setup" } | undefined;
  /** Questionnaire profil en édition — cible de la garde « catégorie manquante ». */
  ProfileSetup: undefined;
};

/** Funnel analytics : mesure Register → 1ère séance générée (fire once, timestamp consommé). */
const trackFirstSessionGeneratedIfNeeded = async () => {
  const startedAtRaw = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_START_TS);
  if (!startedAtRaw) return;
  await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_START_TS);
  const startedAt = Number(startedAtRaw);
  if (!Number.isFinite(startedAt)) return;
  const minutesSinceRegister = Math.round(((Date.now() - startedAt) / 60000) * 10) / 10;
  trackEvent("first_session_generated", { minutesSinceRegister });
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
  const persistPlanned = useSyncStore((s) => s.persistPlannedSession);
  const setLastAiSessionV2 = useSessionsStore(
    (s) => s.setLastAiSessionV2 ?? (() => {})
  );
  const tsb = useLoadStore((s) => s.tsb);
  const clubTrainingDays = useExternalStore((s) => s.clubTrainingDays ?? []);
  // Garde solo (transform) : même source d'âge que SessionLiveScreen.
  const ageCategory = useExternalStore((s) => s.ageCategory ?? null);
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);

  const dailyApplied = useLoadStore((s) => s.dailyApplied);
  const lastAppliedDate = useLoadStore((s) => s.lastAppliedDate);
  const advanceDays = useLoadStore((s) => s.advanceDays);
  const storeHydrated = useSyncStore((s) => s.storeHydrated ?? true);

  const cycleId = isMicrocycleId(microcycleGoal) ? microcycleGoal : null;
  const cycleDef = cycleId ? MICROCYCLES[cycleId] : null;
  const cycleCompleted =
    Boolean(cycleId) &&
    Math.max(0, Math.trunc(microcycleSessionIndex ?? 0)) >= MICROCYCLE_TOTAL_SESSIONS_DEFAULT;
  const allowedLocations = cycleDef?.allowedLocations ?? ["gym", "pitch", "home"];
  // Phase d'affichage dérivée (jamais le champ session.phase qui vaut "Playlist").
  const cyclePhase = cycleId ? getMicrocyclePhase(microcycleSessionIndex, MICROCYCLE_TOTAL_SESSIONS_DEFAULT) : null;

  // IA / backend debug
  const [debugAgent, setDebugAgent] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Contexte IA & matériel / environnement
  const [aiContext, setAiContext] = useState<any | null>(null);
  // ── CATÉGORIE D'ÂGE MANQUANTE ────────────────────────────────────────────
  // Source : le contexte IA, qui vient d'un `getDoc` FRAIS de `users/{uid}`
  // (services/aiContext) — pas du store, dont la valeur peut n'avoir jamais été
  // synchronisée sur une installation neuve et ferait alors bloquer un joueur
  // parfaitement en règle. Tant que le contexte n'est pas chargé (`null`), on
  // ne conclut RIEN : ne pas savoir n'est pas « absent » (règle 12).
  const categorieAgeManquante = !!aiContext && categorieAgeAbsente(aiContext);
  const [contextLoading, setContextLoading] = useState(false);
  const [environment, setEnvironment] = useState<EnvironmentSelection>([]);
  const [availableEquipment, setAvailableEquipment] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [pitchSmallGearEnabled, setPitchSmallGearEnabled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [wakingServer, setWakingServer] = useState(false);
  // Rejeu d'enregistrement (reessayerEnregistrement) : contrairement a
  // handleGenerate, ce rejeu n'a pas de jeton d'annulation (generationIdRef) —
  // il va au bout quoi qu'il arrive. L'overlay ne doit donc jamais y proposer
  // un bouton "Annuler" qui mentirait au joueur ("Génération annulée" alors
  // que le rejeu continue et peut naviguer juste après).
  const [rejeuEnCours, setRejeuEnCours] = useState(false);
  const [resetChoice, setResetChoice] = useState<ResetChoiceState>(null);
  // État d'échec : une panne reste une panne. Jamais de séance fabriquée ici.
  const [echec, setEchec] = useState<DecisionApresEchec | null>(null);
  // Reflet UI du verrou : tant qu'une requête est en vol (même après un
  // "Annuler", qui n'interrompt pas l'appel), on ne relance pas — ce serait
  // une deuxième génération payante en parallèle.
  const [requeteEnVol, setRequeteEnVol] = useState(false);
  const [cachePrompt, setCachePrompt] = useState<{
    cached: { v2: FKS_NextSessionV2; debug: Record<string, unknown> };
    preparedCtx: Record<string, unknown>;
    location: string;
    ageMin: number;
  } | null>(null);

  // Table id -> libellé, pour le récap du pied collant (resumerContexte).
  const libellesEquipement = useMemo(
    () => construireLibelles(EQUIPMENT_CATALOG, HOME_EQUIPMENT, GYM_SPECIAL_EQUIPMENT),
    []
  );

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setEnvironment((prev) => {
      const next = prev.filter((loc) => allowedLocations.includes(loc));
      if (next.length === 0 && allowedLocations.length === 1) {
        return [allowedLocations[0]] as EnvironmentSelection;
      }
      // Rien de sélectionné : on présélectionne le lieu conseillé pour le
      // cycle actif (si le moteur en propose un), sans jamais écraser un
      // choix déjà fait par le joueur. Non bloquant : reste modifiable.
      if (next.length === 0 && cycleId) {
        const reco = getRecommendedLocation(cycleId);
        if (reco && allowedLocations.includes(reco.location)) {
          return [reco.location] as EnvironmentSelection;
        }
      }
      return next as EnvironmentSelection;
    });
  }, [cycleId]);

  useEffect(() => {
    setCachePrompt(null);
    // Le joueur a changé son contexte : l'échec précédent ne le décrit plus.
    setEchec(null);
  }, [environment.join("|"), selectedEquipment.join("|")]);

  // Défilement jusqu'à la carte d'échec ou de cache à leur apparition (spec
  // §3.8) : sans ça, un joueur qui a beaucoup scrollé ne les voit jamais.
  useEffect(() => {
    if (echec || cachePrompt) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [echec, cachePrompt]);

  // Même fenêtre que FeedbackScreen (aujourd'hui, J-1, J-2, demain) : une
  // séance zombie hors fenêtre ne bloque plus la génération.
  const current: Session | undefined = useMemo(
    () => {
      const nowDate = devNowISO ? new Date(devNowISO) : new Date();
      return selectPendingSession(sessions, toDateKey(nowDate));
    },
    [sessions, devNowISO]
  );

  const now = devNowISO ? new Date(devNowISO) : new Date();
  // NOTE (17/07) : le bouton "Repos 2 jours" et son verrou nextAllowedDateISO
  // ont été retirés — le repos est géré par la jauge de forme + CTA intelligent.
  // Les profils avec un verrou legacy persisté sont purgés à la réhydratation
  // (migration v2 de useLoadStore).
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

  const handleSelectResetVariant = async (variantId: string) => {
    if (!resetChoice) return;
    // Même verrou anti-double-clic que la génération : cette action écrit
    // (persistPlanned + navigation) — un double-tap sur une carte ne doit
    // jamais lancer deux écritures concurrentes.
    if (!verrouRef.current.prendre()) return;
    setRequeteEnVol(true);
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
    const location = resetChoice.location;
    setResetChoice(null);
    setDebugAgent(resetChoice.debug);
    try {
      await processV2({
        v2: merged,
        location,
        phase,
        now,
        clubTrainingDays,
        tsb,
        alreadyAppliedToday,
        ageCategory,
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
          showToast({ type: "info", title: "Planifiée pour demain", message: `Séance planifiée pour ${formatDayFR(dateISO) || dateISO}.` });
        },
      });
      trackEvent("session_generate_success", {
        cycleId: cycleId ?? "none",
        location,
        resetVariantId: chosen.id,
      });
      await trackFirstSessionGeneratedIfNeeded();
    } catch (err: any) {
      // Même fermeture que handleGenerate : aucune écriture depuis ce catch,
      // juste un état d'échec honnête (voir echecGeneration.ts). Sans ce
      // catch, une panne ici finissait en rejection non gérée avec l'overlay
      // de chargement bloqué indéfiniment.
      const decision = decisionApresEchec({
        erreur: err,
        sessions,
        todayKey: toDateKey(now),
        uid: getAuth().currentUser?.uid ?? null,
      });
      trackEvent("session_generate_error", {
        cycleId: cycleId ?? "none",
        code: decision.echec.code ?? "client",
        categorie: decision.echec.categorie,
        retryable: decision.echec.retryable,
      });
      if (__DEV__) {
        console.error("Choix de variante reset echoue", {
          code: decision.echec.code,
          categorie: decision.echec.categorie,
          message: err?.message,
        });
      }
      setEchec(decision);
    } finally {
      setGenerating(false);
      setWakingServer(false);
      verrouRef.current.rendre();
      setRequeteEnVol(false);
    }
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
    { pitchSmallGearEnabled }
  );

  // Block back navigation while generating (prevents setState on unmounted component)
  useEffect(() => {
    const unsubscribe = nav.addListener("beforeRemove", (e: any) => {
      if (!generating) return;
      e.preventDefault();
      // Pendant le rejeu d'enregistrement (rejeuEnCours), le bouton "Annuler"
      // n'existe plus (voir rejeuEnCours plus haut) : ne pas y renvoyer le
      // joueur, ce serait un message qui pointe vers une action absente.
      showToast(
        rejeuEnCours
          ? { type: "info", title: "Enregistrement en cours", message: "Un instant..." }
          : { type: "info", title: "Génération en cours", message: "Utilise Annuler pour interrompre." }
      );
    });
    return unsubscribe;
  }, [nav, generating, rejeuEnCours]);

  // Annulation : le fetch continue en arrière-plan mais son résultat est ignoré
  // (jeton de génération) — l'utilisateur reprend la main immédiatement.
  const generationIdRef = useRef(0);
  // Verrou synchrone : un double-tap ne doit jamais lancer deux requêtes
  // payantes. Il n'est rendu qu'une fois la requête réellement terminée.
  const verrouRef = useRef(creerVerrouGeneration());
  const cancelGeneration = useCallback(() => {
    generationIdRef.current += 1;
    setGenerating(false);
    setWakingServer(false);
    setContextLoading(false);
    trackEvent("session_generate_cancelled", {});
    showToast({
      type: "info",
      title: "Génération annulée",
      message: "La demande en cours se termine côté serveur, tu pourras relancer juste après.",
    });
  }, []);

  // Disable header back button while generating
  useEffect(() => {
    (nav as any).setOptions?.({ headerBackVisible: !generating });
  }, [nav, generating]);

  // Fallback : auto-open CycleModal si arrivé sans cycle actif (anti-boucle via ref)
  const cyclePickerAutoOpened = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!storeHydrated) return;
      // Catégorie manquante : la carte qui le dit reste seule à l'écran. Ouvrir
      // le choix de cycle par-dessus ferait choisir un objectif à quelqu'un qui
      // ne pourra de toute façon pas générer.
      if (categorieAgeManquante) return;
      if (cycleId && !cycleCompleted) return;
      if (cyclePickerAutoOpened.current) return;
      cyclePickerAutoOpened.current = true;
      nav.navigate("CycleModal", { mode: "select", origin: "newSession" });
    }, [storeHydrated, cycleId, cycleCompleted, categorieAgeManquante, nav])
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
    // Anti double-clic : tant que la requête précédente n'est pas retombée,
    // on ne relance rien (une relance = jusqu'à 4 appels payants de plus).
    if (!verrouRef.current.prendre()) return;
    setRequeteEnVol(true);
    setEchec(null);
    try {
      // AVANT TOUT APPEL PAYANT : sans catégorie d'âge, le moteur ne pose aucun
      // plafond (cf. la carte du même nom plus bas). On ne génère pas.
      if (categorieAgeManquante) {
        showToast(TOAST_CATEGORIE_MANQUANTE);
        nav.navigate("ProfileSetup");
        return;
      }
      if (!cycleId) {
        showToast({ type: "warn", title: "Choisir un cycle", message: "Choisis ton cycle avant de générer des séances." });
        nav.navigate("CycleModal", { mode: "select", origin: "newSession" });
        return;
      }
      if (cycleCompleted) {
        showToast({ type: "info", title: "Cycle terminé", message: "Bien joué. Choisis un nouveau cycle pour continuer." });
        nav.navigate("CycleModal", { mode: "select", origin: "newSession" });
        return;
      }

      if (environment.length === 0) {
        showToast({ type: "warn", title: "Lieu manquant", message: "Choisis au moins un lieu : salle, terrain ou chez toi." });
        return;
      }

      // Salle validée sans sélection explicite : l'équipement standard salle
      // est implicite (l'UI dit "Équipement standard inclus par défaut").
      let equipmentForGeneration = selectedEquipment;
      if (!equipmentForGeneration.length && environment.includes("gym")) {
        equipmentForGeneration = ["gym_full", "bodyweight"];
      }
      // Sans matériel ailleurs qu'en salle : choix assumé, pas un blocage.
      // Le moteur gère nativement le poids du corps (aucune séance ne doit
      // rester bloquée faute de coche matériel).
      if (!equipmentForGeneration.length) {
        equipmentForGeneration = ["bodyweight"];
      }

      trackEvent("session_generate_start", {
        cycleId,
        locations: environment,
      });

      setGenerating(true);
      setWakingServer(false);
      const genId = ++generationIdRef.current;

      // On reconstruit le contexte à chaque génération pour refléter microcycle/index/goal à jour.
      setContextLoading(true);
      const ctx = await buildAIPromptContext();
      if (generationIdRef.current !== genId) return; // annulé pendant l'attente
      setAiContext(ctx);
      setContextLoading(false);

      // ── LA GARDE D'ÂGE, REJOUÉE SUR LE CONTEXTE FRAIS ────────────────────
      // Celle du haut de cette fonction lit `categorieAgeManquante`, qui vaut
      // faux tant que `aiContext` est `null` — et il l'est chaque fois que le
      // chargeur d'ouverture n'a pas tourné (aucun cycle actif, ou lecture en
      // échec). La garde ÉCHOUAIT DONC OUVERTE : la génération partait avec
      // `age_category: null`, c'est-à-dire, côté moteur, AUCUN plafond d'âge —
      // ni familles interdites, ni volume, ni contacts plyo, ni sprint, ni
      // durée (`getAgeCategoryCaps(null)` rend `null`). C'était le trou de la
      // garde du lot A (R5 de la contre-vérification du 05/09).
      //
      // Ici, on ne suppose plus rien : `ctx` VIENT d'être construit, il est
      // toujours là, et on regarde la valeur elle-même. Avant l'appel payant.
      if (categorieAgeAbsente(ctx)) {
        showToast(TOAST_CATEGORIE_MANQUANTE);
        // `setAiContext(ctx)` juste au-dessus fait apparaître la carte du même
        // nom : la personne ne repart pas d'un écran muet.
        nav.navigate("ProfileSetup");
        return;
      }

      const { context: preparedCtx, location } = prepareBackendContext(
        ctx,
        equipmentForGeneration,
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
      const { v2, debug } = await fetchV2(preparedCtx, {
        onRetry: () => {
          if (generationIdRef.current === genId) setWakingServer(true);
        },
      });
      if (generationIdRef.current !== genId) return; // annulé pendant l'appel
      await setSessionCache(preparedCtx, { v2, debug });
      if (isResetPlan(v2)) {
        // Choix de variante affiché UNIQUEMENT si le backend en fournit de
        // vraies — jamais de titres inventés. Un reset sans variante reste
        // possible : il continue alors normalement, sans carte de choix.
        const variants = resolveResetVariants(v2);
        if (variants.length > 0) {
          trackEvent("session_generate_reset", {
            cycleId,
            location,
            variantCount: variants.length,
          });
          setResetChoice({ v2, debug, variants, location });
          setGenerating(false);
          return;
        }
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
      ageCategory,
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
          showToast({ type: "info", title: "Planifiée pour demain", message: `Séance planifiée pour ${formatDayFR(dateISO) || dateISO}.` });
        },
      });
      trackEvent("session_generate_success", {
        cycleId,
        location,
      });
      await trackFirstSessionGeneratedIfNeeded();
    } catch (err: any) {
      // AUCUNE écriture ici : pas de pushSession, pas de persistPlanned, pas de
      // setLastAiSessionV2, pas de navigation vers la séance. Une panne ne
      // devient pas une prescription — on rend un état d'erreur, point.
      const decision = decisionApresEchec({
        erreur: err,
        sessions,
        todayKey: toDateKey(now),
        uid: getAuth().currentUser?.uid ?? null,
      });

      trackEvent("session_generate_error", {
        cycleId: cycleId ?? "none",
        code: decision.echec.code ?? "client",
        categorie: decision.echec.categorie,
        retryable: decision.echec.retryable,
      });

      // Log technique réservé au dev — jamais montré au joueur.
      if (__DEV__) {
        console.error("Generation de seance echouee", {
          code: decision.echec.code,
          categorie: decision.echec.categorie,
          message: err?.message,
        });
      }

      setEchec(decision);
    } finally {
      setGenerating(false);
      setWakingServer(false);
      // Toujours relâcher le flag contexte : s'il reste bloqué à true, le CTA
      // "Générer" est définitivement grisé (buildAIPromptContext peut throw).
      setContextLoading(false);
      verrouRef.current.rendre();
      setRequeteEnVol(false);
    }
  };

  const goFeedback = () => {
    if (!current) return;
    nav.navigate("Feedback", { sessionId: current.id });
  };

  /**
   * Rouvre une VRAIE séance déjà prescrite, validée et persistée.
   * Ce n'est pas un repli : rien n'est fabriqué, rien n'est créé, aucune
   * génération n'est présentée comme réussie. Les séances artificielles de
   * l'ancienne "séance de secours" sont refusées en amont (chercherRepriseSeance).
   */
  const reprendreSeanceReelle = () => {
    const reprise = echec?.reprise;
    if (!reprise?.reouvrable) return;
    const seance = reprise.seance;
    setEchec(null);
    nav.navigate("SessionPreview", {
      v2: seance.aiV2 as unknown as FKS_NextSessionV2,
      plannedDateISO: toDateKey(seance.dateISO ?? seance.date),
      sessionId: seance.id,
    });
  };

  /**
   * Rejoue l'enregistrement/l'affichage d'une séance DÉJÀ GÉNÉRÉE (payée) qui
   * a échoué à l'étape de persistance ou d'affichage — jamais un nouvel appel
   * de génération. Même verrou anti-double-clic que handleGenerate : un
   * double-tap ne doit pas déclencher deux tentatives concurrentes.
   */
  const reessayerEnregistrement = async () => {
    const postGeneration = echec?.postGeneration;
    if (!postGeneration) return;
    if (!verrouRef.current.prendre()) return;
    setRequeteEnVol(true);
    // Retour visuel pendant tout le rejeu : sans ça, la carte d'échec
    // disparaît (setEchec(null)) mais rien ne l'affiche en train de
    // travailler — écran inerte, surtout gênant hors-ligne/persistance
    // lente. Même overlay que handleGenerate.
    setGenerating(true);
    // Ce rejeu n'est pas annulable (pas de jeton generationIdRef) : l'overlay
    // ne doit pas proposer "Annuler" ici, voir rejeuEnCours plus haut.
    setRejeuEnCours(true);
    setEchec(null);
    try {
      await rejouerApresEchecPostGeneration(postGeneration, {
        pushSession,
        persistPlanned,
        setLastAiSessionV2,
        navigate: ({ v2, plannedDateISO, sessionId }) =>
          nav.navigate("SessionPreview", { v2, plannedDateISO, sessionId }),
        alertPlanified: (dateISO: string) => {
          showToast({ type: "info", title: "Planifiée pour demain", message: `Séance planifiée pour ${formatDayFR(dateISO) || dateISO}.` });
        },
      });
    } catch (err: any) {
      const decision = decisionApresEchec({
        erreur: err,
        sessions,
        todayKey: toDateKey(now),
        uid: getAuth().currentUser?.uid ?? null,
      });
      if (__DEV__) {
        console.error("Reessai enregistrement/affichage echoue", {
          etape: postGeneration.etape,
          message: err?.message,
        });
      }
      setEchec(decision);
    } finally {
      setGenerating(false);
      setRejeuEnCours(false);
      verrouRef.current.rendre();
      setRequeteEnVol(false);
    }
  };

  const useCachedSession = async () => {
    if (!cachePrompt) return;
    const { cached, location } = cachePrompt;
    setCachePrompt(null);
    setGenerating(true);
    try {
      const { v2, debug } = cached;
      if (isResetPlan(v2)) {
        // Même règle qu'à la génération : pas de titres inventés, pas de
        // choix affiché sans vraies variantes backend.
        const variants = resolveResetVariants(v2);
        if (variants.length > 0) {
          setResetChoice({ v2, debug, variants, location });
          setGenerating(false);
          return;
        }
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
        ageCategory,
        pushSession,
        persistPlanned,
        setLastAiSessionV2,
        navigate: ({ v2: navV2, plannedDateISO, sessionId }) =>
          nav.navigate("SessionPreview", { v2: navV2, plannedDateISO, sessionId }),
        alertPlanified: (dateISO: string) => {
          showToast({ type: "info", title: "Planifiée pour demain", message: `Séance planifiée pour ${formatDayFR(dateISO) || dateISO}.` });
        },
      });
      trackEvent("session_generate_from_cache", { cycleId });
      await trackFirstSessionGeneratedIfNeeded();
    } catch (err: any) {
      // Même fermeture que handleGenerate : un toast générique masquait le
      // vrai état (rien persisté ? déjà persisté ?) — decisionApresEchec rend
      // la même carte honnête que le reste du parcours de génération.
      const decision = decisionApresEchec({
        erreur: err,
        sessions,
        todayKey: toDateKey(now),
        uid: getAuth().currentUser?.uid ?? null,
      });
      if (__DEV__) {
        console.error("Chargement de la seance en cache echoue", {
          code: decision.echec.code,
          categorie: decision.echec.categorie,
          message: err?.message,
        });
      }
      setEchec(decision);
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
  const afficherFormulaire = !categorieAgeManquante && cycleId && !cycleCompleted;
  const afficherPied = !current && afficherFormulaire && !cachePrompt && !echec;

  return (
    <Screen style={styles.ecran}>
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
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.titre} accessibilityRole="header" maxFontSizeMultiplier={PLAFOND_TITRE}>
          Prépare ta séance
        </Text>
        {/* Sous-titre affiché UNIQUEMENT quand il y a vraiment un lieu/matériel
            à choisir : sinon il mentirait (porte catégorie/cycle, séance déjà
            générée) — finitions orchestrateur G5. */}
        {!current && afficherFormulaire ? (
          <Text style={styles.sousTitre} maxFontSizeMultiplier={PLAFOND_TEXTE}>
            Choisis ton lieu et ton matériel.
          </Text>
        ) : null}

        {categorieAgeManquante ? (
          /* PAS DE CATÉGORIE D'ÂGE = PAS DE SÉANCE.
             Sans elle, le moteur n'applique AUCUN plafond d'âge : ni familles
             interdites, ni volume, ni contacts pliométriques, ni sprint, ni
             durée (`getAgeCategoryCaps(null)` rend `null` côté backend). Une
             séance sortirait quand même, dosée pour personne — c'est le trou
             qu'ouvrait le coach « Je m'entraîne aussi » avec son profil vide
             (audit d'inscription 2026-09, P1-04 + erratum 4). On s'arrête ici
             AVANT le moindre appel payant. */
          <PorteCard
            titre="Il manque ta catégorie"
            texte="Complète ton profil pour des séances adaptées à ta catégorie."
            labelPrincipal="Compléter mon profil"
            onPressPrincipal={() => nav.navigate("ProfileSetup")}
          />
        ) : !cycleId ? (
          <PorteCard
            titre="Choisis ton objectif de cycle"
            texte="Avant de créer une séance, FKS a besoin de savoir ce que tu veux travailler sur les prochaines semaines."
            textesSecondaires={["Séances plus cohérentes", "Progression suivie", "Charge mieux cadrée"]}
            labelPrincipal="Voir les cycles"
            onPressPrincipal={() => nav.navigate("CycleModal", { mode: "select", origin: "newSession" })}
            labelSecondaire="Me recommander un cycle"
            onPressSecondaire={() => nav.navigate("CycleModal", { mode: "select", origin: "newSession" })}
          />
        ) : cycleCompleted ? (
          <PorteCard
            titre="Cycle terminé"
            texte={`${cycleDef?.label ?? "Ton cycle"} est complété (${MICROCYCLE_TOTAL_SESSIONS_DEFAULT}/${MICROCYCLE_TOTAL_SESSIONS_DEFAULT}). Choisis un nouveau cycle pour continuer.`}
            labelPrincipal="Choisir un nouveau cycle"
            onPressPrincipal={() => nav.navigate("CycleModal", { mode: "select", origin: "newSession" })}
            labelSecondaire="Voir mon cycle"
            onPressSecondaire={() => nav.navigate("CycleModal", { mode: "manage", origin: "newSession" } as any)}
          />
        ) : (
          <View style={styles.ligneContexte}>
            <View style={styles.ligneContexteTexte}>
              <Text style={styles.ligneContexteTitre} maxFontSizeMultiplier={PLAFOND_TEXTE}>
                {cycleDef?.label ?? "—"}
              </Text>
              {cyclePhase ? (
                <Text style={styles.ligneContexteMeta} maxFontSizeMultiplier={PLAFOND_TEXTE}>
                  Séance {cyclePhase.sessionNumber} sur {cyclePhase.total} · {cyclePhase.label}
                </Text>
              ) : null}
            </View>
            <DaTextButton
              label="Modifier"
              onPress={() => nav.navigate("CycleModal", { mode: "manage", origin: "newSession" } as any)}
            />
          </View>
        )}

        {/* SI PAS DE SÉANCE EN COURS */}
        {/* `!categorieAgeManquante` : inutile de faire choisir un lieu et du
            matériel à quelqu'un dont la séance ne partira pas — la carte
            « Il manque ta catégorie » plus haut est le seul geste utile. */}
        {!current ? (
          !categorieAgeManquante && cycleId && !cycleCompleted ? (
            <>
              <View style={styles.section}>
                <EnvironmentSelector
                  environment={environment}
                  setEnvironment={setEnvironment}
                  allowed={allowedLocations}
                  currentCycleId={cycleId}
                />
              </View>

              <View style={styles.section}>
                <EquipmentSelector
                  catalog={EQUIPMENT_CATALOG as any}
                  environment={environment}
                  availableEquipment={availableEquipment}
                  selectedEquipment={selectedEquipment}
                  contextLoading={contextLoading && !generating}
                  onSelect={setSelectedEquipment}
                  pitchSmallGearEnabled={pitchSmallGearEnabled}
                  onTogglePitchSmallGear={(next) => {
                    setPitchSmallGearEnabled(next);
                  }}
                />
              </View>

              {advice ? (
                <DaNotice
                  tone={advice.tone}
                  icon={advice.icon as any}
                  title={advice.title}
                  message={advice.message}
                />
              ) : null}

              {cachePrompt ? (
                <DaCard>
                  <Text style={styles.cardTitle} maxFontSizeMultiplier={PLAFOND_TEXTE}>
                    Séance récente en cache
                  </Text>
                  <Text style={styles.cardSubtitle} maxFontSizeMultiplier={PLAFOND_TEXTE}>
                    Une séance a été générée il y a {cachePrompt.ageMin} min avec les mêmes paramètres.
                  </Text>
                  <View style={styles.cacheActions}>
                    <DaPrimaryButton label="Utiliser cette séance" onPress={useCachedSession} arrow={false} />
                    <DaTextButton label="Générer une nouvelle" onPress={regenerateIgnoringCache} />
                  </View>
                </DaCard>
              ) : null}
            </>
          ) : null
        ) : (
          // SI UNE SÉANCE EST DÉJÀ EN COURS
          <CurrentSessionCard
            current={current}
            phaseLabel={cyclePhase?.label ?? null}
            phaseMeaning={cyclePhase?.meaning ?? null}
            alreadyAppliedToday={alreadyAppliedToday}
            onFeedback={goFeedback}
            onAdvanceDay={() => advanceDays(1)}
          />
        )}

        {/* ÉCHEC DE GÉNÉRATION — état d'erreur, jamais une séance de secours.
            Rendu hors des branches "séance en cours / pas de séance" pour
            rester visible dans tous les cas, y compris quand une vraie séance
            existe déjà et peut être rouverte. EN BAS du contenu (spec §3.3 et
            §3.8) : juste au-dessus de la zone d'action, là où le défilement
            automatique (`scrollToEnd`, voir l'effet plus haut) amène le
            joueur — sinon l'écran défile en s'éloignant de la carte. */}
        {echec ? (
          <CarteEchecGeneration
            echec={echec.echec}
            actions={echec.actions}
            occupe={generating || requeteEnVol}
            onReessayer={handleGenerate}
            onReessayerEnregistrement={reessayerEnregistrement}
            onModifierContraintes={() => {
              setEchec(null);
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
            onChoisirCycle={() => {
              setEchec(null);
              nav.navigate("CycleModal", { mode: "select", origin: "newSession" });
            }}
            onSeReconnecter={() => {
              setEchec(null);
              nav.navigate("Tabs", { screen: "Profile" });
            }}
            onReprendreSeance={reprendreSeanceReelle}
            onOuvrirMonCorps={() => {
              setEchec(null);
              nav.navigate("MonCorps");
            }}
            onRetourAccueil={() => {
              setEchec(null);
              nav.navigate("Tabs", { screen: "Home" });
            }}
          />
        ) : null}

        {/* Bloc debug replié — dev only */}
        {__DEV__ && debugAgent && (
          <View style={styles.cardDebug}>
            <TouchableOpacity onPress={() => setShowDebug((v) => !v)} style={styles.debugHeader}>
              <Text style={styles.cardTitle}>Debug backend (optionnel)</Text>
              <Text style={styles.debugToggle}>{showDebug ? "Masquer" : "Afficher"}</Text>
            </TouchableOpacity>
            {showDebug && (
              <Text style={styles.debugText}>
                {JSON.stringify(debugAgent, null, 2)}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {afficherPied ? (
        <View style={styles.piedCollant}>
          <GenerationActions
            disabled={contextLoading || generating || requeteEnVol || !storeHydrated || !!current}
            generating={generating}
            environment={environment}
            selectedEquipment={selectedEquipment}
            libelles={libellesEquipement}
            onGenerate={handleGenerate}
            onAdvanceDay={() => advanceDays(1)}
            storeHydrated={storeHydrated}
            alreadyAppliedToday={alreadyAppliedToday}
          />
        </View>
      ) : null}

      <LoadingOverlay
        visible={generating}
        steps={[
          "Analyse de ton profil et ta charge...",
          "Sélection des exercices adaptés...",
          "Construction des blocs d'entraînement...",
          "Personnalisation selon tes contraintes...",
          "Vérification et finalisation...",
        ]}
        overrideMessage={
          rejeuEnCours
            ? "Enregistrement..."
            : wakingServer
            ? "Le serveur se réveille, encore quelques secondes..."
            : undefined
        }
        estimatedDurationMs={25000}
        // Pas de bouton "Annuler" pendant le rejeu d'enregistrement : il n'a
        // pas de jeton d'annulation et va au bout quoi qu'il arrive — un
        // "Annuler" y mentirait ("Génération annulée" alors que ça continue).
        onCancel={rejeuEnCours ? undefined : cancelGeneration}
      />
    </Screen>
  );
}

/** ------------------------------------------------------------------
 *  CARTE DE PORTE — catégorie manquante / aucun cycle / cycle terminé.
 *  Module-level (jamais déclaré dans le rendu de NewSessionScreen) :
 *  spec §1.2 + règle CLAUDE.md, aucun composant interactif recréé à
 *  chaque rendu du parent.
 * ------------------------------------------------------------------ */
function PorteCard({
  titre,
  texte,
  textesSecondaires,
  labelPrincipal,
  onPressPrincipal,
  labelSecondaire,
  onPressSecondaire,
}: {
  titre: string;
  texte: string;
  textesSecondaires?: string[];
  labelPrincipal: string;
  onPressPrincipal: () => void;
  labelSecondaire?: string;
  onPressSecondaire?: () => void;
}) {
  return (
    <DaCard style={stylesPorte.carte}>
      <Text style={stylesPorte.titre} maxFontSizeMultiplier={PLAFOND_TITRE}>
        {titre}
      </Text>
      <Text style={stylesPorte.texte} maxFontSizeMultiplier={PLAFOND_TEXTE}>
        {texte}
      </Text>
      {textesSecondaires?.map((t) => (
        <Text key={t} style={stylesPorte.texteSecondaire} maxFontSizeMultiplier={PLAFOND_TEXTE}>
          {t}
        </Text>
      ))}
      <DaPrimaryButton label={labelPrincipal} onPress={onPressPrincipal} arrow={false} />
      {labelSecondaire && onPressSecondaire ? (
        <DaTextButton label={labelSecondaire} onPress={onPressSecondaire} />
      ) : null}
    </DaCard>
  );
}

/** =====================================================================
 *  STYLES
 * ===================================================================== */
const styles = StyleSheet.create({
  ecran: {
    flex: 1,
    backgroundColor: da.colors.bg,
  },
  container: { flex: 1 },
  scrollContent: {
    padding: da.gutter,
    paddingBottom: da.spacing.xl,
    gap: da.spacing.md,
  },
  titre: {
    ...da.typography.display,
    color: da.colors.text,
  },
  sousTitre: {
    ...da.typography.body,
    color: da.colors.sub,
    marginTop: -da.spacing.xs,
  },
  section: {
    gap: da.spacing.sm,
  },
  ligneContexte: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: da.spacing.sm,
    minHeight: 56,
    paddingHorizontal: da.spacing.md,
    paddingVertical: da.spacing.sm,
    borderRadius: da.radius.tile,
    borderWidth: 1,
    borderColor: da.colors.border,
    backgroundColor: da.colors.card,
  },
  ligneContexteTexte: {
    flex: 1,
  },
  ligneContexteTitre: {
    ...da.typography.bodyStrong,
    color: da.colors.text,
  },
  ligneContexteMeta: {
    ...da.typography.secondary,
    color: da.colors.sub,
    marginTop: 2,
  },
  cacheActions: {
    gap: da.spacing.xs,
    marginTop: da.spacing.xs,
  },
  piedCollant: {
    borderTopWidth: 1,
    borderTopColor: da.colors.border,
    backgroundColor: da.colors.bg,
    paddingHorizontal: da.gutter,
    paddingVertical: da.spacing.sm,
  },
  // Bloc debug (dev only) — gabarit simple, non prioritaire visuellement.
  cardDebug: {
    padding: da.spacing.md,
    borderWidth: 1,
    borderColor: da.colors.border,
    borderRadius: da.radius.tile,
    backgroundColor: da.colors.card,
    marginTop: da.spacing.sm,
  },
  cardTitle: {
    ...da.typography.bodyStrong,
    color: da.colors.text,
  },
  cardSubtitle: {
    ...da.typography.secondary,
    color: da.colors.sub,
    marginTop: da.spacing.xxs,
  },
  debugHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  debugToggle: {
    color: da.colors.actionText,
    fontSize: 12,
  },
  debugText: {
    marginTop: da.spacing.xs,
    fontSize: 11,
    color: da.colors.sub,
  },
});

const stylesPorte = StyleSheet.create({
  carte: {
    gap: da.spacing.sm,
  },
  titre: {
    ...da.typography.section,
    color: da.colors.text,
  },
  texte: {
    ...da.typography.body,
    color: da.colors.sub,
  },
  texteSecondaire: {
    ...da.typography.secondary,
    color: da.colors.sub,
  },
});
