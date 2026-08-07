// prototype/home-vnext/lib/stubs/vector-icons.js
// =============================================================================
// STUB @expo/vector-icons
// =============================================================================
// La police d'icones n'est pas chargeable ici. On rend un carre arrondi de la
// TAILLE EXACTE demandee, dans la COULEUR demandee : la METRIQUE de layout reste
// donc fidele (une icone Ionicons occupe size x size).
//
// CE N'EST PAS LE GLYPHE REEL. C'est un aplat. Ne jugez pas le dessin des
// icones sur ces captures — jugez la place qu'elles prennent.
// =============================================================================
"use strict";

const React = require("react");
const { View } = require("react-native-web");

function makeIconFamily(family) {
  const Icon = ({ name, size = 24, color = "#000", style }) =>
    React.createElement(View, {
      accessibilityLabel: `icone:${family}/${name}`,
      "data-fks-icon": `${family}/${name}`,
      style: [
        {
          width: size,
          height: size,
          borderRadius: Math.max(2, size * 0.22),
          backgroundColor: color,
        },
        style,
      ],
    });
  Icon.displayName = family;
  Icon.Button = Icon;
  Icon.font = {};
  Icon.loadFont = () => Promise.resolve();
  return Icon;
}

const cache = {};
const target = { __esModule: true };

module.exports = new Proxy(target, {
  get(t, prop) {
    if (typeof prop === "symbol") return t[prop];
    if (prop === "__esModule") return true;
    if (prop === "createIconSet" || prop === "createIconSetFromIcoMoon") {
      return () => makeIconFamily("custom");
    }
    if (prop === "default") return module.exports;
    if (!cache[prop]) cache[prop] = makeIconFamily(String(prop));
    return cache[prop];
  },
});
