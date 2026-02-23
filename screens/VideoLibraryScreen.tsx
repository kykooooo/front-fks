// screens/VideoLibraryScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Pressable,
  Linking,
  Alert,
  Animated,
} from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/theme";
import { showToast } from "../utils/toast";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Card } from "../components/ui/Card";
import { ModalContainer } from "../components/modal/ModalContainer";
import { Badge } from "../components/ui/Badge";
import { useTrainingStore } from "../state/trainingStore";
import {
  EXERCISE_BANK,
  EXERCISE_BY_ID,
  type ExerciseDef,
  type ExerciseTag,
  type BankModality,
  type BankIntensity,
} from "../engine/exerciseBank";
import { EXERCISE_INSTRUCTIONS } from "../engine/exerciseInstructions";
import { getExerciseVideoRef } from "../engine/exerciseVideos";

type VideoLibraryRoute = RouteProp<
  { VideoLibrary: { highlightId?: string; startInFavorites?: boolean } | undefined },
  "VideoLibrary"
>;
type CategoryView = BankModality | "favorites";
type SortMode = "favorites" | "alpha" | "recent";

const MODALITY_LABELS: Record<BankModality, string> = {
  run: "Course",
  circuit: "Circuit",
  strength: "Force",
  plyo: "Plyo",
  cod: "Agilité",
  core: "Core",
  mobility: "Mobilité",
};

const MODALITY_DESCRIPTIONS: Record<BankModality, string> = {
  run: "Endurance, tempo, vitesse.",
  circuit: "Full body, cardio + force.",
  strength: "Force et prévention.",
  plyo: "Explosivité et appuis.",
  cod: "Agilité et changements.",
  core: "Gainage et stabilité.",
  mobility: "Amplitude et récupération.",
};

// ─── Couleurs et icônes par modalité ───
const MODALITY_CONFIG: Record<
  BankModality | "favorites",
  { icon: string; tint: string; tintSoft: string }
> = {
  favorites: { icon: "star", tint: "#ff7a1a", tintSoft: "rgba(255,122,26,0.12)" },
  run: { icon: "footsteps-outline", tint: "#2563eb", tintSoft: "rgba(37,99,235,0.10)" },
  circuit: { icon: "flash-outline", tint: "#ff7a1a", tintSoft: "rgba(255,122,26,0.10)" },
  strength: { icon: "barbell-outline", tint: "#ef4444", tintSoft: "rgba(239,68,68,0.10)" },
  plyo: { icon: "rocket-outline", tint: "#8b5cf6", tintSoft: "rgba(139,92,246,0.10)" },
  cod: { icon: "git-branch-outline", tint: "#16a34a", tintSoft: "rgba(22,163,74,0.10)" },
  core: { icon: "shield-outline", tint: "#06b6d4", tintSoft: "rgba(6,182,212,0.10)" },
  mobility: { icon: "body-outline", tint: "#14b8a6", tintSoft: "rgba(20,184,166,0.10)" },
};

const INTENSITY_LABELS: Record<BankIntensity, string> = {
  low: "Facile",
  moderate: "Modéré",
  high: "Élevé",
};

const SORT_LABELS: Record<SortMode, string> = {
  favorites: "Favoris",
  alpha: "A-Z",
  recent: "Récents",
};

const TAG_LABELS: Record<ExerciseTag, string> = {
  sprint: "Vitesse",
  plyo: "Plyo",
  heavy_lower: "Force bas",
  heavy_upper: "Force haut",
  overhead: "Overhead",
  cuts: "Changements",
  impact: "Impact",
  knee_stress: "Genou",
  ankle_stress: "Cheville",
  hamstring_load: "Ischios",
  quad_load: "Quadris",
  calf_load: "Mollets",
  hip_load: "Hanches",
  shoulder_load: "Épaules",
  spine_load: "Colonne",
  jump: "Sauts",
  tempo: "Tempo",
  technique: "Technique",
  mobility: "Mobilité",
};

type EquipmentKey =
  | "bodyweight"
  | "dumbbell"
  | "barbell"
  | "band"
  | "machine"
  | "kettlebell"
  | "box"
  | "bench"
  | "trx"
  | "bike"
  | "rower";

const EQUIPMENT_LABELS: Record<EquipmentKey, string> = {
  bodyweight: "Sans matériel",
  dumbbell: "Haltère",
  barbell: "Barre",
  band: "Élastique",
  machine: "Machine",
  kettlebell: "Kettlebell",
  box: "Box",
  bench: "Banc",
  trx: "TRX",
  bike: "Vélo",
  rower: "Rameur",
};

