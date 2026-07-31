// repositories/__tests__/clubsRepo.test.ts
// Tests des helpers purs de gestion des codes club + preuve que la lecture coach
// suit la séquence coach-safe STRICTE : members (role player) → get direct de
// chaque clubs/{clubId}/playerSummaries/{memberId}. Jamais users/sessions/
// plannedSessions, jamais un getDocs de collection playerSummaries.
// On mocke services/firebase + firebase/firestore pour capturer les chemins lus.

jest.mock("../../services/firebase", () => ({ db: {}, auth: {} }));

// Mock firestore : on enregistre le chemin de chaque ref lue (collection/doc).
// Variables préfixées `mock` → autorisées dans une factory jest.mock().
const mockFirestoreReads: { kind: "collection" | "doc"; path: string[] }[] = [];

type SummaryEntry = { exists: boolean; data: () => any; throws?: boolean };
const mockFlags: {
  membersThrows: boolean;
  members: { id: string; role: string }[];
  summaryById: Record<string, SummaryEntry>;
  // Repli lecture doc unique (tests fetchClubPlayerSummary).
  getDocThrows: boolean;
  detailDoc: { exists: boolean; data: () => any };
} = {
  membersThrows: false,
  members: [],
  summaryById: {},
  getDocThrows: false,
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
    const last = ref.path[ref.path.length - 1];
    if (last === "members") {
      if (mockFlags.membersThrows) throw new Error("permission-denied");
      return { docs: mockFlags.members.map((m) => ({ id: m.id, data: () => ({ uid: m.id, role: m.role }) })) };
    }
    return { docs: [] };
  }),
  getDoc: jest.fn(async (ref: any) => {
    mockFirestoreReads.push({ kind: "doc", path: ref.path });
    const id = ref.path[ref.path.length - 1];
    const entry = mockFlags.summaryById[id];
    if (entry) {
      if (entry.throws) throw new Error("permission-denied");
      return { exists: () => entry.exists, data: entry.data };
    }
    if (mockFlags.getDocThrows) throw new Error("permission-denied");
    return { exists: () => mockFlags.detailDoc.exists, data: mockFlags.detailDoc.data };
  }),
}));

import {
  normalizeInviteCode,
  generateInviteCode,
  findClubByInviteCode,
  fetchClubPlayerSummaries,
  fetchClubPlayerSummary,
} from "../clubsRepo";

beforeEach(() => {
  mockFirestoreReads.length = 0;
  mockFlags.membersThrows = false;
  mockFlags.members = [];
  mockFlags.summaryById = {};
  mockFlags.getDocThrows = false;
  // Défaut lecture doc unique : un doc valide dont l'id === payload.playerUid.
  mockFlags.detailDoc = { exists: true, data: () => validPayload() };
});

// Helpers de lecture des chemins capturés.
const summaryDocIds = () =>
  mockFirestoreReads.filter((r) => r.kind === "doc" && r.path[2] === "playerSummaries").map((r) => r.path[3]);
const memberCollectionReads = () =>
  mockFirestoreReads.filter((r) => r.kind === "collection" && r.path[r.path.length - 1] === "members");

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

describe("findClubByInviteCode — résolution via l'annuaire /inviteCodes/{code} (jamais de query clubs)", () => {
  test("code connu : get doc inviteCodes/{CODE normalisé} → clubId + name, AUCUNE lecture de la collection clubs", async () => {
    mockFlags.summaryById["FKSF-1234"] = {
      exists: true,
      data: () => ({ clubId: "clubX", name: "Club X" }),
    };
    const club = await findClubByInviteCode("  fksf-1234 ");
    expect(club).toEqual({ id: "clubX", name: "Club X", inviteCode: "FKSF-1234", ownerUid: "" });
    // Preuve anti-énumération : un seul chemin lu, et c'est l'annuaire.
    expect(mockFirestoreReads).toEqual([{ kind: "doc", path: ["inviteCodes", "FKSF-1234"] }]);
  });

  test("code inconnu (doc absent) → null ; doc sans clubId → null", async () => {
    mockFlags.detailDoc = { exists: false, data: () => ({}) };
    expect(await findClubByInviteCode("ZZZZ-0000")).toBeNull();
    mockFlags.detailDoc = { exists: true, data: () => ({ name: "Sans clubId" }) };
    expect(await findClubByInviteCode("ZZZZ-0000")).toBeNull();
  });

  test("code vide/invalide → null sans aucune lecture Firestore", async () => {
    expect(await findClubByInviteCode("   ")).toBeNull();
    expect(mockFirestoreReads).toHaveLength(0);
  });
});

