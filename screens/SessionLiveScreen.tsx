// screens/SessionLiveScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Alert,
  AppState,
} from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { Screen } from "../components/ui/Screen";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppStackParamList } from "../navigation/RootNavigator";
import { theme } from "../constants/theme";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { withSessionErrorBoundary } from "../components/withErrorBoundary";
import { SectionHeader } from "../components/ui/SectionHeader";
import { SessionTimer, type SessionTimerHandle } from "../components/session/SessionTimer";
import { getBlockLabel } from "../components/session/blockConfig";
import { readRecoveryTips, readCoachingTips } from "./newSession/helpers";
import { formatDayFR, toDateKey } from "../utils/dateHelpers";
import { frIntensity, frFocus, frLocation } from "../utils/frLabels";
// Source unique du fallback « Repère technique » par bloc (plus de copie locale).
import { getCoachTip } from "./sessionPreview/sessionPreviewConfig";
import { useSettingsStore } from "../state/settingsStore";
import { useSessionsStore } from "../state/stores/useSessionsStore";
import { useExternalStore } from "../state/stores/useExternalStore";
import { useLoadStore } from "../state/stores/useLoadStore";
import { getCycleTheme, type CycleTheme } from "../constants/cycleTheme";
import { EXERCISE_BY_ID } from "../engine/exerciseBank";
import { trackEvent } from "../services/analytics";
import { useContraintesDouleur } from "../state/selectors/blessures";
import { showToast } from "../utils/toast";
// ---- Boucle de suivi joueur (Lot 2) ----
import { useExecutionStore } from "../state/stores/useExecutionStore";
import { resolveTrackingModes } from "../domain/tracking/modes";
import { buildPrescribedSnapshot, type PrescribedSnapshotMeta } from "../domain/tracking/prescription";
import {
  applyReplacement,
  initExecution,
  markAllAsPlanned,
  setItemActual,
  setItemStatus,
  syncSetsFromLive,
} from "../domain/tracking/execution";
import { buildReplacementChain, deriveActualFieldsConfig, deriveMatchContext, hasExplicitItemStatus } from "../components/session/liveTrackingHelpers";
import { ItemActionsSheet } from "../components/session/ItemActionsSheet";
import { ReplacementSheet } from "../components/session/ReplacementSheet";
import type {
  ActualValues,
  DeviationReason,
  ItemExecution,
  ReplacementProposal,
  ReplacementRequest,
} from "../domain/tracking/types";

type BlockItem = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  footballContext?: string | null;
  exerciseId?: string | null;
  sets?: number | null;
  reps?: number | null;
  workS?: number | null;
  restS?: number | null;
  workRestSec?: number[] | null;
  workRest?: string | null;
  durationMin?: number | null;
  durationPerSetSec?: number | null;
  notes?: string | null;
  modality?: string | null;
};

type Block = {
  blockId?: string;
  name?: string | null;
  type?: string;
  goal?: string | null;
  focus?: string | null;
  intensity?: string;
  durationMin?: number;
  items?: BlockItem[];
  notes?: string | null;
  timerPresets?: {
    label?: string;
    workS?: number | null;
    restS?: number | null;
    rounds?: number | null;
  }[] | null;
};

type CircuitState = {
  workS: number;
  restS: number;
  totalRounds: number;
  round: number; // tour courant (1-based)
  phase: "work" | "rest";
  secLeft: number;
};

type LiveRoute = RouteProp<AppStackParamList, "SessionLive">;

const LIVE_SESSION_KEY = "fks_live_session";

type PersistedLiveState = {
  sessionId?: string;
  checkedSets: Record<string, boolean[]>;
  activeBlock: number;
  sessionSec: number;
  sessionRunning: boolean;
  savedAt: number;
};

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
  // Slug brut (ex: "str_squat_bodyweight") : on retire le prefixe token et on
  // remplace les underscores par des espaces avant la mise en forme. Un nom
  // déjà rédigé par le backend (avec espaces) n'est pas retouché ici.
  const isSlug = /^[a-z0-9_]+$/i.test(trimmed) && trimmed.includes("_");
  const noPrefix = isSlug ? trimmed.replace(/^(wu_|str_|run_|plyo_|cod_|core_)/i, "") : trimmed;
  const spaced = isSlug ? noPrefix.replace(/_/g, " ").toLowerCase() : noPrefix;
  // Casse française : majuscule initiale seule (pas un mot-à-mot comme en
  // anglais — "Squat Poids Du Corps" est faux, "Squat poids du corps" est juste).
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
  workS?: number | null;
  restS?: number | null;
  rounds?: number | null;
}) => {
  const parts: string[] = [];
  if (preset.label) parts.push(String(preset.label));
  if (Number.isFinite(Number(preset.workS)) && Number.isFinite(Number(preset.restS))) {
    parts.push(`${Number(preset.workS)}s/${Number(preset.restS)}s`);
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

// `getCoachTip` vivait ici en DOUBLON de sessionPreviewConfig : les deux copies
// ont derive et rendaient la meme phrase sur tous les blocs d'une seance Force.
// Source unique desormais : `screens/sessionPreview/sessionPreviewConfig.ts`.

const MAX_SESSION_SEC = 4 * 60 * 60; // 4 heures (timeout de sécurité)

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
  return Array.from({ length: total }, (_, idx) => !!current[idx]);
};

// Boucle de suivi (Lot 2, fix P1-1) : nombre de series AFFICHEES/COCHABLES
// pour un item. Un item remplace (execItem.status === "replaced") suit la
// prescription du REMPLACEMENT (execItem.replacement.prescription.sets) --
// applyReplacement (domain/tracking/execution.ts) ne touche jamais
// item.setsTotal/setsChecked de l'execution, donc c'est purement un ajustement
// d'AFFICHAGE cote ecran. checkedSets (Record<string, boolean[]>) garde sa
// structure existante : getSetState reindexe deja proprement un changement de
// longueur (valeurs conservees par index, jamais d'exception). Sans
// prescription.sets exploitable (ex. remplacement course, sets=null), on
// retombe sur le nombre de series de l'item original (comportement inchange).
const getEffectiveSetCount = (item: BlockItem, execItem?: ItemExecution | null) => {
  if (execItem?.status === "replaced" && execItem.replacement) {
    const replacementSets = execItem.replacement.prescription.sets;
    if (typeof replacementSets === "number" && Number.isFinite(replacementSets) && replacementSets > 0) {
      return Math.max(1, Math.round(replacementSets));
    }
  }
  return getSetCount(item);
};

const getItemProgress = (
  state: Record<string, boolean[]>,
  blockIndex: number,
  itemIndex: number,
  item: BlockItem,
  execItem?: ItemExecution | null
) => {
  const total = getEffectiveSetCount(item, execItem);
  const key = getItemKey(blockIndex, itemIndex);
  const sets = getSetState(state, key, total);
  const done = sets.filter(Boolean).length;
  return { total, done, sets, complete: done >= total };
};

const isItemComplete = (
  state: Record<string, boolean[]>,
  blockIndex: number,
  itemIndex: number,
  item: BlockItem,
  execItem?: ItemExecution | null
) => getItemProgress(state, blockIndex, itemIndex, item, execItem).complete;

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
  if (Array.isArray(item?.workRestSec) && item.workRestSec.length >= 2) {
    const rest = Number(item.workRestSec[1]);
    return Number.isFinite(rest) ? rest : null;
  }
  if (typeof item?.restS === "number" && Number.isFinite(item.restS)) {
    return item.restS;
  }
  return parseRestFromText(item?.workRest);
};

const formatItemMeta = (item: BlockItem) => {
  const parts: string[] = [];
  if (item?.sets != null && item.sets > 0) parts.push(`${item.sets}x`);
  if (item?.reps != null && item.reps > 0) parts.push(`${item.reps} reps`);
  if (Array.isArray(item?.workRestSec) && item.workRestSec.length >= 2) {
    const [w, r] = item.workRestSec;
    parts.push(`${w ?? "?"}s/${r ?? "?"}s`);
  } else if (item?.workS || item?.restS) {
    if (item.workS) parts.push(`${item.workS}s`);
    if (item.restS) parts.push(`/${item.restS}s`);
  } else if (item?.workRest && item.workRest.trim().length > 0) {
    parts.push(item.workRest.trim());
  }
  if (item?.durationPerSetSec) parts.push(`${item.durationPerSetSec}s / série`);
  if (item?.durationMin) parts.push(`${item.durationMin} min`);
  return parts.join(" · ");
};

