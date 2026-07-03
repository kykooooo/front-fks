// repositories/__tests__/clubsRepo.test.ts
// Tests des helpers purs de gestion des codes club + preuve que la lecture coach
// ne touche QUE clubs/{clubId}/playerSummaries (jamais users/sessions/plannedSessions).
// On mocke services/firebase + firebase/firestore pour capturer les chemins lus.

jest.mock("../../services/firebase", () => ({ db: {}, auth: {} }));

// Mock firestore : on enregistre le chemin de chaque ref lue (collection/doc).
// Variables préfixées `mock` → autorisées dans une factory jest.mock().
const mockFirestoreReads: { kind: "collection" | "doc"; path: string[] }[] = [];
const mockFlags: {
  getDocsThrows: boolean;
  getDocThrows: boolean;
  collectionDocs: { id: string; data: () => any }[];
  detailDoc: { exists: boolean; data: () => any };
} = {
  getDocsThrows: false,
  getDocThrows: false,
  collectionDocs: [],
  detailDoc: { exists: false, data: () => ({}) },
};

const validPayload = (over: Record<string, unknown> = {}) => ({
  playerUid: "playerA1",
  firstName: "Anna",
  ageCategory: "U15",
  latestSession: { dateKey: "2026-06-28", title: "S", status: "done" },
  adaptation: { adapted: false, labels: [] },
  ...over,
});

jest.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...path: string[]) => ({ __kind: "collection", path }),
  doc: (_db: unknown, ...path: string[]) => ({ __kind: "doc", path }),
  query: (ref: any) => ref, // limit/orderBy passent au travers, la ref garde son path
  limit: () => ({ __clause: "limit" }),
  orderBy: () => ({ __clause: "orderBy" }),
  where: () => ({ __clause: "where" }),
  serverTimestamp: () => "__ts",
  setDoc: jest.fn(async () => undefined),
  deleteDoc: jest.fn(async () => undefined),
  getDocs: jest.fn(async (ref: any) => {
    mockFirestoreReads.push({ kind: "collection", path: ref.path });
    if (mockFlags.getDocsThrows) throw new Error("permission-denied");
    return { docs: mockFlags.collectionDocs };
  }),
  getDoc: jest.fn(async (ref: any) => {
    mockFirestoreReads.push({ kind: "doc", path: ref.path });
    if (mockFlags.getDocThrows) throw new Error("permission-denied");
    return { exists: () => mockFlags.detailDoc.exists, data: mockFlags.detailDoc.data };
  }),
}));

import {
  normalizeInviteCode,
  generateInviteCode,
  fetchClubPlayerSummaries,
  fetchClubPlayerSummary,
} from "../clubsRepo";

beforeEach(() => {
  mockFirestoreReads.length = 0;
  mockFlags.getDocsThrows = false;
  mockFlags.getDocThrows = false;
  // Défaut : un doc valide dont l'id === payload.playerUid.
  mockFlags.collectionDocs = [{ id: "playerA1", data: () => validPayload() }];
  mockFlags.detailDoc = { exists: true, data: () => validPayload() };
});

describe("normalizeInviteCode", () => {
  test("met en majuscules et retire les espaces", () => {
    expect(normalizeInviteCode("  fksf-1234 ")).toBe("FKSF-1234");
    expect(normalizeInviteCode("ab cd 12")).toBe("ABCD12");
  });

  test("retire les caractères non alphanumériques (hors tiret)", () => {
    expect(normalizeInviteCode("fk@s#f_1234!")).toBe("FKSF1234");
    expect(normalizeInviteCode("ABC-123")).toBe("ABC-123");
  });

  test("chaîne vide ou invalide → vide", () => {
    expect(normalizeInviteCode("")).toBe("");
    expect(normalizeInviteCode("   ")).toBe("");
  });
});

