// screens/VideoLibraryScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  Linking,
  Alert,
} from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/theme";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Card } from "../components/ui/Card";
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
  | "medball"
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
  medball: "Medball",
  box: "Box",
  bench: "Banc",
  trx: "TRX",
  bike: "Vélo",
  rower: "Rameur",
};

const EQUIPMENT_ORDER: EquipmentKey[] = [
  "bodyweight",
  "dumbbell",
  "barbell",
  "kettlebell",
  "band",
  "machine",
  "medball",
  "box",
  "bench",
  "trx",
  "bike",
  "rower",
];

const MODALITY_ORDER: BankModality[] = [
  "run",
  "plyo",
  "strength",
  "cod",
  "circuit",
  "core",
  "mobility",
];

const TAG_ORDER: ExerciseTag[] = [
  "sprint",
  "plyo",
  "jump",
  "tempo",
  "technique",
  "heavy_lower",
  "heavy_upper",
  "cuts",
  "impact",
  "knee_stress",
  "ankle_stress",
  "hamstring_load",
  "quad_load",
  "calf_load",
  "hip_load",
  "shoulder_load",
  "spine_load",
  "mobility",
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
    id.includes("bb_") ||
    id.includes("_bb") ||
    id.includes("bench_press") ||
    id.includes("back_squat") ||
    id.includes("front_squat") ||
    id.includes("deadlift") ||
    id.includes("rdl_bar")
  ) {
    equip.add("barbell");
  }
  if (id.includes("kb_") || id.includes("_kb")) equip.add("kettlebell");
  if (id.includes("band") || id.includes("elastic")) equip.add("band");
  if (id.includes("machine") || id.includes("cable") || id.includes("pulldown")) {
    equip.add("machine");
  }
  if (id.startsWith("mb_")) equip.add("medball");
  if (id.includes("trx")) equip.add("trx");
  if (id.includes("box") || id.includes("step_up") || id.includes("step_down")) equip.add("box");
  if (id.includes("bench") || id.includes("floor_press")) equip.add("bench");
  if (id.startsWith("bike_")) equip.add("bike");
  if (id.startsWith("row_")) equip.add("rower");
  if (equip.size === 0) equip.add("bodyweight");
  return Array.from(equip);
};

