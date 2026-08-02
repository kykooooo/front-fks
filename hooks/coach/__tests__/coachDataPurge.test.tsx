// hooks/coach/__tests__/coachDataPurge.test.tsx
//
// LA PURGE, ÉLÉMENT PAR ÉLÉMENT DE L'INVENTAIRE.
//
// ─── LE DÉFAUT QUE CETTE SUITE COUVRE ───────────────────────────────────────
// Firestore est initialisé SANS cache local persistant (`services/firebase`) :
// fermer l'application vide déjà tout. Le risque n'est donc pas le redémarrage,
// c'est la SESSION OUVERTE — un coach laisse l'app ouverte des jours. Les règles
// Firestore bloquent les NOUVELLES lectures dès la révocation ; elles n'effacent
// rien de ce que l'application a déjà chargé en mémoire. Un coach retiré à 14 h
// pouvait continuer à lire l'effectif de 14 h jusqu'à fermer l'app.
//
// ─── CE QUI EST PROUVÉ ICI, ET POURQUOI ÇA NE SE VOIT PAS AILLEURS ──────────
// Aujourd'hui, toutes les données coach vivent dans l'état local de hooks montés
// sous l'espace coach : la fermeture de l'espace les démonte, donc les efface.
// C'est vrai — et c'est une propriété de l'ARBRE React, pas une règle écrite.
// Ces tests purgent SANS RIEN DÉMONTER : ils prouvent que la donnée part parce
// qu'on l'a décidé, et pas parce que React a eu la bonne idée.
//
// ─── LES TROIS CHOSES QU'ON N'A PAS LE DROIT DE RATER ───────────────────────
//  1. la purge est EFFECTIVE sur chaque détenteur de l'inventaire ;
//  2. une réponse partie AVANT la révocation et revenue APRÈS est IGNORÉE —
//     avec son témoin (la même réponse, sous l'autorité courante, s'applique) ;
//  3. la purge ne ment pas : un effectif vidé se déclare INCONNU, jamais VIDE.
//     « 0 joueur » ferait croire au coach que son club s'est vidé.

import { renderHook, flush, deferred, actAsync } from "./hookHarness";

// ─── Mocks ──────────────────────────────────────────────────────────────────
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(() => cb(), [cb]);
  },
}));

jest.mock("../../../services/firebase", () => ({
  db: {},
  auth: {
    get currentUser() {
      return { uid: "coach1" };
    },
  },
}));

jest.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path }),
  getDoc: jest.fn(),
}));

jest.mock("../../../repositories/clubsRepo", () => ({
  fetchClubPlayerSummaries: jest.fn(),
  fetchClubPlayerSummary: jest.fn(),
  getClubWeekContext: jest.fn(),
  getCoachPrivateNote: jest.fn(),
  getClubDirective: jest.fn(),
}));

jest.mock("../../../services/clubInvites", () => ({ issueClubInviteCode: jest.fn() }));
jest.mock("../../../services/clubMembers", () => ({ removeClubMember: jest.fn() }));

import { getDoc } from "firebase/firestore";
import {
  fetchClubPlayerSummaries,
  fetchClubPlayerSummary,
  getClubDirective,
  getClubWeekContext,
  getCoachPrivateNote,
} from "../../../repositories/clubsRepo";
import { issueClubInviteCode } from "../../../services/clubInvites";
import { removeClubMember } from "../../../services/clubMembers";

import { useCoachRoster } from "../useCoachRoster";
import { useCoachPlayer } from "../useCoachPlayer";
import { useCoachClub } from "../useCoachClub";
import { useClubInviteCode } from "../useClubInviteCode";
import { useRemoveClubMember } from "../useRemoveClubMember";
import {
  publishCoachAuthority,
  resetCoachAuthorityGateForTests,
} from "../../../state/coachAuthorityGate";
import type { CoachPlayerSummary } from "../../../domain/coachSummary";

