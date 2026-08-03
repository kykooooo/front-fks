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
// `coachAccess` = état SERVEUR d'autorisation d'accès au suivi. Non précisé dans
// une fixture, il vaut "approved" : ces tests-là portent sur la lecture, pas sur
// l'autorisation. `null` signifie CHAMP ABSENT (membership ancien) — c'est le
// cas fail-closed, testé explicitement plus bas.
type MemberEntry = { id: string; role: string; coachAccess?: string | null };
const mockFlags: {
  membersThrows: boolean;
  members: MemberEntry[];
  summaryById: Record<string, SummaryEntry>;
  // Repli lecture doc unique (tests fetchClubPlayerSummary).
  getDocThrows: boolean;
  detailDoc: { exists: boolean; data: () => any };
  // Membership lu par fetchClubPlayerSummary (fiche joueur).
  memberDoc: { exists: boolean; data: () => any; throws?: boolean };
} = {
  membersThrows: false,
  members: [],
  summaryById: {},
  getDocThrows: false,
  detailDoc: { exists: false, data: () => ({}) },
  memberDoc: { exists: true, data: () => ({ uid: "playerA1", playerStatus: "active", coachAccess: "approved" }) },
};

/**
 * Document member tel que le serveur l'écrit, sur les DEUX AXES.
 *
 * La fixture garde un raccourci `role` LISIBLE ("coach", "player"…), traduit ici
 * vers les champs réels : `accessRole` porte les permissions d'encadrement,
 * `playerStatus` porte le statut de joueur. Un raccourci inconnu ("staff") ne
 * produit NI l'un NI l'autre — c'est le cas fail-closed.
 *
 * Le raccourci "coach-joueur" produit LES DEUX : c'est l'entraîneur-joueur, et
 * il doit apparaître dans l'effectif suivi comme n'importe quel joueur.
 *
 * Champ `coachAccess` omis si `coachAccess === null` (membership ancien).
 */
