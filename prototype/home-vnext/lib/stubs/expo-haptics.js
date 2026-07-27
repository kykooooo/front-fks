// prototype/home-vnext/lib/stubs/expo-haptics.js
// STUB expo-haptics : aucun retour haptique possible dans un navigateur.
"use strict";

const noop = async () => {};

module.exports = {
  __esModule: true,
  impactAsync: noop,
  notificationAsync: noop,
  selectionAsync: noop,
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy", Rigid: "rigid", Soft: "soft" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
};
