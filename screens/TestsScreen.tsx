// screens/TestsScreen.tsx — orchestrator (refactored from 1879 → ~280 lines)
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { View, StyleSheet, ScrollView, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { useHaptics } from "../hooks/useHaptics";
import { theme } from "../constants/theme";
import { showToast } from "../utils/toast";
import { useSessionsStore } from "../state/stores/useSessionsStore";

import {
  isPlaylistId,
  FIELD_BY_KEY,
  PLAYLIST_FIELDS,
  type PlaylistId,
  type TestEntry,
  type FieldKey,
  type FieldConfig,
  type StepId,
} from "./tests/testConfig";
import { useTestsStorage } from "./tests/hooks/useTestsStorage";

import { TestHeader } from "./tests/components/TestHeader";
import { PlaylistSelector } from "./tests/components/PlaylistSelector";
import { EntryFormCard } from "./tests/components/EntryFormCard";
import { BatteryCard } from "./tests/components/BatteryCard";
import { StatisticsCard, type SummaryStat } from "./tests/components/StatisticsCard";
import { TestPlanCard } from "./tests/components/TestPlanCard";
import { OverviewCard } from "./tests/components/OverviewCard";
import { HistorySection } from "./tests/components/HistorySection";

const palette = theme.colors;

type Mode = "battery" | "entry";

export default function TestsScreen() {
  const route = useRoute<any>();
  const haptics = useHaptics();
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);

  // Storage
  const { entries, persistEntries } = useTestsStorage();

  // Form state
  const [form, setForm] = useState<Partial<TestEntry>>({});
  const [mode, setMode] = useState<Mode>("battery");
  const [selectedPlaylistOverride, setSelectedPlaylistOverride] =
    useState<PlaylistId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const cardAnims = useRef([0, 1, 2, 3, 4, 5].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.stagger(
        70,
        cardAnims.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          })
        )
      ).start();
    });
  }, [fadeAnim, slideAnim, cardAnims]);

  // Playlist selection
  const initialPlaylistFromRoute = route?.params?.initialPlaylist;
  const selectedPlaylist: PlaylistId = useMemo(() => {
    if (isPlaylistId(selectedPlaylistOverride)) return selectedPlaylistOverride;
    if (isPlaylistId(initialPlaylistFromRoute)) return initialPlaylistFromRoute;
    if (isPlaylistId(microcycleGoal)) return microcycleGoal;
    return "fondation";
  }, [selectedPlaylistOverride, microcycleGoal, initialPlaylistFromRoute]);

  const activeKeys = PLAYLIST_FIELDS[selectedPlaylist] ?? [];
  const steps = useMemo<StepId[]>(() => [...activeKeys, "notes"], [activeKeys]);

  // Derived state
  const totalTests = activeKeys.length;
  const completedCount = activeKeys.filter((key) => {
    const val = (form as any)[key];
    if (val === undefined || val === null || val === "") return false;
    return Number.isFinite(Number(val));
  }).length;
  const progressRatio = totalTests > 0 ? completedCount / totalTests : 0;
  const hasAnyInput = completedCount > 0 || (form.notes ?? "").trim().length > 0;

  const entriesForPlaylist = useMemo(
    () => entries.filter(
      (e) => (isPlaylistId(e.playlist) ? e.playlist : "fondation") === selectedPlaylist
    ),
    [entries, selectedPlaylist]
  );
  const lastTwo = useMemo(() => entriesForPlaylist.slice(0, 2), [entriesForPlaylist]);
  const lastEntry = lastTwo[0];

  // Summary stats
  const summaryStats = useMemo<SummaryStat[]>(() => {
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
      .filter(Boolean) as SummaryStat[];
  }, [entriesForPlaylist, activeKeys]);

  // Grouped fields for overview card
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
  }, [activeKeys]);

  // --- Callbacks ---

  const selectPlaylist = useCallback((id: PlaylistId) => {
    setSelectedPlaylistOverride(id);
    setForm({});
    setStepIndex(0);
    setMode("battery");
  }, []);

  const goToStep = useCallback((idx: number) => {
    setStepIndex(Math.max(0, Math.min(idx, steps.length - 1)));
  }, [steps.length]);

  const save = useCallback(async () => {
    const hasAnyValue =
      PLAYLIST_FIELDS[selectedPlaylist].some((k) => {
        const val = (form as any)[k];
        if (val === undefined || val === null || val === "") return false;
        return Number.isFinite(Number(val));
      }) || (form.notes ?? "").trim().length > 0;
    if (!hasAnyValue) {
      showToast({ type: "warn", title: "Batterie vide", message: "Renseigne au moins un test ou une note." });
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
    cleanEntry.notes = form.notes?.trim() || undefined;

    try {
      const next = [cleanEntry, ...entries].slice(0, 30);
      await persistEntries(next);
      showToast({ type: "success", title: "Enregistré", message: "Tes valeurs de test sont sauvegardées." });
      setForm({});
      setStepIndex(0);
      setMode("battery");
    } catch (e) {
      if (__DEV__) console.warn("save tests", e);
      showToast({ type: "error", title: "Erreur", message: "Impossible de sauvegarder les tests." });
    }
  }, [selectedPlaylist, form, entries, persistEntries]);

  const goNext = useCallback(() => {
    const currentStep = steps[stepIndex] ?? steps[0];
    const isNotesStep = currentStep === "notes";
    if (!isNotesStep) {
      const value = (form as any)[currentStep];
      if (value === undefined || value === null || value === "") {
        showToast({ type: "warn", title: "Valeur manquante", message: "Entre une valeur ou passe ce test." });
        return;
      }
      if (!Number.isFinite(Number(value))) {
        showToast({ type: "warn", title: "Valeur invalide", message: "Utilise un nombre valide." });
        return;
      }
    }
    if (stepIndex >= steps.length - 1) {
      save();
      return;
    }
    goToStep(stepIndex + 1);
  }, [stepIndex, steps, form, save, goToStep]);

  const goPrev = useCallback(() => {
    if (stepIndex === 0) {
      setMode("battery");
      return;
    }
    goToStep(stepIndex - 1);
  }, [stepIndex, goToStep]);

  const startBattery = useCallback(() => {
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
  }, [activeKeys, form]);

  const resetBattery = useCallback(() => {
    setForm({});
    setStepIndex(0);
    setMode("battery");
  }, []);

  const onFormChange = useCallback((key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onSkipStep = useCallback(() => {
    goToStep(stepIndex + 1);
  }, [stepIndex, goToStep]);

  const impactLight = useCallback(() => haptics.impactLight(), [haptics]);

  // --- Render ---

  return (
    <SafeAreaView style={styles.safeArea} edges={["right", "left", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TestHeader
          lastEntry={lastEntry}
          fadeAnim={fadeAnim}
          slideAnim={slideAnim}
        />

        <PlaylistSelector
          selectedPlaylist={selectedPlaylist}
          activeKeysCount={activeKeys.length}
          onSelect={selectPlaylist}
          onHaptic={impactLight}
          cardAnim={cardAnims[0]}
        />

        {mode === "entry" ? (
          <EntryFormCard
            stepIndex={stepIndex}
            steps={steps}
            progressRatio={progressRatio}
            form={form}
            onFormChange={onFormChange}
            onNext={goNext}
            onPrev={goPrev}
            onSkip={onSkipStep}
            onHaptic={impactLight}
            cardAnim={cardAnims[1]}
          />
        ) : (
          <>
            <BatteryCard
              activeKeys={activeKeys}
              form={form}
              selectedPlaylist={selectedPlaylist}
              completedCount={completedCount}
              totalTests={totalTests}
              progressRatio={progressRatio}
              hasAnyInput={hasAnyInput}
              onStart={startBattery}
              onReset={resetBattery}
              onHaptic={impactLight}
              cardAnim={cardAnims[1]}
            />

            <StatisticsCard
              stats={summaryStats}
              entriesCount={entriesForPlaylist.length}
              cardAnim={cardAnims[2]}
            />

            <TestPlanCard
              selectedPlaylist={selectedPlaylist}
              cardAnim={cardAnims[3]}
            />

            {lastEntry && (
              <OverviewCard
                lastEntry={lastEntry}
                lastTwo={lastTwo}
                groupedFields={groupedFields}
                cardAnim={cardAnims[4]}
              />
            )}
          </>
        )}

        {mode === "battery" && entriesForPlaylist.length > 0 && (
          <HistorySection
            entriesForPlaylist={entriesForPlaylist}
            selectedPlaylist={selectedPlaylist}
            cardAnim={cardAnims[5]}
          />
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
});
