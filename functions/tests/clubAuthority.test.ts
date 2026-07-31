// functions/tests/clubAuthority.test.ts
//
// LE PREDICAT D'AUTORITE — versant SERVEUR. Tests unitaires purs, aucun
// emulateur (le module ne connait ni Firestore ni horloge).
//
// Le versant REGLES exerce les MEMES cas contre les vraies regles jouees par
// l'emulateur : firestore-tests/rules.clubAuthority.test.ts. Cette derniere
// porte EN PLUS un verrou litteral (section H) qui compare CLUB_ACCESS_ROLES
// et PLAYER_STATUS_ACTIVE aux fonctions nommees `clubAccessRoles()` /
// `activePlayerStatus()` de firestore.rules.
//
// L'invariant teste, mot pour mot : "un proprietaire est autorise uniquement si
// ownerUid le designe ET s'il possede encore une appartenance active avec le
// role proprietaire".

import {
  CLUB_ACCESS_ROLES,
  CLUB_ACCESS_ROLE_COACH,
  CLUB_ACCESS_ROLE_OWNER,
  CLUB_PLAYER_STATUSES,
  PLAYER_STATUS_ACTIVE,
  PLAYER_STATUS_INACTIVE,
  clubAuthoritySignal,
  hasOwnerMembership,
  isActiveMembership,
  isActivePlayer,
  isClubOwnerAuthorized,
  isClubStaff,
  isDesignatedOwner,
  isOwnerAuthorityInconsistent,
  normalizeAccessRole,
  normalizePlayerStatus,
  readOwnerUid,
  resolveOwnerAuthority,
} from "../src/clubAuthority";

const OWNER = "coachOwner";
const COACH = "coachSecond";
const PLAYER = "player1";

const club = (ownerUid: unknown = OWNER) => ({ name: "AS Test", ownerUid });

/**
 * Appartenance : les DEUX axes, nommes separement. Les fabriquer ensemble est
 * deliberé — c'est ce qui rend visible, dans chaque cas de test, qu'un axe ne
 * dit rien de l'autre.
 */
const member = (accessRole: unknown, playerStatus: unknown = null) => ({
  uid: "x",
  accessRole,
  playerStatus,
});
/** Joueur pur : aucune permission d'encadrement, un suivi sportif actif. */
const joueur = () => member(null, PLAYER_STATUS_ACTIVE);
/** Entraineur-joueur : LES DEUX. C'est le cas que ce modele existe pour dire. */
const entraineurJoueur = () => member(CLUB_ACCESS_ROLE_COACH, PLAYER_STATUS_ACTIVE);
/** Pierre tombale : les deux axes fermes, ecrits ensemble par le retrait. */
const tombale = () => member(null, PLAYER_STATUS_INACTIVE);

// ─── 1. Le predicat, cas par cas ────────────────────────────────────────────

