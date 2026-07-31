// functions/tests/clubOwnership.test.ts
//
// TRANSFERT DE PROPRIETE — le coeur de decision, interroge comme le ferait un
// attaquant qui appelle la callable avec curl plutot que par l'application, et
// comme le ferait un reseau qui bafouille (double soumission, contention).
//
// Le faux magasin rejoue la semantique OPTIMISTE des transactions Firestore
// (chaque lecture memorise la version du document, le commit est refuse puis
// rejoue si l'un des documents lus a change entre-temps). C'est ce qui rend
// testable, SANS infrastructure, l'invariant le plus important du lot : il
// n'existe aucun instant ou le club a zero proprietaire, ni deux.
//
// C'est le MEME procede que functions/tests/inviteCodes.test.ts, volontairement :
// un second faux magasin, avec une autre semantique, ne prouverait rien du meme
// systeme. Il est ici enrichi de `delete` (le retrait supprime la projection) et
// d'un crochet d'entrelacement, pour que les trois portes du club — transfert,
// retrait, emission de code — puissent se marcher dessus dans un meme magasin.
//
// CE QUI N'EST PAS TESTE ICI, ET POURQUOI. L'enveloppe callable
// (clubOwnershipApi.ts) n'est pas exercee : `firebase-functions` et
// `firebase-admin` ne sont installes nulle part dans ce depot. Meme limite, meme
// bornage et meme raison que pour clubMembers.test.ts et callableRights.test.ts.
// Aucune decision ne vit dans cette enveloppe, et aucun identifiant
// d'utilisateur n'est lu dans `request.data`.

import {
  ClubMemberError,
  OWNER_TRANSFER_REQUIRED,
  REMOVE_DENIED_MESSAGE,
  isProjectablePlayer,
  memberPaths,
  removeClubMember,
  type MemberDocData,
  type MemberStore,
  type MemberTx,
} from "../src/clubMembers";
import {
  OWNERSHIP_TRANSFERRED_AT,
  OWNERSHIP_TRANSFERRED_FROM,
  OWNERSHIP_TRANSFERRED_MODE,
  OWNER_SINCE,
  OWNER_UNTIL,
  PREVIOUS_OWNER_ROLE,
  TARGET_IS_SELF_MESSAGE,
  TRANSFER_DENIED_CODE,
  TRANSFER_DENIED_MESSAGE,
  TRANSFER_TARGET_INELIGIBLE,
  TRANSFER_TARGET_IS_SELF,
  adminTransferClubOwnership,
  transferClubOwnership,
} from "../src/clubOwnership";
import {
  PLAYER_STATUS_INACTIVE,
  isClubStaff,
  isClubOwnerAuthorized,
  type ClubAuthoritySignal,
} from "../src/clubAuthority";
import { issueInviteCode, type InviteStore, type InviteTx } from "../src/inviteCodes";

// ─── Faux magasin transactionnel, OPTIMISTE ─────────────────────────────────

type Stored = { data: MemberDocData; version: number };

/** Un tx qui satisfait a la fois `MemberTx` (get/set/delete) et `InviteTx`. */
type AnyTx = MemberTx & InviteTx;

class FakeStore implements MemberStore, InviteStore {
  readonly docs = new Map<string, Stored>();
  /** Crochet d'entrelacement : appele a CHAQUE lecture transactionnelle. */
  onTxRead: ((path: string) => Promise<void> | void) | null = null;
  transactionAttempts = 0;

  seed(path: string, data: MemberDocData): void {
    this.docs.set(path, { data: { ...data }, version: 0 });
  }

  read(path: string): MemberDocData | null {
    return this.docs.get(path)?.data ?? null;
  }

  version(path: string): number {
    return this.docs.get(path)?.version ?? -1;
  }

  /** Empreinte complete du magasin : sert a prouver « aucune ecriture ». */
  fingerprint(): string {
    return JSON.stringify(
      [...this.docs.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, stored]) => [path, stored.version, stored.data]),
    );
  }

  private write(path: string, data: MemberDocData, merge: boolean): void {
    const current = this.docs.get(path);
    const next = merge && current ? { ...current.data, ...data } : { ...data };
    this.docs.set(path, { data: next, version: (current?.version ?? 0) + 1 });
  }

  async get(path: string): Promise<MemberDocData | null> {
    return this.read(path);
  }

  async set(path: string, data: MemberDocData, opts?: { merge?: boolean }): Promise<void> {
    this.write(path, data, opts?.merge ?? false);
  }

  async runTransaction<T>(fn: (tx: AnyTx) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      this.transactionAttempts += 1;
      const readVersions = new Map<string, number>();
      const writes: { path: string; data?: MemberDocData; merge?: boolean; del?: true }[] = [];

      const tx: AnyTx = {
        get: async (path) => {
          readVersions.set(path, this.version(path));
          const snapshot = this.read(path);
          if (this.onTxRead) await this.onTxRead(path);
          return snapshot;
        },
        set: (path, data, opts) => {
          writes.push({ path, data, merge: opts?.merge ?? false });
        },
        delete: (path) => {
          writes.push({ path, del: true });
        },
      };

      const result = await fn(tx);

      // Semantique optimiste : si l'un des documents LUS a change depuis sa
      // lecture, le commit est abandonne et toute la transaction est rejouee.
      const conflict = [...readVersions.entries()].some(
        ([path, version]) => this.version(path) !== version,
      );
      if (conflict) continue;

      for (const w of writes) {
        if (w.del) this.docs.delete(w.path);
        else this.write(w.path, w.data ?? {}, w.merge ?? false);
      }
      return result;
    }
    throw new Error("TRANSACTION_CONTENTION");
  }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CLUB_A = "clubA";
const CLUB_B = "clubB";
const OWNER_A = "ownerA"; // ownerUid ET role "owner" du club A
const COACH_A = "coachA"; // coach du club A, NON proprietaire
const PLAYER_A1 = "playerA1";
const PLAYER_A2 = "playerA2";
const REMOVED_A = "removedA"; // pierre tombale dans le club A
const OWNER_B = "ownerB";
const STRANGER = "stranger";
const NOW = Date.UTC(2026, 6, 27, 10, 0, 0);

