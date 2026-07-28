// functions/tests/clubMembers.test.ts
//
// RETRAIT REEL D'UN MEMBRE — le coeur de decision, interroge comme le ferait un
// attaquant qui appelle la callable avec curl plutot que par l'application.
//
// Les regles Firestore ne protegent PAS de ce scenario : l'Admin SDK les
// contourne par construction. La porte, ici, c'est la Function elle-meme.
//
// CE QUI N'EST PAS TESTE ICI, ET POURQUOI. L'enveloppe callable
// (clubMembersApi.ts : `request.auth?.uid` comme SEULE source d'identite, le
// branchement Admin SDK, la traduction en HttpsError) n'est pas exercee :
// `firebase-functions` et `firebase-admin` ne sont installes nulle part dans ce
// depot. Meme limite, meme bornage et meme raison que pour callableRights.test.ts.
// Aucune decision ne vit dans cette enveloppe, et aucun identifiant
// d'utilisateur n'est lu dans `request.data`.

import {
  ClubMemberError,
  MEMBER_NOT_FOUND_CODE,
  OWNER_TRANSFER_CODE,
  OWNER_TRANSFER_REQUIRED,
  REMOVE_DENIED_CODE,
  REMOVE_DENIED_MESSAGE,
  isProjectablePlayer,
  memberPaths,
  removeClubMember,
  type MemberDocData,
  type MemberStore,
  type MemberTx,
} from "../src/clubMembers";
import {
  PLAYER_STATUS_INACTIVE,
  isActiveMembership,
  isActivePlayer,
  isClubStaff,
  type ClubAuthoritySignal,
} from "../src/clubAuthority";
import { projectPlayerSummary } from "../src/projector";

// ─── Faux magasin transactionnel ────────────────────────────────────────────
// Les ecritures ne sont appliquees qu'a la SORTIE de la transaction : un refus
// qui reviendrait apres avoir "ecrit" laisserait sinon des traces, et le test ne
// verrait pas la difference entre une transaction et une suite d'ecritures.

class FakeStore implements MemberStore {
  readonly docs = new Map<string, MemberDocData>();
  /** Chemins reellement supprimes (pour distinguer suppression et absence). */
  readonly deleted: string[] = [];

  seed(path: string, data: MemberDocData): void {
    this.docs.set(path, { ...data });
  }

  read(path: string): MemberDocData | null {
    return this.docs.get(path) ?? null;
  }

  async runTransaction<T>(fn: (tx: MemberTx) => Promise<T>): Promise<T> {
    const writes: { path: string; data?: MemberDocData; merge?: boolean; del?: true }[] = [];
    const tx: MemberTx = {
      get: async (path) => this.read(path),
      set: (path, data, opts) => writes.push({ path, data, merge: opts?.merge ?? false }),
      delete: (path) => writes.push({ path, del: true }),
    };
    const result = await fn(tx);
    for (const w of writes) {
      if (w.del) {
        if (this.docs.delete(w.path)) this.deleted.push(w.path);
        else this.deleted.push(w.path); // suppression d'un doc absent = no-op sur
        continue;
      }
      const current = this.docs.get(w.path);
      this.docs.set(w.path, w.merge && current ? { ...current, ...w.data } : { ...w.data });
    }
    return result;
  }
}

const CLUB_A = "clubA";
const CLUB_B = "clubB";
const OWNER_A = "ownerA"; // ownerUid ET role "owner" du club A
const COACH_A = "coachA"; // coach du club A, NON proprietaire
const PLAYER_A1 = "playerA1";
const PLAYER_A2 = "playerA2";
const OWNER_B = "ownerB";
const PLAYER_B = "playerB";
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
    coachAccess: "not_required",
    joinedAt: NOW - 100_000,
  });
  store.seed(memberPaths.member(CLUB_A, PLAYER_A2), {
    uid: PLAYER_A2,
    playerStatus: "active",
    coachAccess: "approved",
  });
  store.seed(memberPaths.member(CLUB_B, OWNER_B), { uid: OWNER_B, accessRole: "owner" });
  store.seed(memberPaths.member(CLUB_B, PLAYER_B), { uid: PLAYER_B, playerStatus: "active" });

  store.seed(memberPaths.user(PLAYER_A1), { uid: PLAYER_A1, clubId: CLUB_A, firstName: "Anna" });
  store.seed(memberPaths.user(PLAYER_A2), { uid: PLAYER_A2, clubId: CLUB_A, firstName: "Bea" });
  store.seed(memberPaths.user(PLAYER_B), { uid: PLAYER_B, clubId: CLUB_B });

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

