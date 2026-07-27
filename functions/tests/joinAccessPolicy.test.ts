// functions/tests/joinAccessPolicy.test.ts
//
// POLITIQUE D'ACCES COACH PAR CLUB — module serveur pur.
//
// Ce que cette suite verrouille :
//  1. les deux modes existent, et seulement ces deux-la ;
//  2. le DEFAUT est defini COTE SERVEUR et s'applique a toute configuration
//     absente, vide, inconnue ou mal typee — sans qu'aucun front n'ait son mot
//     a dire (ce fichier n'importe rien du front, et le module teste non plus) ;
//  3. le passage politique -> etat pose au rattachement ;
//  4. la NON-CONTAMINATION : retirer le verrou d'age n'a pas assoupli le
//     default-deny sur les VALEURS de `coachAccess`.

import {
  clubJoinAccessPolicy,
  JOIN_ACCESS_POLICIES,
  JOIN_ACCESS_POLICY_FIELD,
  DEFAULT_JOIN_ACCESS_POLICY,
  normalizeJoinAccessPolicy,
  resolveJoinAccessPolicy,
} from "../src/joinAccessPolicy";
import {
  initialCoachAccess,
  isCoachAccessGranted,
  resolveCoachAccess,
} from "../src/coachAccess";

// ─── 1. Le vocabulaire ──────────────────────────────────────────────────────

describe("vocabulaire de la politique", () => {
  it("exactement deux modes, dans l'ordre arrete", () => {
    expect(JOIN_ACCESS_POLICIES).toEqual(["automatic_safe_projection", "approval_required"]);
    expect(JOIN_ACCESS_POLICY_FIELD).toBe("joinAccessPolicy");
  });

  it("le mode alternatif approval_required EXISTE, meme s'il n'est active nulle part", () => {
    // Il est cable et teste des maintenant : le jour ou un club le demande, il
    // n'y a rien a ecrire, juste un champ a poser.
    expect(normalizeJoinAccessPolicy("approval_required")).toBe("approval_required");
    expect(initialCoachAccess("approval_required")).toBe("pending");
  });
});

// ─── 2. Le defaut, cote serveur ─────────────────────────────────────────────

describe("defaut serveur — defini ici, teste ici, sans le front", () => {
  it("le defaut est automatic_safe_projection", () => {
    expect(DEFAULT_JOIN_ACCESS_POLICY).toBe("automatic_safe_projection");
  });

  it("toute configuration ABSENTE, vide, inconnue ou mal typee retombe sur le defaut", () => {
    const valeurs: unknown[] = [
      undefined,
      null,
      "",
      "   ",
      "AUTOMATIC_SAFE_PROJECTION", // la casse compte : c'est un jeton
      "Approval_Required",
      "automatic",
      "auto",
      "approval",
      "strict",
      true,
      false,
      0,
      1,
      {},
      [],
      ["approval_required"],
      { mode: "approval_required" },
    ];
    for (const v of valeurs) {
      expect(normalizeJoinAccessPolicy(v)).toBeNull();
      expect(resolveJoinAccessPolicy(v)).toBe("automatic_safe_projection");
    }
  });

  it("une valeur reconnue est respectee, espaces autour compris", () => {
    expect(resolveJoinAccessPolicy("approval_required")).toBe("approval_required");
    expect(resolveJoinAccessPolicy("  approval_required  ")).toBe("approval_required");
    expect(resolveJoinAccessPolicy("automatic_safe_projection")).toBe(
      "automatic_safe_projection",
    );
  });

  it("document club absent, vide, ou sans le champ -> defaut", () => {
    expect(clubJoinAccessPolicy(null)).toBe("automatic_safe_projection");
    expect(clubJoinAccessPolicy(undefined)).toBe("automatic_safe_projection");
    expect(clubJoinAccessPolicy({})).toBe("automatic_safe_projection");
    expect(clubJoinAccessPolicy({ name: "AS Test", ownerUid: "c1" })).toBe(
      "automatic_safe_projection",
    );
    expect(clubJoinAccessPolicy({ joinAccessPolicy: "approval_required" })).toBe(
      "approval_required",
    );
  });
});

// ─── 3. Politique -> etat pose au rattachement ──────────────────────────────

describe("initialCoachAccess — la politique, et RIEN d'autre", () => {
  it("automatic_safe_projection -> not_required", () => {
    expect(initialCoachAccess("automatic_safe_projection")).toBe("not_required");
  });

  it("approval_required -> pending", () => {
    expect(initialCoachAccess("approval_required")).toBe("pending");
  });

  it("politique absente / invalide -> defaut, donc not_required", () => {
    for (const v of [undefined, null, "", "  ", "bidon", 42, {}, true]) {
      expect(initialCoachAccess(v)).toBe("not_required");
    }
  });

  it("ne produit JAMAIS approved ni revoked", () => {
    for (const v of [
      "automatic_safe_projection",
      "approval_required",
      undefined,
      null,
      "",
      "bidon",
      {},
    ]) {
      const etat = initialCoachAccess(v);
      expect(etat).not.toBe("approved");
      expect(etat).not.toBe("revoked");
    }
  });
});

// ─── 4. Non-contamination : le default-deny sur les VALEURS est intact ──────

describe("le defaut de la POLITIQUE n'assouplit pas le default-deny de l'ETAT", () => {
  it("une valeur de coachAccess inconnue REFUSE toujours", () => {
    for (const v of [undefined, null, "", "   ", "APPROVED", "Approved", "ok", true, 1, {}, []]) {
      expect(isCoachAccessGranted(v)).toBe(false);
    }
  });

  it("resolveCoachAccess conserve TOUT etat valide, dans les DEUX modes", () => {
    // C'est ce qui empeche un changement de politique de reevaluer en silence
    // les membres deja rattaches.
    for (const politique of ["automatic_safe_projection", "approval_required", undefined]) {
      for (const etat of ["pending", "approved", "revoked", "not_required"] as const) {
        expect(resolveCoachAccess(etat, politique)).toBe(etat);
      }
    }
  });

  it("resolveCoachAccess ne pose l'etat de la politique QUE sur une valeur illisible", () => {
    for (const pourri of [undefined, null, "", "   ", "APPROVED", true, 1, {}]) {
      expect(resolveCoachAccess(pourri, "approval_required")).toBe("pending");
      expect(resolveCoachAccess(pourri, "automatic_safe_projection")).toBe("not_required");
      expect(resolveCoachAccess(pourri, "n'importe quoi")).toBe("not_required");
    }
  });

  it("resolveCoachAccess ne fabrique JAMAIS approved", () => {
    const etats: unknown[] = ["pending", "not_required", "revoked", "", undefined, null, "bidon"];
    const politiques: unknown[] = [
      "automatic_safe_projection",
      "approval_required",
      undefined,
      "bidon",
      {},
    ];
    for (const e of etats) {
      for (const p of politiques) {
        expect(resolveCoachAccess(e, p)).not.toBe("approved");
      }
    }
  });
});
