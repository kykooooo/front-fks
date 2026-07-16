// screens/TestsScreen.tsx — orchestrator (Phase C : batterie unique, plus de sélecteur de cycle)
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { View, StyleSheet, ScrollView, Animated, KeyboardAvoidingView, Platform } from "react-native";
import { Screen } from "../components/ui/Screen";
import { useHaptics } from "../hooks/useHaptics";
import { theme } from "../constants/theme";
import { showToast } from "../utils/toast";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useExternalStore } from "../state/stores/useExternalStore";
import { isMicrocycleId, canonicalizeMicrocycleGoal } from "../domain/microcycles";

import {
  FIELD_BY_KEY,
  GROUP_TITLES,
  CORE_FIELD_KEYS,
  getOptionalFields,
  hasWeightsEquipment,
  type TestEntry,
  type FieldKey,
  type FieldConfig,
  type StepId,
} from "./tests/testConfig";
import { useTestsStorage } from "./tests/hooks/useTestsStorage";
import { getTestTimingBanner } from "./tests/testTiming";
import { fieldKeysWithData, pickFieldSamples } from "./tests/testHelpers";

import { TestHeader } from "./tests/components/TestHeader";
import { EntryFormCard } from "./tests/components/EntryFormCard";
import { BatteryCard } from "./tests/components/BatteryCard";
import { OptionalTestsSection } from "./tests/components/OptionalTestsSection";
import { StatisticsCard, type SummaryStat } from "./tests/components/StatisticsCard";
import { OverviewCard } from "./tests/components/OverviewCard";
import { HistorySection } from "./tests/components/HistorySection";
import { CycleTimingBanner } from "./tests/components/CycleTimingBanner";

const palette = theme.colors;

type Mode = "battery" | "entry";
// Le flux d'entrée en cours : soit le socle (3 étapes + notes), soit un seul
// test optionnel saisi individuellement depuis la section "Aller plus loin".
type EntryFlow = "core" | FieldKey;

const formatBoundsMessage = (field: FieldConfig) =>
  `${field.label} : entre ${field.min} et ${field.max}${field.unit ? ` ${field.unit}` : ""}.`;

const isOutOfBounds = (field: FieldConfig | undefined, num: number) => {
  if (!field) return false;
  if (field.min !== undefined && num < field.min) return true;
  if (field.max !== undefined && num > field.max) return true;
  return false;
};

const hasValidNumber = (form: Partial<TestEntry>, key: FieldKey): boolean => {
  const val = (form as any)[key];
  if (val === undefined || val === null || val === "") return false;
  return Number.isFinite(Number(val));
};

