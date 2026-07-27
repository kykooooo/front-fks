// functions/tests/clubAuthority.test.ts
//
// LE PREDICAT D'AUTORITE — versant SERVEUR. Tests unitaires purs, aucun
// emulateur (le module ne connait ni Firestore ni horloge).
//
// Le versant REGLES exerce les MEMES cas contre les vraies regles jouees par
// l'emulateur : firestore-tests/rules.clubAuthority.test.ts. Les deux suites
// sont le seul verrou de la duplication assumee entre clubAuthority.ts et
// firestore.rules — il n'en existe aucun d'automatique.
//
// L'invariant teste, mot pour mot : "un proprietaire est autorise uniquement si
// ownerUid le designe ET s'il possede encore une appartenance active avec le
// role proprietaire".

import {
  CLUB_ACTIVE_ROLES,
  CLUB_ROLE_COACH,
  CLUB_ROLE_OWNER,
  CLUB_ROLE_PLAYER,
  CLUB_ROLE_REMOVED,
  CLUB_STAFF_ROLES,
  clubAuthoritySignal,
  hasOwnerMembership,
  isActiveMembership,
  isClubOwnerAuthorized,
  isClubStaff,
  isDesignatedOwner,
  isOwnerAuthorityInconsistent,
  normalizeClubRole,
  readOwnerUid,
  resolveOwnerAuthority,
} from "../src/clubAuthority";

const OWNER = "coachOwner";
const COACH = "coachSecond";
const PLAYER = "player1";

const club = (ownerUid: unknown = OWNER) => ({ name: "AS Test", ownerUid });
const member = (role: unknown) => ({ uid: "x", role });

// ─── 1. Le predicat, cas par cas ────────────────────────────────────────────

describe("predicat d'autorite proprietaire", () => {
  it("PREDICAT VRAI : ownerUid designe ET appartenance proprietaire", () => {
    expect(resolveOwnerAuthority(club(), member(CLUB_ROLE_OWNER), OWNER)).toBe("authorized");
    expect(isClubOwnerAuthorized(club(), member(CLUB_ROLE_OWNER), OWNER)).toBe(true);
  });

  it("ownerUid SEUL (appartenance coach) : INCOHERENT, donc refus", () => {
    const authority = resolveOwnerAuthority(club(), member(CLUB_ROLE_COACH), OWNER);
    expect(authority).toBe("designation-without-membership");
    expect(isClubOwnerAuthorized(club(), member(CLUB_ROLE_COACH), OWNER)).toBe(false);
    expect(isOwnerAuthorityInconsistent(authority)).toBe(true);
  });

  it("ownerUid SEUL (aucune appartenance du tout) : INCOHERENT, donc refus", () => {
    const authority = resolveOwnerAuthority(club(), null, OWNER);
    expect(authority).toBe("designation-without-membership");
    expect(isClubOwnerAuthorized(club(), null, OWNER)).toBe(false);
  });

  it("appartenance SEULE (ownerUid designe quelqu'un d'autre) : INCOHERENT, donc refus", () => {
    const authority = resolveOwnerAuthority(club("quelquUnDAutre"), member(CLUB_ROLE_OWNER), OWNER);
    expect(authority).toBe("membership-without-designation");
    expect(isClubOwnerAuthorized(club("quelquUnDAutre"), member(CLUB_ROLE_OWNER), OWNER)).toBe(
      false,
    );
    expect(isOwnerAuthorityInconsistent(authority)).toBe(true);
  });

  it("appartenance SEULE (ownerUid absent du document club) : INCOHERENT, donc refus", () => {
    expect(resolveOwnerAuthority({ name: "AS Test" }, member(CLUB_ROLE_OWNER), OWNER)).toBe(
      "membership-without-designation",
    );
  });

  it("ni designe ni proprietaire : 'not-owner', et ce n'est PAS une incoherence", () => {
    const authority = resolveOwnerAuthority(club(), member(CLUB_ROLE_COACH), COACH);
    expect(authority).toBe("not-owner");
    expect(isOwnerAuthorityInconsistent(authority)).toBe(false);
  });

  it("aucun droit n'est accorde sur des valeurs vides des deux cotes", () => {
    // Le piege : ownerUid absent (=> null) et uid vide (=> null) ne doivent
    // JAMAIS "correspondre" par egalite de nullite.
    expect(isDesignatedOwner({ name: "AS Test" }, "")).toBe(false);
    expect(isDesignatedOwner({ ownerUid: "" }, "")).toBe(false);
    expect(isDesignatedOwner(null, OWNER)).toBe(false);
    expect(resolveOwnerAuthority({ name: "AS Test" }, null, "")).toBe("not-owner");
  });

  it("ownerUid mal type ou entoure d'espaces : lecture defensive", () => {
    expect(readOwnerUid({ ownerUid: 42 })).toBeNull();
    expect(readOwnerUid({ ownerUid: "   " })).toBeNull();
    expect(readOwnerUid({ ownerUid: `  ${OWNER}  ` })).toBe(OWNER);
    expect(isDesignatedOwner({ ownerUid: `  ${OWNER}  ` }, `  ${OWNER}  `)).toBe(true);
  });
});

