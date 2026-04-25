// Profile setup screen
// Setup profil multi-étapes — image de foot en fond, même DA que le reste de l'app

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getAuth, signOut } from "firebase/auth";
import { useHaptics } from "../hooks/useHaptics";
import { db } from "../services/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { findClubByInviteCode, normalizeInviteCode, setClubMembership } from "../repositories/clubsRepo";
import { MICROCYCLES, MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../domain/microcycles";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useAuthFlowStore } from "../state/authFlowStore";
import { showToast } from "../utils/toast";
import { runShake } from "../utils/animations";
import { useAppModeStore } from "../state/appModeStore";
import { theme, TYPE, RADIUS } from "../constants/theme";
import { AuthBackground } from "../components/auth/AuthBackground";
import { navigationRef } from "../navigation/navigationRef";
import InjuryForm from "../components/InjuryForm";
import type { InjuryRecord } from "../domain/types";

const TOTAL_STEPS = 4;
const HEALTH_CONSENT_VERSION = "1.0";
const palette = theme.colors;
const authColors = {
  text: theme.colors.zinc50,
  sub: theme.colors.zinc400,
  muted: theme.colors.white45,
  border: theme.colors.white10,
  borderSoft: theme.colors.white12,
};

/* ─── Steps config ─── */
const STEPS: { label: string; icon: keyof typeof Ionicons.glyphMap; subtitle: string }[] = [
  { label: "Profil", icon: "person-outline", subtitle: "Qui tu es" },
  { label: "Planning", icon: "calendar-outline", subtitle: "Ton rythme de jeu" },
  { label: "Matériel", icon: "barbell-outline", subtitle: "Avec quoi tu t'entraînes" },
  { label: "Bien-être", icon: "medical-outline", subtitle: "Ton corps aujourd'hui" },
];

/* ─── Constants ─── */
const positions = ["Gardien", "Defenseur", "Milieu", "Attaquant"] as const;
const levels = ["Loisir", "Compétition", "Haut niveau"] as const;
const dominantFeet = ["Pied droit", "Pied gauche", "Ambidextre"] as const;
const objectives = [
  "Être en forme toute la saison",
  "Gagner en vitesse / explosivité",
  "Mieux encaisser les entraînements et les matchs",
  "Reprendre après une blessure",
] as const;
const fksSessionsOptions = ["1", "2", "3", "4"] as const;

const STEP_CONTEXT = [
  { badge: "Base", detail: "Ton role, ton poste et tes reperes terrain." },
  { badge: "Planning", detail: "Ton objectif et ton rythme club / matchs." },
  { badge: "Setup", detail: "Ou et avec quoi tu t'entraines." },
  { badge: "Sante", detail: "Zones a menager pour cette periode." },
] as const;

const gymEquipmentOptions = [
  { id: "barbell", label: "Barre + poids libres" },
  { id: "squat_rack", label: "Rack a squat" },
  { id: "bench", label: "Banc de musculation" },
  { id: "dumbbells_light", label: "Halteres legers (≤ 10 kg)" },
  { id: "dumbbells_medium", label: "Halteres moyens (10-25 kg)" },
  { id: "dumbbells_heavy", label: "Halteres lourds (≥ 25 kg)" },
  { id: "kettlebell", label: "Kettlebells" },
  { id: "leg_press", label: "Presse (leg press)" },
  { id: "cable_machine", label: "Poulies / cable" },
  { id: "smith_machine", label: "Smith machine" },
  { id: "pullup_bar", label: "Barre de tractions" },
  { id: "box_plyo", label: "Box plyo" },
  { id: "bosu", label: "BOSU" },
  { id: "foam_roller", label: "Foam roller / rouleau" },
  { id: "yoga_mat", label: "Tapis de sol" },
];

const homeEquipmentOptions = [
  { id: "field", label: "Terrain herbe / synthe" },
  { id: "street_area", label: "City / bitume / parking" },
  { id: "indoor_small", label: "Petit espace interieur" },
  { id: "cones", label: "Cones" },
  { id: "flat_markers", label: "Plots plats" },
  { id: "speed_ladder", label: "Echelle de rythme" },
  { id: "mini_hurdles", label: "Petites haies" },
  { id: "minibands", label: "Mini-bands" },
  { id: "long_bands", label: "Elastiques longues" },
  { id: "home_dumbbells", label: "Halteres (chez toi)" },
  { id: "home_kettlebell", label: "Kettlebell (chez toi)" },
  { id: "sandbag", label: "Sac de sable / sandbag" },
  { id: "home_foam_roller", label: "Foam roller (chez toi)" },
  { id: "home_yoga_mat", label: "Tapis de sol (chez toi)" },
];

const groupOptions = <T extends { id: string }>(options: readonly T[], ids: string[]) =>
  ids
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is T => Boolean(option));

