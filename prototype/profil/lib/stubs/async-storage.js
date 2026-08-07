// prototype/home-vnext/lib/stubs/async-storage.js
// STUB AsyncStorage : memoire volatile. RIEN n'est ecrit sur le disque.
"use strict";

const mem = new Map();

const AsyncStorage = {
  getItem: async (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: async (k, v) => {
    mem.set(k, String(v));
  },
  removeItem: async (k) => {
    mem.delete(k);
  },
  clear: async () => {
    mem.clear();
  },
  getAllKeys: async () => Array.from(mem.keys()),
  multiGet: async (ks) => ks.map((k) => [k, mem.has(k) ? mem.get(k) : null]),
  multiSet: async (pairs) => {
    pairs.forEach(([k, v]) => mem.set(k, String(v)));
  },
  multiRemove: async (ks) => {
    ks.forEach((k) => mem.delete(k));
  },
  mergeItem: async () => {},
};

module.exports = { __esModule: true, default: AsyncStorage, ...AsyncStorage };