// ─── 1. Les neuf scenarios du retrait ───────────────────────────────────────

describe("retrait d'un membre — matrice des appelants", () => {
  it("COACH AUTORISE : le retrait passe, et ferme TOUT ce qu'il doit fermer", async () => {
    const store = baseStore();
    const result = await removeClubMember(deps(store), {
      actorUid: COACH_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });

    expect(result).toEqual({
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
      alreadyRemoved: false,
      clearedUserClub: true,
    });

    // a. appartenance desactivee (pierre tombale), joinedAt conserve pour l'audit.
    //    LES DEUX AXES sont fermes dans la MEME ecriture : plus d'encadrement
    //    (`accessRole: null`) ET plus de suivi (`playerStatus: "inactive"`).
    const membership = store.read(memberPaths.member(CLUB_A, PLAYER_A1));
    expect(membership).toMatchObject({
      uid: PLAYER_A1,
      accessRole: null,
      playerStatus: "inactive",
      coachAccess: "revoked",
      removedAt: NOW,
      removedBy: COACH_A,
      joinedAt: NOW - 100_000,
    });
    expect(isClubStaff(membership)).toBe(false);
    expect(isActivePlayer(membership)).toBe(false);
    expect(isActiveMembership(membership)).toBe(false);
    expect(isProjectablePlayer(membership)).toBe(false);

    // b. projection existante supprimee
    expect(store.read(memberPaths.playerSummary(CLUB_A, PLAYER_A1))).toBeNull();

    // c. reference du joueur vers son club nettoyee
    expect(store.read(memberPaths.user(PLAYER_A1))).toMatchObject({ clubId: null });

    // d. AUCUN AUTRE MEMBRE n'a bouge
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A2))).toMatchObject({ playerStatus: "active" });
    expect(store.read(memberPaths.playerSummary(CLUB_A, PLAYER_A2))).not.toBeNull();
    expect(store.read(memberPaths.member(CLUB_A, COACH_A))).toMatchObject({ accessRole: "coach" });
  });

  it("PROPRIETAIRE AUTORISE (predicat complet vrai) : le retrait passe aussi", async () => {
    const store = baseStore();
    await expect(
      removeClubMember(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        memberUid: PLAYER_A1,
      }),
    ).resolves.toMatchObject({ alreadyRemoved: false });
  });

  it("COACH D'UN AUTRE CLUB : refus generique, et RIEN n'a bouge", async () => {
    const store = baseStore();
    const err = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: OWNER_B,
        clubId: CLUB_A,
        memberUid: PLAYER_A1,
      }),
    );
    expect(err.code).toBe(REMOVE_DENIED_CODE);
    expect(err.message).toBe(REMOVE_DENIED_MESSAGE);
    expect(err.reason).toBeNull();

    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))).toMatchObject({ playerStatus: "active" });
    expect(store.read(memberPaths.playerSummary(CLUB_A, PLAYER_A1))).not.toBeNull();
    expect(store.read(memberPaths.user(PLAYER_A1))).toMatchObject({ clubId: CLUB_A });
  });

  it("JOUEUR ORDINAIRE : refus, meme sur un membre de son propre club", async () => {
    const store = baseStore();
    const err = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: PLAYER_A1,
        clubId: CLUB_A,
        memberUid: PLAYER_A2,
      }),
    );
    expect(err.code).toBe(REMOVE_DENIED_CODE);
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A2))).toMatchObject({ playerStatus: "active" });
  });

  it("INCONNU (aucune appartenance) : meme refus, meme message", async () => {
    const store = baseStore();
    const err = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: STRANGER,
        clubId: CLUB_A,
        memberUid: PLAYER_A1,
      }),
    );
    expect(err.code).toBe(REMOVE_DENIED_CODE);
    expect(err.message).toBe(REMOVE_DENIED_MESSAGE);
  });

  it("MEMBRE ABSENT : refus TYPE 'not-found', et il est honnete", async () => {
    // L'autorite est verifiee AVANT la cible : seul un encadrant de CE club
    // atteint cette reponse, a propos d'un uid lu dans SON PROPRE effectif.
    const store = baseStore();
    const err = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: COACH_A,
        clubId: CLUB_A,
        memberUid: "jamaisVu",
      }),
    );
    expect(err.code).toBe(MEMBER_NOT_FOUND_CODE);
  });

  it("MEMBRE ABSENT vu par un NON-encadrant : le refus reste celui de l'autorite", async () => {
    // Le point d'anti-oracle : l'ordre des verifications empeche d'utiliser le
    // retrait pour tester l'appartenance de quelqu'un a un club qu'on n'encadre pas.
    const store = baseStore();
    const err = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: STRANGER,
        clubId: CLUB_A,
        memberUid: "jamaisVu",
      }),
    );
    expect(err.code).toBe(REMOVE_DENIED_CODE);
    expect(err.message).toBe(REMOVE_DENIED_MESSAGE);
  });

  it("DOUBLE RETRAIT : idempotent, et l'audit du premier n'est PAS reecrit", async () => {
    const store = baseStore();
    await removeClubMember(deps(store), {
      actorUid: COACH_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });

    const second = await removeClubMember({ store, now: () => NOW + 5_000 }, {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });

    expect(second).toEqual({
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
      alreadyRemoved: true,
      clearedUserClub: false,
    });
    // La date et l'auteur du PREMIER retrait sont intacts : un double appui ne
    // reecrit pas l'histoire.
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))).toMatchObject({
      removedAt: NOW,
      removedBy: COACH_A,
    });
  });

  it("RETRAIT DU PROPRIETAIRE : echoue avec OWNER_TRANSFER_REQUIRED", async () => {
    const store = baseStore();
    const err = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: COACH_A,
        clubId: CLUB_A,
        memberUid: OWNER_A,
      }),
    );
    expect(err.code).toBe(OWNER_TRANSFER_CODE);
    expect(err.reason).toBe(OWNER_TRANSFER_REQUIRED);
    expect(err.reason).toBe("OWNER_TRANSFER_REQUIRED"); // litteral, verrouille
    // Le message est PARLANT : c'est le seul refus qui doit nommer le geste.
    expect(err.message).toMatch(/transf/i);
    // Et le proprietaire est toujours la.
    expect(store.read(memberPaths.member(CLUB_A, OWNER_A))).toMatchObject({ accessRole: "owner" });
  });

  it("RETRAIT DU PROPRIETAIRE PAR LUI-MEME : meme echec type", async () => {
    const store = baseStore();
    const err = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        memberUid: OWNER_A,
      }),
    );
    expect(err.reason).toBe(OWNER_TRANSFER_REQUIRED);
  });

  it("le refus proprietaire tient MEME si les deux sources sont desaccordees", async () => {
    // ownerUid designe PLAYER_A2 mais son membership dit "player" : la
    // protection est volontairement LARGE (l'une OU l'autre source suffit).
    const store = baseStore();
    store.seed(memberPaths.club(CLUB_A), { name: "Club A", ownerUid: PLAYER_A2 });
    // L'appelant doit rester autorise : un coach ordinaire, non concerne par
    // l'incoherence de ownerUid.
    const err = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: COACH_A,
        clubId: CLUB_A,
        memberUid: PLAYER_A2,
      }),
    );
    expect(err.reason).toBe(OWNER_TRANSFER_REQUIRED);
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A2))).toMatchObject({ playerStatus: "active" });
  });
});

