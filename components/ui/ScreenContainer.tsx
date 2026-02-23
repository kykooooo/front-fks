import React from "react";
import { ScrollView, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "../../constants/theme";

const palette = theme.colors;

type ScreenContainerProps = {
  children: React.ReactNode;
  scroll?: boolean;
  safeAreaStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollViewProps;
  edges?: Array<"top" | "bottom" | "left" | "right">;
};

export function ScreenContainer({
  children,
  scroll = true,
  safeAreaStyle,
  contentContainerStyle,
  scrollProps,
  edges = ["top", "bottom", "left", "right"],
}: ScreenContainerProps) {
  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safeArea, safeAreaStyle]} edges={edges}>
        {children}
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.safeArea, safeAreaStyle]} edges={edges}>
      <ScrollView
        contentContainerStyle={[styles.container, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  } as ViewStyle,
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: palette.background,
    gap: 16,
  } as ViewStyle,
};
