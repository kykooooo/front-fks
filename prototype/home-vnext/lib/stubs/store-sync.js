// prototype/home-vnext/lib/stubs/store-sync.js
// STUB useSyncStore : lit la tranche "sync" de l'etat fictif du scenario.
"use strict";

const { makeHook } = require("./scenarioState");

const useSyncStore = makeHook("sync");

module.exports = { useSyncStore, default: useSyncStore, __esModule: true };