// ─── 2. Autorite incoherente cote APPELANT ──────────────────────────────────

describe("retrait — appelant dont l'autorite est incoherente", () => {
  it("ownerUid le designe mais son appartenance dit 'coach' : REFUS + SIGNAL", async () => {
    const store = baseStore();
    // Etat historique exact que le lot supprime : le createur du club s'ecrivait
    // en "coach". On refuse, on signale, on ne tranche pas.
    store.seed(memberPaths.member(CLUB_A, OWNER_A), { uid: OWNER_A, accessRole: "coach" });

    const signals: ClubAuthoritySignal[] = [];
    const err = await capture(() =>
      removeClubMember(deps(store, (s) => signals.push(s)), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        memberUid: PLAYER_A1,
      }),
    );

    expect(err.code).toBe(REMOVE_DENIED_CODE);
    expect(signals).toEqual([
      {
        clubId: CLUB_A,
        uid: OWNER_A,
        authority: "designation-without-membership",
        action: "removeClubMember",
      },
    ]);
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))).toMatchObject({ playerStatus: "active" });
  });

  it("appartenance 'owner' mais ownerUid designe un autre : REFUS + SIGNAL", async () => {
    const store = baseStore();
    store.seed(memberPaths.member(CLUB_A, COACH_A), { uid: COACH_A, accessRole: "owner" });

    const signals: ClubAuthoritySignal[] = [];
    const err = await capture(() =>
      removeClubMember(deps(store, (s) => signals.push(s)), {
        actorUid: COACH_A,
        clubId: CLUB_A,
        memberUid: PLAYER_A1,
      }),
    );

    expect(err.code).toBe(REMOVE_DENIED_CODE);
    expect(signals).toHaveLength(1);
    expect(signals[0].authority).toBe("membership-without-designation");
  });

  it("un etat COHERENT ne produit AUCUN signal", async () => {
    const store = baseStore();
    const signals: ClubAuthoritySignal[] = [];
    await removeClubMember(deps(store, (s) => signals.push(s)), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });
    expect(signals).toEqual([]);
  });
});

