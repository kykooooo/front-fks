// services/__tests__/exerciseCatalog.test.ts
// Cache catalogue V2 : ordre de résolution API > cache > snapshot, ETag/304,
// hors-ligne, cache corrompu, réconciliation catalog_version, aliases.
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearExerciseCatalogCacheForTests,
  getExerciseCatalogSnapshot,
  hydrateExerciseCatalog,
  reconcileCatalogVersion,
  refreshExerciseCatalog,
  resolveExerciseCatalogId,
} from "../exerciseCatalog";
import type { ExerciseCatalogManifest } from "../../engine/exerciseCatalogV2";

const CACHE_KEY = "fks_exercise_catalog_v2";
const ETAG_KEY = "fks_exercise_catalog_v2_etag";

let hashCounter = 0;
const makeManifest = (
  overrides: Partial<ExerciseCatalogManifest> = {}
): ExerciseCatalogManifest => ({
  schemaVersion: 2,
  catalogVersion: "9.9.9",
  publishedAt: "2026-07-01T00:00:00.000Z",
  contentHash: String(++hashCounter).padStart(64, "0"),
  exercises: [],
  aliases: {},
  variants: {},
  ...overrides,
});

const mkResponse = (status: number, body?: unknown, etag?: string) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: {
    get: (h: string) => (h.toLowerCase() === "etag" ? etag ?? null : null),
  },
  json: async () => body ?? {},
});

const flush = async () => {
  await new Promise((res) => setImmediate(res));
  await new Promise((res) => setImmediate(res));
};

beforeEach(async () => {
  (global as any).fetch = jest.fn();
  await clearExerciseCatalogCacheForTests();
});

describe("snapshot embarqué (défaut)", () => {
  it("sert le snapshot tant qu'aucune source plus fraîche n'existe", () => {
    const snap = getExerciseCatalogSnapshot();
    expect(snap.catalogVersion).toBe("2.0.0-draft");
    expect(snap.exercises).toHaveLength(0);
  });
});

describe("refreshExerciseCatalog", () => {
  it("publie le manifeste API (200) et écrit le cache", async () => {
    const manifest = makeManifest({ catalogVersion: "3.0.0" });
    (global.fetch as jest.Mock).mockResolvedValue(mkResponse(200, manifest, '"etag3"'));

    const result = await refreshExerciseCatalog();
    expect(result.catalogVersion).toBe("3.0.0");
    expect(getExerciseCatalogSnapshot().catalogVersion).toBe("3.0.0");

    const cached = await AsyncStorage.getItem(CACHE_KEY);
    expect(JSON.parse(cached as string).catalogVersion).toBe("3.0.0");
    expect(await AsyncStorage.getItem(ETAG_KEY)).toBe('"etag3"');
  });

  it("envoie If-None-Match et conserve le cache sur 304", async () => {
    await AsyncStorage.setItem(ETAG_KEY, '"etag-known"');
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue(mkResponse(304));

    const before = getExerciseCatalogSnapshot();
    const result = await refreshExerciseCatalog();
    expect(result).toBe(before);

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers["If-None-Match"]).toBe('"etag-known"');
  });

  it("reste sur le snapshot hors-ligne, sans planter", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network down"));
    const before = getExerciseCatalogSnapshot();
    const result = await refreshExerciseCatalog();
    expect(result).toBe(before);
    expect(result.catalogVersion).toBe("2.0.0-draft");
  });

  it("ignore un manifeste API invalide et garde la source courante", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mkResponse(200, { bogus: true }, '"x"'));
    const result = await refreshExerciseCatalog();
    expect(result.catalogVersion).toBe("2.0.0-draft");
  });
});

describe("hydrateExerciseCatalog — cache corrompu", () => {
  it("tombe sur le snapshot quand le cache est illisible", async () => {
    await AsyncStorage.setItem(CACHE_KEY, "not-json{{{");
    (global.fetch as jest.Mock).mockResolvedValue(mkResponse(304));

    const result = await hydrateExerciseCatalog();
    expect(result.catalogVersion).toBe("2.0.0-draft");
  });
});

