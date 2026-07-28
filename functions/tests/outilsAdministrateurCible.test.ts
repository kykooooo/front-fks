// functions/tests/outilsAdministrateurCible.test.ts
//
// LE TEST NEGATIF, applique aux DEUX AUTRES OUTILS ADMINISTRATEUR : le transfert
// de propriete et la mise a niveau des acces coach. Meme methode que
// weekContextNoteMigrationCible.test.ts, meme verrou (`migrationCible.ts`) —
// c'est tout l'objet du lot : une regle de securite recopiee trois fois est une
// regle qui derive.
//
// ─── POURQUOI PAR COMPTAGE, ET PAS PAR COMPARAISON D'ETAT ───────────────────
// « La base n'a pas change » ne prouve rien : un magasin qui n'ecrit pas et un
// magasin qui ecrit puis annule sont indiscernables apres coup. On INSTRUMENTE
// donc le magasin et on COMPTE les appels d'ecriture. Zero appel, c'est une
// preuve ; « je ne vois pas de difference », c'est une impression.
//
// Le compteur compte aussi les CONSTRUCTIONS de magasin : dans les cas de refus,
// le magasin n'est meme pas fabrique — la commande n'a physiquement pas de quoi
// ecrire. C'est le point le plus subtil du lot : un refus place APRES une
// initialisation ne vaut pas un refus place AVANT.
//
// Et un TEMOIN POSITIF par outil prouve que ces compteurs savent compter : sans
// lui, tous les zeros pourraient venir d'un compteur mort.
//
// Aucune base reelle, aucun emulateur, aucun reseau. Ces deux outils n'ont
// jamais ete executes ailleurs qu'ici.

import { executerTransfertCli } from "../src/clubOwnershipCli";
import { executerBackfillCli } from "../src/coachAccessBackfillCli";
import { analyserCible, libelleCible } from "../src/migrationCible";
import type { MemberDocData, MemberStore, MemberTx } from "../src/clubMembers";
import type { CoachAccessBackfillStore, MemberRef } from "../src/coachAccessBackfill";
import type { MemberSnapshot } from "../src/coachAccessSync";

const PROJET_BAC_A_SABLE = "demo-fks";
const PROJET_PRODUCTION = "fks-apps";
const CLUB = "clubA";

/** Le couple que la confirmation du transfert doit repeter, mot pour mot. */
const CIBLE_COUPLE = `${PROJET_BAC_A_SABLE}/${CLUB}`;

type Compteurs = {
  /** Combien de fois le magasin a ete CONSTRUIT (donc combien de fois on a ouvert la base). */
  constructions: number;
  lectures: number;
  ecritures: number;
  suppressions: number;
};

const compteursNeufs = (): Compteurs => ({
  constructions: 0,
  lectures: 0,
  ecritures: 0,
  suppressions: 0,
});

// ════════════════════════════════════════════════════════════════════════════
// OUTIL 1 — LE TRANSFERT DE PROPRIETE
// ════════════════════════════════════════════════════════════════════════════

type BaseClub = Record<string, MemberDocData>;

/**
 * Magasin INSTRUMENTE du transfert : il se comporte comme les magasins en
 * memoire des autres tests, mais chaque operation incremente un compteur.
 *
 * Le club de depart est le cas nominal de l'outil : un proprietaire designe ET
 * porteur de la permission, et un membre actif qui peut lui succeder.
 *
 * LES APPARTENANCES PORTENT LES DEUX ECRITURES DU CHAMP D'AUTORITE — l'ancienne
 * (`role`) et la nouvelle (`accessRole` / `playerStatus`). Ce n'est pas de la
 * precaution gratuite : c'est exactement ce a quoi ressemble une base en cours
 * de transition, et surtout ce test-ci ne parle PAS de la forme des
 * appartenances. Il parle du VERROU DE CIBLE. Le detail de ce que le transfert
 * ecrit appartient a clubOwnership.test.ts, et doit y rester.
 */
