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
//
// ─── CE QUE LE LOT « PURGE » AJOUTE ─────────────────────────────────────────
//  6. QUATRE ÉTATS, PAS DEUX. `illisible` ne se fond plus dans « espace joueur » :
//     il devient `indetermine`, qui FERME l'espace coach et PURGE, exactement
//     comme un refus. Sans ça, couper le réseau figerait un accès révoqué.
//  7. REVALIDATION AU RETOUR AU PREMIER PLAN. L'abonnement est reposé, l'état
//     repasse par `chargement` (donc purge, donc pas d'espace coach), et rien
//     n'est réaffiché avant confirmation. Une revalidation qui n'aboutit pas
//     tombe en `indetermine` — jamais en « on garde ce qu'on avait ».
//  8. PAS DE PURGE INTEMPESTIVE. Une bascule d'écran passagère (`inactive`), un
//     re-rendu, un instantané identique : rien ne bouge.

import { AppState, type AppStateStatus } from "react-native";

import { renderHook, actAsync } from "../coach/__tests__/hookHarness";
import {
  canCommitCoachData,
  currentCoachAuthorityToken,
  onCoachDataPurge,
  readCoachAuthority,
  resetCoachAuthorityGateForTests,
  type CoachPurgeRaison,
} from "../../state/coachAuthorityGate";

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
  /** Emet un instantane d appartenance : les DEUX axes, comme le vrai document. */
  emet: (accessRole: unknown | null, playerStatus?: unknown | null) => void;
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
    emet: (accessRole, playerStatus = null) =>
      next({
        // Document ABSENT si les deux axes sont vides : c est l etat "aucune
        // appartenance", distinct d une appartenance qui n ouvre rien.
        exists: () => accessRole !== null || playerStatus !== null,
        data: () =>
          accessRole === null && playerStatus === null ? undefined : { accessRole, playerStatus },
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

// ─── Cycle de vie de l'application, piloté par le test ──────────────────────
// On espionne le vrai `AppState` plutôt que de remplacer tout `react-native` :
// le hook n'en utilise qu'une fonction, et un module entier remplacé casserait
// tout le reste du graphe d'import sans rien prouver de plus.
let ecouteursAppState: Array<(etat: AppStateStatus) => void> = [];
let espionAppState: jest.SpyInstance;

/** Rejoue une bascule de cycle de vie sur tous les abonnés vivants. */
const bascule = async (...etats: AppStateStatus[]) => {
  await actAsync(() => {
    for (const etat of etats) {
      for (const ecouteur of [...ecouteursAppState]) ecouteur(etat);
    }
  });
};

/** Purges observées depuis le début du test. */
let purges: CoachPurgeRaison[] = [];

beforeEach(() => {
  abonnements = [];
  ecouteursAppState = [];
  purges = [];
  resetCoachAuthorityGateForTests();
  onCoachDataPurge((raison) => purges.push(raison));
  espionAppState = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation(((_type: string, cb: (etat: AppStateStatus) => void) => {
      ecouteursAppState.push(cb);
      return {
        remove: () => {
          ecouteursAppState = ecouteursAppState.filter((e) => e !== cb);
        },
      };
    }) as unknown as typeof AppState.addEventListener);
});

afterEach(() => {
  espionAppState.mockRestore();
});

describe("démarrage à froid — on n'affiche pas avant de savoir", () => {
  test("membre d'un club : décision `en-attente` tant que l'appartenance n'est pas lue", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    expect(h.current.decision).toBe("en-attente");
    expect(h.current.membershipAccessRole).toBeNull();
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
    expect(h.current.membershipAccessRole).toBe("owner");
  });
});

describe("chaque appartenance ouvre — ou non — l'espace coach", () => {
  // Les DEUX axes, cas par cas. `null` sur les deux = document absent.
  const cas: Array<[string, unknown | null, unknown | null, "coach" | "player"]> = [
    ["propriétaire", "owner", null, "coach"],
    ["coach", "coach", null, "coach"],
    ["joueur", null, "active", "player"],
    ["pierre tombale (les deux fermés)", null, "inactive", "player"],
    ["aucune appartenance", null, null, "player"],
    ["permission inconnue", "admin", null, "player"],
    // L'ENTRAÎNEUR-JOUEUR : les deux espaces sont ouverts, et sans préférence
    // mémorisée on atterrit sur coach — pour que le gain se voie.
    ["entraîneur-joueur (défaut)", "coach", "active", "coach"],
    ["propriétaire-joueur (défaut)", "owner", "active", "coach"],
  ];

  test.each(cas)("%s → espace %s", async (_nom, accessRole, playerStatus, attendu) => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet(accessRole, playerStatus));
    expect(h.current.space).toBe(attendu);
    expect(h.current.decision).toBe(attendu);
  });

  test("le sélecteur n'est proposé QU'À qui a réellement les deux espaces", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));

    await actAsync(() => dernier().emet(null, "active")); // joueur pur
    expect(h.current.peutChoisirEspace).toBe(false);

    await actAsync(() => dernier().emet("coach", null)); // encadrant sans suivi
    expect(h.current.peutChoisirEspace).toBe(false);

    await actAsync(() => dernier().emet("coach", "active")); // entraîneur-joueur
    expect(h.current.peutChoisirEspace).toBe(true);
  });

  test("LE PIÈGE : perdre l'encadrement referme l'espace coach malgré le choix mémorisé", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach", "active"));
    // Il choisit explicitement l'espace coach, et ce choix est mémorisé.
    await actAsync(() => h.current.choisirEspace("coach"));
    expect(h.current.space).toBe("coach");

    // Le serveur lui retire l'encadrement (retrait, rétrogradation).
    await actAsync(() => dernier().emet(null, "active"));
    expect(h.current.space).toBe("player");
    expect(h.current.peutChoisirEspace).toBe(false);
  });

  test("... et le choix « joueur » ne referme pas l'espace coach de qui n'a que lui", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach", "active"));
    await actAsync(() => h.current.choisirEspace("player"));
    expect(h.current.space).toBe("player");

    // Son suivi sportif est désactivé : il ne reste que l'espace coach.
    await actAsync(() => dernier().emet("coach", "inactive"));
    expect(h.current.space).toBe("coach");
  });

  test("appartenance illisible → espace joueur, et l'état est NOMMÉ", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().echoue());
    expect(h.current.space).toBe("player");
    expect(h.current.membershipUnreadable).toBe(true);
  });
});