describe("predicat d'autorite proprietaire", () => {
  it("PREDICAT VRAI : ownerUid designe ET appartenance proprietaire", () => {
    expect(resolveOwnerAuthority(club(), member(CLUB_ACCESS_ROLE_OWNER), OWNER)).toBe("authorized");
    expect(isClubOwnerAuthorized(club(), member(CLUB_ACCESS_ROLE_OWNER), OWNER)).toBe(true);
  });

  it("ownerUid SEUL (appartenance coach) : INCOHERENT, donc refus", () => {
    const authority = resolveOwnerAuthority(club(), member(CLUB_ACCESS_ROLE_COACH), OWNER);
    expect(authority).toBe("designation-without-membership");
    expect(isClubOwnerAuthorized(club(), member(CLUB_ACCESS_ROLE_COACH), OWNER)).toBe(false);
    expect(isOwnerAuthorityInconsistent(authority)).toBe(true);
  });

  it("ownerUid SEUL (aucune appartenance du tout) : INCOHERENT, donc refus", () => {
    const authority = resolveOwnerAuthority(club(), null, OWNER);
    expect(authority).toBe("designation-without-membership");
    expect(isClubOwnerAuthorized(club(), null, OWNER)).toBe(false);
  });

  it("appartenance SEULE (ownerUid designe quelqu'un d'autre) : INCOHERENT, donc refus", () => {
    const authority = resolveOwnerAuthority(club("quelquUnDAutre"), member(CLUB_ACCESS_ROLE_OWNER), OWNER);
    expect(authority).toBe("membership-without-designation");
    expect(isClubOwnerAuthorized(club("quelquUnDAutre"), member(CLUB_ACCESS_ROLE_OWNER), OWNER)).toBe(
      false,
    );
    expect(isOwnerAuthorityInconsistent(authority)).toBe(true);
  });

  it("appartenance SEULE (ownerUid absent du document club) : INCOHERENT, donc refus", () => {
    expect(resolveOwnerAuthority({ name: "AS Test" }, member(CLUB_ACCESS_ROLE_OWNER), OWNER)).toBe(
      "membership-without-designation",
    );
  });

  it("ni designe ni proprietaire : 'not-owner', et ce n'est PAS une incoherence", () => {
    const authority = resolveOwnerAuthority(club(), member(CLUB_ACCESS_ROLE_COACH), COACH);
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
    expect(CLUB_ACCESS_ROLES).toEqual([CLUB_ACCESS_ROLE_OWNER, CLUB_ACCESS_ROLE_COACH]);
    // "player" et "removed" n'y sont PAS, et ne peuvent plus y etre : ce ne sont
    // pas des permissions d'encadrement. C'est leur presence dans l'ancien champ
    // unique qui faisait qu'obtenir l'encadrement effacait le fait d'etre joueur.
    expect(CLUB_ACCESS_ROLES as readonly string[]).not.toContain("player");
    expect(CLUB_ACCESS_ROLES as readonly string[]).not.toContain("removed");
  });

  it("owner et coach passent ; aucune permission, valeur inconnue et absence ne passent pas", () => {
    expect(isClubStaff(member(CLUB_ACCESS_ROLE_OWNER))).toBe(true);
    expect(isClubStaff(member(CLUB_ACCESS_ROLE_COACH))).toBe(true);
    expect(isClubStaff(joueur())).toBe(false);
    expect(isClubStaff(tombale())).toBe(false);
    expect(isClubStaff(member("OWNER"))).toBe(false); // casse differente = inconnu
    expect(isClubStaff(member("player"))).toBe(false); // ancienne valeur = inconnue
    expect(isClubStaff({})).toBe(false);
    expect(isClubStaff(null)).toBe(false);
  });

  it("l'encadrement ne depend QUE de l'appartenance, jamais de ownerUid", () => {
    // Meme membership, deux clubs differents : le verdict d'encadrement ne bouge
    // pas. C'est ce qui rend `isClubStaff` insensible aux incoherences.
    expect(isClubStaff(member(CLUB_ACCESS_ROLE_OWNER))).toBe(true);
    expect(resolveOwnerAuthority(club("autre"), member(CLUB_ACCESS_ROLE_OWNER), OWNER)).toBe(
      "membership-without-designation",
    );
  });
});

// ─── 2 bis. LES DEUX AXES SONT INDEPENDANTS ─────────────────────────────────
// Le coeur de ce lot. Chaque assertion ici tomberait si l'un des deux champs
// venait a peser sur l'autre.

describe("permissions d'encadrement et statut de joueur ne se parlent pas", () => {
  it("un entraineur-joueur est encadrant ET joueur, en meme temps", () => {
    expect(isClubStaff(entraineurJoueur())).toBe(true);
    expect(isActivePlayer(entraineurJoueur())).toBe(true);
  });

  it("un proprietaire-joueur aussi : l'autorite proprietaire ne ferme aucun suivi", () => {
    const m = member(CLUB_ACCESS_ROLE_OWNER, PLAYER_STATUS_ACTIVE);
    expect(resolveOwnerAuthority(club(), m, OWNER)).toBe("authorized");
    expect(isActivePlayer(m)).toBe(true);
  });

  it("l'encadrement seul ne fabrique AUCUN suivi", () => {
    expect(isActivePlayer(member(CLUB_ACCESS_ROLE_OWNER))).toBe(false);
    expect(isActivePlayer(member(CLUB_ACCESS_ROLE_COACH))).toBe(false);
  });

  it("le suivi seul ne fabrique AUCUNE permission", () => {
    expect(isClubStaff(joueur())).toBe(false);
    expect(resolveOwnerAuthority(club("autre"), joueur(), PLAYER)).toBe("not-owner");
  });

  it("les deux listes de valeurs sont disjointes et fermees", () => {
    expect(CLUB_PLAYER_STATUSES).toEqual([PLAYER_STATUS_ACTIVE, PLAYER_STATUS_INACTIVE]);
    for (const statut of CLUB_PLAYER_STATUSES) {
      expect(CLUB_ACCESS_ROLES as readonly string[]).not.toContain(statut);
    }
  });
});

