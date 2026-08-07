// prototype/home-vnext/lib/stubs/store-load.js
// STUB useLoadStore : lit la tranche "load" de l'etat fictif du scenario.
"use strict";

const { makeHook } = require("./scenarioState");

const useLoadStore = makeHook("load");

module.exports = { useLoadStore, default: useLoadStore, __esModule: true };