const formatDefaults = (item: ExerciseDef) => {
  const parts: string[] = [];
  if (item.defaultSets) parts.push(`${item.defaultSets} séries`);
  if (item.defaultDurationMin) parts.push(`${item.defaultDurationMin} min`);
  return parts.join(" · ");
};

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

  const normalizedQuery = query.trim().toLowerCase();
  const favoriteSet = useMemo(() => new Set(favoriteExerciseIds), [favoriteExerciseIds]);
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
    return EXERCISE_BANK.filter((item) => {
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
        matchesQuery &&
        matchesModality &&
        matchesIntensity &&
        matchesTags &&
        matchesEquipment &&
        matchesVideo &&
        matchesFavorites
      );
    });
  }, [
    normalizedQuery,
    selectedModalities,
    selectedIntensity,
    selectedTags,
    selectedEquipment,
    videoOnly,
    isFavoritesView,
    favoriteSet,
  ]);

  const grouped = useMemo(() => {
    const buckets: Record<BankModality, ExerciseDef[]> = {
      run: [],
      circuit: [],
      strength: [],
      plyo: [],
      cod: [],
      core: [],
      mobility: [],
    };
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
    list.forEach((item) => {
        buckets[item.modality].push(item);
      });
    return buckets;
  }, [filtered, favoriteSet, recentRank, sortMode]);

  const favoriteList = useMemo(() => {
    if (!isFavoritesView) return [];
    const list = [...filtered];
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
  }, [filtered, isFavoritesView, favoriteSet, recentRank, sortMode]);

  const activeList = isFavoritesView
    ? favoriteList
    : activeCategory
      ? grouped[activeCategory as BankModality] ?? []
      : [];

  const sortedFiltered = useMemo(() => {
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

  const openExercise = (exercise: ExerciseDef) => {
    setDetailExerciseId(exercise.id);
    setActiveHighlightId(exercise.id);
    addRecentExercise(exercise.id);
  };

  const closeDetail = () => setDetailExerciseId(null);

  const openVideoRef = (exerciseId: string) => {
    const ref = getExerciseVideoRef(exerciseId);
    Linking.openURL(ref.url).catch(() => {
      Alert.alert("Vidéo indisponible", "Impossible d'ouvrir le lien pour l'instant.");
    });
  };

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
    const candidates = EXERCISE_BANK.filter(
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Card variant="surface" style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Banque d'exercices</Text>
              <Text style={styles.subtitle}>
                Filtre par objectif, intensité ou type et garde une démo sous la main.
              </Text>
            </View>
            <Badge label={`${filtered.length} exos`} />
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{EXERCISE_BANK.length}</Text>
              <Text style={styles.heroStatLabel}>Total</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{activeFilters}</Text>
              <Text style={styles.heroStatLabel}>Filtres</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{Object.keys(MODALITY_LABELS).length}</Text>
              <Text style={styles.heroStatLabel}>Modalités</Text>
            </View>
          </View>
        </Card>

        <Card variant="soft" style={styles.searchCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={theme.colors.sub} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher un exercice (nom, tag, consigne)..."
              placeholderTextColor={theme.colors.muted}
              style={styles.searchInput}
              autoCorrect={false}
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery("")} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>×</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.searchHint}>
            Astuce : tape “RDL”, “ischios”, “accélération”, “gainage”, etc.
          </Text>
        </Card>

        {!showResults ? (
          <View style={styles.categoryBlock}>
            <SectionHeader title="Catégories" />
            <Text style={styles.categoryHint}>Choisis une catégorie, ou utilise la recherche.</Text>
            <View style={styles.categoryGrid}>
              <TouchableOpacity activeOpacity={0.9} onPress={focusFavorites} style={styles.categoryCard}>
                <Text style={styles.categoryLabel}>Favoris</Text>
                <Text style={styles.categoryDescription}>Accès rapide à tes exos.</Text>
                <Badge
                  label={`${favoriteExerciseIds.length}`}
                  tone={favoriteExerciseIds.length ? "ok" : "default"}
                />
              </TouchableOpacity>
              {MODALITY_ORDER.map((modality) => {
                const count = EXERCISE_BANK.filter((item) => item.modality === modality).length;
                return (
                  <TouchableOpacity
                    key={modality}
                    activeOpacity={0.9}
                    onPress={() => focusCategory(modality)}
                    style={styles.categoryCard}
                  >
                    <Text style={styles.categoryLabel}>{MODALITY_LABELS[modality]}</Text>
                    <Text style={styles.categoryDescription}>{MODALITY_DESCRIPTIONS[modality]}</Text>
                    <Badge label={`${count}`} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.resultsTopBar}>
            <View style={{ flex: 1, gap: 6 }}>
              <SectionHeader
                title={
                  isFavoritesView
                    ? "Favoris"
                    : activeCategory
                      ? MODALITY_LABELS[activeCategory as BankModality]
                      : "Résultats"
                }
                right={<Badge label={`${(activeCategory ? activeList : sortedFiltered).length}`} />}
              />
              <Text style={styles.resultsHint}>
                Appuie sur un exercice pour ouvrir sa fiche (consignes, variantes, vidéo).
              </Text>
            </View>
            <View style={styles.resultsTopActions}>
              <TouchableOpacity onPress={resetFilters} activeOpacity={0.85} style={styles.topActionButton}>
                <Ionicons name="grid-outline" size={16} color={theme.colors.sub} />
                <Text style={styles.topActionText}>Catégories</Text>
              </TouchableOpacity>
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
          </View>
        )}

        {showResults && filtersOpen ? (
          <Card variant="soft" style={styles.filtersCard}>
            <View style={styles.filterGroup}>
              <Text style={styles.filterLabel}>Intensité</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {(Object.keys(INTENSITY_LABELS) as BankIntensity[]).map((intensity) => (
                  <FilterChip
                    key={intensity}
                    label={INTENSITY_LABELS[intensity]}
                    selected={selectedIntensity === intensity}
                    onPress={() =>
                      setSelectedIntensity((prev) => (prev === intensity ? null : intensity))
                    }
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

        {showResults ? (
          filtered.length === 0 ? (
            <Card variant="soft" style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{isFavoritesView ? "Aucun favori" : "Aucun résultat"}</Text>
              <Text style={styles.emptyText}>
                {isFavoritesView
                  ? "Ajoute des favoris pour les retrouver ici rapidement."
                  : "Essaie un terme plus court, ou enlève un filtre."}
              </Text>
            </Card>
          ) : (
            <View style={styles.sectionBlock}>
              <View style={styles.cardsList}>
                {(activeCategory ? activeList : sortedFiltered).map((item) => {
                  const isFavorite = favoriteSet.has(item.id);
                  const hasVettedVideo = getExerciseVideoRef(item.id).kind === "vetted";
                  const variantsCount = getVariants(item).length;
                  return (
                    <Card
                      key={item.id}
                      variant="surface"
                      style={[
                        styles.exerciseCard,
                        item.id === activeHighlightId && styles.exerciseCardHighlight,
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => openExercise(item)}
                        style={styles.exercisePressArea}
                      >
                        <View style={styles.exerciseTitleRow}>
                          <Text style={styles.exerciseName}>{item.name}</Text>
                          <Badge label={INTENSITY_LABELS[item.intensity]} tone={intensityTone(item.intensity)} />
                        </View>
                        <Text style={styles.exerciseMeta}>
                          {MODALITY_LABELS[item.modality]}
                          {formatDefaults(item) ? ` · ${formatDefaults(item)}` : ""}
                        </Text>
                        <Text numberOfLines={2} style={styles.exerciseDescription}>
                          {item.description}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.exerciseFooter}>
                        <View style={styles.quickMetaRow}>
                          {hasVettedVideo ? (
                            <View style={styles.quickPill}>
                              <Ionicons name="videocam" size={12} color={theme.colors.accent} />
                              <Text style={styles.quickPillTextAccent}>Vidéo</Text>
                            </View>
                          ) : (
                            <View style={styles.quickPill}>
                              <Ionicons name="search" size={12} color={theme.colors.sub} />
                              <Text style={styles.quickPillText}>Recherche</Text>
                            </View>
                          )}
                          {variantsCount > 0 ? (
                            <View style={styles.quickPill}>
                              <Ionicons name="git-branch-outline" size={12} color={theme.colors.sub} />
                              <Text style={styles.quickPillText}>{variantsCount} variantes</Text>
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.footerActions}>
                          <TouchableOpacity
                            onPress={() => toggleFavoriteExercise(item.id)}
                            activeOpacity={0.85}
                            style={[styles.iconButton, isFavorite && styles.iconButtonActive]}
                          >
                            <Ionicons
                              name={isFavorite ? "star" : "star-outline"}
                              size={16}
                              color={isFavorite ? theme.colors.accent : theme.colors.sub}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => openVideoRef(item.id)}
                            activeOpacity={0.85}
                            style={styles.iconButton}
                          >
                            <Ionicons name="logo-youtube" size={16} color={theme.colors.sub} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => openExercise(item)}
                            activeOpacity={0.85}
                            style={styles.iconButton}
                          >
                            <Ionicons name="chevron-forward" size={16} color={theme.colors.sub} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Card>
                  );
                })}
              </View>
            </View>
          )
        ) : null}
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: 14, paddingBottom: 32, gap: 14 },
  heroCard: { padding: 14, gap: 12 },
  heroTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  title: { fontSize: 20, fontWeight: "800", color: theme.colors.text },
  subtitle: { color: theme.colors.sub, lineHeight: 18, marginTop: 4 },
  heroStats: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  heroStat: { flex: 1 },
  heroStatValue: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  heroStatLabel: {
    fontSize: 11,
    color: theme.colors.sub,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroDivider: { width: 1, height: 32, backgroundColor: theme.colors.borderSoft },
  highlightCard: { padding: 12, gap: 8 },
  highlightRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  highlightLabel: { fontSize: 11, textTransform: "uppercase", color: theme.colors.sub, letterSpacing: 0.6 },
  highlightName: { fontSize: 15, fontWeight: "700", color: theme.colors.text, marginTop: 4 },
  highlightDescription: { fontSize: 12, color: theme.colors.muted, marginTop: 6, lineHeight: 16 },
  searchCard: { padding: 12 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 13,
  },
  searchHint: { marginTop: 8, fontSize: 12, color: theme.colors.sub, lineHeight: 16 },
  clearButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: { fontSize: 16, color: theme.colors.sub },
  filtersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resetButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  resetButtonText: { fontSize: 11, fontWeight: "600", color: theme.colors.sub },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBlock: { gap: 10 },
  categoryHint: { fontSize: 12, color: theme.colors.sub },
  categoryGrid: {
    gap: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryCard: {
    padding: 12,
    width: "48%",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.card,
    gap: 6,
    minHeight: 120,
    justifyContent: "space-between",
  },
  categoryLabel: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  categoryDescription: { fontSize: 12, color: theme.colors.sub },
  filterGroup: { gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: "700", color: theme.colors.text },
  filterRow: { gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.card,
  },
  chipActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accent,
  },
  chipText: { fontSize: 12, color: theme.colors.sub, fontWeight: "600" },
  chipTextActive: { color: theme.colors.accent },
  resultsTopBar: { gap: 10 },
  resultsTopActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  topActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.card,
  },
  topActionButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  topActionText: { fontSize: 12, fontWeight: "700", color: theme.colors.sub },
  topActionTextActive: { color: theme.colors.accent },
  filtersCard: { padding: 12, gap: 12 },
  filtersFooter: { flexDirection: "row", justifyContent: "flex-end" },
  resultsHeader: { gap: 6 },
  resultsHint: { color: theme.colors.sub, fontSize: 12 },
  emptyCard: { padding: 16, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  emptyText: { fontSize: 12, color: theme.colors.sub, lineHeight: 18 },
  sectionBlock: { gap: 10 },
  cardsList: { gap: 10 },
  exerciseCard: { padding: 12, gap: 10 },
  exerciseCardHighlight: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  exerciseTop: { gap: 6 },
  exercisePressArea: { gap: 6 },
  exerciseTitleRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  exerciseName: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  exerciseMeta: { fontSize: 12, color: theme.colors.sub, marginTop: 2 },
  exerciseDescription: { fontSize: 12, color: theme.colors.muted, marginTop: 6, lineHeight: 16 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  equipmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  equipmentChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  equipmentChipText: { fontSize: 10, fontWeight: "600", color: theme.colors.sub },
  tagChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  tagChipText: { fontSize: 10, fontWeight: "600", color: theme.colors.sub },
  tagChipMuted: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.borderSoft,
  },
  tagChipMutedText: { fontSize: 10, color: theme.colors.sub },
  variantPreviewRow: { gap: 6 },
  variantPreviewLabel: { fontSize: 11, fontWeight: "700", color: theme.colors.text },
  variantPreviewChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  variantPreviewChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.cardSoft,
  },
  variantPreviewText: { fontSize: 10, color: theme.colors.sub, fontWeight: "600" },
  variantPreviewMore: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.borderSoft,
  },
  variantPreviewMoreText: { fontSize: 10, color: theme.colors.sub, fontWeight: "600" },
  variantBlock: { gap: 6 },
  variantLabel: { fontSize: 11, fontWeight: "700", color: theme.colors.text },
  variantRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  variantChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.card,
  },
  variantChipText: { fontSize: 11, color: theme.colors.sub, fontWeight: "600" },
  variantChipAlt: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  variantChipTextAlt: { fontSize: 11, color: theme.colors.accent, fontWeight: "700" },
  howToBlock: { gap: 6 },
  howToLabel: { fontSize: 11, fontWeight: "700", color: theme.colors.text },
  howToText: { fontSize: 12, color: theme.colors.sub, lineHeight: 16 },
  howToList: { gap: 2 },
  howToBullet: { fontSize: 12, color: theme.colors.sub, lineHeight: 16 },
  exerciseFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  quickMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.cardSoft,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  quickPillText: { fontSize: 10, fontWeight: "700", color: theme.colors.sub },
  quickPillTextAccent: { fontSize: 10, fontWeight: "800", color: theme.colors.accent },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.cardSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  detailToggle: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.cardSoft,
  },
  detailToggleText: { fontSize: 11, color: theme.colors.sub, fontWeight: "700" },
  exerciseDetail: { fontSize: 12, color: theme.colors.sub },
  favoriteButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.cardSoft,
  },
  favoriteButtonActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  favoriteButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  favoriteButtonText: { fontSize: 11, color: theme.colors.sub, fontWeight: "700" },
  favoriteButtonTextActive: { color: theme.colors.accent },
  videoLink: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  videoLinkText: { fontSize: 11, color: theme.colors.accent, fontWeight: "700" },
  videoBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
  },
  videoBadgeText: { fontSize: 10, fontWeight: "700", color: theme.colors.accent },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    maxHeight: "88%",
    overflow: "hidden",
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.borderSoft,
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
  modalTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: theme.colors.text },
  modalSub: { marginTop: 4, fontSize: 12, color: theme.colors.sub, lineHeight: 16 },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: { paddingHorizontal: 14, paddingBottom: 18, gap: 12 },
  modalRowTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  modalRowText: { fontSize: 13, color: theme.colors.sub, lineHeight: 18 },
  modalActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  modalActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.card,
  },
  modalActionText: { fontSize: 12, fontWeight: "800", color: theme.colors.sub },
  modalActionTextActive: { color: theme.colors.accent },
  modalChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modalChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.card,
  },
  modalChipText: { fontSize: 12, color: theme.colors.sub, fontWeight: "700" },
  modalChipAlt: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  modalChipTextAlt: { fontSize: 12, color: theme.colors.accent, fontWeight: "800" },
});

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function FilterChip({ label, selected, onPress }: FilterChipProps) {
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

  const cues = instruction?.cues ?? [];
  const visibleCues = expanded ? cues : cues.slice(0, 2);
  const hasMoreCues = cues.length > 2;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => null}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{exercise.name}</Text>
              <Text style={styles.modalSub}>
                {MODALITY_LABELS[exercise.modality]} · {INTENSITY_LABELS[exercise.intensity]}
                {formatDefaults(exercise) ? ` · ${formatDefaults(exercise)}` : ""}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={styles.modalCloseButton}>
              <Ionicons name="close" size={18} color={theme.colors.sub} />
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
                  color={favorite ? theme.colors.accent : theme.colors.sub}
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
                <Ionicons name="logo-youtube" size={16} color={theme.colors.sub} />
                <Text style={styles.modalActionText}>
                  {videoRef.kind === "vetted" ? "Voir vidéo" : "Rechercher"}
                </Text>
              </TouchableOpacity>
            </View>

            {videoRef.kind === "vetted" ? (
              <Text style={[styles.modalRowText, { color: theme.colors.muted }]}>
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
                      color={theme.colors.sub}
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}