describe("fetchClubPlayerSummaries — roster via members → summaries (coach-safe strict)", () => {
  test("roster propre : members player → summaries lisibles (1 collection members + 1 doc/player)", async () => {
    mockFlags.members = [
      { id: "coachA", role: "coach" }, // exclu (pas player)
      { id: "playerA1", role: "player" },
      { id: "playerA2", role: "player" },
    ];
    mockFlags.summaryById = {
      playerA1: { exists: true, data: () => validPayload({ playerUid: "playerA1" }) },
      playerA2: { exists: true, data: () => validPayload({ playerUid: "playerA2" }) },
    };
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.unavailable).toBe(false);
    expect(res.summaries.map((s) => s.playerUid).sort()).toEqual(["playerA1", "playerA2"]);
    expect(res.pendingCount).toBe(0);

    // UNE requête members, puis UN getDoc par player (jamais un getDocs de playerSummaries).
    expect(memberCollectionReads()).toHaveLength(1);
    expect(summaryDocIds().sort()).toEqual(["playerA1", "playerA2"]);
    expect(
      mockFirestoreReads.some((r) => r.kind === "collection" && r.path[2] === "playerSummaries"),
    ).toBe(false);
    expect(summaryDocIds()).not.toContain("coachA"); // le coach n'est jamais lu comme summary
  });

  test("rôle coach / invalide exclu du roster player", async () => {
    mockFlags.members = [
      { id: "coachA", role: "coach" },
      { id: "staffA", role: "staff" },
      { id: "playerA1", role: "player" },
    ];
    mockFlags.summaryById = { playerA1: { exists: true, data: () => validPayload({ playerUid: "playerA1" }) } };
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.summaries.map((s) => s.playerUid)).toEqual(["playerA1"]);
    expect(summaryDocIds()).not.toContain("coachA");
    expect(summaryDocIds()).not.toContain("staffA");
  });

  test("summary stale d'un NON-membre n'est jamais lu (source de vérité = members)", async () => {
    // playerGone a un summary résiduel mais n'est PLUS dans members → jamais demandé.
    mockFlags.members = [{ id: "playerA1", role: "player" }];
    mockFlags.summaryById = {
      playerA1: { exists: true, data: () => validPayload({ playerUid: "playerA1" }) },
      playerGone: { exists: true, data: () => validPayload({ playerUid: "playerGone" }) },
    };
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.summaries.map((s) => s.playerUid)).toEqual(["playerA1"]);
    expect(summaryDocIds()).not.toContain("playerGone");
  });

  test("départ ENTRE members et get summary → unavailable, roster vide (pas de fuite)", async () => {
    mockFlags.members = [
      { id: "playerA1", role: "player" },
      { id: "playerLeaving", role: "player" },
    ];
    mockFlags.summaryById = {
      playerA1: { exists: true, data: () => validPayload({ playerUid: "playerA1" }) },
      // Départ juste après le listing : la rule refuse le get → throw (permission-denied).
      playerLeaving: { exists: false, data: () => ({}), throws: true },
    };
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.unavailable).toBe(true);
    expect(res.summaries).toEqual([]); // jamais de roster partiel présenté comme complet
    expect(res.pendingCount).toBe(0);
  });

  test("membre actif sans summary / payload malformé → pending, jamais dropé en silence", async () => {
    mockFlags.members = [
      { id: "playerReady", role: "player" },
      { id: "playerNoSummary", role: "player" },
      { id: "playerBad", role: "player" },
    ];
    mockFlags.summaryById = {
      playerReady: { exists: true, data: () => validPayload({ playerUid: "playerReady" }) },
      playerNoSummary: { exists: false, data: () => ({}) }, // projection pas encore prête
      playerBad: { exists: true, data: () => ({ nope: 1 }) }, // payload malformé (parse → null)
    };
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.unavailable).toBe(false);
    expect(res.summaries.map((s) => s.playerUid)).toEqual(["playerReady"]);
    expect(res.pendingCount).toBe(2); // playerNoSummary + playerBad, comptés (jamais dropés)
  });

  test("mismatch playerUid (payload ≠ memberId) → refusé, traité comme non prêt (pas de mélange d'identité)", async () => {
    mockFlags.members = [{ id: "playerA1", role: "player" }];
    mockFlags.summaryById = {
      playerA1: { exists: true, data: () => validPayload({ playerUid: "playerB" }) }, // incohérent
    };
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.summaries).toEqual([]);
    expect(res.pendingCount).toBe(1);
  });

  test("requête members refusée → indisponible global, aucun accès brut", async () => {
    mockFlags.membersThrows = true;
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.unavailable).toBe(true);
    expect(res.summaries).toEqual([]);
    const flat = mockFirestoreReads.flatMap((r) => r.path);
    expect(flat).not.toContain("users");
    expect(flat).not.toContain("sessions");
    expect(flat).not.toContain("plannedSessions");
  });

  test("ne lit jamais users / sessions / plannedSessions (uniquement members + playerSummaries)", async () => {
    mockFlags.members = [{ id: "playerA1", role: "player" }];
    mockFlags.summaryById = { playerA1: { exists: true, data: () => validPayload({ playerUid: "playerA1" }) } };
    await fetchClubPlayerSummaries("clubX");
    const flat = mockFirestoreReads.flatMap((r) => r.path);
    expect(flat).not.toContain("users");
    expect(flat).not.toContain("sessions");
    expect(flat).not.toContain("plannedSessions");
    expect(
      mockFirestoreReads.every(
        (r) => r.path[0] === "clubs" && (r.path[2] === "members" || r.path[2] === "playerSummaries"),
      ),
    ).toBe(true);
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
