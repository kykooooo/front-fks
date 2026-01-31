import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { useRoute } from "@react-navigation/native";
import { theme } from "../constants/theme";
import { STORAGE_KEYS } from "../constants/storage";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useTrainingStore } from "../state/trainingStore";

const palette = theme.colors;
const STORAGE_KEY = STORAGE_KEYS.TESTS_V1;

type PlaylistId =
  | "fondation"
  | "force"
  | "explosivite"
  | "explosif"
  | "rsa"
  | "endurance"
  | "saison"
  | "offseason";

type TestEntry = {
  ts: number;
  playlist?: PlaylistId;
  broadJumpCm?: number;
  tripleJumpCm?: number;
  cmjCm?: number;
  lateralBoundCm?: number;
  sprint10s?: number;
  sprint20s?: number;
  sprint30s?: number;
  tTest_s?: number;
  test505_s?: number;
  endurance6min_m?: number;
  yoYoIR1_m?: number;
  run1km_s?: number;
  gobletKg?: number;
  gobletReps?: number;
  splitKg?: number;
  splitReps?: number;
  trapbar3rmKg?: number;
  notes?: string;
};

type FieldKey = keyof Omit<TestEntry, "ts" | "playlist">;

type FieldConfig = {
  key: FieldKey;
  label: string;
  placeholder?: string;
  unit: string;
  group: "sauts" | "vitesse" | "endurance" | "force" | "agilite" | "power";
  lowerIsBetter?: boolean;
  protocol: string;
};

const FIELD_DEFS: FieldConfig[] = [
  {
    key: "broadJumpCm",
    label: "Saut en longueur (cm)",
    unit: "cm",
    group: "sauts",
    protocol: "3 essais, meilleur saut. Bras libres, atterrissage stable.",
  },
  {
    key: "tripleJumpCm",
    label: "Triple bonds (cm)",
    unit: "cm",
    group: "sauts",
    protocol: "3 essais, prise d elan courte, note le meilleur.",
  },
  {
    key: "cmjCm",
    label: "Counter movement jump (cm)",
    unit: "cm",
    group: "power",
    protocol: "3 essais, mains sur hanches si possible. Note le meilleur.",
  },
  {
    key: "lateralBoundCm",
    label: "Saut lateral (cm)",
    unit: "cm",
    group: "sauts",
    protocol: "3 essais par cote, note la meilleure distance.",
  },
  {
    key: "sprint10s",
    label: "Sprint 10 m (s)",
    unit: "s",
    group: "vitesse",
    lowerIsBetter: true,
    protocol: "2-3 essais, repos 2-3 min. Chrono manuel ok.",
  },
  {
    key: "sprint20s",
    label: "Sprint 20 m (s)",
    unit: "s",
    group: "vitesse",
    lowerIsBetter: true,
    protocol: "2 essais, repos 3 min. Depart identique.",
  },
  {
    key: "sprint30s",
    label: "Sprint 30 m (s)",
    unit: "s",
    group: "vitesse",
    lowerIsBetter: true,
    protocol: "2 essais, repos 3-4 min. Qualite max.",
  },
  {
    key: "tTest_s",
    label: "T-test (s)",
    unit: "s",
    group: "agilite",
    lowerIsBetter: true,
    protocol: "2 essais, repos 3 min. Technique propre.",
  },
  {
    key: "test505_s",
    label: "Test 505 (s)",
    unit: "s",
    group: "agilite",
    lowerIsBetter: true,
    protocol: "2 essais par cote, repos 2-3 min.",
  },
  {
    key: "endurance6min_m",
    label: "Endurance 6 min (m)",
    unit: "m",
    group: "endurance",
    protocol: "Distance totale en 6 min. Allure stable.",
  },
  {
    key: "yoYoIR1_m",
    label: "Yo-Yo IR1 (m)",
    unit: "m",
    group: "endurance",
    protocol: "Protocole Yo-Yo IR1, note la distance totale.",
  },
  {
    key: "run1km_s",
    label: "1 km (s)",
    unit: "s",
    group: "endurance",
    lowerIsBetter: true,
    protocol: "1 km chrono, allure continue. Note le temps.",
  },
  {
    key: "gobletKg",
    label: "Goblet squat charge (kg)",
    unit: "kg",
    group: "force",
    protocol: "Charge pour 8-10 reps propres.",
  },
  {
    key: "gobletReps",
    label: "Goblet squat reps",
    unit: "",
    group: "force",
    protocol: "Reps avec la charge choisie, tempo controle.",
  },
  {
    key: "splitKg",
    label: "Split squat charge (kg)",
    unit: "kg",
    group: "force",
    protocol: "Charge pour 6-8 reps / jambe, amplitude propre.",
  },
  {
    key: "splitReps",
    label: "Split squat reps",
    unit: "",
    group: "force",
    protocol: "Reps par jambe avec la charge choisie.",
  },
  {
    key: "trapbar3rmKg",
    label: "Trap bar 3RM (kg)",
    unit: "kg",
    group: "force",
    protocol: "Monte en 3-4 series, 3RM propre, pas d echec.",
  },
];

