// functions/tests/coachAccessBackfillBornes.test.ts
//
// LE BORNAGE DU PARCOURS de la mise a niveau des acces coach : plafond
// obligatoire, reprise par curseur, compteur attendu.
//
// `outilsAdministrateurCible.test.ts` prouve qu'on ne se trompe pas de BASE.
// Celui-ci prouve qu'on ne se trompe pas de PERIMETRE, et qu'un parcours
// interrompu se reprend sans trou ni doublon.
//
// ─── POURQUOI PAR COMPTAGE, ENCORE ──────────────────────────────────────────
// Meme methode, et pour la meme raison : « la base n'a pas change » ne prouve
// rien. On INSTRUMENTE le magasin et on COMPTE — les constructions (donc les
// ouvertures de base), les lectures d'inventaire, les visites document par
// document, les ecritures. Zero appel, c'est une preuve.
//
// Le comptage des VISITES est ce qui rend le test de reprise honnete : l'outil
// etant idempotent, un document traite deux fois ne produirait PAS deux
// ecritures — le doublon serait invisible si on ne comptait que celles-ci. On
// compte donc qui a ete REGARDE, et combien de fois.
//
// Et un TEMOIN POSITIF prouve que ces compteurs savent compter.
//
// Aucune base reelle, aucun emulateur, aucun reseau. Cet outil n'a jamais ete
// execute ailleurs qu'ici.

import { executerBackfillCli } from "../src/coachAccessBackfillCli";
import {
  comparerMemberRefs,
  runCoachAccessBackfill,
  type CoachAccessBackfillStore,
  type MemberRef,
  type ParcoursMembres,
} from "../src/coachAccessBackfill";
import { analyserBornes, verifierOrdreStrict } from "../src/migrationBornes";
import type { MemberSnapshot } from "../src/coachAccessSync";

const PROJET = "demo-fks";
const CLUB = "clubA";
const ENV = { GCLOUD_PROJECT: PROJET } as NodeJS.ProcessEnv;

/** La cible, toujours acceptee : ce fichier ne parle QUE des bornes. */
const CIBLE = [`--projet=${PROJET}`, `--clubId=${CLUB}`];
const CIBLE_TOUS = [`--projet=${PROJET}`];
const CONFIRME = ["--apply", `--je-confirme=${PROJET}`];

type Compteurs = {
  /** Combien de fois le magasin a ete CONSTRUIT (donc de fois qu'on a ouvert la base). */
  constructions: number;
  /** Combien de fois l'inventaire a ete demande. */
  inventaires: number;
  ecritures: number;
};

/**
 * Un effectif dont l'ordre d'INSERTION n'est PAS l'ordre de parcours : si le
 * bornage se contentait de l'ordre naturel de l'objet, les tranches se
 * chevaucheraient ou laisseraient des trous, et ca se verrait.
 *
 * Ordre de parcours attendu (clubId puis playerUid) :
 *   clubA/aline, clubA/bruno, clubA/celia, clubA/dorian, clubB/erwan
 */
const EFFECTIF = (): Record<string, MemberSnapshot> => ({
  "clubA/dorian": { playerStatus: "active", coachAccess: undefined },
  "clubB/erwan": { playerStatus: "active", coachAccess: undefined },
  "clubA/aline": { playerStatus: "active", coachAccess: undefined },
  "clubA/celia": { playerStatus: "active", coachAccess: undefined },
  "clubA/bruno": { playerStatus: "active", coachAccess: undefined },
});

const ORDRE_ATTENDU = [
  "clubA/aline",
  "clubA/bruno",
  "clubA/celia",
  "clubA/dorian",
  "clubB/erwan",
];

type Instrument = {
  creerStore: () => CoachAccessBackfillStore;
  compteurs: Compteurs;
  base: Record<string, MemberSnapshot>;
  /** Clefs REGARDEES, dans l'ordre. Un doublon ou un trou se lit ici. */
  visites: string[];
  ecrites: string[];
};