// ─── 3. Ce que voit le PROJECTEUR apres le retrait ──────────────────────────

describe("acces coach et reprojection APRES le retrait", () => {
  const projectorInput = (membership: MemberDocData | null) => ({
    playerUid: PLAYER_A1,
    clubId: CLUB_A,
    membership,
    profile: { uid: PLAYER_A1, clubId: CLUB_A, firstName: "Anna", profileCompleted: true },
    sessions: [],
    plannedSessions: [],
    now: new Date(NOW),
  });

  it("ACCES COACH APRES RETRAIT : la pierre tombale ferme la projection", async () => {
    const store = baseStore();
    await removeClubMember(deps(store), {
      actorUid: COACH_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });
    const membership = store.read(memberPaths.member(CLUB_A, PLAYER_A1));

    // Deux verrous INDEPENDANTS, verifies separement : le role, et l'acces.
    expect(isProjectablePlayer(membership)).toBe(false);
    expect(membership).toMatchObject({ coachAccess: "revoked" });
    expect(projectPlayerSummary(projectorInput(membership))).toBeNull();
  });

  it("PROJECTION EXISTANTE : supprimee par le geste, pas par un trigger", async () => {
    const store = baseStore();
    expect(store.read(memberPaths.playerSummary(CLUB_A, PLAYER_A1))).not.toBeNull();
    await removeClubMember(deps(store), {
      actorUid: COACH_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });
    expect(store.deleted).toContain(memberPaths.playerSummary(CLUB_A, PLAYER_A1));
    expect(store.read(memberPaths.playerSummary(CLUB_A, PLAYER_A1))).toBeNull();
  });

  it("TRIGGER EXECUTE APRES LE RETRAIT : il ne recree rien, il SUPPRIME", async () => {
    // Le joueur retire continue de s'entrainer : ses seances declenchent le
    // projecteur. On rejoue exactement ce que fera `rebuildPlayerSummary` — il
    // relit les sources ACTUELLES, donc la pierre tombale — et on verifie que le
    // resultat est `null`, ce qui fait SUPPRIMER la projection cote rebuild.
    const store = baseStore();
    await removeClubMember(deps(store), {
      actorUid: COACH_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });

    const membershipRelu = store.read(memberPaths.member(CLUB_A, PLAYER_A1));
    const core = projectPlayerSummary({
      ...projectorInput(membershipRelu),
      sessions: [{ __id: "s1", date: "2026-07-27", dateISO: "2026-07-27", focus: "strength" }],
    });
    expect(core).toBeNull();

    // Le refus vient de l'ETAT : peu importe le nombre de reprojections, elles
    // renvoient toutes `null` tant que l'appartenance est revoquee.
    expect(projectPlayerSummary(projectorInput(membershipRelu))).toBeNull();
  });

  it("un membership INTACT projette toujours (preuve que le test ci-dessus mesure bien le retrait)", () => {
    const intact = { uid: PLAYER_A1, playerStatus: "active", coachAccess: "not_required" };
    expect(projectPlayerSummary(projectorInput(intact))).not.toBeNull();
  });
});