const FIELD_BY_KEY = FIELD_DEFS.reduce<Record<FieldKey, FieldConfig>>((acc, item) => {
  acc[item.key] = item;
  return acc;
}, {} as Record<FieldKey, FieldConfig>);

const PLAYLISTS: Record<PlaylistId, { label: string; subtitle: string }> = {
  fondation: { label: "Fondation", subtitle: "Base physique / S&C + endurance" },
  force: { label: "Force", subtitle: "Force max + charges lourdes" },
  explosivite: { label: "Explosivité (vitesse & technique)", subtitle: "Vitesse + technique (light)" },
  explosif: { label: "Explosif (puissance)", subtitle: "Sprint + power + plyo" },
  rsa: { label: "RSA", subtitle: "Repeated sprint ability" },
  endurance: { label: "Endurance", subtitle: "VMA courte + capacite a repeter" },
  saison: { label: "Saison / Maintien", subtitle: "Maintenir la forme sans se cramer" },
  offseason: { label: "Off‑Season / Transition", subtitle: "Récup active + maintien léger" },
};

const PLAYLIST_FIELDS: Record<PlaylistId, FieldKey[]> = {
  fondation: [
    "broadJumpCm",
    "sprint10s",
    "sprint20s",
    "endurance6min_m",
    "gobletKg",
    "gobletReps",
    "splitKg",
    "splitReps",
  ],
  force: ["gobletKg", "gobletReps", "splitKg", "splitReps", "trapbar3rmKg"],
  explosivite: [
    "cmjCm",
    "broadJumpCm",
    "sprint10s",
    "sprint30s",
    "trapbar3rmKg",
    "splitKg",
  ],
  explosif: ["cmjCm", "broadJumpCm", "sprint10s", "sprint20s", "trapbar3rmKg"],
  rsa: ["sprint10s", "sprint20s", "sprint30s", "yoYoIR1_m"],
  endurance: ["yoYoIR1_m", "endurance6min_m", "run1km_s"],
  saison: ["yoYoIR1_m", "endurance6min_m", "sprint10s", "cmjCm"],
  offseason: ["endurance6min_m", "sprint10s", "cmjCm"],
};

const PLAYLIST_PLAN: Record<PlaylistId, string[]> = {
  fondation: [
    "Echauffement structure (mobilite + activation + lignes droites)",
    "Sauts : broad jump",
    "Vitesse : 10-20 m",
    "Pause 5-8 min (hydratation)",
    "Endurance : 6 min",
    "Force repere : goblet squat ou split squat",
  ],
  force: [
    "Echauffement force (mobilite + activation)",
    "Test principal : trap bar 3RM (ou charge lourde 3-5 reps)",
    "Repos 6-8 min",
    "Test secondaire : goblet/split squat (qualite technique)",
  ],
  explosivite: [
    "Echauffement nerveux : gammes + 3 lignes droites",
    "Sauts : CMJ + broad jump",
    "Vitesse : 10-30 m (qualite max)",
    "Pause 6-8 min",
    "Force/power : trap bar 3RM (ou charge lourde 3-5 reps)",
  ],
  explosif: [
    "Echauffement nerveux + gammes",
    "Sauts : CMJ + broad jump",
    "Sprint : 10-20 m",
    "Pause 6-8 min",
    "Power : trap bar 3RM / medball",
  ],
  rsa: [
    "Echauffement progressif 8-10 min",
    "Sprints répétés courts (10-30 m)",
    "Récup courte entre efforts",
    "Finir par 6 min ou Yo-Yo IR1",
  ],
  endurance: [
    "Echauffement progressif 10-12 min",
    "Test principal : Yo-Yo IR1 ou 6 min",
    "Recuperation 6-8 min",
    "Test secondaire : 1 km (temps)",
  ],
  saison: [
    "Echauffement progressif 8-10 min",
    "Test endurance : 6 min ou Yo-Yo IR1",
    "Pause 5-6 min",
    "Test vitesse : 10 m",
    "Test puissance : CMJ",
  ],
  offseason: [
    "Echauffement léger 6-8 min",
    "Test endurance : 6 min",
    "Pause 4-5 min",
    "Test vitesse : 10 m",
    "Test puissance : CMJ",
  ],
};

