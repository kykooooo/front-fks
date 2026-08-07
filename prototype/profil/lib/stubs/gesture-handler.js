// prototype/home-vnext/lib/stubs/gesture-handler.js
// STUB react-native-gesture-handler : aucun geste dans un rendu statique.
// Les composants tactiles deviennent leurs equivalents react-native-web, donc la
// MISE EN PAGE reste fidele ; seuls les gestes (glisser pour fermer) disparaissent.
"use strict";

const React = require("react");
const RNW = require("react-native-web");

const wrap = (Base) => {
  const C = React.forwardRef((props, ref) => React.createElement(Base, { ...props, ref }));
  C.displayName = "GH";
  return C;
};

const gestureChain = () => {
  const chain = new Proxy(function () {}, {
    get: () => () => chain,
    apply: () => chain,
  });
  return chain;
};

module.exports = {
  __esModule: true,
  GestureHandlerRootView: wrap(RNW.View),
  GestureDetector: ({ children }) => React.createElement(React.Fragment, null, children),
  Gesture: new Proxy({}, { get: () => () => gestureChain() }),
  PanGestureHandler: ({ children }) => React.createElement(React.Fragment, null, children),
  TapGestureHandler: ({ children }) => React.createElement(React.Fragment, null, children),
  ScrollView: wrap(RNW.ScrollView),
  TouchableOpacity: wrap(RNW.TouchableOpacity),
  TouchableHighlight: wrap(RNW.TouchableHighlight),
  TouchableWithoutFeedback: wrap(RNW.TouchableWithoutFeedback),
  RectButton: wrap(RNW.View),
  BorderlessButton: wrap(RNW.View),
  State: { BEGAN: 2, ACTIVE: 4, END: 5 },
  Directions: { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 },
  gestureHandlerRootHOC: (C) => C,
};
