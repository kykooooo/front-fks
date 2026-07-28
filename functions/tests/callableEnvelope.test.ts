// functions/tests/callableEnvelope.test.ts
//
// L'ENVELOPPE CALLABLE — la couche qui ETABLIT L'IDENTITE.
//
// callableRights.test.ts interroge le COEUR de decision (qui a le droit de
// quoi). Ce fichier-ci interroge la couche d'AVANT : celle qui lit
// `request.auth`, decide s'il y a un appelant, et traduit les refus internes en
// erreurs visibles par le client. C'est le point ou une usurpation se jouerait :
// si l'enveloppe acceptait un identifiant venu de la charge utile, aucune regle
// et aucun coeur pur ne pourrait rattraper le coup, puisque tous recevraient
// « la bonne identite » d'un menteur.
//
// ─── CE QUE « FIDELE » VEUT DIRE ICI ────────────────────────────────────────
//
// Aucun test ne recopie une enveloppe. Chaque scenario est joue DEUX FOIS, sur
// les deux seules facons d'atteindre le traitement reel :
//
//   1. `callable.run(request)` — l'OBJET EXPORTE PAR index.ts, celui qui est
//      deploye. `onCall` de firebase-functions v2 pose `func.run = withInit(h)`
//      ou `h` est exactement le traitement passe a `onCall`. Passer par `.run`,
//      c'est donc executer la fonction deployee, pas une copie.
//   2. `xxxHandler(request)` — le traitement extrait, exporte pour la lisibilite
//      des tests.
//
// Les deux chemins subissent la MEME matrice. Si l'un derivait de l'autre (par
// exemple si quelqu'un reecrivait un traitement dans `onCall` en laissant
// l'export de test en place), la moitie des tests tomberait. Un test dedie
// verrouille en plus l'egalite d'objet entre `index.ts` et ce qui est teste ici.
//
// ─── LE PIEGE, ET COMMENT IL EST TENU ───────────────────────────────────────
//
// Rendre une enveloppe testable ne doit JAMAIS ouvrir une porte pour injecter
// une fausse identite en production. Ici :
//   - aucun traitement ne prend d'identite en parametre : ils prennent UNE
//     requete, et une seule (verrouille par un test sur l'arite) ;
//   - l'identite est lue par le traitement lui-meme, via `readCallerUid`
//     (functions/src/callableIdentity.ts), depuis `request.auth` ;
//   - ce sont les REQUETES que les tests fabriquent. En production, `request.auth`
//     est remplie par le runtime callable APRES verification du jeton Firebase :
//     personne ne peut la poster.
//
// Ce qui est faux dans ces tests, ce sont donc UNIQUEMENT les entrees/sorties
// (Firestore, Auth), jamais la decision d'identite.

import { HttpsError } from "firebase-functions/v2/https";

import {
  MEMBER_NOT_FOUND_CODE,
  OWNER_TRANSFER_CODE,
  OWNER_TRANSFER_REQUIRED,
  REMOVE_DENIED_CODE,
  REMOVE_DENIED_MESSAGE,
  memberPaths,
} from "../src/clubMembers";
import { TRANSFER_DENIED_CODE } from "../src/clubOwnership";
import {
  INVITE_CODE_MAX_USES,
  INVITE_CODE_TTL_MS,
  INVITE_REJECTED_CODE,
  ISSUE_REJECTED_CODE,
  hashInviteCode,
  invitePaths,
} from "../src/inviteCodes";

// ─── Doublures d'entrees/sorties ────────────────────────────────────────────
// `mock…` : prefixe exige par le releveur de `jest.mock` (les fabriques sont
// hoistees au-dessus des imports ; elles ne DEREFERENCENT ces variables qu'a
// l'appel, donc apres initialisation).

jest.mock("firebase-functions/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
}));

jest.mock("../src/admin", () => ({
  getDb: () => mockDb,
  getAdminAuth: () => ({
    deleteUser: async (uid: string) => {
      mockAuthDeletions.push(uid);
      if (mockAuthDeleteError) throw mockAuthDeleteError;
    },
  }),
}));

// Espions qui APPELLENT LE VRAI COEUR. On observe les arguments recus sans rien
// changer au comportement : c'est ce qui permet de prouver « l'uid transmis est
// exactement request.auth.uid » par instrumentation, et pas par lecture du code.
jest.mock("../src/clubMembers", () => {
  const actual = jest.requireActual<typeof import("../src/clubMembers")>("../src/clubMembers");
  return {
    ...actual,
    removeClubMember: jest.fn(actual.removeClubMember),
    deactivateClubPlayer: jest.fn(actual.deactivateClubPlayer),
    revokeClubStaffAccess: jest.fn(actual.revokeClubStaffAccess),
  };
});

jest.mock("../src/clubOwnership", () => {
  const actual = jest.requireActual<typeof import("../src/clubOwnership")>("../src/clubOwnership");
  return { ...actual, transferClubOwnership: jest.fn(actual.transferClubOwnership) };
});

jest.mock("../src/inviteCodes", () => {
  const actual = jest.requireActual<typeof import("../src/inviteCodes")>("../src/inviteCodes");
  return {
    ...actual,
    issueInviteCode: jest.fn(actual.issueInviteCode),
    joinClubWithCode: jest.fn(actual.joinClubWithCode),
  };
});

// Ces imports viennent APRES les fabriques de doublures : c'est l'ordre exige
// par jest (les modules sont resolus une fois les mocks poses).
import * as clubMembersCore from "../src/clubMembers";
import * as clubOwnershipCore from "../src/clubOwnership";
import * as inviteCore from "../src/inviteCodes";

import {
  issueClubInviteCode,
  issueClubInviteCodeHandler,
  joinClubWithInviteCode,
  joinClubWithInviteCodeHandler,
} from "../src/clubInvites";
import {
  deactivateClubPlayer,
  deactivateClubPlayerHandler,
  removeClubMember,
  removeClubMemberHandler,
  revokeClubStaffAccess,
  revokeClubStaffAccessHandler,
} from "../src/clubMembersApi";
import { transferClubOwnership, transferClubOwnershipHandler } from "../src/clubOwnershipApi";
import { deleteAccount, deleteAccountHandler } from "../src/deleteAccount";
import * as deployed from "../src/index";

// ═══════════════════════════════════════════════════════════════════════════
// Faux Firestore. Il ne DECIDE rien : il stocke, il rend, il journalise les
// chemins touches. Toute la decision reste dans le coeur reel.
// ═══════════════════════════════════════════════════════════════════════════

type DocRef = { path: string };
type DocData = Record<string, unknown>;

class FakeDb {
  readonly docs = new Map<string, DocData>();
  readonly deletedPaths: string[] = [];
  /** Panne simulee d'une lecture (pour eprouver la neutralite des erreurs). */
  failure: Error | null = null;
  collectionGroupAvailable = true;

  seed(path: string, data: DocData): void {
    this.docs.set(path, { ...data });
  }

  read(path: string): DocData | null {
    return this.docs.get(path) ?? null;
  }