export default function TestsScreen() {
  const haptics = useHaptics();
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);
  const gymEquipment = useExternalStore((s) => s.gymEquipment);
  const homeEquipment = useExternalStore((s) => s.homeEquipment);
  const ageCategory = useExternalStore((s) => s.ageCategory);

  // Storage — historique unifié : plus de filtre par playlist nulle part en aval.
  const { entries, persistEntries } = useTestsStorage();

  // Deux formulaires distincts : le socle (persiste tant qu'on navigue
  // battery <-> entry, pour "Reprendre") et les tests optionnels (éphémère,
  // un tap dans la section = un champ = un enregistrement immédiat).
  const [coreForm, setCoreForm] = useState<Partial<TestEntry>>({});
  const [optionalForm, setOptionalForm] = useState<Partial<TestEntry>>({});
  const [mode, setMode] = useState<Mode>("battery");
  const [activeFlow, setActiveFlow] = useState<EntryFlow>("core");
  const [stepIndex, setStepIndex] = useState(0);
  const [optionalOpen, setOptionalOpen] = useState(false);

  // Animations (0: bandeau cycle, 1: batterie/entrée, 2: stats, 3: overview, 4: aller plus loin, 5: historique)
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

  // Section "Aller plus loin" : le module salle (goblet/split) et le trap bar
  // 3RM restent gated par matériel/âge, mais à l'intérieur de cette section
  // (plus par playlist "force"/"explosivité" dédiée).
  const optionalKeys = useMemo(
    () =>
      getOptionalFields({
        hasWeightsEquipment: hasWeightsEquipment(gymEquipment, homeEquipment),
        ageCategory,
      }),
    [gymEquipment, homeEquipment, ageCategory]
  );

  // Bandeau "bon moment pour tester" selon la position dans le cycle actif — inchangé.
  const timingBanner = useMemo(
    () => getTestTimingBanner(microcycleSessionIndex, isMicrocycleId(microcycleGoal)),
    [microcycleSessionIndex, microcycleGoal]
  );

  // Flux d'entrée en cours.
  const isCoreFlow = activeFlow === "core";
  const entrySteps = useMemo<StepId[]>(
    () => (isCoreFlow ? [...CORE_FIELD_KEYS, "notes"] : [activeFlow as FieldKey]),
    [isCoreFlow, activeFlow]
  );
  const entryForm = isCoreFlow ? coreForm : optionalForm;
  const entryTitle = isCoreFlow ? "Batterie en cours" : "Test rapide";

  // Progression du socle (BatteryCard + barre pendant la saisie du socle).
  const totalTests = CORE_FIELD_KEYS.length;
  const completedCount = CORE_FIELD_KEYS.filter((key) => hasValidNumber(coreForm, key)).length;
  const coreProgressRatio = totalTests > 0 ? completedCount / totalTests : 0;
  const hasAnyInput = completedCount > 0 || (coreForm.notes ?? "").trim().length > 0;
  const entryProgressRatio = isCoreFlow
    ? coreProgressRatio
    : hasValidNumber(optionalForm, activeFlow as FieldKey)
      ? 1
      : 0;

  // ─── Historique unifié : UNE timeline, toutes entrées confondues ───
  // (avant : `entriesForPlaylist` filtrait par cycle actif, ce qui "cachait"
  // les anciennes valeurs dès qu'on changeait de cycle — cf. chantier Phase C.)
  const keysWithData = useMemo(() => fieldKeysWithData(entries), [entries]);
  const fieldSamples = useMemo(
    () => pickFieldSamples(entries, keysWithData, 2),
    [entries, keysWithData]
  );
  const latestTs = entries[0]?.ts ?? 0;
  const latestNotes = useMemo(() => {
    const withNotes = entries.find((e) => (e.notes ?? "").trim().length > 0);
    return withNotes?.notes?.trim() || null;
  }, [entries]);

  // Statistiques — sur TOUTES les entrées (plus filtrées par playlist).
  const summaryStats = useMemo<SummaryStat[]>(() => {
    if (entries.length === 0) return [];
    return keysWithData
      .map((key) => {
        const values = entries
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
  }, [entries, keysWithData]);

  // Champs groupés pour OverviewCard — sur les champs qui ont au moins une valeur.
  const groupedFields = useMemo(() => {
    const groups: Record<string, { title: string; fields: FieldConfig[] }> = {};
    for (const key of keysWithData) {
      const field = FIELD_BY_KEY[key];
      if (!field) continue;
      const groupId = field.group;
      if (!groups[groupId]) {
        groups[groupId] = { title: GROUP_TITLES[groupId], fields: [] };
      }
      groups[groupId].fields.push(field);
    }
    return Object.values(groups).filter((g) => g.fields.length > 0);
  }, [keysWithData]);

  // --- Callbacks ---

  const goToStep = useCallback(
    (idx: number) => {
      setStepIndex(Math.max(0, Math.min(idx, entrySteps.length - 1)));
    },
    [entrySteps.length]
  );

  const save = useCallback(async () => {
    const keysToSave: FieldKey[] = isCoreFlow ? [...CORE_FIELD_KEYS] : [activeFlow as FieldKey];
    const formSnapshot = isCoreFlow ? coreForm : optionalForm;

    const hasAnyValue =
      keysToSave.some((k) => hasValidNumber(formSnapshot, k)) ||
      (isCoreFlow && (formSnapshot.notes ?? "").trim().length > 0);
    if (!hasAnyValue) {
      showToast({
        type: "warn",
        title: isCoreFlow ? "Batterie vide" : "Test vide",
        message: isCoreFlow
          ? "Renseigne au moins un test ou une note."
          : "Entre une valeur avant d'enregistrer.",
      });
      return;
    }
    const outOfBoundsKey = keysToSave.find((k) => {
      if (!hasValidNumber(formSnapshot, k)) return false;
      return isOutOfBounds(FIELD_BY_KEY[k], Number((formSnapshot as any)[k]));
    });
    if (outOfBoundsKey) {
      showToast({
        type: "warn",
        title: "Valeur hors limites",
        message: formatBoundsMessage(FIELD_BY_KEY[outOfBoundsKey]),
      });
      return;
    }

    const cleanEntry: TestEntry = { ts: Date.now() };
    // Tag informatif seul (quel cycle était actif) — plus un filtre en aval.
    const cycleTag = canonicalizeMicrocycleGoal(microcycleGoal);
    if (cycleTag) cleanEntry.playlist = cycleTag;
    keysToSave.forEach((k) => {
      if (hasValidNumber(formSnapshot, k)) {
        (cleanEntry as any)[k] = Number((formSnapshot as any)[k]);
      }
    });
    if (isCoreFlow) cleanEntry.notes = formSnapshot.notes?.trim() || undefined;

    try {
      const next = [cleanEntry, ...entries].slice(0, 30);
      await persistEntries(next);
      showToast({
        type: "success",
        title: "Enregistré",
        message: isCoreFlow ? "Ta batterie est sauvegardée." : "Résultat enregistré.",
      });
      if (isCoreFlow) setCoreForm({});
      else setOptionalForm({});
      setStepIndex(0);
      setMode("battery");
    } catch (e) {
      if (__DEV__) console.warn("save tests", e);
      showToast({ type: "error", title: "Erreur", message: "Impossible de sauvegarder les tests." });
    }
  }, [isCoreFlow, activeFlow, coreForm, optionalForm, entries, persistEntries, microcycleGoal]);

  const goNext = useCallback(() => {
    const currentStep = entrySteps[stepIndex] ?? entrySteps[0];
    const isNotesStep = currentStep === "notes";
    if (!isNotesStep) {
      const value = (entryForm as any)[currentStep];
      if (value === undefined || value === null || value === "") {
        showToast({ type: "warn", title: "Valeur manquante", message: "Entre une valeur ou passe ce test." });
        return;
      }
      const num = Number(value);
      if (!Number.isFinite(num)) {
        showToast({ type: "warn", title: "Valeur invalide", message: "Utilise un nombre valide." });
        return;
      }
      const field = FIELD_BY_KEY[currentStep as FieldKey];
      if (isOutOfBounds(field, num)) {
        showToast({
          type: "warn",
          title: "Valeur hors limites",
          message: formatBoundsMessage(field),
        });
        return;
      }
    }
    if (stepIndex >= entrySteps.length - 1) {
      save();
      return;
    }
    goToStep(stepIndex + 1);
  }, [stepIndex, entrySteps, entryForm, save, goToStep]);

  const goPrev = useCallback(() => {
    if (stepIndex === 0) {
      setMode("battery");
      return;
    }
    goToStep(stepIndex - 1);
  }, [stepIndex, goToStep]);

  const startCoreBattery = useCallback(() => {
    const firstIncomplete = (() => {
      for (let i = 0; i < CORE_FIELD_KEYS.length; i += 1) {
        if (!hasValidNumber(coreForm, CORE_FIELD_KEYS[i])) return i;
      }
      return CORE_FIELD_KEYS.length;
    })();
    setActiveFlow("core");
    setMode("entry");
    setStepIndex(firstIncomplete);
  }, [coreForm]);

  const resetCoreBattery = useCallback(() => {
    setCoreForm({});
    setStepIndex(0);
    setMode("battery");
  }, []);

  const startOptionalEntry = useCallback((key: FieldKey) => {
    setOptionalForm({});
    setActiveFlow(key);
    setStepIndex(0);
    setMode("entry");
  }, []);

  const toggleOptionalOpen = useCallback(() => setOptionalOpen((v) => !v), []);

  const onFormChange = useCallback(
    (key: string, value: string) => {
      const normalized = key === "notes" ? value : value.replace(",", ".");
      if (isCoreFlow) {
        setCoreForm((prev) => ({ ...prev, [key]: normalized }));
      } else {
        setOptionalForm((prev) => ({ ...prev, [key]: normalized }));
      }
    },
    [isCoreFlow]
  );

  const onSkipStep = useCallback(() => {
    goToStep(stepIndex + 1);
  }, [stepIndex, goToStep]);

  const impactLight = useCallback(() => haptics.impactLight(), [haptics]);

  // --- Render ---

  return (
    <Screen style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TestHeader
          lastEntry={entries[0]}
          fadeAnim={fadeAnim}
          slideAnim={slideAnim}
        />

        {timingBanner && (
          <CycleTimingBanner banner={timingBanner} cardAnim={cardAnims[0]} />
        )}

        {mode === "entry" ? (
          <EntryFormCard
            title={entryTitle}
            stepIndex={stepIndex}
            steps={entrySteps}
            progressRatio={entryProgressRatio}
            form={entryForm}
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
              coreKeys={CORE_FIELD_KEYS}
              form={coreForm}
              completedCount={completedCount}
              totalTests={totalTests}
              progressRatio={coreProgressRatio}
              hasAnyInput={hasAnyInput}
              onStart={startCoreBattery}
              onReset={resetCoreBattery}
              onHaptic={impactLight}
              cardAnim={cardAnims[1]}
            />

            <StatisticsCard
              stats={summaryStats}
              entriesCount={entries.length}
              cardAnim={cardAnims[2]}
            />

            {groupedFields.length > 0 && (
              <OverviewCard
                latestTs={latestTs}
                latestNotes={latestNotes}
                hasComparison={entries.length > 1}
                fieldSamples={fieldSamples}
                groupedFields={groupedFields}
                cardAnim={cardAnims[3]}
              />
            )}

            <OptionalTestsSection
              optionalKeys={optionalKeys}
              fieldSamples={fieldSamples}
              open={optionalOpen}
              onToggle={toggleOptionalOpen}
              onSelectField={startOptionalEntry}
              onHaptic={impactLight}
              cardAnim={cardAnims[4]}
            />

            <HistorySection entries={entries} cardAnim={cardAnims[5]} />
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 16,
  },
});
