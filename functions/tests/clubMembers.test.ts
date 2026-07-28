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
  GESTURE_DENIED_MESSAGE,
  MEMBER_NOT_FOUND_CODE,
  OWNER_TRANSFER_CODE,
  OWNER_TRANSFER_REQUIRED,
  PLAYER_DEACTIVATED_AT_FIELD,
  PLAYER_DEACTIVATED_BY_FIELD,
  REMOVE_DENIED_CODE,
  REMOVE_DENIED_MESSAGE,
  STAFF_OWNER_ONLY,
  STAFF_OWNER_ONLY_CODE,
  STAFF_REVOKED_AT_FIELD,
  STAFF_REVOKED_BY_FIELD,
  deactivateClubPlayer,
  isProjectablePlayer,
  memberPaths,
  removeClubMember,
  revokeClubStaffAccess,
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
  /**
   * TOUTE ecriture demandee (ecriture ou suppression), dans l'ordre. C'est le
   * seul moyen honnete de prouver l'idempotence : « rien n'a change » peut etre
   * vrai d'une reecriture a l'identique, « rien n'a ete ecrit » ne peut pas.
   */
  readonly ecritures: string[] = [];

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
      this.ecritures.push(`${w.del ? "delete" : "set"} ${w.path}`);
    }
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

// ════════════════════════════════════════════════════════════════════════════
// LES TROIS FORMES DE RETRAIT
//
// Ce qui est verrouille ici, dans l'ordre d'importance produit :
//  1. CHAQUE GESTE FAIT UNE SEULE CHOSE. Pour chacun, on verifie ce qu'il
//     change ET ce qu'il conserve — la moitie « conserve » est la raison d'etre
//     du lot : c'est elle que le geste unique ne savait pas exprimer.
//  2. LE PIEGE DU PROPRIETAIRE. OWNER_TRANSFER_REQUIRED sur DEUX gestes, et PAS
//     sur le troisieme : un president qui arrete de jouer ne transfere pas son
//     club.
//  3. LA MATRICE acteur x geste x cible, jouee cas par cas.
//  4. L'IDEMPOTENCE PAR COMPTAGE D'ECRITURES. « Rien n'a change » peut etre vrai
//     d'une reecriture a l'identique ; « rien n'a ete ecrit » ne peut pas.
//  5. LA REPROJECTION apres chaque geste — le refus doit venir de l'ETAT, jamais
//     de l'ordre d'arrivee des evenements.
// ════════════════════════════════════════════════════════════════════════════

const COACH_A2 = "coachA2"; // encadrant PUR : aucun suivi sportif
const COACH_JOUEUR = "coachJoueurA"; // entraineur-joueur : les DEUX axes

/** Nom lisible du geste -> jeton interne (les tables de messages sont indexees dessus). */
const GESTE_VERS_JETON = {
  "retrait complet": "removeClubMember",
  "arret du suivi": "deactivateClubPlayer",
  "revocation encadrement": "revokeClubStaffAccess",
} as const;

/** baseStore + un encadrant pur + un entraineur-joueur (avec fiche et profil). */
function storeAvecEncadrants(): FakeStore {
  const store = baseStore();
  store.seed(memberPaths.member(CLUB_A, COACH_A2), { uid: COACH_A2, accessRole: "coach" });
  store.seed(memberPaths.member(CLUB_A, COACH_JOUEUR), {
    uid: COACH_JOUEUR,
    accessRole: "coach",
    playerStatus: "active",
    coachAccess: "not_required",
    joinedAt: NOW - 200_000,
  });
  store.seed(memberPaths.user(COACH_JOUEUR), {
    uid: COACH_JOUEUR,
    clubId: CLUB_A,
    firstName: "Cyril",
  });
  store.seed(memberPaths.playerSummary(CLUB_A, COACH_JOUEUR), {
    playerUid: COACH_JOUEUR,
    firstName: "Cyril",
  });
  return store;
}