function baseStore(): FakeStore {
  const store = new FakeStore();
  store.seed(memberPaths.club(CLUB_A), { name: "Club A", ownerUid: OWNER_A });
  store.seed(memberPaths.club(CLUB_B), { name: "Club B", ownerUid: OWNER_B });

  store.seed(memberPaths.member(CLUB_A, OWNER_A), { uid: OWNER_A, accessRole: "owner" });
  store.seed(memberPaths.member(CLUB_A, COACH_A), { uid: COACH_A, accessRole: "coach" });
  store.seed(memberPaths.member(CLUB_A, PLAYER_A1), {
    uid: PLAYER_A1,
    playerStatus: "active",
    coachAccess: "approved",
    joinedAt: NOW - 100_000,
  });
  store.seed(memberPaths.member(CLUB_A, PLAYER_A2), {
    uid: PLAYER_A2,
    playerStatus: "active",
    coachAccess: "not_required",
  });
  store.seed(memberPaths.member(CLUB_A, REMOVED_A), {
    uid: REMOVED_A,
    accessRole: null, playerStatus: "inactive",
    coachAccess: "revoked",
    removedAt: NOW - 50_000,
    removedBy: OWNER_A,
  });
  store.seed(memberPaths.member(CLUB_B, OWNER_B), { uid: OWNER_B, accessRole: "owner" });

  store.seed(memberPaths.user(OWNER_A), { uid: OWNER_A, clubId: CLUB_A, role: "coach" });
  store.seed(memberPaths.user(PLAYER_A1), { uid: PLAYER_A1, clubId: CLUB_A, role: "player" });
  store.seed(memberPaths.user(PLAYER_A2), { uid: PLAYER_A2, clubId: CLUB_A, role: "player" });

  store.seed(memberPaths.playerSummary(CLUB_A, PLAYER_A1), {
    playerUid: PLAYER_A1,
    firstName: "Anna",
  });
  store.seed(memberPaths.playerSummary(CLUB_A, PLAYER_A2), {
    playerUid: PLAYER_A2,
    firstName: "Bea",
  });
  return store;
}

const deps = (store: FakeStore, onInconsistency?: (s: ClubAuthoritySignal) => void) => ({
  store,
  now: () => NOW,
  onInconsistency,
});

/** Capture l'erreur levee (les tests l'inspectent champ par champ). */
async function capture(fn: () => Promise<unknown>): Promise<ClubMemberError> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof ClubMemberError) return err;
    throw err;
  }
  throw new Error("aucune erreur levee alors qu'un refus etait attendu");
}

// ─── L'INVARIANT, verifiable a tout instant ─────────────────────────────────
//
// Un club a EXACTEMENT un proprietaire quand la designation nomme quelqu'un et
// que cette personne — et personne d'autre — porte le role proprietaire. C'est
// la traduction litterale du predicat partage, appliquee au magasin entier.

function porteursDuRole(store: FakeStore, clubId: string): string[] {
  const prefix = `clubs/${clubId}/members/`;
  return [...store.docs.entries()]
    .filter(([path, stored]) => path.startsWith(prefix) && stored.data.accessRole === "owner")
    .map(([path]) => path.slice(prefix.length))
    .sort();
}

function designe(store: FakeStore, clubId: string): string | null {
  const club = store.read(memberPaths.club(clubId));
  return typeof club?.ownerUid === "string" ? club.ownerUid : null;
}

