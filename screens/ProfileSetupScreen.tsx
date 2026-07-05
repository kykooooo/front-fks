// screens/ProfileSetupScreen.tsx
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
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  BackHandler,
} from "react-native";
import { Screen } from "../components/ui/Screen";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getAuth, signOut } from "firebase/auth";
import { useHaptics } from "../hooks/useHaptics";
import { auth as firebaseAuth, db } from "../services/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { findClubByInviteCode, normalizeInviteCode, setClubMembership } from "../repositories/clubsRepo";
import { MICROCYCLES, MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../domain/microcycles";
import { AGE_CATEGORIES } from "../domain/types";
import { recommendMicrocycle } from "../domain/recommendMicrocycle";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { showToast } from "../utils/toast";
import { runShake } from "../utils/animations";
import { theme } from "../constants/theme";

const TOTAL_STEPS = 5;
const palette = theme.colors;

/* ─── Steps config ─── */
const STEPS: { label: string; icon: keyof typeof Ionicons.glyphMap; subtitle: string }[] = [
  { label: "Identité", icon: "person-outline", subtitle: "Dis-nous qui tu es" },
  { label: "Objectif", icon: "flag-outline", subtitle: "Quel est ton but ?" },
  { label: "Club", icon: "people-outline", subtitle: "Tes entraînements & matchs" },
  { label: "Salle", icon: "barbell-outline", subtitle: "Ton accès salle" },
  { label: "Matériel", icon: "home-outline", subtitle: "Ton équipement hors salle" },
];

/* ─── Constants ─── */
const positions = ["Gardien", "Defenseur", "Milieu", "Attaquant"] as const;
const levels = ["Amateur", "Regional", "National", "Semi-pro", "Pro"] as const;
const dominantFeet = ["Pied droit", "Pied gauche", "Ambidextre"] as const;
const objectives = [
  "Etre en forme toute la saison",
  "Gagner en vitesse / explosivite",
  "Mieux encaisser les entraînements et les matchs",
  "Reprendre apres une blessure",
] as const;
const fksSessionsOptions = ["1", "2", "3", "4"] as const;

// ⚠️ Les valeurs de `positions`, `levels` et `objectives` sont PERSISTÉES en Firestore
// et comparées à des allowlists SANS accents côté Cloud Functions (functions/src/coachLabels.ts)
// + matching substring dans recommendMicrocycle. On ne les modifie donc JAMAIS :
// ces maps servent uniquement à afficher un libellé accentué dans l'UI.
const POSITION_DISPLAY_LABELS: Partial<Record<(typeof positions)[number], string>> = {
  Defenseur: "Défenseur",
};
const LEVEL_DISPLAY_LABELS: Partial<Record<(typeof levels)[number], string>> = {
  Regional: "Régional",
};
const OBJECTIVE_DISPLAY_LABELS: Partial<Record<(typeof objectives)[number], string>> = {
  "Etre en forme toute la saison": "Être en forme toute la saison",
  "Gagner en vitesse / explosivite": "Gagner en vitesse / explosivité",
  "Reprendre apres une blessure": "Reprendre après une blessure",
};

const gymEquipmentOptions = [
  { id: "barbell", label: "Barre + poids libres" },
  { id: "squat_rack", label: "Rack à squat" },
  { id: "bench", label: "Banc de musculation" },
  { id: "dumbbells_light", label: "Haltères légers (≤ 10 kg)" },
  { id: "dumbbells_medium", label: "Haltères moyens (10-25 kg)" },
  { id: "dumbbells_heavy", label: "Haltères lourds (≥ 25 kg)" },
  { id: "kettlebell", label: "Kettlebells" },
  { id: "leg_press", label: "Presse (leg press)" },
  { id: "cable_machine", label: "Poulies / câble" },
  { id: "smith_machine", label: "Smith machine" },
  { id: "pullup_bar", label: "Barre de tractions" },
  { id: "box_plyo", label: "Box plyo" },
  { id: "bosu", label: "BOSU" },
  { id: "foam_roller", label: "Foam roller / rouleau" },
  { id: "yoga_mat", label: "Tapis de sol" },
];

const homeEquipmentOptions = [
  { id: "field", label: "Terrain herbe / synthé" },
  { id: "street_area", label: "City / bitume / parking" },
  { id: "indoor_small", label: "Petit espace intérieur" },
  { id: "cones", label: "Cônes" },
  { id: "flat_markers", label: "Plots plats" },
  { id: "speed_ladder", label: "Échelle de rythme" },
  { id: "mini_hurdles", label: "Petites haies" },
  { id: "minibands", label: "Mini-bands" },
  { id: "long_bands", label: "Élastiques longs" },
  { id: "home_dumbbells", label: "Haltères (chez toi)" },
  { id: "home_kettlebell", label: "Kettlebell (chez toi)" },
  { id: "sandbag", label: "Sac de sable / sandbag" },
  { id: "home_foam_roller", label: "Foam roller (chez toi)" },
  { id: "home_yoga_mat", label: "Tapis de sol (chez toi)" },
];

const daysOfWeek = [
  { id: "mon", label: "Lun" }, { id: "tue", label: "Mar" }, { id: "wed", label: "Mer" },
  { id: "thu", label: "Jeu" }, { id: "fri", label: "Ven" }, { id: "sat", label: "Sam" },
  { id: "sun", label: "Dim" },
];

const toggleInList = (value: string, list: string[], setter: (next: string[]) => void) => {
  setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
};

/* ══════════════════════════════════════════ */
type ProfileSetupScreenProps = {
  /** Fourni par RootNavigator pendant l'onboarding : bascule immédiate vers l'app
   *  après enregistrement réussi (le listener Firestore reste la source durable).
   *  Absent quand l'écran est ouvert en édition depuis l'app déjà complète. */
  onProfileCompleted?: () => void;
};

export default function ProfileSetupScreen({ onProfileCompleted }: ProfileSetupScreenProps = {}) {
  const navigation = useNavigation<any>();
  const haptics = useHaptics();
  // Mode édition : écran ouvert depuis Profil/Réglages (header natif "Profil" déjà présent).
  const isEditMode = !onProfileCompleted;
  const activeCycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const setMicrocycleGoal = useSessionsStore((s) => s.setMicrocycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);
  const scrollRef = useRef<ScrollView>(null);

  /* ─── Step state ─── */
  const [step, setStep] = useState(0);

  /* ─── Form state ─── */
  const [firstName, setFirstName] = useState("");
  const [clubId, setClubId] = useState("");
  const [clubInviteCode, setClubInviteCode] = useState("");
  const [position, setPosition] = useState("");
  const [ageCategory, setAgeCategory] = useState("");
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
    // Fallback si le doc Firestore n'a pas (encore) de prénom : le setDoc du Register
    // peut arriver après ce getDoc one-shot (course), on récupère le displayName auth.
    const fallbackFirstName = user.displayName?.trim() ?? "";
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      const d = snap.data();
      const docFirstName = d && typeof d.firstName === "string" ? d.firstName.trim() : "";
      if (docFirstName) setFirstName(docFirstName);
      else if (fallbackFirstName) setFirstName(fallbackFirstName);
      if (!d) return;
      if (typeof d.clubId === "string") setClubId(d.clubId);
      if (typeof d.position === "string") setPosition(d.position);
      if (typeof d.ageCategory === "string") setAgeCategory(d.ageCategory);
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
        if (!firstName.trim()) { fail("Champs manquants", "Merci d'indiquer ton prénom."); return false; }
        if (!positions.includes(position as any)) { fail("Champs manquants", "Choisis ton poste."); return false; }
        if (!AGE_CATEGORIES.includes(ageCategory as any)) { fail("Champs manquants", "Choisis ta catégorie."); return false; }
        if (!levels.includes(level as any)) { fail("Champs manquants", "Indique ton niveau."); return false; }
        if (!dominantFeet.includes(dominantFoot as any)) { fail("Champs manquants", "Choisis ton pied fort."); return false; }
        return true;
      case 1:
        if (!objectives.includes(mainObjective as any)) { fail("Champs manquants", "Choisis ton objectif principal."); return false; }
        if (!fksSessionsOptions.includes(targetFksSessionsPerWeek as any)) { fail("Champs manquants", "Indique tes séances FKS / semaine."); return false; }
        return true;
      case 2: {
        const trainings = Number(clubTrainingsPerWeek);
        const matches = Number(matchesPerWeek);
        if (!Number.isFinite(trainings) || trainings < 0) { fail("Valeur invalide", "Entraînements/semaine doit être positif."); return false; }
        if (!Number.isFinite(matches) || matches < 0) { fail("Valeur invalide", "Matchs/semaine doit être positif."); return false; }
        if (!hasClubTrainings) { fail("Champs manquants", "Indique si tu as des entraînements club."); return false; }
        if (hasClubTrainings === "oui" && (!clubTrainingsPerWeek.trim() || trainings < 1)) { fail("Champs manquants", "Indique combien d'entraînements club par semaine."); return false; }
        if (hasClubTrainings === "oui" && clubTrainingDays.length === 0) { fail("Champs manquants", "Précise les jours club."); return false; }
        if (matches > 0 && matchDays.length === 0) { fail("Champs manquants", "Précise les jours de match."); return false; }
        return true;
      }
      case 3:
        if (!hasGymAccess) { fail("Champs manquants", "Indique si tu as accès à une salle."); return false; }
        if (hasGymAccess !== "non" && gymEquipment.length === 0) { fail("Champs manquants", "Sélectionne au moins un matériel en salle."); return false; }
        return true;
      case 4:
        if (!hasHomeEquipment) { fail("Champs manquants", "Indique si tu as du matériel hors salle."); return false; }
        if (hasHomeEquipment === "oui" && homeEquipment.length === 0) { fail("Champs manquants", "Sélectionne au moins un matériel."); return false; }
        return true;
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

  /* ─── Back hardware Android : étape précédente au lieu de quitter l'app ─── */
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step > 0) {
        goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleLogout = async () => {
    haptics.impactLight();
    try {
      await signOut(firebaseAuth);
      // Le listener auth du RootNavigator renvoie automatiquement vers la connexion.
    } catch (e) {
      if (__DEV__) console.warn("[ProfileSetup] signOut failed", e);
      showToast({ type: "error", title: "Erreur", message: "Déconnexion impossible. Réessaie." });
    }
  };

  /* ─── Save ─── */
  const handleSave = async () => {
    if (!validateStep()) return;
    const targetFksSessions = Number(targetFksSessionsPerWeek);
    const trainings = Number(clubTrainingsPerWeek);
    const matches = Number(matchesPerWeek);
    const normalizedInvite = normalizeInviteCode(clubInviteCode);

    // Auto-assign : si aucun cycle actif, on applique la reco basée sur l'objectif
    // pour que le joueur atterrisse sur l'accueil avec un cycle prêt (zéro étape morte).
    const autoCycleId = isMicrocycleId(activeCycleGoal)
      ? null
      : recommendMicrocycle({ mainObjective, lastTestPlaylist: null }).id;

    try {
      setLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) { fail("Connexion requise", "Connecte-toi pour enregistrer ton profil."); return; }

      let resolvedClubId: string | null = clubId?.trim() ? clubId.trim() : null;
      if (normalizedInvite) {
        const club = await findClubByInviteCode(normalizedInvite);
        if (!club) {
          fail("Code club invalide", "Aucun club ne correspond à ce code.");
          // Retour automatique à l'étape du code club (avec scroll top via animateTransition)
          // pour ne pas laisser l'utilisateur bloqué à la dernière étape.
          if (step !== 0) animateTransition(0);
          return;
        }
        resolvedClubId = club.id;
        await setClubMembership({ clubId: club.id, uid: user.uid, role: "player" });
      }

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        firstName: firstName.trim(),
        clubId: resolvedClubId,
        position, ageCategory, level, dominantFoot, mainObjective,
        targetFksSessionsPerWeek: targetFksSessions,
        clubTrainingsPerWeek: trainings,
        matchesPerWeek: matches,
        hasClubTrainings, clubTrainingDays,
        matchDay: matchDays[0] ?? null, matchDays,
        hasGymAccess: hasGymAccess === "oui" ? "regular" : hasGymAccess === "occasionnel" ? "occasional" : "none",
        gymEquipment,
        hasHomeEquipment: hasHomeEquipment === "oui",
        homeEquipment,
        profileCompleted: true,
        ...(autoCycleId
          ? {
              microcycleGoal: autoCycleId,
              goal: autoCycleId,
              programGoal: autoCycleId,
              microcycleStatus: "active",
              microcycleTotalSessions: MICROCYCLE_TOTAL_SESSIONS_DEFAULT,
              microcycleSessionIndex: 0,
              microcycleStartedAt: serverTimestamp(),
            }
          : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      if (autoCycleId) setMicrocycleGoal(autoCycleId);

      haptics.success();
      showToast({ type: "success", title: "Profil enregistré", message: "Configuration terminée !" });

      // Pont local : bascule immédiate vers l'app sans attendre le onSnapshot Firestore
      // (le listener RootNavigator reste la source durable).
      // En mode édition (ouvert depuis Profil/Réglages), on referme simplement l'écran.
      if (onProfileCompleted) {
        onProfileCompleted();
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      }
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

  /* ─── Step content ─── */
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Text style={styles.fieldLabel}>Prénom</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Kylian"
              placeholderTextColor={palette.muted}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Code club (optionnel)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: FKSFC-2026"
              placeholderTextColor={palette.muted}
              value={clubInviteCode}
              onChangeText={setClubInviteCode}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Poste</Text>
            {positions.map((p) => (
              <Choice key={p} label={POSITION_DISPLAY_LABELS[p] ?? p} selected={position === p} onPress={() => setPosition(p)} />
            ))}

            <Text style={styles.fieldLabel}>Catégorie</Text>
            <View style={styles.chipRow}>
              {AGE_CATEGORIES.map((c) => (
                <Chip key={c} label={c} selected={ageCategory === c} onPress={() => setAgeCategory(c)} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>Niveau</Text>
            {levels.map((l) => (
              <Choice key={l} label={LEVEL_DISPLAY_LABELS[l] ?? l} selected={level === l} onPress={() => setLevel(l)} />
            ))}

            <Text style={styles.fieldLabel}>Pied fort</Text>
            <View style={styles.chipRow}>
              {dominantFeet.map((f) => (
                <Chip key={f} label={f} selected={dominantFoot === f} onPress={() => setDominantFoot(f)} />
              ))}
            </View>

            <TouchableOpacity
              style={styles.coachLink}
              onPress={() => { haptics.impactLight(); navigation.navigate("CoachOnboarding"); }}
              activeOpacity={0.7}
            >
              <Ionicons name="people-outline" size={16} color={palette.accent} />
              <Text style={styles.coachLinkText}>Tu fais partie du staff ? Crée ton club coach</Text>
            </TouchableOpacity>
          </>
        );

      case 1:
        return (
          <>
            <View style={styles.cycleCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cycleLabel}>
                  {cycleLabel ? `${cycleLabel} · ${cycleProgress}/${MICROCYCLE_TOTAL_SESSIONS_DEFAULT}` : "Aucun cycle actif"}
                </Text>
                <Text style={styles.cycleHint}>Gère ton cycle depuis l'accueil ou le profil.</Text>
              </View>
              <TouchableOpacity
                style={styles.cycleButton}
                onPress={() => navigation.navigate("CycleModal", { mode: cycleLabel ? "manage" : "select", origin: "profile" })}
                activeOpacity={0.7}
              >
                <Text style={styles.cycleButtonText}>{cycleLabel ? "Gérer" : "Choisir"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Objectif principal avec FKS</Text>
            {objectives.map((o) => (
              <Choice key={o} label={OBJECTIVE_DISPLAY_LABELS[o] ?? o} selected={mainObjective === o} onPress={() => setMainObjective(o)} />
            ))}

            <Text style={styles.fieldLabel}>Séances FKS / semaine (hors club)</Text>
            <View style={styles.chipRow}>
              {fksSessionsOptions.map((o) => (
                <Chip key={o} label={o} selected={targetFksSessionsPerWeek === o} onPress={() => setTargetFksSessionsPerWeek(o)} />
              ))}
            </View>
          </>
        );

      case 2:
        return (
          <>
            <Text style={styles.fieldLabel}>As-tu des entraînements club ?</Text>
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

            {hasClubTrainings === "oui" ? (
              <>
                <Text style={styles.fieldLabel}>Entraînements club / semaine</Text>
                <TextInput style={styles.input} keyboardType="number-pad" placeholder="ex: 3"
                  placeholderTextColor={palette.muted} value={clubTrainingsPerWeek} onChangeText={setClubTrainingsPerWeek} />
              </>
            ) : hasClubTrainings === "non" ? (
              <Text style={styles.hintText}>Aucun entraînement club pris en compte.</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Matchs / semaine</Text>
            <TextInput style={styles.input} keyboardType="number-pad" placeholder="ex: 1"
              placeholderTextColor={palette.muted} value={matchesPerWeek} onChangeText={setMatchesPerWeek} />

            {Number(matchesPerWeek) > 0 ? (
              <>
                <Text style={styles.fieldLabel}>Jours de match</Text>
                <View style={styles.chipRowWrap}>
                  {daysOfWeek.map((d) => (
                    <Chip key={`m${d.id}`} label={d.label} selected={matchDays.includes(d.id)}
                      onPress={() => toggleInList(d.id, matchDays, setMatchDays)} />
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.hintText}>Aucun match sélectionné.</Text>
            )}

          </>
        );

      case 3:
        return (
          <>
            <Text style={styles.fieldLabel}>Accès à une salle de musculation ?</Text>
            <View style={styles.chipRow}>
              <Chip label="Oui régulièrement" selected={hasGymAccess === "oui"} onPress={() => setHasGymAccess("oui")} />
              <Chip label="De temps en temps" selected={hasGymAccess === "occasionnel"} onPress={() => setHasGymAccess("occasionnel")} />
              <Chip label="Non" selected={hasGymAccess === "non"} onPress={() => setHasGymAccess("non")} />
            </View>

            {hasGymAccess !== "" && hasGymAccess !== "non" && (
              <>
                <Text style={styles.fieldLabel}>Matériel disponible en salle</Text>
                {gymEquipmentOptions.map((o) => (
                  <Choice key={o.id} label={o.label} selected={gymEquipment.includes(o.id)}
                    onPress={() => toggleInList(o.id, gymEquipment, setGymEquipment)} />
                ))}
              </>
            )}
          </>
        );

      case 4:
        return (
          <>
            <Text style={styles.fieldLabel}>As-tu du matériel chez toi / sur le terrain ?</Text>
            <View style={styles.chipRow}>
              <Chip label="Oui" selected={hasHomeEquipment === "oui"} onPress={() => setHasHomeEquipment("oui")} />
              <Chip label="Non" selected={hasHomeEquipment === "non"} onPress={() => setHasHomeEquipment("non")} />
            </View>

            {hasHomeEquipment === "oui" && (
              <>
                <Text style={styles.fieldLabel}>Matériel hors salle</Text>
                {homeEquipmentOptions.map((o) => (
                  <Choice key={o.id} label={o.label} selected={homeEquipment.includes(o.id)}
                    onPress={() => toggleInList(o.id, homeEquipment, setHomeEquipment)} />
                ))}
              </>
            )}
          </>
        );

      default:
        return null;
    }
  };

  const isLastStep = step === TOTAL_STEPS - 1;
  const progressPercent = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <Screen style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>

            {/* ─── Top bar : marque + changer de compte (onboarding uniquement,
                 masquée en mode édition où le header natif "Profil" fait doublon) ─── */}
            {!isEditMode && (
              <View style={styles.topBar}>
                <Text style={styles.brand}>FKS</Text>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
                  <Ionicons name="log-out-outline" size={16} color={palette.sub} />
                  <Text style={styles.logoutText}>Changer de compte</Text>
                </TouchableOpacity>
              </View>
            )}

              {/* ─── Progress section ─── */}
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressStep}>Étape {step + 1}/{TOTAL_STEPS}</Text>
                  <Text style={styles.progressName}>{STEPS[step].label}</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <LinearGradient
                    colors={[palette.accent, "#ff9a4a"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                  />
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
                      colors={[palette.accent, "#ff9a4a"]}
                      style={styles.stepIconCircle}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Ionicons name={STEPS[step].icon} size={28} color="#fff" />
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

                </Animated.View>
              </ScrollView>

              {/* ─── Footer ─── */}
              <View style={styles.footer}>
                {step > 0 ? (
                  <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={20} color={palette.sub} />
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
                    colors={[palette.accent, "#ff9a4a"]}
                    style={styles.nextButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.nextButtonText}>
                      {isLastStep ? (loading ? "Enregistrement..." : "Terminer") : "Suivant"}
                    </Text>
                    <Ionicons
                      name={isLastStep ? "checkmark-circle" : "arrow-forward"}
                      size={20}
                      color="#fff"
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
      </Screen>
  );
}

/* ══════════ STYLES ══════════ */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  brand: {
    fontSize: 20,
    fontWeight: "900",
    color: palette.text,
    letterSpacing: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.sub,
  },

  /* Progress */
  progressSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressStep: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.sub,
  },
  progressName: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
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
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    ...theme.shadow.accent,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.text,
  },
  stepSubtitle: {
    fontSize: 14,
    color: palette.sub,
    marginTop: 2,
  },

  /* Card */
  card: {
    borderRadius: theme.radius.xxl,
    padding: 20,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
    gap: 4,
    ...theme.shadow.soft,
  },

  /* Fields */
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.sub,
    marginTop: 14,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.cardSoft,
  },

  /* Choice */
  choice: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: theme.radius.md,
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
    color: palette.text,
    fontSize: 15,
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
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: "transparent",
  },
  chipSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  chipText: {
    color: palette.sub,
    fontWeight: "600",
    fontSize: 14,
  },
  chipTextSelected: {
    color: palette.accent,
    fontWeight: "700",
    fontSize: 14,
  },

  /* Cycle card */
  cycleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  cycleLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "700",
  },
  cycleHint: {
    color: palette.sub,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  cycleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.accent,
    backgroundColor: "transparent",
  },
  cycleButtonText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: "700",
  },

  hintText: {
    color: palette.sub,
    fontSize: 13,
    marginTop: 8,
    fontStyle: "italic",
  },

  /* Lien coach */
  coachLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
    paddingVertical: 10,
  },
  coachLinkText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: "700",
  },

  /* Footer */
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
    backgroundColor: palette.bg,
  },
  backButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
    color: palette.sub,
    fontWeight: "600",
  },
  nextButton: {
    flex: 2,
    borderRadius: theme.radius.lg,
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
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});