/** Le proprietaire est AUSSI joueur de son effectif (cas du president-joueur). */
function storeProprietaireJoueur(): FakeStore {
  const store = storeAvecEncadrants();
  store.seed(memberPaths.member(CLUB_A, OWNER_A), {
    uid: OWNER_A,
    accessRole: "owner",
    playerStatus: "active",
    coachAccess: "not_required",
  });
  store.seed(memberPaths.user(OWNER_A), { uid: OWNER_A, clubId: CLUB_A, firstName: "Odile" });
  store.seed(memberPaths.playerSummary(CLUB_A, OWNER_A), {
    playerUid: OWNER_A,
    firstName: "Odile",
  });
  return store;
}

// ─── 6. Les trois gestes, un par un : ce qu'ils changent ET ce qu'ils gardent ─

describe("geste 1 — ARRETER LE SUIVI DE JOUEUR", () => {
  it("ferme le suivi et CONSERVE integralement l'encadrement", async () => {
    const store = storeAvecEncadrants();
    const result = await deactivateClubPlayer(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });

    expect(result).toEqual({
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
      alreadyInactive: false,
      keepsStaffAccess: true,
    });

    const membership = store.read(memberPaths.member(CLUB_A, COACH_JOUEUR));
    // CE QUI CHANGE : le suivi, et lui seul. La valeur ecrite est celle du
    // vocabulaire partage, pas un litteral recopie a la main.
    expect(membership).toMatchObject({
      playerStatus: PLAYER_STATUS_INACTIVE,
      coachAccess: "revoked",
      [PLAYER_DEACTIVATED_AT_FIELD]: NOW,
      [PLAYER_DEACTIVATED_BY_FIELD]: OWNER_A,
    });
    expect(isActivePlayer(membership)).toBe(false);
    expect(isProjectablePlayer(membership)).toBe(false);
    // CE QUI EST CONSERVE : l'encadrement, l'audit d'entree, l'appartenance.
    expect(membership).toMatchObject({ accessRole: "coach", joinedAt: NOW - 200_000 });
    expect(isClubStaff(membership)).toBe(true);
    expect(isActiveMembership(membership)).toBe(true);
    // Aucune pierre tombale de retrait : ce n'est PAS un retrait.
    expect(membership?.removedAt).toBeUndefined();

    // La fiche de suivi disparait avec le geste.
    expect(store.deleted).toContain(memberPaths.playerSummary(CLUB_A, COACH_JOUEUR));
    expect(store.read(memberPaths.playerSummary(CLUB_A, COACH_JOUEUR))).toBeNull();

    // Le club n'est PAS detache : la personne reste membre.
    expect(store.read(memberPaths.user(COACH_JOUEUR))).toMatchObject({ clubId: CLUB_A });
  });

  it("sur un joueur ordinaire : keepsStaffAccess dit la verite (false)", async () => {
    const store = storeAvecEncadrants();
    const result = await deactivateClubPlayer(deps(store), {
      actorUid: COACH_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });
    expect(result.keepsStaffAccess).toBe(false);
    expect(store.read(memberPaths.member(CLUB_A, PLAYER_A1))).toMatchObject({
      playerStatus: "inactive",
    });
    // Le detachement du club reste l'apanage du retrait COMPLET.
    expect(store.read(memberPaths.user(PLAYER_A1))).toMatchObject({ clubId: CLUB_A });
  });
});

