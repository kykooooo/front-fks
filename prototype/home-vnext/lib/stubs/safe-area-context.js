// prototype/home-vnext/lib/stubs/safe-area-context.js
// =============================================================================
// STUB react-native-safe-area-context — INSETS PILOTES PAR LE FORMAT
// =============================================================================
// Le harnais d'audit fixait les insets en dur (47 / 34). Ici ils changent avec
// la largeur rendue : un iPhone SE (320) n'a pas d'encoche, un iPad (768) non
// plus. Le moteur de rendu appelle `setInsets()` avant chaque montage.
//
// Deux jeux d'insets, et c'est volontaire :
//   - FULL    : ce que renvoie `useSafeAreaInsets()`. C'est ce que lit
//               `components/ui/Screen.tsx` (`paddingTop: insets.top`,
//               `paddingBottom: insets.bottom`) — donc l'ecran ajoute bien
//               l'inset bas complet, exactement comme en production.
//   - SCREEN  : ce qu'applique la vue native `<SafeAreaView>` a l'interieur
//               d'un Tab.Navigator. La tab bar occupe deja le bas : le padding
//               bas effectif vaut 0. Le Home ACTUEL utilise cette voie.
// =============================================================================
"use strict";

const React = require("react");
const { View } = require("react-native-web");

// Objets MUTES EN PLACE (jamais remplaces) : ils servent aussi de valeur par
// defaut des contextes React, dont la valeur est figee a la creation.
const FULL = { top: 47, bottom: 34, left: 0, right: 0 };
const SCREEN = { top: 47, bottom: 0, left: 0, right: 0 };
const FRAME = { x: 0, y: 0, width: 390, height: 844 };

/** Appele par le moteur de rendu avant chaque montage. */
function setInsets({ top, bottom, width, height }) {
  Object.assign(FULL, { top, bottom, left: 0, right: 0 });
  Object.assign(SCREEN, { top, bottom: 0, left: 0, right: 0 });
  Object.assign(FRAME, { x: 0, y: 0, width, height });
}

const SafeAreaInsetsContext = React.createContext(FULL);
const SafeAreaFrameContext = React.createContext(FRAME);

const useSafeAreaInsets = () => FULL;
const useSafeAreaFrame = () => FRAME;

function SafeAreaProvider({ children, style }) {
  return React.createElement(View, { style: [{ flex: 1 }, style] }, children);
}

function SafeAreaView({ children, style, edges, mode = "padding", ...rest }) {
  const list = edges || ["top", "right", "bottom", "left"];
  const pad = {};
  const prefix = mode === "margin" ? "margin" : "padding";
  if (list.includes("top")) pad[`${prefix}Top`] = SCREEN.top;
  if (list.includes("bottom")) pad[`${prefix}Bottom`] = SCREEN.bottom;
  if (list.includes("left")) pad[`${prefix}Left`] = SCREEN.left;
  if (list.includes("right")) pad[`${prefix}Right`] = SCREEN.right;
  return React.createElement(View, { ...rest, style: [style, pad] }, children);
}

const withSafeAreaInsets = (Comp) => (props) =>
  React.createElement(Comp, { ...props, insets: FULL });

module.exports = {
  __esModule: true,
  setInsets,
  SafeAreaView,
  SafeAreaProvider,
  SafeAreaInsetsContext,
  SafeAreaFrameContext,
  useSafeAreaInsets,
  useSafeAreaFrame,
  withSafeAreaInsets,
  initialWindowMetrics: { frame: FRAME, insets: FULL },
  initialWindowSafeAreaInsets: FULL,
  SafeAreaConsumer: SafeAreaInsetsContext.Consumer,
  SafeAreaContext: SafeAreaInsetsContext,
};
