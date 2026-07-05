import React from "react";
import { type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";

import { Screen } from "./Screen";

type ScreenContainerProps = {
  children: React.ReactNode;
  scroll?: boolean;
  safeAreaStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollProps?: ScrollViewProps;
};

/**
 * Wrapper historique — delegue desormais a <Screen> (source unique de verite
 * pour la safe area, header-aware). Conserve pour compat des appelants
 * existants ; les nouveaux ecrans utilisent directement <Screen>.
 */
export function ScreenContainer({
  children,
  scroll = true,
  safeAreaStyle,
  contentContainerStyle,
  scrollProps,
}: ScreenContainerProps) {
  return (
    <Screen
      scroll={scroll}
      style={safeAreaStyle}
      contentContainerStyle={scroll ? [styles.container, contentContainerStyle] : undefined}
      scrollProps={scrollProps}
    >
      {children}
    </Screen>
  );
}

const styles = {
  container: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16,
  } as ViewStyle,
};
