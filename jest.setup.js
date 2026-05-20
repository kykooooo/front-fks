// jest.setup.js
// Mocks des modules natifs / firebase pour les tests qui importent les stores
// Zustand (persist -> AsyncStorage, offlineQueue -> NetInfo, sync -> firebase).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("@react-native-community/netinfo", () =>
  require("@react-native-community/netinfo/jest/netinfo-mock.js")
);

// Firebase est distribué en ESM -> Jest ne le transpile pas. On stub les modules.
// Les fonctions d'init (appelées au chargement de services/firebase) renvoient des
// valeurs correctes ; toute autre propriété accédée renvoie un jest.fn no-op.
// Les tests métier ne déclenchent aucun appel réseau (persist stubbé dans les tests).
const mockFirebaseModule = (overrides) =>
  new Proxy(overrides, {
    get: (target, prop) => {
      if (prop === "__esModule") return true;
      if (prop in target) return target[prop];
      return jest.fn();
    },
  });

jest.mock("firebase/app", () =>
  mockFirebaseModule({
    initializeApp: () => ({}),
    getApp: () => ({}),
    getApps: () => [],
  })
);

jest.mock("firebase/auth", () =>
  mockFirebaseModule({
    getAuth: () => ({ currentUser: null }),
    initializeAuth: () => ({ currentUser: null }),
    getReactNativePersistence: () => ({}),
    onAuthStateChanged: () => () => {},
  })
);

jest.mock("firebase/firestore", () =>
  mockFirebaseModule({
    getFirestore: () => ({}),
    initializeFirestore: () => ({}),
    onSnapshot: () => () => {},
  })
);