function magasinTransfert(): {
  creerStore: () => MemberStore;
  compteurs: Compteurs;
  base: BaseClub;
} {
  const base: BaseClub = {
    "clubs/clubA": { ownerUid: "coach1" },
    "clubs/clubA/members/coach1": { uid: "coach1", role: "owner", accessRole: "owner" },
    "clubs/clubA/members/joueur1": {
      uid: "joueur1",
      role: "player",
      playerStatus: "active",
    },
    "clubs/clubA/playerSummaries/joueur1": { uid: "joueur1" },
  };
  const compteurs = compteursNeufs();

  const creerStore = (): MemberStore => {
    compteurs.constructions += 1;
    return {
      async runTransaction<T>(fn: (tx: MemberTx) => Promise<T>): Promise<T> {
        const tx: MemberTx = {
          async get(path) {
            compteurs.lectures += 1;
            const doc = base[path];
            return doc ? { ...doc } : null;
          },
          set(path, data, opts) {
            compteurs.ecritures += 1;
            base[path] = opts?.merge ? { ...(base[path] ?? {}), ...data } : { ...data };
          },
          delete(path) {
            compteurs.suppressions += 1;
            delete base[path];
          },
        };
        return fn(tx);
      },
    };
  };

  return { creerStore, compteurs, base };
}

async function lancerTransfert(
  argv: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number; compteurs: Compteurs; base: BaseClub; sorties: string[]; erreurs: string[] }> {
  const { creerStore, compteurs, base } = magasinTransfert();
  const sorties: string[] = [];
  const erreurs: string[] = [];
  const code = await executerTransfertCli({
    argv,
    env,
    creerStore,
    log: (m) => sorties.push(m),
    erreur: (m) => erreurs.push(m),
    now: () => 1_700_000_000_000,
  });
  return { code, compteurs, base, sorties, erreurs };
}

describe("TRANSFERT DE PROPRIETE : sans autorisation explicite, ZERO ecriture", () => {
  const scenarios: { nom: string; argv: string[]; env: NodeJS.ProcessEnv; motif: string }[] = [
    {
      nom: "aucune option du tout",
      argv: [],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "--apply tout seul (l'erreur la plus probable)",
      argv: ["--apply"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "l'ANCIENNE commande, copiee-collee de la doc d'avant ce lot",
      argv: [
        `--clubId=${CLUB}`,
        "--nouveauProprietaire=joueur1",
        "--apply",
        "--je-confirme",
      ],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "cible mal formee (majuscules, point d'exclamation)",
      argv: ["--projet=Fks-Apps!", `--clubId=${CLUB}`, "--nouveauProprietaire=joueur1"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "identifiant de projet",
    },
    {
      nom: "cible vide (--projet= sans rien)",
      argv: ["--projet=", `--clubId=${CLUB}`, "--nouveauProprietaire=joueur1"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "le projet est nomme, mais PAS le club (cet outil agit sur un club)",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, "--nouveauProprietaire=joueur1"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucun club nomme",
    },
    {
      nom: "club mal forme (tentative de sortir du chemin)",
      argv: [
        `--projet=${PROJET_BAC_A_SABLE}`,
        "--clubId=club A/../autre",
        "--nouveauProprietaire=joueur1",
      ],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "--clubId invalide",
    },
    {
      nom: "cible complete, mais aucun successeur nomme",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, `--clubId=${CLUB}`],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucun successeur nomme",
    },
    {
      nom: "l'environnement ne declare aucun projet",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, `--clubId=${CLUB}`, "--nouveauProprietaire=joueur1"],
      env: {},
      motif: "aucun projet",
    },
    {
      nom: "l'environnement pointe ailleurs que la cible demandee",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, `--clubId=${CLUB}`, "--nouveauProprietaire=joueur1"],
      env: { GCLOUD_PROJECT: PROJET_PRODUCTION },
      motif: "desaccord de cible",
    },
    {
      nom: "confirmation NUE (l'ancienne commande, copiee-collee)",
      argv: [
        `--projet=${PROJET_BAC_A_SABLE}`,
        `--clubId=${CLUB}`,
        "--nouveauProprietaire=joueur1",
        "--apply",
        "--je-confirme",
      ],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "confirmation qui NOMME la cible",
    },
    {
      nom: "confirmation qui ne nomme QUE le projet (le club vise n'est pas relu)",
      argv: [
        `--projet=${PROJET_BAC_A_SABLE}`,
        `--clubId=${CLUB}`,
        "--nouveauProprietaire=joueur1",
        "--apply",
        `--je-confirme=${PROJET_BAC_A_SABLE}`,
      ],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "ne correspond pas a la cible",
    },
    {
      nom: "confirmation qui nomme un AUTRE club de la meme base",
      argv: [
        `--projet=${PROJET_BAC_A_SABLE}`,
        `--clubId=${CLUB}`,
        "--nouveauProprietaire=joueur1",
        "--apply",
        `--je-confirme=${PROJET_BAC_A_SABLE}/clubB`,
      ],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "ne correspond pas a la cible",
    },
    {
      nom: "production visee sans l'option qui l'assume",
      argv: [
        `--projet=${PROJET_PRODUCTION}`,
        `--clubId=${CLUB}`,
        "--nouveauProprietaire=joueur1",
        "--apply",
        `--je-confirme=${PROJET_PRODUCTION}/${CLUB}`,
      ],
      env: { GCLOUD_PROJECT: PROJET_PRODUCTION },
      motif: "PRODUCTION",
    },
  ];

  it.each(scenarios)("$nom : ZERO ecriture, sortie non nulle", async ({ argv, env, motif }) => {
    const { code, compteurs, base, erreurs } = await lancerTransfert(argv, env);

    // 1. Le compte d'ecritures est a ZERO. C'est la preuve demandee.
    expect(compteurs.ecritures).toBe(0);
    expect(compteurs.suppressions).toBe(0);
    // 2. Mieux : le magasin n'a meme pas ete construit. Pas de quoi ecrire.
    expect(compteurs.constructions).toBe(0);
    expect(compteurs.lectures).toBe(0);
    // 3. Code de sortie non nul : un script enchaine s'arrete la.
    expect(code).not.toBe(0);
    // 4. Un refus, et un refus EXPLICABLE.
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toContain(motif);
    // 5. Et la propriete n'a pas bouge d'un pouce.
    expect(base["clubs/clubA"].ownerUid).toBe("coach1");
  });
});