describe("geste 2 — REVOQUER LES PERMISSIONS D'ENCADREMENT", () => {
  it("ferme l'encadrement et CONSERVE integralement le suivi de joueur", async () => {
    const store = storeAvecEncadrants();
    const result = await revokeClubStaffAccess(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });

    expect(result).toEqual({
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
      alreadyRevoked: false,
      keepsPlayerStatus: true,
    });

    const membership = store.read(memberPaths.member(CLUB_A, COACH_JOUEUR));
    // CE QUI CHANGE : les permissions, et elles seules.
    expect(membership).toMatchObject({
      accessRole: null,
      [STAFF_REVOKED_AT_FIELD]: NOW,
      [STAFF_REVOKED_BY_FIELD]: OWNER_A,
    });
    expect(isClubStaff(membership)).toBe(false);
    // CE QUI EST CONSERVE : le suivi, l'autorisation d'acces, la fiche.
    expect(membership).toMatchObject({ playerStatus: "active", coachAccess: "not_required" });
    expect(isActivePlayer(membership)).toBe(true);
    expect(isProjectablePlayer(membership)).toBe(true);
    expect(isActiveMembership(membership)).toBe(true);

    // LA FICHE RESTE. Elle n'est ni supprimee, ni meme touchee.
    expect(store.deleted).not.toContain(memberPaths.playerSummary(CLUB_A, COACH_JOUEUR));
    expect(store.read(memberPaths.playerSummary(CLUB_A, COACH_JOUEUR))).not.toBeNull();
    expect(store.read(memberPaths.user(COACH_JOUEUR))).toMatchObject({ clubId: CLUB_A });
  });

  it("un entraineur-joueur qui perd son encadrement GARDE sa fiche suivie", async () => {
    const store = storeAvecEncadrants();
    await revokeClubStaffAccess(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });
    const membership = store.read(memberPaths.member(CLUB_A, COACH_JOUEUR));

    // Le projecteur — la vraie question — continue de produire sa fiche.
    const core = projectPlayerSummary({
      playerUid: COACH_JOUEUR,
      clubId: CLUB_A,
      membership,
      profile: { uid: COACH_JOUEUR, clubId: CLUB_A, firstName: "Cyril", profileCompleted: true },
      sessions: [],
      plannedSessions: [],
      now: new Date(NOW),
    });
    expect(core).not.toBeNull();
  });

  it("sur un encadrant PUR : keepsPlayerStatus false, et l'appartenance n'ouvre plus rien", async () => {
    const store = storeAvecEncadrants();
    const result = await revokeClubStaffAccess(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_A2,
    });
    expect(result.keepsPlayerStatus).toBe(false);
    const membership = store.read(memberPaths.member(CLUB_A, COACH_A2));
    expect(isClubStaff(membership)).toBe(false);
    expect(isActiveMembership(membership)).toBe(false);
  });
});

describe("geste 3 — RETRAIT COMPLET : les deux axes, plus le detachement", () => {
  it("ferme les DEUX axes, purge la fiche et detache le club", async () => {
    const store = storeAvecEncadrants();
    const result = await removeClubMember(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });

    expect(result).toMatchObject({ alreadyRemoved: false, clearedUserClub: true });
    const membership = store.read(memberPaths.member(CLUB_A, COACH_JOUEUR));
    expect(isClubStaff(membership)).toBe(false);
    expect(isActivePlayer(membership)).toBe(false);
    expect(isActiveMembership(membership)).toBe(false);
    expect(store.read(memberPaths.playerSummary(CLUB_A, COACH_JOUEUR))).toBeNull();
    expect(store.read(memberPaths.user(COACH_JOUEUR))).toMatchObject({ clubId: null });
  });

  it("SEUL le retrait complet detache users/{uid}.clubId", async () => {
    const suivi = storeAvecEncadrants();
    await deactivateClubPlayer(deps(suivi), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });
    expect(suivi.read(memberPaths.user(COACH_JOUEUR))).toMatchObject({ clubId: CLUB_A });

    const encadrement = storeAvecEncadrants();
    await revokeClubStaffAccess(deps(encadrement), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });
    expect(encadrement.read(memberPaths.user(COACH_JOUEUR))).toMatchObject({ clubId: CLUB_A });

    const complet = storeAvecEncadrants();
    await removeClubMember(deps(complet), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });
    expect(complet.read(memberPaths.user(COACH_JOUEUR))).toMatchObject({ clubId: null });
  });

  it("les trois gestes ne produisent PAS la meme transaction", async () => {
    const trace = async (
      geste: (
        d: { store: FakeStore; now: () => number },
        p: { actorUid: string; clubId: string; memberUid: string },
      ) => Promise<unknown>,
    ) => {
      const store = storeAvecEncadrants();
      await geste(deps(store), { actorUid: OWNER_A, clubId: CLUB_A, memberUid: COACH_JOUEUR });
      return store.ecritures;
    };

    const suivi = await trace(deactivateClubPlayer);
    const encadrement = await trace(revokeClubStaffAccess);
    const complet = await trace(removeClubMember);

    // Trois ensembles de chemins ecrits REELLEMENT differents.
    expect(suivi).toEqual([
      `set ${memberPaths.member(CLUB_A, COACH_JOUEUR)}`,
      `delete ${memberPaths.playerSummary(CLUB_A, COACH_JOUEUR)}`,
    ]);
    expect(encadrement).toEqual([`set ${memberPaths.member(CLUB_A, COACH_JOUEUR)}`]);
    expect(complet).toEqual([
      `set ${memberPaths.member(CLUB_A, COACH_JOUEUR)}`,
      `delete ${memberPaths.playerSummary(CLUB_A, COACH_JOUEUR)}`,
      `set ${memberPaths.user(COACH_JOUEUR)}`,
    ]);
  });
});

