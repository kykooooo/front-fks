// screens/ProfileSetupScreen.tsx
// Setup profil — Nike TC × Strava design — 3 steps + done

import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getAuth } from "firebase/auth";
import { useHaptics } from "../hooks/useHaptics";
import { db } from "../services/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { showToast } from "../utils/toast";
import { runShake } from "../utils/animations";
import { useAppModeStore } from "../state/appModeStore";
import { ds, typo, space, radius, anim } from "../theme/authDesignSystem";

const TOTAL_STEPS = 3;

// ── Step 1 data ──
const POSITIONS = [
  { id: "Gardien", emoji: "\uD83E\uDDE4", label: "Gardien" },
  { id: "Defenseur", emoji: "\uD83D\uDEE1\uFE0F", label: "D\u00e9fenseur" },
  { id: "Milieu", emoji: "\uD83C\uDFAF", label: "Milieu" },
  { id: "Ailier", emoji: "\u26A1", label: "Ailier" },
  { id: "Attaquant", emoji: "\uD83D\uDD25", label: "Attaquant" },
] as const;

const LEVELS = [
  { id: "Amateur", label: "D\u00e9butant" },
  { id: "Regional", label: "Interm\u00e9diaire" },
  { id: "National", label: "Confirm\u00e9" },
] as const;

const FEET = [
  { id: "Pied droit", label: "Droit" },
  { id: "Pied gauche", label: "Gauche" },
  { id: "Ambidextre", label: "Les deux" },
] as const;

// ── Step 2 data ──
const DAYS = [
  { id: "mon", label: "L" },
  { id: "tue", label: "M" },
  { id: "wed", label: "M" },
  { id: "thu", label: "J" },
  { id: "fri", label: "V" },
  { id: "sat", label: "S" },
  { id: "sun", label: "D" },
];

// ── Step 3 data ──
const ENVIRONMENTS = [
  { id: "gym", emoji: "\uD83C\uDFCB\uFE0F", label: "En salle" },
  { id: "field", emoji: "\uD83C\uDFDF\uFE0F", label: "Sur terrain" },
  { id: "home", emoji: "\uD83C\uDFE0", label: "Chez moi" },
] as const;

const GYM_EQUIPMENT = [
  { id: "barbell", label: "Barre" },
  { id: "dumbbells_medium", label: "Halt\u00e8res" },
  { id: "bench", label: "Banc" },
  { id: "squat_rack", label: "Rack" },
  { id: "cable_machine", label: "C\u00e2bles" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "long_bands", label: "\u00c9lastiques" },
  { id: "pullup_bar", label: "Tractions" },
];

const HOME_EQUIPMENT = [
  { id: "home_dumbbells", label: "Halt\u00e8res" },
  { id: "long_bands", label: "\u00c9lastiques" },
  { id: "pullup_bar", label: "Barre traction" },
  { id: "home_kettlebell", label: "Kettlebell" },
  { id: "bodyweight", label: "Poids de corps" },
];

const DEFAULT_GYM = ["barbell", "dumbbells_medium", "bench"];

const toggle = (v: string, list: string[], set: (l: string[]) => void) => {
  set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
};

