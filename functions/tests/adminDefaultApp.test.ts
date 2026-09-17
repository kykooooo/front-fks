// functions/tests/adminDefaultApp.test.ts
//
// VERROU DE LA PANNE DU 17/09/2026 (recette telephone de Kyllian) : TOUTES les
// Cloud Functions plantaient en prod avec
//   « The default Firebase app does not exist » (code app/no-app)
// — suppression de compte, emission et saisie du code club, et les quatre
// declencheurs Firestore.
//
// LE MECANISME. Avant d'appeler notre code, le SDK firebase-functions a besoin
// d'une app Admin (verification du jeton d'un callable, lecture de l'instantane
// d'un declencheur). Faute d'app par defaut, il cree la SIENNE, NOMMEE
// `__FIREBASE_FUNCTIONS_SDK__` (firebase-functions/lib/common/app.js). Notre
// `getDb()` demandait ensuite « existe-t-il UNE app ? » — oui, celle du SDK —,
// sautait donc `initializeApp()`, puis appelait `getFirestore()` qui exige, lui,
// l'app PAR DEFAUT. Elle n'avait jamais ete creee.
//
// Ce test rejoue exactement cet ordre, avec le vrai firebase-admin (aucun appel
// reseau : ni Firestore ni Auth ne se connectent avant la premiere requete).

import { deleteApp, getApps, initializeApp } from "firebase-admin/app";

import { getAdminAuth, getDb } from "../src/admin";

/** Le nom exact pose par firebase-functions (lib/common/app.js, APP_NAME). */
const NOM_APP_DU_SDK_FUNCTIONS = "__FIREBASE_FUNCTIONS_SDK__";

/** Ce que fait le SDK Functions AVANT de donner la main a notre handler. */
function leSdkFunctionsPasseEnPremier(): void {
  initializeApp({ projectId: "demo-fks" }, NOM_APP_DU_SDK_FUNCTIONS);
}

describe("admin — l'app par defaut, meme quand le SDK Functions est passe avant", () => {
  beforeAll(() => {
    // `initializeApp()` sans argument lit le projet dans l'environnement, comme
    // en production. Identifiant `demo-*` : jamais un vrai projet.
    process.env.GCLOUD_PROJECT = "demo-fks";
  });

  afterEach(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it("getDb() ne plante pas quand SEULE l'app nommee du SDK existe", () => {
    leSdkFunctionsPasseEnPremier();
    expect(() => getDb()).not.toThrow();
  });

  it("getAdminAuth() ne plante pas quand SEULE l'app nommee du SDK existe", () => {
    leSdkFunctionsPasseEnPremier();
    expect(() => getAdminAuth()).not.toThrow();
  });

  it("n'initialise l'app par defaut qu'UNE fois (appels repetes, aucun doublon)", () => {
    leSdkFunctionsPasseEnPremier();
    getDb();
    getAdminAuth();
    getDb();
    const nomsParDefaut = getApps().filter((app) => app.name === "[DEFAULT]");
    expect(nomsParDefaut).toHaveLength(1);
  });

  it("fonctionne toujours sans aucune app prealable (scripts CLI, emulateur)", () => {
    expect(getApps()).toHaveLength(0);
    expect(() => getDb()).not.toThrow();
  });
});
