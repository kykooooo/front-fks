// screens/VideoLibraryScreen.tsx — orchestrator (refactored from 1352 → ~310 lines)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Animated,
} from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../constants/theme";
import { showToast } from "../utils/toast";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Badge } from "../components/ui/Badge";
import { useExternalStore } from "../state/stores/useExternalStore";
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
import { YouTubePlayer } from "../components/ui/YouTubePlayer";

import {
  MODALITY_LABELS,
  MODALITY_DESCRIPTIONS,
  MODALITY_CONFIG,
  MODALITY_ORDER,
  isBallExercise,
  inferEquipment,
  type CategoryView,
  type SortMode,
  type EquipmentKey,
} from "./videoLibrary/videoLibraryConfig";
import { CategoryCard } from "./videoLibrary/components/CategoryCard";
import { ExerciseListCard } from "./videoLibrary/components/ExerciseListCard";
import { FiltersPanel } from "./videoLibrary/components/FiltersPanel";
import { ExerciseDetailModal } from "./videoLibrary/components/ExerciseDetailModal";

type VideoLibraryRoute = RouteProp<
  { VideoLibrary: { highlightId?: string; startInFavorites?: boolean } | undefined },
  "VideoLibrary"
>;

const palette = theme.colors;

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
  const favoriteExerciseIds = useExternalStore((s) => s.favoriteExerciseIds ?? []);
  const recentExerciseIds = useExternalStore((s) => s.recentExerciseIds ?? []);
  const toggleFavoriteExercise = useExternalStore((s) => s.toggleFavoriteExercise);
  const addRecentExercise = useExternalStore((s) => s.addRecentExercise);

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
  const visibleBank = useMemo(() => EXERCISE_BANK.filter((item) => !isBallExercise(item)), []);
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

  // ─── Callbacks ───

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

  const [videoPlayerUrl, setVideoPlayerUrl] = useState<string | null>(null);
  const [videoPlayerLabel, setVideoPlayerLabel] = useState<string>("");

  const openVideoRef = useCallback((exerciseId: string) => {
    const ref = getExerciseVideoRef(exerciseId);
    const ex = EXERCISE_BY_ID[exerciseId];
    setVideoPlayerLabel(ex?.name ?? "Vidéo exercice");
    setVideoPlayerUrl(ref.url);
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

  // ─── Deep-link effects ───

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

  useEffect(() => {
    if (!startInFavorites || highlightId) return;
    focusFavorites();
  }, [startInFavorites, highlightId]);

  // ─── Variants helpers ───

  const getVariants = useCallback((item: ExerciseDef) => {
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
  }, [visibleBank]);

  const getNoEquipmentVariants = useCallback((item: ExerciseDef) => {
    const equipment = inferEquipment(item);
    if (equipment.includes("bodyweight")) return [];
    return getVariants(item).filter((variant) =>
      inferEquipment(variant).includes("bodyweight")
    );
  }, [getVariants]);

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

  const detailModalProps = {
    visible: Boolean(detailExerciseId),
    exerciseId: detailExerciseId,
    onClose: closeDetail,
    onToggleFavorite: (id: string) => toggleFavoriteExercise(id),
    isFavorite: (id: string) => favoriteSet.has(id),
    onOpenVideo: (id: string) => openVideoRef(id),
    onOpenVariant: (id: string) => {
      const ex = EXERCISE_BY_ID[id];
      if (!ex) return;
      setDetailExerciseId(id);
      setActiveHighlightId(id);
      addRecentExercise(id);
    },
    getVariants,
    getNoEquipmentVariants,
  };

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
          <Ionicons name="search" size={16} color={palette.sub} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un exercice..."
            placeholderTextColor={palette.muted}
            style={styles.searchInput}
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.clearButton}>
              <Ionicons name="close" size={14} color={palette.sub} />
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>
    </>
  );

  // ─── Vue catégories ───
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
        <ExerciseDetailModal {...detailModalProps} />
        <YouTubePlayer
          visible={videoPlayerUrl !== null}
          url={videoPlayerUrl}
          label={videoPlayerLabel}
          onClose={() => setVideoPlayerUrl(null)}
        />
      </SafeAreaView>
    );
  }

  // ─── Vue résultats (FlatList) ───
  const resultsHeader = (
    <>
      {renderHeader()}

      <View style={styles.resultsTopBar}>
        <View style={styles.resultsHeaderRow}>
          <TouchableOpacity onPress={resetFilters} activeOpacity={0.85} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color={palette.sub} />
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
            color={filtersOpen ? palette.accent : palette.sub}
          />
          <Text style={[styles.topActionText, filtersOpen && styles.topActionTextActive]}>
            Filtres{activeFilters ? ` (${activeFilters})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {filtersOpen ? (
        <FiltersPanel
          selectedIntensity={selectedIntensity}
          onIntensityChange={setSelectedIntensity}
          selectedTags={selectedTags}
          onToggleTag={toggleTag}
          selectedEquipment={selectedEquipment}
          onToggleEquipment={toggleEquipment}
          videoOnly={videoOnly}
          onVideoOnlyChange={setVideoOnly}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          activeFilters={activeFilters}
          onReset={resetFilters}
        />
      ) : null}

      {displayList.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{isFavoritesView ? "Aucun favori" : "Aucun résultat"}</Text>
          <Text style={styles.emptyText}>
            {isFavoritesView
              ? "Ajoute des favoris pour les retrouver ici rapidement."
              : "Essaie un terme plus court, ou enlève un filtre."}
          </Text>
        </View>
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
      <ExerciseDetailModal {...detailModalProps} />
      <YouTubePlayer
        visible={videoPlayerUrl !== null}
        url={videoPlayerUrl}
        label={videoPlayerLabel}
        onClose={() => setVideoPlayerUrl(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: 14, paddingBottom: 32, gap: 14 },
  listContainer: { padding: 14, paddingBottom: 32, gap: 14 },
  screenHeader: { gap: 2 },
  screenKicker: {
    fontSize: 11,
    letterSpacing: 1.6,
    color: palette.sub,
    textTransform: "uppercase",
    fontWeight: "800",
  },
  screenTitle: { fontSize: 24, fontWeight: "800", color: palette.text, marginTop: 2 },
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
  categoryGrid: {
    gap: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
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
  emptyCard: {
    padding: 16,
    gap: 6,
    backgroundColor: palette.cardSoft,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: palette.text },
  emptyText: { fontSize: 12, color: palette.sub, lineHeight: 18 },
});
