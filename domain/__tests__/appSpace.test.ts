// domain/__tests__/appSpace.test.ts
//
// LA DÉRIVATION DE L'ESPACE AFFICHÉ, rôle par rôle.
//
// Ce que ces tests protègent :
//  1. l'espace coach s'ouvre pour un ENCADREMENT réel (propriétaire ou coach du
//     club), et pour personne d'autre ;
//  2. une pierre tombale, une appartenance absente, un rôle illisible ou une
//     lecture en échec n'ouvrent RIEN (default-deny) ;
//  3. `users/{uid}.role` — le champ que l'utilisateur écrit lui-même — n'est
//     même pas un paramètre de cette fonction. C'est la preuve la plus courte
//     qu'un champ client falsifié ne peut plus ouvrir l'espace coach.

import { readMembershipRole, resolveAppSpace } from "../appSpace";

const lu = (role: unknown) => ({ statut: "lu" as const, role });

describe("resolveAppSpace — un rôle d'encadrement, et rien d'autre", () => {
  test("propriétaire → espace coach", () => {
    expect(resolveAppSpace(lu("owner"))).toBe("coach");
  });

  test("coach → espace coach (c'est l'ancien propriétaire après un transfert)", () => {
    expect(resolveAppSpace(lu("coach"))).toBe("coach");
  });

  test("joueur → espace joueur", () => {
    expect(resolveAppSpace(lu("player"))).toBe("player");
  });

  test("pierre tombale (« removed ») → espace joueur, jamais coach", () => {
    expect(resolveAppSpace(lu("removed"))).toBe("player");
  });

  test("aucune appartenance (document absent) → espace joueur", () => {
    expect(resolveAppSpace(lu(null))).toBe("player");
    expect(resolveAppSpace(lu(undefined))).toBe("player");
  });

  test("rôle inconnu, mal typé ou déguisé → espace joueur", () => {
    for (const valeur of ["OWNER", "admin", "", 42, true, {}, ["owner"]]) {
      expect(resolveAppSpace(lu(valeur))).toBe("player");
    }
  });

  test("espaces autour du rôle : même normalisation que le serveur (str() y coupe aussi)", () => {
    // Comportement HÉRITÉ de `normalizeClubRole`, partagé avec
    // functions/src/clubAuthority. Écrit ici pour qu'il soit constaté, pas
    // découvert : seul le serveur écrit ce champ, un rôle entouré d'espaces
    // n'existe donc pas en base.
    expect(resolveAppSpace(lu(" owner "))).toBe("coach");
  });

  test("appartenance illisible → espace joueur (on n'ouvre pas sur une question sans réponse)", () => {
    expect(resolveAppSpace({ statut: "illisible" })).toBe("player");
  });

  test("aucun club rattaché → espace joueur, sans attente", () => {
    expect(resolveAppSpace({ statut: "aucun-club" })).toBe("player");
  });

  test("premier instantané pas encore arrivé → en-attente (ni coach, ni joueur)", () => {
    expect(resolveAppSpace({ statut: "en-attente" })).toBe("en-attente");
  });
});

describe("le champ client `users/{uid}.role` n'est pas une entrée", () => {
  test("la signature ne l'accepte pas : seule l'appartenance décide", () => {
    // Si quelqu'un rebranchait un jour le champ client, il devrait AJOUTER un
    // paramètre — ce test tomberait sur la longueur de la signature.
    expect(resolveAppSpace).toHaveLength(1);
  });

  test("un joueur qui s'écrirait role:\"coach\" reste dans l'espace joueur", () => {
    // La seule chose lisible ici est son appartenance réelle, écrite par le
    // serveur. Le champ client n'a nulle part où entrer.
    expect(resolveAppSpace(lu("player"))).toBe("player");
  });
});

describe("readMembershipRole — dire l'état, sans ouvrir de droit", () => {
  test("normalise le rôle lu", () => {
    expect(readMembershipRole(lu("owner"))).toBe("owner");
    expect(readMembershipRole(lu("removed"))).toBe("removed");
  });

  test("null quand il n'y a rien de lu (absent, illisible, en attente, sans club)", () => {
    expect(readMembershipRole(lu("bidon"))).toBeNull();
    expect(readMembershipRole({ statut: "illisible" })).toBeNull();
    expect(readMembershipRole({ statut: "en-attente" })).toBeNull();
    expect(readMembershipRole({ statut: "aucun-club" })).toBeNull();
  });
});