// ─── 7. Les TROIS cas de OWNER_TRANSFER_REQUIRED (deux oui, un non) ─────────

describe("le proprietaire : deux gestes exigent le transfert, le troisieme non", () => {
  it("RETRAIT COMPLET du proprietaire -> OWNER_TRANSFER_REQUIRED", async () => {
    const store = storeProprietaireJoueur();
    const err = await capture(() =>
      removeClubMember(deps(store), {
        actorUid: OWNER_A,
        clubId: CLUB_A,
        memberUid: OWNER_A,
      }),
    );
    expect(err.code).toBe(OWNER_TRANSFER_CODE);
    expect(err.reason).toBe(OWNER_TRANSFER_REQUIRED);
    expect(err.message).toMatch(/transf/i);
    expect(store.ecritures).toEqual([]);
  });

  it("REVOCATION DE L'ENCADREMENT du proprietaire -> OWNER_TRANSFER_REQUIRED", async () => {
    const store = storeProprietaireJoueur();
    // Par lui-meme, ET par un autre encadrant : le refus est le meme.
    for (const acteur of [OWNER_A, COACH_A]) {
      const err = await capture(() =>
        revokeClubStaffAccess(deps(store), {
          actorUid: acteur,
          clubId: CLUB_A,
          memberUid: OWNER_A,
        }),
      );
      expect(err.code).toBe(OWNER_TRANSFER_CODE);
      expect(err.reason).toBe(OWNER_TRANSFER_REQUIRED);
      expect(err.message).toMatch(/transf/i);
    }
    expect(store.read(memberPaths.member(CLUB_A, OWNER_A))).toMatchObject({ accessRole: "owner" });
    expect(store.ecritures).toEqual([]);
  });

  it("ARRETER SON PROPRE SUIVI quand on est proprietaire : PARFAITEMENT LEGITIME", async () => {
    // LE PIEGE DE CE LOT. Un president qui arrete de jouer ne transfere pas son
    // club : ce geste ne lui retire aucun pouvoir, il n'y a donc rien a
    // transferer d'abord.
    const store = storeProprietaireJoueur();
    const result = await deactivateClubPlayer(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: OWNER_A,
    });

    expect(result).toEqual({
      clubId: CLUB_A,
      memberUid: OWNER_A,
      alreadyInactive: false,
      keepsStaffAccess: true,
    });

    const membership = store.read(memberPaths.member(CLUB_A, OWNER_A));
    // Il reste proprietaire, des DEUX cotes : la designation et l'appartenance.
    expect(membership).toMatchObject({ accessRole: "owner", playerStatus: "inactive" });
    expect(store.read(memberPaths.club(CLUB_A))).toMatchObject({ ownerUid: OWNER_A });
    expect(isClubStaff(membership)).toBe(true);
    // Et il a bien quitte l'effectif SUIVI.
    expect(isProjectablePlayer(membership)).toBe(false);
    expect(store.read(memberPaths.playerSummary(CLUB_A, OWNER_A))).toBeNull();
  });
});

// ─── 8. La matrice acteur x geste x cible ───────────────────────────────────

type Attendu = "ok" | "denied" | "staff-owner-only" | "owner-transfer" | "member-missing";

const GESTES = {
  "retrait complet": removeClubMember,
  "arret du suivi": deactivateClubPlayer,
  "revocation encadrement": revokeClubStaffAccess,
} as const;

type NomGeste = keyof typeof GESTES;

/**
 * Un cas = un acteur, un geste, une cible, un verdict. Chaque ligne tourne sur
 * un magasin NEUF : aucun cas ne peut dependre du precedent.
 */
