// src/screens/ProfileSetupScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { getAuth } from "firebase/auth";
import { db } from "../services/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { findClubByInviteCode, normalizeInviteCode, setClubMembership } from "../repositories/clubsRepo";
import { MICROCYCLES, MICROCYCLE_TOTAL_SESSIONS_DEFAULT, isMicrocycleId } from "../domain/microcycles";
import { useTrainingStore } from "../state/trainingStore";

// ---------- Palette FKS (alignée Home / NewSession) ----------
const palette = theme.colors;

// ---------- Constantes métier ----------
const positions = ["Gardien", "Défenseur", "Milieu", "Attaquant"] as const;
const levels = ["Amateur", "Régional", "National", "Semi-pro", "Pro"] as const;

const dominantFeet = ["Pied droit", "Pied gauche", "Ambidextre"] as const;

const objectives = [
  "Être en forme toute la saison",
  "Gagner en vitesse / explosivité",
  "Mieux encaisser les charges (enchaîner entraînements + matchs)",
  "Reprendre après une blessure",
] as const;

const fksSessionsOptions = ["1", "2", "3", "4"] as const;

// Matériel salle
const gymEquipmentOptions = [
  { id: "barbell", label: "Barre + poids libres" },
  { id: "squat_rack", label: "Rack à squat" },
  { id: "bench", label: "Banc de musculation" },
  { id: "dumbbells_light", label: "Haltères légers (≤ 10 kg)" },
  { id: "dumbbells_medium", label: "Haltères moyens (10–25 kg)" },
  { id: "dumbbells_heavy", label: "Haltères lourds (≥ 25 kg)" },
  { id: "kettlebell", label: "Kettlebells" },
  { id: "leg_press", label: "Presse (leg press)" },
  { id: "cable_machine", label: "Poulies / câble" },
  { id: "smith_machine", label: "Smith machine" },
  { id: "pullup_bar", label: "Barre de tractions" },
  { id: "box_plyo", label: "Box plyo" },
  { id: "bosu", label: "BOSU" },
  { id: "swiss_ball", label: "Swiss ball" },
  { id: "foam_roller", label: "Foam roller / rouleau" },
  { id: "yoga_mat", label: "Tapis de sol" },
];

// Matériel maison / terrain
const homeEquipmentOptions = [
  { id: "field", label: "Terrain herbe / synthé" },
  { id: "street_area", label: "City / bitume / parking" },
  { id: "indoor_small", label: "Petit espace intérieur" },
  { id: "cones", label: "Cônes" },
  { id: "flat_markers", label: "Plots plats" },
  { id: "speed_ladder", label: "Échelle de rythme" },
  { id: "mini_hurdles", label: "Petites haies" },
  { id: "minibands", label: "Mini-bands" },
  { id: "long_bands", label: "Élastiques longues" },
  { id: "home_dumbbells", label: "Haltères (chez toi)" },
  { id: "home_kettlebell", label: "Kettlebell (chez toi)" },
  { id: "medicine_ball", label: "Médecine ball" },
  { id: "sandbag", label: "Sac de sable / sandbag" },
  { id: "home_foam_roller", label: "Foam roller (chez toi)" },
  { id: "home_yoga_mat", label: "Tapis de sol (chez toi)" },
  { id: "home_swiss_ball", label: "Swiss ball (chez toi)" },
];

// Helper multi-select
const toggleInList = (
  value: string,
  list: string[],
  setter: (next: string[]) => void
) => {
  if (list.includes(value)) {
    setter(list.filter((v) => v !== value));
  } else {
    setter([...list, value]);
  }
};

