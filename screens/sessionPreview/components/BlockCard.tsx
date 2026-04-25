// screens/sessionPreview/components/BlockCard.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { getBlockConfig, getBlockLabel, getTransitionLabel } from "../../../components/session/blockConfig";
import { getExerciseBenefit } from "../../../engine/exerciseBenefits";
import { getBeginnerSafetyWarning } from "../../../utils/beginnerSafety";
import { useSessionsStore } from "../../../state/stores/useSessionsStore";
import {
  type Block,
  type BlockItem,
  intensityTone,
  getCoachTip,
  getDisplayName,
  getExerciseId,
  formatItemMeta,
  cleanDisplayNote,
} from "../sessionPreviewConfig";

const palette = theme.colors;

type Props = {
  block: Block;
  blockIndex: number;
  previousBlock?: Block;
  checked: Record<string, boolean>;
  isComplete: boolean;
  isCompleted: boolean;
  blockAnim: Animated.Value;
  onToggleItem: (blockIndex: number, itemIndex: number) => void;
  onOpenVideo: (exerciseId: string | null) => void;
  getPulse: (key: string) => Animated.Value;
};

export function BlockCard({
  block,
  blockIndex,
  previousBlock,
  checked,
  isComplete,
  isCompleted,
  blockAnim,
  onToggleItem,
  onOpenVideo,
  getPulse,
}: Props) {
  const playerLevel = useSessionsStore((s) => s.playerLevel);
  const microcycleSessionIndex = useSessionsStore((s) => s.microcycleSessionIndex);
  const cfg = getBlockConfig(block.type);
  const items = block.items ?? [];
  const blockTitle =
    block.goal || block.name || block.type || block.focus || `Bloc ${blockIndex + 1}`;
  const tipText = getCoachTip(block, blockIndex);
  const blockOpacity = blockAnim;
  const blockTranslateY = blockAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  return (
    <React.Fragment>
      {blockIndex > 0 && previousBlock ? (
        <View style={styles.transitionRow}>
          <View style={styles.transitionLine} />
          <View style={styles.transitionChip}>
            <Ionicons name="arrow-down" size={12} color={palette.sub} />
            <Text style={styles.transitionText}>
              {getTransitionLabel(previousBlock, block)}
            </Text>
          </View>
          <View style={styles.transitionLine} />
        </View>
      ) : null}

      <Animated.View
        style={{
          opacity: blockOpacity,
          transform: [{ translateY: blockTranslateY }],
        }}
      >
        <Card variant="surface" style={styles.vBlockCard}>
          <View style={[styles.vBlockAccentBar, { backgroundColor: cfg.tint }]} />

          <View style={styles.vBlockInner}>
            <View style={styles.vBlockHeader}>
              <View style={[styles.vBlockIconWrap, { backgroundColor: cfg.tintSoft }]}>
                <Ionicons name={cfg.icon as any} size={16} color={cfg.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vBlockTitle} numberOfLines={2}>{blockTitle}</Text>
                <Text style={styles.vBlockMeta}>
                  {getBlockLabel(block)} {'\u00b7'} {block.durationMin ?? '?'} min
                </Text>
              </View>
              <View style={styles.vBlockBadges}>
                {block.intensity ? (
                  <Badge label={block.intensity} tone={intensityTone(block.intensity)} />
                ) : null}
                {isComplete ? <Badge label="OK" tone="ok" /> : null}
              </View>
            </View>

            {cleanDisplayNote(block.notes) ? (
              <Text style={styles.vBlockNotes}>{cleanDisplayNote(block.notes)}</Text>
            ) : null}

            {items.length > 0 ? (
              <View style={styles.vBlockItems}>
                {items.map((item, itemIndex) => {
                  const key = `${blockIndex}-${itemIndex}`;
                  const checkedItem = !!checked[key];
                  const itemName = getDisplayName(item);
                  const meta = formatItemMeta(item);
                  const exerciseId = getExerciseId(item);
                  const benefit = getExerciseBenefit(exerciseId);
                  const pulse = getPulse(key);
                  return (
                    <View key={key} style={styles.itemRow}>
                      <TouchableOpacity
                        onPress={() => onToggleItem(blockIndex, itemIndex)}
                        activeOpacity={0.85}
                        style={styles.itemMain}
                        disabled={isCompleted}
                      >
                        <Animated.View
                          style={[
                            styles.checkbox,
                            checkedItem && styles.checkboxChecked,
                            { transform: [{ scale: pulse }] },
                          ]}
                        >
                          {checkedItem ? (
                            <Text style={styles.checkboxIcon}>{'\u2713'}</Text>
                          ) : null}
                        </Animated.View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.itemName,
                              checkedItem && styles.itemNameChecked,
                            ]}
                            numberOfLines={2}
                          >
                            {itemName}
                          </Text>
                          {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                          {item.footballContext ? (
                            <Text style={styles.itemContext}>{item.footballContext}</Text>
                          ) : null}
                          {benefit ? (
                            <Text style={styles.itemBenefit}>{benefit}</Text>
                          ) : null}
                          {(() => {
                            const warning = getBeginnerSafetyWarning(
                              exerciseId,
                              playerLevel,
                              microcycleSessionIndex,
                            );
                            return warning ? (
                              <View style={styles.itemWarningRow}>
                                <Ionicons name="warning-outline" size={14} color={palette.warn} />
                                <Text style={styles.itemWarningText}>{warning}</Text>
                              </View>
                            ) : null;
                          })()}
                          {cleanDisplayNote(item.notes) ? (
                            <Text style={styles.itemNote}>{cleanDisplayNote(item.notes)}</Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                      {exerciseId ? (
                        <TouchableOpacity
                          onPress={() => onOpenVideo(exerciseId)}
                          activeOpacity={0.85}
                          style={styles.itemLink}
                        >
                          <Ionicons name="logo-youtube" size={14} color={palette.accent} />
                          <Text style={styles.itemLinkText}>Vidéo</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.blockEmpty}>Bloc sans exercices détaillés.</Text>
            )}

            <View style={styles.vBlockTipRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={13} color={palette.sub} />
              <Text style={styles.vBlockTipText}>{tipText}</Text>
            </View>
          </View>
        </Card>
      </Animated.View>
    </React.Fragment>
  );
}

const styles = StyleSheet.create({
  vBlockCard: { padding: 0, flexDirection: "row", overflow: "hidden" },
  vBlockAccentBar: {
    width: 4,
    borderTopLeftRadius: theme.radius.sm,
    borderBottomLeftRadius: theme.radius.sm,
  },
  vBlockInner: { flex: 1, padding: 14, gap: 10 },
  vBlockHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  vBlockIconWrap: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  vBlockTitle: { fontSize: TYPE.body.fontSize, fontWeight: "700", color: palette.text },
  vBlockMeta: { fontSize: TYPE.caption.fontSize, color: palette.sub, marginTop: 2 },
  vBlockBadges: { flexDirection: "row", gap: 6 },
  vBlockNotes: { fontSize: TYPE.caption.fontSize, color: palette.sub, lineHeight: 18 },
  vBlockItems: { gap: 10 },
  vBlockTipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.borderSoft,
  },
  vBlockTipText: { flex: 1, fontSize: TYPE.caption.fontSize, color: palette.sub, lineHeight: 16 },
  transitionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  transitionLine: { flex: 1, height: 1, backgroundColor: palette.borderSoft },
  transitionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  transitionText: { fontSize: TYPE.micro.fontSize, color: palette.sub, fontWeight: "600" },
  itemRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  itemMain: { flex: 1, flexDirection: "row", gap: 8, alignItems: "flex-start" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: palette.accent, borderColor: palette.accent },
  checkboxIcon: { color: palette.bg, fontSize: TYPE.caption.fontSize, fontWeight: "800" },
  itemName: { color: palette.text, fontSize: TYPE.body.fontSize, fontWeight: "600" },
  itemNameChecked: { textDecorationLine: "line-through", color: palette.sub },
  itemMeta: { color: palette.sub, fontSize: TYPE.caption.fontSize, marginTop: 2 },
  itemContext: { color: palette.text, fontSize: TYPE.micro.fontSize, marginTop: 2 },
  itemBenefit: { color: palette.accent, fontSize: TYPE.micro.fontSize, marginTop: 3, fontStyle: "italic" },
  itemWarningRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 6,
    padding: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: palette.amberSoft10,
    borderWidth: 1,
    borderColor: palette.amberSoft30,
  },
  itemWarningText: { flex: 1, color: palette.warn, fontSize: TYPE.caption.fontSize, lineHeight: 17, fontWeight: "600" },
  itemNote: { color: palette.sub, fontSize: TYPE.caption.fontSize, marginTop: 2 },
  itemLink: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  itemLinkText: { color: palette.accent, fontSize: TYPE.micro.fontSize, fontWeight: "700" },
  blockEmpty: { color: palette.sub, fontSize: TYPE.caption.fontSize },
});
