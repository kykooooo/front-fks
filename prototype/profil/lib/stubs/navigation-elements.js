// prototype/home-vnext/lib/stubs/navigation-elements.js
// =============================================================================
// STUB @react-navigation/elements
// =============================================================================
// `components/ui/Screen.tsx` lit `HeaderHeightContext` pour decider s'il ajoute
// l'inset haut lui-meme :
//     paddingTop: headerHeight > 0 ? 0 : insets.top
//
// Dans l'app, le Home vit dans un Tab.Navigator en `headerShown: false` : il n'y
// a PAS de header natif, le contexte vaut `undefined`, et l'ecran gere l'inset.
// On reproduit exactement ca : contexte a `undefined`.
// =============================================================================
"use strict";

const React = require("react");

const HeaderHeightContext = React.createContext(undefined);
const useHeaderHeight = () => 0;

module.exports = {
  __esModule: true,
  HeaderHeightContext,
  useHeaderHeight,
  HeaderBackButton: () => null,
  Header: () => null,
  getDefaultHeaderHeight: () => 0,
};
