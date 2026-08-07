// prototype/home-vnext/lib/stubs/store-debug.js
// STUB useDebugStore : lit la tranche "debug" de l'etat fictif du scenario.
"use strict";

const { makeHook } = require("./scenarioState");

const useDebugStore = makeHook("debug");

module.exports = { useDebugStore, default: useDebugStore, __esModule: true };