describe("reconcileCatalogVersion — flag OFF (défaut)", () => {
  it("ne rafraîchit pas si la version est identique ou absente", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue(mkResponse(304));

    reconcileCatalogVersion("2.0.0-draft");
    reconcileCatalogVersion(null);
    reconcileCatalogVersion(undefined);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ne déclenche AUCUN fetch même si la version diffère (pipeline V2 inerte)", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue(mkResponse(304));

    reconcileCatalogVersion("42.0.0");
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("reconcileCatalogVersion — flag ON", () => {
  const loadWithFlagOn = () => {
    let mod: typeof import("../exerciseCatalog");
    jest.isolateModules(() => {
      jest.doMock("../../config/features", () => ({
        FKS_CATALOG_V2_ENABLED: true,
        FKS_SIGNAL_V1_ENABLED: false,
      }));
      mod = require("../exerciseCatalog");
    });
    jest.dontMock("../../config/features");
    return mod!;
  };

  it("déclenche UN SEUL rafraîchissement quand la version diffère", async () => {
    const mod = loadWithFlagOn();
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue(mkResponse(304));

    mod.reconcileCatalogVersion("42.0.0");
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ne rafraîchit pas quand la version est identique ou absente", async () => {
    const mod = loadWithFlagOn();
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue(mkResponse(304));

    mod.reconcileCatalogVersion(mod.getExerciseCatalogSnapshot().catalogVersion);
    mod.reconcileCatalogVersion(null);
    mod.reconcileCatalogVersion(undefined);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("resolveExerciseCatalogId — flag OFF (défaut)", () => {
  // app.json met FKS_CATALOG_V2 à false : c'est l'état prod actuel. Le remap
  // d'alias ne doit PAS s'appliquer, sinon les séances backend sont altérées
  // (collision dédoublonnage) et les fiches/vidéos V1 (clés par anciens IDs)
  // deviennent introuvables.
  it("garde l'ID backend d'origine tel quel, même pour un alias connu", () => {
    expect(resolveExerciseCatalogId("cod_505")).toBe("cod_505");
    expect(resolveExerciseCatalogId("sprint_accel_10m")).toBe("sprint_accel_10m");
    expect(resolveExerciseCatalogId("sprint_accel_20m")).toBe("sprint_accel_20m");
    expect(resolveExerciseCatalogId("str_pogo_hops_low")).toBe("str_pogo_hops_low");
  });

  it("laisse un ID inconnu inchangé", () => {
    expect(resolveExerciseCatalogId("unknown_xyz")).toBe("unknown_xyz");
  });
});

describe("resolveExerciseCatalogId — flag ON", () => {
  const loadWithFlagOn = () => {
    let resolve: (id: string) => string;
    jest.isolateModules(() => {
      jest.doMock("../../config/features", () => ({
        FKS_CATALOG_V2_ENABLED: true,
        FKS_SIGNAL_V1_ENABLED: false,
      }));
      resolve = require("../exerciseCatalog").resolveExerciseCatalogId;
    });
    jest.dontMock("../../config/features");
    return resolve!;
  };

  it("résout un alias historique même sans manifeste publié", () => {
    const resolve = loadWithFlagOn();
    // Décision Laurent : cod_505 (5-0-5) → cod_5_0_5, distinct de cod_5_10_5.
    expect(resolve("cod_505")).toBe("cod_5_0_5");
    expect(resolve("cod_5_10_5")).toBe("cod_5_10_5");
    expect(resolve("str_pogo_hops_low")).toBe("plyo_pogo_hops_low");
  });

  it("résout une ancienne séance utilisant cod_505 sans erreur ni boucle", () => {
    const resolve = loadWithFlagOn();
    expect(() => resolve("cod_505")).not.toThrow();
    const resolved = resolve("cod_505");
    expect(resolved).toBe("cod_5_0_5");
    // idempotent : re-résoudre le résultat ne boucle pas et reste stable.
    expect(resolve(resolved)).toBe("cod_5_0_5");
  });

  it("laisse un ID inconnu inchangé", () => {
    const resolve = loadWithFlagOn();
    expect(resolve("unknown_xyz")).toBe("unknown_xyz");
  });
});
