// prototype/home-vnext/lib/stubs/firebase.js
// =============================================================================
// STUB services/firebase — AUCUN ACCES RESEAU, AUCUN ACCES PRODUCTION
// =============================================================================
// C'est la garantie centrale du harnais : le module qui porte l'instance `auth`
// et `db` est remplace avant meme d'etre charge. Aucune requete ne peut partir.
// =============================================================================
"use strict";

const { getState } = require("./scenarioState");

const auth = {
  get currentUser() {
    return {
      uid: "harnais-uid",
      displayName: getState().displayName,
      email: "demo@harnais.local",
    };
  },
  onAuthStateChanged: () => () => {},
  signOut: async () => {},
};

const db = { __harnais: true };

module.exports = { __esModule: true, auth, db, app: { name: "harnais" }, default: { auth, db } };