const MATRICE: Array<[string, NomGeste, string, Attendu]> = [
  // Cible : un JOUEUR ordinaire. Tout encadrant du club passe.
  [OWNER_A, "retrait complet", PLAYER_A1, "ok"],
  [OWNER_A, "arret du suivi", PLAYER_A1, "ok"],
  [OWNER_A, "revocation encadrement", PLAYER_A1, "ok"], // deja sans encadrement : rejeu
  [COACH_A, "retrait complet", PLAYER_A1, "ok"],
  [COACH_A, "arret du suivi", PLAYER_A1, "ok"],
  [COACH_A, "revocation encadrement", PLAYER_A1, "ok"],
  // Sur SOI-MEME : toujours permis, c'est une reduction de ses propres droits.
  [PLAYER_A1, "retrait complet", PLAYER_A1, "ok"],
  [PLAYER_A1, "arret du suivi", PLAYER_A1, "ok"],
  [PLAYER_A1, "revocation encadrement", PLAYER_A1, "ok"],
  // Un joueur ne touche PAS a quelqu'un d'autre.
  [PLAYER_A1, "retrait complet", PLAYER_A2, "denied"],
  [PLAYER_A1, "arret du suivi", PLAYER_A2, "denied"],
  [PLAYER_A1, "revocation encadrement", PLAYER_A2, "denied"],
  // Encadrant d'un AUTRE club, et parfait inconnu : meme refus opaque.
  [OWNER_B, "retrait complet", PLAYER_A1, "denied"],
  [OWNER_B, "arret du suivi", PLAYER_A1, "denied"],
  [OWNER_B, "revocation encadrement", PLAYER_A1, "denied"],
  [STRANGER, "retrait complet", PLAYER_A1, "denied"],
  [STRANGER, "arret du suivi", PLAYER_A1, "denied"],
  [STRANGER, "revocation encadrement", PLAYER_A1, "denied"],

  // Cible : un ENCADRANT (non proprietaire). Seul le proprietaire, ou lui-meme.
  [OWNER_A, "retrait complet", COACH_A2, "ok"],
  [OWNER_A, "arret du suivi", COACH_A2, "ok"], // sans suivi : rejeu, mais autorise
  [OWNER_A, "revocation encadrement", COACH_A2, "ok"],
  [COACH_A, "retrait complet", COACH_A2, "staff-owner-only"],
  [COACH_A, "arret du suivi", COACH_A2, "staff-owner-only"],
  [COACH_A, "revocation encadrement", COACH_A2, "staff-owner-only"],
  [COACH_A2, "retrait complet", COACH_A2, "ok"],
  [COACH_A2, "arret du suivi", COACH_A2, "ok"],
  [COACH_A2, "revocation encadrement", COACH_A2, "ok"],
  [PLAYER_A1, "revocation encadrement", COACH_A2, "denied"],

  // Cible : le PROPRIETAIRE.
  [OWNER_A, "retrait complet", OWNER_A, "owner-transfer"],
  [OWNER_A, "revocation encadrement", OWNER_A, "owner-transfer"],
  [OWNER_A, "arret du suivi", OWNER_A, "ok"],
  [COACH_A, "retrait complet", OWNER_A, "owner-transfer"],
  [COACH_A, "revocation encadrement", OWNER_A, "owner-transfer"],
  // Le proprietaire est un encadrant : un coach ne touche pas a son suivi non plus.
  [COACH_A, "arret du suivi", OWNER_A, "staff-owner-only"],

  // Cible INEXISTANTE : « membre absent » n'est dit qu'a un encadrant de ce club.
  [COACH_A, "retrait complet", "jamaisVu", "member-missing"],
  [COACH_A, "arret du suivi", "jamaisVu", "member-missing"],
  [COACH_A, "revocation encadrement", "jamaisVu", "member-missing"],
  // ANTI-ORACLE : un inconnu ne distingue pas « club inconnu » de « pas membre »,
  // meme en se visant lui-meme.
  [STRANGER, "retrait complet", STRANGER, "denied"],
  [STRANGER, "arret du suivi", STRANGER, "denied"],
  [STRANGER, "revocation encadrement", STRANGER, "denied"],
];

