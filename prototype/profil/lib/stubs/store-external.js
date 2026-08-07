// prototype/home-vnext/lib/stubs/store-external.js
// STUB useExternalStore : lit la tranche "external" de l'etat fictif du scenario.
"use strict";

const { makeHook } = require("./scenarioState");

const useExternalStore = makeHook("external");

module.exports = { useExternalStore, default: useExternalStore, __esModule: true };