  /** Empreinte comparable de la base : sert a prouver « aucune ecriture ». */
  snapshot(): string {
    return JSON.stringify([...this.docs.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }

  private put(path: string, data: DocData, merge: boolean): void {
    const current = this.docs.get(path);
    this.docs.set(path, merge && current ? { ...current, ...data } : { ...data });
  }

  private drop(path: string): void {
    this.docs.delete(path);
    this.deletedPaths.push(path);
  }

  private snap(path: string) {
    if (this.failure) throw this.failure;
    const data = this.docs.get(path);
    return { exists: data !== undefined, data: () => (data ? { ...data } : undefined) };
  }

  // Fonctions flechees partout : elles capturent l'instance sans alias de `this`.
  doc(path: string) {
    return {
      path,
      get: async () => this.snap(path),
      set: async (data: DocData, opts?: { merge?: boolean }) => {
        this.put(path, data, opts?.merge === true);
      },
    };
  }

  batch() {
    const ops: Array<() => void> = [];
    return {
      delete: (ref: DocRef) => {
        ops.push(() => this.drop(ref.path));
      },
      commit: async () => {
        for (const op of ops) op();
      },
    };
  }

  async recursiveDelete(ref: DocRef): Promise<void> {
    const prefix = `${ref.path}/`;
    for (const key of [...this.docs.keys()]) {
      if (key === ref.path || key.startsWith(prefix)) this.drop(key);
    }
  }

  collectionGroup(name: string) {
    return {
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => {
          if (!this.collectionGroupAvailable) throw new Error("index collection-group absent");
          const docs: Array<{ ref: { parent: { parent: { id: string } } } }> = [];
          for (const [path, data] of this.docs) {
            const parts = path.split("/");
            if (parts.length === 4 && parts[2] === name && data[field] === value) {
              docs.push({ ref: { parent: { parent: { id: parts[1] } } } });
            }
          }
          return { docs };
        },
      }),
    };
  }

  async runTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const writes: Array<() => void> = [];
    const tx = {
      get: async (ref: DocRef) => this.snap(ref.path),
      set: (ref: DocRef, data: DocData, opts?: { merge?: boolean }) => {
        writes.push(() => this.put(ref.path, data, opts?.merge === true));
      },
      delete: (ref: DocRef) => {
        writes.push(() => this.drop(ref.path));
      },
    };
    const result = await fn(tx);
    for (const write of writes) write();
    return result;
  }
}

let mockDb: FakeDb;
const mockAuthDeletions: string[] = [];
let mockAuthDeleteError: unknown = null;

// ═══════════════════════════════════════════════════════════════════════════
// Effectif de reference (le meme vocabulaire que callableRights.test.ts)
// ═══════════════════════════════════════════════════════════════════════════

const CLUB_A = "clubA";
const CLUB_B = "clubB";
const COACH_A = "coachA"; // proprietaire ET encadrant du club A
const COACH_A2 = "coachA2"; // encadrant du club A, NON proprietaire
const COACH_B = "coachB"; // proprietaire ET encadrant du club B
const PLAYER_A1 = "playerA1";
const PLAYER_A2 = "playerA2";
const RETIRE_A = "retireA"; // ancien membre du club A (pierre tombale)
const STRANGER = "stranger";
const CODE_CLUB_A = "ABCDEFGHJK";

