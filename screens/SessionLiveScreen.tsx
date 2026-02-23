// screens/SessionLiveScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Animated,
  Vibration,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { AppStackParamList } from "../navigation/RootNavigator";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { withSessionErrorBoundary } from "../components/withErrorBoundary";
import { SectionHeader } from "../components/ui/SectionHeader";
import { useSettingsStore } from "../state/settingsStore";

type BlockItem = {
  name?: string | null;
  description?: string | null;
  football_context?: string | null;
  exercise_id?: string | null;
  sets?: number | null;
  reps?: number | null;
  work_s?: number | null;
  rest_s?: number | null;
  work_rest_sec?: number[] | null;
  work_rest?: string | null;
  duration_min?: number | null;
  duration_per_set_sec?: number | null;
  notes?: string | null;
  modality?: string | null;
};

type Block = {
  name?: string | null;
  type?: string;
  goal?: string | null;
  focus?: string | null;
  intensity?: string;
  duration_min?: number;
  items?: BlockItem[];
  notes?: string | null;
  timer_presets?: {
    label?: string;
    work_s?: number | null;
    rest_s?: number | null;
    rounds?: number | null;
  }[] | null;
};

type LiveRoute = RouteProp<AppStackParamList, "SessionLive">;

const palette = theme.colors;
const ITEM_SPACING = 12;

