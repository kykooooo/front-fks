// prototype/home-vnext/lib/stubs/navigation-native.js
// STUB @react-navigation/native : aucune navigation reelle.
// Les appels sont ENREGISTRES (tableau `__calls`) : le rapport de build peut
// donc verifier qu'un ecran ne declenche pas de navigation au montage.
"use strict";

const React = require("react");

const calls = [];
const record = (kind) => (...args) => {
  calls.push({ kind, args });
};

const nav = {
  navigate: record("navigate"),
  push: record("push"),
  replace: record("replace"),
  goBack: record("goBack"),
  setOptions: () => {},
  addListener: () => () => {},
  removeListener: () => {},
  canGoBack: () => false,
  dispatch: record("dispatch"),
  reset: record("reset"),
  setParams: () => {},
  isFocused: () => true,
  getParent: () => nav,
  getState: () => ({ routes: [], index: 0 }),
};

const useNavigation = () => nav;
const useFocusEffect = () => {};
const useIsFocused = () => true;
const useRoute = () => ({ key: "harnais", name: "Home", params: {} });
const useNavigationState = (sel) =>
  typeof sel === "function" ? sel({ routes: [], index: 0 }) : undefined;
const NavigationContainer = ({ children }) => React.createElement(React.Fragment, null, children);
const NavigationContext = React.createContext(nav);
const useTheme = () => ({ dark: false, colors: {} });

module.exports = {
  __esModule: true,
  useNavigation,
  useFocusEffect,
  useIsFocused,
  useRoute,
  useNavigationState,
  NavigationContainer,
  NavigationContext,
  useTheme,
  CommonActions: { navigate: () => ({}), reset: () => ({}) },
  StackActions: { push: () => ({}), pop: () => ({}) },
  DefaultTheme: { dark: false, colors: {} },
  DarkTheme: { dark: true, colors: {} },
  createNavigationContainerRef: () => ({ current: nav, isReady: () => true, navigate: nav.navigate }),
  __nav: nav,
  __calls: calls,
};