const gymEquipmentGroups = [
  {
    title: "Charges libres",
    options: groupOptions(gymEquipmentOptions, [
      "barbell",
      "dumbbells_light",
      "dumbbells_medium",
      "dumbbells_heavy",
      "kettlebell",
    ]),
  },
  {
    title: "Postes lourds",
    options: groupOptions(gymEquipmentOptions, [
      "squat_rack",
      "bench",
      "pullup_bar",
      "smith_machine",
    ]),
  },
  {
    title: "Machines",
    options: groupOptions(gymEquipmentOptions, ["leg_press", "cable_machine"]),
  },
  {
    title: "Petit matos",
    options: groupOptions(gymEquipmentOptions, [
      "box_plyo",
      "bosu",
      "foam_roller",
      "yoga_mat",
    ]),
  },
] as const;

const homeEquipmentGroups = [
  {
    title: "Lieux",
    options: groupOptions(homeEquipmentOptions, ["field", "street_area", "indoor_small"]),
  },
  {
    title: "Balisage",
    options: groupOptions(homeEquipmentOptions, [
      "cones",
      "flat_markers",
      "speed_ladder",
      "mini_hurdles",
    ]),
  },
  {
    title: "Renfo",
    options: groupOptions(homeEquipmentOptions, [
      "minibands",
      "long_bands",
      "home_dumbbells",
      "home_kettlebell",
      "sandbag",
    ]),
  },
  {
    title: "Recup",
    options: groupOptions(homeEquipmentOptions, ["home_foam_roller", "home_yoga_mat"]),
  },
] as const;

const daysOfWeek = [
  { id: "mon", label: "Lun" }, { id: "tue", label: "Mar" }, { id: "wed", label: "Mer" },
  { id: "thu", label: "Jeu" }, { id: "fri", label: "Ven" }, { id: "sat", label: "Sam" },
  { id: "sun", label: "Dim" },
];

const toggleInList = (value: string, list: string[], setter: (next: string[]) => void) => {
  setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
};

