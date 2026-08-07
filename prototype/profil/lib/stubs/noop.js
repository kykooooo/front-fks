// prototype/home-vnext/lib/stubs/noop.js
// Stub generique : tout acces renvoie une fonction inerte / un objet vide.
"use strict";

const handler = {
  get(target, prop) {
    if (prop === "__esModule") return true;
    if (prop === "default") return target;
    if (typeof prop === "symbol") return undefined;
    if (!(prop in target)) target[prop] = () => undefined;
    return target[prop];
  },
};

module.exports = new Proxy(function stub() {}, handler);