// ─── 3. Appartenance active vs pierre tombale ───────────────────────────────

describe("appartenance active", () => {
  it("appartenance active = encadrement OU suivi actif", () => {
    expect(isActiveMembership(member(CLUB_ACCESS_ROLE_OWNER))).toBe(true);
    expect(isActiveMembership(member(CLUB_ACCESS_ROLE_COACH))).toBe(true);
    expect(isActiveMembership(joueur())).toBe(true);
    expect(isActiveMembership(entraineurJoueur())).toBe(true);
  });

  it("un membre retire n'est plus un membre actif : LES DEUX axes sont fermes", () => {
    expect(isActiveMembership(tombale())).toBe(false);
    expect(isClubStaff(tombale())).toBe(false);
    expect(isActivePlayer(tombale())).toBe(false);
    expect(isActiveMembership(null)).toBe(false);
    expect(isActiveMembership({ uid: "x" })).toBe(false); // les deux champs absents
  });

  it("fermer UN SEUL axe ne suffit pas a retirer quelqu'un — et c'est voulu", () => {
    // Un retrait qui n'ecrirait que `accessRole: null` laisserait le suivi
    // projete vers un club qu'on vient de quitter. La suite `clubMembers.test`
    // verifie que le retrait reel ecrit bien les deux.
    expect(isActiveMembership(member(null, PLAYER_STATUS_ACTIVE))).toBe(true);
    expect(isActiveMembership(member(CLUB_ACCESS_ROLE_COACH, PLAYER_STATUS_INACTIVE))).toBe(true);
  });

  it("les deux normalisations sont default-deny", () => {
    expect(normalizeAccessRole("owner")).toBe(CLUB_ACCESS_ROLE_OWNER);
    expect(normalizeAccessRole(" coach ")).toBe(CLUB_ACCESS_ROLE_COACH);
    expect(normalizeAccessRole("Owner")).toBeNull();
    expect(normalizeAccessRole("player")).toBeNull();
    expect(normalizeAccessRole("removed")).toBeNull();
    expect(normalizeAccessRole(true)).toBeNull();
    expect(normalizeAccessRole(undefined)).toBeNull();
    expect(normalizeAccessRole(null)).toBeNull();

    expect(normalizePlayerStatus(" active ")).toBe(PLAYER_STATUS_ACTIVE);
    expect(normalizePlayerStatus("Active")).toBeNull();
    expect(normalizePlayerStatus("player")).toBeNull();
    expect(normalizePlayerStatus(true)).toBeNull();
    expect(normalizePlayerStatus(null)).toBeNull();

    expect(hasOwnerMembership({ accessRole: "owner " })).toBe(true);
    expect(hasOwnerMembership({ accessRole: "ownerr" })).toBe(false);
    // L'ANCIEN CHAMP N'OUVRE PLUS RIEN. Aucun chemin de compatibilite n'a ete
    // ecrit (la base a ete videe le 21/07) : un document qui le porterait encore
    // serait lu comme "aucune permission, aucun suivi".
    expect(hasOwnerMembership({ role: "owner" })).toBe(false);
    expect(isClubStaff({ role: "coach" })).toBe(false);
    expect(isActivePlayer({ role: "player" })).toBe(false);
    expect(isActiveMembership({ role: "player" })).toBe(false);
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
