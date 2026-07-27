// domain/__tests__/clubRoles.test.ts
//
// LE PRÉDICAT D'AUTORITÉ — troisième copie, celle qui n'accorde AUCUN droit.
//
// Ce module ne protège rien : il sert à ce que l'écran dise la vérité. On le
// teste quand même, et sur les MÊMES cas que les deux autres
// (functions/tests/clubAuthority.test.ts et
// firestore-tests/rules.clubAuthority.test.ts), parce qu'un écran désaligné du
// serveur produit soit une erreur inexpliquée, soit une fonction cachée qui
// marchait très bien.

import {
  CLUB_ACTIVE_ROLES,
  CLUB_ROLE_COACH,
  CLUB_ROLE_OWNER,
  CLUB_ROLE_PLAYER,
  CLUB_ROLE_REMOVED,
  CLUB_STAFF_ROLES,
  clubOwnerInconsistencyCopy,
  isActiveClubRole,
  isClubOwnerAuthorityInconsistent,
  isClubStaffRole,
  normalizeClubRole,
  resolveClubOwnerAuthority,
} from "../clubRoles";

const OWNER = "uidOwner";

describe("prédicat d'autorité — mêmes verdicts que le serveur", () => {
  test("PRÉDICAT VRAI : désignation ET appartenance propriétaire", () => {
    expect(resolveClubOwnerAuthority({ ownerUid: OWNER, myRole: "owner", uid: OWNER })).toBe(
      "authorized",
    );
  });

  test("ownerUid SEUL : incohérent", () => {
    expect(resolveClubOwnerAuthority({ ownerUid: OWNER, myRole: "coach", uid: OWNER })).toBe(
      "designation-without-membership",
    );
    expect(resolveClubOwnerAuthority({ ownerUid: OWNER, myRole: null, uid: OWNER })).toBe(
      "designation-without-membership",
    );
  });

  test("appartenance SEULE : incohérent", () => {
    expect(resolveClubOwnerAuthority({ ownerUid: "autre", myRole: "owner", uid: OWNER })).toBe(
      "membership-without-designation",
    );
    expect(resolveClubOwnerAuthority({ ownerUid: null, myRole: "owner", uid: OWNER })).toBe(
      "membership-without-designation",
    );
  });

  test("coach ordinaire : 'not-owner', et ce n'est PAS une anomalie", () => {
    const verdict = resolveClubOwnerAuthority({ ownerUid: OWNER, myRole: "coach", uid: "coach2" });
    expect(verdict).toBe("not-owner");
    expect(isClubOwnerAuthorityInconsistent(verdict)).toBe(false);
  });

  test("valeurs vides des deux côtés : aucun droit inventé", () => {
    expect(resolveClubOwnerAuthority({ ownerUid: null, myRole: null, uid: null })).toBe("not-owner");
    expect(resolveClubOwnerAuthority({ ownerUid: "", myRole: "player", uid: "" })).toBe("not-owner");
  });
});

describe("rôles", () => {
  test("l'encadrement contient owner ET coach", () => {
    expect(CLUB_STAFF_ROLES).toEqual([CLUB_ROLE_OWNER, CLUB_ROLE_COACH]);
    expect(isClubStaffRole("owner")).toBe(true);
    expect(isClubStaffRole("coach")).toBe(true);
    expect(isClubStaffRole("player")).toBe(false);
    expect(isClubStaffRole("removed")).toBe(false);
  });

  test("l'appartenance active exclut la pierre tombale", () => {
    expect(CLUB_ACTIVE_ROLES).toEqual([CLUB_ROLE_OWNER, CLUB_ROLE_COACH, CLUB_ROLE_PLAYER]);
    expect(isActiveClubRole(CLUB_ROLE_PLAYER)).toBe(true);
    expect(isActiveClubRole(CLUB_ROLE_REMOVED)).toBe(false);
  });

  test("default-deny sur toute valeur inconnue", () => {
    expect(normalizeClubRole("Owner")).toBeNull();
    expect(normalizeClubRole(" player ")).toBe(CLUB_ROLE_PLAYER);
    expect(normalizeClubRole(3)).toBeNull();
    expect(isActiveClubRole(undefined)).toBe(false);
  });
});

describe("ce que l'écran dit d'une incohérence", () => {
  test("aucun texte sur un état cohérent", () => {
    expect(clubOwnerInconsistencyCopy("authorized")).toBeNull();
    expect(clubOwnerInconsistencyCopy("not-owner")).toBeNull();
  });

  test("les deux incohérences nomment le CONSTAT, ce qui est fermé, et le geste", () => {
    for (const authority of [
      "designation-without-membership",
      "membership-without-designation",
    ] as const) {
      const copie = clubOwnerInconsistencyCopy(authority);
      expect(copie).not.toBeNull();
      expect(copie?.titre).toBe("Club à réparer");
      // Le bandeau reste court (il est borné à 3 lignes à l'écran) ; la version
      // longue vit dans `details`.
      expect((copie?.corps ?? "").length).toBeLessThan(180);
      expect(copie?.details.length).toBeGreaterThan(copie?.corps.length ?? 0);
      expect(copie?.details).toContain("support FKS");
      // On ne dramatise pas : rien n'est perdu, et on le dit.
      expect(copie?.details).toContain("Aucune donnée n'a été perdue");
    }
  });

  test("les deux textes ne racontent PAS la même chose (le constat diffère)", () => {
    const a = clubOwnerInconsistencyCopy("designation-without-membership");
    const b = clubOwnerInconsistencyCopy("membership-without-designation");
    expect(a?.corps).not.toBe(b?.corps);
  });
});