const formatTime = (total: number) => {
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const prettifyName = (name: string) => {
  const trimmed = (name || "").trim();
  if (!trimmed) return "Exercice";
  const noPrefix = trimmed.replace(/^(wu_|str_|run_|plyo_|cod_|core_)/i, "");
  const spaced = noPrefix.replace(/_/g, " ");
  return spaced
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

const cleanDisplayNote = (value?: string | null) => {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const cleaned = value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.toLowerCase().startsWith("token:"))
    .join("\n")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
};

const formatPresetLabel = (preset: {
  label?: string | null;
  work_s?: number | null;
  rest_s?: number | null;
  rounds?: number | null;
}) => {
  const parts: string[] = [];
  if (preset.label) parts.push(String(preset.label));
  if (Number.isFinite(Number(preset.work_s)) && Number.isFinite(Number(preset.rest_s))) {
    parts.push(`${Number(preset.work_s)}s/${Number(preset.rest_s)}s`);
  }
  if (Number.isFinite(Number(preset.rounds)) && Number(preset.rounds) > 0) {
    parts.push(`x${Number(preset.rounds)}`);
  }
  return parts.join(" · ");
};

const intensityTone = (intensity?: string) => {
  const key = (intensity ?? "").toLowerCase();
  if (key.includes("hard") || key.includes("max")) return "danger";
  if (key.includes("mod")) return "warn";
  if (key.includes("easy")) return "ok";
  return "default";
};

const getCoachTip = (block: Block | undefined, index: number) => {
  if (!block) return "Qualité d'exécution avant volume.";
  const raw = `${block.type ?? ""} ${block.focus ?? ""} ${block.goal ?? ""}`.toLowerCase();
  if (raw.includes("strength") || raw.includes("force")) {
    return "Technique propre, amplitude contrôlée, tempo stable.";
  }
  if (raw.includes("speed") || raw.includes("vitesse")) {
    return "Explosivité max, récup complète, départs propres.";
  }
  if (raw.includes("endurance") || raw.includes("tempo") || raw.includes("run")) {
    return "Rythme constant, respiration posée, relâchement.";
  }
  if (raw.includes("plyo") || raw.includes("saut")) {
    return "Contacts courts, gainage actif, atterrissages doux.";
  }
  if (raw.includes("cod") || raw.includes("agility") || raw.includes("appuis")) {
    return "Appuis bas, changements propres, regard haut.";
  }
  if (raw.includes("mobility") || raw.includes("mobilite")) {
    return "Amplitude progressive, aucune douleur, respiration lente.";
  }
  return `Bloc ${index + 1} : qualité d'exécution avant volume.`;
};

function SessionLiveScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<LiveRoute>();
  const { v2, plannedDateISO, sessionId } = route.params;
  const soundsEnabled = useSettingsStore((s) => s.soundsEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);

  const { width } = useWindowDimensions();
  const blocks: Block[] = Array.isArray(v2.blocks) ? v2.blocks : [];
  const title = v2.title || "Séance FKS";
  const subtitle = v2.subtitle;

  const [checkedSets, setCheckedSets] = useState<Record<string, boolean[]>>({});
  const [activeBlock, setActiveBlock] = useState(0);

  const [sessionRunning, setSessionRunning] = useState(false);
  const [sessionSec, setSessionSec] = useState(0);
  const sessionRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [restRunning, setRestRunning] = useState(false);
  const [restSec, setRestSec] = useState(0);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [restSource, setRestSource] = useState<"auto" | "manual" | null>(null);
  const blockWidth = useMemo(() => Math.max(280, width - 32), [width]);
  const itemSize = blockWidth + ITEM_SPACING;
  const scrollX = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const restOverlay = useRef(new Animated.Value(0)).current;
  const pulseMap = useRef<Record<string, Animated.Value>>({});
  const listRef = useRef<any>(null);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index?: number | null }> }) => {
      const index = viewableItems[0]?.index ?? 0;
      setActiveBlock(index);
    }
  ).current;
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 70 }).current;
  const coachTip = useMemo(
    () => getCoachTip(blocks[activeBlock], activeBlock),
    [blocks, activeBlock]
  );
  const timerPresets = useMemo(() => {
    const globalRaw = Array.isArray(v2.display?.timer_presets) ? v2.display?.timer_presets : [];
    const blockRaw = Array.isArray(blocks[activeBlock]?.timer_presets)
      ? blocks[activeBlock]?.timer_presets ?? []
      : [];
    const source = blockRaw.length > 0 ? blockRaw : globalRaw;
    const unique = new Set<string>();
    return source
      .map((preset) => ({
        label: preset.label ?? null,
        work_s: typeof preset.work_s === "number" ? preset.work_s : null,
        rest_s: typeof preset.rest_s === "number" ? preset.rest_s : null,
        rounds: typeof preset.rounds === "number" ? preset.rounds : null,
      }))
      .filter((preset) => preset.label || (preset.work_s != null && preset.rest_s != null))
      .filter((preset) => {
        const key = `${preset.label ?? ""}|${preset.work_s ?? ""}|${preset.rest_s ?? ""}|${preset.rounds ?? ""}`;
        if (unique.has(key)) return false;
        unique.add(key);
        return true;
      })
      .slice(0, 4);
  }, [v2.display?.timer_presets, blocks, activeBlock]);
  const enterTranslate = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  const playRestSignal = React.useCallback(() => {
    if (soundsEnabled && Platform.OS === "web") {
      const AudioContext =
        (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
        osc.onended = () => ctx.close();
        return;
      }
    }
    if (hapticsEnabled && Platform.OS !== "web") {
      Vibration.vibrate([0, 120, 80, 120]);
    }
  }, [soundsEnabled, hapticsEnabled]);

  const getPulse = (key: string) => {
    if (!pulseMap.current[key]) {
      pulseMap.current[key] = new Animated.Value(1);
    }
    return pulseMap.current[key];
  };

  const triggerPulse = (key: string) => {
    const pulse = getPulse(key);
    pulse.setValue(0.86);
    Animated.sequence([
      Animated.spring(pulse, { toValue: 1.08, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (sessionRunning) {
      sessionRef.current = setInterval(() => {
        setSessionSec((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (sessionRef.current) {
        clearInterval(sessionRef.current);
        sessionRef.current = null;
      }
    };
  }, [sessionRunning]);

  useEffect(() => {
    if (restRunning) {
      restRef.current = setInterval(() => {
        setRestSec((s) => {
          if (s <= 1) {
            setRestRunning(false);
            setRestSource(null);
            playRestSignal();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (restRef.current) {
        clearInterval(restRef.current);
        restRef.current = null;
      }
    };
  }, [restRunning, playRestSignal]);

  useEffect(() => {
    Animated.timing(restOverlay, {
      toValue: restRunning ? 1 : 0,
      duration: restRunning ? 180 : 140,
      useNativeDriver: true,
    }).start();
  }, [restRunning, restOverlay]);

  useEffect(() => {
    if (blocks.length <= 1) return;
    if (Platform.OS === "web") return;
    if (!hapticsEnabled) return;
    Vibration.vibrate(30);
  }, [activeBlock, blocks.length, hapticsEnabled]);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const getItemKey = (blockIndex: number, itemIndex: number) =>
    `${blockIndex}-${itemIndex}`;

  const getSetCount = (item: BlockItem) => {
    const raw = typeof item?.sets === "number" ? item.sets : 1;
    const normalized = Number.isFinite(raw) ? Math.round(raw) : 1;
    return Math.max(1, normalized);
  };

  const getSetState = (
    state: Record<string, boolean[]>,
    key: string,
    total: number
  ) => {
    const current = state[key] ?? [];
    if (current.length === total) return current;
    const next = Array.from({ length: total }, (_, idx) => !!current[idx]);
    return next;
  };

  const getItemProgress = (
    state: Record<string, boolean[]>,
    blockIndex: number,
    itemIndex: number,
    item: BlockItem
  ) => {
    const total = getSetCount(item);
    const key = getItemKey(blockIndex, itemIndex);
    const sets = getSetState(state, key, total);
    const done = sets.filter(Boolean).length;
    return { total, done, sets, complete: done >= total };
  };

  const totalItems = useMemo(() => {
    return blocks.reduce((acc, block) => {
      return (
        acc +
        (block.items ?? []).reduce((sum, item) => sum + getSetCount(item), 0)
      );
    }, 0);
  }, [blocks]);

  const completedItems = useMemo(() => {
    return blocks.reduce((acc, block, blockIndex) => {
      const items = block.items ?? [];
      const done = items.reduce((sum, item, itemIndex) => {
        return sum + getItemProgress(checkedSets, blockIndex, itemIndex, item).done;
      }, 0);
      return acc + done;
    }, 0);
  }, [blocks, checkedSets]);

  const progress = totalItems > 0 ? completedItems / totalItems : 0;

  const parseRestFromText = (text?: string | null) => {
    if (!text) return null;
    const cleaned = text.toLowerCase().replace(",", ".");
    const split = cleaned.split("/");
    const candidate = split.length >= 2 ? split[1] : cleaned;
    const match = candidate.match(/(\d+)/);
    if (!match) return null;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const getAutoRestSeconds = (item: BlockItem) => {
    if (Array.isArray(item?.work_rest_sec) && item.work_rest_sec.length >= 2) {
      const rest = Number(item.work_rest_sec[1]);
      return Number.isFinite(rest) ? rest : null;
    }
    if (typeof item?.rest_s === "number" && Number.isFinite(item.rest_s)) {
      return item.rest_s;
    }
    const parsed = parseRestFromText(item?.work_rest);
    return parsed;
  };

  const startRest = (seconds: number, source: "auto" | "manual" = "manual") => {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    setRestSource(source);
    setRestSec(Math.max(1, Math.round(seconds)));
    setRestRunning(true);
  };

  const isItemComplete = (
    state: Record<string, boolean[]>,
    blockIndex: number,
    itemIndex: number,
    item: BlockItem
  ) => getItemProgress(state, blockIndex, itemIndex, item).complete;

  const toggleSet = (
    blockIndex: number,
    itemIndex: number,
    setIndex: number,
    item: BlockItem,
    items: BlockItem[]
  ) => {
    const key = getItemKey(blockIndex, itemIndex);
    const total = getSetCount(item);
    setCheckedSets((prev) => {
      const current = getSetState(prev, key, total);
      const nextValue = !current[setIndex];
      const nextSets = [...current];
      nextSets[setIndex] = nextValue;
      const next = { ...prev, [key]: nextSets };
      if (nextValue) {
        triggerPulse(key);
        if (hapticsEnabled && Platform.OS !== "web") Vibration.vibrate(14);
        if (!sessionRunning) setSessionRunning(true);
        const restAuto = getAutoRestSeconds(item);
        if (restAuto) startRest(restAuto, "auto");
        const isComplete =
          items.length > 0 &&
          items.every((it, idx) => isItemComplete(next, blockIndex, idx, it));
        if (isComplete && blockIndex < blocks.length - 1) {
          const nextIndex = blockIndex + 1;
          requestAnimationFrame(() => {
            listRef.current?.scrollToIndex?.({ index: nextIndex, animated: true });
          });
          if (hapticsEnabled && Platform.OS !== "web") Vibration.vibrate(35);
        }
      }
      return next;
    });
  };

  const isBlockComplete = (blockIndex: number, items: BlockItem[] = []) => {
    if (items.length === 0) return false;
    return items.every((item, idx) =>
      isItemComplete(checkedSets, blockIndex, idx, item)
    );
  };

  useEffect(() => {
    if (!blocks.length) return;
    if (activeBlock >= blocks.length) setActiveBlock(0);
  }, [blocks, activeBlock]);

  const formatItemMeta = (item: BlockItem) => {
    const parts: string[] = [];
    if (item?.sets != null && item.sets > 0) parts.push(`${item.sets}x`);
    if (item?.reps != null && item.reps > 0) parts.push(`${item.reps} reps`);
    if (Array.isArray(item?.work_rest_sec) && item.work_rest_sec.length >= 2) {
      const [w, r] = item.work_rest_sec;
      parts.push(`${w ?? "?"}s/${r ?? "?"}s`);
    } else if (item?.work_s || item?.rest_s) {
      if (item.work_s) parts.push(`${item.work_s}s`);
      if (item.rest_s) parts.push(`/${item.rest_s}s`);
    } else if (item?.work_rest && item.work_rest.trim().length > 0) {
      parts.push(item.work_rest.trim());
    }
    if (item?.duration_per_set_sec) parts.push(`${item.duration_per_set_sec}s / série`);
    if (item?.duration_min) parts.push(`${item.duration_min} min`);
    return parts.join(" · ");
  };

  const getDisplayName = (item: BlockItem) => {
    const displayNameRaw = (item?.name || "").trim();
    const fallbackId =
      typeof (item as any)?.exercise_id === "string" && (item as any).exercise_id.trim()
        ? (item as any).exercise_id.trim()
        : typeof (item as any)?.id === "string" && (item as any).id.trim()
          ? (item as any).id.trim()
          : undefined;
    const displayName =
      displayNameRaw.length > 0
        ? prettifyName(displayNameRaw)
        : fallbackId
          ? prettifyName(fallbackId)
          : item?.modality
            ? prettifyName(String(item.modality))
            : "Exercice";
    return displayName;
  };

  const getExerciseId = (item: BlockItem) => {
    if (typeof (item as any)?.exercise_id === "string" && (item as any).exercise_id.trim()) {
      return (item as any).exercise_id.trim();
    }
    if (typeof (item as any)?.id === "string" && (item as any).id.trim()) {
      return (item as any).id.trim();
    }
    return null;
  };

  const finishLabel = sessionId
    ? "Terminer et donner le feedback"
    : "Terminer la séance";

  const finishAction = () => {
    const estimatedRpe = (() => {
      if (typeof v2.rpe_target === "number" && Number.isFinite(v2.rpe_target)) {
        return Math.max(1, Math.min(10, Math.round(v2.rpe_target)));
      }
      const intensity = (v2.intensity ?? "").toLowerCase();
      if (intensity.includes("hard")) return 8;
      if (intensity.includes("easy")) return 4;
      return 6;
    })();
    const durationMin =
      sessionSec >= 60
        ? Math.max(5, Math.round(sessionSec / 60))
        : typeof v2.duration_min === "number"
          ? Math.round(v2.duration_min)
          : undefined;
    const intensity = typeof v2.intensity === "string" ? v2.intensity : undefined;
    const focusRaw = v2.focus_primary ?? v2.focus_secondary;
    const focus = typeof focusRaw === "string" ? focusRaw : undefined;
    const location = typeof v2.location === "string" ? v2.location : undefined;
    const summary = {
      title,
      subtitle,
      plannedDateISO,
      completedItems,
      totalItems,
      durationMin,
      rpe: estimatedRpe,
      intensity,
      focus,
      location,
      srpe:
        typeof v2?.estimated_load?.srpe === "number" && Number.isFinite(v2.estimated_load.srpe)
          ? v2.estimated_load.srpe
          : undefined,
    };
    nav.navigate("SessionSummary", {
      sessionId,
      summary,
    });
  };

  const goToExercise = (exerciseId: string | null) => {
    if (!exerciseId) return;
    nav.navigate("ExerciseDetail", { highlightId: exerciseId });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Animated.View
            style={[
              styles.content,
              { opacity: enter, transform: [{ translateY: enterTranslate }] },
            ]}
          >
            <Card variant="surface" style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={2}>{title}</Text>
                  {subtitle ? <Text style={styles.subtitle} numberOfLines={3}>{subtitle}</Text> : null}
                </View>
                <Badge label={plannedDateISO} />
              </View>

              <View style={styles.tagRow}>
                {v2.intensity ? (
                  <Badge label={v2.intensity} tone={intensityTone(v2.intensity)} />
                ) : null}
                {v2.focus_primary ? <Badge label={v2.focus_primary} /> : null}
                {v2.duration_min ? <Badge label={`${v2.duration_min} min`} /> : null}
                {v2.rpe_target ? <Badge label={`RPE ${v2.rpe_target}`} /> : null}
                {v2.location ? <Badge label={v2.location} /> : null}
              </View>

              <View style={styles.progressWrap}>
                <Text style={styles.progressLabel}>
                  Progression : {completedItems}/{totalItems || "—"} séries
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
              </View>
            </Card>

            <Card variant="soft" style={styles.timerCard}>
              <SectionHeader title="Chronos" />
              <View style={styles.timerRow}>
                <View style={styles.timerBlock}>
                  <Text style={styles.timerLabel}>Séance</Text>
                  <Text style={styles.timerValue}>{formatTime(sessionSec)}</Text>
                </View>
                <View style={styles.timerBlock}>
                  <Text style={styles.timerLabel}>Repos</Text>
                  <Text style={styles.timerValue}>{formatTime(restSec)}</Text>
                </View>
              </View>

              <View style={styles.timerActions}>
                <Button
                  label={sessionRunning ? "Pause" : "Démarrer"}
                  onPress={() => setSessionRunning((v) => !v)}
                  size="sm"
                  variant={sessionRunning ? "secondary" : "primary"}
                  style={styles.timerButton}
                />
                <Button
                  label="Réinit"
                  onPress={() => {
                    setSessionRunning(false);
                    setSessionSec(0);
                  }}
                  size="sm"
                  variant="ghost"
                  style={styles.timerButton}
                />
              </View>

              <View style={styles.restRow}>
                {[30, 60, 90].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.restChip}
                    onPress={() => startRest(s, "manual")}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.restChipText}>{s}s</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.restChip, styles.restChipGhost]}
                  onPress={() => {
                    setRestRunning(false);
                    setRestSec(0);
                    setRestSource(null);
                  }}
                >
                  <Text style={styles.restChipGhostText}>Stop</Text>
                </TouchableOpacity>
              </View>
              {timerPresets.length > 0 ? (
                <View style={styles.presetRow}>
                  {timerPresets.map((preset, idx) => (
                    <TouchableOpacity
                      key={`preset_${idx}`}
                      style={styles.restChip}
                      onPress={() => {
                        const rest = Number(preset.rest_s);
                        if (Number.isFinite(rest) && rest > 0) {
                          startRest(rest, "manual");
                        }
                      }}
                    >
                      <Text style={styles.restChipText}>{formatPresetLabel(preset)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </Card>

            <SectionHeader
              title="Bloc en cours"
              right={<Badge label={`${Math.min(activeBlock + 1, blocks.length)}/${blocks.length}`} />}
            />
            <Text style={styles.swipeHint}>Swipe pour passer au bloc suivant.</Text>

            <Animated.FlatList
              ref={listRef}
              data={blocks}
              horizontal
              keyExtractor={(_, index) => `block_${index}`}
              renderItem={({ item: block, index: blockIndex }) => {
                const items = block.items ?? [];
                const blockTitle =
                  block.goal || block.name || block.type || block.focus || `Bloc ${blockIndex + 1}`;
                const isComplete = isBlockComplete(blockIndex, items);
                const inputRange = [
                  (blockIndex - 1) * itemSize,
                  blockIndex * itemSize,
                  (blockIndex + 1) * itemSize,
                ];
                const scale = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.94, 1, 0.94],
                  extrapolate: "clamp",
                });
                const opacity = scrollX.interpolate({
                  inputRange,
                  outputRange: [0.6, 1, 0.6],
                  extrapolate: "clamp",
                });
                return (
                  <Animated.View
                    style={[
                      styles.blockCardWrap,
                      { width: blockWidth, opacity, transform: [{ scale }] },
                    ]}
                  >
                    <Card variant="surface" style={styles.blockCard}>
                      <View style={styles.blockHeader}>
                        <View>
                          <Text style={styles.blockTitle} numberOfLines={2}>{blockTitle}</Text>
                          <Text style={styles.blockMeta}>
                            {block.intensity ?? "—"} · {block.duration_min ?? "?"} min
                          </Text>
                        </View>
                        {isComplete ? <Badge label="OK" tone="ok" /> : null}
                      </View>

                      {items.length === 0 ? (
                        <Text style={styles.blockEmpty}>Bloc sans items détaillés.</Text>
                      ) : (
                        <View style={{ gap: 10 }}>
                          {items.map((item, itemIndex) => {
                            const key = getItemKey(blockIndex, itemIndex);
                            const itemProgress = getItemProgress(
                              checkedSets,
                              blockIndex,
                              itemIndex,
                              item
                            );
                            const checkedItem = itemProgress.complete;
                            const itemName = getDisplayName(item);
                            const meta = formatItemMeta(item);
                            const exerciseId = getExerciseId(item);
                            const pulse = getPulse(key);
                            const setCount = itemProgress.total;
                            const doneSets = itemProgress.done;
                            const setState = itemProgress.sets;
                            return (
                              <View key={key} style={styles.itemRow}>
                                <View style={styles.itemMain}>
                                  {setCount <= 1 ? (
                                    <TouchableOpacity
                                      onPress={() =>
                                        toggleSet(blockIndex, itemIndex, 0, item, items)
                                      }
                                      activeOpacity={0.85}
                                    >
                                      <Animated.View
                                        style={[
                                          styles.checkbox,
                                          checkedItem && styles.checkboxChecked,
                                          { transform: [{ scale: pulse }] },
                                        ]}
                                      >
                                        {checkedItem ? (
                                          <Text style={styles.checkboxIcon}>✓</Text>
                                        ) : null}
                                      </Animated.View>
                                    </TouchableOpacity>
                                  ) : (
                                    <View style={styles.setsWrap}>
                                      <Text style={styles.setsLabel}>
                                        {doneSets}/{setCount} séries
                                      </Text>
                                      <View style={styles.setsRow}>
                                        {setState.map((done, setIndex) => (
                                          <TouchableOpacity
                                            key={`${key}-set-${setIndex}`}
                                            onPress={() =>
                                              toggleSet(
                                                blockIndex,
                                                itemIndex,
                                                setIndex,
                                                item,
                                                items
                                              )
                                            }
                                            style={[
                                              styles.setChip,
                                              done && styles.setChipDone,
                                            ]}
                                            activeOpacity={0.85}
                                          >
                                            <Text
                                              style={[
                                                styles.setChipText,
                                                done && styles.setChipTextDone,
                                              ]}
                                            >
                                              {setIndex + 1}
                                            </Text>
                                          </TouchableOpacity>
                                        ))}
                                      </View>
                                    </View>
                                  )}
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.itemName} numberOfLines={2}>{itemName}</Text>
                                    {item.description ? (
                                      <Text style={styles.itemNote}>{item.description}</Text>
                                    ) : null}
                                    {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                                    {item.football_context ? (
                                      <Text style={styles.itemContext}>{item.football_context}</Text>
                                    ) : null}
                                    {cleanDisplayNote(item.notes) ? (
                                      <Text style={styles.itemNote}>{cleanDisplayNote(item.notes)}</Text>
                                    ) : null}
                                  </View>
                                </View>
                                {exerciseId ? (
                                  <TouchableOpacity
                                    onPress={() => goToExercise(exerciseId)}
                                    activeOpacity={0.85}
                                    style={styles.itemLink}
                                  >
                                    <Text style={styles.itemLinkText}>Fiche</Text>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </Card>
                  </Animated.View>
                );
              }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              snapToInterval={itemSize}
              decelerationRate="fast"
              snapToAlignment="start"
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={(_, index) => ({
                length: itemSize,
                offset: itemSize * index,
                index,
              })}
              onScrollToIndexFailed={({ index }) => {
                const fallbackOffset = Math.max(0, index * itemSize);
                requestAnimationFrame(() => {
                  listRef.current?.scrollToOffset?.({ offset: fallbackOffset, animated: true });
                });
              }}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: true }
              )}
              scrollEventThrottle={16}
            />

            <View style={styles.dotsRow}>
              {blocks.map((_, idx) => {
                const done = isBlockComplete(idx, blocks[idx]?.items ?? []);
                const isActive = idx === activeBlock;
                return (
                  <View
                    key={`dot_${idx}`}
                    style={[
                      styles.dot,
                      done && styles.dotDone,
                      isActive && styles.dotActive,
                    ]}
                  />
                );
              })}
            </View>

            {blocks.length > 0 ? (
              <Card variant="soft" style={styles.coachMiniCard}>
                <SectionHeader title={`Focus bloc ${Math.min(activeBlock + 1, blocks.length)}`} />
                <Text style={styles.coachMiniText}>{coachTip}</Text>
              </Card>
            ) : null}

            {Array.isArray(v2.coaching_tips) && v2.coaching_tips.length > 0 ? (
              <Card variant="soft" style={styles.coachCard}>
                <SectionHeader title="Coaching rapide" />
                <View style={{ gap: 6 }}>
                  {v2.coaching_tips.map((tip: string, i: number) => (
                    <Text key={`coach_${i}`} style={styles.coachText}>
                      • {tip}
                    </Text>
                  ))}
                </View>
              </Card>
            ) : null}

            <Button label={finishLabel} onPress={finishAction} fullWidth size="lg" />
          </Animated.View>
        </ScrollView>

        <Animated.View
          pointerEvents={restRunning ? "auto" : "none"}
          style={[
            styles.restOverlay,
            {
              opacity: restOverlay,
              transform: [
                {
                  scale: restOverlay.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.restOverlayCard}>
            <Text style={styles.restOverlayTitle}>
              {restSource === "auto" ? "Repos auto" : "Repos"}
            </Text>
            <Text style={styles.restOverlayTime}>{formatTime(restSec)}</Text>
            <View style={styles.restOverlayActions}>
              <Button
                label="Passer"
                onPress={() => {
                  setRestRunning(false);
                  setRestSec(0);
                  setRestSource(null);
                }}
                size="sm"
                variant="ghost"
              />
            </View>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

// Export avec Error Boundary pour éviter les crashs
export default withSessionErrorBoundary(SessionLiveScreen);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  root: { flex: 1 },
  container: { padding: 16 },
  content: { gap: 16 },
  heroCard: { padding: 16, gap: 12 },
  heroTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "800", color: palette.text },
  subtitle: { fontSize: 13, color: palette.sub, marginTop: 4 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  progressWrap: { gap: 6 },
  progressLabel: { color: palette.sub, fontSize: 12 },
  progressTrack: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.borderSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: palette.accent,
  },
  timerCard: { padding: 14, gap: 12 },
  timerRow: { flexDirection: "row", gap: 12 },
  timerBlock: { flex: 1 },
  timerLabel: { color: palette.sub, fontSize: 12 },
  timerValue: { color: palette.text, fontSize: 22, fontWeight: "800" },
  timerActions: { flexDirection: "row", gap: 10 },
  timerButton: { flex: 1 },
  restRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  presetRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  restChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  restChipGhost: {
    backgroundColor: palette.accentSoft,
    borderColor: palette.accent,
  },
  restChipText: { color: palette.text, fontWeight: "600", fontSize: 12 },
  restChipGhostText: { color: palette.accent, fontWeight: "700", fontSize: 12 },
  restOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(9, 11, 16, 0.55)",
  },
  restOverlayCard: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: palette.card,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    minWidth: 180,
  },
  restOverlayTitle: {
    color: palette.sub,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  restOverlayTime: {
    color: palette.text,
    fontSize: 32,
    fontWeight: "800",
  },
  restOverlayActions: { marginTop: 4, alignSelf: "stretch" },
  swipeHint: { color: palette.sub, fontSize: 12, marginTop: -6 },
  blockCardWrap: { marginBottom: 2 },
  blockCard: { padding: 14, gap: 10 },
  blockHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  blockTitle: { color: palette.text, fontSize: 15, fontWeight: "700" },
  blockMeta: { color: palette.sub, fontSize: 12, marginTop: 2 },
  blockEmpty: { color: palette.sub, fontSize: 12 },
  itemRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  itemMain: { flex: 1, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  setsWrap: { minWidth: 70, alignItems: "flex-start", gap: 6 },
  setsLabel: { fontSize: 10, color: palette.sub, fontWeight: "600" },
  setsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  setChip: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.card,
  },
  setChipDone: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  setChipText: { fontSize: 10, color: palette.sub, fontWeight: "700" },
  setChipTextDone: { color: palette.bg },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  checkboxIcon: { color: palette.bg, fontSize: 12, fontWeight: "800" },
  itemName: { color: palette.text, fontSize: 14, fontWeight: "600" },
  itemMeta: { color: palette.sub, fontSize: 12, marginTop: 2 },
  itemContext: { color: palette.text, fontSize: 11, marginTop: 2 },
  itemNote: { color: palette.sub, fontSize: 12, marginTop: 2 },
  itemLink: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  itemLinkText: { color: palette.accent, fontSize: 11, fontWeight: "700" },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: -6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
  },
  dotActive: {
    width: 10,
    backgroundColor: palette.accent,
  },
  dotDone: {
    backgroundColor: palette.success,
  },
  coachMiniCard: { padding: 12, gap: 6 },
  coachMiniText: { color: palette.sub, fontSize: 12, lineHeight: 18 },
  coachCard: { padding: 14, gap: 10 },
  coachText: { color: palette.sub, fontSize: 12, lineHeight: 18 },
});