// ─── Le suivi sportif, lu depuis LE MÊME instantané ─────────────────────────
//
// C'est ce que consomme le bouton « Je m'entraîne aussi » (espace coach) pour
// choisir entre activer et arrêter. Le vérifier ICI plutôt que sur le seul
// domaine prouve la chose qui compte : la valeur vient bien de l'abonnement, et
// elle bascule sur le même montage, sans reconnexion.

describe("suiviJoueur — ce que le bouton « Je m'entraîne aussi » va lire", () => {
  test("avant le premier instantané : `inconnu`, donc AUCUN geste proposé", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    expect(h.current.suiviJoueur).toBe("inconnu");
  });

  test("encadrant sans suivi → `inactif` ; entraîneur-joueur → `actif`", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach", null));
    expect(h.current.suiviJoueur).toBe("inactif");

    await actAsync(() => dernier().emet("coach", "active"));
    expect(h.current.suiviJoueur).toBe("actif");
  });

  test("l'ACTIVATION se voit sur le même montage : inactif → actif, sans reconnexion", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("owner", null));
    expect(h.current.suiviJoueur).toBe("inactif");
    expect(h.current.peutChoisirEspace).toBe(false);

    // Le serveur écrit `playerStatus: "active"` : l'instantané arrive, le suivi
    // devient actif ET le sélecteur d'espace s'ouvre — dans le même rendu.
    await actAsync(() => dernier().emet("owner", "active"));
    expect(h.current.suiviJoueur).toBe("actif");
    expect(h.current.peutChoisirEspace).toBe(true);
    // La permission d'encadrement n'a pas bougé d'un cran.
    expect(h.current.membershipAccessRole).toBe("owner");
  });

  test("l'ARRÊT se voit aussi : actif → inactif, encadrement conservé", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach", "active"));
    expect(h.current.suiviJoueur).toBe("actif");

    await actAsync(() => dernier().emet("coach", "inactive"));
    expect(h.current.suiviJoueur).toBe("inactif");
    expect(h.current.space).toBe("coach");
    expect(h.current.membershipAccessRole).toBe("coach");
  });

  test("lecture EN ÉCHEC → `inconnu`, jamais `inactif` (le piège)", async () => {
    // Sans ce troisième état, couper le réseau ferait proposer « Je m'entraîne
    // aussi » à quelqu'un qui a déjà un suivi actif.
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach", "active"));
    expect(h.current.suiviJoueur).toBe("actif");

    await actAsync(() => dernier().echoue());
    expect(h.current.suiviJoueur).toBe("inconnu");
  });

  test("aucun club rattaché → `inconnu` (il n'y a aucune appartenance à lire)", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: null }));
    expect(h.current.suiviJoueur).toBe("inconnu");
  });
});

