// domain/__tests__/appSpace.test.ts
//
// LA DÉRIVATION DE L'ESPACE AFFICHÉ, axe par axe.
//
// Ce que ces tests protègent :
//  1. l'espace coach s'ouvre pour un ENCADREMENT réel (propriétaire ou coach du
//     club), et pour personne d'autre ;
//  2. l'espace joueur reste ouvert à quelqu'un qui a un SUIVI SPORTIF, même s'il
//     encadre — c'est l'entraîneur-joueur, et c'est le cœur de ce lot ;
//  3. une pierre tombale, une appartenance absente, une valeur illisible ou une
//     lecture en échec n'ouvrent RIEN de plus (default-deny) ;
//  4. la PRÉFÉRENCE locale ne fait que choisir entre deux espaces DÉJÀ ouverts —
//     elle n'en ouvre jamais un ;
//  5. `users/{uid}.role` — le champ que l'utilisateur écrit lui-même — n'est même
//     pas un paramètre de ces fonctions. C'est la preuve la plus courte qu'un
//     champ client falsifié ne peut plus ouvrir l'espace coach.

import { espacesDisponibles, readMembershipAccessRole, resolveAppSpace } from "../appSpace";

/** Lecture aboutie : les DEUX axes, toujours nommés ensemble. */
const lu = (accessRole: unknown, playerStatus: unknown = null) => ({
  statut: "lu" as const,
  accessRole,
  playerStatus,
});

