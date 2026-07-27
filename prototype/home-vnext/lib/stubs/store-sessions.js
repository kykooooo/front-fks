// prototype/home-vnext/lib/stubs/store-sessions.js
// STUB useSessionsStore : lit la tranche "sessions" de l'etat fictif du scenario.
"use strict";

const { makeHook } = require("./scenarioState");

const useSessionsStore = makeHook("sessions");

module.exports = { useSessionsStore, default: useSessionsStore, __esModule: true };