/** Leve si le club n'a pas EXACTEMENT un proprietaire coherent. */
function exigeUnSeulProprietaire(store: FakeStore, clubId: string): string {
  const owner = designe(store, clubId);
  const porteurs = porteursDuRole(store, clubId);
  expect(owner).not.toBeNull();
  expect(porteurs).toEqual([owner]);
  // Et il est reellement AUTORISE au sens du predicat partage — pas seulement
  // coherent sur le papier.
  expect(
    isClubOwnerAuthorized(
      store.read(memberPaths.club(clubId)),
      store.read(memberPaths.member(clubId, owner as string)),
      owner,
    ),
  ).toBe(true);
  return owner as string;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. LE CHEMIN NOMINAL
// ═════════════════════════════════════════════════════════════════════════════

describe("transfert — le proprietaire initie", () => {
  it("passe, et ecrit la designation ET les deux roles", async () => {
    const store = baseStore();
    const result = await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });

    expect(result).toEqual({
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
      previousOwnerUid: OWNER_A,
      previousOwnerRole: "coach",
      // La cible n'avait AUCUNE permission d'encadrement avant : c'est le cas
      // nominal « un joueur devient proprietaire ».
      newOwnerPreviousRole: null,
      // ... et elle garde son suivi sportif. C'est le contrat de ce lot.
      newOwnerKeepsPlayerStatus: true,
      alreadyTransferred: false,
      mode: "owner",
      demotedUid: null,
    });

    // La designation a bouge.
    expect(designe(store, CLUB_A)).toBe(PLAYER_A1);
    // Le nouveau porte la permission, l'ancien en porte une EXPLICITE.
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))?.accessRole).toBe("owner");
    expect(store.read(memberPaths.member(CLUB_A, OWNER_A))?.accessRole).toBe(PREVIOUS_OWNER_ROLE);
    // Un seul proprietaire, et il est reellement autorise.
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(PLAYER_A1);
  });

  it("NE TOUCHE PAS le suivi sportif du nouveau proprietaire : il devient entraineur-joueur", async () => {
    // LE CONTRAT DE CE LOT, mot pour mot : « le transfert de propriete ne doit
    // modifier QUE les permissions d'encadrement. Il ne doit JAMAIS retirer
    // automatiquement le suivi sportif du nouveau proprietaire. »
    const store = baseStore();
    const avantAcces = store.read(memberPaths.member(CLUB_A, PLAYER_A1))?.coachAccess;

    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });

    const membership = store.read(memberPaths.member(CLUB_A, PLAYER_A1));
    // 1. il reste projetable : sa fiche appartient a l'effectif suivi ;
    expect(isProjectablePlayer(membership)).toBe(true);
    expect(membership?.playerStatus).toBe("active");
    // 2. son autorisation d'acces n'a PAS bouge (ni ouverte, ni fermee) ;
    expect(membership?.coachAccess).toBe(avantAcces);
    // 3. la projection deja produite est TOUJOURS la — la supprimer reviendrait
    //    a retirer un suivi au motif d'un geste qui ne parle pas de suivi ;
    expect(store.read(memberPaths.playerSummary(CLUB_A, PLAYER_A1))).not.toBeNull();
    // 4. et il est bel et bien encadrant en meme temps.
    expect(isClubStaff(membership)).toBe(true);
    // La projection d'une AUTRE joueuse n'est pas touchee non plus.
    expect(store.read(memberPaths.playerSummary(CLUB_A, PLAYER_A2))).not.toBeNull();
  });

  it("une cible SANS suivi actif ne garde aucune projection residuelle", async () => {
    // Le pendant du test precedent : quand il n'y a pas de suivi a preserver,
    // une projection laissee par un passage anterieur n'a plus rien qui la
    // justifie, et elle part avec le geste plutot que d'attendre un trigger.
    const store = baseStore();
    store.seed(memberPaths.member(CLUB_A, COACH_A), { uid: COACH_A, accessRole: "coach" });
    store.seed(memberPaths.playerSummary(CLUB_A, COACH_A), { playerUid: COACH_A });

    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: COACH_A,
    });

    expect(store.read(memberPaths.playerSummary(CLUB_A, COACH_A))).toBeNull();
  });

  it("l'ancien proprietaire reste ENCADRANT, et son propre suivi n'est pas touche", async () => {
    const store = baseStore();
    const avant = store.read(memberPaths.member(CLUB_A, OWNER_A));
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });

    const ancien = store.read(memberPaths.member(CLUB_A, OWNER_A));
    // Encadrant : il garde le cadre de semaine, la note privee, la directive.
    expect(isClubStaff(ancien)).toBe(true);
    // Mais PAS proprietaire : la designation ne le nomme plus.
    expect(isClubOwnerAuthorized(store.read(memberPaths.club(CLUB_A)), ancien, OWNER_A)).toBe(
      false,
    );
    // Son statut de joueur est celui qu'il avait : le transfert ne l'invente pas
    // et ne l'efface pas. Ici il n'en avait aucun, donc il n'en a toujours aucun.
    expect(ancien?.playerStatus).toBe(avant?.playerStatus ?? undefined);
    expect(isProjectablePlayer(ancien)).toBe(false);
  });

  it("un COACH peut recevoir la propriete (pas seulement un joueur)", async () => {
    const store = baseStore();
    const result = await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: COACH_A,
    });
    expect(result.newOwnerPreviousRole).toBe("coach");
    expect(result.newOwnerKeepsPlayerStatus).toBe(false);
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(COACH_A);
  });

  it("un ENTRAINEUR-JOUEUR peut recevoir la propriete sans rien perdre", async () => {
    const store = baseStore();
    store.seed(memberPaths.member(CLUB_A, COACH_A), {
      uid: COACH_A,
      accessRole: "coach",
      playerStatus: "active",
      coachAccess: "not_required",
    });

    const result = await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: COACH_A,
    });

    expect(result.newOwnerPreviousRole).toBe("coach");
    expect(result.newOwnerKeepsPlayerStatus).toBe(true);
    const membership = store.read(memberPaths.member(CLUB_A, COACH_A));
    expect(membership?.accessRole).toBe("owner");
    expect(membership?.playerStatus).toBe("active");
    expect(membership?.coachAccess).toBe("not_required");
  });

  it("ne touche JAMAIS le document `users/{uid}` du nouveau proprietaire", async () => {
    // Ce document porte le profil personnel, pas l'autorite. Le transfert n'a
    // rien a y ecrire — et depuis que l'espace affiche est derive de
    // l'appartenance, il n'aurait de toute facon aucun effet.
    const store = baseStore();
    const avant = store.read(memberPaths.user(PLAYER_A1));
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    expect(store.read(memberPaths.user(PLAYER_A1))).toEqual(avant);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. LA MATRICE DES APPELANTS — un seul message pour tous les refus d'autorite
// ═════════════════════════════════════════════════════════════════════════════

describe("transfert — qui n'a pas le droit d'initier", () => {
  const refusIdentique = async (actorUid: string, clubId: string, target: string) => {
    const store = baseStore();
    const avant = store.fingerprint();
    const err = await capture(() =>
      transferClubOwnership(deps(store), { actorUid, clubId, newOwnerUid: target }),
    );
    expect(err.code).toBe(TRANSFER_DENIED_CODE);
    expect(err.message).toBe(TRANSFER_DENIED_MESSAGE);
    // Aucun jeton machine : un refus d'autorite ne dit rien de plus.
    expect(err.reason).toBeNull();
    // ET aucune ecriture, pas meme partielle.
    expect(store.fingerprint()).toBe(avant);
    return err;
  };

  it("un COACH du club, qui a pourtant tous les droits d'encadrement : REFUSE", async () => {
    await refusIdentique(COACH_A, CLUB_A, PLAYER_A1);
  });

  it("un JOUEUR du club : REFUSE", async () => {
    await refusIdentique(PLAYER_A1, CLUB_A, PLAYER_A2);
  });

  it("le proprietaire d'un AUTRE club : REFUSE (aucune fuite entre clubs)", async () => {
    await refusIdentique(OWNER_B, CLUB_A, PLAYER_A1);
  });

  it("un inconnu, sur un club qui existe : REFUSE", async () => {
    await refusIdentique(STRANGER, CLUB_A, PLAYER_A1);
  });

  it("un club INEXISTANT : le MEME refus, mot pour mot (aucun oracle d'existence)", async () => {
    const store = baseStore();
    const inexistant = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: OWNER_A,
        clubId: "clubQuiNexistePas",
        newOwnerUid: PLAYER_A1,
      }),
    );
    const existant = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: STRANGER,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );
    expect(inexistant.message).toBe(existant.message);
    expect(inexistant.code).toBe(existant.code);
  });

  it("sans identite : `unauthenticated`, distinct du refus (il parle de la session)", async () => {
    const store = baseStore();
    const err = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: "   ",
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );
    expect(err.code).toBe("unauthenticated");
  });

  it("identifiants malformes : refuses AVANT toute lecture, et de la meme facon", async () => {
    const store = baseStore();
    for (const [clubId, target] of [
      ["", PLAYER_A1],
      ["clubs/clubA", PLAYER_A1],
      ["../clubA", PLAYER_A1],
      [CLUB_A, ""],
      [CLUB_A, "a/b"],
      [CLUB_A, "x".repeat(200)],
    ] as [string, string][]) {
      const err = await capture(() =>
        transferClubOwnership(deps(store), {
          actorUid: OWNER_A,
          clubId,
          newOwnerUid: target,
        }),
      );
      expect(err.message).toBe(TRANSFER_DENIED_MESSAGE);
    }
    // Aucune de ces tentatives n'a fait bouger le club.
    expect(designe(store, CLUB_A)).toBe(OWNER_A);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. LES DEUX INCOHERENCES — refus ET signalement
// ═════════════════════════════════════════════════════════════════════════════

describe("transfert — etat d'autorite incoherent", () => {
  it("DESIGNATION SANS APPARTENANCE : refuse, et signale pour reparation", async () => {
    const store = baseStore();
    // `ownerUid` designe toujours OWNER_A, mais son appartenance n'est plus
    // proprietaire (retrogradee a la main, ou heritee d'un ancien etat).
    store.seed(memberPaths.member(CLUB_A, OWNER_A), { uid: OWNER_A, accessRole: "coach" });
    const signals: ClubAuthoritySignal[] = [];

    const err = await capture(() =>
      transferClubOwnership(deps(store, (s) => signals.push(s)), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );

    expect(err.message).toBe(TRANSFER_DENIED_MESSAGE);
    expect(signals).toEqual([
      {
        clubId: CLUB_A,
        uid: OWNER_A,
        authority: "designation-without-membership",
        action: "transferClubOwnership",
      },
    ]);
    // Le club n'a PAS change de main : une autorite douteuse ne doit jamais etre
    // le chemin par lequel la propriete bouge.
    expect(designe(store, CLUB_A)).toBe(OWNER_A);
  });

  it("APPARTENANCE SANS DESIGNATION : refuse, et signale", async () => {
    const store = baseStore();
    // COACH_A porte le role proprietaire, mais la designation nomme OWNER_A.
    store.seed(memberPaths.member(CLUB_A, COACH_A), { uid: COACH_A, accessRole: "owner" });
    const signals: ClubAuthoritySignal[] = [];

    const err = await capture(() =>
      transferClubOwnership(deps(store, (s) => signals.push(s)), {
        actorUid: COACH_A,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );

    expect(err.message).toBe(TRANSFER_DENIED_MESSAGE);
    expect(signals[0]?.authority).toBe("membership-without-designation");
    expect(designe(store, CLUB_A)).toBe(OWNER_A);
  });

  it("le signal ne transporte QUE de quoi reparer (quatre champs, rien d'autre)", async () => {
    const store = baseStore();
    store.seed(memberPaths.member(CLUB_A, OWNER_A), { uid: OWNER_A, accessRole: "coach" });
    const signals: ClubAuthoritySignal[] = [];
    await capture(() =>
      transferClubOwnership(deps(store, (s) => signals.push(s)), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );
    expect(Object.keys(signals[0]).sort()).toEqual(["action", "authority", "clubId", "uid"]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. LA CIBLE — ce qu'est un « membre admissible »
// ═════════════════════════════════════════════════════════════════════════════

describe("transfert — admissibilite de la cible", () => {
  const refusCible = async (target: string) => {
    const store = baseStore();
    const avant = store.fingerprint();
    const err = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: target,
      }),
    );
    expect(err.code).toBe("failed-precondition");
    expect(err.reason).toBe(TRANSFER_TARGET_INELIGIBLE);
    expect(store.fingerprint()).toBe(avant);
    return err;
  };

  it("un compte qui n'a JAMAIS rejoint le club : refuse", async () => {
    await refusCible(STRANGER);
  });

  it("un membre d'un AUTRE club : refuse (l'appartenance est par club)", async () => {
    await refusCible(OWNER_B);
  });

  it("une PIERRE TOMBALE (membre retire) : refuse — elle n'ouvre rien, nulle part", async () => {
    await refusCible(REMOVED_A);
  });

  it("le refus de cible est PARLANT et indique le geste (contrairement au refus d'autorite)", async () => {
    const err = await refusCible(STRANGER);
    expect(err.message).toContain("effectif actif");
    expect(err.message).not.toBe(TRANSFER_DENIED_MESSAGE);
  });

  it("SOI-MEME : refus dedie, le club vous appartient deja", async () => {
    const store = baseStore();
    const avant = store.fingerprint();
    const err = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: OWNER_A,
      }),
    );
    expect(err.reason).toBe(TRANSFER_TARGET_IS_SELF);
    expect(err.message).toBe(TARGET_IS_SELF_MESSAGE);
    expect(store.fingerprint()).toBe(avant);
  });

  it("l'ordre est le contrat : l'autorite est verifiee AVANT de lire la cible", async () => {
    // Un inconnu qui vise une cible inexistante recoit le refus d'AUTORITE, pas
    // celui de cible. Sans quoi il apprendrait, sur un club dont il n'est pas
    // membre, qui en fait partie.
    const store = baseStore();
    const err = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: STRANGER,
        clubId: CLUB_A,
        newOwnerUid: "personneDuTout",
      }),
    );
    expect(err.message).toBe(TRANSFER_DENIED_MESSAGE);
    expect(err.reason).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. IDEMPOTENCE ET REJEU — le piege du lot
// ═════════════════════════════════════════════════════════════════════════════

describe("transfert — rejeu apres transfert", () => {
  it("REJEU IDENTIQUE par l'ancien proprietaire : succes, et ZERO ecriture", async () => {
    const store = baseStore();
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    const apresPremier = store.fingerprint();

    const rejeu = await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });

    expect(rejeu.alreadyTransferred).toBe(true);
    expect(rejeu.newOwnerUid).toBe(PLAYER_A1);
    expect(rejeu.previousOwnerUid).toBe(OWNER_A);
    // Rien n'a bouge : ni les donnees, ni meme les versions de documents.
    // L'audit du premier transfert n'est pas reecrit.
    expect(store.fingerprint()).toBe(apresPremier);
  });

  it("le rejeu ne survit pas au RETRAIT de l'ancien proprietaire", async () => {
    const store = baseStore();
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    // Le nouveau proprietaire retire l'ancien (sequence complete du lot).
    await removeClubMember(deps(store), {
      actorUid: PLAYER_A1,
      clubId: CLUB_A,
      memberUid: OWNER_A,
    });

    const err = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );
    expect(err.message).toBe(TRANSFER_DENIED_MESSAGE);
  });

  it("rejeu vers une AUTRE cible : refuse (ce n'est pas le geste deja fait)", async () => {
    const store = baseStore();
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    const apres = store.fingerprint();

    const err = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A2,
      }),
    );
    expect(err.message).toBe(TRANSFER_DENIED_MESSAGE);
    expect(store.fingerprint()).toBe(apres);
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(PLAYER_A1);
  });

  it("un TIERS ne peut pas se faire passer pour un rejeu", async () => {
    const store = baseStore();
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    // COACH_A est un encadrant actif du club, mais il n'est pas le sortant
    // enregistre : la fenetre de rejeu ne s'ouvre pas pour lui.
    const err = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: COACH_A,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );
    expect(err.message).toBe(TRANSFER_DENIED_MESSAGE);
  });

  it("le NOUVEAU proprietaire qui se transfere a lui-meme : refus dedie, pas un rejeu", async () => {
    const store = baseStore();
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    const err = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: PLAYER_A1,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );
    expect(err.reason).toBe(TRANSFER_TARGET_IS_SELF);
  });

  it("un transfert en RETOUR reste possible, et reste coherent", async () => {
    const store = baseStore();
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    await transferClubOwnership(deps(store), {
      actorUid: PLAYER_A1,
      clubId: CLUB_A,
      newOwnerUid: OWNER_A,
    });
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(OWNER_A);
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))?.accessRole).toBe(PREVIOUS_OWNER_ROLE);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. ATOMICITE ET CONCURRENCE
// ═════════════════════════════════════════════════════════════════════════════