/**
 * `casserOrdre` sert au seul test qui verifie le garde-fou d'ordre : il simule
 * un magasin qui rendrait ses documents dans un ordre instable — exactement ce
 * que produirait un curseur pose sur un champ non unique.
 */
function instrumenter(
  opts: { casserOrdre?: (refs: MemberRef[]) => MemberRef[] } = {},
): Instrument {
  const base = EFFECTIF();
  const compteurs: Compteurs = { constructions: 0, inventaires: 0, ecritures: 0 };
  const visites: string[] = [];
  const ecrites: string[] = [];

  const creerStore = (): CoachAccessBackfillStore => {
    compteurs.constructions += 1;
    return {
      async listPlayerMembers({ clubId, apres, max }: ParcoursMembres): Promise<MemberRef[]> {
        compteurs.inventaires += 1;
        const refs = Object.keys(base)
          .map((cle) => {
            const [c, p] = cle.split("/");
            return { clubId: c, playerUid: p };
          })
          .filter((m) => !clubId || m.clubId === clubId)
          .sort(comparerMemberRefs)
          .filter((m) => !apres || comparerMemberRefs(m, apres) > 0)
          .slice(0, max);
        return opts.casserOrdre ? opts.casserOrdre(refs) : refs;
      },
      async readMember(clubId, playerUid) {
        visites.push(`${clubId}/${playerUid}`);
        return base[`${clubId}/${playerUid}`] ?? null;
      },
      async readClubPolicy() {
        // Politique par defaut : le script ne peut poser que "not_required".
        return undefined;
      },
      async writeCoachAccess(clubId, playerUid, state) {
        compteurs.ecritures += 1;
        ecrites.push(`${clubId}/${playerUid}`);
        base[`${clubId}/${playerUid}`] = { ...base[`${clubId}/${playerUid}`], coachAccess: state };
      },
    };
  };

  return { creerStore, compteurs, base, visites, ecrites };
}

type Sortie = {
  code: number;
  compteurs: Compteurs;
  base: Record<string, MemberSnapshot>;
  visites: string[];
  ecrites: string[];
  sorties: string[];
  erreurs: string[];
};