describe("transfert de propriété — la bascule, sans reconnexion", () => {
  test("joueur devenu propriétaire : l'espace coach s'ouvre sur le même montage", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "successeur", clubId: "clubX" }));
    await actAsync(() => dernier().emet(null, "active"));
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
    expect(h.current.membershipAccessRole).toBe("coach");
  });

  test("retrait du club : l'espace coach se referme aussi vite qu'il s'est ouvert", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach"));
    expect(h.current.space).toBe("coach");

    await actAsync(() => dernier().emet(null, "inactive"));
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
    await actAsync(() => dernier().emet(null, "active"));
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
    await actAsync(() => dernier().emet(null, "active"));
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

// ════════════════════════════════════════════════════════════════════════════
// LES QUATRE ÉTATS DE L'AUTORITÉ
// ════════════════════════════════════════════════════════════════════════════

describe("quatre états, et un seul ouvre", () => {
  test("appartenance encadrante lue → `autorise`", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach"));
    expect(h.current.autorite).toBe("autorise");
    expect(h.current.space).toBe("coach");
  });

  test("appartenance non encadrante lue → `refuse` (un fait, pas une incertitude)", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet(null, "active"));
    expect(h.current.autorite).toBe("refuse");
  });

  test("premier instantané pas encore arrivé → `chargement`", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    expect(h.current.autorite).toBe("chargement");
    expect(h.current.decision).toBe("en-attente");
  });

  test("lecture en échec → `indetermine`, PAS `refuse`", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().echoue());
    expect(h.current.autorite).toBe("indetermine");
    // L'espace coach est fermé — mais on ne prétend pas savoir que c'est un refus.
    expect(h.current.space).toBe("player");
  });

  test("aucun club rattaché → `refuse`, sans attente", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: null }));
    expect(h.current.autorite).toBe("refuse");
  });
});