const EQUIPMENT_ORDER: EquipmentKey[] = [
  "bodyweight", "dumbbell", "barbell", "kettlebell", "band",
  "machine", "box", "bench", "trx", "bike", "rower",
];

const MODALITY_ORDER: BankModality[] = [
  "run", "plyo", "strength", "cod", "circuit", "core", "mobility",
];

const TAG_ORDER: ExerciseTag[] = [
  "sprint", "plyo", "jump", "tempo", "technique",
  "heavy_lower", "heavy_upper", "cuts", "impact",
  "knee_stress", "ankle_stress", "hamstring_load", "quad_load",
  "calf_load", "hip_load", "shoulder_load", "spine_load", "mobility",
];

const intensityTone = (intensity: BankIntensity) => {
  if (intensity === "high") return "danger";
  if (intensity === "moderate") return "warn";
  return "ok";
};

const inferEquipment = (item: ExerciseDef): EquipmentKey[] => {
  const id = item.id.toLowerCase();
  const equip = new Set<EquipmentKey>();
  if (id.includes("db_") || id.includes("_db")) equip.add("dumbbell");
  if (
    id.includes("bb_") || id.includes("_bb") || id.includes("bench_press") ||
    id.includes("back_squat") || id.includes("front_squat") ||
    id.includes("deadlift") || id.includes("rdl_bar")
  ) equip.add("barbell");
  if (id.includes("kb_") || id.includes("_kb")) equip.add("kettlebell");
  if (id.includes("band") || id.includes("elastic")) equip.add("band");
  if (id.includes("machine") || id.includes("cable") || id.includes("pulldown")) equip.add("machine");
  if (id.includes("trx")) equip.add("trx");
  if (id.includes("box") || id.includes("step_up") || id.includes("step_down")) equip.add("box");
  if (id.includes("bench") || id.includes("floor_press")) equip.add("bench");
  if (id.startsWith("bike_")) equip.add("bike");
  if (id.startsWith("row_")) equip.add("rower");
  if (equip.size === 0) equip.add("bodyweight");
  return Array.from(equip);
};

const isBallExercise = (item: ExerciseDef) => {
  const id = item.id.toLowerCase();
  return (
    id.includes("football") ||
    id.includes("medball") ||
    id.startsWith("mb_") ||
    id.includes("swiss_ball") ||
    id.includes("fitball") ||
    id.includes("medicine_ball")
  );
};

const formatDefaults = (item: ExerciseDef) => {
  const parts: string[] = [];
  if (item.defaultSets) parts.push(`${item.defaultSets} séries`);
  if (item.defaultDurationMin) parts.push(`${item.defaultDurationMin} min`);
  return parts.join(" · ");
};

// ─── Composants internes ───

function CategoryCard({
  modality,
  label,
  description,
  count,
  onPress,
  animDelay,
}: {
  modality: BankModality | "favorites";
  label: string;
  description: string;
  count: number;
  onPress: () => void;
  animDelay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 280,
      delay: animDelay,
      useNativeDriver: true,
    }).start();
  }, []);

  const config = MODALITY_CONFIG[modality];
  return (
    <Animated.View
      style={{
        width: "48%",
        opacity: anim,
        transform: [{
          translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
        }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[styles.categoryCard, { borderColor: config.tint + "30" }]}
      >
        <View style={[styles.categoryIcon, { backgroundColor: config.tintSoft }]}>
          <Ionicons name={config.icon as any} size={20} color={config.tint} />
        </View>
        <View style={styles.categoryContent}>
          <Text style={styles.categoryLabel}>{label}</Text>
          <Text style={styles.categoryDescription} numberOfLines={1}>
            {description}
          </Text>
        </View>
        <Badge
          label={`${count}`}
          tone={modality === "favorites" && count > 0 ? "ok" : "default"}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const ExerciseListCard = React.memo(function ExerciseListCard({
  item,
  isFavorite,
  isHighlighted,
  onPress,
  onToggleFavorite,
  onOpenVideo,
}: {
  item: ExerciseDef;
  isFavorite: boolean;
  isHighlighted: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  onOpenVideo: () => void;
}) {
  const config = MODALITY_CONFIG[item.modality];
  const hasVettedVideo = getExerciseVideoRef(item.id).kind === "vetted";

  return (
    <Card
      variant="surface"
      style={[styles.exerciseCard, isHighlighted && styles.exerciseCardHighlight]}
    >
      <View style={[styles.accentBar, { backgroundColor: config.tint }]} />
      <View style={styles.exerciseInner}>
        <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.exercisePressArea}>
          <View style={styles.exerciseTitleRow}>
            <View style={styles.exerciseNameRow}>
              <Ionicons name={config.icon as any} size={14} color={config.tint} />
              <Text style={styles.exerciseName} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
            <Badge label={INTENSITY_LABELS[item.intensity]} tone={intensityTone(item.intensity)} />
          </View>
          <Text style={styles.exerciseMeta} numberOfLines={1}>
            {MODALITY_LABELS[item.modality]}
            {formatDefaults(item) ? ` · ${formatDefaults(item)}` : ""}
          </Text>
        </TouchableOpacity>

        <View style={styles.exerciseFooter}>
          {hasVettedVideo ? (
            <View style={styles.videoPill}>
              <Ionicons name="videocam" size={11} color={theme.colors.accent} />
              <Text style={styles.videoPillText}>Vidéo</Text>
            </View>
          ) : (
            <View />
          )}
          <View style={styles.footerActions}>
            <TouchableOpacity
              onPress={onToggleFavorite}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.iconButton, isFavorite && styles.iconButtonActive]}
            >
              <Ionicons
                name={isFavorite ? "star" : "star-outline"}
                size={15}
                color={isFavorite ? theme.colors.accent : theme.colors.sub}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={onOpenVideo} activeOpacity={0.85} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.iconButton}>
              <Ionicons name="logo-youtube" size={15} color={theme.colors.sub} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Card>
  );
});