export default function ProfileSetupScreen() {
  const navigation = useNavigation<any>();
  const activeCycleGoal = useTrainingStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useTrainingStore((s) => s.microcycleSessionIndex);
  const [firstName, setFirstName] = useState("");
  const [clubId, setClubId] = useState("");
  const [clubInviteCode, setClubInviteCode] = useState("");
  const [position, setPosition] = useState<string>("");
  const [level, setLevel] = useState<string>("");

  const [dominantFoot, setDominantFoot] = useState<string>("");
  const [mainObjective, setMainObjective] = useState<string>("");
  const [targetFksSessionsPerWeek, setTargetFksSessionsPerWeek] =
    useState<string>("");

  const [clubTrainingsPerWeek, setClubTrainingsPerWeek] = useState("");
  const [matchesPerWeek, setMatchesPerWeek] = useState("");
  const [hasClubTrainings, setHasClubTrainings] = useState<"oui" | "non" | "">(
    ""
  );
  const [clubTrainingDays, setClubTrainingDays] = useState<string[]>([]);
  const [matchDays, setMatchDays] = useState<string[]>([]);
  const [clubTypicalRPE, setClubTypicalRPE] = useState<string>("");
  const [clubTypicalDurationMin, setClubTypicalDurationMin] = useState<string>("");
  const [matchTypicalRPE, setMatchTypicalRPE] = useState<string>("");
  const [matchTypicalDurationMin, setMatchTypicalDurationMin] = useState<string>("");

  const [hasGymAccess, setHasGymAccess] = useState<
    "oui" | "occasionnel" | "non" | ""
  >("");
  const [gymEquipment, setGymEquipment] = useState<string[]>([]);

  const [hasHomeEquipment, setHasHomeEquipment] = useState<"oui" | "non" | "">(
    ""
  );
  const [homeEquipment, setHomeEquipment] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  const cycleId = isMicrocycleId(activeCycleGoal) ? activeCycleGoal : null;
  const cycleLabel = cycleId ? MICROCYCLES[cycleId].label : null;
  const cycleProgress = Math.min(MICROCYCLE_TOTAL_SESSIONS_DEFAULT, Math.max(0, Math.trunc(microcycleSessionIndex ?? 0)));

  const daysOfWeek = [
    { id: "mon", label: "Lundi" },
    { id: "tue", label: "Mardi" },
    { id: "wed", label: "Mercredi" },
    { id: "thu", label: "Jeudi" },
    { id: "fri", label: "Vendredi" },
    { id: "sat", label: "Samedi" },
    { id: "sun", label: "Dimanche" },
  ];

  // Prefill si profil déjà existant
  React.useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    getDoc(ref)
      .then((snap) => {
        const d = snap.data();
        if (!d) return;
        if (typeof d.firstName === "string") setFirstName(d.firstName);
        if (typeof d.clubId === "string") setClubId(d.clubId);
        if (typeof d.position === "string") setPosition(d.position);
        if (typeof d.level === "string") setLevel(d.level);
        if (typeof d.dominantFoot === "string") setDominantFoot(d.dominantFoot);
        if (typeof d.mainObjective === "string")
          setMainObjective(d.mainObjective);
        if (d.targetFksSessionsPerWeek != null)
          setTargetFksSessionsPerWeek(String(d.targetFksSessionsPerWeek));

        if (d.clubTrainingsPerWeek != null)
          setClubTrainingsPerWeek(String(d.clubTrainingsPerWeek));
        if (d.matchesPerWeek != null)
          setMatchesPerWeek(String(d.matchesPerWeek));
        if (typeof d.hasClubTrainings === "string") {
          setHasClubTrainings(
            d.hasClubTrainings === "oui"
              ? "oui"
              : d.hasClubTrainings === "non"
              ? "non"
              : ""
          );
        }
        if (Array.isArray(d.clubTrainingDays))
          setClubTrainingDays(d.clubTrainingDays);
        if (Array.isArray(d.matchDays)) setMatchDays(d.matchDays);
        if (typeof d.matchDay === "string" && (!d.matchDays || !d.matchDays.length)) {
          setMatchDays([d.matchDay]);
        }
        if (typeof d.clubTypicalRPE === "number")
          setClubTypicalRPE(String(d.clubTypicalRPE));
        if (typeof d.clubTypicalDurationMin === "number")
          setClubTypicalDurationMin(String(d.clubTypicalDurationMin));
        if (typeof d.matchTypicalRPE === "number")
          setMatchTypicalRPE(String(d.matchTypicalRPE));
        if (typeof d.matchTypicalDurationMin === "number")
          setMatchTypicalDurationMin(String(d.matchTypicalDurationMin));

        if (typeof d.hasGymAccess === "string") {
          setHasGymAccess(
            d.hasGymAccess === "regular"
              ? "oui"
              : d.hasGymAccess === "occasional"
              ? "occasionnel"
              : "non"
          );
        }
        if (Array.isArray(d.gymEquipment)) setGymEquipment(d.gymEquipment);

        if (typeof d.hasHomeEquipment === "boolean")
          setHasHomeEquipment(d.hasHomeEquipment ? "oui" : "non");
        if (Array.isArray(d.homeEquipment)) setHomeEquipment(d.homeEquipment);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    // validations de base
    if (!firstName.trim())
      return Alert.alert("Champs manquants", "Merci d’indiquer ton prénom.");
    if (!positions.includes(position as any))
      return Alert.alert("Champs manquants", "Choisis ton poste.");
    if (!levels.includes(level as any))
      return Alert.alert("Champs manquants", "Indique ton niveau.");

    if (!dominantFeet.includes(dominantFoot as any))
      return Alert.alert("Champs manquants", "Choisis ton pied fort.");
    if (!objectives.includes(mainObjective as any))
      return Alert.alert(
        "Champs manquants",
        "Choisis ton objectif principal."
      );
    if (!fksSessionsOptions.includes(targetFksSessionsPerWeek as any))
      return Alert.alert(
        "Champs manquants",
        "Indique combien de séances FKS tu veux par semaine."
      );

    const trainings = Number(clubTrainingsPerWeek);
    const matches = Number(matchesPerWeek);
    if (!Number.isFinite(trainings) || trainings < 0)
      return Alert.alert(
        "Valeur invalide",
        "Entraînements/semaine doit être un nombre positif."
      );
    if (!Number.isFinite(matches) || matches < 0)
      return Alert.alert(
        "Valeur invalide",
        "Matchs/semaine doit être un nombre positif."
      );

    if (!hasGymAccess)
      return Alert.alert(
        "Champs manquants",
        "Indique si tu as accès à une salle de musculation."
      );
    if (hasGymAccess !== "non" && gymEquipment.length === 0) {
      return Alert.alert(
        "Champs manquants",
        "Sélectionne au moins un matériel que tu peux utiliser en salle."
      );
    }

    if (!hasHomeEquipment)
      return Alert.alert(
        "Champs manquants",
        "Indique si tu as du matériel chez toi / sur le terrain."
      );
    if (hasHomeEquipment === "oui" && homeEquipment.length === 0) {
      return Alert.alert(
        "Champs manquants",
        "Sélectionne au moins un matériel que tu as à disposition hors salle."
      );
    }

    if (!hasClubTrainings)
      return Alert.alert(
        "Champs manquants",
        "As-tu des entraînements club programmés ?"
      );
    if (hasClubTrainings === "oui" && clubTrainingDays.length === 0) {
      return Alert.alert(
        "Champs manquants",
        "Précise les jours d'entraînement club."
      );
    }
    if (matches > 0 && matchDays.length === 0) {
      return Alert.alert(
        "Champs manquants",
        "Précise les jours habituels de match."
      );
    }
    if (hasClubTrainings === "oui") {
      const rpeClub = Number(clubTypicalRPE || 0);
      const durClub = Number(clubTypicalDurationMin || 0);
      if (!Number.isFinite(rpeClub) || rpeClub <= 0 || !Number.isFinite(durClub) || durClub <= 0) {
        return Alert.alert(
          "Champs manquants",
          "Indique le RPE et la durée typiques d'un entraînement club."
        );
      }
    }
    if (matches > 0) {
      const rpeMatch = Number(matchTypicalRPE || 0);
      const durMatch = Number(matchTypicalDurationMin || 0);
      if (!Number.isFinite(rpeMatch) || rpeMatch <= 0 || !Number.isFinite(durMatch) || durMatch <= 0) {
        return Alert.alert(
          "Champs manquants",
          "Indique le RPE et la durée typiques d'un match."
        );
      }
    }

    const targetFksSessions = Number(targetFksSessionsPerWeek);
    const normalizedInvite = normalizeInviteCode(clubInviteCode);

    try {
      setLoading(true);
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        Alert.alert(
          "Connexion requise",
          "Connecte-toi pour enregistrer ton profil."
        );
        return;
      }

      let resolvedClubId: string | null = clubId?.trim() ? clubId.trim() : null;
      if (normalizedInvite) {
        const club = await findClubByInviteCode(normalizedInvite);
        if (!club) {
          Alert.alert("Code club invalide", "Aucun club ne correspond à ce code. Vérifie et réessaie.");
          return;
        }
        resolvedClubId = club.id;
        await setClubMembership({ clubId: club.id, uid: user.uid, role: "player" });
      }

      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          uid: user.uid,
          firstName: firstName.trim(),
          clubId: resolvedClubId,
          position,
          level,
          dominantFoot,
          mainObjective,
          targetFksSessionsPerWeek: targetFksSessions,

          clubTrainingsPerWeek: trainings,
          matchesPerWeek: matches,
          hasClubTrainings,
          clubTrainingDays,
          matchDay: matchDays[0] ?? null,
          matchDays,
          clubTypicalRPE: Number(clubTypicalRPE || 0) || null,
          clubTypicalDurationMin: Number(clubTypicalDurationMin || 0) || null,
          matchTypicalRPE: Number(matchTypicalRPE || 0) || null,
          matchTypicalDurationMin: Number(matchTypicalDurationMin || 0) || null,

          hasGymAccess:
            hasGymAccess === "oui"
              ? "regular"
              : hasGymAccess === "occasionnel"
              ? "occasional"
              : "none",
          gymEquipment,

          hasHomeEquipment: hasHomeEquipment === "oui",
          homeEquipment,

          profileCompleted: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      Alert.alert("Profil enregistré ✅", "Redirection vers l’accueil…");
      // RootNavigator se charge de rediriger grâce à profileCompleted === true, on force aussi la nav
      navigation.reset({
        index: 0,
        routes: [{ name: "Tabs" }],
      });
    } catch (error) {
      if (__DEV__) {
        console.error("Erreur sauvegarde profil:", error);
      }
      Alert.alert(
        "Erreur",
        "Impossible d'enregistrer le profil (vérifie tes permissions Firestore)."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <Text style={styles.title}>Profil joueur</Text>
        <Text style={styles.subtitle}>
          FKS ajuste tes séances selon ton contexte, ta charge club et ton
          matériel.
        </Text>

        {/* IDENTITÉ */}
        <Card variant="surface" style={styles.card}>
          <Text style={styles.sectionTitle}>Identité & poste</Text>

          <Text style={styles.label}>Prénom</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Kylian"
            placeholderTextColor={palette.sub}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Club</Text>
          <Text style={[styles.input, { paddingVertical: 12, color: palette.sub }]}>
            {clubId?.trim() ? clubId.trim() : "Aucun club lié"}
          </Text>

          <Text style={styles.label}>Code club (invitation)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: FKSFC-2026"
            placeholderTextColor={palette.sub}
            value={clubInviteCode}
            onChangeText={setClubInviteCode}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Poste</Text>
          {positions.map((p) => {
            const selected = position === p;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.choice, selected && styles.choiceSelected]}
                onPress={() => setPosition(p)}
              >
                <Text
                  style={[
                    styles.choiceText,
                    selected && styles.choiceTextSelected,
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            );
          })}

          <Text style={styles.label}>Niveau</Text>
          {levels.map((lvl) => {
            const selected = level === lvl;
            return (
              <TouchableOpacity
                key={lvl}
                style={[styles.choice, selected && styles.choiceSelected]}
                onPress={() => setLevel(lvl)}
              >
                <Text
                  style={[
                    styles.choiceText,
                    selected && styles.choiceTextSelected,
                  ]}
                >
                  {lvl}
                </Text>
              </TouchableOpacity>
            );
          })}

          <Text style={styles.label}>Pied fort</Text>
          {dominantFeet.map((foot) => {
            const selected = dominantFoot === foot;
            return (
              <TouchableOpacity
                key={foot}
                style={[styles.choice, selected && styles.choiceSelected]}
                onPress={() => setDominantFoot(foot)}
              >
                <Text
                  style={[
                    styles.choiceText,
                    selected && styles.choiceTextSelected,
                  ]}
                >
                  {foot}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Card>

        {/* OBJECTIF & FKS SESSIONS */}
        <Card variant="surface" style={styles.card}>
          <Text style={styles.sectionTitle}>Objectif & séances FKS</Text>

          <Text style={styles.label}>Cycle / playlist (micro-cycle)</Text>
          <View style={styles.cycleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cycleValue}>
                {cycleLabel ? `${cycleLabel} · ${cycleProgress}/${MICROCYCLE_TOTAL_SESSIONS_DEFAULT}` : "Aucun cycle actif"}
              </Text>
              <Text style={styles.cycleHint}>
                Tu peux choisir/abandonner ton cycle depuis l’accueil ou le profil (changement rare et sérieux).
              </Text>
            </View>
            <Button
              label={cycleLabel ? "Gérer" : "Choisir"}
              variant="secondary"
              onPress={() =>
                navigation.navigate("CycleModal", {
                  mode: cycleLabel ? "manage" : "select",
                  origin: "profile",
                })
              }
            />
          </View>

          <Text style={styles.label}>Objectif principal avec FKS</Text>
          {objectives.map((obj) => {
            const selected = mainObjective === obj;
            return (
              <TouchableOpacity
                key={obj}
                style={[styles.choice, selected && styles.choiceSelected]}
                onPress={() => setMainObjective(obj)}
              >
                <Text
                  style={[
                    styles.choiceText,
                    selected && styles.choiceTextSelected,
                  ]}
                >
                  {obj}
                </Text>
              </TouchableOpacity>
            );
          })}

          <Text style={styles.label}>Séances FKS / semaine (hors club)</Text>
          <View style={styles.inlineChoices}>
            {fksSessionsOptions.map((opt) => {
              const selected = targetFksSessionsPerWeek === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.chip,
                    selected && styles.chipSelected,
                  ]}
                  onPress={() => setTargetFksSessionsPerWeek(opt)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* CHARGE CLUB */}
        <Card variant="surface" style={styles.card}>
          <Text style={styles.sectionTitle}>Charge club</Text>

          <Text style={styles.label}>
            As-tu des entraînements club programmés ?
          </Text>
          <View style={styles.inlineChoices}>
            <TouchableOpacity
              style={[
                styles.chip,
                hasClubTrainings === "oui" && styles.chipSelected,
              ]}
              onPress={() => setHasClubTrainings("oui")}
            >
              <Text
                style={[
                  styles.chipText,
                  hasClubTrainings === "oui" && styles.chipTextSelected,
                ]}
              >
                Oui
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                hasClubTrainings === "non" && styles.chipSelected,
              ]}
              onPress={() => setHasClubTrainings("non")}
            >
              <Text
                style={[
                  styles.chipText,
                  hasClubTrainings === "non" && styles.chipTextSelected,
                ]}
              >
                Non
              </Text>
            </TouchableOpacity>
          </View>

          {hasClubTrainings === "oui" ? (
            <>
              <Text style={styles.label}>Quels jours ?</Text>
              <View style={styles.inlineChoicesWrap}>
                {daysOfWeek.map((d) => {
                  const selected = clubTrainingDays.includes(d.id);
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[
                        styles.chip,
                        selected && styles.chipSelected,
                      ]}
                      onPress={() =>
                        toggleInList(d.id, clubTrainingDays, setClubTrainingDays)
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>Entraînements club / semaine</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="ex: 3"
            placeholderTextColor={palette.sub}
            value={clubTrainingsPerWeek}
            onChangeText={setClubTrainingsPerWeek}
          />
          <Text style={styles.label}>RPE typique d'un entraînement club</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="ex: 6"
            placeholderTextColor={palette.sub}
            value={clubTypicalRPE}
            onChangeText={setClubTypicalRPE}
          />
          <Text style={styles.label}>Durée typique d'un entraînement club (min)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="ex: 75"
            placeholderTextColor={palette.sub}
            value={clubTypicalDurationMin}
            onChangeText={setClubTypicalDurationMin}
          />

          <Text style={styles.label}>Matchs / semaine</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="ex: 1"
            placeholderTextColor={palette.sub}
            value={matchesPerWeek}
            onChangeText={setMatchesPerWeek}
          />
          <Text style={[styles.label, { marginTop: 12 }]}>Jours habituels de match</Text>
          <View style={styles.inlineChoicesWrap}>
            {daysOfWeek.map((d) => {
              const selected = matchDays.includes(d.id);
              return (
                <TouchableOpacity
                  key={`match_${d.id}`}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => toggleInList(d.id, matchDays, setMatchDays)}
                >
                  <Text
                    style={[styles.chipText, selected && styles.chipTextSelected]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.label}>RPE typique d'un match</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="ex: 8"
            placeholderTextColor={palette.sub}
            value={matchTypicalRPE}
            onChangeText={setMatchTypicalRPE}
          />
          <Text style={styles.label}>Durée typique d'un match (min)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="ex: 90"
            placeholderTextColor={palette.sub}
            value={matchTypicalDurationMin}
            onChangeText={setMatchTypicalDurationMin}
          />
        </Card>

        {/* SALLE DE MUSCU */}
        <Card variant="surface" style={styles.card}>
          <Text style={styles.sectionTitle}>Salle de musculation</Text>

          <Text style={styles.label}>Accès à une salle de musculation ?</Text>
          <View style={styles.inlineChoices}>
            <TouchableOpacity
              style={[
                styles.chip,
                hasGymAccess === "oui" && styles.chipSelected,
              ]}
              onPress={() => setHasGymAccess("oui")}
            >
              <Text
                style={[
                  styles.chipText,
                  hasGymAccess === "oui" && styles.chipTextSelected,
                ]}
              >
                Oui régulièrement
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                hasGymAccess === "occasionnel" && styles.chipSelected,
              ]}
              onPress={() => setHasGymAccess("occasionnel")}
            >
              <Text
                style={[
                  styles.chipText,
                  hasGymAccess === "occasionnel" &&
                    styles.chipTextSelected,
                ]}
              >
                De temps en temps
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                hasGymAccess === "non" && styles.chipSelected,
              ]}
              onPress={() => setHasGymAccess("non")}
            >
              <Text
                style={[
                  styles.chipText,
                  hasGymAccess === "non" && styles.chipTextSelected,
                ]}
              >
                Non
              </Text>
            </TouchableOpacity>
          </View>

          {hasGymAccess !== "" && hasGymAccess !== "non" && (
            <>
              <Text style={styles.label}>Matériel disponible en SALLE</Text>
              {gymEquipmentOptions.map((opt) => {
                const selected = gymEquipment.includes(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.choice,
                      selected && styles.choiceSelected,
                    ]}
                    onPress={() =>
                      toggleInList(opt.id, gymEquipment, setGymEquipment)
                    }
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        selected && styles.choiceTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </Card>

        {/* MATÉRIEL HORS SALLE */}
        <Card variant="surface" style={styles.card}>
          <Text style={styles.sectionTitle}>
            Matériel chez toi / sur le terrain
          </Text>

          <Text style={styles.label}>
            As-tu du matériel chez toi / sur le terrain ?
          </Text>
          <View style={styles.inlineChoices}>
            <TouchableOpacity
              style={[
                styles.chip,
                hasHomeEquipment === "oui" && styles.chipSelected,
              ]}
              onPress={() => setHasHomeEquipment("oui")}
            >
              <Text
                style={[
                  styles.chipText,
                  hasHomeEquipment === "oui" && styles.chipTextSelected,
                ]}
              >
                Oui
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chip,
                hasHomeEquipment === "non" && styles.chipSelected,
              ]}
              onPress={() => setHasHomeEquipment("non")}
            >
              <Text
                style={[
                  styles.chipText,
                  hasHomeEquipment === "non" && styles.chipTextSelected,
                ]}
              >
                Non
              </Text>
            </TouchableOpacity>
          </View>

          {hasHomeEquipment === "oui" && (
            <>
              <Text style={styles.label}>Matériel hors salle</Text>
              {homeEquipmentOptions.map((opt) => {
                const selected = homeEquipment.includes(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.choice,
                      selected && styles.choiceSelected,
                    ]}
                    onPress={() =>
                      toggleInList(opt.id, homeEquipment, setHomeEquipment)
                    }
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        selected && styles.choiceTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </Card>

        {/* CTA */}
        <Button
          label={loading ? "Enregistrement..." : "Sauvegarder mon profil"}
          onPress={handleSave}
          disabled={loading}
          fullWidth
          size="lg"
          style={styles.button}
        />
      </ScrollView>

      <LoadingOverlay
        visible={loading}
        message="Enregistrement de ton profil..."
        submessage="Création de ton compte joueur et configuration initiale."
      />
    </SafeAreaView>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
    backgroundColor: palette.bg,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    color: palette.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: "center",
    color: palette.sub,
    marginBottom: 16,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: palette.text,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: palette.sub,
    marginTop: 10,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  cycleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cycleValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: "700",
  },
  cycleHint: {
    color: palette.sub,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: palette.text,
    backgroundColor: palette.cardSoft,
  },
  choice: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: palette.cardSoft,
  },
  choiceSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  choiceText: {
    color: palette.text,
    fontSize: 14,
  },
  choiceTextSelected: {
    color: palette.accentSoft,
    fontWeight: "700",
  },
  inlineChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inlineChoicesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  chipSelected: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  chipText: {
    color: palette.sub,
    fontWeight: "600",
    fontSize: 12,
  },
  chipTextSelected: {
    color: palette.accent,
    fontWeight: "700",
    fontSize: 12,
  },
  button: {
    marginTop: 8,
  },
});