// ─── 2. Elargissement de isCoach au proprietaire ────────────────────────────

describe("un proprietaire est de fait encadrant", () => {
  it("la liste d'encadrement contient owner ET coach, et rien d'autre", () => {
    expect(CLUB_STAFF_ROLES).toEqual([CLUB_ROLE_OWNER, CLUB_ROLE_COACH]);
  });

  it("owner et coach passent ; player, removed, absent et inconnu ne passent pas", () => {
    expect(isClubStaff(member(CLUB_ROLE_OWNER))).toBe(true);
    expect(isClubStaff(member(CLUB_ROLE_COACH))).toBe(true);
    expect(isClubStaff(member(CLUB_ROLE_PLAYER))).toBe(false);
    expect(isClubStaff(member(CLUB_ROLE_REMOVED))).toBe(false);
    expect(isClubStaff(member("OWNER"))).toBe(false); // casse differente = inconnu
    expect(isClubStaff({})).toBe(false);
    expect(isClubStaff(null)).toBe(false);
  });

  it("l'encadrement ne depend QUE de l'appartenance, jamais de ownerUid", () => {
    // Meme membership, deux clubs differents : le verdict d'encadrement ne bouge
    // pas. C'est ce qui rend `isClubStaff` insensible aux incoherences.
    expect(isClubStaff(member(CLUB_ROLE_OWNER))).toBe(true);
    expect(resolveOwnerAuthority(club("autre"), member(CLUB_ROLE_OWNER), OWNER)).toBe(
      "membership-without-designation",
    );
  });
});

// ─── 3. Appartenance active vs pierre tombale ───────────────────────────────

describe("appartenance active", () => {
  it("la liste active exclut explicitement la pierre tombale", () => {
    expect(CLUB_ACTIVE_ROLES).toEqual([CLUB_ROLE_OWNER, CLUB_ROLE_COACH, CLUB_ROLE_PLAYER]);
    expect(CLUB_ACTIVE_ROLES).not.toContain(CLUB_ROLE_REMOVED);
  });

  it("un membre retire n'est plus un membre actif", () => {
    expect(isActiveMembership(member(CLUB_ROLE_PLAYER))).toBe(true);
    expect(isActiveMembership(member(CLUB_ROLE_REMOVED))).toBe(false);
    expect(isActiveMembership(null)).toBe(false);
  });

  it("normalizeClubRole est default-deny sur tout ce qui n'est pas un role connu", () => {
    expect(normalizeClubRole("owner")).toBe(CLUB_ROLE_OWNER);
    expect(normalizeClubRole(" player ")).toBe(CLUB_ROLE_PLAYER);
    expect(normalizeClubRole("Player")).toBeNull();
    expect(normalizeClubRole(true)).toBeNull();
    expect(normalizeClubRole(undefined)).toBeNull();
    expect(hasOwnerMembership({ role: "owner " })).toBe(true);
    expect(hasOwnerMembership({ role: "ownerr" })).toBe(false);
  });
});

// ─── 4. Signalement d'incoherence ───────────────────────────────────────────

describe("signalement pour reparation", () => {
  it("un etat coherent ne produit AUCUN signal", () => {
    expect(
      clubAuthoritySignal({ clubId: "c1", uid: OWNER, action: "test" }, "authorized"),
    ).toBeNull();
    expect(
      clubAuthoritySignal({ clubId: "c1", uid: PLAYER, action: "test" }, "not-owner"),
    ).toBeNull();
  });

  it("les DEUX incoherences produisent un signal, et il reste pauvre", () => {
    for (const authority of [
      "designation-without-membership",
      "membership-without-designation",
    ] as const) {
      const signal = clubAuthoritySignal({ clubId: "c1", uid: OWNER, action: "geste" }, authority);
      expect(signal).toEqual({ clubId: "c1", uid: OWNER, authority, action: "geste" });
      // Rien d'autre : ni nom de club, ni role, ni donnee de membre.
      expect(Object.keys(signal ?? {}).sort()).toEqual(["action", "authority", "clubId", "uid"]);
    }
  });
});
