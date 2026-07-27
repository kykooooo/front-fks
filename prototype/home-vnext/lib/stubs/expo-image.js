// prototype/home-vnext/lib/stubs/expo-image.js
// STUB expo-image : aucune image reelle n'est chargee (aucun acces reseau).
// On rend un rectangle gris de la taille demandee -> la metrique de layout tient.
"use strict";

const React = require("react");
const { View } = require("react-native-web");

const Image = ({ style, ...rest }) =>
  React.createElement(View, {
    ...rest,
    "data-fks-image": "placeholder",
    style: [{ backgroundColor: "#D8DEE8" }, style],
  });

module.exports = { __esModule: true, Image, default: Image };