async function lancer(argv: string[], instrument = instrumenter()): Promise<Sortie> {
  const sorties: string[] = [];
  const erreurs: string[] = [];
  const code = await executerBackfillCli({
    argv,
    env: ENV,
    creerStore: instrument.creerStore,
    log: (m) => sorties.push(m),
    erreur: (m) => erreurs.push(m),
  });
  return {
    code,
    compteurs: instrument.compteurs,
    base: instrument.base,
    visites: instrument.visites,
    ecrites: instrument.ecrites,
    sorties,
    erreurs,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// 1. LE PLAFOND EST OBLIGATOIRE — refus AVANT d'ouvrir la base
// ════════════════════════════════════════════════════════════════════════════

describe("PLAFOND : sans limite nommee, la commande ne parcourt RIEN", () => {
  const scenarios: { nom: string; argv: string[]; motif: string }[] = [
    {
      nom: "aucune limite, en SIMULATION (une simulation sans plafond parcourt deja tout)",
      argv: [...CIBLE],
      motif: "aucun plafond",
    },
    {
      nom: "aucune limite, en APPLY (l'ancienne commande, copiee-collee de la doc d'avant)",
      argv: [...CIBLE, ...CONFIRME],
      motif: "aucun plafond",
    },
    {
      nom: "--limite= vide",
      argv: [...CIBLE, "--limite="],
      motif: "aucun plafond",
    },
    {
      nom: "--limite=0 (parcourir zero document n'est pas une commande)",
      argv: [...CIBLE, "--limite=0"],
      motif: "entier positif",
    },
    {
      nom: "--limite=-5",
      argv: [...CIBLE, "--limite=-5"],
      motif: "entier positif",
    },
    {
      nom: "--limite=1.5 (un demi-document n'existe pas)",
      argv: [...CIBLE, "--limite=1.5"],
      motif: "entier positif",
    },
    {
      nom: "--limite=toute (un mot n'est pas un nombre)",
      argv: [...CIBLE, "--limite=toute"],
      motif: "entier positif",
    },
  ];

  it.each(scenarios)("$nom : ZERO lecture, ZERO ecriture, sortie non nulle", async ({
    argv,
    motif,
  }) => {
    const { code, compteurs, base, erreurs } = await lancer(argv);

    // 1. Rien n'a ete ecrit...
    expect(compteurs.ecritures).toBe(0);
    // 2. ...et surtout : la base n'a meme pas ete OUVERTE. Pas de quoi ecrire.
    expect(compteurs.constructions).toBe(0);
    expect(compteurs.inventaires).toBe(0);
    // 3. Code de sortie non nul : un script enchaine s'arrete la.
    expect(code).not.toBe(0);
    // 4. Un refus, et un refus EXPLICABLE.
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toContain(motif);
    // 5. Aucun etat n'a ete pose sur qui que ce soit.
    expect(base["clubA/aline"].coachAccess).toBeUndefined();
  });

  it("le refus ne divulgue AUCUN identifiant de joueur (il n'a rien lu)", async () => {
    const { erreurs } = await lancer([...CIBLE, ...CONFIRME]);
    expect(erreurs.join(" ")).not.toContain("aline");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. LE COMPTEUR ATTENDU
// ════════════════════════════════════════════════════════════════════════════

describe("COMPTEUR ATTENDU : on n'ecrit pas sur un perimetre que personne n'a compte", () => {
  it("--apply sans --attendu : refus, base jamais ouverte", async () => {
    const { code, compteurs, erreurs } = await lancer([...CIBLE, "--limite=10", ...CONFIRME]);

    expect(code).toBe(1);
    expect(compteurs.constructions).toBe(0);
    expect(compteurs.ecritures).toBe(0);
    expect(erreurs[0]).toContain("--attendu=");
    // Il dit quoi faire : lancer la simulation, qui produit le chiffre.
    expect(erreurs[0]).toContain("SIMULATION");
  });

  it("--attendu mal forme : refus, base jamais ouverte", async () => {
    const { code, compteurs, erreurs } = await lancer([
      ...CIBLE,
      "--limite=10",
      "--attendu=beaucoup",
      ...CONFIRME,
    ]);

    expect(code).toBe(1);
    expect(compteurs.constructions).toBe(0);
    expect(erreurs[0]).toContain("--attendu");
  });

  it("attendu DIFFERENT du reel : refus AVANT toute ecriture", async () => {
    // On declare 2 joueurs a traiter ; le club en compte 4. C'est le garde-fou
    // de perimetre : viser douze membres et en trouver quatre mille.
    const { code, compteurs, base, erreurs, ecrites } = await lancer([
      ...CIBLE,
      "--limite=10",
      "--attendu=2",
      ...CONFIRME,
    ]);

    expect(code).toBe(1);
    // La base a bien ete OUVERTE et LUE — il faut compter pour comparer...
    expect(compteurs.constructions).toBe(1);
    expect(compteurs.inventaires).toBe(1);
    // ...mais AUCUNE ecriture n'a eu lieu. C'est tout le point : le refus est
    // prononce avant la boucle, pas au deuxieme document.
    expect(compteurs.ecritures).toBe(0);
    expect(ecrites).toEqual([]);
    expect(base["clubA/aline"].coachAccess).toBeUndefined();
    expect(erreurs.join(" ")).toContain("2 attendu(s), 4 trouve(s)");
  });

  it("attendu declare en SIMULATION aussi : on peut verifier un chiffre sans risque", async () => {
    // 3 declares, 4 en base : la simulation refuse elle aussi. C'est ce qui
    // permet de contre-verifier un chiffre AVANT de toucher au mode ecriture.
    const { code, compteurs, erreurs } = await lancer([...CIBLE, "--limite=10", "--attendu=3"]);

    expect(code).toBe(1);
    expect(compteurs.ecritures).toBe(0);
    expect(erreurs.join(" ")).toContain("3 attendu(s), 4 trouve(s)");
  });

  it("attendu EXACT : la commande passe et ecrit", async () => {
    const { code, compteurs, ecrites } = await lancer([
      ...CIBLE,
      "--limite=10",
      "--attendu=4",
      ...CONFIRME,
    ]);

    expect(code).toBe(0);
    expect(compteurs.ecritures).toBe(4);
    expect(ecrites.sort()).toEqual(ORDRE_ATTENDU.filter((c) => c.startsWith("clubA/")));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. LE PIEGE : DEUX OPTIONS QUI SE CONTREDISENT
// ════════════════════════════════════════════════════════════════════════════

describe("OPTIONS CONTRADICTOIRES : refusees a la validation, pas au n-ieme document", () => {
  it("500 attendus sous un plafond de 100 : refus, base jamais ouverte", async () => {
    const { code, compteurs, erreurs } = await lancer([
      ...CIBLE,
      "--limite=100",
      "--attendu=500",
      ...CONFIRME,
    ]);

    expect(code).toBe(1);
    // LE POINT DU TEST : rien n'a ete ouvert, rien n'a ete lu, rien n'a ete
    // ecrit. La contradiction se voit sur la ligne de commande.
    expect(compteurs.constructions).toBe(0);
    expect(compteurs.inventaires).toBe(0);
    expect(compteurs.ecritures).toBe(0);
    expect(erreurs[0]).toContain("contradictoires");
    expect(erreurs[0]).toContain("500");
    expect(erreurs[0]).toContain("100");
  });

  it("une reprise qui nomme un AUTRE club que la borne --clubId : refus", async () => {
    const { code, compteurs, erreurs } = await lancer([
      ...CIBLE,
      "--limite=10",
      "--reprendre-apres=clubB/erwan",
    ]);

    expect(code).toBe(1);
    expect(compteurs.constructions).toBe(0);
    expect(erreurs[0]).toContain("contradictoires");
    expect(erreurs[0]).toContain("perimetres differents");
  });

  it("un curseur mal forme : refus, base jamais ouverte", async () => {
    for (const curseur of ["aline", "clubA/aline/encore", "clubA/", "/aline", "clubA aline"]) {
      const { code, compteurs, erreurs } = await lancer([
        ...CIBLE,
        "--limite=10",
        `--reprendre-apres=${curseur}`,
      ]);
      expect(code).toBe(1);
      expect(compteurs.constructions).toBe(0);
      expect(erreurs[0]).toContain("--reprendre-apres");
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. DEPASSEMENT DU PLAFOND : arret propre, jamais de troncature muette
// ════════════════════════════════════════════════════════════════════════════

describe("PLAFOND ATTEINT : la commande s'arrete et le DIT", () => {
  it("en APPLY : elle annonce ce qu'elle a ecrit, donne le point de reprise, sort non nul", async () => {
    const { code, compteurs, sorties, ecrites } = await lancer([
      ...CIBLE,
      "--limite=2",
      "--attendu=2",
      ...CONFIRME,
    ]);

    // 1. Elle a fait EXACTEMENT le plafond, pas un de plus.
    expect(compteurs.ecritures).toBe(2);
    expect(ecrites).toEqual(["clubA/aline", "clubA/bruno"]);
    // 2. Code non nul : un script enchaine ne prend pas ca pour un succes.
    expect(code).toBe(1);

    const texte = sorties.join(" | ");
    // 3. Elle dit qu'elle s'est arretee, et que le compte est incomplet.
    expect(texte).toContain("ARRET SUR PLAFOND");
    expect(texte).toContain("INCOMPLET");
    // 4. Elle annonce ce qui a ete ecrit AVANT l'arret.
    expect(texte).toContain("ce qui a ete ecrit avant l'arret");
    expect(texte).toContain("2 membership(s) mis a jour");
    // 5. Elle donne le point de reprise exact, pret a recopier.
    expect(texte).toContain("--reprendre-apres=clubA/bruno");
  });

  it("en SIMULATION : elle interdit explicitement d'utiliser ce chiffre comme attendu", async () => {
    const { code, compteurs, sorties } = await lancer([...CIBLE, "--limite=2"]);

    expect(code).toBe(1);
    expect(compteurs.ecritures).toBe(0);

    const texte = sorties.join(" | ");
    expect(texte).toContain("ARRET SUR PLAFOND");
    // LE PIEGE QU'ON FERME : lire "scanned:2" sur une simulation tronquee et
    // relancer avec --attendu=2 en croyant avoir tout couvert.
    expect(texte).toContain("NE DECLARE PAS ce chiffre en --attendu");
    // Et elle ne propose PAS la commande d'application toute faite.
    expect(texte).not.toContain("--attendu=2 --apply");
  });

  it("exactement le plafond, et rien au-dela : ce n'est PAS un depassement", async () => {
    // Le cas limite qui separe « j'ai tout fait » de « il en reste » : sans le
    // document supplementaire demande au magasin, les deux seraient confondus.
    const { code, compteurs, sorties } = await lancer([
      ...CIBLE,
      "--limite=4",
      "--attendu=4",
      ...CONFIRME,
    ]);

    expect(code).toBe(0);
    expect(compteurs.ecritures).toBe(4);
    expect(sorties.join(" ")).not.toContain("ARRET SUR PLAFOND");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. LA REPRISE : deux passages couvrent exactement l'ensemble
// ════════════════════════════════════════════════════════════════════════════

describe("REPRISE PAR CURSEUR : ni trou, ni doublon", () => {
  it("trois tranches sur toute la base couvrent les 5 membership, chacun UNE fois", async () => {
    // Un seul instrument : les trois tranches travaillent sur la MEME base, et
    // les compteurs s'accumulent. C'est ce qui permet de lire les trous et les
    // doublons a la fin.
    const instrument = instrumenter();

    const t1 = await lancer([...CIBLE_TOUS, "--limite=2", "--attendu=2", ...CONFIRME], instrument);
    expect(t1.code).toBe(1); // plafond atteint : il en reste
    const curseur1 = /--reprendre-apres=(\S+)/.exec(t1.sorties.join(" "))?.[1];
    expect(curseur1).toBe("clubA/bruno");

    const t2 = await lancer(
      [...CIBLE_TOUS, "--limite=2", "--attendu=2", `--reprendre-apres=${curseur1}`, ...CONFIRME],
      instrument,
    );
    expect(t2.code).toBe(1);
    const curseur2 = /--reprendre-apres=(\S+)/.exec(t2.sorties.join(" "))?.[1];
    expect(curseur2).toBe("clubA/dorian");

    // Derniere tranche : elle FRANCHIT la frontiere de club (clubA -> clubB),
    // le cas ou un curseur mal choisi sauterait ou repeterait des documents.
    const t3 = await lancer(
      [...CIBLE_TOUS, "--limite=2", "--attendu=1", `--reprendre-apres=${curseur2}`, ...CONFIRME],
      instrument,
    );
    expect(t3.code).toBe(0); // plus rien apres : fin propre
    expect(t3.sorties.join(" ")).not.toContain("ARRET SUR PLAFOND");

    // LE VERDICT : chaque membership regarde EXACTEMENT une fois, dans l'ordre,
    // et aucun oublie. Un doublon donnerait une clef en double (invisible sur
    // les seules ecritures, l'outil etant idempotent) ; un trou en ferait
    // manquer une.
    expect(instrument.visites).toEqual(ORDRE_ATTENDU);
    expect(instrument.ecrites).toEqual(ORDRE_ATTENDU);
    expect(instrument.compteurs.ecritures).toBe(5);
    for (const cle of ORDRE_ATTENDU) {
      expect(instrument.base[cle].coachAccess).toBe("not_required");
    }
  });

  it("reprendre apres le DERNIER document ne traite rien, et le dit proprement", async () => {
    const instrument = instrumenter();
    const { code, compteurs, sorties } = await lancer(
      [...CIBLE_TOUS, "--limite=2", "--attendu=0", "--reprendre-apres=clubB/erwan", ...CONFIRME],
      instrument,
    );

    expect(code).toBe(0);
    expect(compteurs.ecritures).toBe(0);
    expect(instrument.visites).toEqual([]);
    expect(sorties.join(" ")).not.toContain("ARRET SUR PLAFOND");
  });

  it("le curseur d'une tranche vide reste null : il n'invente pas un point de reprise", async () => {
    const res = await runCoachAccessBackfill(instrumenter().creerStore(), {
      limite: 5,
      clubId: "clubInexistant",
    });
    expect(res.ok).toBe(true);
    expect(res.ok && res.curseur).toBeNull();
    expect(res.ok && res.stats.scanned).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. L'ORDRE DU PARCOURS : le garde-fou qui rend la reprise fiable
// ════════════════════════════════════════════════════════════════════════════

describe("ORDRE INSTABLE : on s'arrete bruyamment plutot que de sauter en silence", () => {
  it("un inventaire non croissant est REFUSE, sans aucune ecriture", async () => {
    // Exactement ce que produirait un curseur pose sur un champ NON UNIQUE : des
    // documents rendus dans un ordre qui change d'une tranche a l'autre.
    const instrument = instrumenter({ casserOrdre: (refs) => [...refs].reverse() });
    const { code, compteurs, erreurs } = await lancer(
      [...CIBLE, "--limite=10", "--attendu=4", ...CONFIRME],
      instrument,
    );

    expect(code).toBe(1);
    expect(compteurs.ecritures).toBe(0);
    expect(instrument.visites).toEqual([]);
    expect(erreurs.join(" ")).toContain("ordre strictement croissant");
  });

  it("un document rendu deux fois dans la meme tranche est REFUSE", async () => {
    const instrument = instrumenter({ casserOrdre: (refs) => [refs[0], refs[0], ...refs.slice(1)] });
    const { code, compteurs, erreurs } = await lancer(
      [...CIBLE, "--limite=10", ...CONFIRME, "--attendu=5"],
      instrument,
    );

    expect(code).toBe(1);
    expect(compteurs.ecritures).toBe(0);
    expect(erreurs.join(" ")).toContain("ordre strictement croissant");
  });

  it("un inventaire qui redonne le point de reprise lui-meme est REFUSE", async () => {
    const instrument = instrumenter({
      casserOrdre: (refs) => [{ clubId: "clubA", playerUid: "bruno" }, ...refs],
    });
    const { code, compteurs, erreurs } = await lancer(
      [...CIBLE, "--limite=10", "--attendu=3", "--reprendre-apres=clubA/bruno", ...CONFIRME],
      instrument,
    );

    expect(code).toBe(1);
    expect(compteurs.ecritures).toBe(0);
    expect(erreurs.join(" ")).toContain("strictement apres le point de reprise");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. L'ENCHAINEMENT REEL : on simule, on lit le nombre, on le redeclare
// ════════════════════════════════════════════════════════════════════════════

describe("TEMOIN POSITIF : la simulation produit le chiffre qui debloque l'execution", () => {
  it("simuler, recopier le --attendu affiche, relancer : la commande ecrit vraiment", async () => {
    // 1. SIMULATION. Rien n'est ecrit, et la sortie contient la commande
    //    d'application, compteur attendu compris.
    const simulation = await lancer([...CIBLE, "--limite=50"]);
    expect(simulation.code).toBe(0);
    expect(simulation.compteurs.ecritures).toBe(0);

    const texte = simulation.sorties.join(" ");
    expect(texte).toContain("Le perimetre COMPLET fait 4 document(s)");

    // 2. On lit le nombre DANS la sortie, comme le ferait l'operateur.
    const attendu = /--attendu=(\d+)/.exec(texte)?.[1];
    expect(attendu).toBe("4");
    expect(texte).toContain(`--je-confirme=${PROJET}`);

    // 3. On relance en le declarant. Le compteur d'ecritures n'est PAS mort.
    const execution = await lancer([
      ...CIBLE,
      "--limite=50",
      `--attendu=${attendu}`,
      ...CONFIRME,
    ]);
    expect(execution.code).toBe(0);
    expect(execution.compteurs.ecritures).toBe(4);
    expect(execution.base["clubA/aline"].coachAccess).toBe("not_required");
    expect(execution.base["clubA/dorian"].coachAccess).toBe("not_required");
  });

  it("la ligne de mode annonce le plafond, le compteur et le point de depart", async () => {
    // Une transcription de terminal doit suffire a savoir ce qui a ete lance :
    // un plafond enorme se voit, un « attendu non declare » aussi.
    const { sorties } = await lancer([...CIBLE, "--limite=7"]);
    expect(sorties[0]).toContain("limite=7");
    expect(sorties[0]).toContain("attendu=non declare");
    expect(sorties[0]).toContain("reprise=DEBUT");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. LE MODULE DE BORNES, DANS LE DETAIL
// ════════════════════════════════════════════════════════════════════════════

describe("analyserBornes : des motifs stables", () => {
  const motif = (argv: string[], apply = false, conteneur?: string) => {
    const d = analyserBornes(argv, {
      etiquette: "[t]",
      apply,
      ...(conteneur !== undefined ? { conteneur } : {}),
    });
    return d.ok ? "ok" : d.motif;
  };

  it("couvre les sept refus", () => {
    expect(motif([])).toBe("limite-absente");
    expect(motif(["--limite=x"])).toBe("limite-mal-formee");
    expect(motif(["--limite=10"], true)).toBe("attendu-absent");
    expect(motif(["--limite=10", "--attendu=x"])).toBe("attendu-mal-forme");
    expect(motif(["--limite=10", "--attendu=11"])).toBe("attendu-superieur-limite");
    expect(motif(["--limite=10", "--reprendre-apres=abc"])).toBe("reprise-mal-formee");
    expect(motif(["--limite=10", "--reprendre-apres=clubB/x"], false, "clubA")).toBe(
      "reprise-hors-borne",
    );
  });

  it("le compteur attendu est FACULTATIF en simulation, OBLIGATOIRE en ecriture", () => {
    // C'est la simulation qui PRODUIT le chiffre : l'exiger la serait demander
    // de deviner ce qu'on vient chercher.
    expect(motif(["--limite=10"], false)).toBe("ok");
    expect(motif(["--limite=10"], true)).toBe("attendu-absent");
    expect(motif(["--limite=10", "--attendu=3"], true)).toBe("ok");
  });

  it("attendu=0 est une declaration valable (un perimetre deja traite)", () => {
    expect(motif(["--limite=10", "--attendu=0"], true)).toBe("ok");
  });

  it("attendu EGAL a la limite passe : c'est la tranche pleine, assumee", () => {
    expect(motif(["--limite=10", "--attendu=10"], true)).toBe("ok");
  });

  it("les valeurs acceptees sont bien celles qu'on relit", () => {
    const d = analyserBornes(["--limite=25", "--attendu=12", "--reprendre-apres=clubA/aline"], {
      etiquette: "[t]",
      apply: true,
    });
    expect(d).toEqual({
      ok: true,
      limite: 25,
      attendu: 12,
      reprise: { conteneur: "clubA", document: "aline" },
    });
  });
});

describe("verifierOrdreStrict : la definition, sans passer par la commande", () => {
  const p = (conteneur: string, document: string) => ({ conteneur, document });

  it("une page croissante passe", () => {
    expect(verifierOrdreStrict([p("a", "1"), p("a", "2"), p("b", "1")])).toBeNull();
  });

  it("une page vide passe", () => {
    expect(verifierOrdreStrict([])).toBeNull();
  });

  it("un doublon ne passe pas", () => {
    expect(verifierOrdreStrict([p("a", "1"), p("a", "1")])).toContain("croissant");
  });

  it("un retour en arriere ne passe pas", () => {
    expect(verifierOrdreStrict([p("b", "1"), p("a", "1")])).toContain("croissant");
  });

  it("le point de reprise lui-meme ne passe pas", () => {
    expect(verifierOrdreStrict([p("a", "1")], p("a", "1"))).toContain("strictement apres");
  });

  it("un document anterieur au point de reprise ne passe pas", () => {
    expect(verifierOrdreStrict([p("a", "0")], p("a", "1"))).toContain("strictement apres");
  });
});