// Boucle de suivi (Lot 2, fix P1-1) : meta affichee pour un item REMPLACE --
// la prescription du remplacement (execItem.replacement.prescription), jamais
// celle de l'original (qui ne correspond plus a ce qui est reellement fait).
const formatReplacementMeta = (prescription: NonNullable<ItemExecution["replacement"]>["prescription"]) => {
  const parts: string[] = [];
  if (prescription.sets != null && prescription.sets > 0) parts.push(`${prescription.sets}x`);
  if (typeof prescription.reps === "number" && prescription.reps > 0) {
    parts.push(`${prescription.reps} reps`);
  } else if (typeof prescription.reps === "string" && prescription.reps.trim().length > 0) {
    parts.push(prescription.reps.trim());
  }
  if (prescription.durationS != null && prescription.durationS > 0) parts.push(`${prescription.durationS}s`);
  if (prescription.restS != null && prescription.restS > 0) parts.push(`repos ${prescription.restS}s`);
  return parts.join(" · ");
};

const getDisplayName = (item: BlockItem) => {
  const displayNameRaw = (item?.name || "").trim();
  const fallbackId =
    typeof item?.exerciseId === "string" && item.exerciseId.trim()
      ? item.exerciseId.trim()
      : typeof item?.id === "string" && item.id.trim()
        ? item.id.trim()
        : undefined;
  return displayNameRaw.length > 0
    ? prettifyName(displayNameRaw)
    : fallbackId
      ? prettifyName(fallbackId)
      : item?.modality
        ? prettifyName(String(item.modality))
        : "Exercice";
};

const getExerciseId = (item: BlockItem) => {
  if (typeof item?.exerciseId === "string" && item.exerciseId.trim()) {
    return item.exerciseId.trim();
  }
  if (typeof item?.id === "string" && item.id.trim()) {
    return item.id.trim();
  }
  return null;
};

// ---- Boucle de suivi joueur (Lot 2) : badge discret par statut d'execution ----
const STATUS_BADGE: Record<"adapted" | "skipped" | "replaced", { label: string; tone: "default" | "warn" }> = {
  adapted: { label: "Adapté", tone: "warn" },
  skipped: { label: "Sauté", tone: "default" },
  replaced: { label: "Remplacé", tone: "default" },
};

/** Nom affiche pour un exercice de remplacement (banque -> nom lisible, sinon id prettifie). */
const resolveReplacementName = (exerciseId: string) =>
  EXERCISE_BY_ID[exerciseId]?.name ?? prettifyName(exerciseId);

// Carte de bloc mémoïsée : ne se redessine que si SES props changent.
// Couplé au chrono isolé, ça évite que le tick (1/s) redessine toutes les cartes.
type BlockCardProps = {
  block: Block;
  blockIndex: number;
  blockWidth: number;
  itemSize: number;
  scrollX: Animated.Value;
  checkedSets: Record<string, boolean[]>;
  onToggleSet: (
    blockIndex: number,
    itemIndex: number,
    setIndex: number,
    item: BlockItem,
    items: BlockItem[]
  ) => void;
  onOpenExercise: (exerciseId: string | null) => void;
  getPulse: (key: string) => Animated.Value;
  /** Thème couleur du cycle — STATIQUE pour la séance (props stables → memo préservé). */
  cycleTheme: CycleTheme;
  /** Boucle de suivi (Lot 2) : statut d'execution par cle d'item, null si tracking inactif pour cette seance. */
  execItemsByKey: Record<string, ItemExecution> | null;
  onOpenActions: (blockIndex: number, itemIndex: number, item: BlockItem) => void;
};

