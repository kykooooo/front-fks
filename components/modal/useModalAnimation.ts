import { useCallback, useEffect, useRef } from "react";
import { useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export type ModalAnimationType = "slide" | "fade" | "right";

type Params = {
  visible: boolean;
  animationType?: ModalAnimationType;
  durationIn?: number;
  durationOut?: number;
  onClosed?: () => void;
  disableTranslate?: boolean;
};

export function useModalAnimation({
  visible,
  animationType = "slide",
  durationIn = 300,
  durationOut = 250,
  onClosed,
  disableTranslate = false,
}: Params) {
  const progress = useSharedValue(0);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const onClosedRef = useRef(onClosed);

  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  // Read .current on JS thread to avoid Reanimated worklet serialization warning
  const fireOnClosed = useCallback(() => {
    onClosedRef.current?.();
  }, []);

  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, {
        duration: durationIn,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = withTiming(
        0,
        { duration: durationOut, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(fireOnClosed)();
        }
      );
    }
  }, [visible, durationIn, durationOut, progress, fireOnClosed]);

  const contentStyle = useAnimatedStyle(() => {
    const opacity = progress.value;
    if (disableTranslate) {
      return { opacity };
    }
    if (animationType === "fade") {
      return {
        opacity,
        transform: [{ scale: 0.98 + 0.02 * progress.value }],
      };
    }
    if (animationType === "right") {
      return {
        opacity,
        transform: [{ translateX: (1 - progress.value) * screenWidth }],
      };
    }
    return {
      opacity,
      transform: [{ translateY: (1 - progress.value) * screenHeight * 0.25 }],
    };
  }, [animationType, disableTranslate, screenHeight, screenWidth]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 0.9 * progress.value,
  }));

  return { progress, contentStyle, backdropStyle };
}
