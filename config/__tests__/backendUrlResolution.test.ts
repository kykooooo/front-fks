// config/__tests__/backendUrlResolution.test.ts
//
// VERROU DE LA PANNE DU 22/09/2026 : « tu n'es pas connecté à internet » à
// chaque génération de séance, Wi-Fi impeccable, serveur Render sain, et
// AUCUNE requête arrivée au backend.
//
// LE MÉCANISME. Depuis eas-cli 18, `eas update` évalue app.config.js SANS
// charger .env.local (`EXPO_NO_DOTENV=1`) : le manifeste OTA porte donc
// `extra.BACKEND_URL = ""` — une chaîne VIDE, pas une valeur absente (vérifié
// sur les manifestes des OTA du 17/09 et du 19/09). Le bundle, lui, embarque
// bien l'adresse : `expo export` remplace `process.env.EXPO_PUBLIC_*` par sa
// valeur au moment de l'export.
//
// L'ancienne résolution `extra.BACKEND_URL ?? … ?? process.env…` s'arrêtait
// sur la chaîne vide (`??` ne saute que null/undefined) : BACKEND_URL valait
// "" en production et `fetch("/api/fks/generate")` échouait instantanément en
// « Network request failed ». Ces tests rejouent EXACTEMENT ce manifeste.
//
// config/backend.ts s'évalue au chargement du module : chaque cas le recharge
// à neuf (`jest.resetModules`) avec son propre expo-constants et son propre
// process.env.

type Cas = {
  /** `Constants.expoConfig.extra` tel que le manifeste OTA le fournit. */
  extra?: Record<string, unknown>;
  /** Ce que le bundle embarque (valeurs inlinées de .env.local à l'export). */
  env?: { url?: string; key?: string };
  dev?: boolean;
};

const CLES_ENV = ["EXPO_PUBLIC_BACKEND_URL", "EXPO_PUBLIC_BACKEND_API_KEY"] as const;
const envAvant: Record<string, string | undefined> = {};
const devAvant = (globalThis as { __DEV__?: boolean }).__DEV__;

function chargerBackend(cas: Cas): typeof import("../backend") {
  jest.resetModules();
  jest.doMock("expo-constants", () => ({
    __esModule: true,
    default: { expoConfig: { extra: cas.extra ?? {}, hostUri: undefined } },
  }));
  if (cas.env?.url === undefined) delete process.env.EXPO_PUBLIC_BACKEND_URL;
  else process.env.EXPO_PUBLIC_BACKEND_URL = cas.env.url;
  if (cas.env?.key === undefined) delete process.env.EXPO_PUBLIC_BACKEND_API_KEY;
  else process.env.EXPO_PUBLIC_BACKEND_API_KEY = cas.env.key;
  (globalThis as { __DEV__?: boolean }).__DEV__ = cas.dev ?? false;
  return require("../backend");
}

/** Le manifeste OTA du 19/09/2026 (`u.expo.dev/update/01a0b96d…`), tel quel. */
const MANIFESTE_OTA_19_09 = {
  BACKEND_URL: "",
  BACKEND_API_KEY: "",
  FIREBASE_API_KEY: "",
  SENTRY_DSN: "",
  AMPLITUDE_API_KEY: "",
  eas: { projectId: "607ef5fa-ce96-4c07-9643-b79885aa28a3" },
};

beforeAll(() => {
  for (const k of CLES_ENV) envAvant[k] = process.env[k];
});

afterEach(() => {
  jest.dontMock("expo-constants");
  jest.resetModules();
});

afterAll(() => {
  for (const k of CLES_ENV) {
    if (envAvant[k] === undefined) delete process.env[k];
    else process.env[k] = envAvant[k];
  }
  (globalThis as { __DEV__?: boolean }).__DEV__ = devAvant;
});

describe("config/backend — l'adresse du backend en production", () => {
  test("manifeste OTA aux champs VIDES + bundle exporté avec .env.local → l'adresse vient du bundle", () => {
    const backend = chargerBackend({
      extra: MANIFESTE_OTA_19_09,
      env: { url: "https://backend.exemple.test", key: "cle-du-bundle" },
    });
    expect(backend.BACKEND_URL).toBe("https://backend.exemple.test");
    expect(backend.BACKEND_API_KEY).toBe("cle-du-bundle");
    expect(backend.backendAuthHeaders()).toEqual({ "x-fks-api-key": "cle-du-bundle" });
  });

  test("build cloud : manifeste rempli, rien d'inliné dans le bundle → l'adresse vient du manifeste", () => {
    const backend = chargerBackend({
      extra: { BACKEND_URL: "https://cloud.exemple.test", BACKEND_API_KEY: "cle-du-manifeste" },
    });
    expect(backend.BACKEND_URL).toBe("https://cloud.exemple.test");
    expect(backend.BACKEND_API_KEY).toBe("cle-du-manifeste");
  });

  test("les deux présents : le bundle prime (même règle que config/firebaseConfig.ts, qui n'a jamais cassé)", () => {
    const backend = chargerBackend({
      extra: { BACKEND_URL: "https://cloud.exemple.test", BACKEND_API_KEY: "cle-du-manifeste" },
      env: { url: "https://bundle.exemple.test", key: "cle-du-bundle" },
    });
    expect(backend.BACKEND_URL).toBe("https://bundle.exemple.test");
    expect(backend.BACKEND_API_KEY).toBe("cle-du-bundle");
  });

  test("espaces et retours à la ligne autour des valeurs : nettoyés", () => {
    const backend = chargerBackend({
      extra: MANIFESTE_OTA_19_09,
      env: { url: "  https://backend.exemple.test\r\n", key: " cle \n" },
    });
    expect(backend.BACKEND_URL).toBe("https://backend.exemple.test");
    expect(backend.BACKEND_API_KEY).toBe("cle");
  });

  test("rien nulle part en production : AUCUNE adresse inventée, aucun en-tête de clé", () => {
    const backend = chargerBackend({ extra: MANIFESTE_OTA_19_09 });
    expect(backend.BACKEND_URL).toBe("");
    expect(backend.BACKEND_API_KEY).toBe("");
    expect(backend.backendAuthHeaders()).toEqual({});
  });
});

describe("config/backend — en développement", () => {
  let silence: jest.SpyInstance[] = [];
  beforeEach(() => {
    // Le module journalise sa résolution en dev : on ne pollue pas la sortie.
    silence = [jest.spyOn(console, "log").mockImplementation(() => {}), jest.spyOn(console, "warn").mockImplementation(() => {})];
  });
  afterEach(() => silence.forEach((s) => s.mockRestore()));

  test("sans adresse : le repli local est conservé (comportement historique)", () => {
    const backend = chargerBackend({ extra: {}, dev: true });
    expect(backend.BACKEND_URL).toBe("http://localhost:4000");
  });

  test("avec une adresse dans le bundle : elle prime sur le repli local", () => {
    const backend = chargerBackend({ extra: MANIFESTE_OTA_19_09, env: { url: "https://dev.exemple.test" }, dev: true });
    expect(backend.BACKEND_URL).toBe("https://dev.exemple.test");
  });
});