describe("matrice acteur x geste x cible", () => {
  it.each(MATRICE)("%s / %s / %s -> %s", async (acteur, nomGeste, cible, attendu) => {
    const store = storeProprietaireJoueur();
    const appel = () =>
      GESTES[nomGeste](deps(store), { actorUid: acteur, clubId: CLUB_A, memberUid: cible });

    if (attendu === "ok") {
      await expect(appel()).resolves.toBeDefined();
      return;
    }

    const err = await capture(appel);
    if (attendu === "denied") {
      expect(err.code).toBe(REMOVE_DENIED_CODE);
      expect(err.reason).toBeNull();
      expect(err.message).toBe(GESTURE_DENIED_MESSAGE[GESTE_VERS_JETON[nomGeste]]);
    } else if (attendu === "staff-owner-only") {
      expect(err.code).toBe(STAFF_OWNER_ONLY_CODE);
      expect(err.reason).toBe(STAFF_OWNER_ONLY);
      expect(err.reason).toBe("STAFF_OWNER_ONLY"); // litteral, verrouille
    } else if (attendu === "owner-transfer") {
      expect(err.code).toBe(OWNER_TRANSFER_CODE);
      expect(err.reason).toBe(OWNER_TRANSFER_REQUIRED);
    } else {
      expect(err.code).toBe(MEMBER_NOT_FOUND_CODE);
    }
    // Un refus n'ecrit JAMAIS.
    expect(store.ecritures).toEqual([]);
  });
});

// ─── 9. Idempotence, prouvee par COMPTAGE d'ecritures ───────────────────────

describe("idempotence des trois gestes : le rejeu reussit sans rien ecrire", () => {
  it("ARRET DU SUIVI rejoue : succes, zero ecriture, trace du premier intacte", async () => {
    const store = storeAvecEncadrants();
    await deactivateClubPlayer(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });
    const ecrituresApresLePremier = store.ecritures.length;

    // Rejoue par le proprietaire : la cible est un ENCADRANT, seul lui (ou
    // elle-meme) y touche — le rejeu ne contourne aucune regle d'autorite.
    const second = await deactivateClubPlayer(
      { store, now: () => NOW + 5_000 },
      { actorUid: OWNER_A, clubId: CLUB_A, memberUid: COACH_JOUEUR },
    );

    expect(second).toEqual({
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
      alreadyInactive: true,
      keepsStaffAccess: true,
    });
    expect(store.ecritures).toHaveLength(ecrituresApresLePremier);
    expect(store.read(memberPaths.member(CLUB_A, COACH_JOUEUR))).toMatchObject({
      [PLAYER_DEACTIVATED_AT_FIELD]: NOW,
      [PLAYER_DEACTIVATED_BY_FIELD]: OWNER_A,
    });
  });

  it("REVOCATION rejouee : succes, zero ecriture, trace du premier intacte", async () => {
    const store = storeAvecEncadrants();
    await revokeClubStaffAccess(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });
    const ecrituresApresLePremier = store.ecritures.length;

    const second = await revokeClubStaffAccess(
      { store, now: () => NOW + 5_000 },
      { actorUid: OWNER_A, clubId: CLUB_A, memberUid: COACH_JOUEUR },
    );

    expect(second).toEqual({
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
      alreadyRevoked: true,
      keepsPlayerStatus: true,
    });
    expect(store.ecritures).toHaveLength(ecrituresApresLePremier);
    expect(store.read(memberPaths.member(CLUB_A, COACH_JOUEUR))).toMatchObject({
      [STAFF_REVOKED_AT_FIELD]: NOW,
      [STAFF_REVOKED_BY_FIELD]: OWNER_A,
    });
  });

  it("RETRAIT COMPLET rejoue : succes, zero ecriture", async () => {
    const store = storeAvecEncadrants();
    await removeClubMember(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: PLAYER_A1,
    });
    const ecrituresApresLePremier = store.ecritures.length;

    const second = await removeClubMember(
      { store, now: () => NOW + 5_000 },
      { actorUid: COACH_A, clubId: CLUB_A, memberUid: PLAYER_A1 },
    );

    expect(second).toMatchObject({ alreadyRemoved: true, clearedUserClub: false });
    expect(store.ecritures).toHaveLength(ecrituresApresLePremier);
  });

  it("ENCHAINEMENT des deux gestes partiels = l'etat du retrait, sans le detachement", async () => {
    const store = storeAvecEncadrants();
    await deactivateClubPlayer(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });
    await revokeClubStaffAccess(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });

    const membership = store.read(memberPaths.member(CLUB_A, COACH_JOUEUR));
    expect(isActiveMembership(membership)).toBe(false);
    // MAIS le club reste attache : c'est precisement ce que le retrait complet
    // ajoute, et ce qu'aucun enchainement de gestes partiels ne fabrique.
    expect(store.read(memberPaths.user(COACH_JOUEUR))).toMatchObject({ clubId: CLUB_A });

    // Et le retrait complet, joue ensuite, constate que tout est deja ferme.
    const final = await removeClubMember(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });
    expect(final.alreadyRemoved).toBe(true);
  });
});

