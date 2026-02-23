// screens/ProfileSetupScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getAuth } from "firebase/auth";
import { useHaptics } from "../hooks/useHaptics";
import { db } from "../services/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { findClubByInviteCode, normalizeInviteCode, setClubMembership } from "../repositories/clubsRepo";
import { MICROCYCLES, MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../domain/microcycles";
import { useTrainingStore } from "../state/trainingStore";
import { showToast } from "../utils/toast";
import { runShake } from "../utils/animations";
import { useAppModeStore } from "../state/appModeStore";

const TOTAL_STEPS = 5;

const colors = {
  text: "#f8fafc",
  sub: "#d0d9e8",
  accent: "#ff7a1a",
  accentEnd: "#ff9a4a",
  card: "rgba(8,12,20,0.74)",
  cardBorder: "rgba(255,255,255,0.15)",
  inputBg: "rgba(255,255,255,0.06)",
  inputBorder: "rgba(255,255,255,0.12)",
  selectedBg: "rgba(255,122,26,0.15)",
  progressBg: "rgba(255,255,255,0.1)",
};

/* ─── Steps config ─── */
const STEPS: { label: string; icon: keyof typeof Ionicons.glyphMap; subtitle: string }[] = [
  { label: "Identite", icon: "person-outline", subtitle: "Dis-nous qui tu es" },
  { label: "Objectif", icon: "flag-outline", subtitle: "Quel est ton but ?" },
  { label: "Club", icon: "people-outline", subtitle: "Tes entraînements & matchs" },
  { label: "Salle", icon: "barbell-outline", subtitle: "Ton acces salle" },
  { label: "Materiel", icon: "home-outline", subtitle: "Ton equipement hors salle" },
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
  const activeCycleGoal = useTrainingStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useTrainingStore((s) => s.microcycleSessionIndex);
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
  const [clubTypicalRPE, setClubTypicalRPE] = useState("");
  const [clubTypicalDurationMin, setClubTypicalDurationMin] = useState("");
  const [matchTypicalRPE, setMatchTypicalRPE] = useState("");
  const [matchTypicalDurationMin, setMatchTypicalDurationMin] = useState("");
  const [hasGymAccess, setHasGymAccess] = useState<"oui" | "occasionnel" | "non" | "">("");
  const [gymEquipment, setGymEquipment] = useState<string[]>([]);
  const [hasHomeEquipment, setHasHomeEquipment] = useState<"oui" | "non" | "">("");
  const [homeEquipment, setHomeEquipment] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const currentMode = useAppModeStore((s) => s.mode);
  const setModeForUid = useAppModeStore((s) => s.setModeForUid);
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
      if (typeof d.clubTypicalRPE === "number") setClubTypicalRPE(String(d.clubTypicalRPE));
      if (typeof d.clubTypicalDurationMin === "number") setClubTypicalDurationMin(String(d.clubTypicalDurationMin));
      if (typeof d.matchTypicalRPE === "number") setMatchTypicalRPE(String(d.matchTypicalRPE));
      if (typeof d.matchTypicalDurationMin === "number") setMatchTypicalDurationMin(String(d.matchTypicalDurationMin));
      if (typeof d.hasGymAccess === "string") {
        setHasGymAccess(d.hasGymAccess === "regular" ? "oui" : d.hasGymAccess === "occasional" ? "occasionnel" : "non");
      }
      if (Array.isArray(d.gymEquipment)) setGymEquipment(d.gymEquipment);
      if (typeof d.hasHomeEquipment === "boolean") setHasHomeEquipment(d.hasHomeEquipment ? "oui" : "non");
      if (Array.isArray(d.homeEquipment)) setHomeEquipment(d.homeEquipment);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (hasClubTrainings !== "oui") {
      setClubTrainingDays([]);
      setClubTypicalRPE("");
      setClubTypicalDurationMin("");
      if (hasClubTrainings === "non") setClubTrainingsPerWeek("0");
    }
  }, [hasClubTrainings]);

  useEffect(() => {
    const matches = Number(matchesPerWeek);
    if (!Number.isFinite(matches) || matches <= 0) {
      setMatchDays([]);
      setMatchTypicalRPE("");
      setMatchTypicalDurationMin("");
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
        if (selectedMode !== "player" && selectedMode !== "coach") { fail("Champs manquants", "Choisis ton role (joueur ou coach)."); return false; }
        if (!firstName.trim()) { fail("Champs manquants", "Merci d'indiquer ton prenom."); return false; }
        if (!positions.includes(position as any)) { fail("Champs manquants", "Choisis ton poste."); return false; }
        if (!levels.includes(level as any)) { fail("Champs manquants", "Indique ton niveau."); return false; }
        if (!dominantFeet.includes(dominantFoot as any)) { fail("Champs manquants", "Choisis ton pied fort."); return false; }
        return true;
      case 1:
        if (!objectives.includes(mainObjective as any)) { fail("Champs manquants", "Choisis ton objectif principal."); return false; }
        if (!fksSessionsOptions.includes(targetFksSessionsPerWeek as any)) { fail("Champs manquants", "Indique tes seances FKS / semaine."); return false; }
        return true;
      case 2: {
        const trainings = Number(clubTrainingsPerWeek);
        const matches = Number(matchesPerWeek);
        if (!Number.isFinite(trainings) || trainings < 0) { fail("Valeur invalide", "Entrainements/semaine doit etre positif."); return false; }
        if (!Number.isFinite(matches) || matches < 0) { fail("Valeur invalide", "Matchs/semaine doit etre positif."); return false; }
        if (!hasClubTrainings) { fail("Champs manquants", "Indique si tu as des entrainements club."); return false; }
        if (hasClubTrainings === "oui" && clubTrainingDays.length === 0) { fail("Champs manquants", "Precise les jours club."); return false; }
        if (matches > 0 && matchDays.length === 0) { fail("Champs manquants", "Precise les jours de match."); return false; }
        if (hasClubTrainings === "oui") {
          const r = Number(clubTypicalRPE || 0);
          const d = Number(clubTypicalDurationMin || 0);
          if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(d) || d <= 0) {
            fail("Champs manquants", "Indique RPE et duree d'un entrainement club.");
            return false;
          }
        }
        if (matches > 0) {
          const r = Number(matchTypicalRPE || 0);
          const d = Number(matchTypicalDurationMin || 0);
          if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(d) || d <= 0) {
            fail("Champs manquants", "Indique RPE et duree d'un match.");
            return false;
          }
        }
        return true;
      }
      case 3:
        if (!hasGymAccess) { fail("Champs manquants", "Indique si tu as acces a une salle."); return false; }
        if (hasGymAccess !== "non" && gymEquipment.length === 0) { fail("Champs manquants", "Selectionne au moins un materiel en salle."); return false; }
        return true;
      case 4:
        if (!hasHomeEquipment) { fail("Champs manquants", "Indique si tu as du materiel hors salle."); return false; }
        if (hasHomeEquipment === "oui" && homeEquipment.length === 0) { fail("Champs manquants", "Selectionne au moins un materiel."); return false; }
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

      // Set mode (player/coach) avant le write Firestore
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
        clubTypicalRPE: Number(clubTypicalRPE || 0) || null,
        clubTypicalDurationMin: Number(clubTypicalDurationMin || 0) || null,
        matchTypicalRPE: Number(matchTypicalRPE || 0) || null,
        matchTypicalDurationMin: Number(matchTypicalDurationMin || 0) || null,
        hasGymAccess: hasGymAccess === "oui" ? "regular" : hasGymAccess === "occasionnel" ? "occasional" : "none",
        gymEquipment,
        hasHomeEquipment: hasHomeEquipment === "oui",
        homeEquipment,
        profileCompleted: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      haptics.success();
      showToast({ type: "success", title: "Profil enregistre", message: "Configuration terminee !" });
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
        <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
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
      /* ── IDENTITE ── */
      case 0:
        return (
          <>
            <Text style={styles.fieldLabel}>Tu es...</Text>
            <Choice label="Joueur" selected={selectedMode === "player"} onPress={() => setSelectedMode("player")} />
            <Choice label="Coach" selected={selectedMode === "coach"} onPress={() => setSelectedMode("coach")} />

            <Text style={styles.fieldLabel}>Prenom</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Kylian"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Code club (invitation)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: FKSFC-2026"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={clubInviteCode}
              onChangeText={setClubInviteCode}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Poste</Text>
            {positions.map((p) => (
              <Choice key={p} label={p} selected={position === p} onPress={() => setPosition(p)} />
            ))}

            <Text style={styles.fieldLabel}>Niveau</Text>
            {levels.map((l) => (
              <Choice key={l} label={l} selected={level === l} onPress={() => setLevel(l)} />
            ))}

            <Text style={styles.fieldLabel}>Pied fort</Text>
            <View style={styles.chipRow}>
              {dominantFeet.map((f) => (
                <Chip key={f} label={f} selected={dominantFoot === f} onPress={() => setDominantFoot(f)} />
              ))}
            </View>
          </>
        );

      /* ── OBJECTIF ── */
      case 1:
        return (
          <>
            <View style={styles.cycleCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cycleLabel}>
                  {cycleLabel ? `${cycleLabel} · ${cycleProgress}/${MICROCYCLE_TOTAL_SESSIONS_DEFAULT}` : "Aucun cycle actif"}
                </Text>
                <Text style={styles.cycleHint}>Gere ton cycle depuis l'accueil ou le profil.</Text>
              </View>
              <TouchableOpacity
                style={styles.cycleButton}
                onPress={() => navigation.navigate("CycleModal", { mode: cycleLabel ? "manage" : "select", origin: "profile" })}
                activeOpacity={0.7}
              >
                <Text style={styles.cycleButtonText}>{cycleLabel ? "Gerer" : "Choisir"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Objectif principal avec FKS</Text>
            {objectives.map((o) => (
              <Choice key={o} label={o} selected={mainObjective === o} onPress={() => setMainObjective(o)} />
            ))}

            <Text style={styles.fieldLabel}>Seances FKS / semaine (hors club)</Text>
            <View style={styles.chipRow}>
              {fksSessionsOptions.map((o) => (
                <Chip key={o} label={o} selected={targetFksSessionsPerWeek === o} onPress={() => setTargetFksSessionsPerWeek(o)} />
              ))}
            </View>
          </>
        );

      /* ── CHARGE CLUB ── */
      case 2:
        return (
          <>
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

            {hasClubTrainings === "oui" ? (
              <>
                <Text style={styles.fieldLabel}>Entrainements club / semaine</Text>
                <TextInput style={styles.input} keyboardType="number-pad" placeholder="ex: 3"
                  placeholderTextColor="rgba(255,255,255,0.3)" value={clubTrainingsPerWeek} onChangeText={setClubTrainingsPerWeek} />
              </>
            ) : hasClubTrainings === "non" ? (
              <Text style={styles.hintText}>Aucun entrainement club pris en compte.</Text>
            ) : null}

            {hasClubTrainings === "oui" && (
              <>
                <Text style={styles.fieldLabel}>RPE typique d'un entrainement club</Text>
                <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="ex: 6"
                  placeholderTextColor="rgba(255,255,255,0.3)" value={clubTypicalRPE} onChangeText={setClubTypicalRPE} />
                <Text style={styles.fieldLabel}>Duree typique (min)</Text>
                <TextInput style={styles.input} keyboardType="number-pad" placeholder="ex: 75"
                  placeholderTextColor="rgba(255,255,255,0.3)" value={clubTypicalDurationMin} onChangeText={setClubTypicalDurationMin} />
              </>
            )}

            <Text style={styles.fieldLabel}>Matchs / semaine</Text>
            <TextInput style={styles.input} keyboardType="number-pad" placeholder="ex: 1"
              placeholderTextColor="rgba(255,255,255,0.3)" value={matchesPerWeek} onChangeText={setMatchesPerWeek} />

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
              <Text style={styles.hintText}>Aucun match selectionne.</Text>
            )}

            {Number(matchesPerWeek) > 0 && (
              <>
                <Text style={styles.fieldLabel}>RPE typique d'un match</Text>
                <TextInput style={styles.input} keyboardType="decimal-pad" placeholder="ex: 8"
                  placeholderTextColor="rgba(255,255,255,0.3)" value={matchTypicalRPE} onChangeText={setMatchTypicalRPE} />
                <Text style={styles.fieldLabel}>Duree typique d'un match (min)</Text>
                <TextInput style={styles.input} keyboardType="number-pad" placeholder="ex: 90"
                  placeholderTextColor="rgba(255,255,255,0.3)" value={matchTypicalDurationMin} onChangeText={setMatchTypicalDurationMin} />
              </>
            )}
          </>
        );

      /* ── SALLE ── */
      case 3:
        return (
          <>
            <Text style={styles.fieldLabel}>Acces a une salle de musculation ?</Text>
            <View style={styles.chipRow}>
              <Chip label="Oui regulierement" selected={hasGymAccess === "oui"} onPress={() => setHasGymAccess("oui")} />
              <Chip label="De temps en temps" selected={hasGymAccess === "occasionnel"} onPress={() => setHasGymAccess("occasionnel")} />
              <Chip label="Non" selected={hasGymAccess === "non"} onPress={() => setHasGymAccess("non")} />
            </View>

            {hasGymAccess !== "" && hasGymAccess !== "non" && (
              <>
                <Text style={styles.fieldLabel}>Materiel disponible en salle</Text>
                {gymEquipmentOptions.map((o) => (
                  <Choice key={o.id} label={o.label} selected={gymEquipment.includes(o.id)}
                    onPress={() => toggleInList(o.id, gymEquipment, setGymEquipment)} />
                ))}
              </>
            )}
          </>
        );

      /* ── MATERIEL HORS SALLE ── */
      case 4:
        return (
          <>
            <Text style={styles.fieldLabel}>As-tu du materiel chez toi / sur le terrain ?</Text>
            <View style={styles.chipRow}>
              <Chip label="Oui" selected={hasHomeEquipment === "oui"} onPress={() => setHasHomeEquipment("oui")} />
              <Chip label="Non" selected={hasHomeEquipment === "non"} onPress={() => setHasHomeEquipment("non")} />
            </View>

            {hasHomeEquipment === "oui" && (
              <>
                <Text style={styles.fieldLabel}>Materiel hors salle</Text>
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
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={["#0b1120", "#111827", "#1f2937"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Glow circles */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>

        {/* ─── Progress section ─── */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressStep}>Etape {step + 1}/{TOTAL_STEPS}</Text>
            <Text style={styles.progressName}>{STEPS[step].label}</Text>
          </View>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={[colors.accent, colors.accentEnd]}
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
                colors={[colors.accent, colors.accentEnd]}
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
              <View style={styles.cardGlow} />
            </View>

          </Animated.View>
        </ScrollView>

        {/* ─── Footer ─── */}
        <View style={styles.footer}>
          {step > 0 ? (
            <TouchableOpacity style={styles.backButton} onPress={goBack} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={colors.sub} />
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
              colors={[colors.accent, colors.accentEnd]}
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

      </KeyboardAvoidingView>

      <LoadingOverlay
        visible={loading}
        message="Enregistrement de ton profil..."
        submessage="Configuration initiale en cours."
      />
    </SafeAreaView>
  );
}

/* ══════════ STYLES ══════════ */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#05070c",
  },

  /* Glow */
  glowTop: {
    position: "absolute",
    top: -120,
    left: -120,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(255,122,26,0.2)",
  },
  glowBottom: {
    position: "absolute",
    bottom: -180,
    right: -140,
    width: 380,
    height: 380,
    borderRadius: 999,
    backgroundColor: "rgba(14,165,233,0.18)",
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
    color: colors.sub,
  },
  progressName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.progressBg,
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
    shadowColor: "#ff7a1a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.sub,
    marginTop: 2,
  },

  /* Card */
  card: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: "hidden",
    gap: 4,
  },
  cardGlow: {
    position: "absolute",
    top: -70,
    right: -80,
    width: 200,
    height: 200,
    borderRadius: 120,
    backgroundColor: "rgba(255,122,26,0.08)",
  },

  /* Fields */
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.sub,
    marginTop: 14,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.inputBg,
  },

  /* Choice */
  choice: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  choiceSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.selectedBg,
  },
  choiceText: {
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
  choiceTextSelected: {
    color: colors.accent,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: "transparent",
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.selectedBg,
  },
  chipText: {
    color: colors.sub,
    fontWeight: "600",
    fontSize: 14,
  },
  chipTextSelected: {
    color: colors.accent,
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
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  cycleLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  cycleHint: {
    color: colors.sub,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  cycleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: "transparent",
  },
  cycleButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
  },

  hintText: {
    color: colors.sub,
    fontSize: 13,
    marginTop: 8,
    fontStyle: "italic",
  },

  /* Footer */
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
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
    color: colors.sub,
    fontWeight: "600",
  },
  nextButton: {
    flex: 2,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#ff7a1a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
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
