// screens/sessionPreview/components/BlockCard.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../constants/theme";
import { Card } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { getBlockVisual, getBlockLabel, getTransitionLabel } from "../../../components/session/blockConfig";
import { frIntensity } from "../../../utils/frLabels";
import { getExerciseBenefit } from "../../../engine/exerciseBenefits";
import {
  type Block,
  type BlockItem,
  intensityTone,
  getDisplayName,
  getExerciseId,
  formatItemMeta,
  cleanDisplayNote,
} from "../sessionPreviewConfig";
import { getItemTestReference, type TestReferenceValues } from "../testReferenceMapping";
import { type CycleTheme } from "../../../constants/cycleTheme";

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
  onGoToExercise: (exerciseId: string | null) => void;
  getPulse: (key: string) => Animated.Value;
  cycleTheme: CycleTheme;
  /** Dernieres valeurs de test terrain (par cle), pour la ligne de reference sous l'exercice. */
  testValues?: TestReferenceValues;
  /**
   * Phrase de l'encadre « Repere technique ». Calculee par le PARENT via
   * `coachTipsForBlocks(blocks)` : le choix depend du rang du bloc dans sa
   * famille, donc de la seance entiere, pas de ce bloc isole.
   */
  coachTip: string;
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
  onGoToExercise,
  getPulse,
  cycleTheme,
  testValues,
  coachTip,
}: Props) {
  const cfg = getBlockVisual(block);
  const items = block.items ?? [];
  const blockTitle =
    block.goal || block.name || block.type || block.focus || `Bloc ${blockIndex + 1}`;
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
                  // frIntensity (P1-12) : le token backend brut (« hard »,
                  // « moderate ») s'affichait en anglais sur chaque carte.
                  <Badge label={frIntensity(block.intensity)} tone={intensityTone(block.intensity)} />
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
                  const testRef = getItemTestReference(item, testValues);
                  const pulse = getPulse(key);
                  return (
                    <View key={key} style={styles.itemRow}>
                      <TouchableOpacity
                        onPress={() => onToggleItem(blockIndex, itemIndex)}
                        activeOpacity={0.85}
                        style={styles.itemMain}
                        disabled={isCompleted}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: checkedItem }}
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
                            <Text style={[styles.checkboxIcon, { color: cycleTheme.textOnSoft }]}>
                              {'\u2713'}
                            </Text>
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
                          {item.description ? (
                            <Text style={styles.itemNote}>{item.description}</Text>
                          ) : null}
                          {meta ? <Text style={styles.itemMeta}>{meta}</Text> : null}
                          {item.footballContext ? (
                            <Text style={styles.itemContext}>{item.footballContext}</Text>
                          ) : null}
                          {benefit ? (
                            <Text style={styles.itemBenefit}>{benefit}</Text>
                          ) : null}
                          {testRef ? (
                            <Text style={styles.itemTestRef} numberOfLines={1}>{testRef}</Text>
                          ) : null}
                          {cleanDisplayNote(item.notes) ? (
                            <Text style={styles.itemNote}>{cleanDisplayNote(item.notes)}</Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                      {exerciseId ? (
                        <TouchableOpacity
                          onPress={() => onGoToExercise(exerciseId)}
                          activeOpacity={0.85}
                          style={styles.itemLink}
                        >
                          <Ionicons name="play-circle-outline" size={14} color={palette.accent} />
                          <Text style={styles.itemLinkText}>Fiche</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.blockEmpty}>Bloc sans items détaillés.</Text>
            )}

            <View
              style={[
                styles.coachTipBox,
                { backgroundColor: cycleTheme.soft, borderLeftColor: cycleTheme.strong },
              ]}
            >
              <View style={styles.coachTipHeader}>
                <Ionicons name="chatbubble-ellipses-outline" size={12} color={cycleTheme.textOnSoft} />
                {/* « Repere technique » et NON « Conseil du coach » : ce texte
                    est un rappel local d'execution, alors que l'encart
                    « Conseils du coach » de la seance porte les VRAIS conseils
                    d'Agent B. Les deux intitules ne differaient que d'un « s ». */}
                <Text style={[styles.coachTipKicker, { color: cycleTheme.textOnSoft }]}>
                  Repère technique
                </Text>
              </View>
              <Text style={[styles.coachTipText, { color: cycleTheme.textOnSoft }]}>{coachTip}</Text>
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
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  vBlockTitle: { fontSize: 15, fontWeight: "700", color: palette.text },
  vBlockMeta: { fontSize: 12, color: palette.sub, marginTop: 2 },
  vBlockBadges: { flexDirection: "row", gap: 6 },
  vBlockNotes: { fontSize: 12, color: palette.sub, lineHeight: 18 },
  vBlockItems: { gap: 10 },
  // Encadré "Repère technique" : fond "soft" + barre gauche "strong" du cycle.
  // border-radius 0 côté barre (bord simple), arrondi côté opposé.
  coachTipBox: {
    gap: 4,
    padding: 10,
    borderLeftWidth: 3,
    borderTopRightRadius: theme.radius.sm,
    borderBottomRightRadius: theme.radius.sm,
  },
  coachTipHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  coachTipKicker: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  coachTipText: { fontSize: 12, lineHeight: 16 },
  transitionRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  transitionLine: { flex: 1, height: 1, backgroundColor: palette.borderSoft },
  transitionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  transitionText: { fontSize: 11, color: palette.sub, fontWeight: "600" },
  itemRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  itemMain: { flex: 1, flexDirection: "row", gap: 8, alignItems: "flex-start" },
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
  checkboxIcon: { fontSize: 12, fontWeight: "800" },
  itemName: { color: palette.text, fontSize: 14, fontWeight: "600" },
  itemNameChecked: { textDecorationLine: "line-through", color: palette.sub },
  itemMeta: { color: palette.sub, fontSize: 12, marginTop: 2 },
  itemContext: { color: palette.text, fontSize: 11, marginTop: 2 },
  itemBenefit: { color: palette.accent, fontSize: 11, marginTop: 3, fontStyle: "italic" },
  itemTestRef: { color: palette.sub, fontSize: 11, marginTop: 3 },
  itemNote: { color: palette.sub, fontSize: 12, marginTop: 2 },
  itemLink: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.cardSoft,
  },
  itemLinkText: { color: palette.accent, fontSize: 11, fontWeight: "700" },
  blockEmpty: { color: palette.sub, fontSize: 12 },
});
