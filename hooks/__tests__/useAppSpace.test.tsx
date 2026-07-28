// hooks/__tests__/useAppSpace.test.tsx
//
// L'ESPACE AFFICHÉ SUIT L'AUTORITÉ SERVEUR, EN TEMPS RÉEL.
//
// Ce que ces tests protègent, dans l'ordre d'importance :
//
//  1. APRÈS UN TRANSFERT, LE NOUVEAU PROPRIÉTAIRE OBTIENT L'ESPACE COACH — sans
//     reconnexion, sans redémarrage, sans geste. C'est le défaut que ce lot
//     corrige : le serveur écrivait bien l'autorité, l'application ne la lisait
//     pas.
//  2. L'ANCIEN PROPRIÉTAIRE GARDE L'ESPACE COACH. Le transfert lui pose le rôle
//     `coach` ; il reste encadrant, et son écran doit le rester aussi.
//  3. UN CHAMP CLIENT FALSIFIÉ N'OUVRE RIEN. Un joueur qui s'écrit
//     `users/{uid}.role = "coach"` — ce que les règles Firestore l'autorisent à
//     faire sur son propre document — reste dans l'espace joueur.
//  4. DÉMARRAGE À FROID. Tant que l'appartenance n'est pas lue, la décision est
//     `en-attente` : le navigateur affiche l'écran de chargement au lieu de
//     parier sur l'espace joueur et de le faire clignoter devant un coach.
//  5. L'ABONNEMENT EST NETTOYÉ — au démontage, à la déconnexion, au changement
//     de club.

import { renderHook, actAsync } from "../coach/__tests__/hookHarness";

jest.mock("../../services/firebase", () => ({ db: {} }));

jest.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path }),
  onSnapshot: (
    ref: { path: string[] },
    next: (snap: unknown) => void,
    error: (err: unknown) => void,
  ) => mockOnSnapshot(ref, next, error),
}));

/** Abonnements ouverts, indexés par chemin de document, avec leur compteur de fermeture. */
type Abonnement = {
  chemin: string;
  emet: (role: unknown | null) => void;
  echoue: () => void;
  fermetures: number;
};

let abonnements: Abonnement[] = [];

const mockOnSnapshot = (
  ref: { path: string[] },
  next: (snap: unknown) => void,
  error: (err: unknown) => void,
) => {
  const abonnement: Abonnement = {
    chemin: ref.path.join("/"),
    emet: (role) =>
      next({
        exists: () => role !== null,
        data: () => (role === null ? undefined : { role }),
      }),
    echoue: () => error(new Error("permission-denied")),
    fermetures: 0,
  };
  abonnements.push(abonnement);
  return () => {
    abonnement.fermetures += 1;
  };
};

import { useAppSpace } from "../useAppSpace";

const dernier = () => abonnements[abonnements.length - 1];

beforeEach(() => {
  abonnements = [];
});

describe("démarrage à froid — on n'affiche pas avant de savoir", () => {
  test("membre d'un club : décision `en-attente` tant que l'appartenance n'est pas lue", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    expect(h.current.decision).toBe("en-attente");
    expect(h.current.membershipRole).toBeNull();
  });

  test("aucun club rattaché : décision immédiate, aucun abonnement posé", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: null }));
    expect(h.current.decision).toBe("player");
    expect(abonnements).toHaveLength(0);
  });

  test("déconnecté : décision immédiate, aucun abonnement posé", async () => {
    const h = await renderHook(() => useAppSpace({ uid: null, clubId: "clubX" }));
    expect(h.current.decision).toBe("player");
    expect(abonnements).toHaveLength(0);
  });

  test("l'abonnement vise SA PROPRE appartenance, et rien d'autre", async () => {
    await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    expect(dernier().chemin).toBe("clubs/clubX/members/u1");
  });

  test("premier instantané depuis le cache : propriétaire → espace coach au démarrage", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("owner"));
    expect(h.current.decision).toBe("coach");
    expect(h.current.space).toBe("coach");
    expect(h.current.membershipRole).toBe("owner");
  });
});

describe("chaque rôle ouvre — ou non — l'espace coach", () => {
  const cas: Array<[string, unknown | null, "coach" | "player"]> = [
    ["propriétaire", "owner", "coach"],
    ["coach", "coach", "coach"],
    ["joueur", "player", "player"],
    ["pierre tombale", "removed", "player"],
    ["aucune appartenance", null, "player"],
    ["rôle inconnu", "admin", "player"],
  ];

  test.each(cas)("%s → espace %s", async (_nom, role, attendu) => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet(role));
    expect(h.current.space).toBe(attendu);
    expect(h.current.decision).toBe(attendu);
  });

  test("appartenance illisible → espace joueur, et l'état est NOMMÉ", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().echoue());
    expect(h.current.space).toBe("player");
    expect(h.current.membershipUnreadable).toBe(true);
  });
});