describe("generateInviteCode", () => {
  test("respecte le format PREFIX-DDDD", () => {
    const code = generateInviteCode("FC Exemple");
    expect(code).toMatch(/^[A-Z]{1,4}-\d{4}$/);
  });

  test("utilise le début du nom du club comme préfixe quand possible", () => {
    const code = generateInviteCode("Lille");
    expect(code.startsWith("LILL-")).toBe(true);
  });

  test("génère un préfixe de secours si le nom est trop court", () => {
    const code = generateInviteCode("FC");
    expect(code).toMatch(/^[A-Z]{4}-\d{4}$/);
  });
});

describe("fetchClubPlayerSummaries — lecture coach-safe (collection)", () => {
  test("lit UNIQUEMENT clubs/{clubId}/playerSummaries", async () => {
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.unavailable).toBe(false);
    expect(res.summaries).toHaveLength(1);
    expect(res.summaries[0].playerUid).toBe("playerA1");

    expect(mockFirestoreReads).toHaveLength(1);
    expect(mockFirestoreReads[0]).toEqual({ kind: "collection", path: ["clubs", "clubX", "playerSummaries"] });
  });

  test("ne lit jamais users / sessions / plannedSessions", async () => {
    await fetchClubPlayerSummaries("clubX");
    const flat = mockFirestoreReads.flatMap((r) => r.path);
    expect(flat).not.toContain("users");
    expect(flat).not.toContain("sessions");
    expect(flat).not.toContain("plannedSessions");
  });

  test("lecture refusée → état indisponible propre, pas de fallback", async () => {
    mockFlags.getDocsThrows = true;
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.unavailable).toBe(true);
    expect(res.summaries).toEqual([]);
    // aucune autre lecture n'a été tentée (pas de repli vers users/sessions)
    expect(mockFirestoreReads.every((r) => r.path[0] === "clubs" && r.path[2] === "playerSummaries")).toBe(true);
  });

  test("intégrité : doc.id='playerA' mais payload.playerUid='playerB' → doc ignoré", async () => {
    mockFlags.collectionDocs = [
      { id: "playerA", data: () => validPayload({ playerUid: "playerB" }) }, // incohérent
      { id: "playerC", data: () => validPayload({ playerUid: "playerC" }) }, // cohérent
    ];
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.unavailable).toBe(false);
    expect(res.summaries.map((s) => s.playerUid)).toEqual(["playerC"]); // playerB jamais retenu
  });
});

describe("fetchClubPlayerSummary — lecture coach-safe (doc unique)", () => {
  test("lit UNIQUEMENT clubs/{clubId}/playerSummaries/{playerUid}", async () => {
    const res = await fetchClubPlayerSummary("clubX", "playerA1");
    expect(res.unavailable).toBe(false);
    expect(res.summary?.playerUid).toBe("playerA1");
    expect(mockFirestoreReads).toHaveLength(1);
    expect(mockFirestoreReads[0]).toEqual({ kind: "doc", path: ["clubs", "clubX", "playerSummaries", "playerA1"] });
  });

  test("lecture refusée → indisponible, pas de fallback brut", async () => {
    mockFlags.getDocThrows = true;
    const res = await fetchClubPlayerSummary("clubX", "playerA1");
    expect(res.unavailable).toBe(true);
    expect(res.summary).toBeNull();
    const flat = mockFirestoreReads.flatMap((r) => r.path);
    expect(flat).not.toContain("users");
    expect(flat).not.toContain("sessions");
  });

  test("intégrité : payload.playerUid='playerB' ≠ playerUid demandé 'playerA1' → null", async () => {
    mockFlags.detailDoc = { exists: true, data: () => validPayload({ playerUid: "playerB" }) };
    const res = await fetchClubPlayerSummary("clubX", "playerA1");
    // jamais renvoyer/ouvrir un autre UID que celui demandé par la route
    expect(res.summary).toBeNull();
    expect(res.unavailable).toBe(false);
  });

  test("doc absent → summary null, pas indisponible", async () => {
    mockFlags.detailDoc = { exists: false, data: () => ({}) };
    const res = await fetchClubPlayerSummary("clubX", "playerA1");
    expect(res.summary).toBeNull();
    expect(res.unavailable).toBe(false);
  });
});
