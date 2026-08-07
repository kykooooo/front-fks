// prototype/home-vnext/lib/stubs/store-settings.js
// STUB useSettingsStore : lit la tranche "settings" de l'etat fictif.
"use strict";

const { makeHook, getState } = require("./scenarioState");

const useSettingsStore = makeHook("settings");
const DEFAULT_SETTINGS = getState().settings;

module.exports = { useSettingsStore, DEFAULT_SETTINGS, default: useSettingsStore, __esModule: true };
