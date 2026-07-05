import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeaderHeightContext } from "@react-navigation/elements";

import { theme } from "../../constants/theme";

const palette = theme.colors;

type ScreenProps = {
  children: React.ReactNode;
  /**
   * `true` : <Screen> fournit son propre ScrollView (padding via
   * `contentContainerStyle`). `false` (defaut) : tu fournis toi-meme le
   * ScrollView / FlatList a l'interieur — <Screen> ne gere que la safe area.
   */
  scroll?: boolean;
  /** Enveloppe le contenu dans un KeyboardAvoidingView (inputs). */
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  /** Applique l'inset bas (home indicator). Defaut `true`. */
  bottomInset?: boolean;
  /** Style du conteneur exterieur (fond, flex). */
  style?: StyleProp<ViewStyle>;
  /** Style du contenu scrollable (uniquement si `scroll`). */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Props transmises au ScrollView interne (refreshControl, etc.). */
  scrollProps?: ScrollViewProps;
};

/**
 * SOURCE UNIQUE DE VERITE pour la safe area d'un ecran.
 *
 * La marge du haut est decidee ICI, une seule fois, en lisant la presence
 * d'un header natif (`HeaderHeightContext`) :
 *   - header present (headerHeight > 0)  -> il gere deja l'inset  -> paddingTop = 0
 *   - pas de header                      -> l'ecran gere l'inset  -> paddingTop = insets.top
 *
 * Plus aucun ecran ne choisit `edges={["top", ...]}` a la main : c'est ce
 * choix, dedouble entre RootNavigator (headerShown) et chaque ecran, qui
 * causait le "whack-a-mole" de safe area (double marge iOS / contenu sous la
 * Dynamic Island / casse Android). Voir CLAUDE.md > Regle d'or ecrans.
 */
export function Screen({
  children,
  scroll = false,
  keyboardAvoiding = false,
  keyboardVerticalOffset,
  bottomInset = true,
  style,
  contentContainerStyle,
  scrollProps,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  // `?? 0` : `useHeaderHeight()` leverait une exception hors d'un header ;
  // le contexte brut renvoie `undefined` sur un ecran sans header -> 0.
  const headerHeight = React.useContext(HeaderHeightContext) ?? 0;

  const padding: ViewStyle = {
    paddingTop: headerHeight > 0 ? 0 : insets.top,
    paddingBottom: bottomInset ? insets.bottom : 0,
    // Insets horizontaux : 0 en portrait (l'app est portrait-lock), corrects
    // en cas d'encoche laterale / futur mode paysage.
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  let content: React.ReactNode = children;

  if (scroll) {
    content = (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...scrollProps}
      >
        {children}
      </ScrollView>
    );
  }

  if (keyboardAvoiding) {
    content = (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {content}
      </KeyboardAvoidingView>
    );
  }

  return <View style={[styles.container, padding, style]}>{content}</View>;
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: palette.background,
  } as ViewStyle,
  flex: { flex: 1 } as ViewStyle,
  scrollContent: { flexGrow: 1 } as ViewStyle,
};