/* ══════════════════════════════════════════ */
export default function ProfileSetupScreen() {
  const navigation = useNavigation<any>();
  const haptics = useHaptics();
  const activeCycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);
  const scrollRef = useRef<ScrollView>(null);

  /* ─── Step state ─── */
  const [step, setStep] = useState(0);

  /* ─── Form state ─── */
  const [firstName, setFirstName] = useState("");
  const [clubId, setClubId] = useState("");
  const [clubInviteCode, setClubInviteCode] = useState("");
  const [position, setPosition] = useState("");
  const [level, setLevel] = useState("");
  const [dominantFoot, setDominantFoot] = useState("");
  const [mainObjective, setMainObjective] = useState("");
  const [targetFksSessionsPerWeek, setTargetFksSessionsPerWeek] = useState("");
  const [clubTrainingsPerWeek, setClubTrainingsPerWeek] = useState("");
  const [matchesPerWeek, setMatchesPerWeek] = useState("");
  const [hasClubTrainings, setHasClubTrainings] = useState<"oui" | "non" | "">("");
  const [clubTrainingDays, setClubTrainingDays] = useState<string[]>([]);
  const [matchDays, setMatchDays] = useState<string[]>([]);
  const [hasGymAccess, setHasGymAccess] = useState<"oui" | "occasionnel" | "non" | "">("");
  const [gymEquipment, setGymEquipment] = useState<string[]>([]);
  const [hasHomeEquipment, setHasHomeEquipment] = useState<"oui" | "non" | "">("");
  const [homeEquipment, setHomeEquipment] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Étape 4 — Bien-être (MVP blessures Jour 3).
  // `hasInjury === ""` : choix pas encore fait (bloque la validation).
  // `hasInjury === "no"` : aucune zone sensible → pas de consentement nécessaire.
  // `hasInjury === "yes"` : zone sensible → InjuryForm + 2 checkboxes obligatoires.
  const [hasInjury, setHasInjury] = useState<"no" | "yes" | "">("");
  const [injury, setInjury] = useState<InjuryRecord | null>(null);
  const [healthConsentOk, setHealthConsentOk] = useState(false);

  const currentMode = useAppModeStore((s) => s.mode);
  const setModeForUid = useAppModeStore((s) => s.setModeForUid);
  const markProfileCompleted = useAuthFlowStore((s) => s.markProfileCompleted);
  const [selectedMode, setSelectedMode] = useState<"player" | "coach" | "">(currentMode ?? "");

  const shake = useRef(new Animated.Value(0)).current;
  const stepFade = useRef(new Animated.Value(1)).current;

  const cycleId = isMicrocycleId(activeCycleGoal) ? activeCycleGoal : null;
  const cycleLabel = cycleId ? MICROCYCLES[cycleId].label : null;
  const cycleProgress = Math.min(MICROCYCLE_TOTAL_SESSIONS_DEFAULT, Math.max(0, Math.trunc(microcycleSessionIndex ?? 0)));

  /* ─── Prefill ─── */
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      const d = snap.data();
      if (!d) return;
      if (typeof d.firstName === "string") setFirstName(d.firstName);
      if (typeof d.clubId === "string") setClubId(d.clubId);
      if (typeof d.position === "string") setPosition(d.position);
      if (typeof d.level === "string") setLevel(d.level);
      if (typeof d.dominantFoot === "string") setDominantFoot(d.dominantFoot);
      if (typeof d.mainObjective === "string") setMainObjective(d.mainObjective);
      if (d.targetFksSessionsPerWeek != null) setTargetFksSessionsPerWeek(String(d.targetFksSessionsPerWeek));
      if (d.clubTrainingsPerWeek != null) setClubTrainingsPerWeek(String(d.clubTrainingsPerWeek));
      if (d.matchesPerWeek != null) setMatchesPerWeek(String(d.matchesPerWeek));
      if (typeof d.hasClubTrainings === "string") {
        setHasClubTrainings(d.hasClubTrainings === "oui" ? "oui" : d.hasClubTrainings === "non" ? "non" : "");
      }
      if (Array.isArray(d.clubTrainingDays)) setClubTrainingDays(d.clubTrainingDays);
      if (Array.isArray(d.matchDays)) setMatchDays(d.matchDays);
      if (typeof d.matchDay === "string" && (!d.matchDays || !d.matchDays.length)) setMatchDays([d.matchDay]);
      if (typeof d.hasGymAccess === "string") {
        setHasGymAccess(d.hasGymAccess === "regular" ? "oui" : d.hasGymAccess === "occasional" ? "occasionnel" : "non");
      }
      if (Array.isArray(d.gymEquipment)) setGymEquipment(d.gymEquipment);
      if (typeof d.hasHomeEquipment === "boolean") setHasHomeEquipment(d.hasHomeEquipment ? "oui" : "non");
      if (Array.isArray(d.homeEquipment)) setHomeEquipment(d.homeEquipment);
    }).catch((err) => {
      if (__DEV__) console.error("[ProfileSetup] Failed to prefill profile:", err);
      showToast({ type: "warn", title: "Profil", message: "Impossible de charger ton profil. Vérifie ta connexion et réessaie." });
    });
  }, []);

  useEffect(() => {
    if (hasClubTrainings !== "oui") {
      setClubTrainingDays([]);
      if (hasClubTrainings === "non") setClubTrainingsPerWeek("0");
    }
  }, [hasClubTrainings]);

  useEffect(() => {
    const matches = Number(matchesPerWeek);
    if (!Number.isFinite(matches) || matches <= 0) {
      setMatchDays([]);
    }
  }, [matchesPerWeek]);

  useEffect(() => {
    if (hasGymAccess === "non") setGymEquipment([]);
  }, [hasGymAccess]);

  useEffect(() => {
    if (hasHomeEquipment === "non") setHomeEquipment([]);
  }, [hasHomeEquipment]);

  /* ─── Helpers ─── */
  const fail = (title: string, message?: string) => {
    runShake(shake);
    haptics.warning();
    showToast({ type: "error", title, message });
  };

  const hapticSelect = () => {
    haptics.impactLight();
  };

  const animateTransition = (next: number) => {
    Animated.timing(stepFade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(next);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      Animated.timing(stepFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  /* ─── Validation per step ─── */
  const validateStep = (): boolean => {
    switch (step) {
      case 0:
        if (selectedMode !== "player" && selectedMode !== "coach") { fail("Champs manquants", "Choisis ton rôle (joueur ou coach)."); return false; }
        if (!firstName.trim()) { fail("Champs manquants", "Merci d'indiquer ton prénom."); return false; }
        if (!positions.includes(position as any)) { fail("Champs manquants", "Choisis ton poste."); return false; }
        if (!levels.includes(level as any)) { fail("Champs manquants", "Indique ton niveau."); return false; }
        if (!dominantFeet.includes(dominantFoot as any)) { fail("Champs manquants", "Choisis ton pied fort."); return false; }
        return true;
      case 1: {
        if (!objectives.includes(mainObjective as any)) { fail("Champs manquants", "Choisis ton objectif principal."); return false; }
        if (!fksSessionsOptions.includes(targetFksSessionsPerWeek as any)) { fail("Champs manquants", "Indique tes séances FKS / semaine."); return false; }
        const trainings = Number(clubTrainingsPerWeek);
        const matches = Number(matchesPerWeek);
        if (hasClubTrainings === "oui") {
          if (!Number.isFinite(trainings) || trainings < 0) { fail("Valeur invalide", "Entraînements/semaine doit être positif."); return false; }
          if (clubTrainingDays.length === 0) { fail("Champs manquants", "Précise les jours club."); return false; }
        }
        if (Number.isFinite(matches) && matches > 0 && matchDays.length === 0) { fail("Champs manquants", "Précise les jours de match."); return false; }
        return true;
      }
      case 2:
        // Matériel : pas de validation stricte — le joueur peut n'avoir rien
        return true;
      case 3: {
        // Bien-être — obligatoire : choix "non" ou "oui" + si "oui", zone + niveau + 2 checkboxes
        if (hasInjury !== "no" && hasInjury !== "yes") {
          fail("Champ manquant", "Dis-nous si tu as une zone sensible ou non.");
          return false;
        }
        if (hasInjury === "yes") {
          if (!injury) {
            fail("Zone sensible à préciser", "Indique la zone concernée avant de continuer.");
            return false;
          }
          if ((injury.severity ?? 0) < 1) {
            fail("Niveau de gêne à préciser", "Choisis un niveau de gêne (légère, modérée, forte).");
            return false;
          }
          if (!healthConsentOk) {
            fail("Consentement requis", "Merci de cocher les deux cases pour continuer.");
            return false;
          }
        }
        return true;
      }
      default:
        return true;
    }
  };

  const goNext = () => {
    if (!validateStep()) return;
    haptics.impactMedium();
    if (step < TOTAL_STEPS - 1) animateTransition(step + 1);
  };

  const goBack = () => {
    haptics.impactLight();
    if (step > 0) animateTransition(step - 1);
  };

  /* ─── Save ─── */
  const handleSave = async () => {
    if (!validateStep()) return;
    const targetFksSessions = Number(targetFksSessionsPerWeek);
    const trainings = Number(clubTrainingsPerWeek);
    const matches = Number(matchesPerWeek);
    const normalizedInvite = normalizeInviteCode(clubInviteCode);

    try {
      setLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) { fail("Connexion requise", "Connecte-toi pour enregistrer ton profil."); return; }

      if (selectedMode === "player" || selectedMode === "coach") {
        await setModeForUid(user.uid, selectedMode);
      }

      let resolvedClubId: string | null = clubId?.trim() ? clubId.trim() : null;
      if (normalizedInvite) {
        const club = await findClubByInviteCode(normalizedInvite);
        if (!club) { fail("Code club invalide", "Aucun club ne correspond a ce code."); return; }
        resolvedClubId = club.id;
        await setClubMembership({ clubId: club.id, uid: user.uid, role: "player" });
      }

      // Bien-être (étape 4) — sérialisation conditionnelle.
      // Si le joueur a déclaré une zone sensible, on enregistre activeInjuries
      // (tableau, prêt pour multi-zones futur) + healthConsent RGPD.
      // Sinon, activeInjuries est explicitement vidé pour neutraliser un état
      // résiduel (réinscription après "marquer résolue" d'un profil précédent).
      const nowISO = new Date().toISOString();
      const injuryPayload =
        hasInjury === "yes" && injury
          ? {
              activeInjuries: [injury],
              healthConsent: { givenAt: nowISO, version: HEALTH_CONSENT_VERSION },
            }
          : { activeInjuries: [] };

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        firstName: firstName.trim(),
        clubId: resolvedClubId,
        position, level, dominantFoot, mainObjective,
        targetFksSessionsPerWeek: targetFksSessions,
        clubTrainingsPerWeek: trainings,
        matchesPerWeek: matches,
        hasClubTrainings, clubTrainingDays,
        matchDay: matchDays[0] ?? null, matchDays,
        hasGymAccess: hasGymAccess === "oui" ? "regular" : hasGymAccess === "occasionnel" ? "occasional" : "none",
        gymEquipment,
        hasHomeEquipment: hasHomeEquipment === "oui",
        homeEquipment,
        ...injuryPayload,
        profileCompleted: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      markProfileCompleted(user.uid);
      setTimeout(() => {
        if (!navigationRef.isReady()) return;
        navigationRef.resetRoot({
          index: 0,
          routes: [
            {
              name: "Tabs",
              params: {
                screen: selectedMode === "coach" ? "Coach" : "Home",
              },
            },
          ],
        });
      }, 0);
      haptics.success();
      showToast({ type: "success", title: "Profil enregistré", message: "Configuration terminée !" });
    } catch (error) {
      if (__DEV__) console.error("Erreur sauvegarde profil:", error);
      runShake(shake);
      haptics.error();
      showToast({ type: "error", title: "Erreur", message: "Impossible d'enregistrer le profil." });
    } finally {
      setLoading(false);
    }
  };

  /* ─── Render helpers ─── */
  const Choice = ({ label: lbl, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity
      style={[styles.choice, selected && styles.choiceSelected]}
      onPress={() => { hapticSelect(); onPress(); }}
      activeOpacity={0.7}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{lbl}</Text>
      {selected && (
        <Ionicons name="checkmark-circle" size={20} color={palette.accent} />
      )}
    </TouchableOpacity>
  );

  const Chip = ({ label: lbl, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={() => { hapticSelect(); onPress(); }}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{lbl}</Text>
    </TouchableOpacity>
  );

  const Tile = ({
    label: lbl,
    selected,
    onPress,
    compact = false,
  }: {
    label: string;
    selected: boolean;
    onPress: () => void;
    compact?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.tile, compact && styles.tileCompact, selected && styles.tileSelected]}
      onPress={() => { hapticSelect(); onPress(); }}
      activeOpacity={0.7}
    >
      <Text style={[styles.tileText, selected && styles.tileTextSelected]}>{lbl}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={18} color={palette.accent} /> : null}
    </TouchableOpacity>
  );

  const stepSummary = (() => {
    switch (step) {
      case 0:
        return [
          selectedMode === "player" ? "Joueur" : selectedMode === "coach" ? "Coach" : "",
          position || "",
          level || "",
          dominantFoot || "",
        ].filter(Boolean);
      case 1:
        return [
          mainObjective ? "Objectif choisi" : "",
          targetFksSessionsPerWeek ? `${targetFksSessionsPerWeek} séances / sem` : "",
          hasClubTrainings === "oui" ? `Club ${clubTrainingDays.length}j` : "Sans club",
          matchesPerWeek && Number(matchesPerWeek) > 0 ? `${matchesPerWeek} match(s)` : "",
        ].filter(Boolean);
      case 2:
        return [
          hasGymAccess === "oui" ? "Salle" : hasGymAccess === "occasionnel" ? "Salle parfois" : "Sans salle",
          gymEquipment.length ? `${gymEquipment.length} matos salle` : "",
          hasHomeEquipment === "oui" ? `${homeEquipment.length} matos perso` : "Poids du corps",
        ].filter(Boolean);
      case 3:
        return [
          hasInjury === "no" ? "Aucune zone sensible" : "",
          hasInjury === "yes" && injury?.area ? `Zone : ${injury.area}` : "",
          hasInjury === "yes" && injury?.severity
            ? `Gêne ${injury.severity === 1 ? "légère" : injury.severity === 2 ? "modérée" : "forte"}`
            : "",
        ].filter(Boolean);
      default:
        return [];
    }
  })();

  /* ─── Step content ─── */
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>On pose ton profil de jeu</Text>
              <Text style={styles.introText}>
                Quelques infos simples pour que FKS te place dans le bon couloir des le debut.
              </Text>
            </View>

            <Text style={styles.fieldLabel}>Tu es...</Text>
            <View style={styles.tileGrid}>
              <Tile label="Joueur" selected={selectedMode === "player"} onPress={() => setSelectedMode("player")} compact />
              <Tile label="Coach" selected={selectedMode === "coach"} onPress={() => setSelectedMode("coach")} compact />
            </View>

            <Text style={styles.fieldLabel}>Prenom</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Kylian"
              placeholderTextColor={authColors.muted}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Poste</Text>
            <View style={styles.tileGrid}>
              {positions.map((p) => (
                <Tile key={p} label={p} selected={position === p} onPress={() => setPosition(p)} compact />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Niveau</Text>
            <View style={styles.tileGrid}>
              {levels.map((l) => (
                <Tile key={l} label={l} selected={level === l} onPress={() => setLevel(l)} compact />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Pied fort</Text>
            <View style={styles.chipRow}>
              {dominantFeet.map((f) => (
                <Chip key={f} label={f} selected={dominantFoot === f} onPress={() => setDominantFoot(f)} />
              ))}
            </View>
          </>
        );

      case 1:
        return (
          <>
            <Text style={styles.fieldLabel}>Objectif principal avec FKS</Text>
            {objectives.map((o) => (
              <Choice key={o} label={o} selected={mainObjective === o} onPress={() => setMainObjective(o)} />
            ))}

            <Text style={styles.fieldLabel}>Séances FKS / semaine (hors club)</Text>
            <View style={styles.chipRow}>
              {fksSessionsOptions.map((o) => (
                <Chip key={o} label={o} selected={targetFksSessionsPerWeek === o} onPress={() => setTargetFksSessionsPerWeek(o)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>As-tu des entrainements club ?</Text>
            <View style={styles.chipRow}>
              <Chip label="Oui" selected={hasClubTrainings === "oui"} onPress={() => setHasClubTrainings("oui")} />
              <Chip label="Non" selected={hasClubTrainings === "non"} onPress={() => setHasClubTrainings("non")} />
            </View>

            {hasClubTrainings === "oui" && (
              <>
                <Text style={styles.fieldLabel}>Quels jours ?</Text>
                <View style={styles.chipRowWrap}>
                  {daysOfWeek.map((d) => (
                    <Chip key={d.id} label={d.label} selected={clubTrainingDays.includes(d.id)}
                      onPress={() => toggleInList(d.id, clubTrainingDays, setClubTrainingDays)} />
                  ))}
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>Matchs / semaine</Text>
            <TextInput style={styles.input} keyboardType="number-pad" placeholder="ex: 1"
              placeholderTextColor={authColors.muted} value={matchesPerWeek} onChangeText={setMatchesPerWeek} />

            {Number(matchesPerWeek) > 0 && (
              <>
                <Text style={styles.fieldLabel}>Jours de match</Text>
                <View style={styles.chipRowWrap}>
                  {daysOfWeek.map((d) => (
                    <Chip key={`m${d.id}`} label={d.label} selected={matchDays.includes(d.id)}
                      onPress={() => toggleInList(d.id, matchDays, setMatchDays)} />
                  ))}
                </View>
              </>
            )}
          </>
        );

      case 2:
        return (
          <>
            <Text style={styles.fieldLabel}>Accès à une salle ?</Text>
            <View style={styles.chipRow}>
              <Chip label="Oui" selected={hasGymAccess === "oui"} onPress={() => setHasGymAccess("oui")} />
              <Chip label="Parfois" selected={hasGymAccess === "occasionnel"} onPress={() => setHasGymAccess("occasionnel")} />
              <Chip label="Non" selected={hasGymAccess === "non"} onPress={() => setHasGymAccess("non")} />
            </View>

            {hasGymAccess !== "" && hasGymAccess !== "non" && (
              <>
                <Text style={styles.fieldLabel}>Matériel en salle</Text>
                <Text style={styles.hintText}>Coche ce que tu utilises vraiment.</Text>
                {gymEquipmentGroups.map((group) => (
                  <View key={group.title} style={styles.optionGroup}>
                    <View style={styles.groupHeader}>
                      <Text style={styles.groupTitle}>{group.title}</Text>
                      <View style={[styles.groupBadge, group.options.some((o) => gymEquipment.includes(o.id)) && styles.groupBadgeActive]}>
                        <Text style={[styles.groupBadgeText, group.options.some((o) => gymEquipment.includes(o.id)) && styles.groupBadgeTextActive]}>
                          {group.options.filter((o) => gymEquipment.includes(o.id)).length}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.tileGrid}>
                      {group.options.map((o) => (
                        <Tile key={o.id} label={o.label} selected={gymEquipment.includes(o.id)}
                          onPress={() => toggleInList(o.id, gymEquipment, setGymEquipment)} />
                      ))}
                    </View>
                  </View>
                ))}
              </>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Matériel terrain / maison ?</Text>
            <View style={styles.chipRow}>
              <Chip label="Oui" selected={hasHomeEquipment === "oui"} onPress={() => setHasHomeEquipment("oui")} />
              <Chip label="Non, rien" selected={hasHomeEquipment === "non"} onPress={() => setHasHomeEquipment("non")} />
            </View>

            {hasHomeEquipment === "oui" && (
              <>
                <Text style={styles.hintText}>Coche ce qui est vraiment dispo pour toi.</Text>
                {homeEquipmentGroups.map((group) => (
                  <View key={group.title} style={styles.optionGroup}>
                    <View style={styles.groupHeader}>
                      <Text style={styles.groupTitle}>{group.title}</Text>
                      <View style={[styles.groupBadge, group.options.some((o) => homeEquipment.includes(o.id)) && styles.groupBadgeActive]}>
                        <Text style={[styles.groupBadgeText, group.options.some((o) => homeEquipment.includes(o.id)) && styles.groupBadgeTextActive]}>
                          {group.options.filter((o) => homeEquipment.includes(o.id)).length}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.tileGrid}>
                      {group.options.map((o) => (
                        <Tile key={o.id} label={o.label} selected={homeEquipment.includes(o.id)}
                          onPress={() => toggleInList(o.id, homeEquipment, setHomeEquipment)} />
                      ))}
                    </View>
                  </View>
                ))}
              </>
            )}

            {hasGymAccess === "non" && hasHomeEquipment === "non" && (
              <Text style={styles.hintText}>Pas de souci — tes séances seront 100% poids du corps. C'est déjà super efficace !</Text>
            )}
          </>
        );

      case 3:
        // Étape 4 — Bien-être (MVP blessures Jour 3).
        // Vocabulaire Option A : "zone sensible" / "gêne" (jamais "blessure" dans l'UI).
        return (
          <>
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>Une zone sensible ?</Text>
              <Text style={styles.introText}>On adapte les séances à ton corps.</Text>
            </View>

            <Text style={styles.fieldLabel}>Où tu en es aujourd'hui</Text>
            <View style={styles.tileGrid}>
              <Tile
                label="Non, tout va bien"
                selected={hasInjury === "no"}
                onPress={() => {
                  setHasInjury("no");
                  setInjury(null);
                }}
              />
              <Tile
                label="Oui, je signale une zone sensible"
                selected={hasInjury === "yes"}
                onPress={() => setHasInjury("yes")}
              />
            </View>

            {hasInjury === "yes" ? (
              <View style={{ marginTop: 12 }}>
                <InjuryForm
                  value={injury}
                  onChange={setInjury}
                  requireLegalConsent
                  onConsentChange={setHealthConsentOk}
                  onOpenPrivacyPolicy={() => navigation.navigate("PrivacyPolicy")}
                />
              </View>
            ) : null}
          </>
        );

      default:
        return null;
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;
  const progressPercent = ((step + 1) / TOTAL_STEPS) * 100;
  const nextButtonLabel = isLastStep
    ? (loading ? "Enregistrement..." : "Entrer dans FKS")
    : `Vers ${STEPS[step + 1].label}`;
  const stepContext = STEP_CONTEXT[step];
  const handleSignOut = () => {
    Alert.alert(
      "Quitter le setup ?",
      "Tu pourras te reconnecter plus tard avec ce compte ou en choisir un autre.",
      [
        { text: "Rester", style: "cancel" },
        {
          text: "Se deconnecter",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(getAuth());
            } catch {
              showToast({
                type: "error",
                title: "Deconnexion impossible",
                message: "Impossible de fermer la session pour le moment.",
              });
            }
          },
        },
      ]
    );
  };

  return (
    <AuthBackground>
      <SafeAreaView style={styles.safeArea} edges={["top", "right", "left", "bottom"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ flex: 1 }}>

              {/* ─── Progress section ─── */}
              <View style={styles.progressSection}>
                <View style={styles.progressTopRow}>
                  <Text style={styles.progressExitHint}>Pas le bon compte ?</Text>
                  <TouchableOpacity
                    style={styles.exitButton}
                    onPress={handleSignOut}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="log-out-outline" size={16} color={authColors.sub} />
                    <Text style={styles.exitButtonText}>Se deconnecter</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressStep}>Etape {step + 1}/{TOTAL_STEPS}</Text>
                  <Text style={styles.progressName}>{STEPS[step].label}</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <LinearGradient
                    colors={[palette.accent, theme.colors.accentAlt]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                  />
                </View>
                <View style={styles.progressMetaRow}>
                  <View style={styles.progressMetaPill}>
                    <Text style={styles.progressMetaText}>{stepContext.badge}</Text>
                  </View>
                  <Text style={styles.progressMetaHint}>{stepContext.detail}</Text>
                </View>
                <View style={styles.progressDots}>
                  {STEPS.map((item, index) => (
                    <View
                      key={`${item.label}-${index}`}
                      style={[
                        styles.progressDot,
                        index < step && styles.progressDotDone,
                        index === step && styles.progressDotActive,
                      ]}
                    />
                  ))}
                </View>
              </View>

              {/* ─── Content ─── */}
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Animated.View style={{ opacity: stepFade, transform: [{ translateX: shake }] }}>

                  {/* Step header */}
                  <View style={styles.stepHeader}>
                    <LinearGradient
                      colors={[palette.accent, theme.colors.accentAlt]}
                      style={styles.stepIconCircle}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name={STEPS[step].icon} size={28} color={theme.colors.white} />
                    </LinearGradient>
                    <View>
                      <Text style={styles.stepTitle}>{STEPS[step].label}</Text>
                      <Text style={styles.stepSubtitle}>{STEPS[step].subtitle}</Text>
                    </View>
                  </View>

                  {/* Card container */}
                  <View style={styles.card}>
                    {renderStep()}
                  </View>

                  {stepSummary.length > 0 ? (
                    <View style={styles.summaryCard}>
                      <Text style={styles.summaryTitle}>Recap rapide</Text>
                      <View style={styles.summaryRow}>
                        {stepSummary.map((item) => (
                          <View key={item} style={styles.summaryPill}>
                            <Text style={styles.summaryPillText}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                </Animated.View>
              </ScrollView>

              {/* ─── Footer ─── */}
              <View style={styles.footer}>
                {step > 0 ? (
                  <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={20} color={authColors.sub} />
                    <Text style={styles.backText}>Retour</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flex: 1 }} />
                )}

                <TouchableOpacity
                  style={[styles.nextButton, loading && { opacity: 0.4 }]}
                  onPress={isLastStep ? handleSave : goNext}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={[palette.accent, theme.colors.accentAlt]}
                    style={styles.nextButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.nextButtonText}>
                      {nextButtonLabel}
                    </Text>
                    <Ionicons
                      name={isLastStep ? "checkmark-circle" : "arrow-forward"}
                      size={20}
                      color={theme.colors.white}
                    />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>

        <LoadingOverlay
          visible={loading}
          message="Enregistrement de ton profil..."
          submessage="Configuration initiale en cours."
        />
      </SafeAreaView>
    </AuthBackground>
  );
}

/* ══════════ STYLES ══════════ */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  /* Progress */
  progressSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  progressTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressExitHint: {
    fontSize: TYPE.caption.fontSize,
    color: authColors.sub,
  },
  exitButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    backgroundColor: theme.colors.white05,
    borderWidth: 1,
    borderColor: theme.colors.white08,
  },
  exitButtonText: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: authColors.sub,
  },
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressStep: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
    color: authColors.sub,
  },
  progressName: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  progressBarBg: {
    height: 6,
    borderRadius: RADIUS.xs,
    backgroundColor: authColors.borderSoft,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: RADIUS.xs,
  },
  progressMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressMetaPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: theme.colors.white06,
    borderWidth: 1,
    borderColor: theme.colors.white07,
  },
  progressMetaText: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "700",
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  progressMetaHint: {
    flex: 1,
    fontSize: TYPE.caption.fontSize,
    lineHeight: 17,
    color: authColors.sub,
  },
  progressDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressDot: {
    flex: 1,
    height: 4,
    borderRadius: RADIUS.pill,
    backgroundColor: theme.colors.white10,
  },
  progressDotDone: {
    backgroundColor: theme.colors.accentSoft45,
  },
  progressDotActive: {
    backgroundColor: palette.accent,
  },

  /* Scroll */
  scrollContent: {
    padding: 20,
    paddingBottom: 24,
    flexGrow: 1,
  },

  /* Step header */
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  },
  stepIconCircle: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadow.accent,
  },
  stepTitle: {
    fontSize: TYPE.title.fontSize,
    fontWeight: "800",
    color: authColors.text,
  },
  stepSubtitle: {
    fontSize: TYPE.body.fontSize,
    color: authColors.sub,
    marginTop: 2,
  },

  /* Card — semi-transparent pour voir l'image de fond */
  card: {
    borderRadius: RADIUS.xl,
    padding: 20,
    backgroundColor: theme.colors.panel92,
    borderWidth: 1,
    borderColor: theme.colors.white07,
    overflow: "hidden",
    gap: 6,
    ...theme.shadow.soft,
  },
  summaryCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.colors.white04,
    borderWidth: 1,
    borderColor: theme.colors.white06,
  },
  summaryTitle: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: authColors.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  summaryPill: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: theme.colors.white05,
    borderWidth: 1,
    borderColor: theme.colors.white07,
  },
  summaryPillText: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
    color: authColors.text,
  },

  /* Fields */
  fieldLabel: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: authColors.sub,
    marginTop: 14,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.white08,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: TYPE.body.fontSize,
    color: authColors.text,
    backgroundColor: theme.colors.black72,
  },

  /* Choice */
  choice: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: RADIUS.md,
    marginBottom: 8,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  choiceSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  choiceText: {
    color: authColors.text,
    fontSize: TYPE.body.fontSize,
    flex: 1,
  },
  choiceTextSelected: {
    color: palette.accent,
    fontWeight: "700",
  },

  /* Chip */
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chipRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: "transparent",
  },
  chipSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  chipText: {
    color: authColors.sub,
    fontWeight: "600",
    fontSize: TYPE.body.fontSize,
  },
  chipTextSelected: {
    color: palette.accent,
    fontWeight: "700",
    fontSize: TYPE.body.fontSize,
  },

  introCard: {
    padding: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.colors.white04,
    borderWidth: 1,
    borderColor: theme.colors.white06,
    marginBottom: 6,
  },
  introTitle: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: authColors.text,
  },
  introText: {
    marginTop: 4,
    fontSize: TYPE.caption.fontSize,
    lineHeight: 18,
    color: authColors.sub,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tile: {
    minHeight: 70,
    width: "48%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: theme.colors.white03,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  tileCompact: {
    minHeight: 58,
  },
  tileSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  tileText: {
    flex: 1,
    color: authColors.text,
    fontSize: TYPE.body.fontSize,
    lineHeight: 19,
    fontWeight: "600",
  },
  tileTextSelected: {
    color: palette.accent,
  },
  optionGroup: {
    gap: 10,
    marginTop: 12,
    padding: 14,
    borderRadius: RADIUS.lg,
    backgroundColor: theme.colors.white03,
    borderWidth: 1,
    borderColor: theme.colors.white05,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  groupTitle: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: authColors.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  groupBadge: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    backgroundColor: theme.colors.white05,
    borderWidth: 1,
    borderColor: theme.colors.white06,
  },
  groupBadgeActive: {
    backgroundColor: palette.accentSoft,
    borderColor: theme.colors.accentSoft28,
  },
  groupBadgeText: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: authColors.sub,
  },
  groupBadgeTextActive: {
    color: palette.accent,
  },

  /* Cycle card */
  cycleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: RADIUS.md,
    backgroundColor: theme.colors.white04,
    borderWidth: 1,
    borderColor: authColors.border,
  },
  cycleLabel: {
    color: authColors.text,
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
  },
  cycleHint: {
    color: authColors.sub,
    fontSize: TYPE.caption.fontSize,
    lineHeight: 16,
    marginTop: 2,
  },
  cycleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: "transparent",
  },
  cycleButtonText: {
    color: palette.accent,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
  },

  hintText: {
    color: authColors.sub,
    fontSize: TYPE.caption.fontSize,
    marginTop: 8,
    lineHeight: 18,
  },

  /* Footer */
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.white06,
    backgroundColor: theme.colors.panel88,
  },
  backButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  backText: {
    fontSize: TYPE.body.fontSize,
    color: authColors.sub,
    fontWeight: "600",
  },
  nextButton: {
    flex: 2,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    ...theme.shadow.accent,
  },
  nextButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  nextButtonText: {
    fontSize: TYPE.body.fontSize,
    fontWeight: "700",
    color: theme.colors.white,
  },
});