/* ══════════════════════════════════════════ */
export default function ProfileSetupScreen() {
  const haptics = useHaptics();
  const scrollRef = useRef<ScrollView>(null);
  const setModeForUid = useAppModeStore((s) => s.setModeForUid);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Step 1
  const [position, setPosition] = useState("");
  const [level, setLevel] = useState("");
  const [foot, setFoot] = useState("");

  // Step 2
  const [hasClub, setHasClub] = useState<boolean | null>(null);
  const [clubDays, setClubDays] = useState<string[]>([]);
  const [hasMatch, setHasMatch] = useState<boolean | null>(null);
  const [matchDays, setMatchDays] = useState<string[]>([]);

  // Step 3
  const [environments, setEnvironments] = useState<string[]>([]);
  const [gymEquip, setGymEquip] = useState<string[]>([...DEFAULT_GYM]);
  const [homeEquip, setHomeEquip] = useState<string[]>([]);

  const shake = useRef(new Animated.Value(0)).current;
  const stepFade = useRef(new Animated.Value(1)).current;

  // Prefill
  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        const d = snap.data();
        if (!d) return;
        if (typeof d.position === "string") setPosition(d.position);
        if (typeof d.level === "string") setLevel(d.level);
        if (typeof d.dominantFoot === "string") setFoot(d.dominantFoot);
        if (Array.isArray(d.clubTrainingDays) && d.clubTrainingDays.length > 0) {
          setHasClub(true);
          setClubDays(d.clubTrainingDays);
        }
        if (Array.isArray(d.matchDays) && d.matchDays.length > 0) {
          setHasMatch(true);
          setMatchDays(d.matchDays);
        }
        if (Array.isArray(d.gymEquipment) && d.gymEquipment.length > 0) {
          setGymEquip(d.gymEquipment);
          setEnvironments((p) => (p.includes("gym") ? p : [...p, "gym"]));
        }
        if (Array.isArray(d.homeEquipment) && d.homeEquipment.length > 0) {
          setHomeEquip(d.homeEquipment);
          setEnvironments((p) => (p.includes("home") ? p : [...p, "home"]));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (hasClub === false) setClubDays([]);
  }, [hasClub]);
  useEffect(() => {
    if (hasMatch === false) setMatchDays([]);
  }, [hasMatch]);

  const safeShake = () => {
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      if (!r) runShake(shake);
    });
  };

  const fail = (msg: string) => {
    safeShake();
    haptics.warning();
    showToast({ type: "error", title: "Manque une info", message: msg });
  };

  const animateStep = (next: number) => {
    AccessibilityInfo.isReduceMotionEnabled().then((r) => {
      if (r) {
        setStep(next);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        return;
      }
      Animated.timing(stepFade, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setStep(next);
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        Animated.timing(stepFade, {
          toValue: 1,
          duration: anim.medium,
          useNativeDriver: true,
        }).start();
      });
    });
  };

  const canGoNext = () => {
    if (step === 0) return position !== "" && level !== "" && foot !== "";
    return true;
  };

  const goNext = () => {
    if (step === 0 && !canGoNext()) {
      fail("Choisis ton poste, niveau et pied fort.");
      return;
    }
    haptics.impactMedium();
    if (step < TOTAL_STEPS - 1) animateStep(step + 1);
    else void handleSave();
  };

  const goBack = () => {
    haptics.impactLight();
    if (step > 0) animateStep(step - 1);
  };

  const handleSkip = () => {
    haptics.impactLight();
    if (step < TOTAL_STEPS - 1) animateStep(step + 1);
    else void handleSave();
  };

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const user = getAuth().currentUser;
      if (!user) {
        fail("Connecte-toi pour continuer.");
        return;
      }

      await setModeForUid(user.uid, "player");

      const allGymEquip = environments.includes("gym") ? gymEquip : [];
      const allHomeEquip = environments.includes("home") ? homeEquip.filter((e) => e !== "bodyweight") : [];
      const hasGymAccess = environments.includes("gym") ? "regular" : "none";
      const clubActive = hasClub === true;
      const matchActive = hasMatch === true;

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          position,
          level,
          dominantFoot: foot,
          hasClubTrainings: clubActive ? "oui" : "non",
          clubTrainingDays: clubActive ? clubDays : [],
          clubTrainingsPerWeek: clubActive ? clubDays.length : 0,
          clubTypicalRPE: clubActive ? 6 : null,
          clubTypicalDurationMin: clubActive ? 90 : null,
          matchDays: matchActive ? matchDays : [],
          matchDay: matchActive ? (matchDays[0] ?? null) : null,
          matchesPerWeek: matchActive ? matchDays.length : 0,
          matchTypicalRPE: matchActive ? 8 : null,
          matchTypicalDurationMin: matchActive ? 90 : null,
          hasGymAccess,
          gymEquipment: allGymEquip,
          hasHomeEquipment: allHomeEquip.length > 0,
          homeEquipment: allHomeEquip,
          profileCompleted: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      haptics.success();
      setDone(true);
    } catch (error) {
      if (__DEV__) console.error("Erreur sauvegarde profil:", error);
      safeShake();
      haptics.error();
      showToast({ type: "error", title: "Erreur", message: "Impossible d'enregistrer le profil." });
    } finally {
      setSaving(false);
    }
  };

  // ── Shared components ──
  const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <Pressable
      style={[s.chip, selected && s.chipActive]}
      onPress={() => { haptics.impactLight(); onPress(); }}
    >
      <Text style={[s.chipText, selected && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );

  const DayChip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <Pressable
      style={[s.dayChip, selected && s.dayChipActive]}
      onPress={() => { haptics.impactLight(); onPress(); }}
    >
      <Text style={[s.dayChipText, selected && s.dayChipTextActive]}>{label}</Text>
    </Pressable>
  );

  const BigToggle = ({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) => (
    <View style={{ gap: 10 }}>
      <Text style={s.toggleLabel}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {[true, false].map((v) => (
          <Pressable
            key={String(v)}
            style={[s.toggleBtn, value === v && s.toggleBtnActive]}
            onPress={() => { haptics.impactLight(); onChange(v); }}
          >
            <Text style={[s.toggleBtnText, value === v && s.toggleBtnTextActive]}>
              {v ? "Oui" : "Non"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  // ══════ STEP RENDERERS ══════

  const renderStep1 = () => (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Ton poste</Text>
      <Text style={s.stepSub}>On adapte la pr\u00e9pa \u00e0 ton profil</Text>

      <View style={{ height: space.lg }} />

      {/* Position cards */}
      <View style={s.posGrid}>
        {POSITIONS.map((p) => {
          const sel = position === p.id;
          return (
            <Pressable
              key={p.id}
              style={[s.posCard, sel && s.posCardActive]}
              onPress={() => { haptics.impactLight(); setPosition(p.id); }}
            >
              <Text style={s.posEmoji}>{p.emoji}</Text>
              <Text style={[s.posLabel, sel && s.posLabelActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: space.xl }} />

      <Text style={s.sectionLabel}>NIVEAU</Text>
      <View style={s.chipRow}>
        {LEVELS.map((l) => (
          <Chip key={l.id} label={l.label} selected={level === l.id} onPress={() => setLevel(l.id)} />
        ))}
      </View>

      <View style={{ height: space.lg }} />

      <Text style={s.sectionLabel}>PIED FORT</Text>
      <View style={s.chipRow}>
        {FEET.map((f) => (
          <Chip key={f.id} label={f.label} selected={foot === f.id} onPress={() => setFoot(f.id)} />
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Ta semaine type</Text>
      <Text style={s.stepSub}>On adapte tes s\u00e9ances autour de ton club</Text>

      <View style={{ height: space.xl }} />

      <BigToggle label="Entra\u00eenements en club ?" value={hasClub} onChange={setHasClub} />

      {hasClub === true && (
        <View style={{ gap: 10, marginTop: space.lg }}>
          <Text style={s.sectionLabel}>QUELS JOURS ?</Text>
          <View style={s.daysRow}>
            {DAYS.map((d) => (
              <DayChip key={d.id} label={d.label} selected={clubDays.includes(d.id)} onPress={() => toggle(d.id, clubDays, setClubDays)} />
            ))}
          </View>
        </View>
      )}

      <View style={{ height: space.xl }} />

      <BigToggle label="Des matchs ?" value={hasMatch} onChange={setHasMatch} />

      {hasMatch === true && (
        <View style={{ gap: 10, marginTop: space.lg }}>
          <Text style={s.sectionLabel}>QUELS JOURS ?</Text>
          <View style={s.daysRow}>
            {DAYS.map((d) => (
              <DayChip key={`m-${d.id}`} label={d.label} selected={matchDays.includes(d.id)} onPress={() => toggle(d.id, matchDays, setMatchDays)} />
            ))}
          </View>
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Ton matos</Text>
      <Text style={s.stepSub}>O\u00f9 tu t'entra\u00eenes et avec quoi</Text>

      <View style={{ height: space.xl }} />

      {/* Environment cards */}
      <View style={s.envGrid}>
        {ENVIRONMENTS.map((e) => {
          const sel = environments.includes(e.id);
          return (
            <Pressable
              key={e.id}
              style={[s.envCard, sel && s.envCardActive]}
              onPress={() => {
                haptics.impactLight();
                toggle(e.id, environments, setEnvironments);
                if (!sel && e.id === "gym" && gymEquip.length === 0) setGymEquip([...DEFAULT_GYM]);
              }}
            >
              <Text style={s.envEmoji}>{e.emoji}</Text>
              <Text style={[s.envLabel, sel && s.envLabelActive]}>{e.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {environments.includes("gym") && (
        <View style={{ gap: 10, marginTop: space.xl }}>
          <Text style={s.sectionLabel}>MAT\u00c9RIEL EN SALLE</Text>
          <View style={s.chipWrap}>
            {GYM_EQUIPMENT.map((e) => (
              <Chip key={e.id} label={e.label} selected={gymEquip.includes(e.id)} onPress={() => toggle(e.id, gymEquip, setGymEquip)} />
            ))}
          </View>
        </View>
      )}

      {environments.includes("home") && (
        <View style={{ gap: 10, marginTop: space.xl }}>
          <Text style={s.sectionLabel}>MAT\u00c9RIEL CHEZ TOI</Text>
          <View style={s.chipWrap}>
            {HOME_EQUIPMENT.map((e) => (
              <Chip key={e.id} label={e.label} selected={homeEquip.includes(e.id)} onPress={() => toggle(e.id, homeEquip, setHomeEquip)} />
            ))}
          </View>
        </View>
      )}

      {environments.includes("field") && !environments.includes("gym") && !environments.includes("home") && (
        <Text style={s.hint}>Pas besoin de mat\u00e9riel, on s'occupe de tout !</Text>
      )}
    </View>
  );

  const renderDone = () => (
    <View style={s.doneWrap}>
      <Text style={s.doneEmoji}>{"\uD83D\uDD25"}</Text>
      <Text style={s.doneTitle}>C'est parti !</Text>
      <Text style={s.doneSub}>On pr\u00e9pare ton espace...</Text>
      <ActivityIndicator size="large" color={ds.accent} style={{ marginTop: space.xl }} />
    </View>
  );

  const progressPct = ((step + 1) / TOTAL_STEPS) * 100;
  const isLast = step === TOTAL_STEPS - 1;
  const nextDisabled = step === 0 && !canGoNext();

  if (done) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={ds.bg} />
        <SafeAreaView style={s.safe}>
          {renderDone()}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={ds.bg} />
      <SafeAreaView style={s.safe} edges={["right", "left", "bottom"]}>
        {/* Progress */}
        <View style={s.progressSection}>
          <View style={s.progressTop}>
            <Text style={s.progressLabel}>{step + 1}/{TOTAL_STEPS}</Text>
            {step > 0 && (
              <Pressable onPress={handleSkip}>
                <Text style={s.skipText}>Passer</Text>
              </Pressable>
            )}
          </View>
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>

        {/* Content */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: stepFade, transform: [{ translateX: shake }] }}>
            {step === 0 && renderStep1()}
            {step === 1 && renderStep2()}
            {step === 2 && renderStep3()}
          </Animated.View>
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          {step > 0 ? (
            <Pressable style={s.backBtn} onPress={goBack}>
              <Ionicons name="chevron-back" size={20} color={ds.textSecondary} />
              <Text style={s.backText}>Retour</Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <Pressable
            style={({ pressed }) => [
              s.nextBtn,
              pressed && s.nextBtnPressed,
              (nextDisabled || saving) && s.nextBtnDisabled,
            ]}
            onPress={goNext}
            disabled={nextDisabled || saving}
          >
            <LinearGradient
              colors={nextDisabled || saving ? [...ds.gradientDisabled] : [...ds.gradientAccent]}
              style={s.nextBtnInner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {saving ? (
                <View style={s.loadingRow}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={s.nextBtnText}>Enregistrement...</Text>
                </View>
              ) : (
                <>
                  <Text style={s.nextBtnText}>{isLast ? "Terminer" : "Suivant"}</Text>
                  <Ionicons name={isLast ? "checkmark-circle" : "arrow-forward"} size={20} color="#fff" />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ══════════ STYLES ══════════ */
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ds.bg,
  },
  safe: {
    flex: 1,
  },

  // Progress
  progressSection: {
    paddingHorizontal: space.screenH,
    paddingTop: space.lg,
    paddingBottom: space.md,
    gap: 10,
  },
  progressTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    color: ds.textSecondary,
    ...typo.caption,
    fontWeight: "700",
  },
  skipText: {
    color: ds.textTertiary,
    ...typo.caption,
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ds.border,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1.5,
    backgroundColor: ds.accent,
  },

  // Scroll
  scrollContent: {
    padding: space.screenH,
    paddingBottom: space.xxl,
    flexGrow: 1,
  },

  // Step content
  stepContent: {
    gap: space.elementGap,
  },
  stepTitle: {
    color: ds.text,
    ...typo.title,
  },
  stepSub: {
    color: ds.textSecondary,
    ...typo.subtitle,
    marginTop: -8,
  },
  sectionLabel: {
    color: ds.textSecondary,
    ...typo.sectionLabel,
  },

  // Position cards
  posGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  posCard: {
    width: 150,
    height: 110,
    borderRadius: radius.lg,
    backgroundColor: ds.surface,
    borderWidth: 1,
    borderColor: ds.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  posCardActive: {
    borderColor: ds.accent,
    backgroundColor: ds.accentSoft,
  },
  posEmoji: {
    fontSize: 36,
  },
  posLabel: {
    color: ds.text,
    fontSize: 15,
    fontWeight: "600",
  },
  posLabelActive: {
    color: ds.accent,
  },

  // Chips
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ds.border,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    borderColor: ds.accent,
    backgroundColor: ds.accentSoft,
  },
  chipText: {
    color: ds.textSecondary,
    ...typo.caption,
    fontWeight: "600",
  },
  chipTextActive: {
    color: ds.accent,
    fontWeight: "700",
  },

  // Toggle
  toggleLabel: {
    color: ds.text,
    fontSize: 16,
    fontWeight: "600",
  },
  toggleBtn: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ds.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  toggleBtnActive: {
    borderColor: ds.accent,
    backgroundColor: ds.accentSoft,
  },
  toggleBtnText: {
    color: ds.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  toggleBtnTextActive: {
    color: ds.accent,
    fontWeight: "700",
  },

  // Day chips
  daysRow: {
    flexDirection: "row",
    gap: 8,
  },
  dayChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: ds.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  dayChipActive: {
    borderColor: ds.accent,
    backgroundColor: ds.accentSoft,
  },
  dayChipText: {
    color: ds.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  dayChipTextActive: {
    color: ds.accent,
  },

  // Environment cards
  envGrid: {
    flexDirection: "row",
    gap: 12,
  },
  envCard: {
    flex: 1,
    height: 100,
    borderRadius: radius.lg,
    backgroundColor: ds.surface,
    borderWidth: 1,
    borderColor: ds.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  envCardActive: {
    borderColor: ds.accent,
    backgroundColor: ds.accentSoft,
  },
  envEmoji: {
    fontSize: 28,
  },
  envLabel: {
    color: ds.text,
    fontSize: 13,
    fontWeight: "600",
  },
  envLabelActive: {
    color: ds.accent,
  },

  hint: {
    color: ds.textSecondary,
    ...typo.caption,
    fontStyle: "italic",
    marginTop: space.lg,
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: space.screenH,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: ds.border,
  },
  backBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
  },
  backText: {
    color: ds.textSecondary,
    ...typo.body,
  },
  nextBtn: {
    flex: 2,
    height: 52,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  nextBtnPressed: {
    opacity: anim.pressOpacity,
    transform: [{ scale: anim.pressScale }],
  },
  nextBtnDisabled: {
    opacity: 0.5,
  },
  nextBtnInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  nextBtnText: {
    color: ds.textOnAccent,
    ...typo.button,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Done
  doneWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xxl,
  },
  doneEmoji: {
    fontSize: 56,
    marginBottom: space.lg,
  },
  doneTitle: {
    color: ds.text,
    ...typo.title,
    textAlign: "center",
  },
  doneSub: {
    color: ds.textSecondary,
    ...typo.subtitle,
    textAlign: "center",
    marginTop: space.sm,
  },
});