const rosterMock = fetchClubPlayerSummaries as jest.MockedFunction<typeof fetchClubPlayerSummaries>;
const playerMock = fetchClubPlayerSummary as jest.MockedFunction<typeof fetchClubPlayerSummary>;
const getDocMock = getDoc as jest.MockedFunction<any>;
const weekContextMock = getClubWeekContext as jest.MockedFunction<typeof getClubWeekContext>;
const noteMock = getCoachPrivateNote as jest.MockedFunction<typeof getCoachPrivateNote>;
const directiveMock = getClubDirective as jest.MockedFunction<typeof getClubDirective>;
const inviteMock = issueClubInviteCode as jest.MockedFunction<typeof issueClubInviteCode>;
const removeMock = removeClubMember as jest.MockedFunction<typeof removeClubMember>;

const now = () => 1_700_000_000_000;

const summary = (playerUid: string, firstName: string): CoachPlayerSummary => ({
  playerUid,
  firstName,
  ageCategory: null,
  position: null,
  level: null,
  profileComplete: true,
  latestSession: null,
  lastActivity: { dateKey: "2026-07-20", durationMin: 45 },
  adaptation: { adapted: false, labels: [] },
  activity: { doneDateKeys: ["2026-07-20"] },
  lastPlanned: null,
  lastDone: null,
  execution: null,
});

const rosterResult = (over: Partial<Awaited<ReturnType<typeof fetchClubPlayerSummaries>>> = {}) => ({
  summaries: [] as CoachPlayerSummary[],
  restrictedCount: 0,
  pendingCount: 0,
  unreadableCount: 0,
  unavailable: false,
  fetchedAt: now(),
  ...over,
});

/** L'autorité coach, telle que la racine la publierait. */
const AUTORISE = { statut: "autorise" as const, jeton: 10 };
const REVOQUE = { statut: "refuse" as const, jeton: 11 };

beforeEach(() => {
  jest.clearAllMocks();
  resetCoachAuthorityGateForTests();
  publishCoachAuthority(AUTORISE);
  weekContextMock.mockResolvedValue(null);
  noteMock.mockResolvedValue(null);
  directiveMock.mockResolvedValue(null);
  getDocMock.mockImplementation(async (ref: { path: string[] }) => {
    const collection = ref.path[0];
    const estMembre = ref.path[2] === "members";
    if (collection === "users") return { exists: () => true, data: () => ({ clubId: "clubX" }) };
    if (estMembre) return { exists: () => true, data: () => ({ role: "owner" }) };
    return {
      exists: () => true,
      data: () => ({ name: "AS Test", teamGender: "female", ownerUid: "coach1" }),
    };
  });
});

/** Révocation serveur, telle qu'elle arrive dans l'application. */
const revoquer = async () => {
  await actAsync(() => {
    publishCoachAuthority(REVOQUE);
  });
};

// ════════════════════════════════════════════════════════════════════════════
// 1. L'EFFECTIF
// ════════════════════════════════════════════════════════════════════════════