// ─── 4. Nettoyage des references ────────────────────────────────────────────

describe("references et caches", () => {
  it("users/{uid}.clubId qui pointe AILLEURS n'est pas touche", async () => {
    const store = baseStore();
    // Le joueur a deja rejoint un autre club entre-temps.
    store.seed(memberPaths.user(PLAYER_A1), { uid: PLAYER_A1, clubId: CLUB_B });

    const result = await removeClubMember(deps(store), {
      actorUid: COACH_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });

    expect(result.clearedUserClub).toBe(false);
    expect(store.read(memberPaths.user(PLAYER_A1))).toMatchObject({ clubId: CLUB_B });
  });

  it("profil absent : le retrait aboutit quand meme (rien a nettoyer)", async () => {
    const store = baseStore();
    store.docs.delete(memberPaths.user(PLAYER_A1));
    const result = await removeClubMember(deps(store), {
      actorUid: COACH_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });
    expect(result.clearedUserClub).toBe(false);
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))).toMatchObject({
      accessRole: null, playerStatus: "inactive",
    });
  });

  it("l'historique sportif du joueur n'est JAMAIS touche", async () => {
    const store = baseStore();
    store.seed("users/playerA1/sessions/s1", { date: "2026-07-20", focus: "strength" });
    await removeClubMember(deps(store), {
      actorUid: COACH_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });
    expect(store.read("users/playerA1/sessions/s1")).toMatchObject({ date: "2026-07-20" });
    expect(store.deleted).not.toContain("users/playerA1/sessions/s1");
  });
});

// ─── 5. Entrees hostiles ────────────────────────────────────────────────────

describe("entrees hostiles", () => {
  it("appelant sans identite : 'unauthenticated', distinct du refus d'autorite", async () => {
    const store = baseStore();
    const err = await capture(() =>
      removeClubMember(deps(store), { actorUid: "  ", clubId: CLUB_A, memberUid: PLAYER_A1 }),
    );
    expect(err.code).toBe("unauthenticated");
  });

  it("identifiants forges : refuses AVANT toute lecture, avec le refus generique", async () => {
    const store = baseStore();
    const casHostiles: unknown[] = [
      "",
      "   ",
      42,
      null,
      { clubId: CLUB_A },
      "clubs/clubA/members/playerA1",
      "../clubA",
      "x".repeat(200),
    ];
    for (const valeur of casHostiles) {
      const parClub = await capture(() =>
        removeClubMember(deps(store), {
          actorUid: COACH_A,
          clubId: valeur,
          memberUid: PLAYER_A1,
        }),
      );
      expect(parClub.code).toBe(REMOVE_DENIED_CODE);
      const parMembre = await capture(() =>
        removeClubMember(deps(store), {
          actorUid: COACH_A,
          clubId: CLUB_A,
          memberUid: valeur,
        }),
      );
      expect(parMembre.code).toBe(REMOVE_DENIED_CODE);
    }
    // Aucune lecture n'a rien change.
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))).toMatchObject({ playerStatus: "active" });
  });

  it("club inexistant : MEME refus que 'pas encadrant' (aucun oracle d'existence)", async () => {
    const store = baseStore();
    const inexistant = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: COACH_A,
        clubId: "clubQuiNExistePas",
        memberUid: PLAYER_A1,
      }),
    );
    const autreClub = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: COACH_A,
        clubId: CLUB_B,
        memberUid: PLAYER_B,
      }),
    );
    expect(inexistant.code).toBe(autreClub.code);
    expect(inexistant.message).toBe(autreClub.message);
  });

  it("une panne du magasin ne devient jamais un succes", async () => {
    const store = baseStore();
    const cassé: MemberStore = {
      runTransaction: () => Promise.reject(new Error("indisponible")),
    };
    const err = await capture(() =>
      removeClubMember(
        { store: cassé, now: () => NOW },
        { actorUid: COACH_A, clubId: CLUB_A, memberUid: PLAYER_A1 },
      ),
    );
    expect(err.code).toBe("unavailable");
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))).toMatchObject({ playerStatus: "active" });
  });
});
