// functions/tests/ancienSchemaPreflight.test.ts
//
// LE PREFLIGHT DE DEPLOIEMENT : reste-t-il des appartenances a l'ANCIEN schema ?
//
// Ce que cette suite prouve, dans l'ordre d'importance :
//  1. le compte est EXACT (zero, un, un melange) ;
//  2. un preflight TRONQUE par le plafond dit INCERTAIN, JAMAIS propre. C'est le
//     piege central : « rien trouve » n'est pas « rien a trouver », et un PROPRE
//     prononce sur une lecture incomplete autoriserait le deploiement a tort ;
//  3. la reprise par curseur couvre exactement l'ensemble, sans trou ni doublon ;
//  4. la sortie ne divulgue AUCUN nom ni AUCUN identifiant d'utilisateur ;
//  5. une cible absente ou differente de l'environnement refuse SANS RIEN LIRE.
//
// ─── METHODE : PAR COMPTAGE ─────────────────────────────────────────────────
// Meme discipline que coachAccessBackfillBornes.test.ts : « la base n'a pas
// change » ne prouve rien pour un outil de lecture seule. On INSTRUMENTE le
// magasin et on COMPTE les constructions (donc les ouvertures de base), les
// demandes d'inventaire, et les documents REGARDES. Zero ouverture est une
// preuve ; et le journal des documents vus est ce qui rend le test de reprise
// honnete (un doublon serait invisible sur les seuls compteurs finaux).
//
// ─── LES IDENTIFIANTS DE LA FIXTURE SONT OPAQUES, ET LES NOMS SONT DEDANS ───
// Les uid sont techniques (`u001`...), et les DOCUMENTS portent des noms de
// personnes (`displayName`). C'est ce qui rend le test de fuite honnete : il ne
// verifie pas qu'on n'imprime pas une clef de fixture, il verifie qu'on
// n'imprime pas ce qu'on vient de LIRE.
//
// Aucune base reelle, aucun emulateur, aucun reseau. Cet outil n'a jamais ete
// execute ailleurs qu'ici.

import {
  classerAppartenance,
  comparerAppartenances,
  runAncienSchemaPreflight,
  VALEUR_ANCIENNE_NON_RECONNUE,
  type AppartenanceLue,
  type ParcoursAppartenances,
  type PreflightStore,
} from "../src/ancienSchemaPreflight";
import {
  CODE_INCERTAIN,
  CODE_PROPRE,
  CODE_REFUS,
  CODE_RESIDU,
  executerPreflightCli,
} from "../src/ancienSchemaPreflightCli";

const PROJET = "demo-fks";
const ENV = { GCLOUD_PROJECT: PROJET } as NodeJS.ProcessEnv;
const CIBLE = [`--projet=${PROJET}`];

/** Un role ancien, non reconnu, ET porteur d'un nom : deux fuites possibles en une. */
const ROLE_EXOTIQUE = "capitaine-aline-dupont";

/**
 * Une base ou l'ordre d'INSERTION n'est PAS l'ordre de parcours : si le bornage
 * se contentait de l'ordre naturel de l'objet, les tranches se chevaucheraient
 * ou laisseraient des trous, et ca se verrait.
 *
 * Ordre de parcours attendu (clubId puis uid) :
 *   clubA/u001, clubA/u002, clubA/u003, clubB/u004, clubB/u005
 */
type Base = Record<string, Record<string, unknown> | null>;

const BASE_MIXTE = (): Base => ({
  "clubB/u005": { role: "owner", accessRole: "owner", displayName: "Erwan Leroy" },
  "clubA/u002": { playerStatus: "active", displayName: "Bruno Martin" },
  "clubA/u001": { accessRole: "owner", displayName: "Aline Dupont" },
  "clubA/u003": { role: "player", displayName: "Celia Bernard" },
  "clubB/u004": { accessRole: null, playerStatus: "inactive", displayName: "Dorian Petit" },
});