describe("mémoire d'une autorité confirmée — elle n'ouvre rien, elle choisit un écran", () => {
  test("coach coupé du réseau : l'incertitude est ATTRIBUÉE à un accès coach", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("owner"));
    expect(h.current.autoriteDejaConfirmee).toBe(true);

    await actAsync(() => dernier().echoue());
    expect(h.current.autorite).toBe("indetermine");
    // C'est ce couple (indetermine + déjà confirmée) qui ouvre l'écran honnête.
    expect(h.current.autoriteDejaConfirmee).toBe(true);
  });

  test("joueur coupé du réseau : AUCUNE mémoire, donc aucun écran d'accès coach", async () => {
    // Un joueur ne doit jamais voir « impossible de vérifier tes accès » : son
    // application sait vivre hors ligne, et il n'a aucun effectif à retrouver.
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet(null, "active"));
    await actAsync(() => dernier().echoue());
    expect(h.current.autorite).toBe("indetermine");
    expect(h.current.autoriteDejaConfirmee).toBe(false);
  });

  test("une lecture aboutie EFFACE la mémoire : retiré puis hors réseau → aucun écran coach", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach"));
    await actAsync(() => dernier().emet(null, "inactive")); // pierre tombale, LUE
    expect(h.current.autoriteDejaConfirmee).toBe(false);

    await actAsync(() => dernier().echoue());
    expect(h.current.autoriteDejaConfirmee).toBe(false);
  });

  test("changement de compte : la mémoire du précédent ne fuit pas", async () => {
    let params: { uid: string | null; clubId: string | null } = { uid: "coach1", clubId: "clubX" };
    const h = await renderHook(() => useAppSpace(params));
    await actAsync(() => dernier().emet("owner"));
    expect(h.current.autoriteDejaConfirmee).toBe(true);

    params = { uid: "joueur2", clubId: "clubX" };
    await h.rerender();
    await actAsync(() => dernier().echoue());
    expect(h.current.autoriteDejaConfirmee).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PUBLICATION DE L'AUTORITÉ ET PURGE
// ════════════════════════════════════════════════════════════════════════════

describe("l'autorité est publiée, et sa perte purge", () => {
  test("l'espace coach ouvert publie une autorité qui autorise les écritures", async () => {
    await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("owner"));
    expect(readCoachAuthority()?.statut).toBe("autorise");
    expect(canCommitCoachData(currentCoachAuthorityToken())).toBe(true);
  });

  test("la pierre tombale purge, EN TEMPS RÉEL, sur le même montage", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach"));
    const captureAvant = currentCoachAuthorityToken();
    purges = [];

    await actAsync(() => dernier().emet(null, "inactive"));

    expect(h.current.space).toBe("player");
    expect(purges).toEqual(["revocation"]);
    // Et toute lecture partie sous l'autorité précédente devient inapplicable.
    expect(canCommitCoachData(captureAvant)).toBe(false);
  });

  test("une lecture illisible purge AUSSI (l'incertitude ne conserve rien)", async () => {
    await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach"));
    purges = [];

    await actAsync(() => dernier().echoue());
    expect(purges).toEqual(["incertitude"]);
    expect(canCommitCoachData(currentCoachAuthorityToken())).toBe(false);
  });

  test("PAS DE PURGE INTEMPESTIVE : instantané identique, re-rendu, rien ne bouge", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach"));
    const capture = currentCoachAuthorityToken();
    purges = [];

    await actAsync(() => dernier().emet("coach")); // ré-émission à l'identique
    await h.rerender(); // navigation ordinaire : l'arbre se re-rend

    expect(purges).toEqual([]);
    // Le jeton n'a pas bougé : une lecture en vol doit pouvoir aboutir.
    expect(currentCoachAuthorityToken()).toBe(capture);
    expect(canCommitCoachData(capture)).toBe(true);
  });

  test("un changement de rôle SANS changement d'espace bouge quand même le jeton", async () => {
    // owner → coach : l'espace reste coach, mais l'autorité n'est plus la même.
    // Le jeton doit le refléter, sinon une lecture faite en tant que
    // propriétaire s'appliquerait sous un rôle qui ne l'est plus.
    await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("owner"));
    const capture = currentCoachAuthorityToken();

    await actAsync(() => dernier().emet("coach"));
    expect(currentCoachAuthorityToken()).not.toBe(capture);
    expect(canCommitCoachData(capture)).toBe(false);
  });

  test("déconnexion : l'autorité tombe et purge", async () => {
    let params: { uid: string | null; clubId: string | null } = { uid: "u1", clubId: "clubX" };
    await renderHook(() => useAppSpace(params));
    await actAsync(() => dernier().emet("owner"));
    purges = [];

    params = { uid: null, clubId: null };
    await renderHook(() => useAppSpace(params));
    expect(purges.length).toBeGreaterThan(0);
    expect(canCommitCoachData(currentCoachAuthorityToken())).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// REVALIDATION AU RETOUR AU PREMIER PLAN
// ════════════════════════════════════════════════════════════════════════════

describe("retour au premier plan — on revalide AVANT de réafficher", () => {
  test("retour de l'arrière-plan : purge, `chargement`, et nouvel abonnement", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach"));
    const premier = dernier();
    purges = [];

    await bascule("background", "active");

    // L'espace coach est FERMÉ le temps de la vérification.
    expect(h.current.autorite).toBe("chargement");
    expect(h.current.decision).toBe("en-attente");
    expect(purges).toEqual(["revalidation"]);
    // L'ancien abonnement est coupé, un neuf est posé sur le même document.
    expect(premier.fermetures).toBe(1);
    expect(abonnements).toHaveLength(2);
    expect(dernier().chemin).toBe("clubs/clubX/members/u1");
  });

  test("revalidation confirmée → l'espace coach revient", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach"));
    await bascule("background", "active");

    await actAsync(() => dernier().emet("coach"));
    expect(h.current.autorite).toBe("autorise");
    expect(h.current.space).toBe("coach");
    expect(canCommitCoachData(currentCoachAuthorityToken())).toBe(true);
  });

  test("revalidation qui dit NON → l'espace coach ne revient pas", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("owner"));
    await bascule("background", "active");

    await actAsync(() => dernier().emet(null, "inactive"));
    expect(h.current.autorite).toBe("refuse");
    expect(h.current.space).toBe("player");
  });

  test("bascule PASSAGÈRE (`inactive`) : aucune revalidation, aucune purge", async () => {
    // Centre de contrôle, bannière de notification, appel entrant : l'écran du
    // coach ne doit pas se vider parce qu'il a baissé le volume.
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach"));
    purges = [];

    await bascule("inactive", "active");

    expect(h.current.autorite).toBe("autorise");
    expect(purges).toEqual([]);
    expect(abonnements).toHaveLength(1);
  });

  test("iOS : background → inactive → active revalide quand même", async () => {
    // Revenir depuis le sélecteur d'applications passe par `inactive` : l'état
    // juste avant `active` n'est PAS `background`. Se fier au seul état
    // précédent raterait donc tous les retours iOS.
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach"));

    await bascule("background", "inactive", "active");
    expect(h.current.autorite).toBe("chargement");
    expect(abonnements).toHaveLength(2);
  });

  test("l'abonné au cycle de vie est retiré au démontage", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "u1", clubId: "clubX" }));
    expect(ecouteursAppState).toHaveLength(1);
    await h.unmount();
    expect(ecouteursAppState).toHaveLength(0);
  });

  test("déconnecté : aucun abonnement au cycle de vie (rien à revalider)", async () => {
    await renderHook(() => useAppSpace({ uid: null, clubId: null }));
    expect(ecouteursAppState).toHaveLength(0);
  });
});

