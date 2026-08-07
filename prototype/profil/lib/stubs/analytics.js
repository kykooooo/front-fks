// prototype/home-vnext/lib/stubs/analytics.js
// STUB services/analytics : aucun evenement n'est envoye a Amplitude.
"use strict";

const noop = () => {};

module.exports = new Proxy(
  { __esModule: true, track: noop, identify: noop, init: noop, logEvent: noop, default: {} },
  {
    get(t, p) {
      if (typeof p === "symbol") return t[p];
      if (!(p in t)) t[p] = () => undefined;
      return t[p];
    },
  }
);