describe("transfert — atomicite", () => {
  it("l'invariant tient a CHAQUE lecture de la transaction (aucune fenetre observable)", async () => {
    const store = baseStore();
    let lectures = 0;
    store.onTxRead = () => {
      lectures += 1;
      // A cet instant precis, un observateur exterieur lit le magasin. Il doit
      // TOUJOURS y voir exactement un proprietaire — jamais zero, jamais deux.
      exigeUnSeulProprietaire(store, CLUB_A);
    };
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    store.onTxRead = null;
    expect(lectures).toBeGreaterThan(0);
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(PLAYER_A1);
  });

  it("une transaction qui echoue en cours de route n'ecrit RIEN", async () => {
    const store = baseStore();
    const avant = store.fingerprint();
    // Le magasin casse : la transaction leve, et l'erreur devient un refus
    // « momentanement indisponible ». Aucune ecriture partielle.
    const casse: MemberStore = {
      runTransaction: async () => {
        throw new Error("indisponible");
      },
    };
    const err = await capture(() =>
      transferClubOwnership(
        { store: casse, now: () => NOW },
        { actorUid: OWNER_A, clubId: CLUB_A, newOwnerUid: PLAYER_A1 },
      ),
    );
    expect(err.code).toBe("unavailable");
    expect(store.fingerprint()).toBe(avant);
  });
});

