// prototype/home-vnext/lib/stubs/expo-blur.js
// STUB expo-blur : rendu en View simple.
// LIMITE : PAS DE FLOU. Un fond floute apparait donc transparent.
"use strict";

const React = require("react");
const { View } = require("react-native-web");

const BlurView = ({ children, style, ...rest }) =>
  React.createElement(View, { ...rest, style }, children);

module.exports = { __esModule: true, BlurView, default: BlurView };