// Exporte (nommee) uniquement pour permettre un test de rendu leger de la
// ligne d'item (contrat de layout : numberOfLines, flex:1, pas de largeur
// figee cote actions) -- cf. screens/__tests__/SessionLiveScreen.itemRow.test.tsx.
// Comportement/props inchanges, toujours utilisee via l'export default du module.
export const BlockCard = React.memo(function BlockCard({
  block,
  blockIndex,
  blockWidth,
  itemSize,
  scrollX,
  checkedSets,
  onToggleSet,
  onOpenExercise,
  getPulse,
  cycleTheme,
  execItemsByKey,
  onOpenActions,
}: BlockCardProps) {
  const items = block.items ?? [];
  const blockTitle =
    block.goal || block.name || block.type || block.focus || `Bloc ${blockIndex + 1}`;
  const isComplete =
    items.length > 0 &&
    items.every((item, idx) =>
      isItemComplete(checkedSets, blockIndex, idx, item, execItemsByKey?.[getItemKey(blockIndex, idx)] ?? null)
    );
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
          <View style={styles.blockHeaderText}>
            <Text style={styles.blockTitle} numberOfLines={2}>{blockTitle}</Text>
            {/* Label affiné (getBlockLabel) — cohérent avec la Preview ; l'intensité passe en badge. */}
            <Text style={styles.blockMeta}>
              {getBlockLabel(block)} · {block.durationMin ?? "?"} min
            </Text>
          </View>
          <View style={styles.blockHeaderBadges}>
            {block.intensity ? (
              // frIntensity (P1-12) : plus de token backend brut sur les cartes.
              <Badge label={frIntensity(block.intensity)} tone={intensityTone(block.intensity)} />
            ) : null}
            {isComplete ? <Badge label="OK" tone="ok" /> : null}
          </View>
        </View>

        {/* Consigne de bloc (ex. "enchaîne 1→2→3, ×3 tours") — masque les lignes token:. */}
        {cleanDisplayNote(block.notes) ? (
          <Text style={styles.blockNotes}>{cleanDisplayNote(block.notes)}</Text>
        ) : null}

        {items.length === 0 ? (
          <Text style={styles.blockEmpty}>Bloc sans items détaillés.</Text>
        ) : (
          <View style={{ gap: 10 }}>
            {items.map((item, itemIndex) => {
              const key = getItemKey(blockIndex, itemIndex);
              // Boucle de suivi (Lot 2) : statut reel de l'item + nom du remplacement
              // affiche A LA PLACE de l'original (jamais les deux a la fois).
              const execItem = execItemsByKey?.[key] ?? null;
              const isReplaced = execItem?.status === "replaced" && !!execItem.replacement;
              const itemProgress = getItemProgress(
                checkedSets,
                blockIndex,
                itemIndex,
                item,
                execItem
              );
              const checkedItem = itemProgress.complete;
              const itemName = getDisplayName(item);
              // Fix P1-1 : un item REMPLACE affiche la prescription du
              // remplacement (sets/reps/duree/repos), jamais celle de
              // l'original -- qui ne correspond plus a ce qui est reellement
              // fait sur le terrain.
              const meta =
                isReplaced && execItem?.replacement
                  ? formatReplacementMeta(execItem.replacement.prescription)
                  : formatItemMeta(item);
              // Fix P1-1 : la fiche pointe vers le remplacement (uniquement si
              // son id existe reellement dans la banque) plutot que l'original.
              const exerciseId =
                isReplaced && execItem?.replacement
                  ? EXERCISE_BY_ID[execItem.replacement.replacementExerciseId]
                    ? execItem.replacement.replacementExerciseId
                    : null
                  : getExerciseId(item);
              const pulse = getPulse(key);
              const setCount = itemProgress.total;
              const doneSets = itemProgress.done;
              const setState = itemProgress.sets;
              const displayItemName =
                isReplaced && execItem?.replacement
                  ? resolveReplacementName(execItem.replacement.replacementExerciseId)
                  : itemName;
              const statusBadge =
                execItem && (execItem.status === "adapted" || execItem.status === "skipped" || execItem.status === "replaced")
                  ? STATUS_BADGE[execItem.status]
                  : null;
              return (
                <View key={key} style={styles.itemRow}>
                  <View style={styles.itemMain}>
                    {setCount <= 1 ? (
                      <TouchableOpacity
                        onPress={() =>
                          onToggleSet(blockIndex, itemIndex, 0, item, items)
                        }
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        activeOpacity={0.85}
                        accessibilityRole="checkbox"
                        accessibilityLabel={`${itemName}, ${checkedItem ? 'terminé' : 'à faire'}`}
                        accessibilityState={{ checked: !!checkedItem }}
                      >
                        <Animated.View
                          style={[
                            styles.checkbox,
                            checkedItem && {
                              backgroundColor: cycleTheme.soft,
                              borderColor: cycleTheme.strong,
                            },
                            { transform: [{ scale: pulse }] },
                          ]}
                        >
                          {checkedItem ? (
                            <Text style={[styles.checkboxIcon, { color: cycleTheme.textOnSoft }]}>✓</Text>
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
                                onToggleSet(
                                  blockIndex,
                                  itemIndex,
                                  setIndex,
                                  item,
                                  items
                                )
                              }
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              style={[
                                styles.setChip,
                                done && {
                                  backgroundColor: cycleTheme.soft,
                                  borderColor: cycleTheme.strong,
                                },
                              ]}
                              activeOpacity={0.85}
                              accessibilityRole="checkbox"
                              accessibilityLabel={`Série ${setIndex + 1} sur ${setCount}, ${done ? 'terminée' : 'à faire'}`}
                              accessibilityState={{ checked: !!done }}
                            >
                              <Text
                                style={[
                                  styles.setChipText,
                                  done && { color: cycleTheme.textOnSoft },
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
                      <Text style={styles.itemName} numberOfLines={2}>{displayItemName}</Text>
                      {statusBadge ? (
                        <Badge label={statusBadge.label} tone={statusBadge.tone} style={styles.itemStatusBadge} />
                      ) : null}
                      {/* Fix P1-1 : un item REMPLACE masque description/contexte foot/
                          consigne de l'ORIGINAL (la charge de l'original n'a plus lieu
                          d'etre affichee) -- seule la note du remplacement (si fournie
                          par le registre/fallback) est montree. */}
                      {isReplaced && execItem?.replacement ? (
                        <>
                          {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                          {execItem.replacement.prescription.note ? (
                            <Text style={styles.itemNote}>{execItem.replacement.prescription.note}</Text>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {item.description ? (
                            <Text style={styles.itemNote}>{item.description}</Text>
                          ) : null}
                          {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                          {item.footballContext ? (
                            <Text style={styles.itemContext}>{item.footballContext}</Text>
                          ) : null}
                          {cleanDisplayNote(item.notes) ? (
                            <Text style={styles.itemNote}>{cleanDisplayNote(item.notes)}</Text>
                          ) : null}
                        </>
                      )}
                    </View>
                  </View>
                  <View style={styles.itemActionsCol}>
                    {exerciseId ? (
                      <TouchableOpacity
                        onPress={() => onOpenExercise(exerciseId)}
                        activeOpacity={0.85}
                        style={styles.itemLink}
                      >
                        <Text style={styles.itemLinkText}>Fiche</Text>
                      </TouchableOpacity>
                    ) : null}
                    {execItemsByKey ? (
                      // Fix recette telephone : le declencheur "..." etait invisible
                      // (personne ne savait que Remplacer/Adapter/Passer existait).
                      // Affordance explicite mais discrete : pill icone + libelle
                      // court, meme comportement (ouvre ItemActionsSheet).
                      <TouchableOpacity
                        onPress={() => onOpenActions(blockIndex, itemIndex, item)}
                        activeOpacity={0.85}
                        style={styles.itemMoreButton}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Options pour ${itemName} : adapter, sauter, ou signaler que tu ne peux pas le faire`}
                      >
                        <Ionicons name="options-outline" size={14} color={palette.text} />
                        <Text style={styles.itemMoreButtonText}>Modifier</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>
    </Animated.View>
  );
});

function SessionLiveScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<LiveRoute>();
  const { v2, plannedDateISO, sessionId } = route.params;
  const soundsEnabled = useSettingsStore((s) => s.soundsEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const microcycleGoal = useSessionsStore((s) => s.microcycleGoal);
  // Thème couleur du cycle : STATIQUE pour toute la séance → calculé une seule fois.
  // Identité stable (useMemo) → passé en prop à la BlockCard mémoïsée sans casser le memo,
  // et hors du tick chrono (aucun re-render à la seconde).
  const cycleTheme = useMemo(() => getCycleTheme(microcycleGoal), [microcycleGoal]);

  // ---- Boucle de suivi joueur (Lot 2) ----
  // Defauts ON (collect/shadow) sans lire de doc Firestore ici (voir modes.ts).
  const trackingModes = useMemo(() => resolveTrackingModes(), []);
  const trackingActive = trackingModes.collect && !!sessionId;
  const execution = useExecutionStore((s) => s.current);
  const execItemsByKey = useMemo(() => {
    if (!trackingActive || !execution || execution.sessionId !== sessionId) return null;
    const map: Record<string, ItemExecution> = {};
    execution.items.forEach((it) => {
      map[it.key] = it;
    });
    return map;
  }, [trackingActive, execution, sessionId]);
  const externalMatchDays = useExternalStore((s) => s.matchDays);
  const externalMatchDay = useExternalStore((s) => s.matchDay);
  const ageCategory = useExternalStore((s) => s.ageCategory);
  const tsb = useLoadStore((s) => s.tsb);
  // Gênes déclarées dans « Mon corps » : même source que la génération, via
  // l'unique sélecteur. L'écran s'y abonne, donc un changement de statut fait
  // pendant la séance est pris en compte tout de suite.
  const { pains: activePains } = useContraintesDouleur();
  const matchSoon = useMemo(() => {
    const ctx = execution?.snapshot.matchContext;
    return ctx === "match_today" || ctx === "match_tomorrow" || ctx === "match_in_two_days";
  }, [execution]);

  const { width } = useWindowDimensions();
  const blocks: Block[] = useMemo(
    () => (Array.isArray(v2.blocks) ? v2.blocks : []),
    [v2.blocks]
  );
  const title = v2.title || "Séance FKS";
  const subtitle = v2.subtitle;

  const [checkedSets, setCheckedSets] = useState<Record<string, boolean[]>>({});
  const [activeBlock, setActiveBlock] = useState(0);

  // L'écran ne doit jamais se mettre en veille pendant une séance (mains occupées).
  useKeepAwake();

  const [sessionRunning, setSessionRunning] = useState(false);
  // Vrai dès que le chrono a démarré une fois (une pause ne doit pas
  // désarmer la confirmation de sortie).
  const [everStarted, setEverStarted] = useState(false);
  useEffect(() => {
    if (sessionRunning) setEverStarted(true);
  }, [sessionRunning]);
  const timerRef = useRef<SessionTimerHandle>(null);
  const handleReachMax = useCallback(() => setSessionRunning(false), []);

  const [restRunning, setRestRunning] = useState(false);
  const [restSec, setRestSec] = useState(0);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [restSource, setRestSource] = useState<"auto" | "manual" | null>(null);
  // Circuit 40/20 : enchaîne travail → repos × tours (preset display.timer_presets).
  // Mutuellement exclusif avec le repos simple ci-dessus.
  const [circuitState, setCircuitState] = useState<CircuitState | null>(null);
  const circuitActive = circuitState !== null;
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
  // --- Fix 1: Disable swipe back + confirm before leaving ---
  const hasStarted = sessionRunning || everStarted || Object.keys(checkedSets).length > 0;
  // Séance terminée (finishAction) : le reset vers Home émis par Summary/Feedback
  // repasse par beforeRemove — il ne faut PAS re-demander confirmation.
  const finishedRef = useRef(false);

  useEffect(() => {
    nav.setOptions({ gestureEnabled: false });
  }, [nav]);

  useEffect(() => {
    if (!hasStarted) return;
    const unsubscribe = nav.addListener("beforeRemove", (e: any) => {
      if (finishedRef.current) return;
      // Allow programmatic navigation (e.g. finishAction → SessionSummary)
      if (e.data.action.type === "NAVIGATE") return;
      e.preventDefault();
      Alert.alert(
        "Quitter la séance ?",
        "Ta progression sera perdue.",
        [
          { text: "Rester", style: "cancel" },
          {
            text: "Quitter",
            style: "destructive",
            onPress: () => {
              AsyncStorage.removeItem("fks_live_session").catch((err) => {
                if (__DEV__) console.error("[SessionLive] Failed to clear live session on quit:", err);
              });
              nav.dispatch(e.data.action);
            },
          },
        ]
      );
    });
    return unsubscribe;
  }, [nav, hasStarted]);

  // --- Boucle de suivi joueur (Lot 2) : snapshot + execution au lancement ---
  const buildAndStartExecution = useCallback(
    (launchedAtISO: string) => {
      if (!sessionId) return;
      const sessionsState = useSessionsStore.getState();
      const generatedAtISO = sessionsState.getSessionById(sessionId)?.createdAt ?? null;
      const matchDaysList = externalMatchDays.length > 0 ? externalMatchDays : externalMatchDay ? [externalMatchDay] : [];

      const meta: PrescribedSnapshotMeta = {
        sessionId,
        launchedAtISO,
        generatedAtISO,
        cycleGoal: sessionsState.microcycleGoal ?? null,
        sessionIndex: sessionsState.microcycleSessionIndex,
        phase: null,
        matchContext: deriveMatchContext(matchDaysList, launchedAtISO),
      };

      const snapshot = buildPrescribedSnapshot(v2, meta);
      useExecutionStore.getState().startExecution(initExecution(snapshot, launchedAtISO));
      trackEvent("live_session_started", { sessionId, itemCount: snapshot.items.length });
    },
    [sessionId, v2, externalMatchDays, externalMatchDay]
  );

  // Reprise apres crash : reutilise l'execution existante SEULEMENT si meme
  // sessionId ET pas encore finalisee (finishedAtISO absent). Fix P1-2 : sans
  // cette 2e condition, une execution deja cloturee (app tuee sur le Summary
  // avant le feedback, puis relance de la MEME seance) etait reutilisee telle
  // quelle -- badges perimes affiches d'entree, et finishCurrent devenait un
  // no-op en fin de 2e passage (garde `finishedAtISO` deja pose dans le
  // store), donc ce 2e passage n'etait JAMAIS capture. Ici, une execution
  // finalisee ne bloque plus une nouvelle execution : elle reste dans history
  // (finishCurrent l'y a deja poussee, dedupliquee par sessionId -- cf. P2-d),
  // et le feedback la retrouve via getExecutionForSession (qui priorise
  // history sur current, cf. useExecutionStore.ts). forceRestart=true (choix
  // "Recommencer" du prompt de reprise) reinitialise dans tous les cas.
  const ensureExecution = useCallback(
    (forceRestart: boolean) => {
      if (!trackingActive) return;
      const existing = useExecutionStore.getState().current;
      if (!forceRestart && existing && existing.sessionId === sessionId && !existing.finishedAtISO) return;
      buildAndStartExecution(new Date().toISOString());
    },
    [trackingActive, sessionId, buildAndStartExecution]
  );

  const execInitRef = useRef(false);
  useEffect(() => {
    if (execInitRef.current) return;
    execInitRef.current = true;
    ensureExecution(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report des series cochees dans l'execution — memes moments que la
  // persistance live (fingerprint + interval 30s), jamais a chaque toggle.
  const syncExecutionFromLive = useCallback(() => {
    if (!trackingActive) return;
    useExecutionStore.getState().updateCurrent((exec) => syncSetsFromLive(exec, checkedSets));
  }, [trackingActive, checkedSets]);

  // Actions par exercice (feuille "..." -> Adapte/Saute/Remplacement)
  const [sheetTarget, setSheetTarget] = useState<{
    blockIndex: number;
    itemIndex: number;
    key: string;
    item: BlockItem;
  } | null>(null);
  const [replacementFlow, setReplacementFlow] = useState<{
    key: string;
    exerciseId: string;
    originalName: string;
    reason: DeviationReason;
    proposals: ReplacementProposal[];
    shownIndex: number;
  } | null>(null);
  // Fix P2-b : propositions deja vues/refusees pendant CETTE session (par cle
  // d'item), pour ne jamais re-proposer la meme alternative si le joueur
  // rouvre "Je ne peux pas faire cet exercice" sur le meme item plus tard.
  // Etat local volontairement -- pas besoin de persister au-dela de la seance.
  const [refusedReplacementsByKey, setRefusedReplacementsByKey] = useState<Record<string, string[]>>({});

  const openItemActions = useCallback((blockIndex: number, itemIndex: number, item: BlockItem) => {
    const key = getItemKey(blockIndex, itemIndex);
    setSheetTarget({ blockIndex, itemIndex, key, item });
  }, []);
  const closeItemActions = useCallback(() => setSheetTarget(null), []);

  // Fix P2-b : la feuille d'options titre le nom REELLEMENT affiche a l'ecran
  // (le remplacement si l'item est deja remplace), jamais l'original masque.
  const sheetItemName = useMemo(() => {
    if (!sheetTarget) return "";
    const execItem = execItemsByKey?.[sheetTarget.key] ?? null;
    if (execItem?.status === "replaced" && execItem.replacement) {
      return resolveReplacementName(execItem.replacement.replacementExerciseId);
    }
    return getDisplayName(sheetTarget.item);
  }, [sheetTarget, execItemsByKey]);

  const sheetFields = useMemo(() => {
    if (!sheetTarget) return { loadKg: false, reps: true, distanceM: false, durationS: false };
    return deriveActualFieldsConfig({
      notes: sheetTarget.item.notes,
      name: sheetTarget.item.name,
      modality: sheetTarget.item.modality,
      workS: sheetTarget.item.workS,
      durationMin: sheetTarget.item.durationMin,
      reps: sheetTarget.item.reps,
    });
  }, [sheetTarget]);

  const handleAdapt = useCallback(
    (reason: DeviationReason, actual: ActualValues | null, comment: string | null) => {
      if (!sheetTarget) return;
      const { key } = sheetTarget;
      useExecutionStore.getState().updateCurrent((exec) => {
        let next = setItemStatus(exec, key, "adapted", reason, comment);
        if (actual) next = setItemActual(next, key, actual);
        return next;
      });
      trackEvent("live_exercise_marked", { status: "adapted", reason });
      setSheetTarget(null);
    },
    [sheetTarget]
  );

  const handleSkip = useCallback(
    (reason: DeviationReason, comment: string | null) => {
      if (!sheetTarget) return;
      const { key } = sheetTarget;
      useExecutionStore.getState().updateCurrent((exec) => setItemStatus(exec, key, "skipped", reason, comment));
      trackEvent("live_exercise_marked", { status: "skipped", reason });
      setSheetTarget(null);
    },
    [sheetTarget]
  );

  const handleCannotDo = useCallback(
    (reason: DeviationReason) => {
      if (!sheetTarget) return;
      const { key, item } = sheetTarget;
      const currentExec = useExecutionStore.getState().current;
      const snapshotItem = currentExec?.snapshot.items.find((p) => p.key === key);
      const exerciseId = snapshotItem?.exerciseId ?? getExerciseId(item) ?? key;
      const originalName = snapshotItem?.name ?? getDisplayName(item);

      // Fix P2-b : si l'item est DEJA remplace, le remplacement courant ne
      // doit jamais etre re-propose -- et les propositions deja refusees
      // pendant cette session (memorisees a la fermeture sans acceptation,
      // cf. handleSkipReplacement) non plus. Le lookup par exerciseId reste
      // l'ORIGINAL (registre/fallback sont keyed sur l'id prescrit), seul
      // excludeIds change.
      const currentReplacementId =
        currentExec?.items.find((it) => it.key === key)?.replacement?.replacementExerciseId ?? null;
      const priorExcludes = refusedReplacementsByKey[key] ?? [];
      const excludeIds = Array.from(
        new Set([...(currentReplacementId ? [currentReplacementId] : []), ...priorExcludes])
      );

      const request: ReplacementRequest = {
        exerciseId,
        reason,
        context: {
          equipmentAvailable: v2.equipmentAvailable ?? v2.equipmentUsed ?? [],
          ageCategory: ageCategory ?? null,
          activePains,
          matchSoon,
          highFatigue: tsb < -10,
          solo: true,
          excludeIds,
        },
        prescribed: snapshotItem
          ? { sets: snapshotItem.sets, reps: snapshotItem.reps, durationS: snapshotItem.workS, restS: snapshotItem.restS }
          : undefined,
      };

      const proposals = buildReplacementChain(request);
      trackEvent(proposals.length > 0 ? "live_replacement_proposed" : "live_replacement_none_available", {
        originalId: exerciseId,
        altId: proposals[0]?.exerciseId,
      });

      setSheetTarget(null);
      setReplacementFlow({ key, exerciseId, originalName, reason, proposals, shownIndex: 0 });
    },
    [sheetTarget, v2.equipmentAvailable, v2.equipmentUsed, ageCategory, activePains, matchSoon, tsb, refusedReplacementsByKey]
  );

  const closeReplacementFlow = useCallback(() => setReplacementFlow(null), []);

  const handleAcceptReplacement = useCallback(() => {
    if (!replacementFlow) return;
    const proposal = replacementFlow.proposals[replacementFlow.shownIndex];
    if (!proposal) return;
    const { key, exerciseId, reason } = replacementFlow;
    useExecutionStore.getState().updateCurrent((exec) =>
      applyReplacement(exec, key, {
        originalExerciseId: exerciseId,
        replacementExerciseId: proposal.exerciseId,
        reason,
        equivalent: proposal.equivalent,
        prescription: proposal.prescription,
      })
    );
    useExecutionStore.getState().recordReplacementPreference(exerciseId, proposal.exerciseId, reason);
    trackEvent("live_replacement_accepted", { originalId: exerciseId, altId: proposal.exerciseId });
    setReplacementFlow(null);
  }, [replacementFlow]);

  const handleSeeAnotherReplacement = useCallback(() => {
    setReplacementFlow((prev) => (prev ? { ...prev, shownIndex: prev.shownIndex + 1 } : prev));
  }, []);

  const handleSkipReplacement = useCallback(() => {
    if (!replacementFlow) return;
    const { key, reason, proposals, shownIndex, exerciseId } = replacementFlow;
    const proposal = proposals[shownIndex];
    useExecutionStore.getState().updateCurrent((exec) => setItemStatus(exec, key, "skipped", reason, null));
    if (proposal) {
      trackEvent("live_replacement_refused", { originalId: exerciseId, altId: proposal.exerciseId });
    }
    // Fix P2-b : memorise les propositions vues jusqu'a l'index affiche (donc
    // reellement montrees au joueur) pour ne plus les re-proposer si "Je ne
    // peux pas faire cet exercice" est rouvert plus tard sur ce meme item.
    const seenIds = proposals.slice(0, shownIndex + 1).map((p) => p.exerciseId);
    if (seenIds.length > 0) {
      setRefusedReplacementsByKey((prev) => ({
        ...prev,
        [key]: Array.from(new Set([...(prev[key] ?? []), ...seenIds])),
      }));
    }
    setReplacementFlow(null);
  }, [replacementFlow]);

  // --- Fix 2: Persist progress to AsyncStorage ---
  // Ne JAMAIS écrire avant la fin du check de récupération : sinon l'état vide
  // du mount écrase la sauvegarde d'une séance tuée (AsyncStorage sérialise
  // les opérations dans l'ordre) et le prompt "Reprendre ?" ne s'affiche jamais.
  const recoveryDoneRef = useRef(false);
  const persistState = useCallback(() => {
    if (!recoveryDoneRef.current) return;
    const data: PersistedLiveState = {
      sessionId,
      checkedSets,
      activeBlock,
      sessionSec: timerRef.current?.getSeconds() ?? 0,
      sessionRunning,
      savedAt: Date.now(),
    };
    AsyncStorage.setItem(LIVE_SESSION_KEY, JSON.stringify(data)).catch((err) => {
      if (__DEV__) console.error("[SessionLive] Failed to persist live session state:", err);
    });
  }, [sessionId, checkedSets, activeBlock, sessionRunning]);

  // Save on every significant change (set toggled, block changed)
  const lastPersistRef = useRef<string>("");
  useEffect(() => {
    const fingerprint = `${JSON.stringify(checkedSets)}|${activeBlock}`;
    if (fingerprint === lastPersistRef.current) return;
    lastPersistRef.current = fingerprint;
    persistState();
    syncExecutionFromLive();
  }, [checkedSets, activeBlock, persistState, syncExecutionFromLive]);

  // Also save chrono every 30s while running
  useEffect(() => {
    if (!sessionRunning) return;
    const id = setInterval(() => {
      persistState();
      syncExecutionFromLive();
    }, 30_000);
    return () => clearInterval(id);
  }, [sessionRunning, persistState, syncExecutionFromLive]);

  // Restore on mount if matching session exists
  const [showRecovery, setShowRecovery] = useState(false);
  const recoveredRef = useRef(false);
  useEffect(() => {
    if (recoveredRef.current) return;
    recoveredRef.current = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LIVE_SESSION_KEY);
        if (!raw) return;
        const saved: PersistedLiveState = JSON.parse(raw);
        // Only recover if it's the same session and less than 4h old
        const isSameSession =
          saved.sessionId === sessionId ||
          (!saved.sessionId && !sessionId);
        const isFresh = Date.now() - saved.savedAt < 4 * 60 * 60 * 1000;
        if (!isSameSession || !isFresh) {
          await AsyncStorage.removeItem(LIVE_SESSION_KEY);
          return;
        }
        const hasMeaningfulProgress =
          Object.values(saved.checkedSets).some((arr) => arr.some(Boolean)) ||
          saved.sessionSec > 30;
        if (!hasMeaningfulProgress) {
          await AsyncStorage.removeItem(LIVE_SESSION_KEY);
          return;
        }
        Alert.alert(
          "Séance en cours retrouvée",
          "Tu veux reprendre là où tu en étais ?",
          [
            {
              text: "Recommencer",
              style: "destructive",
              onPress: () => {
                ensureExecution(true);
                AsyncStorage.removeItem(LIVE_SESSION_KEY).catch((err) => {
                  if (__DEV__) console.error("[SessionLive] Failed to clear live session on restart:", err);
                });
              },
            },
            {
              text: "Reprendre",
              onPress: () => {
                setCheckedSets(saved.checkedSets);
                setActiveBlock(saved.activeBlock);
                timerRef.current?.setSeconds(saved.sessionSec);
                if (saved.sessionRunning) setSessionRunning(true);
              },
            },
          ]
        );
      } catch {
        // Corrupted data — ignore
      } finally {
        recoveryDoneRef.current = true;
      }
    })();
    // ensureExecution est reference dans le onPress "Recommencer" ci-dessus
    // (fix P1-2) : cet effet reste volontairement "une fois par mount" (garde
    // recoveredRef), meme pattern que l'effet execInitRef plus haut -- ajouter
    // ensureExecution aux deps ne changerait rien (la garde bloque toute
    // re-entree) mais laisserait croire a un re-declenchement voulu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Clear persistence when finishing the session
  const clearPersistedSession = useCallback(() => {
    AsyncStorage.removeItem(LIVE_SESSION_KEY).catch((err) => {
      if (__DEV__) console.error("[SessionLive] Failed to clear persisted session on finish:", err);
    });
  }, []);

  const coachTip = useMemo(
    // La seance ENTIERE, pas le seul bloc actif : le choix de la phrase depend
    // du rang du bloc dans sa famille (2e bloc force -> 2e phrase du pool).
    () => getCoachTip(blocks, activeBlock),
    [blocks, activeBlock]
  );
  // Conseils IA d'Agent B : niveau SÉANCE (jamais par bloc) — cf. readCoachingTips.
  const coachingTips = useMemo(() => readCoachingTips(v2), [v2]);
  const timerPresets = useMemo(() => {
    const globalRaw = Array.isArray(v2.display?.timerPresets) ? v2.display?.timerPresets : [];
    const blockRaw = Array.isArray(blocks[activeBlock]?.timerPresets)
      ? blocks[activeBlock]?.timerPresets ?? []
      : [];
    const source = blockRaw.length > 0 ? blockRaw : globalRaw;
    const unique = new Set<string>();
    return source
      .map((preset) => ({
        label: preset.label ?? null,
        workS: typeof preset.workS === "number" ? preset.workS : null,
        restS: typeof preset.restS === "number" ? preset.restS : null,
        rounds: typeof preset.rounds === "number" ? preset.rounds : null,
      }))
      .filter((preset) => preset.label || (preset.workS != null && preset.restS != null))
      .filter((preset) => {
        const key = `${preset.label ?? ""}|${preset.workS ?? ""}|${preset.restS ?? ""}|${preset.rounds ?? ""}`;
        if (unique.has(key)) return false;
        unique.add(key);
        return true;
      })
      .slice(0, 4);
  }, [v2.display?.timerPresets, blocks, activeBlock]);
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

  const getPulse = useCallback((key: string) => {
    if (!pulseMap.current[key]) {
      pulseMap.current[key] = new Animated.Value(1);
    }
    return pulseMap.current[key];
  }, []);

  const triggerPulse = useCallback((key: string) => {
    const pulse = getPulse(key);
    pulse.setValue(0.86);
    Animated.sequence([
      Animated.spring(pulse, { toValue: 1.08, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();
  }, [getPulse]);

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

  // Chrono de circuit : à chaque seconde, décompte la phase courante puis
  // bascule travail→repos, et repos→tour suivant jusqu'au dernier tour.
  useEffect(() => {
    if (!circuitActive) return;
    const id = setInterval(() => {
      setCircuitState((prev) => {
        if (!prev) return prev;
        if (prev.secLeft > 1) return { ...prev, secLeft: prev.secLeft - 1 };
        // Fin de phase → transition (même logique de signal que le repos).
        playRestSignal();
        if (prev.phase === "work" && prev.restS > 0) {
          return { ...prev, phase: "rest", secLeft: prev.restS };
        }
        // restS = 0 : pas de phase repos fantôme, on enchaîne le tour suivant.
        if (prev.round < prev.totalRounds) {
          return { ...prev, round: prev.round + 1, phase: "work", secLeft: Math.max(1, prev.workS) };
        }
        return null; // circuit terminé
      });
    }, 1000);
    return () => clearInterval(id);
  }, [circuitActive, playRestSignal]);

  const startCircuit = useCallback(
    (workS: number, restS: number, rounds: number) => {
      const w = Math.max(1, Math.round(workS));
      const r = Math.max(0, Math.round(restS));
      const total = Math.max(1, Math.round(rounds));
      // Exclusif avec le repos simple.
      setRestRunning(false);
      setRestSec(0);
      setRestSource(null);
      setCircuitState({ workS: w, restS: r, totalRounds: total, round: 1, phase: "work", secLeft: w });
      if (hapticsEnabled && Platform.OS !== "web") Vibration.vibrate(20);
    },
    [hapticsEnabled]
  );

  const stopCircuit = useCallback(() => setCircuitState(null), []);

  const skipCircuitPhase = useCallback(() => {
    setCircuitState((prev) => {
      if (!prev) return prev;
      if (prev.phase === "work" && prev.restS > 0) return { ...prev, phase: "rest", secLeft: prev.restS };
      if (prev.round < prev.totalRounds) {
        return { ...prev, round: prev.round + 1, phase: "work", secLeft: Math.max(1, prev.workS) };
      }
      return null;
    });
  }, []);

  // Les setInterval JS sont suspendus quand l'app passe en arrière-plan / écran
  // verrouillé : au retour, on rattrape le temps réel écoulé sur le repos et le
  // circuit (sinon un repos de 60 s peut durer plusieurs minutes réelles).
  const advanceCircuit = (prev: CircuitState, elapsed: number): CircuitState | null => {
    let st = { ...prev };
    let left = elapsed;
    while (left > 0) {
      if (st.secLeft > left) return { ...st, secLeft: st.secLeft - left };
      left -= st.secLeft;
      if (st.phase === "work" && st.restS > 0) {
        st = { ...st, phase: "rest", secLeft: st.restS };
      } else if (st.round < st.totalRounds) {
        st = { ...st, round: st.round + 1, phase: "work", secLeft: Math.max(1, st.workS) };
      } else {
        return null;
      }
    }
    return st;
  };

  const backgroundedAtRef = useRef<number | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        if (backgroundedAtRef.current == null) backgroundedAtRef.current = Date.now();
        return;
      }
      if (state !== "active" || backgroundedAtRef.current == null) return;
      const elapsed = Math.floor((Date.now() - backgroundedAtRef.current) / 1000);
      backgroundedAtRef.current = null;
      if (elapsed < 1) return;
      setRestSec((s) => (s > 0 ? Math.max(0, s - elapsed) : s));
      setCircuitState((prev) => (prev ? advanceCircuit(prev, elapsed) : prev));
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const visible = restRunning || circuitActive;
    Animated.timing(restOverlay, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 140,
      useNativeDriver: true,
    }).start();
  }, [restRunning, circuitActive, restOverlay]);

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

  // Fix P1-1 : les compteurs globaux suivent aussi la prescription du
  // remplacement (getEffectiveSetCount) pour un item remplace -- sinon le
  // header afficherait un total de series qui ne correspond plus a ce qui est
  // reellement cochable a l'ecran.
  const totalItems = useMemo(() => {
    return blocks.reduce((acc, block, blockIndex) => {
      return (
        acc +
        (block.items ?? []).reduce(
          (sum, item, itemIndex) =>
            sum + getEffectiveSetCount(item, execItemsByKey?.[getItemKey(blockIndex, itemIndex)] ?? null),
          0
        )
      );
    }, 0);
  }, [blocks, execItemsByKey]);

  const completedItems = useMemo(() => {
    return blocks.reduce((acc, block, blockIndex) => {
      const items = block.items ?? [];
      const done = items.reduce((sum, item, itemIndex) => {
        const execItem = execItemsByKey?.[getItemKey(blockIndex, itemIndex)] ?? null;
        return sum + getItemProgress(checkedSets, blockIndex, itemIndex, item, execItem).done;
      }, 0);
      return acc + done;
    }, 0);
  }, [blocks, checkedSets, execItemsByKey]);

  const progress = totalItems > 0 ? completedItems / totalItems : 0;

  const startRest = useCallback(
    (seconds: number, source: "auto" | "manual" = "manual") => {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      setCircuitState(null); // exclusif avec le circuit
      setRestSource(source);
      setRestSec(Math.max(1, Math.round(seconds)));
      setRestRunning(true);
    },
    []
  );

  const toggleSet = useCallback(
    (
      blockIndex: number,
      itemIndex: number,
      setIndex: number,
      item: BlockItem,
      items: BlockItem[]
    ) => {
      const key = getItemKey(blockIndex, itemIndex);
      // Fix P1-1 : le nombre de series cochables suit la prescription du
      // remplacement quand l'item est remplace (cf. getEffectiveSetCount).
      const execItem = execItemsByKey?.[key] ?? null;
      const total = getEffectiveSetCount(item, execItem);
      setCheckedSets((prev) => {
        const current = getSetState(prev, key, total);
        const nextValue = !current[setIndex];
        const nextSets = [...current];
        nextSets[setIndex] = nextValue;
        const next = { ...prev, [key]: nextSets };
        if (nextValue) {
          triggerPulse(key);
          if (hapticsEnabled && Platform.OS !== "web") Vibration.vibrate(14);
          setSessionRunning(true);
          const restAuto = getAutoRestSeconds(item);
          if (restAuto) startRest(restAuto, "auto");
          const isComplete =
            items.length > 0 &&
            items.every((it, idx) =>
              isItemComplete(next, blockIndex, idx, it, execItemsByKey?.[getItemKey(blockIndex, idx)] ?? null)
            );
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
    },
    [blocks, hapticsEnabled, triggerPulse, startRest, execItemsByKey]
  );

  const isBlockComplete = (blockIndex: number, items: BlockItem[] = []) => {
    if (items.length === 0) return false;
    return items.every((item, idx) =>
      isItemComplete(checkedSets, blockIndex, idx, item, execItemsByKey?.[getItemKey(blockIndex, idx)] ?? null)
    );
  };

  useEffect(() => {
    if (!blocks.length) return;
    if (activeBlock >= blocks.length) setActiveBlock(0);
  }, [blocks, activeBlock]);

  const finishLabel = sessionId
    ? "Terminer et donner le feedback"
    : "Terminer la séance";

  const finishAction = () => {
    const elapsedSec = timerRef.current?.getSeconds() ?? 0;
    const estimatedRpe = (() => {
      if (typeof v2.rpeTarget === "number" && Number.isFinite(v2.rpeTarget)) {
        return Math.max(1, Math.min(10, Math.round(v2.rpeTarget)));
      }
      const intensity = (v2.intensity ?? "").toLowerCase();
      if (intensity.includes("hard")) return 8;
      if (intensity.includes("easy")) return 4;
      return 6;
    })();
    const durationMin =
      elapsedSec >= 60
        ? Math.max(5, Math.round(elapsedSec / 60))
        : typeof v2.durationMin === "number"
          ? Math.round(v2.durationMin)
          : undefined;
    const intensity = typeof v2.intensity === "string" ? v2.intensity : undefined;
    const focusRaw = v2.focusPrimary ?? v2.focusSecondary;
    const focus = typeof focusRaw === "string" ? focusRaw : undefined;
    const location = typeof v2.location === "string" ? v2.location : undefined;
    // Racine v2.recoveryTips (contrat backend actuel) + compat postSession.
    const recoveryTips = readRecoveryTips(v2);
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
        typeof v2?.estimatedLoad?.srpe === "number" && Number.isFinite(v2.estimatedLoad.srpe)
          ? v2.estimatedLoad.srpe
          : undefined,
      recoveryTips,
    };

    // Boucle de suivi (Lot 2) : cloture l'execution AVANT de naviguer.
    const proceedToSummary = (allAsPlanned: boolean) => {
      finishedRef.current = true;
      clearPersistedSession();

      if (trackingActive) {
        const execStore = useExecutionStore.getState();
        // Dernier report des series cochees avant de compter (unknown+complet -> done).
        execStore.updateCurrent((exec) => syncSetsFromLive(exec, checkedSets));
        if (allAsPlanned) {
          execStore.updateCurrent((exec) => markAllAsPlanned(exec));
        }
        const actualDurationMin = elapsedSec >= 60 ? Math.max(1, Math.round(elapsedSec / 60)) : null;
        execStore.finishCurrent(new Date().toISOString(), actualDurationMin);

        const finished = sessionId ? execStore.getExecutionForSession(sessionId) : undefined;
        if (finished) {
          trackEvent("live_session_finished", {
            sessionId,
            completionPct: finished.completion.pct,
            done: finished.completion.done,
            adapted: finished.completion.adapted,
            skipped: finished.completion.skipped,
            replaced: finished.completion.replacedEquivalent + finished.completion.replacedPartial,
            allAsPlanned: finished.allAsPlanned,
          });
        }
      }

      nav.navigate("SessionSummary", {
        sessionId,
        summary,
      });
    };

    if (!trackingActive) {
      proceedToSummary(false);
      return;
    }

    const currentExec = useExecutionStore.getState().current;
    const hasExplicit = currentExec ? hasExplicitItemStatus(currentExec.items) : false;

    if (hasExplicit) {
      proceedToSummary(false);
      return;
    }

    // Fix P2-a : l'ancienne 2e option ("J'ai fait des ajustements") fermait
    // l'alerte sans RIEN faire -- re-taper "Terminer" reposait la meme
    // question, seule issue visible = "Tout comme prevu" (donnees faussees).
    // 3 issues honnetes desormais, aucune impasse :
    // - "Tout s'est passe comme prevu" : marque tout unknown -> done, termine.
    // - "Je precise d'abord" : ferme l'alerte SANS terminer, invite (toast) a
    //   utiliser le bouton Modifier sur les exercices concernes puis a re-taper
    //   "Terminer" (qui, une fois un statut explicite pose, ne repose plus
    //   cette question -- cf. hasExplicit ci-dessus).
    // - "Terminer sans preciser" : termine tel quel (deja le comportement de
    //   proceedToSummary(false) -- items toutes-series-cochees -> done via
    //   finalize, le reste unknown, honnete).
    Alert.alert(
      "Comment s'est passée la séance ?",
      "Dis-nous rapidement si tout s'est déroulé comme prévu.",
      [
        { text: "Tout s'est passé comme prévu", onPress: () => proceedToSummary(true) },
        {
          text: "Je précise d'abord",
          style: "cancel",
          onPress: () => {
            showToast({
              type: "info",
              title: "Précise chaque écart",
              message: "Utilise le bouton Modifier sur les exercices concernés, puis termine la séance.",
            });
          },
        },
        { text: "Terminer sans préciser", onPress: () => proceedToSummary(false) },
      ]
    );
  };

  const goToExercise = useCallback((exerciseId: string | null) => {
    if (!exerciseId) return;
    nav.navigate("ExerciseDetail", { highlightId: exerciseId });
  }, [nav]);

  const renderBlock = useCallback(
    ({ item: block, index }: { item: Block; index: number }) => (
      <BlockCard
        block={block}
        blockIndex={index}
        blockWidth={blockWidth}
        itemSize={itemSize}
        scrollX={scrollX}
        checkedSets={checkedSets}
        onToggleSet={toggleSet}
        onOpenExercise={goToExercise}
        getPulse={getPulse}
        cycleTheme={cycleTheme}
        execItemsByKey={execItemsByKey}
        onOpenActions={openItemActions}
      />
    ),
    [blockWidth, itemSize, scrollX, checkedSets, toggleSet, goToExercise, getPulse, cycleTheme, execItemsByKey, openItemActions]
  );

  return (
    <Screen style={styles.safeArea}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Animated.View
            style={[
              styles.content,
              { opacity: enter, transform: [{ translateY: enterTranslate }] },
            ]}
          >
            <Card variant="surface" style={styles.heroCard}>
              {/* Header thémé par cycle — cohérent avec le header Preview */}
              <View style={[styles.headerBand, { backgroundColor: cycleTheme.strong }]}>
                <View style={styles.pill}>
                  <Ionicons name={cycleTheme.icon as any} size={26} color={cycleTheme.strong} />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.kicker}>Cycle {cycleTheme.label}</Text>
                  <Text style={styles.title} numberOfLines={2}>{title}</Text>
                  {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
                  {plannedDateISO ? (
                    <Text style={styles.headerDate}>{formatDayFR(plannedDateISO) || plannedDateISO}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.heroBody}>
                <View style={styles.tagRow}>
                  {v2.intensity ? (
                    <Badge label={frIntensity(v2.intensity)} tone={intensityTone(v2.intensity)} />
                  ) : null}
                  {v2.focusPrimary ? <Badge label={frFocus(v2.focusPrimary)} /> : null}
                  {v2.durationMin ? <Badge label={`${v2.durationMin} min`} /> : null}
                  {v2.rpeTarget ? <Badge label={`RPE ${v2.rpeTarget}`} /> : null}
                  {v2.location ? <Badge label={frLocation(v2.location)} /> : null}
                </View>

                <View style={styles.progressWrap}>
                  <Text style={styles.progressLabel}>
                    Progression : {completedItems}/{totalItems || "—"} séries
                  </Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: cycleTheme.strong }]} />
                  </View>
                </View>
              </View>
            </Card>

            <Card variant="soft" style={styles.timerCard}>
              <SectionHeader title="Chronos" />
              <View style={styles.timerRow}>
                <View style={styles.timerBlock}>
                  <Text style={styles.timerLabel}>Séance</Text>
                  <SessionTimer
                    ref={timerRef}
                    running={sessionRunning}
                    maxSec={MAX_SESSION_SEC}
                    onReachMax={handleReachMax}
                    style={styles.timerValue}
                  />
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
                  style={[
                    styles.timerButton,
                    // CTA de séance : couleur du cycle (override de l'orange) à l'état "Démarrer".
                    !sessionRunning && { backgroundColor: cycleTheme.strong, borderColor: cycleTheme.strong },
                  ]}
                />
                <Button
                  label="Réinit"
                  onPress={() => {
                    setSessionRunning(false);
                    timerRef.current?.reset();
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
                    style={[styles.restChip, { backgroundColor: cycleTheme.soft }]}
                    onPress={() => startRest(s, "manual")}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Repos ${s} secondes`}
                  >
                    <Text style={[styles.restChipText, { color: cycleTheme.textOnSoft }]}>{s}s</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.restChip, styles.restChipGhost, { backgroundColor: cycleTheme.soft, borderColor: cycleTheme.strong }]}
                  onPress={() => {
                    setRestRunning(false);
                    setRestSec(0);
                    setRestSource(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Arrêter le repos"
                >
                  <Text style={[styles.restChipGhostText, { color: cycleTheme.strong }]}>Stop</Text>
                </TouchableOpacity>
              </View>
              {timerPresets.length > 0 ? (
                <View style={styles.presetRow}>
                  {timerPresets.map((preset, idx) => (
                    <TouchableOpacity
                      key={`preset_${idx}`}
                      style={[styles.restChip, { backgroundColor: cycleTheme.soft }]}
                      onPress={() => {
                        const work = Number(preset.workS);
                        const rest = Number(preset.restS);
                        const rounds = Number(preset.rounds);
                        // Circuit complet (travail→repos ×tours) si une phase travail existe ; sinon repos seul.
                        if (Number.isFinite(work) && work > 0) {
                          startCircuit(
                            work,
                            Number.isFinite(rest) ? rest : 0,
                            Number.isFinite(rounds) && rounds > 0 ? rounds : 1
                          );
                        } else if (Number.isFinite(rest) && rest > 0) {
                          startRest(rest, "manual");
                        }
                      }}
                    >
                      <Text style={[styles.restChipText, { color: cycleTheme.textOnSoft }]}>{formatPresetLabel(preset)}</Text>
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
              renderItem={renderBlock}
              extraData={checkedSets}
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
                      isActive && [styles.dotActive, { backgroundColor: cycleTheme.strong }],
                    ]}
                  />
                );
              })}
            </View>

            {blocks.length > 0 ? (
              // Encadré conseil thémé : fond soft + barre gauche strong (comme en Preview)
              <Card
                variant="soft"
                style={[
                  styles.coachMiniCard,
                  { backgroundColor: cycleTheme.soft, borderLeftWidth: 3, borderLeftColor: cycleTheme.strong },
                ]}
              >
                <SectionHeader title={`Focus bloc ${Math.min(activeBlock + 1, blocks.length)}`} />
                <Text style={[styles.coachMiniText, { color: cycleTheme.textOnSoft }]}>{coachTip}</Text>
              </Card>
            ) : null}

            {/* Conseils du coach : les VRAIS tips d'Agent B, niveau séance.
                Contenu backend -> numberOfLines borné (règle d'or CLAUDE.md). */}
            {coachingTips ? (
              <Card variant="soft" style={styles.coachCard}>
                <SectionHeader title="Conseils du coach" />
                <View style={{ gap: 6 }}>
                  {coachingTips.map((tip: string, i: number) => (
                    <Text
                      key={`coach_${i}`}
                      style={styles.coachText}
                      numberOfLines={4}
                      testID={`live-coaching-tip-${i}`}
                    >
                      • {tip}
                    </Text>
                  ))}
                </View>
              </Card>
            ) : null}

            {/* Sécurité — miroir de la Preview (rendu seulement si le moteur le fournit). */}
            {v2.safetyNotes ? (
              <Card variant="soft" style={styles.coachCard}>
                <SectionHeader title="Sécurité" />
                <Text style={styles.coachText}>{v2.safetyNotes}</Text>
              </Card>
            ) : null}

            {/* CTA de séance : couleur du cycle (override de l'orange, cf. cycleTheme) */}
            <Button
              label={finishLabel}
              onPress={finishAction}
              fullWidth
              size="lg"
              style={{ backgroundColor: cycleTheme.strong, borderColor: cycleTheme.strong }}
            />
          </Animated.View>
        </ScrollView>

        <Animated.View
          pointerEvents={restRunning || circuitActive ? "auto" : "none"}
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
            {circuitState ? (
              <>
                <Text
                  style={[
                    styles.restOverlayTitle,
                    circuitState.phase === "work" && { color: cycleTheme.strong },
                  ]}
                >
                  {circuitState.phase === "work" ? "Travail" : "Repos"}
                </Text>
                <Text style={styles.restOverlayTime}>{formatTime(circuitState.secLeft)}</Text>
                <Text style={styles.restOverlayRounds}>
                  Tour {circuitState.round}/{circuitState.totalRounds}
                </Text>
                <View style={styles.restOverlayActions}>
                  <Button label="Passer" onPress={skipCircuitPhase} size="sm" variant="ghost" />
                  <Button label="Stop" onPress={stopCircuit} size="sm" variant="ghost" />
                </View>
              </>
            ) : (
              <>
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
              </>
            )}
          </View>
        </Animated.View>

        <ItemActionsSheet
          visible={!!sheetTarget}
          itemName={sheetItemName}
          fields={sheetFields}
          onClose={closeItemActions}
          onAdapt={handleAdapt}
          onSkip={handleSkip}
          onCannotDo={handleCannotDo}
        />

        <ReplacementSheet
          visible={!!replacementFlow}
          originalName={replacementFlow?.originalName ?? ""}
          proposal={replacementFlow ? replacementFlow.proposals[replacementFlow.shownIndex] ?? null : null}
          canSeeAnother={!!replacementFlow && replacementFlow.shownIndex + 1 < replacementFlow.proposals.length}
          onAccept={handleAcceptReplacement}
          onSeeAnother={handleSeeAnotherReplacement}
          onSkip={handleSkipReplacement}
          onClose={closeReplacementFlow}
        />
      </View>
    </Screen>
  );
}

// Export avec Error Boundary pour éviter les crashs
export default withSessionErrorBoundary(SessionLiveScreen);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  root: { flex: 1 },
  container: { padding: 16 },
  content: { gap: 16 },
  heroCard: { padding: 0, overflow: "hidden" },
  headerBand: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  pill: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 2 },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.78)",
  },
  headerDate: { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  heroBody: { padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: "600", color: "#fff" },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.82)", marginTop: 2 },
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.card,
    minHeight: 44,
    justifyContent: "center",
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
  restOverlayActions: { marginTop: 4, flexDirection: "row", gap: 8, justifyContent: "center", alignSelf: "stretch" },
  restOverlayRounds: {
    color: palette.sub,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  swipeHint: { color: palette.sub, fontSize: 12, marginTop: -6 },
  blockCardWrap: { marginBottom: 2 },
  blockCard: { padding: 14, gap: 10 },
  blockHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  blockHeaderText: { flex: 1 },
  blockHeaderBadges: { flexDirection: "row", gap: 6, flexShrink: 0 },
  blockTitle: { color: palette.text, fontSize: 15, fontWeight: "700" },
  blockMeta: { color: palette.sub, fontSize: 12, marginTop: 2 },
  blockNotes: { color: palette.sub, fontSize: 12, lineHeight: 18 },
  blockEmpty: { color: palette.sub, fontSize: 12 },
  itemRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  itemMain: { flex: 1, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  setsWrap: { minWidth: 70, alignItems: "flex-start", gap: 6 },
  setsLabel: { fontSize: 10, color: palette.sub, fontWeight: "600" },
  setsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  setChip: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.card,
  },
  setChipText: { fontSize: 12, color: palette.sub, fontWeight: "700" },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
  },
  checkboxIcon: { fontSize: 16, fontWeight: "800" },
  itemName: { color: palette.text, fontSize: 14, fontWeight: "600" },
  itemMeta: { color: palette.sub, fontSize: 12, marginTop: 2 },
  itemContext: { color: palette.text, fontSize: 11, marginTop: 2 },
  itemNote: { color: palette.sub, fontSize: 12, marginTop: 2 },
  itemActionsCol: { alignItems: "flex-end", gap: 8 },
  itemLink: {
    alignSelf: "flex-end",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    minHeight: 44,
    justifyContent: "center",
  },
  itemLinkText: { color: palette.accent, fontSize: 11, fontWeight: "700" },
  itemMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    alignSelf: "flex-end",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
    minHeight: 44,
  },
  itemMoreButtonText: { color: palette.text, fontSize: 11, fontWeight: "700" },
  itemStatusBadge: { alignSelf: "flex-start", marginTop: 4 },
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