describe("transfert — concurrence", () => {
  /**
   * Declenche `action` UNE SEULE FOIS, a la premiere lecture de la transaction
   * englobante : l'operation concurrente s'intercale donc ENTRE les lectures et
   * le commit. Renvoie un temoin qui verifie que la contention a REELLEMENT eu
   * lieu — sans lui, un test « vert » pourrait n'avoir rien entrelace du tout.
   */
  const entrelace = (store: FakeStore, action: () => Promise<unknown>) => {
    let arme = true;
    let declenche = false;
    store.onTxRead = async () => {
      if (!arme) return;
      arme = false;
      declenche = true;
      const memoire = store.onTxRead;
      store.onTxRead = null;
      try {
        await action();
      } finally {
        store.onTxRead = memoire;
      }
    };
    return (opts?: { rejeu?: boolean }) => {
      store.onTxRead = null;
      // L'operation concurrente a bien tourne (sans ce temoin, un test « vert »
      // pourrait n'avoir rien entrelace du tout).
      expect(declenche).toBe(true);
      // Et, quand c'est ce qui est en jeu, la transaction englobante a bien ete
      // REJOUEE : au moins deux tentatives pour elle, une pour l'autre.
      // `rejeu: false` couvre le cas ou l'operation concurrente ne touche AUCUN
      // document deja lu par la transaction englobante — celle-ci lit alors
      // l'etat neuf directement, et commite sans conflit. Le resultat est le
      // meme ; l'exiger serait exiger un detail d'ordonnancement.
      if (opts?.rejeu !== false) expect(store.transactionAttempts).toBeGreaterThanOrEqual(3);
    };
  };

  it("DOUBLE SOUMISSION (deux appels identiques) : un seul transfert, deux succes", async () => {
    const store = baseStore();
    const contentionEuLieu = entrelace(store, () =>
      transferClubOwnership(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );

    const externe = await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    contentionEuLieu();

    // Le second appel a vu l'etat deja atteint et n'a rien reecrit.
    expect(externe.alreadyTransferred).toBe(true);
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(PLAYER_A1);
    // Un seul horodatage d'audit, celui du transfert reel.
    expect(store.read(memberPaths.club(CLUB_A))?.[OWNERSHIP_TRANSFERRED_AT]).toBe(NOW);
  });

  it("DEUX CIBLES DIFFERENTES en meme temps : un seul gagne, l'autre est refuse", async () => {
    const store = baseStore();
    const contentionEuLieu = entrelace(store, () =>
      transferClubOwnership(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A2,
      }),
    );

    const err = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );
    contentionEuLieu();

    expect(err.message).toBe(TRANSFER_DENIED_MESSAGE);
    // JAMAIS deux proprietaires : PLAYER_A2 a gagne, PLAYER_A1 est reste joueur.
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(PLAYER_A2);
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))?.accessRole).toBeUndefined();
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))?.playerStatus).toBe("active");
  });

  it("TRANSFERT PENDANT UN RETRAIT — le retrait gagne : la cible devient inadmissible", async () => {
    const store = baseStore();
    const contentionEuLieu = entrelace(store, () =>
      removeClubMember(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        memberUid: PLAYER_A1,
      }),
    );

    const err = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );
    // Le retrait ne touche pas le document club : le transfert lit la pierre
    // tombale directement, sans avoir besoin d'etre rejoue.
    contentionEuLieu({ rejeu: false });

    expect(err.reason).toBe(TRANSFER_TARGET_INELIGIBLE);
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(OWNER_A);
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))?.accessRole).toBeNull();
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))?.playerStatus).toBe(PLAYER_STATUS_INACTIVE);
  });

  it("RETRAIT PENDANT UN TRANSFERT — le transfert gagne : le retrait exige un transfert", async () => {
    const store = baseStore();
    const contentionEuLieu = entrelace(store, () =>
      transferClubOwnership(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );

    const err = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        memberUid: PLAYER_A1,
      }),
    );
    contentionEuLieu();

    // PLAYER_A1 est devenu proprietaire entre-temps : on ne retire pas un
    // proprietaire, on transfere d'abord.
    expect(err.reason).toBe(OWNER_TRANSFER_REQUIRED);
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(PLAYER_A1);
  });

  it("TRANSFERT PENDANT L'EMISSION D'UN CODE : le code est emis, par un encadrant toujours valide", async () => {
    const store = baseStore();
    const contentionEuLieu = entrelace(store, () =>
      transferClubOwnership(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: PLAYER_A1,
      }),
    );

    // OWNER_A emet un code ; le transfert passe pendant ses lectures. Il n'est
    // plus proprietaire au moment du commit — mais il est reste ENCADRANT, donc
    // l'emission aboutit. Aucune fenetre ou personne ne peut plus rien faire.
    const result = await issueInviteCode(
      { store, now: () => NOW },
      { uid: OWNER_A, clubId: CLUB_A },
    );
    contentionEuLieu();

    expect(result.code).toMatch(/^[A-Z0-9]+-[A-Z0-9]+$/);
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(PLAYER_A1);
    expect(isClubStaff(store.read(memberPaths.member(CLUB_A, OWNER_A)))).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. LA SEQUENCE COMPLETE : transferer, puis retirer l'ancien
// ═════════════════════════════════════════════════════════════════════════════

describe("transfert puis retrait de l'ancien proprietaire", () => {
  it("le retrait de l'ancien passe NORMALEMENT, sans cas particulier", async () => {
    const store = baseStore();
    // 1. Avant le transfert : le retrait du proprietaire est refuse, et il dit
    //    quel geste faire.
    const avant = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        memberUid: OWNER_A,
      }),
    );
    expect(avant.reason).toBe(OWNER_TRANSFER_REQUIRED);

    // 2. Le transfert.
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });

    // 3. Le nouveau proprietaire retire l'ancien : plus aucun blocage.
    const retrait = await removeClubMember(deps(store), {
      actorUid: PLAYER_A1,
      clubId: CLUB_A,
      memberUid: OWNER_A,
    });
    expect(retrait.alreadyRemoved).toBe(false);
    expect(retrait.clearedUserClub).toBe(true);
    expect(store.read(memberPaths.member(CLUB_A, OWNER_A))?.accessRole).toBeNull();
    expect(store.read(memberPaths.member(CLUB_A, OWNER_A))?.playerStatus).toBe(PLAYER_STATUS_INACTIVE);
    expect(store.read(memberPaths.member(CLUB_A, OWNER_A))?.coachAccess).toBe("revoked");
    expect(store.read(memberPaths.user(OWNER_A))?.clubId).toBeNull();

    // 4. Et le club a toujours exactement un proprietaire.
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(PLAYER_A1);
  });

  it("le NOUVEAU proprietaire est protege a son tour", async () => {
    const store = baseStore();
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    const err = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        memberUid: PLAYER_A1,
      }),
    );
    expect(err.reason).toBe(OWNER_TRANSFER_REQUIRED);
  });

  it("l'ancien proprietaire retire perd tout, y compris le droit de retirer", async () => {
    const store = baseStore();
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    await removeClubMember(deps(store), {
      actorUid: PLAYER_A1,
      clubId: CLUB_A,
      memberUid: OWNER_A,
    });
    const err = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        memberUid: PLAYER_A2,
      }),
    );
    expect(err.message).toBe(REMOVE_DENIED_MESSAGE);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7 bis. LA SEQUENCE COMPLETE : joueur -> proprietaire -> retire
