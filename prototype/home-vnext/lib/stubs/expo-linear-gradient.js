// prototype/home-vnext/lib/stubs/expo-linear-gradient.js
// =============================================================================
// STUB expo-linear-gradient
// =============================================================================
// Le degrade est rendu en APLAT : on prend la premiere couleur de la liste.
// LIMITE ASSUMEE : la nuance du degrade n'est pas reproduite. La doctrine du
// prototype n'autorise de toute facon qu'UN SEUL aplat colore par ecran, donc
// ce stub ne devrait jamais servir cote vNext ; il existe pour que le harnais
// ne casse pas si un composant importe accidentellement le paquet.
// =============================================================================
"use strict";

const React = require("react");
const { View } = require("react-native-web");

const LinearGradient = ({ children, style, colors, ...rest }) => {
  const first = Array.isArray(colors) && colors.length ? colors[0] : undefined;
  return React.createElement(
    View,
    {
      ...rest,
      "data-fks-gradient": Array.isArray(colors) ? colors.join(" -> ") : "",
      style: [first ? { backgroundColor: first } : null, style],
    },
    children
  );
};

module.exports = { __esModule: true, LinearGradient, default: LinearGradient };
