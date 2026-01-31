// components/ui/SectionHeader.tsx
import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "../../constants/theme";

type SectionHeaderProps = {
  title: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({ title, right, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.titleGroup}>
        <View style={styles.mark} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mark: {
    width: 3,
    height: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
  },
  title: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: theme.colors.text,
  },
});