// ─── 10. Reprojection APRES chaque geste ────────────────────────────────────

describe("reprojection apres chaque geste : le refus vient de l'ETAT", () => {
  const projeter = (uid: string, membership: MemberDocData | null, prenom: string) =>
    projectPlayerSummary({
      playerUid: uid,
      clubId: CLUB_A,
      membership,
      profile: { uid, clubId: CLUB_A, firstName: prenom, profileCompleted: true },
      // Le joueur continue de s'entrainer : ses seances declenchent le projecteur.
      sessions: [{ __id: "s1", date: "2026-07-27", dateISO: "2026-07-27", focus: "strength" }],
      plannedSessions: [],
      now: new Date(NOW),
    });

  it("APRES L'ARRET DU SUIVI : toute reprojection renvoie null (donc supprime)", async () => {
    const store = storeAvecEncadrants();
    await deactivateClubPlayer(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });
    const relu = store.read(memberPaths.member(CLUB_A, COACH_JOUEUR));
    expect(projeter(COACH_JOUEUR, relu, "Cyril")).toBeNull();
    // Peu importe combien de fois : c'est l'etat qui refuse.
    expect(projeter(COACH_JOUEUR, relu, "Cyril")).toBeNull();
  });

  it("APRES LA REVOCATION : la reprojection CONTINUE de produire la fiche", async () => {
    const store = storeAvecEncadrants();
    await revokeClubStaffAccess(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });
    const relu = store.read(memberPaths.member(CLUB_A, COACH_JOUEUR));
    expect(projeter(COACH_JOUEUR, relu, "Cyril")).not.toBeNull();
  });

  it("APRES LE RETRAIT COMPLET : toute reprojection renvoie null", async () => {
    const store = storeAvecEncadrants();
    await removeClubMember(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });
    const relu = store.read(memberPaths.member(CLUB_A, COACH_JOUEUR));
    expect(projeter(COACH_JOUEUR, relu, "Cyril")).toBeNull();
  });
});

// ─── 11. Une permission d'encadrement ne rend JAMAIS une fiche consultable ──

describe("la regle de projection : le statut joueur, et lui seul", () => {
  const projeter = (membership: MemberDocData | null) =>
    projectPlayerSummary({
      playerUid: COACH_A2,
      clubId: CLUB_A,
      membership,
      profile: { uid: COACH_A2, clubId: CLUB_A, firstName: "Karl", profileCompleted: true },
      sessions: [],
      plannedSessions: [],
      now: new Date(NOW),
    });

  it("encadrant SANS suivi : aucune fiche, meme avec l'acces le plus ouvert", () => {
    for (const accessRole of ["owner", "coach"]) {
      for (const coachAccess of ["approved", "not_required"]) {
        expect(projeter({ uid: COACH_A2, accessRole, coachAccess })).toBeNull();
      }
    }
  });

  it("encadrant dont le suivi vient d'etre arrete : aucune fiche non plus", async () => {
    const store = storeAvecEncadrants();
    await deactivateClubPlayer(deps(store), {
      actorUid: OWNER_A,
      clubId: CLUB_A,
      memberUid: COACH_JOUEUR,
    });
    const relu = store.read(memberPaths.member(CLUB_A, COACH_JOUEUR));
    expect(isClubStaff(relu)).toBe(true); // il encadre toujours
    expect(projeter(relu)).toBeNull(); // et pourtant, aucune fiche
  });

  it("suivi actif SANS aucune permission : la fiche existe (temoin)", () => {
    expect(
      projeter({ uid: COACH_A2, playerStatus: "active", coachAccess: "not_required" }),
    ).not.toBeNull();
  });
});