describe("transfert de propriété — la bascule, sans reconnexion", () => {
  test("joueur devenu propriétaire : l'espace coach s'ouvre sur le même montage", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "successeur", clubId: "clubX" }));
    await actAsync(() => dernier().emet("player"));
    expect(h.current.space).toBe("player");

    // Le serveur écrit `role: "owner"` sur l'appartenance (transaction du
    // transfert). L'instantané arrive : aucun geste, aucun remontage.
    await actAsync(() => dernier().emet("owner"));
    expect(h.current.space).toBe("coach");
    expect(abonnements).toHaveLength(1); // aucun nouvel abonnement : c'est le MÊME
    expect(dernier().fermetures).toBe(0); // et il n'a pas été coupé
  });

  test("l'ancien propriétaire devient coach et CONSERVE l'espace coach", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "fondateur", clubId: "clubX" }));
    await actAsync(() => dernier().emet("owner"));
    expect(h.current.space).toBe("coach");

    await actAsync(() => dernier().emet("coach"));
    expect(h.current.space).toBe("coach");
    expect(h.current.membershipRole).toBe("coach");
  });

  test("retrait du club : l'espace coach se referme aussi vite qu'il s'est ouvert", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach"));
    expect(h.current.space).toBe("coach");

    await actAsync(() => dernier().emet("removed"));
    expect(h.current.space).toBe("player");
  });
});

describe("un champ client falsifié n'ouvre pas l'espace coach", () => {
  test("`users/{uid}.role` n'est pas un paramètre du hook", async () => {
    // Le hook ne reçoit QUE (uid, clubId). Le rôle applicatif écrit par
    // l'utilisateur sur son propre document n'a aucun chemin jusqu'ici.
    const h = await renderHook(() =>
      useAppSpace({ uid: "tricheur", clubId: "clubX" } as { uid: string | null; clubId: string | null }),
    );
    await actAsync(() => dernier().emet("player"));
    expect(h.current.space).toBe("player");
  });

  test("pointer `clubId` vers un club où l'on n'est pas membre ne donne rien", async () => {
    // `clubId` est écrivable par l'utilisateur : il dit OÙ regarder, pas QUI on
    // est. Sur un club étranger, l'appartenance n'existe pas → espace joueur.
    const h = await renderHook(() => useAppSpace({ uid: "tricheur", clubId: "clubDunAutre" }));
    expect(dernier().chemin).toBe("clubs/clubDunAutre/members/tricheur");
    await actAsync(() => dernier().emet(null));
    expect(h.current.space).toBe("player");
  });
});

describe("cycle de vie de l'abonnement", () => {
  test("démontage → abonnement fermé", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    const abonnement = dernier();
    await h.unmount();
    expect(abonnement.fermetures).toBe(1);
  });

  test("déconnexion (uid → null) → abonnement fermé, décision joueur", async () => {
    let params: { uid: string | null; clubId: string | null } = { uid: "u1", clubId: "clubX" };
    const h = await renderHook(() => useAppSpace(params));
    await actAsync(() => dernier().emet("owner"));
    expect(h.current.space).toBe("coach");
    const abonnement = dernier();

    params = { uid: null, clubId: null };
    await h.rerender();
    expect(abonnement.fermetures).toBe(1);
    expect(h.current.space).toBe("player");
  });

  test("changement de club → l'ancien abonnement est fermé, un nouveau est posé", async () => {
    let params: { uid: string | null; clubId: string | null } = { uid: "u1", clubId: "clubA" };
    const h = await renderHook(() => useAppSpace(params));
    await actAsync(() => dernier().emet("owner"));
    const ancien = dernier();

    params = { uid: "u1", clubId: "clubB" };
    await h.rerender();
    expect(ancien.fermetures).toBe(1);
    expect(dernier().chemin).toBe("clubs/clubB/members/u1");
    // Et surtout : l'espace du club précédent ne survit pas au changement.
    expect(h.current.decision).toBe("en-attente");
  });

  test("changement de compte → l'espace du compte précédent ne fuit pas", async () => {
    let params: { uid: string | null; clubId: string | null } = { uid: "coach1", clubId: "clubX" };
    const h = await renderHook(() => useAppSpace(params));
    await actAsync(() => dernier().emet("owner"));
    expect(h.current.space).toBe("coach");

    params = { uid: "joueur2", clubId: "clubX" };
    await h.rerender();
    expect(h.current.decision).toBe("en-attente");
    await actAsync(() => dernier().emet("player"));
    expect(h.current.space).toBe("player");
  });

  test("un instantané arrivé APRÈS le démontage n'écrit rien", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    const abonnement = dernier();
    await h.unmount();
    // `unsubscribe()` coupe la source ; il ne rembobine pas ce qui est en vol.
    expect(() => abonnement.emet("owner")).not.toThrow();
  });
});
