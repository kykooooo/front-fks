// prototype/home-vnext/lib/stubs/store-feedback.js
// STUB useFeedbackStore : lit la tranche "feedback" de l'etat fictif du scenario.
"use strict";

const { makeHook } = require("./scenarioState");

const useFeedbackStore = makeHook("feedback");

module.exports = { useFeedbackStore, default: useFeedbackStore, __esModule: true };
