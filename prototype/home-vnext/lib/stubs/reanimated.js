// prototype/home-vnext/lib/stubs/reanimated.js
// =============================================================================
// STUB react-native-reanimated
// =============================================================================
// Le harnais capture un ETAT STABILISE, pas une animation. Toutes les valeurs
// animees sont donc rendues a leur valeur d'arrivee et les composants animes
// deviennent de simples vues.
//
// LIMITE : les mouvements (entrees en fondu, pulsation du bouton, glissement des
// modales) ne sont PAS visibles sur les captures. Ce harnais sert a juger la
// mise en page et la hierarchie, pas le mouvement.
// =============================================================================
"use strict";

const React = require("react");
const RNW = require("react-native-web");

const passthrough = (Base) => {
  const C = React.forwardRef((props, ref) => React.createElement(Base, { ...props, ref }));
  C.displayName = "Animated";
  return C;
};

const AnimatedView = passthrough(RNW.View);
const AnimatedText = passthrough(RNW.Text);
const AnimatedScrollView = passthrough(RNW.ScrollView);
const AnimatedImage = passthrough(RNW.Image);

const identity = (v) => v;
const useSharedValue = (initial) => {
  const ref = React.useRef({ value: initial });
  return ref.current;
};
const useAnimatedStyle = (fn) => {
  try {
    return fn() || {};
  } catch (_) {
    return {};
  }
};

const Animated = {
  View: AnimatedView,
  Text: AnimatedText,
  ScrollView: AnimatedScrollView,
  Image: AnimatedImage,
  createAnimatedComponent: (C) => passthrough(C),
};

const noopBuilder = () => {
  const chain = new Proxy(function () {}, {
    get: () => () => chain,
    apply: () => chain,
  });
  return chain;
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue: (fn) => ({ value: typeof fn === "function" ? fn() : fn }),
  useAnimatedRef: () => React.createRef(),
  useAnimatedScrollHandler: () => () => {},
  useAnimatedGestureHandler: () => () => {},
  withTiming: identity,
  withSpring: identity,
  withDelay: (_, v) => v,
  withSequence: (...v) => v[v.length - 1],
  withRepeat: identity,
  cancelAnimation: () => {},
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  interpolate: (v) => v,
  Extrapolate: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
  Extrapolation: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
  Easing: new Proxy({}, { get: () => () => 0 }),
  FadeIn: noopBuilder(),
  FadeOut: noopBuilder(),
  SlideInDown: noopBuilder(),
  SlideOutDown: noopBuilder(),
  Layout: noopBuilder(),
  LinearTransition: noopBuilder(),
};