// ═════════════════════════════════════════════════════════════════════════════
// Le scenario que ce lot existe pour rendre vrai, joue d'un bout a l'autre. A
// chaque etape on verifie l'axe SUIVI en plus de l'axe PERMISSIONS : c'est leur
// independance qui est prouvee ici, pas seulement l'etat final.

describe("sequence joueur -> proprietaire -> retire", () => {
  it("le suivi sportif survit au brassard, et ne disparait qu'au retrait", async () => {
    const store = baseStore();
    const membre = () => store.read(memberPaths.member(CLUB_A, PLAYER_A1));

    // ── Etape 1 : JOUEUR. Aucun encadrement, un suivi actif et projete.
    expect(isClubStaff(membre())).toBe(false);
    expect(isProjectablePlayer(membre())).toBe(true);
    expect(store.read(memberPaths.playerSummary(CLUB_A, PLAYER_A1))).not.toBeNull();

    // ── Etape 2 : PROPRIETAIRE. Il gagne l'encadrement — et GARDE son suivi.
    const transfert = await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    expect(transfert.newOwnerKeepsPlayerStatus).toBe(true);
    expect(isClubStaff(membre())).toBe(true);
    expect(isClubOwnerAuthorized(store.read(memberPaths.club(CLUB_A)), membre(), PLAYER_A1)).toBe(
      true,
    );
    // L'axe suivi n'a pas bouge d'un iota : ni le statut, ni l'autorisation, ni
    // la fiche deja produite.
    expect(isProjectablePlayer(membre())).toBe(true);
    expect(membre()?.coachAccess).toBe("approved");
    expect(store.read(memberPaths.playerSummary(CLUB_A, PLAYER_A1))).not.toBeNull();

    // ── Etape 2 bis : l'ANCIEN proprietaire garde aussi ce qu'il avait.
    //     Il n'avait pas de suivi : il n'en gagne pas non plus.
    expect(isClubStaff(store.read(memberPaths.member(CLUB_A, OWNER_A)))).toBe(true);
    expect(isProjectablePlayer(store.read(memberPaths.member(CLUB_A, OWNER_A)))).toBe(false);

    // ── Etape 3 : RETIRE. Il faut d'abord rendre le brassard — un proprietaire
    //     ne se retire pas (ce serait fabriquer l'incoherence que l'invariant
    //     interdit). C'est le refus TYPE, deja teste ailleurs.
    const refus = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: PLAYER_A1,
        clubId: CLUB_A,
        memberUid: PLAYER_A1,
      }),
    );
    expect(refus.reason).toBe(OWNER_TRANSFER_REQUIRED);

    await transferClubOwnership(deps(store), {
      actorUid: PLAYER_A1,
      clubId: CLUB_A,
      newOwnerUid: OWNER_A,
    });
    // Redevenu simple encadrant : il a toujours son suivi.
    expect(isProjectablePlayer(membre())).toBe(true);

    // ... et le retrait, lui, ferme LES DEUX d'un coup.
    const retrait = await removeClubMember(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });
    expect(retrait.alreadyRemoved).toBe(false);
    expect(membre()?.accessRole).toBeNull();
    expect(membre()?.playerStatus).toBe(PLAYER_STATUS_INACTIVE);
    expect(isClubStaff(membre())).toBe(false);
    expect(isProjectablePlayer(membre())).toBe(false);
    expect(store.read(memberPaths.playerSummary(CLUB_A, PLAYER_A1))).toBeNull();
    expect(store.read(memberPaths.user(PLAYER_A1))?.clubId).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. LE JOURNAL D'AUDIT — ce qu'il contient, et surtout ce qu'il ne contient PAS
