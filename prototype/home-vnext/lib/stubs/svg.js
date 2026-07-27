// prototype/home-vnext/lib/stubs/svg.js
// =============================================================================
// STUB react-native-svg -> vrais elements SVG du DOM
// =============================================================================
// Le paquet natif n'est pas resolvable en Node (pas de resolution d'extension
// `.web.js`), MAIS la geometrie est calculee en JavaScript par le composant du
// produit : on la rend telle quelle en SVG natif du navigateur.
//
// Consequence : la courbe affichee est la VRAIE courbe, avec les VRAIES
// coordonnees calculees par le code du produit. Fidele.
// =============================================================================
"use strict";

const React = require("react");

const passProps = (props) => {
  const { children, style, ...rest } = props || {};
  const out = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  if (style) out.style = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
  return out;
};

const make = (tag, extra) => {
  const C = (props) =>
    React.createElement(tag, { ...passProps(props), ...(extra || {}) }, props && props.children);
  C.displayName = `Svg.${tag}`;
  return C;
};

const Svg = (props) => {
  const { width, height, viewBox, children, style, ...rest } = props || {};
  return React.createElement(
    "svg",
    {
      width,
      height,
      viewBox,
      xmlns: "http://www.w3.org/2000/svg",
      ...passProps(rest),
      style: { display: "block", overflow: "visible", ...(style || {}) },
    },
    children
  );
};

const api = {
  __esModule: true,
  default: Svg,
  Svg,
  Circle: make("circle"),
  Ellipse: make("ellipse"),
  G: make("g"),
  Line: make("line"),
  Path: make("path"),
  Polygon: make("polygon"),
  Polyline: make("polyline"),
  Rect: make("rect"),
  Text: make("text"),
  TSpan: make("tspan"),
  TextPath: make("textPath"),
  Defs: make("defs"),
  Stop: make("stop"),
  LinearGradient: make("linearGradient"),
  RadialGradient: make("radialGradient"),
  ClipPath: make("clipPath"),
  Mask: make("mask"),
  Use: make("use"),
  Symbol: make("symbol"),
  Image: make("image"),
  Marker: make("marker"),
  Pattern: make("pattern"),
  ForeignObject: make("foreignObject"),
};

module.exports = api;
