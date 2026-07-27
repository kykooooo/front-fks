// prototype/home-vnext/lib/stubs/netinfo.js
// STUB NetInfo : l'etat reseau est pilote par le scenario (champ `offline`).
"use strict";

const { getState } = require("./scenarioState");

const stateOf = () => {
  const off = !!getState().offline;
  return {
    type: off ? "none" : "wifi",
    isConnected: !off,
    isInternetReachable: !off,
    details: {},
  };
};

const NetInfo = {
  addEventListener: (cb) => {
    cb(stateOf());
    return () => {};
  },
  fetch: async () => stateOf(),
  useNetInfo: () => stateOf(),
  configure: () => {},
};

module.exports = { __esModule: true, default: NetInfo, ...NetInfo };