const isPlaylistId = (value: any): value is PlaylistId =>
  value === "fondation" ||
  value === "force" ||
  value === "explosivite" ||
  value === "explosif" ||
  value === "rsa" ||
  value === "endurance" ||
  value === "saison" ||
  value === "offseason";

const SHORT_LABELS: Partial<Record<FieldKey, string>> = {
  broadJumpCm: "BJ",
  tripleJumpCm: "Triple",
  cmjCm: "CMJ",
  lateralBoundCm: "Lat",
  sprint10s: "10m",
  sprint20s: "20m",
  sprint30s: "30m",
  tTest_s: "T-test",
  test505_s: "505",
  endurance6min_m: "6' m",
  yoYoIR1_m: "YoYo",
  run1km_s: "1km",
  gobletKg: "Goblet",
  gobletReps: "Reps G",
  splitKg: "Split",
  splitReps: "Reps S",
  trapbar3rmKg: "TB 3RM",
};

type Mode = "battery" | "entry";
type StepId = FieldKey | "notes";

export default function TestsScreen() {
  const route = useRoute<any>();
  const microcycleGoal = useTrainingStore((s) => s.microcycleGoal);
  const [entries, setEntries] = useState<TestEntry[]>([]);
  const [form, setForm] = useState<Partial<TestEntry>>({});
  const [mode, setMode] = useState<Mode>("battery");
  const initialPlaylistFromRoute = route?.params?.initialPlaylist;
  const [selectedPlaylistOverride, setSelectedPlaylistOverride] =
    useState<PlaylistId | null>(null);
  const selectedPlaylist: PlaylistId = useMemo(() => {
    if (isPlaylistId(selectedPlaylistOverride)) return selectedPlaylistOverride;
    if (isPlaylistId(microcycleGoal)) return microcycleGoal;
    if (isPlaylistId(initialPlaylistFromRoute)) return initialPlaylistFromRoute;
    return "fondation";
  }, [selectedPlaylistOverride, microcycleGoal, initialPlaylistFromRoute]);
  const [stepIndex, setStepIndex] = useState(0);

  const selectPlaylist = (id: PlaylistId) => {
    setSelectedPlaylistOverride(id);
    setForm({});
    setStepIndex(0);
    setMode("battery");
  };

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as TestEntry[];
          const normalized = Array.isArray(parsed)
            ? parsed.map((entry) => {
                if ((entry as any)?.playlist === "reactivite") return { ...entry, playlist: "explosif" };
                return entry;
              })
            : [];
          setEntries(normalized as TestEntry[]);
        }
      } catch (e) {
        if (__DEV__) {
          console.warn("load tests", e);
        }
      }
    })();
  }, []);

  const save = async () => {
    const hasAnyValue =
      PLAYLIST_FIELDS[selectedPlaylist].some((k) => {
        const val = (form as any)[k];
        if (val === undefined || val === null || val === "") return false;
        return Number.isFinite(Number(val));
      }) || (form.notes ?? "").trim().length > 0;
    if (!hasAnyValue) {
      Alert.alert("Batterie vide", "Renseigne au moins un test ou une note.");
      return;
    }
    const cleanEntry: TestEntry = { ts: Date.now() };
    cleanEntry.playlist = selectedPlaylist;
    PLAYLIST_FIELDS[selectedPlaylist].forEach((k) => {
      const val = (form as any)[k];
      if (val !== undefined && val !== null && val !== "") {
        const num = Number(val);
        if (Number.isFinite(num)) {
          (cleanEntry as any)[k] = num;
        }
      }
    });
    cleanEntry.notes = form.notes || undefined;

    try {
      const next = [cleanEntry, ...entries].slice(0, 30);
      setEntries(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      Alert.alert("Enregistré", "Tes valeurs de test sont sauvegardées.");
      setForm({});
      setStepIndex(0);
      setMode("battery");
    } catch (e) {
      if (__DEV__) {
        console.warn("save tests", e);
      }
      Alert.alert("Erreur", "Impossible de sauvegarder les tests.");
    }
  };

  const entriesForPlaylist = useMemo(() => {
    return entries.filter(
      (e) => (isPlaylistId(e.playlist) ? e.playlist : "fondation") === selectedPlaylist
    );
  }, [entries, selectedPlaylist]);

  const lastTwo = useMemo(() => entriesForPlaylist.slice(0, 2), [entriesForPlaylist]);
  const last = lastTwo[0];
  const activeKeys = PLAYLIST_FIELDS[selectedPlaylist] ?? [];
  const summaryStats = useMemo(() => {
    if (entriesForPlaylist.length === 0) return [];
    return activeKeys
      .map((key) => {
        const values = entriesForPlaylist
          .map((e) => Number((e as any)[key]))
          .filter((v) => Number.isFinite(v));
        if (!values.length) return null;
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const lowerIsBetter = FIELD_BY_KEY[key]?.lowerIsBetter ?? false;
        const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
        return {
          key,
          label: FIELD_BY_KEY[key]?.label ?? key,
          unit: FIELD_BY_KEY[key]?.unit ?? "",
          avg,
          best,
          count: values.length,
        };
      })
      .filter(Boolean) as Array<{
      key: FieldKey;
      label: string;
      unit: string;
      avg: number;
      best: number;
      count: number;
    }>;
  }, [entriesForPlaylist, activeKeys]);
  const steps = useMemo<StepId[]>(() => [...activeKeys, "notes"], [activeKeys]);
  const totalTests = activeKeys.length;
  const completedCount = activeKeys.filter((key) => {
    const val = (form as any)[key];
    if (val === undefined || val === null || val === "") return false;
    return Number.isFinite(Number(val));
  }).length;
  const progressRatio = totalTests > 0 ? completedCount / totalTests : 0;
  const hasAnyInput = completedCount > 0 || (form.notes ?? "").trim().length > 0;
  const currentStep = steps[stepIndex] ?? steps[0];
  const isNotesStep = currentStep === "notes";
  const currentField = !isNotesStep ? FIELD_BY_KEY[currentStep] : null;
  const stepLabel = isNotesStep ? "Notes du jour" : currentField?.label ?? "Test";
  const stepProtocol = isNotesStep
    ? "Optionnel : surface, fatigue, conditions, ressenti."
    : currentField?.protocol ?? "";
  const stepUnit = isNotesStep ? "" : currentField?.unit ?? "";
  const currentFieldKey = !isNotesStep ? (currentStep as FieldKey) : null;

  const goToStep = (idx: number) => {
    const clamped = Math.max(0, Math.min(idx, steps.length - 1));
    setStepIndex(clamped);
  };

  const goNext = () => {
    if (!isNotesStep) {
      const value = (form as any)[currentStep];
      if (value === undefined || value === null || value === "") {
        Alert.alert("Valeur manquante", "Entre une valeur ou passe ce test.");
        return;
      }
      if (!Number.isFinite(Number(value))) {
        Alert.alert("Valeur invalide", "Utilise un nombre valide.");
        return;
      }
    }
    if (stepIndex >= steps.length - 1) {
      save();
      return;
    }
    goToStep(stepIndex + 1);
  };

  const goPrev = () => {
    if (stepIndex === 0) {
      setMode("battery");
      return;
    }
    goToStep(stepIndex - 1);
  };

  const startBattery = () => {
    const firstIncomplete = (() => {
      for (let i = 0; i < activeKeys.length; i += 1) {
        const key = activeKeys[i];
        const val = (form as any)[key];
        if (val === undefined || val === null || val === "") return i;
        if (!Number.isFinite(Number(val))) return i;
      }
      return activeKeys.length;
    })();
    setMode("entry");
    setStepIndex(firstIncomplete);
  };

  const resetBattery = () => {
    setForm({});
    setStepIndex(0);
    setMode("battery");
  };

  const groupedFields = useMemo(() => {
    const groupTitles: Record<FieldConfig["group"], string> = {
      sauts: "Sauts / Explosivite",
      vitesse: "Vitesse lineaire",
      endurance: "Endurance aerobie",
      force: "Force repere",
      agilite: "Agilite / COD",
      power: "Puissance",
    };
    const groups: Record<string, { title: string; fields: FieldConfig[] }> = {};
    const activeKeys = PLAYLIST_FIELDS[selectedPlaylist] ?? [];
    for (const key of activeKeys) {
      const field = FIELD_BY_KEY[key];
      if (!field) continue;
      const groupId = field.group;
      if (!groups[groupId]) {
        groups[groupId] = { title: groupTitles[groupId], fields: [] };
      }
      groups[groupId].fields.push(field);
    }
    return Object.values(groups).filter((g) => g.fields.length > 0);
  }, [selectedPlaylist]);

  const getUnitForField = (key: FieldKey): string => {
    return FIELD_BY_KEY[key]?.unit ?? "";
  };

  const formatStatValue = (value: number, unit: string) => {
    if (!Number.isFinite(value)) return "--";
    if (unit === "s") return value.toFixed(2);
    const rounded = Math.round(value);
    return Math.abs(value - rounded) < 0.01 ? String(rounded) : value.toFixed(1);
  };

  const isBetterDelta = (key: FieldKey, delta: number): boolean => {
    const lowerIsBetter = FIELD_BY_KEY[key]?.lowerIsBetter ?? false;
    return lowerIsBetter ? delta < 0 : delta > 0;
  };

  const renderDelta = (key: FieldKey) => {
    if (lastTwo.length < 2) return null;
    const curr = lastTwo[0]?.[key];
    const prev = lastTwo[1]?.[key];
    if (curr === undefined || prev === undefined) return null;

    const currNum = Number(curr);
    const prevNum = Number(prev);
    if (!Number.isFinite(currNum) || !Number.isFinite(prevNum)) return null;

    const delta = currNum - prevNum;
    if (delta === 0) return null;

    const better = isBetterDelta(key, delta);
    const sign = delta > 0 ? "+" : "";
    const unit = getUnitForField(key);
    const arrow = better ? "↑" : "↓";

    return (
      <View style={styles.deltaChip}>
        <Text style={[styles.deltaText, { color: better ? palette.success : palette.danger }]}>
          {arrow} {sign}
          {Math.abs(delta).toFixed(2)} {unit}
        </Text>
        <Text style={styles.deltaSub}>vs. dernier test</Text>
      </View>
    );
  };

  const renderOverviewCard = () => {
    if (!last) return null;

    return (
      <Card variant="surface" style={styles.overviewCard}>
        <View style={styles.overviewHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Ta dernière performance</Text>
            <Text style={styles.sectionSub}>
              {lastTwo.length > 1
                ? "Comparée au test précédent."
                : "Premier test enregistré."}
            </Text>
          </View>
          <View style={styles.overviewPill}>
            <Text style={styles.overviewPillLabel}>Test</Text>
            <Text style={styles.overviewPillDate}>
              {format(new Date(last.ts), "dd/MM")}
            </Text>
          </View>
        </View>

        <View style={{ gap: 14, marginTop: 10 }}>
          {groupedFields.map((group) => (
            <View key={group.title} style={styles.overviewGroup}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <View style={{ gap: 8 }}>
                {group.fields.map((f) => {
                  const val = last[f.key];
                  if (val === undefined) return null;
                  const unit = getUnitForField(f.key);
                  return (
                    <View key={f.key} style={styles.overviewMetricRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.overviewMetricLabel}>{f.label}</Text>
                        <Text style={styles.overviewMetricValue}>
                          {val}
                          {unit ? ` ${unit}` : ""}
                        </Text>
                      </View>
                      {renderDelta(f.key)}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}

          {last.notes ? (
            <View style={styles.overviewNotesBlock}>
              <Text style={styles.groupTitle}>Notes du jour</Text>
              <Text style={styles.overviewNotesText}>{last.notes}</Text>
            </View>
          ) : null}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Batterie de tests FKS</Text>
            <Text style={styles.subtitle}>
              Référence terrain pour suivre ta progression sur la saison.
            </Text>
          </View>
          {last && (
            <View style={styles.lastBadge}>
              <Text style={styles.lastBadgeLabel}>Dernier test</Text>
              <Text style={styles.lastBadgeDate}>
                {format(new Date(last.ts), "dd/MM/yyyy")}
              </Text>
            </View>
          )}
        </View>

        {/* PLAYLIST */}
        <Card variant="soft" style={styles.playlistCard}>
          <View style={styles.playlistHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Playlist : {PLAYLISTS[selectedPlaylist].label}
              </Text>
              <Text style={styles.sectionSub}>
                {PLAYLISTS[selectedPlaylist].subtitle}
              </Text>
            </View>
            <View style={styles.playlistBadge}>
              <Text style={styles.playlistBadgeText}>Tests adaptes</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.playlistRow}
          >
            {(Object.keys(PLAYLISTS) as PlaylistId[]).map((id) => {
              const active = id === selectedPlaylist;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.playlistChip, active && styles.playlistChipActive]}
                  onPress={() => selectPlaylist(id)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.playlistChipText,
                      active && styles.playlistChipTextActive,
                    ]}
                  >
                    {PLAYLISTS[id].label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Card>

        {mode === "entry" ? (
          <Card variant="surface" style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.sectionTitle}>Batterie en cours</Text>
              <Text style={styles.entryStep}>
                Etape {Math.min(stepIndex + 1, steps.length)}/{steps.length}
              </Text>
            </View>
            <View style={styles.entryProgressTrack}>
              <View style={[styles.entryProgressFill, { width: `${progressRatio * 100}%` }]} />
            </View>

            <View style={styles.entryBody}>
              <Text style={styles.entryLabel}>{stepLabel}</Text>
              <Text style={styles.entryProtocol}>{stepProtocol}</Text>

              {isNotesStep ? (
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Ressenti, surface, fatigue, contexte..."
                  placeholderTextColor={palette.sub}
                  multiline
                  value={form.notes ?? ""}
                  onChangeText={(txt) => setForm((prev) => ({ ...prev, notes: txt }))}
                />
              ) : (
                <View style={styles.entryInputRow}>
                  <TextInput
                    style={[styles.input, styles.entryInput]}
                    keyboardType="numeric"
                    placeholder={currentField?.placeholder || "0"}
                    placeholderTextColor={palette.sub}
                    value={
                      currentFieldKey ? form[currentFieldKey]?.toString() ?? "" : ""
                    }
                    onChangeText={(txt) =>
                      currentFieldKey
                        ? setForm((prev) => ({ ...prev, [currentFieldKey]: txt }))
                        : undefined
                    }
                  />
                  <View style={styles.entryUnitPill}>
                    <Text style={styles.entryUnitText}>{stepUnit || "reps"}</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.entryActions}>
              <Button
                label={stepIndex === 0 ? "Retour" : "Precedent"}
                onPress={goPrev}
                size="sm"
                variant="ghost"
              />
              {!isNotesStep ? (
                <Button
                  label="Passer"
                  onPress={() => goToStep(stepIndex + 1)}
                  size="sm"
                  variant="secondary"
                />
              ) : null}
              <Button
                label={stepIndex >= steps.length - 1 ? "Terminer la batterie" : "Valider et suivant"}
                onPress={goNext}
                size="sm"
                variant="primary"
              />
            </View>
          </Card>
        ) : (
          <>
            <Card variant="surface" style={styles.batteryCard}>
              <View style={styles.batteryHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Batterie active</Text>
                  <Text style={styles.sectionSub}>
                    {completedCount}/{totalTests} tests renseignes
                  </Text>
                </View>
                <View style={styles.batteryBadge}>
                  <Text style={styles.batteryBadgeText}>
                    {PLAYLISTS[selectedPlaylist].label}
                  </Text>
                </View>
              </View>
              <View style={styles.batteryProgressTrack}>
                <View style={[styles.batteryProgressFill, { width: `${progressRatio * 100}%` }]} />
              </View>

              <View style={styles.batteryList}>
                {activeKeys.map((key, idx) => {
                  const field = FIELD_BY_KEY[key];
                  const val = (form as any)[key];
                  const done =
                    val !== undefined &&
                    val !== null &&
                    val !== "" &&
                    Number.isFinite(Number(val));
                  return (
                    <View key={key} style={styles.batteryRow}>
                      <View style={[styles.batteryIndex, done && styles.batteryIndexDone]}>
                        <Text style={[styles.batteryIndexText, done && styles.batteryIndexTextDone]}>
                          {idx + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.batteryLabel}>{field.label}</Text>
                        <Text style={styles.batteryMeta}>{field.protocol}</Text>
                      </View>
                      <Text style={done ? styles.batteryValue : styles.batteryPending}>
                        {done ? `${val}${field.unit ? ` ${field.unit}` : ""}` : "A faire"}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.batteryActions}>
                <Button
                  label={hasAnyInput ? "Reprendre la batterie" : "Lancer la batterie"}
                  onPress={startBattery}
                  size="md"
                  variant="primary"
                  fullWidth
                />
                {hasAnyInput ? (
                  <Button
                    label="Recommencer"
                    onPress={resetBattery}
                    size="sm"
                    variant="ghost"
                    fullWidth
                  />
                ) : null}
              </View>
            </Card>

            {summaryStats.length > 0 ? (
              <Card variant="surface" style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Resume des tests</Text>
                    <Text style={styles.sectionSub}>
                      Moyenne et meilleur sur {entriesForPlaylist.length} batterie(s).
                    </Text>
                  </View>
                  <View style={styles.summaryBadge}>
                    <Text style={styles.summaryBadgeText}>Stats</Text>
                  </View>
                </View>

                <View style={styles.summaryList}>
                  {summaryStats.map((item) => (
                    <View key={item.key} style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>{item.label}</Text>
                      <View style={styles.summaryValues}>
                        <View style={styles.summaryPill}>
                          <Text style={styles.summaryPillLabel}>Moy.</Text>
                          <Text style={styles.summaryPillValue}>
                            {formatStatValue(item.avg, item.unit)}
                            {item.unit ? ` ${item.unit}` : ""}
                          </Text>
                        </View>
                        <View style={[styles.summaryPill, styles.summaryPillBest]}>
                          <Text style={styles.summaryPillLabel}>Meilleur</Text>
                          <Text style={styles.summaryPillValue}>
                            {formatStatValue(item.best, item.unit)}
                            {item.unit ? ` ${item.unit}` : ""}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            <Card variant="surface" style={styles.planCard}>
              <Text style={styles.sectionTitle}>
                Deroule conseille · {PLAYLISTS[selectedPlaylist].label}
              </Text>
              <View style={{ gap: 10, marginTop: 6 }}>
                {PLAYLIST_PLAN[selectedPlaylist].map((step, idx) => (
                  <View key={step} style={styles.stepRow}>
                    <Text style={styles.stepIndex}>{idx + 1}</Text>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {entriesForPlaylist.length > 0 ? renderOverviewCard() : null}
          </>
        )}

        {/* HISTORIQUE */}
        {mode === "battery" && entriesForPlaylist.length > 0 && (
          <Card variant="surface" style={styles.historyCard}>
            <Text style={styles.sectionTitle}>Historique récent</Text>
            <Text style={styles.sectionSub}>
              Derniers tests pour la playlist {PLAYLISTS[selectedPlaylist].label}.
            </Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              {entriesForPlaylist.slice(0, 5).map((e) => (
                <View key={e.ts} style={styles.historyRow}>
                  <View>
                    <Text style={styles.historyDate}>
                      {format(new Date(e.ts), "dd/MM/yyyy")}
                    </Text>
                    <Text style={styles.historyTime}>
                      {format(new Date(e.ts), "HH:mm")}
                    </Text>
                  </View>
                  <Text style={styles.historyValues}>
                    {PLAYLIST_FIELDS[selectedPlaylist]
                      .slice(0, 3)
                      .map((key) => {
                        const val = (e as any)[key];
                        if (val === undefined || val === null || val === "") return null;
                        const unit = getUnitForField(key);
                        const label = SHORT_LABELS[key] ?? FIELD_BY_KEY[key]?.label ?? key;
                        return `${label} ${val}${unit ? unit : ""}`;
                      })
                      .filter(Boolean)
                      .join(" · ") || "--"}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    padding: 16,
    gap: 16,
  },

  // HEADER
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: palette.sub,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  lastBadge: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    alignItems: "flex-end",
  },
  lastBadgeLabel: {
    color: palette.sub,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lastBadgeDate: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  playlistCard: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  playlistHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  playlistBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  playlistBadgeText: {
    color: palette.sub,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  playlistRow: {
    gap: 8,
    paddingVertical: 4,
  },
  playlistChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  playlistChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  playlistChipText: {
    color: palette.sub,
    fontSize: 12,
    fontWeight: "600",
  },
  playlistChipTextActive: {
    color: palette.accent,
  },

  // CARDS
  planCard: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  batteryCard: {
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  entryCard: {
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  historyCard: {
    borderRadius: 16,
    padding: 14,
  },

  sectionTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionSub: {
    color: palette.sub,
    fontSize: 12,
    marginTop: 2,
  },

  // SUMMARY
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  summaryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  summaryBadgeText: {
    color: palette.sub,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryList: {
    gap: 10,
  },
  summaryRow: {
    gap: 8,
  },
  summaryLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },
  summaryValues: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  summaryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    minWidth: 110,
  },
  summaryPillBest: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  summaryPillLabel: {
    color: palette.sub,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryPillValue: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },

  // BATTERY
  batteryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  batteryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  batteryBadgeText: {
    color: palette.sub,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  batteryProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  batteryProgressFill: {
    height: "100%",
    backgroundColor: palette.accent,
  },
  batteryList: {
    gap: 10,
  },
  batteryRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  batteryIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  batteryIndexDone: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  batteryIndexText: {
    color: palette.sub,
    fontSize: 11,
    fontWeight: "700",
  },
  batteryIndexTextDone: {
    color: palette.bg,
  },
  batteryLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },
  batteryMeta: {
    color: palette.sub,
    fontSize: 11,
    marginTop: 2,
  },
  batteryValue: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
  },
  batteryPending: {
    color: palette.sub,
    fontSize: 12,
  },
  batteryActions: {
    marginTop: 4,
    gap: 8,
  },

  // ENTRY
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryStep: {
    color: palette.sub,
    fontSize: 12,
  },
  entryProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  entryProgressFill: {
    height: "100%",
    backgroundColor: palette.accent,
  },
  entryBody: {
    gap: 8,
  },
  entryLabel: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "800",
  },
  entryProtocol: {
    color: palette.sub,
    fontSize: 12,
    lineHeight: 17,
  },
  entryInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryInput: {
    flex: 1,
  },
  entryUnitPill: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  entryUnitText: {
    color: palette.sub,
    fontSize: 12,
    fontWeight: "600",
  },
  entryActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
  },

  // PLAN STEPS
  stepRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.accent,
    textAlign: "center",
    fontWeight: "700",
    paddingTop: 2,
    fontSize: 12,
  },
  stepText: {
    color: palette.text,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  // GROUPS
  groupTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "700",
  },

  // INPUTS
  input: {
    backgroundColor: palette.cardSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: palette.text,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  // DELTA
  deltaChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.cardSoft,
    alignItems: "flex-end",
  },
  deltaText: {
    fontSize: 11,
    fontWeight: "600",
  },
  deltaSub: {
    fontSize: 9,
    color: palette.sub,
  },

  // HISTORY
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(31, 36, 48, 0.6)",
  },
  historyDate: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "600",
  },
  historyTime: {
    color: palette.sub,
    fontSize: 10,
  },
  historyValues: {
    color: palette.text,
    fontSize: 12,
    textAlign: "right",
  },

  // OVERVIEW
  overviewCard: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  overviewHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  overviewPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: "flex-end",
  },
  overviewPillLabel: {
    color: palette.sub,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  overviewPillDate: {
    color: palette.text,
    fontSize: 12,
    fontWeight: "700",
  },
  overviewGroup: {
    gap: 8,
  },
  overviewMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  overviewMetricLabel: {
    color: palette.sub,
    fontSize: 11,
  },
  overviewMetricValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  overviewNotesBlock: {
    marginTop: 6,
    borderRadius: 10,
    padding: 10,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 4,
  },
  overviewNotesText: {
    color: palette.sub,
    fontSize: 12,
    lineHeight: 17,
  },
});
