// screens/sessionPreview/components/FlowStrip.tsx
import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme, TYPE, RADIUS } from "../../../constants/theme";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { getBlockConfig, getBlockLabel } from "../../../components/session/blockConfig";
import type { Block } from "../sessionPreviewConfig";

const palette = theme.colors;

type Props = {
  blocks: Block[];
  isBlockComplete: (blockIndex: number) => boolean;
};

export function FlowStrip({ blocks, isBlockComplete }: Props) {
  if (blocks.length === 0) return null;

  return (
    <View style={styles.flowSection}>
      <SectionHeader title="Déroulement" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.flowStrip}
      >
        {blocks.map((block, idx) => {
          const cfg = getBlockConfig(block.type);
          const done = isBlockComplete(idx);
          return (
            <React.Fragment key={`flow_${idx}`}>
              {idx > 0 ? (
                <View style={styles.flowConnector}>
                  <Ionicons name="chevron-forward" size={12} color={palette.borderSoft} />
                </View>
              ) : null}
              <View
                style={[
                  styles.flowCapsule,
                  { backgroundColor: cfg.tintSoft, borderColor: cfg.tint + "30" },
                ]}
              >
                <Ionicons name={cfg.icon as any} size={14} color={cfg.tint} />
                <Text style={[styles.flowCapsuleText, { color: cfg.tint }]}>
                  {getBlockLabel(block)}
                </Text>
                {done ? (
                  <Ionicons name="checkmark-circle" size={12} color={palette.success} />
                ) : null}
              </View>
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flowSection: { gap: 8 },
  flowStrip: { paddingVertical: 4, alignItems: "center" },
  flowCapsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  flowCapsuleText: { fontSize: TYPE.caption.fontSize, fontWeight: "700" },
  flowConnector: { paddingHorizontal: 2 },
});