// ─── 12. Entrees hostiles sur les deux nouveaux gestes ──────────────────────

describe("entrees hostiles — arret du suivi et revocation", () => {
  it("appelant sans identite : 'unauthenticated' pour les deux", async () => {
    const store = storeAvecEncadrants();
    for (const geste of [deactivateClubPlayer, revokeClubStaffAccess]) {
      const err = await capture(() =>
        geste(deps(store), { actorUid: "  ", clubId: CLUB_A, memberUid: COACH_JOUEUR }),
      );
      expect(err.code).toBe("unauthenticated");
    }
    expect(store.ecritures).toEqual([]);
  });

  it("identifiants forges : refuses AVANT toute lecture", async () => {
    const store = storeAvecEncadrants();
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
    for (const geste of [deactivateClubPlayer, revokeClubStaffAccess]) {
      for (const valeur of casHostiles) {
        const parClub = await capture(() =>
          geste(deps(store), { actorUid: OWNER_A, clubId: valeur, memberUid: COACH_JOUEUR }),
        );
        expect(parClub.code).toBe(REMOVE_DENIED_CODE);
        const parMembre = await capture(() =>
          geste(deps(store), { actorUid: OWNER_A, clubId: CLUB_A, memberUid: valeur }),
        );
        expect(parMembre.code).toBe(REMOVE_DENIED_CODE);
      }
    }
    expect(store.ecritures).toEqual([]);
  });

  it("club inexistant : MEME refus que « pas encadrant » (aucun oracle)", async () => {
    const store = storeAvecEncadrants();
    for (const geste of [deactivateClubPlayer, revokeClubStaffAccess]) {
      const inexistant = await capture(() =>
        geste(deps(store), {
          actorUid: OWNER_A,
          clubId: "clubQuiNExistePas",
          memberUid: COACH_JOUEUR,
        }),
      );
      const autreClub = await capture(() =>
        geste(deps(store), { actorUid: OWNER_A, clubId: CLUB_B, memberUid: PLAYER_B }),
      );
      expect(inexistant.code).toBe(autreClub.code);
      expect(inexistant.message).toBe(autreClub.message);
    }
  });

  it("autorite incoherente : refus + signal, pour les deux gestes", async () => {
    for (const [geste, action] of [
      [deactivateClubPlayer, "deactivateClubPlayer"],
      [revokeClubStaffAccess, "revokeClubStaffAccess"],
    ] as const) {
      const store = storeAvecEncadrants();
      // Le createur du club porte "coach" : ownerUid le designe, pas son role.
      store.seed(memberPaths.member(CLUB_A, OWNER_A), { uid: OWNER_A, accessRole: "coach" });
      const signals: ClubAuthoritySignal[] = [];
      const err = await capture(() =>
        geste(
          deps(store, (s) => signals.push(s)),
          { actorUid: OWNER_A, clubId: CLUB_A, memberUid: COACH_JOUEUR },
        ),
      );
      expect(err.code).toBe(REMOVE_DENIED_CODE);
      expect(signals).toEqual([
        { clubId: CLUB_A, uid: OWNER_A, authority: "designation-without-membership", action },
      ]);
      expect(store.ecritures).toEqual([]);
    }
  });

  it("une panne du magasin ne devient jamais un succes", async () => {
    const casse: MemberStore = {
      runTransaction: () => Promise.reject(new Error("indisponible")),
    };
    for (const geste of [deactivateClubPlayer, revokeClubStaffAccess]) {
      const err = await capture(() =>
        geste(
          { store: casse, now: () => NOW },
          { actorUid: OWNER_A, clubId: CLUB_A, memberUid: COACH_JOUEUR },
        ),
      );
      expect(err.code).toBe("unavailable");
    }
  });
});
