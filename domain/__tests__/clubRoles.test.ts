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
  CLUB_ACCESS_ROLES,
  CLUB_ACCESS_ROLE_COACH,
  CLUB_ACCESS_ROLE_OWNER,
  CLUB_PLAYER_STATUSES,
  PLAYER_STATUS_ACTIVE,
  PLAYER_STATUS_INACTIVE,
  clubMembershipCopy,
  clubOwnerInconsistencyCopy,
  isActiveClubMembership,
  isActivePlayerStatus,
  isClubOwnerAuthorityInconsistent,
  isClubStaffRole,
  normalizeAccessRole,
  normalizePlayerStatus,
  resolveClubOwnerAuthority,
} from "../clubRoles";

const OWNER = "uidOwner";

describe("prédicat d'autorité — mêmes verdicts que le serveur", () => {
  test("PRÉDICAT VRAI : désignation ET appartenance propriétaire", () => {
    expect(resolveClubOwnerAuthority({ ownerUid: OWNER, myAccessRole: "owner", uid: OWNER })).toBe(
      "authorized",
    );
  });

  test("ownerUid SEUL : incohérent", () => {
    expect(resolveClubOwnerAuthority({ ownerUid: OWNER, myAccessRole: "coach", uid: OWNER })).toBe(
      "designation-without-membership",
    );
    expect(resolveClubOwnerAuthority({ ownerUid: OWNER, myAccessRole: null, uid: OWNER })).toBe(
      "designation-without-membership",
    );
  });

  test("appartenance SEULE : incohérent", () => {
    expect(resolveClubOwnerAuthority({ ownerUid: "autre", myAccessRole: "owner", uid: OWNER })).toBe(
      "membership-without-designation",
    );
    expect(resolveClubOwnerAuthority({ ownerUid: null, myAccessRole: "owner", uid: OWNER })).toBe(
      "membership-without-designation",
    );
  });

  test("coach ordinaire : 'not-owner', et ce n'est PAS une anomalie", () => {
    const verdict = resolveClubOwnerAuthority({ ownerUid: OWNER, myAccessRole: "coach", uid: "coach2" });
    expect(verdict).toBe("not-owner");
    expect(isClubOwnerAuthorityInconsistent(verdict)).toBe(false);
  });

  test("valeurs vides des deux côtés : aucun droit inventé", () => {
    expect(resolveClubOwnerAuthority({ ownerUid: null, myAccessRole: null, uid: null })).toBe("not-owner");
    expect(resolveClubOwnerAuthority({ ownerUid: "", myAccessRole: "player", uid: "" })).toBe("not-owner");
  });
});