const memberData = (m: MemberEntry) => ({
  uid: m.id,
  ...(m.role === "owner" || m.role === "coach" ? { accessRole: m.role } : {}),
  ...(m.role === "coach-joueur" ? { accessRole: "coach", playerStatus: "active" } : {}),
  ...(m.role === "player" ? { playerStatus: "active" } : {}),
  ...(m.coachAccess === null ? {} : { coachAccess: m.coachAccess ?? "approved" }),
});

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
  // Deux formes réelles : doc(db, ...segments) et doc(collectionRef) (ID auto,
  // utilisé par createClub). La seconde doit produire un id, sinon le test ne
  // verrait pas la différence entre "club créé" et "club sans identité".
  doc: (dbOrRef: any, ...path: string[]) => {
    if (dbOrRef && dbOrRef.__kind === "collection") {
      const id = "autoId1";
      return { __kind: "doc", path: [...dbOrRef.path, id], id };
    }
    return { __kind: "doc", path, id: path[path.length - 1] };
  },
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
      return { docs: mockFlags.members.map((m) => ({ id: m.id, data: () => memberData(m) })) };
    }
    return { docs: [] };
  }),
  getDoc: jest.fn(async (ref: any) => {
    mockFirestoreReads.push({ kind: "doc", path: ref.path });
    // Lecture du membership (fiche joueur) : porte l'état d'autorisation.
    if (ref.path[2] === "members") {
      if (mockFlags.memberDoc.throws) throw new Error("permission-denied");
      return { exists: () => mockFlags.memberDoc.exists, data: mockFlags.memberDoc.data };
    }
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

import { setDoc } from "firebase/firestore";
import {
  createClub,
  createClubAsCoach,
  setClubMembership,
  fetchClubPlayerSummaries,
  fetchClubPlayerSummary,
} from "../clubsRepo";

const setDocMock = setDoc as unknown as jest.Mock;

beforeEach(() => {
  setDocMock.mockClear();
  mockFirestoreReads.length = 0;
  mockFlags.membersThrows = false;
  mockFlags.members = [];
  mockFlags.summaryById = {};
  mockFlags.getDocThrows = false;
  // Défaut lecture doc unique : un doc valide dont l'id === payload.playerUid.
  mockFlags.detailDoc = { exists: true, data: () => validPayload() };
  // Défaut membership : joueur rattaché ET autorisé.
  mockFlags.memberDoc = {
    exists: true,
    data: () => ({ uid: "playerA1", playerStatus: "active", coachAccess: "approved" }),
  };
});

// Helpers de lecture des chemins capturés.
const summaryDocIds = () =>
  mockFirestoreReads.filter((r) => r.kind === "doc" && r.path[2] === "playerSummaries").map((r) => r.path[3]);
const memberCollectionReads = () =>
  mockFirestoreReads.filter((r) => r.kind === "collection" && r.path[r.path.length - 1] === "members");

// ─── Contrat d'invitation : ce que le repository ne fait PLUS ───────────────
// La génération, la résolution et la preuve d'invitation ont quitté le front.
// Ces tests verrouillent l'absence : si quelqu'un remet un code dans le
// document club ou dans le membership, ils tombent.

describe("createClub — plus aucun code d'invitation côté client", () => {
  test("n'écrit AUCUN champ inviteCode et ne lit jamais la collection inviteCodes", async () => {
    const club = await createClub({ name: "Club X", ownerUid: "coachA" });

    expect(club).toEqual({ id: expect.any(String), name: "Club X", ownerUid: "coachA" });
    // Aucune lecture : l'ancien contrôle d'unicité du code a disparu avec le code.
    expect(mockFirestoreReads).toHaveLength(0);

    expect(setDocMock).toHaveBeenCalledTimes(1);
    const payload = setDocMock.mock.calls[0][1];
    expect(payload).not.toHaveProperty("inviteCode");
    expect(payload).toMatchObject({ name: "Club X", ownerUid: "coachA" });
    // Et surtout : rien n'est écrit dans l'annuaire (collection fermée).
    expect(
      setDocMock.mock.calls.some((c: any[]) => c[0]?.path?.[0] === "inviteCodes"),
    ).toBe(false);
  });

  test("nom vide → erreur explicite, aucune écriture", async () => {
    await expect(createClub({ name: "   ", ownerUid: "coachA" })).rejects.toThrow("CLUB_NAME_REQUIRED");
    expect(setDocMock).not.toHaveBeenCalled();
  });
});

describe("setClubMembership — le membership ne porte plus de preuve", () => {
  test("écrit uid/role sans champ inviteCode (la preuve est l'écriture serveur elle-même)", async () => {
    await setClubMembership({ clubId: "clubX", uid: "coachA", accessRole: "coach" });

    expect(setDocMock).toHaveBeenCalledTimes(1);
    const [ref, payload] = setDocMock.mock.calls[0];
    expect(ref.path).toEqual(["clubs", "clubX", "members", "coachA"]);
    expect(payload).not.toHaveProperty("inviteCode");
    expect(payload).toMatchObject({ uid: "coachA", accessRole: "coach" });
    // Le STATUT DE JOUEUR n'est jamais écrit par un client : les règles le
    // refusent, au même titre que `coachAccess`.
    expect(payload).not.toHaveProperty("playerStatus");
  });
});

// ─── Création de club : les DEUX sources de l'autorité, posées ensemble ─────
//
// Le prédicat d'autorité exige que `ownerUid` désigne le propriétaire ET que son
// appartenance porte le rôle propriétaire. Écrire l'un sans l'autre créerait un
// club incohérent dès sa naissance — c'est exactement ce que faisait l'ancienne
// séquence, qui inscrivait le créateur en « coach ».

describe("createClubAsCoach — le créateur devient PROPRIÉTAIRE, pas coach", () => {
  test("écrit ownerUid sur le club ET le rôle « owner » sur son appartenance", async () => {
    const club = await createClubAsCoach({ name: "Club Neuf", uid: "coachA", coachName: "Kyllian" });

    const ecritures = setDocMock.mock.calls.map((c: any[]) => ({
      chemin: c[0]?.path as string[],
      payload: c[1] as Record<string, unknown>,
    }));

    const clubDoc = ecritures.find((e) => e.chemin?.length === 2 && e.chemin[0] === "clubs");
    expect(clubDoc?.payload).toMatchObject({ name: "Club Neuf", ownerUid: "coachA" });

    const memberDoc = ecritures.find((e) => e.chemin?.[2] === "members");
    expect(memberDoc?.chemin).toEqual(["clubs", club.id, "members", "coachA"]);
    // LA ligne qui compte : le rôle propriétaire, pas « coach ».
    expect(memberDoc?.payload).toMatchObject({ uid: "coachA", accessRole: "owner" });
    // Et jamais l'état d'accès coach : les règles refuseraient l'écriture.
    expect(memberDoc?.payload).not.toHaveProperty("coachAccess");
  });

  test("users/{uid} ne porte QUE le pointeur de club : plus aucun rôle applicatif", async () => {
    // CHANGEMENT DE CONTRAT (juillet 2026). Ce document portait `role: "coach"`,
    // et c'est ce champ que la navigation lisait pour ouvrir l'espace coach. Or
    // les règles Firestore autorisent chacun à écrire tout son document
    // `users/{uid}` : n'importe quel joueur pouvait donc s'y déclarer coach.
    // L'espace affiché est désormais DÉRIVÉ de l'appartenance au club
    // (domain/appSpace.ts). Continuer à écrire ce champ aurait laissé un piège :
    // il ressemblait à une autorité.
    await createClubAsCoach({ name: "Club Neuf", uid: "coachA" });

    const userDoc = setDocMock.mock.calls
      .map((c: any[]) => ({ chemin: c[0]?.path as string[], payload: c[1] }))
      .find((e) => e.chemin?.[0] === "users");

    expect(userDoc?.payload).toMatchObject({
      uid: "coachA",
      clubId: expect.any(String),
      profileCompleted: true,
    });
    // LA ligne qui compte : aucun rôle applicatif n'est posé.
    expect(userDoc?.payload).not.toHaveProperty("role");
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

  test("départ ENTRE members et get summary → échec PARTIEL non destructeur (compté, jamais silencieux)", async () => {
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
    // Un seul échec ne vide PLUS tout l'effectif : les projections lisibles restent.
    expect(res.unavailable).toBe(false);
    expect(res.summaries.map((s) => s.playerUid)).toEqual(["playerA1"]);
    expect(res.unreadableCount).toBe(1);
    expect(res.pendingCount).toBe(0); // "non lu" n'est jamais confondu avec "pas encore projeté"
  });

  test("TOUTES les lectures summary refusées → indisponible global (rien de lisible)", async () => {
    mockFlags.members = [
      { id: "playerA1", role: "player" },
      { id: "playerA2", role: "player" },
    ];
    mockFlags.summaryById = {
      playerA1: { exists: false, data: () => ({}), throws: true },
      playerA2: { exists: false, data: () => ({}), throws: true },
    };
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.unavailable).toBe(true);
    expect(res.summaries).toEqual([]);
    expect(res.unreadableCount).toBe(2);
  });

  test("club sans joueur → vide honnête, jamais 'indisponible'", async () => {
    mockFlags.members = [{ id: "coachA", role: "coach" }];
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.unavailable).toBe(false);
    expect(res.summaries).toEqual([]);
    expect(res.pendingCount).toBe(0);
    expect(res.unreadableCount).toBe(0);
  });

  test("fetchedAt horodate la lecture (horloge injectable, jamais de calcul temporel serveur)", async () => {
    mockFlags.members = [{ id: "playerA1", role: "player" }];
    mockFlags.summaryById = { playerA1: { exists: true, data: () => validPayload({ playerUid: "playerA1" }) } };
    const res = await fetchClubPlayerSummaries("clubX", { now: () => 1_700_000_000_000 });
    expect(res.fetchedAt).toBe(1_700_000_000_000);
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
  test("lit le membership (état d'accès) PUIS la projection, et rien d'autre", async () => {
    const res = await fetchClubPlayerSummary("clubX", "playerA1");
    expect(res.unavailable).toBe(false);
    expect(res.restricted).toBe(false);
    expect(res.summary?.playerUid).toBe("playerA1");
    // DEUX lectures, dans cet ordre : l'état d'autorisation d'abord (il vit sur
    // l'effectif, pas sur les données de suivi), la projection ensuite.
    expect(mockFirestoreReads).toEqual([
      { kind: "doc", path: ["clubs", "clubX", "members", "playerA1"] },
      { kind: "doc", path: ["clubs", "clubX", "playerSummaries", "playerA1"] },
    ]);
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

// ─── Autorisation d'accès : TROIS états, jamais confondus ───────────────────
// non autorisé (décision serveur) ≠ pas encore prête (attente) ≠ erreur (panne).
// Ce sont trois messages différents à l'écran : la distinction se joue ici.

describe("fetchClubPlayerSummaries — partition par état d'autorisation", () => {
  test("joueurs non autorisés : comptés à part, leur projection n'est même PAS demandée", async () => {
    mockFlags.members = [
      { id: "playerOk", role: "player", coachAccess: "approved" },
      { id: "playerLibre", role: "player", coachAccess: "not_required" },
      { id: "playerAttente", role: "player", coachAccess: "pending" },
      { id: "playerRetire", role: "player", coachAccess: "revoked" },
      { id: "playerAncien", role: "player", coachAccess: null }, // champ ABSENT
      { id: "playerBizarre", role: "player", coachAccess: "APPROVED" }, // valeur inconnue
    ];
    mockFlags.summaryById = {
      playerOk: { exists: true, data: () => validPayload({ playerUid: "playerOk" }) },
      playerLibre: { exists: true, data: () => validPayload({ playerUid: "playerLibre" }) },
    };

    const res = await fetchClubPlayerSummaries("clubX");

    expect(res.summaries.map((s) => s.playerUid).sort()).toEqual(["playerLibre", "playerOk"]);
    expect(res.restrictedCount).toBe(4);
    // Ni une attente, ni une panne : les deux autres compteurs restent à zéro.
    expect(res.pendingCount).toBe(0);
    expect(res.unreadableCount).toBe(0);
    expect(res.unavailable).toBe(false);
    // Aucune lecture de projection pour les non autorisés : un refus attendu ne
    // doit pas se déguiser en erreur de lecture.
    expect(summaryDocIds().sort()).toEqual(["playerLibre", "playerOk"]);
  });

  test("membre RETIRÉ : il sort de l'effectif, il ne devient pas « non consultable »", async () => {
    // La pierre tombale du retrait serveur porte `role: "removed"` ET
    // `coachAccess: "revoked"`. Le filtre `role === "player"` la fait sortir AVANT
    // la partition d'autorisation : un joueur retiré ne doit pas grossir
    // `restrictedCount`, qui annonce « des joueurs sont là mais non consultables ».
    // Il n'est plus là du tout, et c'est ce que l'écran doit dire.
    mockFlags.members = [
      { id: "playerOk", role: "player", coachAccess: "approved" },
      { id: "playerParti", role: "removed", coachAccess: "revoked" },
    ];
    mockFlags.summaryById = {
      playerOk: { exists: true, data: () => validPayload({ playerUid: "playerOk" }) },
    };

    const res = await fetchClubPlayerSummaries("clubX");

    expect(res.summaries.map((s) => s.playerUid)).toEqual(["playerOk"]);
    expect(res.restrictedCount).toBe(0);
    expect(res.pendingCount).toBe(0);
    expect(res.unreadableCount).toBe(0);
    // Et sa projection n'est même pas demandée.
    expect(summaryDocIds()).toEqual(["playerOk"]);
  });

  test("effectif ENTIÈREMENT non autorisé : ce n'est PAS une indisponibilité", async () => {
    mockFlags.members = [
      { id: "p1", role: "player", coachAccess: "pending" },
      { id: "p2", role: "player", coachAccess: null },
    ];
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.unavailable).toBe(false); // rien n'est cassé
    expect(res.restrictedCount).toBe(2);
    expect(res.summaries).toEqual([]);
    expect(summaryDocIds()).toEqual([]);
  });

  test("les trois états coexistent sans se contaminer", async () => {
    mockFlags.members = [
      { id: "pret", role: "player", coachAccess: "approved" },
      { id: "attente", role: "player", coachAccess: "approved" },
      { id: "illisible", role: "player", coachAccess: "approved" },
      { id: "nonAutorise", role: "player", coachAccess: "pending" },
    ];
    mockFlags.summaryById = {
      pret: { exists: true, data: () => validPayload({ playerUid: "pret" }) },
      attente: { exists: false, data: () => ({}) },
      illisible: { exists: false, data: () => ({}), throws: true },
    };
    const res = await fetchClubPlayerSummaries("clubX");
    expect(res.summaries.map((s) => s.playerUid)).toEqual(["pret"]);
    expect(res.pendingCount).toBe(1);
    expect(res.unreadableCount).toBe(1);
    expect(res.restrictedCount).toBe(1);
  });
});

describe("fetchClubPlayerSummary — la fiche distingue les trois états", () => {
  test("état non autorisant → restricted, aucune lecture de projection", async () => {
    for (const coachAccess of ["pending", "revoked", "APPROVED", "", undefined]) {
      mockFirestoreReads.length = 0;
      mockFlags.memberDoc = {
        exists: true,
        data: () => ({ uid: "playerA1", role: "player", ...(coachAccess === undefined ? {} : { coachAccess }) }),
      };
      const res = await fetchClubPlayerSummary("clubX", "playerA1");
      expect(res.restricted).toBe(true);
      expect(res.unavailable).toBe(false); // décision, pas panne
      expect(res.summary).toBeNull();
      expect(summaryDocIds()).toEqual([]); // la projection n'est jamais demandée
    }
  });

  test("membership absent → non consultable (default-deny), pas une erreur", async () => {
    mockFlags.memberDoc = { exists: false, data: () => ({}) };
    const res = await fetchClubPlayerSummary("clubX", "playerA1");
    expect(res.restricted).toBe(true);
    expect(res.unavailable).toBe(false);
    expect(res.summary).toBeNull();
  });

  test("lecture du membership en échec → indisponible (on ne SAIT pas, on ne prétend pas)", async () => {
    mockFlags.memberDoc = { exists: true, data: () => ({}), throws: true };
    const res = await fetchClubPlayerSummary("clubX", "playerA1");
    expect(res.unavailable).toBe(true);
    expect(res.restricted).toBe(false); // surtout PAS "non autorisé" : ce serait un mensonge
    expect(res.summary).toBeNull();
  });

  test("autorisé + projection absente → ni restricted, ni erreur : pas encore prête", async () => {
    mockFlags.detailDoc = { exists: false, data: () => ({}) };
    const res = await fetchClubPlayerSummary("clubX", "playerA1");
    expect(res.restricted).toBe(false);
    expect(res.unavailable).toBe(false);
    expect(res.summary).toBeNull();
  });
});