function seedEffectif(db: FakeDb): void {
  db.seed(memberPaths.club(CLUB_A), { name: "Club A", ownerUid: COACH_A });
  db.seed(memberPaths.club(CLUB_B), { name: "Club B", ownerUid: COACH_B });

  db.seed(memberPaths.member(CLUB_A, COACH_A), { uid: COACH_A, accessRole: "owner" });
  db.seed(memberPaths.member(CLUB_A, COACH_A2), { uid: COACH_A2, accessRole: "coach" });
  db.seed(memberPaths.member(CLUB_A, PLAYER_A1), { uid: PLAYER_A1, playerStatus: "active" });
  db.seed(memberPaths.member(CLUB_A, PLAYER_A2), { uid: PLAYER_A2, playerStatus: "active" });
  db.seed(memberPaths.member(CLUB_A, RETIRE_A), { uid: RETIRE_A, accessRole: null, playerStatus: "inactive" });
  db.seed(memberPaths.member(CLUB_B, COACH_B), { uid: COACH_B, accessRole: "owner" });

  db.seed(memberPaths.playerSummary(CLUB_A, PLAYER_A1), { uid: PLAYER_A1, readiness: 71 });
  db.seed(memberPaths.playerSummary(CLUB_A, PLAYER_A2), { uid: PLAYER_A2, readiness: 64 });

  db.seed(memberPaths.user(COACH_A), { uid: COACH_A, clubId: CLUB_A, role: "coach" });
  db.seed(memberPaths.user(PLAYER_A1), { uid: PLAYER_A1, clubId: CLUB_A, ageCategory: "U17" });
  db.seed(`${memberPaths.user(PLAYER_A1)}/sessions/s1`, { date: "2026-07-20" });
  db.seed(memberPaths.user(PLAYER_A2), { uid: PLAYER_A2, clubId: CLUB_A, ageCategory: "U17" });
  db.seed(memberPaths.user(STRANGER), { uid: STRANGER, clubId: null, ageCategory: "U17" });
  db.seed(`${memberPaths.user(STRANGER)}/sessions/s1`, { date: "2026-07-21" });

  // Un code valide du club A, pose sans passer par l'emission. `Date.now` est la
  // seule horloge des enveloppes (elles passent `now: Date.now`), donc les
  // bornes sont relatives au temps reel.
  db.seed(invitePaths.code(hashInviteCode(CODE_CLUB_A)), {
    clubId: CLUB_A,
    createdBy: COACH_A,
    createdAt: Date.now() - 1000,
    expiresAt: Date.now() + INVITE_CODE_TTL_MS,
    maxUses: INVITE_CODE_MAX_USES,
    uses: 0,
    revokedAt: null,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Fabrication des requetes. C'est la REQUETE qu'on fabrique — jamais l'identite
// qu'on court-circuite : le traitement va la lire lui-meme.
// ═══════════════════════════════════════════════════════════════════════════

const RAW_REQUEST = { ip: "203.0.113.7", headers: {} };
const SANS_AUTH = Symbol("sans propriete auth");

function request(auth: unknown, data: unknown): unknown {
  const req: Record<string, unknown> = { data, rawRequest: RAW_REQUEST, acceptsStreaming: false };
  if (auth !== SANS_AUTH) req.auth = auth;
  return req;
}

/** Requete authentifiee ordinaire (ce que produit le runtime apres le jeton). */
function signedBy(uid: string, data: unknown): unknown {
  return request({ uid, token: { uid, sub: uid, aud: "fks-apps" } }, data);
}

/**
 * TOUS LES CHAMPS PAR LESQUELS ON POURRAIT ESPERER SE FAIRE PASSER POUR UN
 * AUTRE. Ils sont glisses dans `request.data`, c'est-a-dire dans la seule partie
 * de la requete qu'un client controle entierement.
 */
function chargeUsurpatrice(cible: string): Record<string, unknown> {
  // `__proto__` doit etre une propriete PROPRE : un litteral ordinaire le
  // traiterait comme le prototype. `JSON.parse` + diffusion la conservent.
  const pollution = JSON.parse('{"__proto__":{"fksPollution":"oui"}}') as Record<string, unknown>;
  return {
    ...pollution,
    uid: cible,
    actorUid: cible,
    callerUid: cible,
    userId: cible,
    auth: { uid: cible, token: { uid: cible } },
    request: { auth: { uid: cible } },
    accessRole: "owner",
    ownerUid: cible,
    isAdmin: true,
    admin: true,
    mode: "admin",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Les deux chemins d'appel. Meme matrice sur les deux : aucun ne peut deriver.
// ═══════════════════════════════════════════════════════════════════════════

type Invoke = (deployedFn: unknown, handler: unknown, req: unknown) => Promise<unknown>;

const CHEMINS: Array<[string, Invoke]> = [
  [
    "callable deployee (.run)",
    (deployedFn, _handler, req) =>
      (deployedFn as { run: (r: unknown) => Promise<unknown> }).run(req),
  ],
  ["handler exporte", (_deployedFn, handler, req) => (handler as Invoke0)(req)],
];

type Invoke0 = (req: unknown) => Promise<unknown>;

// ─── Outils d'assertion ─────────────────────────────────────────────────────

async function refus(promise: Promise<unknown>): Promise<HttpsError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof HttpsError) return err;
    throw err;
  }
  throw new Error("aucune erreur levee alors qu'un refus etait attendu");
}

const removeSpy = clubMembersCore.removeClubMember as unknown as jest.Mock;
const suiviSpy = clubMembersCore.deactivateClubPlayer as unknown as jest.Mock;
const encadrementSpy = clubMembersCore.revokeClubStaffAccess as unknown as jest.Mock;
const transferSpy = clubOwnershipCore.transferClubOwnership as unknown as jest.Mock;
const issueSpy = inviteCore.issueInviteCode as unknown as jest.Mock;
const joinSpy = inviteCore.joinClubWithCode as unknown as jest.Mock;

const TOUS_LES_ESPIONS = [removeSpy, suiviSpy, encadrementSpy, transferSpy, issueSpy, joinSpy];

/** Le 2e argument recu par le coeur : c'est la ou vit l'identite transmise. */
function paramsCoeur(spy: jest.Mock, index = 0): Record<string, unknown> {
  expect(spy.mock.calls.length).toBeGreaterThan(index);
  return spy.mock.calls[index][1] as Record<string, unknown>;
}

beforeEach(() => {
  mockDb = new FakeDb();
  seedEffectif(mockDb);
  mockAuthDeletions.length = 0;
  mockAuthDeleteError = null;
  for (const spy of TOUS_LES_ESPIONS) spy.mockClear();
});

// ═══════════════════════════════════════════════════════════════════════════
// 0 — L'OBJET TESTE EST BIEN CELUI QUI EST DEPLOYE
// ═══════════════════════════════════════════════════════════════════════════

describe("0 — l'enveloppe testee est celle qui part en production", () => {
  it("0.1 index.ts exporte EXACTEMENT les objets interroges ici", () => {
    expect(deployed.removeClubMember).toBe(removeClubMember);
    expect(deployed.deactivateClubPlayer).toBe(deactivateClubPlayer);
    expect(deployed.revokeClubStaffAccess).toBe(revokeClubStaffAccess);
    expect(deployed.transferClubOwnership).toBe(transferClubOwnership);
    expect(deployed.issueClubInviteCode).toBe(issueClubInviteCode);
    expect(deployed.joinClubWithInviteCode).toBe(joinClubWithInviteCode);
    expect(deployed.deleteAccount).toBe(deleteAccount);
  });

  it("0.2 chaque callable deployee expose le traitement reel via .run", () => {
    for (const fn of [
      removeClubMember,
      deactivateClubPlayer,
      revokeClubStaffAccess,
      transferClubOwnership,
      issueClubInviteCode,
      joinClubWithInviteCode,
      deleteAccount,
    ]) {
      expect(typeof (fn as unknown as { run?: unknown }).run).toBe("function");
    }
  });

  it("0.3 aucun traitement ne prend d'identite en parametre : une requete, et rien d'autre", () => {
    // LE VERROU CONTRE LE PIEGE. Rendre l'enveloppe interrogeable ne doit pas
    // creer d'entree « voici qui je suis ». Une arite de 1 signifie : la seule
    // chose qu'on peut fournir, c'est la requete — dont `auth` est remplie par
    // le runtime en production, jamais par le client.
    expect(removeClubMemberHandler.length).toBe(1);
    expect(deactivateClubPlayerHandler.length).toBe(1);
    expect(revokeClubStaffAccessHandler.length).toBe(1);
    expect(transferClubOwnershipHandler.length).toBe(1);
    expect(issueClubInviteCodeHandler.length).toBe(1);
    expect(joinClubWithInviteCodeHandler.length).toBe(1);
    expect(deleteAccountHandler.length).toBe(1);
  });

  it("0.4 la callable deployee et le traitement exporte font la MEME chose, au meme argument pres", async () => {
    // Preuve de non-derive : meme requete, meme resultat, ET meme appel au
    // coeur (arguments compares en entier). Une reimplementation dans `onCall`
    // ferait diverger l'un des trois.
    const req = () => signedBy(COACH_A, { clubId: CLUB_A, memberUid: PLAYER_A1 });

    const viaRun = await (
      removeClubMember as unknown as { run: (r: unknown) => Promise<unknown> }
    ).run(req());
    const argsRun = JSON.stringify(paramsCoeur(removeSpy, 0));

    mockDb = new FakeDb();
    seedEffectif(mockDb);
    removeSpy.mockClear();

    const viaHandler = await (removeClubMemberHandler as unknown as Invoke0)(req());
    const argsHandler = JSON.stringify(paramsCoeur(removeSpy, 0));

    expect(viaHandler).toEqual(viaRun);
    expect(argsHandler).toBe(argsRun);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LA MATRICE, JOUEE SUR LES DEUX CHEMINS
// ═══════════════════════════════════════════════════════════════════════════

describe.each(CHEMINS)("%s", (_chemin, invoke) => {
  const appelRetrait = (req: unknown) => invoke(removeClubMember, removeClubMemberHandler, req);
  const appelArretSuivi = (req: unknown) =>
    invoke(deactivateClubPlayer, deactivateClubPlayerHandler, req);
  const appelRetraitEncadrement = (req: unknown) =>
    invoke(revokeClubStaffAccess, revokeClubStaffAccessHandler, req);
  const appelTransfert = (req: unknown) =>
    invoke(transferClubOwnership, transferClubOwnershipHandler, req);
  const appelEmission = (req: unknown) =>
    invoke(issueClubInviteCode, issueClubInviteCodeHandler, req);
  const appelRattachement = (req: unknown) =>
    invoke(joinClubWithInviteCode, joinClubWithInviteCodeHandler, req);
  const appelSuppression = (req: unknown) => invoke(deleteAccount, deleteAccountHandler, req);

  const TOUTES: Array<[string, (req: unknown) => Promise<unknown>, unknown]> = [
    ["removeClubMember", appelRetrait, { clubId: CLUB_A, memberUid: PLAYER_A1 }],
    ["deactivateClubPlayer", appelArretSuivi, { clubId: CLUB_A, memberUid: PLAYER_A1 }],
    ["revokeClubStaffAccess", appelRetraitEncadrement, { clubId: CLUB_A, memberUid: PLAYER_A1 }],
    ["transferClubOwnership", appelTransfert, { clubId: CLUB_A, newOwnerUid: COACH_A2 }],
    ["issueClubInviteCode", appelEmission, { clubId: CLUB_A }],
    ["joinClubWithInviteCode", appelRattachement, { code: CODE_CLUB_A }],
    ["deleteAccount", appelSuppression, {}],
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // 1 — APPEL NON AUTHENTIFIE
  // ─────────────────────────────────────────────────────────────────────────

  describe("1 — appel non authentifie", () => {
    it.each(TOUTES)("1.1 %s refuse un appel sans jeton, et n'ecrit rien", async (_nom, appel, data) => {
      const avant = mockDb.snapshot();
      const err = await refus(appel(request(SANS_AUTH, data)));

      expect(err.code).toBe("unauthenticated");
      expect(mockDb.snapshot()).toBe(avant);
      expect(mockDb.deletedPaths).toEqual([]);
      expect(mockAuthDeletions).toEqual([]);
      for (const spy of TOUS_LES_ESPIONS) expect(spy).not.toHaveBeenCalled();
    });

    it("1.2 le refus tombe AVANT toute lecture : le coeur n'est meme pas atteint", async () => {
      await refus(appelRetrait(request(SANS_AUTH, { clubId: CLUB_A, memberUid: PLAYER_A1 })));
      await refus(appelTransfert(request(SANS_AUTH, { clubId: CLUB_A, newOwnerUid: COACH_A2 })));
      await refus(appelEmission(request(SANS_AUTH, { clubId: CLUB_A })));
      await refus(appelRattachement(request(SANS_AUTH, { code: CODE_CLUB_A })));
      for (const spy of TOUS_LES_ESPIONS) expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2 — IDENTITE PRESENTE MAIS INEXPLOITABLE
  // ─────────────────────────────────────────────────────────────────────────

  describe("2 — request.auth present, identite absente ou d'un autre type", () => {
    const IDENTITES_INEXPLOITABLES: Array<[string, unknown]> = [
      ["auth null", null],
      ["auth vide", {}],
      ["uid absent, seulement un jeton", { token: { uid: COACH_A, sub: COACH_A } }],
      ["uid null", { uid: null }],
      ["uid undefined", { uid: undefined }],
      ["uid chaine vide", { uid: "" }],
      ["uid blanc", { uid: "   " }],
      ["uid nombre", { uid: 42 }],
      ["uid booleen", { uid: true }],
      ["uid tableau", { uid: [COACH_A] }],
      // Le piege classique : un objet dont la conversion en chaine donnerait un
      // uid valide. Sans verification stricte de type, il deviendrait « coachA ».
      ["uid objet convertible", { uid: { toString: () => COACH_A } }],
    ];

    it.each(IDENTITES_INEXPLOITABLES)(
      "2.1 %s est refuse par les sept portes, sans aucune ecriture",
      async (_nom, auth) => {
        const avant = mockDb.snapshot();
        for (const [, appel, data] of TOUTES) {
          const err = await refus(appel(request(auth, data)));
          expect(err.code).toBe("unauthenticated");
        }
        expect(mockDb.snapshot()).toBe(avant);
        expect(mockDb.deletedPaths).toEqual([]);
        expect(mockAuthDeletions).toEqual([]);
        for (const spy of TOUS_LES_ESPIONS) expect(spy).not.toHaveBeenCalled();
      },
    );

    it("2.2 un uid entoure d'espaces n'ouvre pas les droits d'un autre compte", async () => {
      // `" coachA "` ne doit pas devenir un troisieme compte, ni etre refuse a
      // tort : il est nettoye, puis traite comme coachA.
      const res = await appelRetrait(
        request({ uid: `  ${COACH_A}  ` }, { clubId: CLUB_A, memberUid: PLAYER_A1 }),
      );
      expect((res as { memberUid: string }).memberUid).toBe(PLAYER_A1);
      expect(paramsCoeur(removeSpy).actorUid).toBe(COACH_A);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3 — L'UID DE LA CHARGE UTILE EST IGNORE (LE TEST CENTRAL)
  // ─────────────────────────────────────────────────────────────────────────

  describe("3 — l'identite ne vient JAMAIS de request.data", () => {
    it("3.1 un joueur qui se declare proprietaire dans la charge utile reste un joueur", async () => {
      const avant = mockDb.snapshot();
      const err = await refus(
        appelRetrait(
          signedBy(PLAYER_A1, {
            ...chargeUsurpatrice(COACH_A),
            clubId: CLUB_A,
            memberUid: PLAYER_A2,
          }),
        ),
      );

      expect(err.code).toBe(REMOVE_DENIED_CODE);
      // Le coeur a bien recu l'identite du JETON, pas celle de la charge utile.
      expect(paramsCoeur(removeSpy).actorUid).toBe(PLAYER_A1);
      expect(mockDb.snapshot()).toBe(avant);
    });

    it("3.2 un inconnu qui se declare proprietaire ne transfere rien", async () => {
      const err = await refus(
        appelTransfert(
          signedBy(STRANGER, {
            ...chargeUsurpatrice(COACH_A),
            clubId: CLUB_A,
            newOwnerUid: STRANGER,
          }),
        ),
      );

      expect(err.code).toBe(TRANSFER_DENIED_CODE);
      expect(paramsCoeur(transferSpy).actorUid).toBe(STRANGER);
      expect(mockDb.read(memberPaths.club(CLUB_A))?.ownerUid).toBe(COACH_A);
    });

    it("3.3 un inconnu qui se declare encadrant n'emet aucun code", async () => {
      const err = await refus(
        appelEmission(signedBy(STRANGER, { ...chargeUsurpatrice(COACH_A), clubId: CLUB_A })),
      );

      expect(err.code).toBe(ISSUE_REJECTED_CODE);
      expect(paramsCoeur(issueSpy).uid).toBe(STRANGER);
      expect(mockDb.read(invitePaths.meta(CLUB_A))).toBeNull();
    });

    it("3.4 au rattachement, le membre cree porte l'uid du JETON, pas celui de la charge utile", async () => {
      await appelRattachement(
        signedBy(STRANGER, { ...chargeUsurpatrice(PLAYER_A1), code: CODE_CLUB_A }),
      );

      expect(paramsCoeur(joinSpy).uid).toBe(STRANGER);
      const nouveau = mockDb.read(memberPaths.member(CLUB_A, STRANGER));
      expect(nouveau?.uid).toBe(STRANGER);
      // Et surtout : le membre de la charge utile n'a pas ete touche.
      expect(mockDb.read(memberPaths.member(CLUB_A, PLAYER_A1))).toEqual({
        uid: PLAYER_A1,
        playerStatus: "active",
      });
    });

    it("3.5 deleteAccount supprime le compte du JETON, jamais celui nomme dans la charge utile", async () => {
      // Le cas le plus grave du lot : cette porte detruit des donnees.
      await appelSuppression(signedBy(STRANGER, chargeUsurpatrice(PLAYER_A1)));

      // L'appelant a bien disparu…
      expect(mockDb.read(memberPaths.user(STRANGER))).toBeNull();
      expect(mockDb.read(`${memberPaths.user(STRANGER)}/sessions/s1`)).toBeNull();
      expect(mockAuthDeletions).toEqual([STRANGER]);

      // … et la victime designee est intacte, en base comme cote Auth.
      expect(mockDb.read(memberPaths.user(PLAYER_A1))).not.toBeNull();
      expect(mockDb.read(`${memberPaths.user(PLAYER_A1)}/sessions/s1`)).not.toBeNull();
      expect(mockDb.read(memberPaths.member(CLUB_A, PLAYER_A1))).not.toBeNull();
      expect(mockDb.read(memberPaths.playerSummary(CLUB_A, PLAYER_A1))).not.toBeNull();
      expect(mockAuthDeletions).not.toContain(PLAYER_A1);
    });

    it("3.6 aucune de ces tentatives ne pollue le prototype des objets", () => {
      // `__proto__` glisse dans la charge utile de tous les tests precedents.
      expect(({} as Record<string, unknown>).fksPollution).toBeUndefined();
      expect((Object.prototype as unknown as Record<string, unknown>).fksPollution).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4 — request.auth.uid EST LA SEULE IDENTITE TRANSMISE AU COEUR
  // ─────────────────────────────────────────────────────────────────────────

  describe("4 — instrumentation du coeur : ce qu'il recoit, exactement", () => {
    it("4.1 removeClubMember transmet l'uid du jeton, et une forme d'arguments FIGEE", async () => {
      await refus(
        appelRetrait(
          signedBy(PLAYER_A1, {
            ...chargeUsurpatrice(COACH_A),
            clubId: CLUB_A,
            memberUid: PLAYER_A2,
          }),
        ),
      );
      const params = paramsCoeur(removeSpy);
      expect(params.actorUid).toBe(PLAYER_A1);
      // Rien d'autre ne franchit l'enveloppe : ni `role`, ni `ownerUid`, ni
      // `auth`. La forme est close, donc un champ de plus ne peut pas se glisser.
      expect(Object.keys(params).sort()).toEqual(["actorUid", "clubId", "memberUid"]);
    });

    it("4.2 transferClubOwnership transmet l'uid du jeton, et une forme d'arguments FIGEE", async () => {
      await refus(
        appelTransfert(
          signedBy(COACH_A2, {
            ...chargeUsurpatrice(COACH_A),
            clubId: CLUB_A,
            newOwnerUid: COACH_A2,
          }),
        ),
      );
      const params = paramsCoeur(transferSpy);
      expect(params.actorUid).toBe(COACH_A2);
      expect(Object.keys(params).sort()).toEqual(["actorUid", "clubId", "newOwnerUid"]);
      // Le mode administrateur, glisse dans la charge utile, n'atteint pas le
      // coeur : la porte nominale ne connait que le mode « proprietaire ».
      expect(params.mode).toBeUndefined();
    });

    it("4.3 issueClubInviteCode transmet l'uid du jeton, et une forme d'arguments FIGEE", async () => {
      await refus(appelEmission(signedBy(STRANGER, { ...chargeUsurpatrice(COACH_A), clubId: CLUB_A })));
      const params = paramsCoeur(issueSpy);
      expect(params.uid).toBe(STRANGER);
      expect(Object.keys(params).sort()).toEqual(["clubId", "originKey", "uid"]);
      // `originKey` vient du reseau (rawRequest), pas de la charge utile.
      expect(params.originKey).toBe("203.0.113.7");
    });

    it("4.4 joinClubWithInviteCode transmet l'uid du jeton, et une forme d'arguments FIGEE", async () => {
      await appelRattachement(
        signedBy(STRANGER, { ...chargeUsurpatrice(COACH_A), code: CODE_CLUB_A }),
      );
      const params = paramsCoeur(joinSpy);
      expect(params.uid).toBe(STRANGER);
      expect(Object.keys(params).sort()).toEqual(["originKey", "rawCode", "uid"]);
    });

    it("4.5 l'identite transmise est la MEME CHAINE que request.auth.uid, pour dix identites differentes", async () => {
      // Balayage : si l'enveloppe piochait ailleurs (charge utile, jeton, valeur
      // par defaut), un seul de ces dix appels suffirait a le montrer.
      for (let i = 0; i < 10; i++) {
        const uid = `appelant_${i}`;
        removeSpy.mockClear();
        await refus(
          appelRetrait(
            request(
              { uid, token: { uid: COACH_A, sub: COACH_A } },
              { ...chargeUsurpatrice(COACH_A), clubId: CLUB_A, memberUid: PLAYER_A2 },
            ),
          ),
        );
        expect(paramsCoeur(removeSpy).actorUid).toBe(uid);
      }
    });

    it("4.6 le jeton lui-meme n'est pas une source d'identite : seul auth.uid compte", async () => {
      // `auth.token.uid` dit « coachA », `auth.uid` dit « stranger ». C'est
      // `auth.uid` qui doit gagner (le jeton n'est pas relu par l'enveloppe).
      await refus(
        appelRetrait(
          request(
            { uid: STRANGER, token: { uid: COACH_A, sub: COACH_A, admin: true } },
            { clubId: CLUB_A, memberUid: PLAYER_A2 },
          ),
        ),
      );
      expect(paramsCoeur(removeSpy).actorUid).toBe(STRANGER);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5 — UTILISATEUR D'UN AUTRE CLUB
  // ─────────────────────────────────────────────────────────────────────────

  describe("5 — un encadrant d'un AUTRE club n'a aucun droit ici", () => {
    it("5.1 il ne peut retirer personne du club A", async () => {
      const avant = mockDb.snapshot();
      const err = await refus(appelRetrait(signedBy(COACH_B, { clubId: CLUB_A, memberUid: PLAYER_A1 })));
      expect(err.code).toBe(REMOVE_DENIED_CODE);
      expect(mockDb.snapshot()).toBe(avant);
    });

    it("5.2 il ne peut pas emettre de code pour le club A", async () => {
      const err = await refus(appelEmission(signedBy(COACH_B, { clubId: CLUB_A })));
      expect(err.code).toBe(ISSUE_REJECTED_CODE);
      expect(mockDb.read(invitePaths.meta(CLUB_A))).toBeNull();
    });

    it("5.3 il ne peut pas transferer la propriete du club A", async () => {
      const err = await refus(
        appelTransfert(signedBy(COACH_B, { clubId: CLUB_A, newOwnerUid: COACH_B })),
      );
      expect(err.code).toBe(TRANSFER_DENIED_CODE);
      expect(mockDb.read(memberPaths.club(CLUB_A))?.ownerUid).toBe(COACH_A);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6 — TRANSFERT : SEUL LE PROPRIETAIRE
  // ─────────────────────────────────────────────────────────────────────────

  describe("6 — transfert de propriete", () => {
    it("6.1 un encadrant NON proprietaire est refuse", async () => {
      const err = await refus(
        appelTransfert(signedBy(COACH_A2, { clubId: CLUB_A, newOwnerUid: COACH_A2 })),
      );
      expect(err.code).toBe(TRANSFER_DENIED_CODE);
      expect(mockDb.read(memberPaths.club(CLUB_A))?.ownerUid).toBe(COACH_A);
      expect(mockDb.read(memberPaths.member(CLUB_A, COACH_A2))?.accessRole).toBe("coach");
    });

    it("6.2 un joueur du club est refuse", async () => {
      const err = await refus(
        appelTransfert(signedBy(PLAYER_A1, { clubId: CLUB_A, newOwnerUid: PLAYER_A1 })),
      );
      expect(err.code).toBe(TRANSFER_DENIED_CODE);
      expect(mockDb.read(memberPaths.club(CLUB_A))?.ownerUid).toBe(COACH_A);
    });

    it("6.3 le proprietaire authentifie est ACCEPTE, et la propriete change vraiment de main", async () => {
      const res = (await appelTransfert(
        signedBy(COACH_A, { clubId: CLUB_A, newOwnerUid: COACH_A2 }),
      )) as { clubId: string; newOwnerUid: string; previousOwnerUid: string | null; mode: string };

      expect(res.newOwnerUid).toBe(COACH_A2);
      expect(res.previousOwnerUid).toBe(COACH_A);
      expect(res.mode).toBe("owner");
      expect(mockDb.read(memberPaths.club(CLUB_A))?.ownerUid).toBe(COACH_A2);
      expect(mockDb.read(memberPaths.member(CLUB_A, COACH_A2))?.accessRole).toBe("owner");
      expect(mockDb.read(memberPaths.member(CLUB_A, COACH_A))?.accessRole).toBe("coach");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7 — RETRAIT : SELON LE ROLE REEL, ET RIEN D'AUTRE
  // ─────────────────────────────────────────────────────────────────────────

  describe("7 — retrait d'un membre : le role reel decide", () => {
    it("7.1 le proprietaire retire un joueur : accepte, projection supprimee, club du joueur nettoye", async () => {
      const res = (await appelRetrait(
        signedBy(COACH_A, { clubId: CLUB_A, memberUid: PLAYER_A1 }),
      )) as { alreadyRemoved: boolean; clearedUserClub: boolean };

      expect(res.alreadyRemoved).toBe(false);
      expect(res.clearedUserClub).toBe(true);
      expect(mockDb.read(memberPaths.member(CLUB_A, PLAYER_A1))?.accessRole).toBeNull();
      expect(mockDb.read(memberPaths.member(CLUB_A, PLAYER_A1))?.playerStatus).toBe("inactive");
      expect(mockDb.read(memberPaths.playerSummary(CLUB_A, PLAYER_A1))).toBeNull();
      expect(mockDb.read(memberPaths.user(PLAYER_A1))?.clubId).toBeNull();
    });

    it("7.2 un encadrant non proprietaire retire un joueur : accepte", async () => {
      const res = (await appelRetrait(
        signedBy(COACH_A2, { clubId: CLUB_A, memberUid: PLAYER_A2 }),
      )) as { alreadyRemoved: boolean };
      expect(res.alreadyRemoved).toBe(false);
      expect(mockDb.read(memberPaths.member(CLUB_A, PLAYER_A2))?.accessRole).toBeNull();
      expect(mockDb.read(memberPaths.member(CLUB_A, PLAYER_A2))?.playerStatus).toBe("inactive");
    });

    it("7.3 un joueur ne peut retirer personne, meme dans son propre club", async () => {
      const avant = mockDb.snapshot();
      const err = await refus(appelRetrait(signedBy(PLAYER_A1, { clubId: CLUB_A, memberUid: PLAYER_A2 })));
      expect(err.code).toBe(REMOVE_DENIED_CODE);
      expect(mockDb.snapshot()).toBe(avant);
    });

    it("7.4 un ancien membre (deja retire) ne peut plus retirer personne", async () => {
      const avant = mockDb.snapshot();
      const err = await refus(appelRetrait(signedBy(RETIRE_A, { clubId: CLUB_A, memberUid: PLAYER_A1 })));
      expect(err.code).toBe(REMOVE_DENIED_CODE);
      expect(mockDb.snapshot()).toBe(avant);
    });

    it("7.5 un inconnu ne peut retirer personne", async () => {
      const err = await refus(appelRetrait(signedBy(STRANGER, { clubId: CLUB_A, memberUid: PLAYER_A1 })));
      expect(err.code).toBe(REMOVE_DENIED_CODE);
    });

    it("7.6 le proprietaire ne peut pas etre retire : echec TYPE, avec le geste a faire", async () => {
      const err = await refus(appelRetrait(signedBy(COACH_A2, { clubId: CLUB_A, memberUid: COACH_A })));
      expect(err.code).toBe(OWNER_TRANSFER_CODE);
      expect(err.details).toEqual({ reason: OWNER_TRANSFER_REQUIRED });
      expect(mockDb.read(memberPaths.member(CLUB_A, COACH_A))?.accessRole).toBe("owner");
    });

    it("7.7 retirer quelqu'un qui n'est pas de ce club : refus non-trouve, aucune ecriture", async () => {
      const avant = mockDb.snapshot();
      const err = await refus(appelRetrait(signedBy(COACH_A, { clubId: CLUB_A, memberUid: COACH_B })));
      expect(err.code).toBe(MEMBER_NOT_FOUND_CODE);
      expect(mockDb.snapshot()).toBe(avant);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7 bis — LES DEUX AUTRES FORMES DE RETRAIT
  //
  // Ce qui se joue ici, et qui ne se voit nulle part ailleurs : chaque callable
  // execute SA transaction. Le geste n'est pas une valeur de la charge utile,
  // c'est le point d'entree — donc il n'y a rien a usurper, et c'est verifie.
  // ─────────────────────────────────────────────────────────────────────────

  describe("7 bis — arret du suivi et retrait des acces d'encadrement", () => {
    it("7b.1 arret du suivi : le statut joueur tombe, l'encadrement et le club NE BOUGENT PAS", async () => {
      // Un entraineur-joueur : les deux axes portes par la meme appartenance.
      mockDb.seed(memberPaths.member(CLUB_A, COACH_A2), {
        uid: COACH_A2,
        accessRole: "coach",
        playerStatus: "active",
        coachAccess: "not_required",
      });
      mockDb.seed(memberPaths.user(COACH_A2), { uid: COACH_A2, clubId: CLUB_A });
      mockDb.seed(memberPaths.playerSummary(CLUB_A, COACH_A2), { uid: COACH_A2, readiness: 55 });

      const res = (await appelArretSuivi(
        signedBy(COACH_A, { clubId: CLUB_A, memberUid: COACH_A2 }),
      )) as { alreadyInactive: boolean; keepsStaffAccess: boolean };

      expect(res).toMatchObject({ alreadyInactive: false, keepsStaffAccess: true });
      const membre = mockDb.read(memberPaths.member(CLUB_A, COACH_A2));
      expect(membre?.playerStatus).toBe("inactive");
      expect(membre?.accessRole).toBe("coach"); // INTACT
      expect(mockDb.read(memberPaths.playerSummary(CLUB_A, COACH_A2))).toBeNull();
      expect(mockDb.read(memberPaths.user(COACH_A2))?.clubId).toBe(CLUB_A); // INTACT
      // Une seule transaction est partie, et c'est la bonne.
      expect(suiviSpy).toHaveBeenCalledTimes(1);
      expect(removeSpy).not.toHaveBeenCalled();
      expect(encadrementSpy).not.toHaveBeenCalled();
    });

    it("7b.2 retrait des acces d'encadrement par le PROPRIETAIRE : le suivi joueur reste", async () => {
      mockDb.seed(memberPaths.member(CLUB_A, COACH_A2), {
        uid: COACH_A2,
        accessRole: "coach",
        playerStatus: "active",
        coachAccess: "not_required",
      });
      mockDb.seed(memberPaths.playerSummary(CLUB_A, COACH_A2), { uid: COACH_A2, readiness: 55 });

      const res = (await appelRetraitEncadrement(
        signedBy(COACH_A, { clubId: CLUB_A, memberUid: COACH_A2 }),
      )) as { alreadyRevoked: boolean; keepsPlayerStatus: boolean };

      expect(res).toMatchObject({ alreadyRevoked: false, keepsPlayerStatus: true });
      const membre = mockDb.read(memberPaths.member(CLUB_A, COACH_A2));
      expect(membre?.accessRole).toBeNull();
      expect(membre?.playerStatus).toBe("active"); // INTACT
      expect(membre?.coachAccess).toBe("not_required"); // INTACT
      // LA FICHE RESTE : il est encore joueur de l'effectif.
      expect(mockDb.read(memberPaths.playerSummary(CLUB_A, COACH_A2))).not.toBeNull();
    });

    it("7b.3 un encadrant ne touche pas a un autre encadrant : echec TYPE, aucune ecriture", async () => {
      const avant = mockDb.snapshot();
      const err = await refus(
        appelRetraitEncadrement(signedBy(COACH_A2, { clubId: CLUB_A, memberUid: COACH_A })),
      );
      // Le proprietaire est protege AVANT tout : c'est le transfert qu'on lui
      // demande, pas de passer par le proprietaire.
      expect(err.code).toBe(OWNER_TRANSFER_CODE);
      expect(mockDb.snapshot()).toBe(avant);
    });

    it("7b.4 LE PIEGE : le proprietaire arrete SON PROPRE suivi, et reste proprietaire", async () => {
      mockDb.seed(memberPaths.member(CLUB_A, COACH_A), {
        uid: COACH_A,
        accessRole: "owner",
        playerStatus: "active",
        coachAccess: "not_required",
      });

      const res = (await appelArretSuivi(
        signedBy(COACH_A, { clubId: CLUB_A, memberUid: COACH_A }),
      )) as { alreadyInactive: boolean; keepsStaffAccess: boolean };

      expect(res).toMatchObject({ alreadyInactive: false, keepsStaffAccess: true });
      expect(mockDb.read(memberPaths.member(CLUB_A, COACH_A))?.accessRole).toBe("owner");
      expect(mockDb.read(memberPaths.club(CLUB_A))?.ownerUid).toBe(COACH_A);
      // Le meme compte, sur le RETRAIT COMPLET, se voit toujours refuser.
      const err = await refus(appelRetrait(signedBy(COACH_A, { clubId: CLUB_A, memberUid: COACH_A })));
      expect(err.details).toEqual({ reason: OWNER_TRANSFER_REQUIRED });
    });

    it("7b.5 USURPATION DU GESTE : aucun champ de la charge utile ne change le geste execute", async () => {
      // On demande l'arret du suivi en glissant, dans la charge utile, tout ce
      // qu'un attaquant pourrait esperer voir interprete comme « fais plutot un
      // retrait complet ». La callable appelee reste la seule chose qui decide.
      const res = (await appelArretSuivi(
        signedBy(COACH_A, {
          clubId: CLUB_A,
          memberUid: PLAYER_A1,
          geste: "removeClubMember",
          action: "removeClubMember",
          gesture: "retrait-complet",
          mode: "admin",
          removeCompletely: true,
          clearUserClub: true,
          accessRole: null,
        }),
      )) as { alreadyInactive: boolean };

      expect(res.alreadyInactive).toBe(false);
      const membre = mockDb.read(memberPaths.member(CLUB_A, PLAYER_A1));
      expect(membre?.playerStatus).toBe("inactive");
      // Le retrait complet n'a PAS eu lieu : ni pierre tombale d'encadrement,
      // ni detachement du club.
      expect(membre?.removedAt).toBeUndefined();
      expect(mockDb.read(memberPaths.user(PLAYER_A1))?.clubId).toBe(CLUB_A);
      expect(removeSpy).not.toHaveBeenCalled();
      // Et le coeur n'a recu que les trois champs du contrat.
      expect(Object.keys(paramsCoeur(suiviSpy)).sort()).toEqual([
        "actorUid",
        "clubId",
        "memberUid",
      ]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8 — LES ERREURS RENDUES AU CLIENT SONT NEUTRES
  // ─────────────────────────────────────────────────────────────────────────

  describe("8 — erreurs externes : neutres, et sans donnee sensible", () => {
    /** Ce que le client recoit REELLEMENT (firebase-functions serialise ceci). */
    const vuClient = (err: HttpsError) => err.toJSON() as unknown as Record<string, unknown>;

    const SECRETS = [
      CLUB_A,
      CLUB_B,
      "Club A",
      "Club B",
      COACH_A,
      COACH_A2,
      COACH_B,
      PLAYER_A1,
      PLAYER_A2,
      CODE_CLUB_A,
      hashInviteCode(CODE_CLUB_A),
      "clubs/",
      "inviteCodes/",
      "playerSummaries",
      ".ts:",
      "at Object.",
    ];

    async function tousLesRefus(): Promise<Array<[string, HttpsError]>> {
      return [
        ["retrait interdit", await refus(appelRetrait(signedBy(STRANGER, { clubId: CLUB_A, memberUid: PLAYER_A1 })))],
        ["retrait, club inexistant", await refus(appelRetrait(signedBy(STRANGER, { clubId: "clubFantome", memberUid: PLAYER_A1 })))],
        ["retrait, charge malformee", await refus(appelRetrait(signedBy(COACH_A, { clubId: { toString: () => CLUB_A }, memberUid: 12 })))],
        ["retrait du proprietaire", await refus(appelRetrait(signedBy(COACH_A2, { clubId: CLUB_A, memberUid: COACH_A })))],
        ["membre inconnu", await refus(appelRetrait(signedBy(COACH_A, { clubId: CLUB_A, memberUid: "fantome" })))],
        ["transfert interdit", await refus(appelTransfert(signedBy(COACH_A2, { clubId: CLUB_A, newOwnerUid: COACH_A2 })))],
        ["transfert vers une cible inadmissible", await refus(appelTransfert(signedBy(COACH_A, { clubId: CLUB_A, newOwnerUid: COACH_B })))],
        ["emission interdite", await refus(appelEmission(signedBy(STRANGER, { clubId: CLUB_A })))],
        ["emission, club inexistant", await refus(appelEmission(signedBy(STRANGER, { clubId: "clubFantome" })))],
        ["rattachement, code inconnu", await refus(appelRattachement(signedBy(STRANGER, { code: "ZZZZZZZZZZ" })))],
        ["rattachement, saisie structuree", await refus(appelRattachement(signedBy(STRANGER, { code: { code: CODE_CLUB_A } })))],
        ["non authentifie", await refus(appelRetrait(request(SANS_AUTH, { clubId: CLUB_A, memberUid: PLAYER_A1 })))],
      ];
    }

    it("8.1 la forme rendue au client est TOUJOURS la meme (jeux de cles compares, pas seulement les messages)", async () => {
      for (const [nom, err] of await tousLesRefus()) {
        const cles = Object.keys(vuClient(err)).sort();
        // `details` n'apparait que sur l'unique refus TYPE (le transfert exige).
        const attendu = cles.includes("details")
          ? ["details", "message", "status"]
          : ["message", "status"];
        expect({ nom, cles }).toEqual({ nom, cles: attendu });
        // Et jamais de trace d'execution.
        expect(cles).not.toContain("stack");
        expect(cles).not.toContain("stacktrace");
      }
    });

    it("8.2 aucun refus ne transporte d'identifiant, de code, d'empreinte ni de chemin", async () => {
      for (const [nom, err] of await tousLesRefus()) {
        const serialise = JSON.stringify(vuClient(err));
        for (const secret of SECRETS) {
          expect({ nom, secret, fuite: serialise.includes(secret) }).toEqual({
            nom,
            secret,
            fuite: false,
          });
        }
      }
    });

    it("8.3 le seul `details` autorise est un jeton machine, sans donnee", async () => {
      const err = await refus(appelRetrait(signedBy(COACH_A2, { clubId: CLUB_A, memberUid: COACH_A })));
      expect(Object.keys(err.details as Record<string, unknown>)).toEqual(["reason"]);
      expect((err.details as Record<string, unknown>).reason).toBe(OWNER_TRANSFER_REQUIRED);
    });

    it("8.4 club interdit et club inexistant sont INDISCERNABLES (aucun oracle d'existence)", async () => {
      const interdit = await refus(appelEmission(signedBy(STRANGER, { clubId: CLUB_A })));
      const fantome = await refus(appelEmission(signedBy("stranger2", { clubId: "clubFantome" })));
      expect(vuClient(fantome)).toEqual(vuClient(interdit));

      const retraitInterdit = await refus(appelRetrait(signedBy(STRANGER, { clubId: CLUB_A, memberUid: PLAYER_A1 })));
      const retraitFantome = await refus(appelRetrait(signedBy(STRANGER, { clubId: "clubFantome", memberUid: PLAYER_A1 })));
      expect(vuClient(retraitFantome)).toEqual(vuClient(retraitInterdit));
      expect(retraitInterdit.message).toBe(REMOVE_DENIED_MESSAGE);
    });

    it("8.5 une panne interne ne fuit RIEN de son message d'origine", async () => {
      mockDb.failure = new Error(
        `panne sur clubs/${CLUB_A}/members/${PLAYER_A1} ownerUid=${COACH_A} code=${CODE_CLUB_A}`,
      );

      const retrait = await refus(appelRetrait(signedBy(COACH_A, { clubId: CLUB_A, memberUid: PLAYER_A1 })));
      const suppression = await refus(appelSuppression(signedBy(PLAYER_A1, {})));

      for (const err of [retrait, suppression]) {
        const serialise = JSON.stringify(vuClient(err));
        for (const secret of [CLUB_A, PLAYER_A1, COACH_A, CODE_CLUB_A, "panne sur"]) {
          expect(serialise).not.toContain(secret);
        }
      }
      // Une panne de suppression laisse le compte utilisable : c'est le contrat.
      expect(suppression.code).toBe("internal");
      expect(mockAuthDeletions).toEqual([]);
    });

    it("8.6 un rattachement refuse ne dit jamais si le code a existe", async () => {
      const inconnu = await refus(appelRattachement(signedBy(STRANGER, { code: "ZZZZZZZZZZ" })));
      mockDb.seed(invitePaths.code(hashInviteCode("QQQQQQQQQQ")), {
        clubId: CLUB_A,
        createdBy: COACH_A,
        createdAt: Date.now() - 1000,
        expiresAt: Date.now() + INVITE_CODE_TTL_MS,
        maxUses: INVITE_CODE_MAX_USES,
        uses: 0,
        revokedAt: Date.now() - 1,
      });
      const revoque = await refus(appelRattachement(signedBy(STRANGER, { code: "QQQQQQQQQQ" })));
      expect(vuClient(revoque)).toEqual(vuClient(inconnu));
      expect(inconnu.code).toBe(INVITE_REJECTED_CODE);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 9 — CHEMIN NOMINAL : LES PORTES S'OUVRENT QUAND ELLES DOIVENT
  // ─────────────────────────────────────────────────────────────────────────

  describe("9 — l'authentifie legitime passe", () => {
    it("9.1 le proprietaire emet un code, et la reponse ne transporte rien d'autre", async () => {
      const res = (await appelEmission(signedBy(COACH_A, { clubId: CLUB_A }))) as Record<
        string,
        unknown
      >;
      expect(Object.keys(res).sort()).toEqual(["code", "expiresAt", "maxUses", "replacedPrevious"]);
      expect(JSON.stringify(res)).not.toContain("Club A");
    });

    it("9.2 un joueur rejoint avec un code valide, et son membre est cree sous son propre uid", async () => {
      const res = (await appelRattachement(signedBy(STRANGER, { code: CODE_CLUB_A }))) as {
        clubId: string;
      };
      expect(res.clubId).toBe(CLUB_A);
      expect(mockDb.read(memberPaths.member(CLUB_A, STRANGER))?.uid).toBe(STRANGER);
    });

    it("9.3 deleteAccount purge le compte de l'appelant, dans l'ordre contractuel", async () => {
      const res = await appelSuppression(signedBy(PLAYER_A1, {}));
      expect(res).toEqual({ ok: true });
      expect(mockDb.read(memberPaths.member(CLUB_A, PLAYER_A1))).toBeNull();
      expect(mockDb.read(memberPaths.playerSummary(CLUB_A, PLAYER_A1))).toBeNull();
      expect(mockDb.read(memberPaths.user(PLAYER_A1))).toBeNull();
      expect(mockAuthDeletions).toEqual([PLAYER_A1]);
    });

    it("9.4 deleteAccount ne touche a aucun autre compte, meme sans index collection-group", async () => {
      mockDb.collectionGroupAvailable = false;
      await appelSuppression(signedBy(PLAYER_A1, chargeUsurpatrice(PLAYER_A2)));
      expect(mockDb.read(memberPaths.user(PLAYER_A2))).not.toBeNull();
      expect(mockDb.read(memberPaths.member(CLUB_A, PLAYER_A2))).not.toBeNull();
      expect(mockAuthDeletions).toEqual([PLAYER_A1]);
    });
  });
});
