// __tests__/envLocalPourEas.test.ts
//
// VERROU de la publication OTA (panne « pas de connexion » du 22/09/2026) :
// eas-cli 18 évalue app.config.js avec EXPO_NO_DOTENV=1, donc sans .env.local,
// et le manifeste portait des chaînes vides. Deux garanties ici :
//   1. config/envLocalPourEas.js recharge les EXPO_PUBLIC_* de .env.local dans
//      ce cas précis, et seulement dans ce cas ;
//   2. app.config.js n'écrit plus jamais "" dans `extra` : absent reste absent.
//
// Aucune lecture du vrai .env.local : le système de fichiers est simulé.

const { chargerEnvLocalSiEasLaSaute, sansValeursVides } = require("../config/envLocalPourEas") as {
  chargerEnvLocalSiEasLaSaute: (o: {
    dossier: string;
    env?: Record<string, string | undefined>;
    existe?: (f: string) => boolean;
    lire?: (f: string) => string;
  }) => { charge: boolean; raison?: string; posees: string[] };
  sansValeursVides: (o: Record<string, unknown>) => Record<string, unknown>;
};

const FICHIER = [
  "EXPO_PUBLIC_BACKEND_URL=https://backend.exemple.test",
  "EXPO_PUBLIC_BACKEND_API_KEY=cle-publique",
  "SECRET_PRIVE=ne-doit-jamais-sortir",
  "",
].join("\n");

const fsSimule = { existe: () => true, lire: () => FICHIER };

describe("chargerEnvLocalSiEasLaSaute", () => {
  test("EXPO_NO_DOTENV=1 (eas update) + .env.local présent → les EXPO_PUBLIC_* absentes sont posées", () => {
    const env: Record<string, string | undefined> = { EXPO_NO_DOTENV: "1" };
    const r = chargerEnvLocalSiEasLaSaute({ dossier: "/projet", env, ...fsSimule });
    expect(r.charge).toBe(true);
    expect(r.posees.sort()).toEqual(["EXPO_PUBLIC_BACKEND_API_KEY", "EXPO_PUBLIC_BACKEND_URL"]);
    expect(env.EXPO_PUBLIC_BACKEND_URL).toBe("https://backend.exemple.test");
  });

  test("un secret privé du fichier n'est JAMAIS chargé", () => {
    const env: Record<string, string | undefined> = { EXPO_NO_DOTENV: "1" };
    chargerEnvLocalSiEasLaSaute({ dossier: "/projet", env, ...fsSimule });
    expect(env.SECRET_PRIVE).toBeUndefined();
  });

  test("une variable déjà posée (env EAS) garde la main ; une variable vide est remplacée", () => {
    const env: Record<string, string | undefined> = {
      EXPO_NO_DOTENV: "1",
      EXPO_PUBLIC_BACKEND_URL: "https://eas.exemple.test",
      EXPO_PUBLIC_BACKEND_API_KEY: "",
    };
    const r = chargerEnvLocalSiEasLaSaute({ dossier: "/projet", env, ...fsSimule });
    expect(env.EXPO_PUBLIC_BACKEND_URL).toBe("https://eas.exemple.test");
    expect(env.EXPO_PUBLIC_BACKEND_API_KEY).toBe("cle-publique");
    expect(r.posees).toEqual(["EXPO_PUBLIC_BACKEND_API_KEY"]);
  });

  test("sans EXPO_NO_DOTENV (expo start, expo export, eas build) : ne touche à rien", () => {
    const env: Record<string, string | undefined> = {};
    const r = chargerEnvLocalSiEasLaSaute({ dossier: "/projet", env, ...fsSimule });
    expect(r).toEqual({ charge: false, raison: "expo-charge-lui-meme", posees: [] });
    expect(env.EXPO_PUBLIC_BACKEND_URL).toBeUndefined();
  });

  test("fichier absent (build cloud) : ne touche à rien", () => {
    const env: Record<string, string | undefined> = { EXPO_NO_DOTENV: "1" };
    const r = chargerEnvLocalSiEasLaSaute({ dossier: "/projet", env, existe: () => false, lire: () => "" });
    expect(r).toEqual({ charge: false, raison: "fichier-absent", posees: [] });
  });
});

describe("app.config.js — le manifeste ne porte plus de chaînes vides", () => {
  const CLES = ["EXPO_NO_DOTENV", "EXPO_PUBLIC_BACKEND_URL", "EXPO_PUBLIC_BACKEND_API_KEY", "EXPO_PUBLIC_FIREBASE_API_KEY", "EXPO_PUBLIC_SENTRY_DSN", "EXPO_PUBLIC_AMPLITUDE_API_KEY", "BACKEND_URL", "BACKEND_API_KEY"] as const;
  const avant: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of CLES) {
      avant[k] = process.env[k];
      delete process.env[k];
    }
    jest.resetModules();
  });
  afterEach(() => {
    for (const k of CLES) {
      if (avant[k] === undefined) delete process.env[k];
      else process.env[k] = avant[k];
    }
  });

  const evaluer = (): { extra: Record<string, unknown> } =>
    (require("../app.config.js") as (a: { config: object }) => { extra: Record<string, unknown> })({ config: {} });

  test("variables présentes → écrites telles quelles", () => {
    process.env.EXPO_PUBLIC_BACKEND_URL = "https://backend.exemple.test";
    process.env.EXPO_PUBLIC_BACKEND_API_KEY = "cle";
    const { extra } = evaluer();
    expect(extra.BACKEND_URL).toBe("https://backend.exemple.test");
    expect(extra.BACKEND_API_KEY).toBe("cle");
  });

  test("variables absentes → clés ABSENTES du manifeste (jamais \"\")", () => {
    const { extra } = evaluer();
    for (const k of ["BACKEND_URL", "BACKEND_API_KEY", "FIREBASE_API_KEY", "SENTRY_DSN", "AMPLITUDE_API_KEY"]) {
      expect(extra).not.toHaveProperty(k);
    }
    // Les clés non secrètes d'app.json (eas.projectId, drapeaux) restent.
    expect(extra.eas).toBeDefined();
  });

  test("sansValeursVides ne touche qu'aux vides", () => {
    expect(sansValeursVides({ a: "", b: "x", c: undefined, d: null, e: 0, f: false, g: { h: 1 } })).toEqual({ b: "x", e: 0, f: false, g: { h: 1 } });
  });
});
