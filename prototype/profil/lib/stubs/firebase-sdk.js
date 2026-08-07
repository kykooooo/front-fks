// prototype/home-vnext/lib/stubs/firebase-sdk.js
// STUB du SDK firebase/* : tout acces renvoie une fonction inerte.
// Aucun `initializeApp`, aucune connexion.
"use strict";

const handler = {
  get(target, prop) {
    if (prop === "__esModule") return true;
    if (typeof prop === "symbol") return undefined;
    if (!(prop in target)) target[prop] = () => ({});
    return target[prop];
  },
};

module.exports = new Proxy({}, handler);