describe("resolveAppSpace — l'encadrement ouvre le coach, le suivi ouvre le joueur", () => {
  test("propriétaire (sans suivi) → espace coach", () => {
    expect(resolveAppSpace(lu("owner"))).toBe("coach");
  });

  test("coach (sans suivi) → espace coach (c'est l'ancien propriétaire après un transfert)", () => {
    expect(resolveAppSpace(lu("coach"))).toBe("coach");
  });

  test("joueur → espace joueur", () => {
    expect(resolveAppSpace(lu(null, "active"))).toBe("player");
  });

  test("pierre tombale (les deux axes fermés) → espace joueur, jamais coach", () => {
    expect(resolveAppSpace(lu(null, "inactive"))).toBe("player");
  });

  test("aucune appartenance (document absent) → espace joueur", () => {
    expect(resolveAppSpace(lu(null, null))).toBe("player");
    expect(resolveAppSpace(lu(undefined, undefined))).toBe("player");
  });

  test("valeur inconnue, mal typée ou déguisée → espace joueur", () => {
    for (const valeur of ["OWNER", "admin", "player", "", 42, true, {}, ["owner"]]) {
      expect(resolveAppSpace(lu(valeur))).toBe("player");
    }
  });

  test("espaces autour de la valeur : même normalisation que le serveur", () => {
    // Comportement HÉRITÉ de `normalizeAccessRole`, partagé avec
    // functions/src/clubAuthority. Écrit ici pour qu'il soit constaté, pas
    // découvert : seul le serveur écrit ce champ, une valeur entourée d'espaces
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

// ─── L'ENTRAÎNEUR-JOUEUR : LES DEUX ESPACES ────────────────────────────────

describe("espacesDisponibles — qui a droit à quoi", () => {
  test("un joueur n'a QUE l'espace joueur", () => {
    expect(espacesDisponibles(lu(null, "active"))).toEqual({ coach: false, joueur: true });
  });

  test("un encadrant SANS suivi n'a QUE l'espace coach", () => {
    expect(espacesDisponibles(lu("coach"))).toEqual({ coach: true, joueur: false });
    expect(espacesDisponibles(lu("owner"))).toEqual({ coach: true, joueur: false });
  });

  test("un ENTRAÎNEUR-JOUEUR a les DEUX", () => {
    expect(espacesDisponibles(lu("coach", "active"))).toEqual({ coach: true, joueur: true });
    expect(espacesDisponibles(lu("owner", "active"))).toEqual({ coach: true, joueur: true });
  });

  test("un encadrant dont le suivi a été désactivé n'a plus que l'espace coach", () => {
    expect(espacesDisponibles(lu("coach", "inactive"))).toEqual({ coach: true, joueur: false });
  });

  test("sans réponse (attente, panne, aucun club) : l'espace joueur seul, jamais le coach", () => {
    for (const lecture of [
      { statut: "en-attente" as const },
      { statut: "illisible" as const },
      { statut: "aucun-club" as const },
    ]) {
      expect(espacesDisponibles(lecture)).toEqual({ coach: false, joueur: true });
    }
  });
});

// ─── LA PRÉFÉRENCE CHOISIT, ELLE N'OUVRE JAMAIS ────────────────────────────

describe("la préférence locale ne fait que choisir entre deux espaces autorisés", () => {
  test("les deux ouverts : la préférence décide", () => {
    expect(resolveAppSpace(lu("coach", "active"), "player")).toBe("player");
    expect(resolveAppSpace(lu("coach", "active"), "coach")).toBe("coach");
  });

  test("les deux ouverts, aucune préférence : défaut « coach », pour que le gain se VOIE", () => {
    expect(resolveAppSpace(lu("owner", "active"), null)).toBe("coach");
    expect(resolveAppSpace(lu("owner", "active"))).toBe("coach");
  });

  test("les deux ouverts, préférence pas encore lue : on attend plutôt que de parier", () => {
    expect(resolveAppSpace(lu("coach", "active"), "en-attente")).toBe("en-attente");
  });

  test("LE PIÈGE : perdre l'encadrement bascule vers joueur MÊME si la préférence dit coach", () => {
    // C'est la propriété qui rend la mémoire locale inoffensive : elle ne peut
    // pas maintenir ouvert un espace que le serveur vient de fermer.
    expect(resolveAppSpace(lu(null, "active"), "coach")).toBe("player");
    expect(resolveAppSpace(lu(null, "inactive"), "coach")).toBe("player");
    expect(resolveAppSpace({ statut: "illisible" }, "coach")).toBe("player");
    expect(resolveAppSpace({ statut: "aucun-club" }, "coach")).toBe("player");
  });

  test("... et l'inverse : un encadrant sans suivi reste coach même si la préférence dit joueur", () => {
    expect(resolveAppSpace(lu("coach"), "player")).toBe("coach");
    expect(resolveAppSpace(lu("owner"), "player")).toBe("coach");
  });

  test("une préférence n'est JAMAIS attendue quand un seul espace est ouvert", () => {
    // Sans ça, un joueur ordinaire et un coach ordinaire verraient l'écran de
    // chargement le temps d'une lecture de stockage local, pour rien.
    expect(resolveAppSpace(lu(null, "active"), "en-attente")).toBe("player");
    expect(resolveAppSpace(lu("coach"), "en-attente")).toBe("coach");
  });
});

describe("le champ client `users/{uid}.role` n'est pas une entrée", () => {
  test("un joueur qui s'écrirait role:\"coach\" reste dans l'espace joueur", () => {
    // La seule chose lisible ici est son appartenance réelle, écrite par le
    // serveur. Le champ client n'a nulle part où entrer : il n'est pas un
    // paramètre, donc il ne peut pas peser sur le résultat.
    expect(resolveAppSpace(lu(null, "active"))).toBe("player");
    expect(espacesDisponibles(lu(null, "active")).coach).toBe(false);
  });
});

describe("readMembershipAccessRole — dire l'état, sans ouvrir de droit", () => {
  test("normalise la permission lue", () => {
    expect(readMembershipAccessRole(lu("owner"))).toBe("owner");
    expect(readMembershipAccessRole(lu("coach", "active"))).toBe("coach");
  });

  test("null quand il n'y a rien de lu (absent, illisible, en attente, sans club)", () => {
    expect(readMembershipAccessRole(lu("bidon"))).toBeNull();
    expect(readMembershipAccessRole(lu(null, "active"))).toBeNull();
    expect(readMembershipAccessRole({ statut: "illisible" })).toBeNull();
    expect(readMembershipAccessRole({ statut: "en-attente" })).toBeNull();
    expect(readMembershipAccessRole({ statut: "aucun-club" })).toBeNull();
  });
});