describe("revalidation qui n'aboutit pas — on ne reste pas suspendu", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("aucune réponse dans le délai → `indetermine`, jamais « on garde »", async () => {
    const h = await renderHook(() =>
      useAppSpace({ uid: "u1", clubId: "clubX" }, { delaiRevalidationMs: 1000 }),
    );
    await actAsync(() => dernier().emet("coach"));
    await bascule("background", "active");
    expect(h.current.autorite).toBe("chargement");

    await actAsync(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(h.current.autorite).toBe("indetermine");
    expect(h.current.autoriteDejaConfirmee).toBe(true); // → écran honnête
    expect(canCommitCoachData(currentCoachAuthorityToken())).toBe(false);
  });

  test("une réponse arrivée AVANT le délai désamorce le minuteur", async () => {
    const h = await renderHook(() =>
      useAppSpace({ uid: "u1", clubId: "clubX" }, { delaiRevalidationMs: 1000 }),
    );
    await actAsync(() => dernier().emet("coach"));
    await bascule("background", "active");
    await actAsync(() => dernier().emet("coach"));
    expect(h.current.autorite).toBe("autorise");

    await actAsync(() => {
      jest.advanceTimersByTime(5000);
    });
    // Le minuteur ne doit pas rattraper une réponse déjà arrivée.
    expect(h.current.autorite).toBe("autorise");
  });

  test("démarrage à froid : AUCUN délai de garde (l'attente initiale reste l'attente)", async () => {
    // Au démarrage il n'y a aucune donnée coach en mémoire à protéger, et
    // l'application affiche déjà son écran de chargement. Poser un délai ici
    // ferait clignoter l'espace joueur devant un coach sur réseau lent.
    const h = await renderHook(() =>
      useAppSpace({ uid: "u1", clubId: "clubX" }, { delaiRevalidationMs: 1000 }),
    );
    await actAsync(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(h.current.autorite).toBe("chargement");
  });

  test("« Réessayer » repose l'abonnement et repasse par `chargement`", async () => {
    const h = await renderHook(() =>
      useAppSpace({ uid: "u1", clubId: "clubX" }, { delaiRevalidationMs: 1000 }),
    );
    await actAsync(() => dernier().emet("coach"));
    await actAsync(() => dernier().echoue());
    expect(h.current.autorite).toBe("indetermine");

    await actAsync(() => h.current.revalider());
    expect(h.current.autorite).toBe("chargement");
    expect(dernier().chemin).toBe("clubs/clubX/members/u1");

    await actAsync(() => dernier().emet("coach"));
    expect(h.current.autorite).toBe("autorise");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LES TROIS FORMES DE RETRAIT, VUES DEPUIS LE TÉLÉPHONE DE LA PERSONNE
//
// Le serveur écrit trois états différents ; c'est ici qu'on vérifie que
// l'application en tire trois conséquences différentes — et surtout que la PURGE
// de l'état coach se déclenche sur la bonne, et sur elle seule.
//
// LE PIÈGE, ÉCRIT NOIR SUR BLANC : arrêter le SUIVI DE JOUEUR d'un
// entraîneur-joueur NE DOIT PAS purger son espace coach. Il ne perd rien de son
// encadrement, et une purge lui viderait l'effectif sous les yeux sans raison.
// ════════════════════════════════════════════════════════════════════════════

describe("les trois gestes, côté application : ce qui purge et ce qui ne purge pas", () => {
  test("ARRÊT DU SUIVI d'un entraîneur-joueur : AUCUNE purge, l'espace coach reste", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "uTroisGestes", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach", "active"));
    expect(h.current.space).toBe("coach");
    // Les deux espaces lui sont ouverts : le sélecteur est là.
    expect(h.current.peutChoisirEspace).toBe(true);
    const capture = currentCoachAuthorityToken();
    purges = [];

    // Le serveur a écrit `playerStatus: "inactive"`, et RIEN d'autre.
    await actAsync(() => dernier().emet("coach", "inactive"));

    expect(purges).toEqual([]);
    expect(h.current.space).toBe("coach");
    expect(h.current.autorite).toBe("autorise");
    expect(h.current.membershipAccessRole).toBe("coach");
    // Une lecture coach partie avant le geste reste applicable : rien de ce
    // qu'elle rapporte n'a cessé d'être autorisé.
    expect(canCommitCoachData(capture)).toBe(true);
    // Ce qui change, et c'est tout : il n'a plus de suivi, donc plus de choix.
    expect(h.current.peutChoisirEspace).toBe(false);
  });

  test("RETRAIT DES ACCÈS D'ENCADREMENT d'un entraîneur-joueur : purge, et bascule vers le joueur", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "uTroisGestes", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach", "active"));
    const capture = currentCoachAuthorityToken();
    purges = [];

    // Le serveur a écrit `accessRole: null`, et RIEN d'autre.
    await actAsync(() => dernier().emet(null, "active"));

    expect(purges).toEqual(["revocation"]);
    expect(h.current.space).toBe("player");
    expect(h.current.autorite).toBe("refuse");
    expect(h.current.membershipAccessRole).toBeNull();
    expect(canCommitCoachData(capture)).toBe(false);
    // Il garde son application d'entraînement : il est toujours joueur du club.
    expect(h.current.decision).toBe("player");
  });

  test("RETRAIT COMPLET : purge, et plus rien d'ouvert côté encadrement", async () => {
    const h = await renderHook(() => useAppSpace({ uid: "uTroisGestes", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach", "active"));
    purges = [];

    // Pierre tombale : les deux axes fermés dans la même écriture.
    await actAsync(() => dernier().emet(null, "inactive"));

    expect(purges).toEqual(["revocation"]);
    expect(h.current.space).toBe("player");
    expect(h.current.peutChoisirEspace).toBe(false);
    expect(canCommitCoachData(currentCoachAuthorityToken())).toBe(false);
  });

  test("un ENCADRANT PUR dont on arrête le « suivi » ne bouge pas d'un pouce", async () => {
    // Cas de rejeu : le serveur ne réécrit rien (idempotence), mais si un
    // instantané repasse, l'application ne doit rien conclure de nouveau.
    const h = await renderHook(() => useAppSpace({ uid: "uTroisGestes", clubId: "clubX" }));
    await actAsync(() => dernier().emet("coach"));
    const capture = currentCoachAuthorityToken();
    purges = [];

    await actAsync(() => dernier().emet("coach", "inactive"));

    expect(purges).toEqual([]);
    expect(h.current.space).toBe("coach");
    expect(currentCoachAuthorityToken()).toBe(capture);
  });

  test("le PROPRIÉTAIRE qui arrête de jouer reste propriétaire à l'écran", async () => {
    // Le geste légitime du lot : il ne transfère rien, il ne perd rien.
    const h = await renderHook(() => useAppSpace({ uid: "uTroisGestes", clubId: "clubX" }));
    await actAsync(() => dernier().emet("owner", "active"));
    purges = [];

    await actAsync(() => dernier().emet("owner", "inactive"));

    expect(purges).toEqual([]);
    expect(h.current.space).toBe("coach");
    expect(h.current.membershipAccessRole).toBe("owner");
    expect(h.current.autorite).toBe("autorise");
  });
});