describe("les deux axes", () => {
  test("l'encadrement contient owner ET coach, et RIEN de l'axe joueur", () => {
    expect(CLUB_ACCESS_ROLES).toEqual([CLUB_ACCESS_ROLE_OWNER, CLUB_ACCESS_ROLE_COACH]);
    expect(isClubStaffRole("owner")).toBe(true);
    expect(isClubStaffRole("coach")).toBe(true);
    // Les anciennes valeurs du champ unique ne sont plus des permissions.
    expect(isClubStaffRole("player")).toBe(false);
    expect(isClubStaffRole("removed")).toBe(false);
  });

  test("le statut de joueur est un axe SÉPARÉ, à deux valeurs", () => {
    expect(CLUB_PLAYER_STATUSES).toEqual([PLAYER_STATUS_ACTIVE, PLAYER_STATUS_INACTIVE]);
    expect(isActivePlayerStatus(PLAYER_STATUS_ACTIVE)).toBe(true);
    expect(isActivePlayerStatus(PLAYER_STATUS_INACTIVE)).toBe(false);
    // Et il n'ouvre AUCUNE permission d'encadrement.
    expect(isClubStaffRole(PLAYER_STATUS_ACTIVE)).toBe(false);
  });

  test("appartenance active = encadrement OU suivi ; la pierre tombale n'en est pas une", () => {
    expect(isActiveClubMembership({ accessRole: "coach", playerStatus: null })).toBe(true);
    expect(isActiveClubMembership({ accessRole: null, playerStatus: "active" })).toBe(true);
    expect(isActiveClubMembership({ accessRole: "coach", playerStatus: "active" })).toBe(true);
    expect(isActiveClubMembership({ accessRole: null, playerStatus: "inactive" })).toBe(false);
    expect(isActiveClubMembership({ accessRole: null, playerStatus: null })).toBe(false);
  });

  test("default-deny sur toute valeur inconnue, des deux côtés", () => {
    expect(normalizeAccessRole("Owner")).toBeNull();
    expect(normalizeAccessRole(" coach ")).toBe(CLUB_ACCESS_ROLE_COACH);
    expect(normalizeAccessRole(3)).toBeNull();
    expect(normalizePlayerStatus(" active ")).toBe(PLAYER_STATUS_ACTIVE);
    expect(normalizePlayerStatus("Active")).toBeNull();
    expect(normalizePlayerStatus(undefined)).toBeNull();
    // L'ANCIEN champ n'ouvre plus rien : aucun chemin de compatibilité n'existe.
    expect(isActiveClubMembership({ accessRole: undefined, playerStatus: undefined })).toBe(false);
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

// ─── Ce que l'écran d'un membre dit de sa propre appartenance ───────────────
//
// Ajouté avec le transfert de propriété : un JOUEUR peut désormais devenir
// propriétaire, tout en gardant l'application joueur. La carte « Mon club » lui
// proposait « Quitter le club » — un geste que les règles refusent au
// propriétaire, et dont l'échec s'affichait en « Réessaie ». Un conseil faux.

describe("appartenance affichée au membre", () => {
  const copieDe = (accessRole: unknown, playerStatus: unknown = null) =>
    clubMembershipCopy({ accessRole, playerStatus });

  test("le PROPRIÉTAIRE ne se voit pas proposer de quitter le club, et sait pourquoi", () => {
    const copie = copieDe(CLUB_ACCESS_ROLE_OWNER);
    expect(copie.peutQuitter).toBe(false);
    expect(copie.badge).toBe("Propriétaire");
    expect(copie.statut).toBe("Propriétaire du club");
    // Le texte NOMME le geste à faire, il ne dit pas seulement « impossible ».
    expect(copie.empechement).toContain("transférée");
    expect(copie.empechement).toContain("support FKS");
  });

  test("l'ENCADRANT et le JOUEUR peuvent partir, sans texte d'empêchement", () => {
    for (const copie of [copieDe(CLUB_ACCESS_ROLE_COACH), copieDe(null, PLAYER_STATUS_ACTIVE)]) {
      expect(copie.peutQuitter).toBe(true);
      expect(copie.empechement).toBeNull();
    }
    expect(copieDe(CLUB_ACCESS_ROLE_COACH).badge).toBe("Encadrant");
    expect(copieDe(null, PLAYER_STATUS_ACTIVE).badge).toBe("Joueur");
  });

  test("L'ENTRAÎNEUR-JOUEUR est nommé pour ce qu'il est : les DEUX", () => {
    // Dire « Encadrant » à quelqu'un qui joue aussi serait la demi-vérité que ce
    // lot supprime du modèle de données ; on ne la réintroduit pas à l'écran.
    const coachJoueur = copieDe(CLUB_ACCESS_ROLE_COACH, PLAYER_STATUS_ACTIVE);
    expect(coachJoueur.badge).toBe("Encadrant-joueur");
    expect(coachJoueur.statut).toContain("joueur de l'effectif");
    expect(coachJoueur.peutQuitter).toBe(true);

    const proprioJoueur = copieDe(CLUB_ACCESS_ROLE_OWNER, PLAYER_STATUS_ACTIVE);
    expect(proprioJoueur.badge).toBe("Propriétaire-joueur");
    // Le propriétaire reste bloqué pour le départ, jouer n'y change rien.
    expect(proprioJoueur.peutQuitter).toBe(false);
  });

  test("des valeurs ABSENTES ou illisibles retombent sur l'affichage neutre de membre", () => {
    // Une lecture ratée ne doit jamais se transformer en affirmation. Le serveur
    // reste seul juge du départ ; l'écran ne fait que ne pas mentir.
    for (const valeur of [null, undefined, "", "  ", 42, { accessRole: "owner" }, "OWNER"]) {
      const copie = copieDe(valeur, valeur);
      expect(copie.peutQuitter).toBe(true);
      expect(copie.badge).toBe("Membre");
      expect(copie.empechement).toBeNull();
    }
  });

  test("la pierre tombale n'affiche aucun statut particulier", () => {
    // Elle ne devrait pas être visible ici (le serveur remet `clubId` à null),
    // mais si elle l'était, elle ne doit rien promettre.
    const copie = copieDe(null, PLAYER_STATUS_INACTIVE);
    expect(copie.badge).toBe("Membre");
    expect(copie.peutQuitter).toBe(true);
  });
});
