import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableWithoutFeedback,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import Animated from "react-native-reanimated";
import { useModalAnimation, type ModalAnimationType } from "./useModalAnimation";
import { theme } from "../../constants/theme";
import { zIndex as Z } from "../../theme/zIndex";
import { GestureDetector } from "react-native-gesture-handler";
import { useSwipeToDismiss } from "./useSwipeToDismiss";

type Props = {
  visible: boolean;
  onClose?: () => void;
  animationType?: ModalAnimationType;
  blurIntensity?: number;
  allowBackdropDismiss?: boolean;
  allowSwipeDismiss?: boolean;
  swipeThreshold?: number;
  showHandle?: boolean;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function ModalContainer({
  visible,
  onClose,
  animationType = "slide",
  blurIntensity = 40,
  allowBackdropDismiss = true,
  allowSwipeDismiss = true,
  swipeThreshold = 150,
  showHandle = true,
  children,
  contentStyle,
}: Props) {
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  const { contentStyle: animatedContent, backdropStyle } = useModalAnimation({
    visible,
    animationType,
    disableTranslate: allowSwipeDismiss,
    onClosed: () => setMounted(false),
  });

  const { gesture, animatedStyle } = useSwipeToDismiss({
    enabled: allowSwipeDismiss,
    threshold: swipeThreshold,
    onDismiss: onClose,
  });

  const blurTint = useMemo(() => "dark" as const, []);

  if (!mounted) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <TouchableWithoutFeedback
        onPress={() => {
          if (!allowBackdropDismiss) return;
          onClose?.();
        }}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <BlurView intensity={blurIntensity} tint={blurTint} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </TouchableWithoutFeedback>

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.content, animatedContent, animatedStyle, contentStyle]}>
          {showHandle ? <View style={styles.handle} /> : null}
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: Z.modal,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  content: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 12,
    minHeight: 120,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: theme.colors.borderSoft,
  },
});