// ═════════════════════════════════════════════════════════════════════════════

describe("transfert — audit sobre", () => {
  it("le document club recoit EXACTEMENT trois champs d'audit, et rien d'autre", async () => {
    const store = baseStore();
    const avant = Object.keys(store.read(memberPaths.club(CLUB_A)) ?? {});
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    const apres = store.read(memberPaths.club(CLUB_A)) ?? {};
    const ajoutes = Object.keys(apres).filter((k) => !avant.includes(k));
    expect(ajoutes.sort()).toEqual(
      [OWNERSHIP_TRANSFERRED_AT, OWNERSHIP_TRANSFERRED_FROM, OWNERSHIP_TRANSFERRED_MODE, "updatedAt"].sort(),
    );
    expect(apres[OWNERSHIP_TRANSFERRED_AT]).toBe(NOW);
    expect(apres[OWNERSHIP_TRANSFERRED_FROM]).toBe(OWNER_A);
    expect(apres[OWNERSHIP_TRANSFERRED_MODE]).toBe("owner");
    // Le nom du club n'a pas ete retouche, et rien d'autre n'a ete ajoute.
    expect(apres.name).toBe("Club A");
  });

  it("les appartenances ne portent que des identifiants, des roles et des dates", async () => {
    const store = baseStore();
    await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });

    // `playerStatus` et `coachAccess` sont la parce qu'ils ETAIENT deja la : le
    // transfert ne les a ni ajoutes ni retouches (il ne les nomme pas dans son
    // ecriture en merge). C'est le contrat « un seul axe bouge », lu au niveau
    // des cles du document.
    expect(Object.keys(store.read(memberPaths.member(CLUB_A, PLAYER_A1)) ?? {}).sort()).toEqual(
      [
        "accessRole",
        "coachAccess",
        "joinedAt",
        OWNER_SINCE,
        "playerStatus",
        "uid",
        "updatedAt",
      ].sort(),
    );
    expect(Object.keys(store.read(memberPaths.member(CLUB_A, OWNER_A)) ?? {}).sort()).toEqual(
      [OWNER_UNTIL, "accessRole", "uid", "updatedAt"].sort(),
    );
    // `joinedAt` du nouveau proprietaire est CONSERVE (merge) : c'est une trace
    // d'audit, elle n'a pas a disparaitre parce qu'on change de role.
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))?.joinedAt).toBe(NOW - 100_000);
  });

  it("le resultat renvoye ne contient aucune donnee de membre ni de club", async () => {
    const store = baseStore();
    const result = await transferClubOwnership(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    expect(Object.keys(result).sort()).toEqual(
      [
        "alreadyTransferred",
        "clubId",
        "demotedUid",
        "mode",
        // Booleen, jamais une donnee : il dit « la cible garde son suivi », il
        // ne transporte ni seance, ni prenom, ni etat d'autorisation.
        "newOwnerKeepsPlayerStatus",
        "newOwnerPreviousRole",
        "newOwnerUid",
        "previousOwnerRole",
        "previousOwnerUid",
      ].sort(),
    );
    expect(JSON.stringify(result)).not.toContain("Club A");
    expect(JSON.stringify(result)).not.toContain("Anna");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. L'OUTIL ADMINISTRATEUR — la seule facon de debloquer un club incoherent
// ═════════════════════════════════════════════════════════════════════════════

describe("transfert — mode administrateur", () => {
  it("repare un club DESIGNE SANS APPARTENANCE, que personne ne pouvait debloquer", async () => {
    const store = baseStore();
    // L'etat coince : ownerUid nomme OWNER_A, qui n'a plus d'appartenance du tout.
    store.docs.delete(memberPaths.member(CLUB_A, OWNER_A));

    // Le chemin nominal ne peut RIEN faire — c'est le refus voulu.
    const bloque = await capture(() =>
      transferClubOwnership(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        newOwnerUid: COACH_A,
      }),
    );
    expect(bloque.message).toBe(TRANSFER_DENIED_MESSAGE);

    // L'outil administrateur, lui, debloque.
    const result = await adminTransferClubOwnership(deps(store), {
      clubId: CLUB_A,
      newOwnerUid: COACH_A,
    });
    expect(result.mode).toBe("admin");
    expect(result.previousOwnerUid).toBe(OWNER_A);
    // Personne a retrograder : l'ancien n'avait plus d'appartenance.
    expect(result.previousOwnerRole).toBeNull();
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(COACH_A);
    expect(store.read(memberPaths.club(CLUB_A))?.[OWNERSHIP_TRANSFERRED_MODE]).toBe("admin");
  });

  it("retrograde une appartenance proprietaire ORPHELINE quand l'operateur la nomme", async () => {
    const store = baseStore();
    // COACH_A porte le role proprietaire sans etre designe : etat a reparer.
    store.seed(memberPaths.member(CLUB_A, COACH_A), { uid: COACH_A, accessRole: "owner" });

    const result = await adminTransferClubOwnership(deps(store), {
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
      demoteUid: COACH_A,
    });

    expect(result.demotedUid).toBe(COACH_A);
    expect(store.read(memberPaths.member(CLUB_A, COACH_A))?.accessRole).toBe(PREVIOUS_OWNER_ROLE);
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(PLAYER_A1);
  });

  it("ne retrograde PAS un membre qui ne porte pas le role proprietaire", async () => {
    const store = baseStore();
    const result = await adminTransferClubOwnership(deps(store), {
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
      demoteUid: PLAYER_A2,
    });
    expect(result.demotedUid).toBeNull();
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A2))?.accessRole).toBeUndefined();
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A2))?.playerStatus).toBe("active");
  });

  it("garde EXACTEMENT les memes exigences sur la cible que le chemin nominal", async () => {
    const store = baseStore();
    const err = await capture(() =>
      adminTransferClubOwnership(deps(store), { clubId: CLUB_A, newOwnerUid: REMOVED_A }),
    );
    expect(err.reason).toBe(TRANSFER_TARGET_INELIGIBLE);
    expect(exigeUnSeulProprietaire(store, CLUB_A)).toBe(OWNER_A);
  });

  it("IDEMPOTENT : rejoue sur un etat deja atteint, il ne reecrit rien", async () => {
    const store = baseStore();
    await adminTransferClubOwnership(deps(store), { clubId: CLUB_A, newOwnerUid: PLAYER_A1 });
    const apres = store.fingerprint();

    const rejeu = await adminTransferClubOwnership(deps(store), {
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    expect(rejeu.alreadyTransferred).toBe(true);
    expect(store.fingerprint()).toBe(apres);
  });

  it("ne touche JAMAIS le document `users/{uid}` du nouveau proprietaire, meme en mode administrateur", async () => {
    // Meme motif que le chemin nominal (cf. section 2) : l'espace affiche est
    // derive de l'appartenance, jamais de `users/{uid}.role`. L'outil
    // administrateur n'a plus aucune ecriture sur ce document (l'ancienne
    // option `grantCoachSpace` est retiree, cf.
    // docs/coach-pilote-2026-07/ESPACE_ET_ROLES.md §6.4).
    const store = baseStore();
    const avant = store.read(memberPaths.user(PLAYER_A1));
    await adminTransferClubOwnership(deps(store), {
      clubId: CLUB_A,
      newOwnerUid: PLAYER_A1,
    });
    expect(store.read(memberPaths.user(PLAYER_A1))).toEqual(avant);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 10. LE MODE ADMINISTRATEUR N'A AUCUNE ROUTE RESEAU
// ═════════════════════════════════════════════════════════════════════════════

describe("cloisonnement du mode administrateur", () => {
  it("index.ts n'exporte QUE la callable de transfert, jamais l'outil administrateur", () => {
    // Lecture du fichier source : `firebase-functions` n'etant installe nulle
    // part ici, on ne peut pas importer index.ts. On verifie donc le texte, ce
    // qui suffit pour la seule question posee : existe-t-il une route reseau ?
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { readFileSync } = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require("path") as typeof import("path");
    // Les COMMENTAIRES sont retires : ce qui compte est ce que le fichier
    // EXPORTE, pas ce qu'il explique (index.ts documente justement pourquoi
    // l'outil administrateur n'y est pas).
    const sansCommentaires = (src: string) =>
      src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n");
    const index = sansCommentaires(readFileSync(join(__dirname, "..", "src", "index.ts"), "utf8"));

    expect(index).toContain('export { transferClubOwnership } from "./clubOwnershipApi"');
    expect(index).not.toContain("adminTransferClubOwnership");
    expect(index).not.toContain("clubOwnershipCli");

    // Et l'enveloppe callable n'importe pas non plus le mode administrateur.
    const api = sansCommentaires(
      readFileSync(join(__dirname, "..", "src", "clubOwnershipApi.ts"), "utf8"),
    );
    expect(api).not.toContain("adminTransferClubOwnership");
  });
});