/** La meme base, mais entierement au schema actuel. */
const BASE_NEUVE = (): Base => ({
  "clubA/u001": { accessRole: "owner", displayName: "Aline Dupont" },
  "clubA/u002": { playerStatus: "active", displayName: "Bruno Martin" },
  "clubA/u003": { accessRole: "coach", playerStatus: "active", displayName: "Celia Bernard" },
  "clubB/u004": { accessRole: null, playerStatus: "inactive", displayName: "Dorian Petit" },
  "clubB/u005": { playerStatus: "active", displayName: "Erwan Leroy" },
});

const ORDRE_COMPLET = ["clubA/u001", "clubA/u002", "clubA/u003", "clubB/u004", "clubB/u005"];

/** Tous les noms de personnes poses dans les documents de la fixture. */
const NOMS = ["Aline", "Dupont", "Bruno", "Martin", "Celia", "Bernard", "Dorian", "Petit", "Erwan", "Leroy"];

type Compteurs = {
  /** Combien de fois le magasin a ete CONSTRUIT (donc la base OUVERTE). */
  constructions: number;
  /** Combien de fois l'inventaire a ete demande. */
  inventaires: number;
};

type Instrument = {
  creerStore: () => PreflightStore;
  compteurs: Compteurs;
  /**
   * Documents effectivement CLASSES, dans l'ordre. Trous et doublons se lisent ici.
   *
   * Ce n'est pas tout a fait ce que le magasin a rendu : le coeur demande
   * volontairement UN document DE PLUS que le plafond, et ne le classe jamais —
   * cette SONDE sert uniquement a savoir s'il en reste (contrat documente dans
   * ancienSchemaPreflight.ts). L'instrument l'ecarte donc, sinon un document
   * apparaitrait en double a chaque changement de tranche alors qu'il n'a ete
   * compte qu'une fois.
   */
  vus: string[];
  /** Ce que le magasin a rendu, sonde comprise. */
  rendus: string[];
};

function instrumenter(
  base: Base = BASE_MIXTE(),
  opts: { casserOrdre?: (refs: AppartenanceLue[]) => AppartenanceLue[] } = {},
): Instrument {
  const compteurs: Compteurs = { constructions: 0, inventaires: 0 };
  const vus: string[] = [];
  const rendus: string[] = [];

  const creerStore = (): PreflightStore => {
    compteurs.constructions += 1;
    return {
      async listAppartenances({ clubId, apres, max }: ParcoursAppartenances) {
        compteurs.inventaires += 1;
        const refs: AppartenanceLue[] = Object.keys(base)
          .map((cle) => {
            const [c, u] = cle.split("/");
            return { clubId: c, uid: u, donnees: base[cle] };
          })
          .filter((m) => !clubId || m.clubId === clubId)
          .sort(comparerAppartenances)
          .filter((m) => !apres || comparerAppartenances(m, apres) > 0)
          .slice(0, max);
        const page = opts.casserOrdre ? opts.casserOrdre(refs) : refs;
        for (const r of page) rendus.push(`${r.clubId}/${r.uid}`);
        // Une page PLEINE (max documents) signale qu'il en reste : son dernier
        // document est la SONDE, jamais classee par le coeur.
        const classes = page.length === max ? page.slice(0, max - 1) : page;
        for (const r of classes) vus.push(`${r.clubId}/${r.uid}`);
        return page;
      },
    };
  };

  return { creerStore, compteurs, vus, rendus };
}

type Sortie = {
  code: number;
  compteurs: Compteurs;
  vus: string[];
  sorties: string[];
  erreurs: string[];
  texte: string;
};

async function lancer(argv: string[], instrument = instrumenter()): Promise<Sortie> {
  const sorties: string[] = [];
  const erreurs: string[] = [];
  const code = await executerPreflightCli({
    argv,
    env: ENV,
    creerStore: instrument.creerStore,
    log: (m) => sorties.push(m),
    erreur: (m) => erreurs.push(m),
  });
  return {
    code,
    compteurs: instrument.compteurs,
    vus: instrument.vus,
    sorties,
    erreurs,
    texte: [...sorties, ...erreurs].join(" | "),
  };
}