// ─── Écran principal ───

export default function VideoLibraryScreen() {
  const route = useRoute<VideoLibraryRoute>();
  const highlightId = route.params?.highlightId ?? null;
  const startInFavorites = route.params?.startInFavorites ?? false;
  const [activeHighlightId, setActiveHighlightId] = useState<string | null>(highlightId);
  const [activeCategory, setActiveCategory] = useState<CategoryView | null>(null);
  const [query, setQuery] = useState("");
  const [selectedModalities, setSelectedModalities] = useState<BankModality[]>([]);
  const [selectedIntensity, setSelectedIntensity] = useState<BankIntensity | null>(null);
  const [selectedTags, setSelectedTags] = useState<ExerciseTag[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentKey[]>([]);
  const [videoOnly, setVideoOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("favorites");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailExerciseId, setDetailExerciseId] = useState<string | null>(null);
  const favoriteExerciseIds = useTrainingStore((s) => s.favoriteExerciseIds ?? []);
  const recentExerciseIds = useTrainingStore((s) => s.recentExerciseIds ?? []);
  const toggleFavoriteExercise = useTrainingStore((s) => s.toggleFavoriteExercise);
  const addRecentExercise = useTrainingStore((s) => s.addRecentExercise);

  // Entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(headerAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(searchAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const favoriteSet = useMemo(() => new Set(favoriteExerciseIds), [favoriteExerciseIds]);
  const visibleBank = useMemo(
    () => EXERCISE_BANK.filter((item) => !isBallExercise(item)),
    []
  );
  const recentRank = useMemo(() => {
    const map = new Map<string, number>();
    recentExerciseIds.forEach((id, idx) => map.set(id, idx));
    return map;
  }, [recentExerciseIds]);
  const isFavoritesView = activeCategory === "favorites";
  const showResults = Boolean(activeCategory) || normalizedQuery.length > 0;
  const activeFilters =
    (normalizedQuery ? 1 : 0) +
    (selectedIntensity ? 1 : 0) +
    selectedTags.length +
    selectedEquipment.length +
    (videoOnly ? 1 : 0) +
    (sortMode === "favorites" ? 0 : 1);

  const filtered = useMemo(() => {
    return visibleBank.filter((item) => {
      const instruction = EXERCISE_INSTRUCTIONS[item.id];
      const instructionText = instruction
        ? `${instruction.howTo} ${instruction.cues.join(" ")}`.toLowerCase()
        : "";
      const hasVideo = getExerciseVideoRef(item.id).kind === "vetted";
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.id.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        instructionText.includes(normalizedQuery);
      const matchesModality =
        selectedModalities.length === 0 || selectedModalities.includes(item.modality);
      const matchesIntensity = !selectedIntensity || item.intensity === selectedIntensity;
      const matchesTags =
        selectedTags.length === 0 || selectedTags.some((tag) => item.tags.includes(tag));
      const matchesEquipment =
        selectedEquipment.length === 0 ||
        selectedEquipment.some((eq) => inferEquipment(item).includes(eq));
      const matchesVideo = !videoOnly || hasVideo;
      const matchesFavorites = !isFavoritesView || favoriteSet.has(item.id);
      return (
        matchesQuery && matchesModality && matchesIntensity &&
        matchesTags && matchesEquipment && matchesVideo && matchesFavorites
      );
    });
  }, [visibleBank, normalizedQuery, selectedModalities, selectedIntensity, selectedTags, selectedEquipment, videoOnly, isFavoritesView, favoriteSet]);

  const sortedList = useMemo(() => {
    const list = filtered.slice();
    list.sort((a, b) => {
      if (sortMode === "alpha") return a.name.localeCompare(b.name);
      if (sortMode === "recent") {
        const aRank = recentRank.get(a.id);
        const bRank = recentRank.get(b.id);
        if (aRank == null && bRank == null) return a.name.localeCompare(b.name);
        if (aRank == null) return 1;
        if (bRank == null) return -1;
        if (aRank !== bRank) return aRank - bRank;
        return a.name.localeCompare(b.name);
      }
      const aFav = favoriteSet.has(a.id) ? 1 : 0;
      const bFav = favoriteSet.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [filtered, favoriteSet, recentRank, sortMode]);

  const grouped = useMemo(() => {
    const buckets: Record<BankModality, ExerciseDef[]> = {
      run: [], circuit: [], strength: [], plyo: [], cod: [], core: [], mobility: [],
    };
    sortedList.forEach((item) => buckets[item.modality].push(item));
    return buckets;
  }, [sortedList]);

  const activeList = isFavoritesView
    ? sortedList
    : activeCategory
      ? grouped[activeCategory as BankModality] ?? []
      : [];

  const displayList = activeCategory ? activeList : sortedList;

  const toggleTag = (value: ExerciseTag) => {
    setSelectedTags((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const toggleEquipment = (value: EquipmentKey) => {
    setSelectedEquipment((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const openExercise = useCallback((exercise: ExerciseDef) => {
    setDetailExerciseId(exercise.id);
    setActiveHighlightId(exercise.id);
    addRecentExercise(exercise.id);
  }, [addRecentExercise]);

  const closeDetail = () => setDetailExerciseId(null);

  const openVideoRef = useCallback((exerciseId: string) => {
    const ref = getExerciseVideoRef(exerciseId);
    Linking.openURL(ref.url).catch(() => {
      showToast({ type: "error", title: "Vidéo indisponible", message: "Impossible d'ouvrir le lien pour l'instant." });
    });
  }, []);

  const resetFilters = () => {
    setQuery("");
    setSelectedModalities([]);
    setSelectedIntensity(null);
    setSelectedTags([]);
    setSelectedEquipment([]);
    setVideoOnly(false);
    setSortMode("favorites");
    setActiveHighlightId(null);
    setActiveCategory(null);
    setFiltersOpen(false);
  };

  useEffect(() => {
    if (!highlightId) return;
    const exercise = EXERCISE_BY_ID[highlightId];
    if (!exercise) return;
    setActiveHighlightId(highlightId);
    setQuery(exercise.name);
    setSelectedModalities([exercise.modality]);
    setActiveCategory(exercise.modality);
    setSelectedIntensity(null);
    setSelectedTags([]);
    setSelectedEquipment([]);
    addRecentExercise(highlightId);
    setDetailExerciseId(highlightId);
  }, [highlightId]);

  const getVariants = (item: ExerciseDef) => {
    const explicit = (item.variants ?? [])
      .map((id) => EXERCISE_BY_ID[id])
      .filter(Boolean) as ExerciseDef[];
    if (explicit.length > 0) return explicit;
    const candidates = visibleBank.filter(
      (other) => other.id !== item.id && other.modality === item.modality
    );
    const scored = candidates
      .map((other) => {
        const overlap = other.tags.filter((t) => item.tags.includes(t)).length;
        const intensityBoost = other.intensity === item.intensity ? 1 : 0;
        return { other, score: overlap * 2 + intensityBoost };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map((entry) => entry.other);
  };

  const getNoEquipmentVariants = (item: ExerciseDef) => {
    const equipment = inferEquipment(item);
    if (equipment.includes("bodyweight")) return [];
    return getVariants(item).filter((variant) =>
      inferEquipment(variant).includes("bodyweight")
    );
  };

  const focusCategory = (modality: BankModality) => {
    setActiveCategory(modality);
    setSelectedModalities([modality]);
    setQuery("");
    setSelectedIntensity(null);
    setSelectedTags([]);
    setSelectedEquipment([]);
    setActiveHighlightId(null);
    setFiltersOpen(false);
  };

  const focusFavorites = () => {
    setActiveCategory("favorites");
    setSelectedModalities([]);
    setQuery("");
    setSelectedIntensity(null);
    setSelectedTags([]);
    setSelectedEquipment([]);
    setActiveHighlightId(null);
    setFiltersOpen(false);
  };

  useEffect(() => {
    if (!startInFavorites || highlightId) return;
    focusFavorites();
  }, [startInFavorites, highlightId]);

  // ─── Render helpers ───

  const renderExerciseItem = useCallback(
    ({ item }: { item: ExerciseDef }) => (
      <ExerciseListCard
        item={item}
        isFavorite={favoriteSet.has(item.id)}
        isHighlighted={item.id === activeHighlightId}
        onPress={() => openExercise(item)}
        onToggleFavorite={() => toggleFavoriteExercise(item.id)}
        onOpenVideo={() => openVideoRef(item.id)}
      />
    ),
    [favoriteSet, activeHighlightId, openExercise, toggleFavoriteExercise, openVideoRef]
  );

  const keyExtractor = useCallback((item: ExerciseDef) => item.id, []);
  const itemSeparator = useCallback(() => <View style={{ height: 10 }} />, []);

  // ─── Header partagé ───
  const renderHeader = () => (
    <>
      <Animated.View
        style={{
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }}
      >
        <View style={styles.screenHeader}>
          <Text style={styles.screenKicker}>BIBLIOTHÈQUE</Text>
          <Text style={styles.screenTitle}>Exercices</Text>
        </View>
      </Animated.View>

      <Animated.View
        style={{
          opacity: searchAnim,
          transform: [{ translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        }}
      >
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={theme.colors.sub} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un exercice..."
            placeholderTextColor={theme.colors.muted}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.clearButton}>
              <Ionicons name="close" size={14} color={theme.colors.sub} />
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>
    </>
  );

  // ─── Render : vue catégories ───
  if (!showResults) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {renderHeader()}

          <SectionHeader title="Catégories" />
          <View style={styles.categoryGrid}>
            <CategoryCard
              modality="favorites"
              label="Favoris"
              description="Tes exercices sauvegardés"
              count={favoriteExerciseIds.length}
              onPress={focusFavorites}
              animDelay={0}
            />
            {MODALITY_ORDER.map((modality, idx) => {
              const count = visibleBank.filter((item) => item.modality === modality).length;
              return (
                <CategoryCard
                  key={modality}
                  modality={modality}
                  label={MODALITY_LABELS[modality]}
                  description={MODALITY_DESCRIPTIONS[modality]}
                  count={count}
                  onPress={() => focusCategory(modality)}
                  animDelay={(idx + 1) * 80}
                />
              );
            })}
          </View>
        </ScrollView>

        <ExerciseDetailModal
          visible={Boolean(detailExerciseId)}
          exerciseId={detailExerciseId}
          onClose={closeDetail}
          onToggleFavorite={(id) => toggleFavoriteExercise(id)}
          isFavorite={(id) => favoriteSet.has(id)}
          onOpenVideo={(id) => openVideoRef(id)}
          onOpenVariant={(id) => {
            const ex = EXERCISE_BY_ID[id];
            if (!ex) return;
            setDetailExerciseId(id);
            setActiveHighlightId(id);
            addRecentExercise(id);
          }}
          getVariants={getVariants}
          getNoEquipmentVariants={getNoEquipmentVariants}
          inferEquipment={inferEquipment}
        />
      </SafeAreaView>
    );
  }

  // ─── Render : vue résultats (FlatList) ───
  const resultsHeader = (
    <>
      {renderHeader()}

      <View style={styles.resultsTopBar}>
        <View style={styles.resultsHeaderRow}>
          <TouchableOpacity onPress={resetFilters} activeOpacity={0.85} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color={theme.colors.sub} />
          </TouchableOpacity>
          {activeCategory && activeCategory !== "favorites" ? (
            <View
              style={[
                styles.resultsModalityIcon,
                { backgroundColor: MODALITY_CONFIG[activeCategory as BankModality].tintSoft },
              ]}
            >
              <Ionicons
                name={MODALITY_CONFIG[activeCategory as BankModality].icon as any}
                size={16}
                color={MODALITY_CONFIG[activeCategory as BankModality].tint}
              />
            </View>
          ) : activeCategory === "favorites" ? (
            <View style={[styles.resultsModalityIcon, { backgroundColor: MODALITY_CONFIG.favorites.tintSoft }]}>
              <Ionicons name="star" size={16} color={MODALITY_CONFIG.favorites.tint} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <SectionHeader
              title={
                isFavoritesView
                  ? "Favoris"
                  : activeCategory
                    ? MODALITY_LABELS[activeCategory as BankModality]
                    : "Résultats"
              }
              right={<Badge label={`${displayList.length}`} />}
            />
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setFiltersOpen((v) => !v)}
          activeOpacity={0.85}
          style={[styles.topActionButton, filtersOpen && styles.topActionButtonActive]}
        >
          <Ionicons
            name="options-outline"
            size={16}
            color={filtersOpen ? theme.colors.accent : theme.colors.sub}
          />
          <Text style={[styles.topActionText, filtersOpen && styles.topActionTextActive]}>
            Filtres{activeFilters ? ` (${activeFilters})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {filtersOpen ? (
        <Card variant="soft" style={styles.filtersCard}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Intensité</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {(Object.keys(INTENSITY_LABELS) as BankIntensity[]).map((intensity) => (
                <FilterChip
                  key={intensity}
                  label={INTENSITY_LABELS[intensity]}
                  selected={selectedIntensity === intensity}
                  onPress={() => setSelectedIntensity((prev) => (prev === intensity ? null : intensity))}
                />
              ))}
            </ScrollView>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Tags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {TAG_ORDER.map((tag) => (
                <FilterChip
                  key={tag}
                  label={TAG_LABELS[tag]}
                  selected={selectedTags.includes(tag)}
                  onPress={() => toggleTag(tag)}
                />
              ))}
            </ScrollView>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Matériel</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {EQUIPMENT_ORDER.map((equipment) => (
                <FilterChip
                  key={equipment}
                  label={EQUIPMENT_LABELS[equipment]}
                  selected={selectedEquipment.includes(equipment)}
                  onPress={() => toggleEquipment(equipment)}
                />
              ))}
            </ScrollView>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Vidéo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <FilterChip label="Vidéos validées" selected={videoOnly} onPress={() => setVideoOnly((prev) => !prev)} />
            </ScrollView>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Tri</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {(["favorites", "alpha", "recent"] as SortMode[]).map((mode) => (
                <FilterChip
                  key={mode}
                  label={SORT_LABELS[mode]}
                  selected={sortMode === mode}
                  onPress={() => setSortMode(mode)}
                />
              ))}
            </ScrollView>
          </View>
          {activeFilters > 0 ? (
            <View style={styles.filtersFooter}>
              <TouchableOpacity onPress={resetFilters} activeOpacity={0.85} style={styles.resetButton}>
                <Text style={styles.resetButtonText}>Réinitialiser</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </Card>
      ) : null}

      {displayList.length === 0 ? (
        <Card variant="soft" style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{isFavoritesView ? "Aucun favori" : "Aucun résultat"}</Text>
          <Text style={styles.emptyText}>
            {isFavoritesView
              ? "Ajoute des favoris pour les retrouver ici rapidement."
              : "Essaie un terme plus court, ou enlève un filtre."}
          </Text>
        </Card>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={displayList.length > 0 ? displayList : []}
        keyExtractor={keyExtractor}
        renderItem={renderExerciseItem}
        ItemSeparatorComponent={itemSeparator}
        ListHeaderComponent={resultsHeader}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      <ExerciseDetailModal
        visible={Boolean(detailExerciseId)}
        exerciseId={detailExerciseId}
        onClose={closeDetail}
        onToggleFavorite={(id) => toggleFavoriteExercise(id)}
        isFavorite={(id) => favoriteSet.has(id)}
        onOpenVideo={(id) => openVideoRef(id)}
        onOpenVariant={(id) => {
          const ex = EXERCISE_BY_ID[id];
          if (!ex) return;
          setDetailExerciseId(id);
          setActiveHighlightId(id);
          addRecentExercise(id);
        }}
        getVariants={getVariants}
        getNoEquipmentVariants={getNoEquipmentVariants}
        inferEquipment={inferEquipment}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───

const palette = theme.colors;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 14, paddingBottom: 32, gap: 14 },
  listContainer: { padding: 14, paddingBottom: 32, gap: 14 },

  // Header
  screenHeader: { gap: 2 },
  screenKicker: {
    fontSize: 11,
    letterSpacing: 1.6,
    color: palette.sub,
    textTransform: "uppercase",
    fontWeight: "800",
  },
  screenTitle: { fontSize: 24, fontWeight: "800", color: palette.text, marginTop: 2 },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    paddingHorizontal: 14,
    paddingVertical: 2,
    gap: 10,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: palette.text, fontSize: 13 },
  clearButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  // Categories
  categoryGrid: {
    gap: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryCard: {
    padding: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: palette.card,
    gap: 10,
    minHeight: 130,
    justifyContent: "space-between",
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryContent: { gap: 2 },
  categoryLabel: { fontSize: 14, fontWeight: "700", color: palette.text },
  categoryDescription: { fontSize: 11, color: palette.sub },

  // Results header
  resultsTopBar: { gap: 10 },
  resultsHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsModalityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  topActionButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  topActionButtonActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  topActionText: { fontSize: 12, fontWeight: "700", color: palette.sub },
  topActionTextActive: { color: palette.accent },

  // Filters
  filtersCard: { padding: 12, gap: 12 },
  filterGroup: { gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: "700", color: palette.text },
  filterRow: { gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  chipActive: { backgroundColor: palette.accentSoft, borderColor: palette.accent },
  chipText: { fontSize: 12, color: palette.sub, fontWeight: "600" },
  chipTextActive: { color: palette.accent },
  filtersFooter: { flexDirection: "row", justifyContent: "flex-end" },
  resetButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  resetButtonText: { fontSize: 11, fontWeight: "600", color: palette.sub },

  // Empty
  emptyCard: { padding: 16, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: palette.text },
  emptyText: { fontSize: 12, color: palette.sub, lineHeight: 18 },

  // Exercise cards
  exerciseCard: { padding: 0, overflow: "hidden", flexDirection: "row" },
  exerciseCardHighlight: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  accentBar: {
    width: 4,
    borderTopLeftRadius: theme.radius.lg,
    borderBottomLeftRadius: theme.radius.lg,
  },
  exerciseInner: { flex: 1 },
  exercisePressArea: { paddingVertical: 12, paddingHorizontal: 12, gap: 4 },
  exerciseTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  exerciseNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  exerciseName: { fontSize: 14, fontWeight: "700", color: palette.text, flex: 1 },
  exerciseMeta: { fontSize: 12, color: palette.sub },
  exerciseFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  videoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.accentSoft,
  },
  videoPillText: { fontSize: 10, fontWeight: "700", color: palette.accent },
  footerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActive: { borderColor: palette.accent, backgroundColor: palette.accentSoft },

  // Detail modal
  modalAccentStrip: {
    height: 3,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
  },
  modalSheet: {
    backgroundColor: palette.bg,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    maxHeight: "88%",
    overflow: "hidden",
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: palette.borderSoft,
    marginTop: 10,
    marginBottom: 10,
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  modalModalityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: palette.text },
  modalSub: { marginTop: 4, fontSize: 12, color: palette.sub, lineHeight: 16 },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: { paddingHorizontal: 14, paddingBottom: 18, gap: 12 },
  modalRowTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  modalRowText: { fontSize: 13, color: palette.sub, lineHeight: 18 },
  modalActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  modalActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  modalActionText: { fontSize: 12, fontWeight: "800", color: palette.sub },
  modalActionTextActive: { color: palette.accent },
  modalChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modalChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
  },
  modalChipText: { fontSize: 12, color: palette.sub, fontWeight: "700" },
  modalChipAlt: { borderColor: palette.accent, backgroundColor: palette.accentSoft },
  modalChipTextAlt: { fontSize: 12, color: palette.accent, fontWeight: "800" },
});

// ─── Sous-composants ───

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.chip, selected && styles.chipActive]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

type ExerciseDetailModalProps = {
  visible: boolean;
  exerciseId: string | null;
  onClose: () => void;
  onToggleFavorite: (exerciseId: string) => void;
  isFavorite: (exerciseId: string) => boolean;
  onOpenVideo: (exerciseId: string) => void;
  onOpenVariant: (exerciseId: string) => void;
  getVariants: (item: ExerciseDef) => ExerciseDef[];
  getNoEquipmentVariants: (item: ExerciseDef) => ExerciseDef[];
  inferEquipment: (item: ExerciseDef) => EquipmentKey[];
};

function ExerciseDetailModal({
  visible,
  exerciseId,
  onClose,
  onToggleFavorite,
  isFavorite,
  onOpenVideo,
  onOpenVariant,
  getVariants,
  getNoEquipmentVariants,
  inferEquipment,
}: ExerciseDetailModalProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [exerciseId]);

  const exercise = exerciseId ? EXERCISE_BY_ID[exerciseId] : undefined;
  if (!exercise) return null;

  const instruction = EXERCISE_INSTRUCTIONS[exercise.id];
  const videoRef = getExerciseVideoRef(exercise.id);
  const variants = getVariants(exercise);
  const noEquip = getNoEquipmentVariants(exercise);
  const equipment = inferEquipment(exercise);
  const favorite = isFavorite(exercise.id);
  const config = MODALITY_CONFIG[exercise.modality];

  const cues = instruction?.cues ?? [];
  const visibleCues = expanded ? cues : cues.slice(0, 2);
  const hasMoreCues = cues.length > 2;

  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      animationType="slide"
      blurIntensity={40}
      allowBackdropDismiss
      allowSwipeDismiss
      showHandle={false}
      contentStyle={styles.modalSheet}
    >
      <View>
        <View style={[styles.modalAccentStrip, { backgroundColor: config.tint }]} />
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.modalModalityIcon, { backgroundColor: config.tintSoft }]}>
                <Ionicons name={config.icon as any} size={14} color={config.tint} />
              </View>
              <Text style={styles.modalTitle}>{exercise.name}</Text>
            </View>
            <Text style={styles.modalSub}>
              {MODALITY_LABELS[exercise.modality]} · {INTENSITY_LABELS[exercise.intensity]}
              {formatDefaults(exercise) ? ` · ${formatDefaults(exercise)}` : ""}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} activeOpacity={0.85} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.modalCloseButton}>
            <Ionicons name="close" size={18} color={palette.sub} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 6 }}>
            <Text style={styles.modalRowTitle}>Description</Text>
            <Text style={styles.modalRowText}>{exercise.description}</Text>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={() => onToggleFavorite(exercise.id)}
              activeOpacity={0.85}
              style={styles.modalActionButton}
            >
              <Ionicons
                name={favorite ? "star" : "star-outline"}
                size={16}
                color={favorite ? palette.accent : palette.sub}
              />
              <Text style={[styles.modalActionText, favorite && styles.modalActionTextActive]}>
                {favorite ? "En favori" : "Ajouter favori"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onOpenVideo(exercise.id)}
              activeOpacity={0.85}
              style={styles.modalActionButton}
            >
              <Ionicons name="logo-youtube" size={16} color={palette.sub} />
              <Text style={styles.modalActionText}>
                {videoRef.kind === "vetted" ? "Voir vidéo" : "Rechercher"}
              </Text>
            </TouchableOpacity>
          </View>

          {videoRef.kind === "vetted" ? (
            <Text style={[styles.modalRowText, { color: palette.muted }]}>
              Source : {videoRef.label}
            </Text>
          ) : null}

          {instruction ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.modalRowTitle}>Comment faire</Text>
              <Text style={styles.modalRowText}>{instruction.howTo}</Text>
              {visibleCues.length > 0 ? (
                <View style={{ gap: 4 }}>
                  {visibleCues.map((cue) => (
                    <Text key={`${exercise.id}_${cue}`} style={styles.modalRowText}>
                      • {cue}
                    </Text>
                  ))}
                </View>
              ) : null}
              {hasMoreCues ? (
                <TouchableOpacity
                  onPress={() => setExpanded((v) => !v)}
                  activeOpacity={0.85}
                  style={[styles.modalActionButton, { alignSelf: "flex-start" }]}
                >
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={palette.sub}
                  />
                  <Text style={styles.modalActionText}>{expanded ? "Voir moins" : "Voir plus"}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {equipment.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.modalRowTitle}>Matériel</Text>
              <View style={styles.modalChips}>
                {equipment.map((eq) => (
                  <View key={`${exercise.id}_${eq}`} style={styles.modalChip}>
                    <Text style={styles.modalChipText}>{EQUIPMENT_LABELS[eq]}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {exercise.tags.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.modalRowTitle}>Tags</Text>
              <View style={styles.modalChips}>
                {exercise.tags.map((tag) => (
                  <View key={`${exercise.id}_${tag}`} style={styles.modalChip}>
                    <Text style={styles.modalChipText}>{TAG_LABELS[tag]}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {variants.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.modalRowTitle}>Alternatives</Text>
              <View style={styles.modalChips}>
                {variants.map((variant) => (
                  <TouchableOpacity
                    key={`${exercise.id}_${variant.id}`}
                    onPress={() => onOpenVariant(variant.id)}
                    activeOpacity={0.85}
                    style={styles.modalChip}
                  >
                    <Text style={styles.modalChipText}>{variant.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {noEquip.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.modalRowTitle}>Alternatives (sans matériel)</Text>
              <View style={styles.modalChips}>
                {noEquip.map((variant) => (
                  <TouchableOpacity
                    key={`${exercise.id}_${variant.id}_bw`}
                    onPress={() => onOpenVariant(variant.id)}
                    activeOpacity={0.85}
                    style={[styles.modalChip, styles.modalChipAlt]}
                  >
                    <Text style={styles.modalChipTextAlt}>{variant.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </ModalContainer>
  );
}