describe("TRANSFERT : simulation acceptee, mais toujours ZERO ecriture", () => {
  it("cible complete, sans --apply : on LIT, on n'ecrit pas", async () => {
    const { code, compteurs, base, sorties } = await lancerTransfert(
      [`--projet=${PROJET_BAC_A_SABLE}`, `--clubId=${CLUB}`, "--nouveauProprietaire=joueur1"],
      { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
    );

    expect(code).toBe(0);
    expect(compteurs.constructions).toBe(1);
    expect(compteurs.lectures).toBeGreaterThan(0); // il a bien regarde...
    expect(compteurs.ecritures).toBe(0); // ...et n'a rien ecrit
    expect(compteurs.suppressions).toBe(0);
    expect(base["clubs/clubA"].ownerUid).toBe("coach1");
    expect(base["clubs/clubA/playerSummaries/joueur1"]).toBeDefined();

    // Elle dit exactement quoi taper ensuite, couple projet/club compris.
    expect(sorties.join(" ")).toContain(`--je-confirme=${CIBLE_COUPLE}`);
  });

  it("simulation sur la PRODUCTION : autorisee (elle ne peut rien ecrire), et annoncee comme telle", async () => {
    const { code, compteurs, sorties } = await lancerTransfert(
      [`--projet=${PROJET_PRODUCTION}`, `--clubId=${CLUB}`, "--nouveauProprietaire=joueur1"],
      { GCLOUD_PROJECT: PROJET_PRODUCTION },
    );

    expect(code).toBe(0);
    expect(compteurs.ecritures).toBe(0);
    expect(sorties[0]).toContain("PRODUCTION PRESUMEE");
    expect(sorties.join(" ")).toContain("--oui-je-vise-la-production");
  });
});

describe("TRANSFERT — TEMOIN POSITIF : le compteur sait compter", () => {
  // Sans ce temoin, tous les zeros ci-dessus pourraient venir d'un compteur mort.
  it("cible + club + --apply + confirmation du couple : le transfert ecrit vraiment", async () => {
    const { code, compteurs, base } = await lancerTransfert(
      [
        `--projet=${PROJET_BAC_A_SABLE}`,
        `--clubId=${CLUB}`,
        "--nouveauProprietaire=joueur1",
        "--apply",
        `--je-confirme=${CIBLE_COUPLE}`,
      ],
      { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
    );

    expect(code).toBe(0);
    expect(compteurs.constructions).toBe(1);
    // LE POINT DU TEMOIN : le compteur d'ecritures n'est PAS mort. Le nombre
    // exact d'ecritures, lui, est le sujet de clubOwnership.test.ts — l'affirmer
    // ici ferait de ce fichier un second endroit ou verrouiller le contrat du
    // transfert, c'est-a-dire un second endroit ou il pourrait deriver.
    expect(compteurs.ecritures).toBeGreaterThan(0);

    // La preuve d'etat qui, elle, ne depend d'aucune forme d'appartenance : la
    // designation a change de main.
    expect(base["clubs/clubA"].ownerUid).toBe("joueur1");
  });

  it("production ASSUMEE : les trois options ensemble, et seulement ensemble", async () => {
    const { code, compteurs, base } = await lancerTransfert(
      [
        `--projet=${PROJET_PRODUCTION}`,
        `--clubId=${CLUB}`,
        "--nouveauProprietaire=joueur1",
        "--apply",
        `--je-confirme=${PROJET_PRODUCTION}/${CLUB}`,
        "--oui-je-vise-la-production",
      ],
      { GCLOUD_PROJECT: PROJET_PRODUCTION },
    );

    expect(code).toBe(0);
    expect(compteurs.ecritures).toBeGreaterThan(0);
    expect(base["clubs/clubA"].ownerUid).toBe("joueur1");
  });

  it("un refus METIER (successeur hors effectif) sort non nul, sans rien ecrire", async () => {
    // Le verrou de cible dit OUI, le coeur dit NON : ce sont bien deux etages.
    const { code, compteurs, erreurs, base } = await lancerTransfert(
      [
        `--projet=${PROJET_BAC_A_SABLE}`,
        `--clubId=${CLUB}`,
        "--nouveauProprietaire=inconnu",
        "--apply",
        `--je-confirme=${CIBLE_COUPLE}`,
      ],
      { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
    );

    expect(code).toBe(1);
    expect(compteurs.ecritures).toBe(0);
    expect(erreurs.join(" ")).toContain("effectif actif");
    expect(base["clubs/clubA"].ownerUid).toBe("coach1");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// OUTIL 2 — LA MISE A NIVEAU DES ACCES COACH
// ════════════════════════════════════════════════════════════════════════════

type BaseMembres = Record<string, MemberSnapshot>;

/**
 * Magasin INSTRUMENTE du backfill. La simulation, ELLE, existait deja : le coeur
 * remplace le port d'ecriture quand `apply` est faux (`readOnly`, dans
 * coachAccessBackfill.ts). Ce que ce lot ajoute, c'est le verrou de CIBLE
 * au-dessus — et la construction paresseuse du magasin.
 */
function magasinBackfill(): {
  creerStore: () => CoachAccessBackfillStore;
  compteurs: Compteurs;
  base: BaseMembres;
} {
  const base: BaseMembres = {
    "clubA/joueur1": { playerStatus: "active", coachAccess: undefined },
    "clubA/joueur2": { playerStatus: "active", coachAccess: undefined },
  };
  const compteurs = compteursNeufs();

  const creerStore = (): CoachAccessBackfillStore => {
    compteurs.constructions += 1;
    return {
      async listPlayerMembers(clubId?: string): Promise<MemberRef[]> {
        compteurs.lectures += 1;
        return Object.keys(base)
          .map((cle) => {
            const [c, p] = cle.split("/");
            return { clubId: c, playerUid: p };
          })
          .filter((m) => !clubId || m.clubId === clubId);
      },
      async readMember(clubId, playerUid) {
        compteurs.lectures += 1;
        return base[`${clubId}/${playerUid}`] ?? null;
      },
      async readClubPolicy() {
        compteurs.lectures += 1;
        // Politique par defaut : le script ne peut poser que "not_required".
        return undefined;
      },
      async writeCoachAccess(clubId, playerUid, state) {
        compteurs.ecritures += 1;
        base[`${clubId}/${playerUid}`] = {
          ...base[`${clubId}/${playerUid}`],
          coachAccess: state,
        };
      },
    };
  };

  return { creerStore, compteurs, base };
}

async function lancerBackfill(
  argv: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number; compteurs: Compteurs; base: BaseMembres; sorties: string[]; erreurs: string[] }> {
  const { creerStore, compteurs, base } = magasinBackfill();
  const sorties: string[] = [];
  const erreurs: string[] = [];
  const code = await executerBackfillCli({
    argv,
    env,
    creerStore,
    log: (m) => sorties.push(m),
    erreur: (m) => erreurs.push(m),
  });
  return { code, compteurs, base, sorties, erreurs };
}

describe("ACCES COACH : sans autorisation explicite, ZERO ecriture", () => {
  const scenarios: { nom: string; argv: string[]; env: NodeJS.ProcessEnv; motif: string }[] = [
    {
      nom: "aucune option du tout",
      argv: [],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "--apply tout seul (l'erreur la plus probable)",
      argv: ["--apply"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "l'ANCIENNE commande, copiee-collee de la doc d'avant ce lot",
      argv: [`--clubId=${CLUB}`, "--apply", "--je-confirme"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "cible mal formee",
      argv: ["--projet=Fks-Apps!", "--apply", "--je-confirme=Fks-Apps!"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "identifiant de projet",
    },
    {
      nom: "cible vide (--projet= sans rien)",
      argv: ["--projet=", "--apply"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "aucune cible",
    },
    {
      nom: "club mal forme",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, "--clubId=club A/../autre"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "--clubId invalide",
    },
    {
      nom: "l'environnement ne declare aucun projet",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, "--apply", `--je-confirme=${PROJET_BAC_A_SABLE}`],
      env: {},
      motif: "aucun projet",
    },
    {
      nom: "l'environnement pointe ailleurs que la cible demandee",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, "--apply", `--je-confirme=${PROJET_BAC_A_SABLE}`],
      env: { GCLOUD_PROJECT: PROJET_PRODUCTION },
      motif: "desaccord de cible",
    },
    {
      nom: "confirmation NUE",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, "--apply", "--je-confirme"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "confirmation qui NOMME la cible",
    },
    {
      nom: "confirmation qui nomme un AUTRE projet",
      argv: [`--projet=${PROJET_BAC_A_SABLE}`, "--apply", "--je-confirme=demo-autre"],
      env: { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
      motif: "ne correspond pas a la cible",
    },
    {
      nom: "production visee sans l'option qui l'assume",
      argv: [`--projet=${PROJET_PRODUCTION}`, "--apply", `--je-confirme=${PROJET_PRODUCTION}`],
      env: { GCLOUD_PROJECT: PROJET_PRODUCTION },
      motif: "PRODUCTION",
    },
  ];

  it.each(scenarios)("$nom : ZERO ecriture, sortie non nulle", async ({ argv, env, motif }) => {
    const { code, compteurs, base, erreurs } = await lancerBackfill(argv, env);

    expect(compteurs.ecritures).toBe(0);
    expect(compteurs.suppressions).toBe(0);
    expect(compteurs.constructions).toBe(0);
    expect(compteurs.lectures).toBe(0);
    expect(code).not.toBe(0);
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toContain(motif);
    // Aucun etat d'autorisation n'a ete pose sur qui que ce soit.
    expect(base["clubA/joueur1"].coachAccess).toBeUndefined();
  });

  it("un refus ne divulgue AUCUN identifiant de joueur (il n'a rien lu)", async () => {
    const { erreurs } = await lancerBackfill(["--apply"], { GCLOUD_PROJECT: PROJET_BAC_A_SABLE });
    expect(erreurs.join(" ")).not.toContain("joueur1");
  });
});

describe("ACCES COACH : simulation acceptee, mais toujours ZERO ecriture", () => {
  it("cible correcte, sans --apply : on LIT, on n'ecrit pas", async () => {
    const { code, compteurs, base, sorties } = await lancerBackfill(
      [`--projet=${PROJET_BAC_A_SABLE}`, `--clubId=${CLUB}`],
      { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
    );

    expect(code).toBe(0);
    expect(compteurs.constructions).toBe(1);
    expect(compteurs.lectures).toBeGreaterThan(0);
    expect(compteurs.ecritures).toBe(0);
    expect(base["clubA/joueur1"].coachAccess).toBeUndefined();

    // Les compteurs disent ce qui SERAIT ecrit : c'est tout l'interet de l'etape 1.
    const ligne = sorties.find((s) => s.includes("termine")) ?? "";
    expect(ligne).toContain('"updated":2');
    expect(ligne).not.toContain("joueur1");
  });

  it("simulation sur la PRODUCTION : autorisee, et annoncee comme telle", async () => {
    const { code, compteurs, sorties } = await lancerBackfill([`--projet=${PROJET_PRODUCTION}`], {
      GCLOUD_PROJECT: PROJET_PRODUCTION,
    });

    expect(code).toBe(0);
    expect(compteurs.ecritures).toBe(0);
    expect(sorties[0]).toContain("PRODUCTION PRESUMEE");
    expect(sorties.join(" ")).toContain("--oui-je-vise-la-production");
  });
});

describe("ACCES COACH — TEMOIN POSITIF : le compteur sait compter", () => {
  it("cible + --apply + confirmation nominative : la mise a niveau ecrit vraiment", async () => {
    const { code, compteurs, base } = await lancerBackfill(
      [
        `--projet=${PROJET_BAC_A_SABLE}`,
        `--clubId=${CLUB}`,
        "--apply",
        `--je-confirme=${PROJET_BAC_A_SABLE}`,
      ],
      { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
    );

    expect(code).toBe(0);
    expect(compteurs.constructions).toBe(1);
    expect(compteurs.ecritures).toBe(2);
    expect(base["clubA/joueur1"].coachAccess).toBe("not_required");
    expect(base["clubA/joueur2"].coachAccess).toBe("not_required");
  });

  it("production ASSUMEE : les trois options ensemble, et seulement ensemble", async () => {
    const { code, compteurs } = await lancerBackfill(
      [
        `--projet=${PROJET_PRODUCTION}`,
        "--apply",
        `--je-confirme=${PROJET_PRODUCTION}`,
        "--oui-je-vise-la-production",
      ],
      { GCLOUD_PROJECT: PROJET_PRODUCTION },
    );

    expect(code).toBe(0);
    expect(compteurs.ecritures).toBe(2);
  });

  it("borner a un club n'ecrit que pour ce club", async () => {
    const { compteurs } = await lancerBackfill(
      [
        `--projet=${PROJET_BAC_A_SABLE}`,
        "--clubId=clubB",
        "--apply",
        `--je-confirme=${PROJET_BAC_A_SABLE}`,
      ],
      { GCLOUD_PROJECT: PROJET_BAC_A_SABLE },
    );
    // clubB n'existe pas dans la fixture : rien a ecrire, et surtout rien
    // d'ecrit pour clubA.
    expect(compteurs.ecritures).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LE VERROU PARTAGE — la portee "projet-et-club", dans le detail
// ════════════════════════════════════════════════════════════════════════════

describe("la portee de cible, dans le detail", () => {
  const env = { GCLOUD_PROJECT: PROJET_BAC_A_SABLE };

  it("les motifs de refus de la portee projet-et-club sont stables", () => {
    const motif = (argv: string[]) => {
      const d = analyserCible(argv, env, {
        peutEcrire: true,
        etiquette: "[t]",
        portee: "projet-et-club",
      });
      return d.ok ? "ok" : d.motif;
    };

    expect(motif([])).toBe("cible-absente");
    expect(motif([`--projet=${PROJET_BAC_A_SABLE}`])).toBe("club-absent");
    expect(motif([`--projet=${PROJET_BAC_A_SABLE}`, "--clubId=a b"])).toBe("club-mal-forme");
    expect(motif([`--projet=${PROJET_BAC_A_SABLE}`, `--clubId=${CLUB}`, "--apply"])).toBe(
      "confirmation-absente",
    );
    expect(
      motif([
        `--projet=${PROJET_BAC_A_SABLE}`,
        `--clubId=${CLUB}`,
        "--apply",
        `--je-confirme=${PROJET_BAC_A_SABLE}`,
      ]),
    ).toBe("confirmation-non-correspondante");
    expect(
      motif([
        `--projet=${PROJET_BAC_A_SABLE}`,
        `--clubId=${CLUB}`,
        "--apply",
        `--je-confirme=${CIBLE_COUPLE}`,
      ]),
    ).toBe("ok");
  });

  it("la portee par defaut reste 'projet' : le club n'y est qu'une borne facultative", () => {
    const d = analyserCible([`--projet=${PROJET_BAC_A_SABLE}`], env, {
      peutEcrire: true,
      etiquette: "[t]",
    });
    expect(d).toMatchObject({ ok: true, apply: false, clubId: undefined });
  });

  it("le libelle de cible est la MEME chaine dans le message et dans la procedure", () => {
    expect(libelleCible(PROJET_BAC_A_SABLE)).toBe(PROJET_BAC_A_SABLE);
    expect(libelleCible(PROJET_BAC_A_SABLE, CLUB)).toBe(CIBLE_COUPLE);
  });
});