/** Le compteur affiche pour une ligne donnee du rapport. */
function compteurAffiche(texte: string, etiquette: string): number {
  const m = new RegExp(`${etiquette}\\s*:\\s*(\\d+)`).exec(texte);
  return m ? Number(m[1]) : Number.NaN;
}

// ════════════════════════════════════════════════════════════════════════════
// 1. LE COMPTE EST EXACT
// ════════════════════════════════════════════════════════════════════════════

describe("LE COMPTE : zero, un, un melange", () => {
  it("base VIDE : PROPRE, code 0, zero appartenance lue", async () => {
    const { code, texte } = await lancer([...CIBLE, "--limite=100"], instrumenter({}));

    expect(code).toBe(CODE_PROPRE);
    expect(texte).toContain("VERDICT : PROPRE");
    expect(compteurAffiche(texte, "appartenances lues")).toBe(0);
    expect(compteurAffiche(texte, "ANCIEN schema \\(champ role\\)")).toBe(0);
    // Elle dit explicitement que l'hypothese est verifiee A L'INSTANT.
    expect(texte).toContain("verifiee a l'instant");
  });

  it("uniquement le schema ACTUEL : PROPRE, code 0", async () => {
    const { code, texte } = await lancer([...CIBLE, "--limite=100"], instrumenter(BASE_NEUVE()));

    expect(code).toBe(CODE_PROPRE);
    expect(texte).toContain("VERDICT : PROPRE");
    expect(compteurAffiche(texte, "appartenances lues")).toBe(5);
    expect(compteurAffiche(texte, "ANCIEN schema \\(champ role\\)")).toBe(0);
    expect(compteurAffiche(texte, "schema actuel")).toBe(5);
  });

  it("UNE SEULE appartenance a l'ancien schema : RESIDU, compte exact, code non nul", async () => {
    const base: Base = {
      "clubA/u001": { accessRole: "owner", displayName: "Aline Dupont" },
      "clubA/u002": { playerStatus: "active", displayName: "Bruno Martin" },
      "clubA/u003": { role: "player", displayName: "Celia Bernard" },
    };
    const { code, texte } = await lancer([...CIBLE, "--limite=100"], instrumenter(base));

    expect(code).toBe(CODE_RESIDU);
    expect(code).not.toBe(0);
    expect(texte).toContain("VERDICT : RESIDU");
    expect(compteurAffiche(texte, "ANCIEN schema \\(champ role\\)")).toBe(1);
    expect(compteurAffiche(texte, "schema actuel")).toBe(2);
    expect(texte).toContain('{"player":1}');
    // Et elle dit quoi faire — c'est-a-dire : NE PAS deployer, et qu'il n'y a
    // rien a lancer, la migration restant a ecrire.
    expect(texte).toContain("NE DEPLOIE PAS");
    expect(texte).toContain("AUCUNE COMMANDE DE MIGRATION A LANCER");
    expect(texte).toContain("reste A ECRIRE");
  });

  it("MELANGE : chaque classe est comptee exactement, et la somme retombe juste", async () => {
    const { code, texte } = await lancer([...CIBLE, "--limite=100"]);

    expect(code).toBe(CODE_RESIDU);
    // 2 anciens (clubA/u003 role:player, clubB/u005 role:owner + accessRole)
    expect(compteurAffiche(texte, "ANCIEN schema \\(champ role\\)")).toBe(2);
    // dont 1 mixte : celui qui porte l'ancien champ ET un nouvel axe.
    expect(compteurAffiche(texte, "dont mixtes \\(ancien\\+neuf\\)")).toBe(1);
    expect(compteurAffiche(texte, "schema actuel")).toBe(3);
    expect(compteurAffiche(texte, "muettes \\(aucun des deux\\)")).toBe(0);
    expect(compteurAffiche(texte, "documents illisibles")).toBe(0);
    expect(compteurAffiche(texte, "appartenances lues")).toBe(5);
    expect(texte).toContain("2+3+0+0=5 doit valoir parcourues=5");
    expect(texte).toContain('{"player":1,"owner":1}');
  });

  it("une valeur `role` INCONNUE compte quand meme comme ancien schema (fail-closed)", async () => {
    const base: Base = { "clubA/u001": { role: ROLE_EXOTIQUE, displayName: "Aline Dupont" } };
    const { code, texte } = await lancer([...CIBLE, "--limite=100"], instrumenter(base));

    expect(code).toBe(CODE_RESIDU);
    expect(compteurAffiche(texte, "ANCIEN schema \\(champ role\\)")).toBe(1);
    // Comptee dans un seau ANONYME : la valeur elle-meme n'est jamais recopiee.
    expect(texte).toContain(VALEUR_ANCIENNE_NON_RECONNUE);
    expect(texte).not.toContain(ROLE_EXOTIQUE);
  });

  it("une borne --clubId ne compte QUE ce club", async () => {
    const { code, texte } = await lancer([...CIBLE, "--clubId=clubA", "--limite=100"]);

    expect(code).toBe(CODE_RESIDU);
    expect(compteurAffiche(texte, "appartenances lues")).toBe(3);
    expect(compteurAffiche(texte, "ANCIEN schema \\(champ role\\)")).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. LE PIEGE CENTRAL : TRONQUE = INCERTAIN, JAMAIS PROPRE
// ════════════════════════════════════════════════════════════════════════════

describe("PLAFOND ATTEINT : jamais PROPRE, meme quand rien n'a ete trouve", () => {
  it("les documents lus sont tous au schema actuel, mais il en RESTE : INCERTAIN", async () => {
    // Les deux premiers de BASE_NEUVE sont propres. Sans le garde-fou, l'outil
    // dirait PROPRE et autoriserait le deploiement sur une lecture partielle.
    const { code, texte } = await lancer([...CIBLE, "--limite=2"], instrumenter(BASE_NEUVE()));

    expect(code).toBe(CODE_INCERTAIN);
    expect(code).not.toBe(CODE_PROPRE);
    expect(texte).toContain("VERDICT : INCERTAIN");
    expect(texte).not.toContain("VERDICT : PROPRE");
    expect(compteurAffiche(texte, "ANCIEN schema \\(champ role\\)")).toBe(0);
    // Elle dit que le compte est incomplet, et pourquoi ca compte.
    expect(texte).toContain("ARRET SUR PLAFOND");
    expect(texte).toContain("INCOMPLET");
    expect(texte).toContain("un zero lu ici ne veut PAS dire que la base est propre");
    expect(texte).toContain("NE DEPLOIE PAS");
    expect(texte).toContain("« rien trouve » n'est pas « rien a trouver »");
    // Et elle donne le point de reprise exact.
    expect(texte).toContain("--reprendre-apres=clubA/u002");
  });

  it("EXACTEMENT le plafond, et rien au-dela : ce n'est PAS une troncature", async () => {
    // Le cas limite qui separe « j'ai tout lu » de « il en reste » : sans le
    // document supplementaire demande au magasin, les deux seraient confondus.
    const { code, texte } = await lancer([...CIBLE, "--limite=5"], instrumenter(BASE_NEUVE()));

    expect(code).toBe(CODE_PROPRE);
    expect(texte).toContain("VERDICT : PROPRE");
    expect(texte).not.toContain("ARRET SUR PLAFOND");
  });

  it("tronque ET residu trouve : RESIDU l'emporte (l'information la plus forte)", async () => {
    const { code, texte } = await lancer([...CIBLE, "--limite=3"]);

    expect(code).toBe(CODE_RESIDU);
    expect(texte).toContain("VERDICT : RESIDU");
    // Le plafond est signale quand meme : le compte reste incomplet.
    expect(texte).toContain("ARRET SUR PLAFOND");
    expect(compteurAffiche(texte, "ANCIEN schema \\(champ role\\)")).toBe(1);
  });

  it("un document ILLISIBLE interdit lui aussi PROPRE", async () => {
    const base: Base = {
      "clubA/u001": { accessRole: "owner", displayName: "Aline Dupont" },
      "clubA/u002": null,
    };
    const { code, texte } = await lancer([...CIBLE, "--limite=100"], instrumenter(base));

    expect(code).toBe(CODE_INCERTAIN);
    expect(texte).toContain("VERDICT : INCERTAIN");
    expect(compteurAffiche(texte, "documents illisibles")).toBe(1);
    // La lecture n'a pas ete tronquee : c'est bien le document illisible, seul,
    // qui interdit de conclure.
    expect(texte).not.toContain("ARRET SUR PLAFOND");
    expect(texte).toContain("documents illisibles=1");
  });

  it("les trois verdicts ont des codes de sortie DISTINCTS et non nuls sauf PROPRE", () => {
    expect(CODE_PROPRE).toBe(0);
    expect(new Set([CODE_PROPRE, CODE_REFUS, CODE_RESIDU, CODE_INCERTAIN]).size).toBe(4);
    for (const code of [CODE_REFUS, CODE_RESIDU, CODE_INCERTAIN]) expect(code).not.toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. LA REPRISE PAR CURSEUR : ni trou, ni doublon
// ════════════════════════════════════════════════════════════════════════════

describe("REPRISE PAR CURSEUR : trois tranches couvrent exactement l'ensemble", () => {
  it("chaque appartenance est regardee UNE fois, et le total retombe sur la base entiere", async () => {
    // Un seul instrument : les trois tranches travaillent sur la MEME base et
    // les journaux s'accumulent. C'est ce qui permet de lire trous et doublons.
    const instrument = instrumenter();

    const t1 = await lancer([...CIBLE, "--limite=2"], instrument);
    expect(t1.code).toBe(CODE_INCERTAIN); // rien trouve, mais tronque
    const curseur1 = /--reprendre-apres=(\S+)/.exec(t1.texte)?.[1];
    expect(curseur1).toBe("clubA/u002");

    const t2 = await lancer([...CIBLE, "--limite=2", `--reprendre-apres=${curseur1}`], instrument);
    expect(t2.code).toBe(CODE_RESIDU); // clubA/u003 porte role:player
    const curseur2 = /--reprendre-apres=(\S+)/.exec(t2.texte)?.[1];
    expect(curseur2).toBe("clubB/u004");

    // Derniere tranche : elle FRANCHIT la frontiere de club, le cas ou un
    // curseur mal choisi sauterait ou repeterait des documents.
    const t3 = await lancer([...CIBLE, "--limite=2", `--reprendre-apres=${curseur2}`], instrument);
    expect(t3.code).toBe(CODE_RESIDU); // clubB/u005 porte role:owner
    expect(t3.texte).not.toContain("ARRET SUR PLAFOND");

    // LE VERDICT : chaque document vu EXACTEMENT une fois, dans l'ordre, aucun
    // oublie. Un doublon donnerait une clef en double, un trou en ferait manquer une.
    expect(instrument.vus).toEqual(ORDRE_COMPLET);
    expect(new Set(instrument.vus).size).toBe(ORDRE_COMPLET.length);

    // Et les trois tranches, additionnees, redonnent la base entiere : cinq
    // appartenances lues, deux a l'ancien schema.
    const somme = (etiquette: string) =>
      [t1, t2, t3].reduce((n, t) => n + compteurAffiche(t.texte, etiquette), 0);
    expect(somme("appartenances lues")).toBe(5);
    expect(somme("ANCIEN schema \\(champ role\\)")).toBe(2);
    expect(somme("schema actuel")).toBe(3);
  });

  it("reprendre APRES le dernier document ne lit rien, et le dit proprement", async () => {
    const instrument = instrumenter();
    const { code, texte } = await lancer(
      [...CIBLE, "--limite=10", "--reprendre-apres=clubB/u005"],
      instrument,
    );

    expect(code).toBe(CODE_PROPRE);
    expect(compteurAffiche(texte, "appartenances lues")).toBe(0);
    expect(instrument.vus).toEqual([]);
    expect(texte).not.toContain("ARRET SUR PLAFOND");
  });

  it("une reprise qui nomme un AUTRE club que la borne --clubId : refus sans lecture", async () => {
    const { code, compteurs, erreurs } = await lancer([
      ...CIBLE,
      "--clubId=clubA",
      "--limite=10",
      "--reprendre-apres=clubB/u004",
    ]);

    expect(code).toBe(CODE_REFUS);
    expect(compteurs.constructions).toBe(0);
    expect(erreurs[0]).toContain("contradictoires");
  });

  it("un inventaire dans un ordre instable est REFUSE, sans verdict", async () => {
    // Exactement ce que produirait un curseur pose sur un champ NON UNIQUE.
    const instrument = instrumenter(BASE_MIXTE(), { casserOrdre: (refs) => [...refs].reverse() });
    const { code, texte } = await lancer([...CIBLE, "--limite=10"], instrument);

    expect(code).toBe(CODE_REFUS);
    expect(texte).toContain("ordre strictement croissant");
    // Aucun verdict n'a ete prononce : un compte faux ne vaut pas mieux qu'aucun.
    expect(texte).not.toContain("VERDICT");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. LA SORTIE NE DIVULGUE RIEN
// ════════════════════════════════════════════════════════════════════════════

describe("AUCUN IDENTIFIANT NOMINATIF EN SORTIE", () => {
  it("un parcours COMPLET n'imprime ni nom, ni uid, ni contenu de document", async () => {
    const { code, texte } = await lancer([...CIBLE, "--limite=100"]);

    expect(code).toBe(CODE_RESIDU);
    // Les noms poses DANS les documents lus.
    for (const nom of NOMS) expect(texte).not.toContain(nom);
    // Les identifiants d'utilisateurs.
    for (const cle of ORDRE_COMPLET) {
      expect(texte).not.toContain(cle);
      expect(texte).not.toContain(cle.split("/")[1]);
    }
    // Le champ qui portait les noms.
    expect(texte).not.toContain("displayName");
  });

  it("meme quand il TROUVE quelque chose, il dit COMBIEN, jamais QUI", async () => {
    const base: Base = {
      "clubA/u003": { role: "player", displayName: "Celia Bernard", email: "celia@example.com" },
    };
    const { texte } = await lancer([...CIBLE, "--limite=100"], instrumenter(base));

    expect(texte).toContain("ANCIEN schema (champ role) : 1");
    expect(texte).not.toContain("u003");
    expect(texte).not.toContain("Celia");
    expect(texte).not.toContain("celia@example.com");
    expect(texte).not.toContain("email");
  });

  it("la SEULE exception est le curseur, et seulement quand le plafond est atteint", async () => {
    const { texte } = await lancer([...CIBLE, "--limite=2"]);

    // Le curseur est un couple d'identifiants TECHNIQUES, sans lequel la reprise
    // serait impossible. Il n'apparait que la.
    expect(texte).toContain("--reprendre-apres=clubA/u002");
    // Et toujours aucun nom de personne.
    for (const nom of NOMS) expect(texte).not.toContain(nom);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. LA CIBLE : un verdict lu sur la mauvaise base autoriserait un deploiement
// ════════════════════════════════════════════════════════════════════════════

describe("CIBLE : absente ou differente = refus, ZERO lecture", () => {
  const scenarios: { nom: string; argv: string[]; env: NodeJS.ProcessEnv; motif: string }[] = [
    {
      nom: "aucune cible nommee",
      argv: ["--limite=10"],
      env: ENV,
      motif: "aucune cible",
    },
    {
      nom: "cible mal formee",
      argv: ["--projet=X", "--limite=10"],
      env: ENV,
      motif: "identifiant de projet Firebase",
    },
    {
      nom: "cible DIFFERENTE de l'environnement (le terminal ouvert la veille)",
      argv: [`--projet=${PROJET}`, "--limite=10"],
      env: { GCLOUD_PROJECT: "fks-apps" } as NodeJS.ProcessEnv,
      motif: "desaccord de cible",
    },
    {
      nom: "environnement muet",
      argv: [`--projet=${PROJET}`, "--limite=10"],
      env: {} as NodeJS.ProcessEnv,
      motif: "ne declare aucun projet",
    },
  ];

  it.each(scenarios)("$nom : refus, base jamais ouverte, aucun verdict", async ({
    argv,
    env,
    motif,
  }) => {
    const instrument = instrumenter();
    const sorties: string[] = [];
    const erreurs: string[] = [];
    const code = await executerPreflightCli({
      argv,
      env,
      creerStore: instrument.creerStore,
      log: (m) => sorties.push(m),
      erreur: (m) => erreurs.push(m),
    });

    expect(code).toBe(CODE_REFUS);
    expect(code).not.toBe(CODE_PROPRE);
    // LE POINT : la base n'a meme pas ete OUVERTE. Pas de quoi lire.
    expect(instrument.compteurs.constructions).toBe(0);
    expect(instrument.compteurs.inventaires).toBe(0);
    expect(instrument.vus).toEqual([]);
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0]).toContain(motif);
    // Et surtout : AUCUN verdict. Un refus ne doit pas ressembler a un PROPRE.
    expect([...sorties, ...erreurs].join(" ")).not.toContain("VERDICT");
  });

  it("le plafond est OBLIGATOIRE : sans lui, rien n'est lu", async () => {
    const { code, compteurs, erreurs } = await lancer([...CIBLE]);

    expect(code).toBe(CODE_REFUS);
    expect(compteurs.constructions).toBe(0);
    expect(erreurs[0]).toContain("aucun plafond");
  });

  it("--attendu est REFUSE : rien a ecrire, donc rien a redeclarer", async () => {
    const { code, compteurs, erreurs } = await lancer([...CIBLE, "--limite=10", "--attendu=5"]);

    expect(code).toBe(CODE_REFUS);
    expect(compteurs.constructions).toBe(0);
    expect(erreurs[0]).toContain("--attendu n'existe pas pour cette commande");
  });

  it("la ligne de mode annonce LECTURE SEULE, le plafond et le point de depart", async () => {
    // Une transcription de terminal doit suffire a savoir ce qui a ete lance.
    const { sorties } = await lancer([...CIBLE, "--limite=7"]);
    expect(sorties[0]).toContain("LECTURE SEULE");
    expect(sorties[0]).toContain("limite=7");
    expect(sorties[0]).toContain("reprise=DEBUT");
    expect(sorties[0]).toContain("bac a sable");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. LE MAGASIN NE PEUT PAS ECRIRE, ET C'EST UN FAIT DE TYPE
// ════════════════════════════════════════════════════════════════════════════

describe("LECTURE SEULE : il n'y a pas de chemin d'ecriture a oublier", () => {
  it("le port ne porte QUE la lecture d'inventaire", async () => {
    const store = instrumenter().creerStore();
    expect(Object.keys(store)).toEqual(["listAppartenances"]);
    // Aucun nom d'ecriture, sous aucune forme.
    for (const nom of ["write", "set", "update", "delete", "merge", "runTransaction"]) {
      expect((store as unknown as Record<string, unknown>)[nom]).toBeUndefined();
    }
  });

  it("aucune option --apply / --je-confirme n'est reconnue : elles ne changent rien", async () => {
    // Copiees-collees d'une autre commande, elles sont ignorees — et surtout
    // elles ne peuvent RIEN declencher : il n'y a pas d'ecriture a autoriser.
    const avec = await lancer([...CIBLE, "--limite=100", "--apply", `--je-confirme=${PROJET}`]);
    const sans = await lancer([...CIBLE, "--limite=100"]);
    expect(avec.code).toBe(sans.code);
    expect(avec.sorties.slice(1)).toEqual(sans.sorties.slice(1));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. LA CLASSIFICATION, DANS LE DETAIL (fonction pure)
// ════════════════════════════════════════════════════════════════════════════

describe("classerAppartenance : la definition, sans passer par la commande", () => {
  const classe = (d: Record<string, unknown> | null) => classerAppartenance(d).classe;

  it("l'ancien champ, dans ses quatre valeurs", () => {
    for (const v of ["owner", "coach", "player", "removed"]) {
      expect(classe({ role: v })).toBe("ancien-schema");
      expect(classerAppartenance({ role: v }).valeurAncienne).toBe(v);
    }
  });

  it("une valeur inconnue reste de l'ancien schema, comptee dans le seau anonyme", () => {
    const c = classerAppartenance({ role: "capitaine" });
    expect(c.classe).toBe("ancien-schema");
    expect(c.valeurAncienne).toBe(VALEUR_ANCIENNE_NON_RECONNUE);
  });

  it("l'ancien champ EFFACE (null, vide, absent) n'est pas de l'ancien schema", () => {
    expect(classe({ role: null, playerStatus: "active" })).toBe("nouveau-schema");
    expect(classe({ role: "   ", playerStatus: "active" })).toBe("nouveau-schema");
    expect(classe({ playerStatus: "active" })).toBe("nouveau-schema");
  });

  it("ancien ET nouveau a la fois : ancien schema, et MIXTE", () => {
    const c = classerAppartenance({ role: "owner", accessRole: "owner" });
    expect(c.classe).toBe("ancien-schema");
    expect(c.mixte).toBe(true);
  });

  it("la pierre tombale du modele actuel est du nouveau schema", () => {
    expect(classe({ accessRole: null, playerStatus: "inactive", removedAt: "2026-07-01" })).toBe(
      "nouveau-schema",
    );
  });

  it("ni ancien champ ni aucun des deux axes : muette, jamais bloquante", () => {
    expect(classe({ displayName: "Aline Dupont" })).toBe("muette");
    expect(classe({})).toBe("muette");
    // Un axe present mais avec une valeur inconnue ne compte pas comme nouveau
    // schema : fail-closed, exactement comme le lit clubAuthority.
    expect(classe({ accessRole: "capitaine" })).toBe("muette");
  });

  it("des donnees inexploitables sont illisibles, pas propres", () => {
    expect(classe(null)).toBe("illisible");
    expect(classerAppartenance([] as unknown as Record<string, unknown>).classe).toBe("illisible");
  });
});

describe("runAncienSchemaPreflight : les refus du coeur", () => {
  it("une limite invalide refuse SANS demander d'inventaire", async () => {
    const instrument = instrumenter();
    for (const limite of [0, -1, 1.5, Number.NaN]) {
      const res = await runAncienSchemaPreflight(instrument.creerStore(), { limite });
      expect(res.ok).toBe(false);
      expect(res.ok === false && res.motif).toBe("limite-invalide");
    }
    expect(instrument.compteurs.inventaires).toBe(0);
  });

  it("un refus ne porte AUCUN compteur : rien n'a ete conclu", async () => {
    const res = await runAncienSchemaPreflight(instrumenter().creerStore(), { limite: 0 });
    expect(res.ok).toBe(false);
    expect(res).not.toHaveProperty("rapport");
  });

  it("le curseur d'une tranche vide reste null : il n'invente pas un point de reprise", async () => {
    const res = await runAncienSchemaPreflight(instrumenter({}).creerStore(), { limite: 5 });
    expect(res.ok).toBe(true);
    expect(res.ok && res.rapport.curseur).toBeNull();
    expect(res.ok && res.rapport.parcourues).toBe(0);
    expect(res.ok && res.rapport.verdict).toBe("PROPRE");
  });
});
