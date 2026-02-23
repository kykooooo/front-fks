import { Animated } from "react-native";

export const runShake = (value: Animated.Value) => {
  const anim = Animated.sequence([
    Animated.timing(value, { toValue: 8, duration: 40, useNativeDriver: true }),
    Animated.timing(value, { toValue: -6, duration: 40, useNativeDriver: true }),
    Animated.timing(value, { toValue: 4, duration: 40, useNativeDriver: true }),
    Animated.timing(value, { toValue: -2, duration: 40, useNativeDriver: true }),
    Animated.timing(value, { toValue: 0, duration: 40, useNativeDriver: true }),
  ]);
  anim.start();
  return anim;
};

export const runFadeIn = (value: Animated.Value, delay = 0) => {
  const anim = Animated.timing(value, {
    toValue: 1,
    duration: 280,
    delay,
    useNativeDriver: true,
  });
  anim.start();
  return anim;
};

export const runScale = (value: Animated.Value) => {
  const anim = Animated.sequence([
    Animated.timing(value, { toValue: 0.96, duration: 120, useNativeDriver: true }),
    Animated.timing(value, { toValue: 1, duration: 120, useNativeDriver: true }),
  ]);
  anim.start();
  return anim;
};

export const runSlideUp = (value: Animated.Value, delay = 0) => {
  const anim = Animated.timing(value, {
    toValue: 1,
    duration: 260,
    delay,
    useNativeDriver: true,
  });
  anim.start();
  return anim;
};