describe("effectif — la donnée coach la plus lourde part en premier", () => {
  test("la révocation vide l'effectif SANS démonter l'écran", async () => {
    rosterMock.mockResolvedValue(
      rosterResult({ summaries: [summary("p1", "Anna"), summary("p2", "Bea")], restrictedCount: 2 }),
    );
    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    await flush();
    expect(h.current.views).toHaveLength(2);

    await revoquer();

    expect(h.current.views).toHaveLength(0);
    expect(h.current.readyCount).toBe(0);
    expect(h.current.restrictedCount).toBe(0);
    expect(h.current.memberCount).toBe(0);
    expect(h.current.fetchedAt).toBeNull();
  });

  test("un effectif purgé se déclare INCONNU, jamais VIDE", async () => {
    // « 0 joueur » ferait croire au coach que son club s'est vidé. C'est la
    // nuance qui distingue une purge honnête d'un mensonge silencieux.
    rosterMock.mockResolvedValue(rosterResult({ summaries: [summary("p1", "Anna")] }));
    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    await flush();
    expect(h.current.status).toBe("ready");

    await revoquer();
    expect(h.current.status).toBe("unavailable");
    expect(h.current.isRefreshing).toBe(false);
  });

  test("PIÈGE 1 — une lecture partie avant la révocation ne repeuple RIEN", async () => {
    // Même club, même écran, même requête : seules les gardes d'autorité
    // reconnaissent ce cas. Les gardes de route, elles, disent « c'est bien le
    // club affiché » et laisseraient passer.
    const d = deferred<Awaited<ReturnType<typeof fetchClubPlayerSummaries>>>();
    rosterMock.mockReturnValue(d.promise);
    const h = await renderHook(() => useCoachRoster("clubX", { now }));

    await revoquer(); // révocation PENDANT le vol

    await actAsync(() => {
      d.resolve(rosterResult({ summaries: [summary("p1", "Anna")] }));
    });
    await flush();

    expect(h.current.views).toHaveLength(0);
    expect(h.current.status).toBe("unavailable");
  });

  test("TÉMOIN — la MÊME réponse, sous l'autorité courante, s'applique bien", async () => {
    // Sans ce témoin, le test précédent serait satisfait par un garde-fou qui
    // refuserait tout : il ne prouverait rien.
    const d = deferred<Awaited<ReturnType<typeof fetchClubPlayerSummaries>>>();
    rosterMock.mockReturnValue(d.promise);
    const h = await renderHook(() => useCoachRoster("clubX", { now }));

    await actAsync(() => {
      d.resolve(rosterResult({ summaries: [summary("p1", "Anna")] }));
    });
    await flush();

    expect(h.current.views).toHaveLength(1);
    expect(h.current.status).toBe("ready");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. LA FICHE JOUEUR, SA CHRONOLOGIE ET SES SIGNAUX
// ════════════════════════════════════════════════════════════════════════════

describe("fiche joueur — la donnée nominative la plus détaillée", () => {
  test("la révocation efface la fiche et sa chronologie", async () => {
    playerMock.mockResolvedValue({
      summary: summary("p1", "Anna"),
      unavailable: false,
      restricted: false,
    });
    const h = await renderHook(() => useCoachPlayer("clubX", "p1", { now }));
    await flush();
    expect(h.current.summary).not.toBeNull();
    expect(h.current.view).not.toBeNull();

    await revoquer();

    expect(h.current.summary).toBeNull();
    expect(h.current.view).toBeNull();
    expect(h.current.fetchedAt).toBeNull();
  });

  test("une fiche purgée se déclare INCONNUE, pas « en préparation »", async () => {
    // `notFound` afficherait « synchronisation en cours » : une attente qui ne
    // finira jamais, puisque plus rien ne sera lu.
    playerMock.mockResolvedValue({
      summary: summary("p1", "Anna"),
      unavailable: false,
      restricted: false,
    });
    const h = await renderHook(() => useCoachPlayer("clubX", "p1", { now }));
    await flush();

    await revoquer();
    expect(h.current.status).toBe("unavailable");
  });

  test("PIÈGE 1 — réponse en vol ignorée, et TÉMOIN sous autorité courante", async () => {
    const d = deferred<Awaited<ReturnType<typeof fetchClubPlayerSummary>>>();
    playerMock.mockReturnValue(d.promise);
    const h = await renderHook(() => useCoachPlayer("clubX", "p1", { now }));
    await revoquer();
    await actAsync(() => {
      d.resolve({ summary: summary("p1", "Anna"), unavailable: false, restricted: false });
    });
    await flush();
    expect(h.current.summary).toBeNull();

    // Témoin : autorité courante rétablie, nouveau montage, même réponse.
    await actAsync(() => {
      publishCoachAuthority({ statut: "autorise", jeton: 12 });
    });
    playerMock.mockResolvedValue({
      summary: summary("p1", "Anna"),
      unavailable: false,
      restricted: false,
    });
    const h2 = await renderHook(() => useCoachPlayer("clubX", "p1", { now }));
    await flush();
    expect(h2.current.summary?.firstName).toBe("Anna");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. CLUB, SEMAINE, NOTE PRIVÉE, DIRECTIVE
// ════════════════════════════════════════════════════════════════════════════

describe("contexte club — identité, semaine, note privée, directive", () => {
  test("tout part, y compris la NOTE PRIVÉE du coach", async () => {
    weekContextMock.mockResolvedValue({
      trainingIntensity: "high",
      weekGoal: "match",
      matchThisWeekend: true,
      legacyNote: "",
    } as any);
    noteMock.mockResolvedValue({ note: "Anna a mal au genou", updatedAt: 1 } as any);
    directiveMock.mockResolvedValue({
      objective: "recovery",
      instruction: "Allégé mardi",
      active: true,
    } as any);

    const h = await renderHook(() => useCoachClub({ now }));
    await flush();
    expect(h.current.status).toBe("ready");
    expect(h.current.coachNote?.note).toBe("Anna a mal au genou");

    await revoquer();

    expect(h.current.clubId).toBeNull();
    expect(h.current.clubName).toBeNull();
    expect(h.current.weekContext).toBeNull();
    expect(h.current.coachNote).toBeNull();
    expect(h.current.directive).toBeNull();
    expect(h.current.teamGender).toBeNull();
    expect(h.current.ownerAuthority).toBe("not-owner");
    expect(h.current.fetchedAt).toBeNull();
  });

  test("un contexte purgé ne dit PAS « tu n'es dans aucun club »", async () => {
    // `notInClub` affirmerait un fait qu'on ne connaît pas. `error` dit la seule
    // chose vraie : on n'a plus rien de lisible.
    const h = await renderHook(() => useCoachClub({ now }));
    await flush();
    await revoquer();
    expect(h.current.status).toBe("error");
  });

  test("PIÈGE 1 — un contexte club en vol n'écrit rien après la révocation", async () => {
    const d = deferred<any>();
    weekContextMock.mockReturnValue(d.promise);
    const h = await renderHook(() => useCoachClub({ now }));
    await revoquer();
    await actAsync(() => {
      d.resolve({ trainingIntensity: "high", weekGoal: "match", matchThisWeekend: true });
    });
    await flush();
    expect(h.current.clubName).toBeNull();
    expect(h.current.weekContext).toBeNull();
    expect(h.current.status).toBe("error");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. CODE D'INVITATION ET GESTE DE RETRAIT
// ════════════════════════════════════════════════════════════════════════════

describe("code d'invitation — un droit d'entrée ne survit pas à la perte d'autorité", () => {
  test("le code affiché disparaît", async () => {
    inviteMock.mockResolvedValue({
      ok: true,
      code: "ABCD12",
      expiresAt: 0,
      maxUses: 30,
      replacedPrevious: false,
    } as any);
    const h = await renderHook(() => useClubInviteCode("clubX"));
    await actAsync(() => h.current.issue());
    await flush();
    expect(h.current.code).toBe("ABCD12");

    await revoquer();
    expect(h.current.code).toBeNull();
    expect(h.current.isIssuing).toBe(false);
  });

  test("PIÈGE 1 — un code émis avant la révocation ne s'affiche pas après", async () => {
    const d = deferred<any>();
    inviteMock.mockReturnValue(d.promise);
    const h = await renderHook(() => useClubInviteCode("clubX"));
    await actAsync(() => h.current.issue());
    await revoquer();
    await actAsync(() => {
      d.resolve({ ok: true, code: "SECRET", expiresAt: 0, maxUses: 30, replacedPrevious: false });
    });
    await flush();
    expect(h.current.code).toBeNull();
  });
});

describe("geste de retrait — l'état porte un identifiant de joueur", () => {
  test("la phase revient à l'état neutre", async () => {
    removeMock.mockResolvedValue({ ok: true, alreadyRemoved: false } as any);
    const h = await renderHook(() => useRemoveClubMember("clubX", "p1"));
    await actAsync(() => h.current.remove());
    await flush();
    expect(h.current.phase.kind).toBe("done");

    await revoquer();
    expect(h.current.phase.kind).toBe("idle");
  });

  test("la purge est LOCALE : elle n'annule aucune écriture déjà partie", async () => {
    // Le retrait est parti vers le serveur ; il suit son cours. On n'écrit rien
    // en base pour « défaire » quoi que ce soit.
    removeMock.mockResolvedValue({ ok: true, alreadyRemoved: false } as any);
    const h = await renderHook(() => useRemoveClubMember("clubX", "p1"));
    await actAsync(() => h.current.remove());
    await flush();
    await revoquer();
    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. CE QUI NE DOIT PAS PARTIR
// ════════════════════════════════════════════════════════════════════════════

describe("la purge est locale et STRICTEMENT limitée aux données coach", () => {
  test("aucune écriture Firestore n'est déclenchée par une purge", async () => {
    rosterMock.mockResolvedValue(rosterResult({ summaries: [summary("p1", "Anna")] }));
    await renderHook(() => useCoachRoster("clubX", { now }));
    await flush();
    const lecturesAvant = rosterMock.mock.calls.length;

    await revoquer();

    // Ni relecture, ni écriture : la purge est un geste de mémoire, pas de base.
    expect(rosterMock.mock.calls.length).toBe(lecturesAvant);
    expect(removeMock).not.toHaveBeenCalled();
    expect(inviteMock).not.toHaveBeenCalled();
  });

  test("les données personnelles du joueur connecté SURVIVENT", async () => {
    // Un compte peut être à la fois coach d'un club et joueur : perdre ses
    // propres séances parce qu'on lui a retiré l'encadrement serait un dégât
    // collatéral inacceptable — et parfaitement inutile, puisque ces données ne
    // viennent pas du club.
    const { useSessionsStore } = require("../../../state/stores/useSessionsStore");
    useSessionsStore.setState({
      sessions: [{ id: "s1", date: "2026-07-20", type: "FKS" } as any],
      phaseCount: 4,
    });

    rosterMock.mockResolvedValue(rosterResult({ summaries: [summary("p1", "Anna")] }));
    const h = await renderHook(() => useCoachRoster("clubX", { now }));
    await flush();

    await revoquer();

    expect(h.current.views).toHaveLength(0); // la donnée coach est bien partie
    expect(useSessionsStore.getState().sessions).toHaveLength(1); // la sienne, non
    expect(useSessionsStore.getState().phaseCount).toBe(4);
  });
});

describe("le périmètre de la purge est vérifiable à la lecture", () => {
  test("SEULS des modules coach s'abonnent au signal de purge", () => {
    // Le jour où quelqu'un branchera le store du joueur (séances, charges,
    // réglages) sur ce signal, ce test tombera — et c'est exactement ce qu'on
    // veut : la purge coach ne doit JAMAIS toucher aux données personnelles du
    // compte connecté.
    const { readdirSync, readFileSync, statSync } = require("fs");
    const { join, resolve, relative, sep } = require("path");
    const racine = resolve(__dirname, "..", "..", "..");

    // Balayage par le système de fichiers (pas `git grep`) : le résultat ne
    // dépend ni d'un dépôt propre, ni de l'outil git présent sur la machine.
    const trouves: string[] = [];
    const parcourir = (dossier: string) => {
      for (const entree of readdirSync(dossier)) {
        if (["node_modules", ".git", ".claude", "functions", "firestore-tests"].includes(entree)) {
          continue;
        }
        const chemin = join(dossier, entree);
        if (statSync(chemin).isDirectory()) {
          parcourir(chemin);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entree) || chemin.includes(`${sep}__tests__${sep}`)) continue;
        const source: string = readFileSync(chemin, "utf8");
        if (source.includes("onCoachDataPurge") || source.includes("useCoachDataPurge")) {
          trouves.push(relative(racine, chemin).split(sep).join("/"));
        }
      }
    };
    parcourir(racine);

    // Le porteur du signal, son hook d'abonnement, et la racine qui le publie.
    const abonnes = trouves.filter(
      (f) =>
        f !== "state/coachAuthorityGate.ts" &&
        f !== "hooks/coach/useCoachDataPurge.ts" &&
        f !== "hooks/useAppSpace.ts",
    );

    expect(abonnes.length).toBeGreaterThan(0);
    for (const fichier of abonnes) {
      expect(fichier.startsWith("hooks/coach/")).toBe(true);
    }
  });
});
